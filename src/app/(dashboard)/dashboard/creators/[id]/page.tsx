import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { creatorWhere, getPageAccess, requestWhere, type Access } from "@/lib/access/server";
import { NoAccess } from "@/components/access/no-access";
import { scrubCommunication } from "@/app/api/creators/creator-access";
import { CreatorVaultClient, type ProfileData } from "./creator-vault-client";
import {
  type CommunicationPreferences,
  DEFAULT_COMMUNICATION_PREFERENCES,
} from "@/types/communication-preferences";
import {
  ACTIVE_STATUSES,
  deliverySummary,
  finishedPoints,
  quietOf,
  requestFields,
} from "@/components/creators/insights";
import { creatorInvite } from "@/lib/invites";

// Generic on purpose: no creator or request name in the tab title
export const metadata = {
  title: "Creator",
  description: "A creator's requests, delivery record, messages and content",
};

async function getProfile(creatorId: string, access: Access): Promise<ProfileData | null> {
  const { agencyId, userId } = access;
  // Out-of-scope creators read as not found
  const creator = await db.creator.findFirst({
    where: { AND: [creatorWhere(access), { id: creatorId }] },
    include: { _count: { select: { requests: true, uploads: true } } },
  });
  if (!creator) return null;

  // What this role may see; everything else stays on the server
  const see = {
    email: access.has("creatorInfo.email"),
    phone: access.has("creatorInfo.phone"),
    notes: access.has("creatorInfo.notes"),
    location: access.has("creatorInfo.location"),
    preferences: access.has("creatorInfo.preferences"),
    content: access.has("creatorInfo.content"),
    activity: access.has("creatorInfo.activity"),
    invite: access.has("creatorInfo.invite"),
    requests: access.has("requests.view"),
    messages: access.has("messages.creators"),
  };

  const now = new Date();
  const [requests, override, recentUploads, conversation] = await Promise.all([
    db.contentRequest.findMany({
      where: {
        ...requestWhere(access),
        creatorId,
        status: { in: [...ACTIVE_STATUSES, "APPROVED", "CANCELLED"] },
      },
      orderBy: [{ dueDate: "asc" }],
      select: {
        id: true,
        title: true,
        status: true,
        dueDate: true,
        createdAt: true,
        submittedAt: true,
        reviewedAt: true,
        fields: true,
        fieldSubmissions: true,
        template: { select: { name: true } },
        uploads: { where: { uploadStatus: "COMPLETED" }, select: { fieldId: true, status: true } },
      },
    }),
    db.creatorReminderOverride.findUnique({
      where: { agencyId_creatorId: { agencyId, creatorId } },
      select: {
        isPaused: true,
        pauseResumeAt: true,
        quietHoursEnabled: true,
        quietHoursStart: true,
        quietHoursEnd: true,
      },
    }),
    // The content library is its own creator-information permission
    db.upload.findMany({
      where: see.content ? { creatorId, uploadStatus: "COMPLETED" } : { id: { in: [] } },
      orderBy: { uploadedAt: "desc" },
      take: 24,
      include: {
        request: { select: { id: true, title: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
    }),
    db.conversation.findFirst({
      where: see.messages ? { type: "CREATOR", creatorId, agencyId } : { id: { in: [] } },
      select: {
        id: true,
        messages: {
          orderBy: { createdAt: "desc" },
          take: 3,
          select: {
            id: true,
            content: true,
            createdAt: true,
            creatorId: true,
            readBy: true,
            sender: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  // Requests show only to someone who may see requests
  const visibleRequests = see.requests ? requests : [];
  const active = visibleRequests
    .filter((r) => (ACTIVE_STATUSES as readonly string[]).includes(r.status))
    .map((r) => ({
      id: r.id,
      title: r.title,
      kind: r.template?.name ?? null,
      due: r.dueDate ? r.dueDate.toISOString() : null,
      fields: requestFields(r, now),
    }));

  const finishedRows = visibleRequests
    .filter((r) => r.status === "APPROVED" || r.status === "CANCELLED")
    .sort((a, b) => (b.reviewedAt ?? b.submittedAt ?? b.createdAt).getTime() - (a.reviewedAt ?? a.submittedAt ?? a.createdAt).getTime());
  const points = finishedPoints(finishedRows);
  const pointById = new Map(points.map((p) => [p.id, p]));

  const prefs = creator.contentPreferences as Record<string, unknown>;
  const internalNotes = see.notes
    ? ((prefs?.internalNotes as ProfileData["internalNotes"] | undefined) ?? [])
    : [];
  const storedCommPrefs = prefs?.communicationPreferences as CommunicationPreferences | undefined;
  const communicationPreferences: CommunicationPreferences | null = see.preferences
    ? (scrubCommunication(
        access,
        (storedCommPrefs || {
          ...DEFAULT_COMMUNICATION_PREFERENCES,
          contactDetails: { email: creator.email, phone: creator.phone || undefined },
          timezone: creator.timezone || "UTC",
        }) as unknown as Record<string, unknown>
      ) as unknown as CommunicationPreferences)
    : null;

  // Without invite information the profile reads as if they have joined
  const invite = see.invite ? creatorInvite(creator, now) : ({ state: "accepted", expiresAt: null } as const);
  const paused = !!override?.isPaused && (!override.pauseResumeAt || override.pauseResumeAt > now);
  const isRead = (readBy: unknown) =>
    ((readBy as Array<{ userId?: string } | string>) || []).some((r) => (typeof r === "string" ? r : r?.userId) === userId);

  return {
    creator: {
      id: creator.id,
      name: creator.name,
      email: see.email ? creator.email : null,
      phone: see.phone ? creator.phone : null,
      avatar: creator.avatar,
      inviteStatus: see.invite ? creator.inviteStatus : "ACCEPTED",
      invite:
        invite.state === "accepted"
          ? null
          : { state: invite.state, expiresAt: invite.expiresAt ? invite.expiresAt.toISOString() : null },
      archivedAt: creator.archivedAt ? creator.archivedAt.toISOString() : null,
      timezone: see.location ? creator.timezone : null,
      preferredContact: see.preferences ? creator.preferredContact : null,
      createdAt: creator.createdAt.toISOString(),
      lastLoginAt: see.activity && creator.lastLoginAt ? creator.lastLoginAt.toISOString() : null,
      notes: see.notes ? creator.notes : null,
      totalRequests: creator._count.requests,
      totalUploads: creator._count.uploads,
    },
    quiet: quietOf(override),
    pause: { paused, resumeAt: paused && override?.pauseResumeAt ? override.pauseResumeAt.toISOString() : null },
    active,
    finished: finishedRows.map((r) => {
      const p = pointById.get(r.id);
      return {
        id: r.id,
        title: r.title,
        kind: r.template?.name ?? null,
        status: r.status,
        due: r.dueDate ? r.dueDate.toISOString() : null,
        finishedAt: (r.reviewedAt ?? r.submittedAt)?.toISOString() ?? null,
        daysEarly: p ? p.daysEarly : null,
        onTime: p ? p.onTime : null,
      };
    }),
    points: points.map((p) => ({
      id: p.id,
      title: p.title,
      due: p.due.toISOString(),
      delivered: p.delivered.toISOString(),
      daysEarly: p.daysEarly,
      onTime: p.onTime,
    })),
    delivery: deliverySummary(points),
    thread: conversation
      ? {
          id: conversation.id,
          messages: conversation.messages.map((m) => ({
            id: m.id,
            content: m.content,
            createdAt: m.createdAt.toISOString(),
            fromCreator: !!m.creatorId,
            author: m.creatorId ? creator.name : m.sender?.name ?? "Staff",
            unread: !!m.creatorId && !isRead(m.readBy),
          })),
        }
      : null,
    uploads: recentUploads.map((u) => ({
      id: u.id,
      fileName: u.fileName,
      originalName: u.originalName,
      fileType: u.fileType,
      fileSize: Number(u.fileSize),
      status: u.status,
      rating: u.rating,
      uploadedAt: u.uploadedAt ? u.uploadedAt.toISOString() : null,
      createdAt: u.createdAt.toISOString(),
      request: u.request,
      reviewedBy: u.reviewedBy,
    })),
    internalNotes,
    communicationPreferences,
  };
}

export default async function CreatorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const access = await getPageAccess();
  if (!access.has("creators.view")) return <NoAccess what="creators" roleName={access.role.name} />;
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const { id } = await params;
  let data: ProfileData | null = null;
  try {
    data = await getProfile(id, access);
  } catch (error) {
    console.error("Failed to fetch creator data:", error);
  }
  if (!data) notFound();

  return (
    <CreatorVaultClient
      data={data}
      currentUser={{
        id: session.user.id,
        name: session.user.name || "Unknown",
        role: access.role.name,
      }}
    />
  );
}
