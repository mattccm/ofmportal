import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
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

// Generic on purpose: no creator or request name in the tab title
export const metadata = {
  title: "Creator",
  description: "A creator's requests, delivery record, messages and content",
};

async function getProfile(creatorId: string, agencyId: string, userId: string): Promise<ProfileData | null> {
  const creator = await db.creator.findFirst({
    where: { id: creatorId, agencyId },
    include: { _count: { select: { requests: true, uploads: true } } },
  });
  if (!creator) return null;

  const now = new Date();
  const [requests, override, recentUploads, conversation] = await Promise.all([
    db.contentRequest.findMany({
      where: { creatorId, agencyId, status: { in: [...ACTIVE_STATUSES, "APPROVED", "CANCELLED"] } },
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
    db.upload.findMany({
      where: { creatorId, uploadStatus: "COMPLETED" },
      orderBy: { uploadedAt: "desc" },
      take: 24,
      include: {
        request: { select: { id: true, title: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
    }),
    db.conversation.findFirst({
      where: { type: "CREATOR", creatorId, agencyId },
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

  const active = requests
    .filter((r) => (ACTIVE_STATUSES as readonly string[]).includes(r.status))
    .map((r) => ({
      id: r.id,
      title: r.title,
      kind: r.template?.name ?? null,
      due: r.dueDate ? r.dueDate.toISOString() : null,
      fields: requestFields(r, now),
    }));

  const finishedRows = requests
    .filter((r) => r.status === "APPROVED" || r.status === "CANCELLED")
    .sort((a, b) => (b.reviewedAt ?? b.submittedAt ?? b.createdAt).getTime() - (a.reviewedAt ?? a.submittedAt ?? a.createdAt).getTime());
  const points = finishedPoints(finishedRows);
  const pointById = new Map(points.map((p) => [p.id, p]));

  const prefs = creator.contentPreferences as Record<string, unknown>;
  const internalNotes =
    (prefs?.internalNotes as ProfileData["internalNotes"] | undefined) ?? [];
  const storedCommPrefs = prefs?.communicationPreferences as CommunicationPreferences | undefined;
  const communicationPreferences: CommunicationPreferences = storedCommPrefs || {
    ...DEFAULT_COMMUNICATION_PREFERENCES,
    contactDetails: { email: creator.email, phone: creator.phone || undefined },
    timezone: creator.timezone || "UTC",
  };

  const paused = !!override?.isPaused && (!override.pauseResumeAt || override.pauseResumeAt > now);
  const isRead = (readBy: unknown) =>
    ((readBy as Array<{ userId?: string } | string>) || []).some((r) => (typeof r === "string" ? r : r?.userId) === userId);

  return {
    creator: {
      id: creator.id,
      name: creator.name,
      email: creator.email,
      phone: creator.phone,
      avatar: creator.avatar,
      inviteStatus: creator.inviteStatus,
      archivedAt: creator.archivedAt ? creator.archivedAt.toISOString() : null,
      timezone: creator.timezone,
      preferredContact: creator.preferredContact,
      createdAt: creator.createdAt.toISOString(),
      lastLoginAt: creator.lastLoginAt ? creator.lastLoginAt.toISOString() : null,
      notes: creator.notes,
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
  const session = await getServerSession(authOptions);
  if (!session?.user?.agencyId) redirect("/login");

  const { id } = await params;
  let data: ProfileData | null = null;
  try {
    data = await getProfile(id, session.user.agencyId, session.user.id);
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
        role: session.user.role,
      }}
    />
  );
}
