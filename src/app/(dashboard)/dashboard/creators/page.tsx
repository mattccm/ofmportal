import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, FileUp, Users } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { CreatorsList, type CreatorTile } from "@/components/creators/creators-list";
import { PageHead } from "@/components/creators/people-ui";
import { creatorInvite } from "@/lib/invites";
import {
  ACTIVE_STATUSES,
  ago,
  cityOf,
  contactLabel,
  creatorSentence,
  creatorStatus,
  deliverySummary,
  finishedPoints,
  plural,
  requestFields,
} from "@/components/creators/insights";

export const metadata = { title: "Creators" };

async function getCreatorTiles(agencyId: string, userId: string, now: Date): Promise<CreatorTile[]> {
  const creators = await db.creator.findMany({
    where: { agencyId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      inviteStatus: true,
      inviteToken: true,
      inviteSentAt: true,
      createdAt: true,
      archivedAt: true,
      lastLoginAt: true,
      preferredContact: true,
      timezone: true,
      requests: {
        where: { status: { in: [...ACTIVE_STATUSES, "APPROVED"] } },
        select: {
          id: true,
          title: true,
          status: true,
          dueDate: true,
          submittedAt: true,
          reviewedAt: true,
          fields: true,
          fieldSubmissions: true,
          uploads: {
            where: { uploadStatus: "COMPLETED" },
            select: { fieldId: true, status: true },
          },
        },
      },
    },
  });

  const ids = creators.map((c) => c.id);
  const [overrides, creatorMessages] = await Promise.all([
    db.creatorReminderOverride.findMany({
      where: { agencyId, creatorId: { in: ids } },
      select: { creatorId: true, isPaused: true, pauseResumeAt: true },
    }),
    // Recent messages creators sent in their staff threads, for unread counts
    db.message.findMany({
      where: {
        creatorId: { in: ids },
        createdAt: { gte: new Date(now.getTime() - 90 * 86_400_000) },
        conversation: { type: "CREATOR", participants: { some: { userId } } },
      },
      select: { creatorId: true, readBy: true },
    }),
  ]);

  const unread = new Map<string, number>();
  for (const m of creatorMessages) {
    const readBy = (m.readBy as Array<{ userId?: string } | string>) || [];
    const read = readBy.some((r) => (typeof r === "string" ? r : r?.userId) === userId);
    if (!read && m.creatorId) unread.set(m.creatorId, (unread.get(m.creatorId) ?? 0) + 1);
  }
  const pause = new Map(overrides.map((o) => [o.creatorId, o]));

  return creators.map((c) => {
    const active = c.requests
      .filter((r) => r.status !== "APPROVED")
      .map((r) => ({ id: r.id, title: r.title, due: r.dueDate, fields: requestFields(r, now) }));
    const delivery = deliverySummary(finishedPoints(c.requests));
    const p = pause.get(c.id);
    const paused = !!p?.isPaused && (!p.pauseResumeAt || p.pauseResumeAt > now);
    // The invite as staff see it (the raw token never leaves the server here)
    const invite = creatorInvite(c, now);
    const inviteStatus =
      invite.state === "accepted" ? "ACCEPTED" : invite.state === "cancelled" ? "CANCELLED" : invite.state === "expired" ? "EXPIRED" : "PENDING";
    const status = creatorStatus({
      archived: c.archivedAt !== null,
      inviteStatus,
      paused,
      pausedUntil: paused ? p?.pauseResumeAt ?? null : null,
      active,
      now,
    });
    const owed = active.reduce(
      (n, r) => n + r.fields.filter((f) => f.state === "waiting" || f.state === "overdue" || f.state === "changes").length,
      0
    );
    return {
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      archived: c.archivedAt !== null,
      inviteStatus,
      invite:
        invite.state === "accepted"
          ? null
          : { state: invite.state, expiresAt: invite.expiresAt ? invite.expiresAt.toISOString() : null },
      meta: `${contactLabel(c.preferredContact)} · ${cityOf(c.timezone)} · ${
        c.lastLoginAt ? `last seen ${ago(c.lastLoginAt, now)}` : "not signed in yet"
      }`,
      sentence: creatorSentence(active.length, delivery),
      status,
      unread: unread.get(c.id) ?? 0,
      owed,
      activeCount: active.length,
      lastSeen: c.lastLoginAt ? c.lastLoginAt.toISOString() : null,
      onTimeRate: delivery.finished ? delivery.onTime / delivery.finished : null,
      finished: delivery.finished,
      onTime: delivery.onTime,
    };
  });
}

/** The page's finding: who owes work and has been quiet longest, then the on-time record. */
function lede(tiles: CreatorTile[], now: Date): string {
  const live = tiles.filter((t) => !t.archived);
  if (live.length === 0) return "No creators yet. Invite one to send them requests.";
  const quiet = live
    .filter((t) => t.owed > 0)
    .sort((a, b) => (a.lastSeen ?? "").localeCompare(b.lastSeen ?? ""))[0];
  const fin = live.reduce((n, t) => n + t.finished, 0);
  const on = live.reduce((n, t) => n + t.onTime, 0);
  const first = quiet
    ? `${quiet.name} ${quiet.lastSeen ? `was last seen ${ago(quiet.lastSeen, now)}` : "has not signed in yet"} and still owes ${plural(quiet.owed, "field")}. `
    : "";
  const record = fin
    ? `Across ${plural(live.length, "creator")}, ${on} of ${plural(fin, "finished request")} came in on time.`
    : `${plural(live.length, "creator")}, nothing finished yet.`;
  return first + record;
}

export default async function CreatorsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.agencyId) redirect("/login");

  const now = new Date();
  let tiles: CreatorTile[] = [];
  let failed = false;
  try {
    tiles = await getCreatorTiles(session.user.agencyId, session.user.id, now);
  } catch (error) {
    console.error("CreatorsPage data fetch error:", error);
    failed = true;
  }

  return (
    <div className="space-y-6">
      <PageHead
        title="Creators"
        lede={failed ? "Creators could not be loaded. Reload the page to try again." : lede(tiles, now)}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/dashboard/creators/groups">
                <Users aria-hidden="true" />
                Groups
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard/creators/import">
                <FileUp aria-hidden="true" />
                Import CSV
              </Link>
            </Button>
            <Button asChild variant="light">
              <Link href="/dashboard/creators/invite">
                <Plus aria-hidden="true" />
                Invite creator
              </Link>
            </Button>
          </>
        }
      />
      <CreatorsList creators={tiles} canManageInvites={["OWNER", "ADMIN", "MANAGER"].includes(session.user.role)} />
    </div>
  );
}
