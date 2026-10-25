import { db } from "@/lib/db";
import { getPublicFileUrl } from "@/lib/storage";
import {
  ACTIVE_REQUEST_STATUSES,
  compareUrgency,
  countFields,
  isRequestLate,
  mapRequestFields,
} from "@/lib/title-wall/request-card-data";
import type { OverviewData, OverviewMessage, OverviewRequest, OverviewUpload } from "./types";

const DAY = 86_400_000;

/** Read the duration (seconds) an upload's metadata may carry */
function durationOf(meta: unknown): number | null {
  if (!meta || typeof meta !== "object") return null;
  const d = (meta as Record<string, unknown>).duration;
  return typeof d === "number" && Number.isFinite(d) && d > 0 ? d : null;
}

function readByUser(readBy: unknown, userId: string): boolean {
  if (!Array.isArray(readBy)) return false;
  return readBy.some((r) => (typeof r === "string" ? r === userId : (r as { userId?: string })?.userId === userId));
}

/**
 * Everything the Overview draws, in one batched round of queries (no N+1):
 * active requests with their completed uploads, last reminder, creator and
 * template; the approved counts for this and last week; and the creator
 * conversations with their recent messages for unread counts.
 */
export async function getOverviewData(agencyId: string, userId: string, now = new Date()): Promise<OverviewData> {
  const weekAgo = new Date(now.getTime() - 7 * DAY);
  const twoWeeksAgo = new Date(now.getTime() - 14 * DAY);

  const [rows, approvedThisWeek, approvedLastWeek, conversations] = await Promise.all([
    db.contentRequest.findMany({
      where: { agencyId, status: { in: [...ACTIVE_REQUEST_STATUSES] } },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
      take: 200,
      select: {
        id: true,
        title: true,
        status: true,
        dueDate: true,
        createdAt: true,
        fields: true,
        fieldSubmissions: true,
        creator: { select: { id: true, name: true, lastLoginAt: true, preferredContact: true } },
        template: { select: { name: true } },
        uploads: {
          where: { uploadStatus: "COMPLETED" },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            fieldId: true,
            status: true,
            uploadedAt: true,
            createdAt: true,
            fileType: true,
            fileSize: true,
            storageKey: true,
            thumbnailKey: true,
            metadata: true,
          },
        },
        reminders: {
          where: { status: "SENT" },
          orderBy: { sentAt: "desc" },
          take: 1,
          select: { sentAt: true },
        },
      },
    }),
    db.contentRequest.count({ where: { agencyId, status: "APPROVED", reviewedAt: { gte: weekAgo, lte: now } } }),
    db.contentRequest.count({ where: { agencyId, status: "APPROVED", reviewedAt: { gte: twoWeeksAgo, lt: weekAgo } } }),
    db.conversation.findMany({
      where: {
        type: "CREATOR",
        participants: { some: { userId } },
        OR: [{ agencyId }, { agencyId: null }],
        creator: { agencyId },
      },
      orderBy: { lastMessageAt: { sort: "desc", nulls: "last" } },
      take: 50,
      select: {
        id: true,
        creatorId: true,
        lastMessageAt: true,
        creator: { select: { id: true, name: true } },
        messages: {
          where: { creatorId: { not: null } },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: { content: true, createdAt: true, readBy: true },
        },
      },
    }),
  ]);

  const requests: OverviewRequest[] = rows.map((r) => {
    const fields = mapRequestFields(r, now);
    const counts = countFields(fields);
    return {
      id: r.id,
      title: r.title,
      status: r.status,
      due: r.dueDate?.toISOString() ?? null,
      sentAt: r.createdAt.toISOString(),
      creatorId: r.creator.id,
      creatorName: r.creator.name,
      creatorLastSeen: r.creator.lastLoginAt?.toISOString() ?? null,
      creatorContact: r.creator.preferredContact,
      kind: r.template?.name ?? null,
      late: isRequestLate(r, now),
      lastReminderAt: r.reminders[0]?.sentAt?.toISOString() ?? null,
      fields: fields.map((f) => ({
        id: f.id,
        name: f.name,
        state: f.state,
        uploads: f.uploads,
        readyUploads: f.readyUploads,
        inProgress: f.inProgress,
        feedback: f.feedback ?? null,
      })),
      counts,
    };
  });

  requests.sort((a, b) =>
    compareUrgency(
      { late: a.late, due: a.due ? new Date(a.due) : null, counts: a.counts },
      { late: b.late, due: b.due ? new Date(b.due) : null, counts: b.counts }
    )
  );

  // New from creators: one tile per field with uploads ready for review, newest first
  const readyFieldIds = new Map(requests.map((r) => [r.id, new Set(r.fields.filter((f) => f.state === "ready").map((f) => f.id))]));
  const uploads: OverviewUpload[] = [];
  for (const r of rows) {
    const ready = readyFieldIds.get(r.id);
    if (!ready?.size) continue;
    const byField = new Map<string, typeof r.uploads>();
    for (const u of r.uploads) {
      if (u.status !== "PENDING") continue;
      const fid = u.fieldId && ready.has(u.fieldId) ? u.fieldId : ready.has(`${r.id}:uploads`) ? `${r.id}:uploads` : ready.has(`${r.id}:other`) ? `${r.id}:other` : null;
      if (!fid) continue;
      byField.set(fid, [...(byField.get(fid) ?? []), u]);
    }
    const mapped = requests.find((x) => x.id === r.id);
    for (const [fid, list] of byField) {
      const latest = list[0];
      const isImage = latest.fileType.startsWith("image/");
      const isVideo = latest.fileType.startsWith("video/");
      const hasThumb = isImage || !!latest.thumbnailKey;
      // public URLs exist only for agency assets; creator content stays signed (see the thumbnail route)
      const publicThumb = hasThumb ? getPublicFileUrl(isImage ? latest.storageKey : latest.thumbnailKey!) : null;
      uploads.push({
        id: `${r.id}:${fid}`,
        uploadId: latest.id,
        requestId: r.id,
        requestTitle: r.title,
        creatorId: r.creator.id,
        creatorName: r.creator.name,
        fieldName: mapped?.fields.find((f) => f.id === fid)?.name ?? "Uploads",
        count: list.length,
        photos: list.filter((u) => u.fileType.startsWith("image/")).length,
        videos: list.filter((u) => u.fileType.startsWith("video/")).length,
        bytes: list.reduce((n, u) => n + Number(u.fileSize), 0),
        kind: isVideo ? "video" : "photo",
        duration: isVideo ? durationOf(latest.metadata) : null,
        thumb: publicThumb ?? (hasThumb ? `/api/overview/thumbnail/${latest.id}` : null),
        uploadedAt: (latest.uploadedAt ?? latest.createdAt).toISOString(),
      });
    }
  }
  uploads.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));

  const conversationByCreator: Record<string, string> = {};
  const messages: OverviewMessage[] = [];
  for (const c of conversations) {
    if (!c.creatorId || !c.creator) continue;
    conversationByCreator[c.creatorId] ??= c.id;
    const unread = c.messages.filter((m) => !readByUser(m.readBy, userId));
    if (!unread.length) continue;
    messages.push({
      conversationId: c.id,
      creatorId: c.creator.id,
      creatorName: c.creator.name,
      unread: unread.length,
      preview: unread[0].content.replace(/\s+/g, " ").trim().slice(0, 180),
      at: unread[0].createdAt.toISOString(),
    });
  }
  messages.sort((a, b) => b.at.localeCompare(a.at));

  return {
    now: now.toISOString(),
    requests,
    uploads: uploads.slice(0, 12),
    messages,
    conversationByCreator,
    approvedThisWeek,
    approvedLastWeek,
  };
}
