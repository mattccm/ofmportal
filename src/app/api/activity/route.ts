import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { cache, cacheKeys, cacheTTL } from "@/lib/cache";

// Activity types for filtering
export const ACTIVITY_TYPES = {
  UPLOAD: "upload",
  COMMENT: "comment",
  STATUS_CHANGE: "status_change",
  REQUEST: "request",
  REMINDER: "reminder",
} as const;

// GET - Fetch paginated activity log with filtering
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const limit = url.searchParams.get("limit");
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const pageSize = limit ? parseInt(limit, 10) : parseInt(url.searchParams.get("pageSize") || "20", 10);
    const type = url.searchParams.get("type");
    const userId = url.searchParams.get("userId");
    const entityId = url.searchParams.get("entityId");
    const entityType = url.searchParams.get("entityType");
    const dateFrom = url.searchParams.get("dateFrom");
    const dateTo = url.searchParams.get("dateTo");
    const search = url.searchParams.get("search");

    const agencyId = session.user.agencyId;
    const skip = (page - 1) * pageSize;

    // Use raw SQL with EXISTS subqueries for efficient agency filtering
    // This avoids fetching all entity IDs upfront - the database handles the filtering
    const activitiesRaw = await db.$queryRaw<Array<{
      id: string;
      userId: string | null;
      action: string;
      entityType: string;
      entityId: string;
      metadata: Prisma.JsonValue;
      createdAt: Date;
      userName: string | null;
      userAvatar: string | null;
      userEmail: string | null;
    }>>(
      Prisma.sql`
        SELECT
          a.id, a."userId", a.action, a."entityType", a."entityId", a.metadata, a."createdAt",
          u.name as "userName", u.avatar as "userAvatar", u.email as "userEmail"
        FROM "ActivityLog" a
        LEFT JOIN "User" u ON a."userId" = u.id
        WHERE (
          (a."entityType" = 'Upload' AND EXISTS (
            SELECT 1 FROM "Upload" up
            JOIN "ContentRequest" cr ON up."requestId" = cr.id
            WHERE up.id = a."entityId" AND cr."agencyId" = ${agencyId}
          ))
          OR (a."entityType" = 'ContentRequest' AND EXISTS (
            SELECT 1 FROM "ContentRequest" cr
            WHERE cr.id = a."entityId" AND cr."agencyId" = ${agencyId}
          ))
          OR (a."entityType" = 'Creator' AND EXISTS (
            SELECT 1 FROM "Creator" c
            WHERE c.id = a."entityId" AND c."agencyId" = ${agencyId}
          ))
        )
        ${type ? getTypeFilter(type) : Prisma.empty}
        ${userId ? Prisma.sql`AND a."userId" = ${userId}` : Prisma.empty}
        ${entityId && entityType ? Prisma.sql`AND a."entityId" = ${entityId} AND a."entityType" = ${entityType}` : Prisma.empty}
        ${dateFrom ? Prisma.sql`AND a."createdAt" >= ${new Date(dateFrom)}` : Prisma.empty}
        ${dateTo ? Prisma.sql`AND a."createdAt" <= ${(() => { const d = new Date(dateTo); d.setHours(23, 59, 59, 999); return d; })()}` : Prisma.empty}
        ORDER BY a."createdAt" DESC
        LIMIT ${pageSize}
        OFFSET ${skip}
      `
    );

    // Get total count with same filters
    const countResult = await db.$queryRaw<Array<{ count: bigint }>>(
      Prisma.sql`
        SELECT COUNT(*) as count
        FROM "ActivityLog" a
        WHERE (
          (a."entityType" = 'Upload' AND EXISTS (
            SELECT 1 FROM "Upload" up
            JOIN "ContentRequest" cr ON up."requestId" = cr.id
            WHERE up.id = a."entityId" AND cr."agencyId" = ${agencyId}
          ))
          OR (a."entityType" = 'ContentRequest' AND EXISTS (
            SELECT 1 FROM "ContentRequest" cr
            WHERE cr.id = a."entityId" AND cr."agencyId" = ${agencyId}
          ))
          OR (a."entityType" = 'Creator' AND EXISTS (
            SELECT 1 FROM "Creator" c
            WHERE c.id = a."entityId" AND c."agencyId" = ${agencyId}
          ))
        )
        ${type ? getTypeFilter(type) : Prisma.empty}
        ${userId ? Prisma.sql`AND a."userId" = ${userId}` : Prisma.empty}
        ${entityId && entityType ? Prisma.sql`AND a."entityId" = ${entityId} AND a."entityType" = ${entityType}` : Prisma.empty}
        ${dateFrom ? Prisma.sql`AND a."createdAt" >= ${new Date(dateFrom)}` : Prisma.empty}
        ${dateTo ? Prisma.sql`AND a."createdAt" <= ${(() => { const d = new Date(dateTo); d.setHours(23, 59, 59, 999); return d; })()}` : Prisma.empty}
      `
    );
    const total = Number(countResult[0]?.count || 0);

    // Batch fetch entity details for the paginated results only (max pageSize records)
    const activityUploadIds = activitiesRaw.filter(a => a.entityType === "Upload").map(a => a.entityId);
    const activityRequestIds = activitiesRaw.filter(a => a.entityType === "ContentRequest").map(a => a.entityId);
    const activityCreatorIds = activitiesRaw.filter(a => a.entityType === "Creator").map(a => a.entityId);

    const [uploadsData, requestsData, creatorsData] = await Promise.all([
      activityUploadIds.length > 0 ? db.upload.findMany({
        where: { id: { in: activityUploadIds } },
        select: {
          id: true,
          originalName: true,
          fileName: true,
          fileType: true,
          thumbnailUrl: true,
          request: { select: { id: true, title: true } },
          creator: { select: { id: true, name: true } },
        },
      }) : [],
      activityRequestIds.length > 0 ? db.contentRequest.findMany({
        where: { id: { in: activityRequestIds } },
        select: {
          id: true,
          title: true,
          status: true,
          creator: { select: { id: true, name: true, avatar: true } },
        },
      }) : [],
      activityCreatorIds.length > 0 ? db.creator.findMany({
        where: { id: { in: activityCreatorIds } },
        select: {
          id: true,
          name: true,
          avatar: true,
          email: true,
        },
      }) : [],
    ]);

    // Create lookup maps
    const uploadsMap = new Map(uploadsData.map(u => [u.id, u]));
    const requestsMap = new Map(requestsData.map(r => [r.id, r]));
    const creatorsMap = new Map(creatorsData.map(c => [c.id, c]));

    // Format activities
    const formattedActivities = activitiesRaw.map((activity) => {
      const metadata = (activity.metadata as Record<string, unknown>) || {};
      let entityDetails: Record<string, unknown> = {};

      try {
        if (activity.entityType === "Upload") {
          const upload = uploadsMap.get(activity.entityId);
          if (upload) {
            entityDetails = {
              uploadName: upload.originalName,
              requestId: upload.request?.id,
              requestTitle: upload.request?.title,
              creatorId: upload.creator?.id,
              creatorName: upload.creator?.name,
              thumbnailUrl: upload.thumbnailUrl,
              fileType: upload.fileType,
            };
          }
        } else if (activity.entityType === "ContentRequest") {
          const request = requestsMap.get(activity.entityId);
          if (request) {
            entityDetails = {
              requestId: request.id,
              requestTitle: request.title,
              requestStatus: request.status,
              creatorId: request.creator?.id,
              creatorName: request.creator?.name,
              creatorAvatar: request.creator?.avatar,
            };
          }
        } else if (activity.entityType === "Creator") {
          const creator = creatorsMap.get(activity.entityId);
          if (creator) {
            entityDetails = {
              creatorId: creator.id,
              creatorName: creator.name,
              creatorAvatar: creator.avatar,
              creatorEmail: creator.email,
            };
          }
        }
      } catch (err) {
        console.warn(`Failed to get entity details for ${activity.entityType}:${activity.entityId}`, err);
      }

      const description = getActivityDescription(activity.action, { ...metadata, ...entityDetails });

      // Search filtering
      if (search) {
        const searchLower = search.toLowerCase();
        const searchableText = [
          description,
          activity.userName,
          entityDetails.creatorName as string | undefined,
          entityDetails.requestTitle as string | undefined,
          entityDetails.uploadName as string | undefined,
        ].filter(Boolean).join(" ").toLowerCase();

        if (!searchableText.includes(searchLower)) {
          return null;
        }
      }

      return {
        id: activity.id,
        action: activity.action,
        entityType: activity.entityType,
        entityId: activity.entityId,
        timestamp: activity.createdAt,
        user: activity.userId ? {
          id: activity.userId,
          name: activity.userName,
          avatar: activity.userAvatar,
          email: activity.userEmail,
        } : null,
        metadata: { ...metadata, ...entityDetails },
        description,
        icon: getActivityIcon(activity.action),
        color: getActivityColor(activity.action),
        category: getActivityCategory(activity.action),
      };
    });

    const filteredActivities = formattedActivities.filter(Boolean);

    // Get unique users for filter dropdown (cached for 5 minutes - rarely changes)
    const usersCacheKey = `${cacheKeys.agencyCreators(agencyId)}:activity-users`;
    const users = await cache.getOrSet(
      usersCacheKey,
      async () => {
        return db.user.findMany({
          where: { agencyId },
          select: { id: true, name: true, avatar: true },
          orderBy: { name: "asc" },
          take: 100,
        });
      },
      { ttl: cacheTTL.LONG } // 5 minutes - team members rarely change
    );

    return NextResponse.json({
      activities: filteredActivities,
      pagination: {
        total: search ? filteredActivities.length : total,
        pageSize,
        currentPage: page,
        totalPages: Math.ceil((search ? filteredActivities.length : total) / pageSize),
        hasMore: page * pageSize < (search ? filteredActivities.length : total),
      },
      filters: {
        users,
        types: Object.values(ACTIVITY_TYPES),
      },
    });
  } catch (error) {
    console.error("Error fetching activity log:", error);
    return NextResponse.json(
      { error: "Failed to fetch activity log" },
      { status: 500 }
    );
  }
}

function getTypeFilter(type: string): Prisma.Sql {
  const typeFilters: Record<string, string[]> = {
    upload: ["upload.created", "upload.completed", "upload.approved", "upload.rejected", "upload.reviewed"],
    comment: ["comment.created", "comment.updated", "comment.deleted"],
    status_change: ["request.status_changed", "request.approved", "request.rejected", "request.submitted", "upload.approved", "upload.rejected"],
    request: ["request.created", "request.updated", "request.submitted", "request.approved", "request.rejected", "request.revision_requested", "request.status_changed"],
    reminder: ["reminder.sent", "reminder.scheduled", "reminder.escalation"],
  };

  const actions = typeFilters[type];
  if (!actions || actions.length === 0) return Prisma.empty;

  return Prisma.sql`AND a.action IN (${Prisma.join(actions)})`;
}

function getActivityDescription(
  action: string,
  metadata: Record<string, unknown>
): string {
  const descriptions: Record<string, string | ((m: Record<string, unknown>) => string)> = {
    "upload.created": (m) => `Started uploading "${m.uploadName || m.fileName || "file"}"`,
    "upload.completed": (m) => `Completed upload "${m.uploadName || m.fileName || "file"}"`,
    "upload.approved": (m) => `Approved upload "${m.uploadName || m.fileName || "file"}"`,
    "upload.rejected": (m) => `Rejected upload "${m.uploadName || m.fileName || "file"}"`,
    "upload.reviewed": (m) => `Reviewed upload "${m.uploadName || m.fileName || "file"}"`,
    "comment.created": (m) => `Added a comment${m.requestTitle ? ` on "${m.requestTitle}"` : ""}`,
    "comment.updated": "Updated a comment",
    "comment.deleted": "Deleted a comment",
    "request.created": (m) => `Created request "${m.requestTitle || m.title || "Untitled"}"`,
    "request.updated": (m) => `Updated request "${m.requestTitle || m.title || "Untitled"}"`,
    "request.submitted": (m) => `Submitted content for "${m.requestTitle || m.title || "request"}"`,
    "request.approved": (m) => `Approved request "${m.requestTitle || m.title || "Untitled"}"`,
    "request.rejected": (m) => `Rejected request "${m.requestTitle || m.title || "Untitled"}"`,
    "request.revision_requested": (m) => `Requested revision on "${m.requestTitle || m.title || "request"}"`,
    "request.status_changed": (m) => `Changed status of "${m.requestTitle || m.title || "request"}" to ${m.newStatus || m.requestStatus || "new status"}`,
    "reminder.sent": (m) => `Sent reminder to ${m.creatorName || "creator"}`,
    "reminder.scheduled": (m) => `Scheduled reminder for ${m.creatorName || "creator"}`,
    "reminder.escalation": (m) => `Escalation reminder sent for "${m.requestTitle || "request"}"`,
    "creator.invited": (m) => `Invited ${m.creatorName || "creator"} to the platform`,
    "creator.login": (m) => `${m.creatorName || "Creator"} logged into the portal`,
    "creator.portal_accessed": (m) => `${m.creatorName || "Creator"} accessed the portal`,
    "creator.updated": (m) => `Updated ${m.creatorName || "creator"}'s profile`,
    "creator.note_added": "Added internal note",
    "creator.note_updated": "Updated internal note",
    "creator.note_deleted": "Deleted internal note",
  };

  const desc = descriptions[action];
  if (typeof desc === "function") return desc(metadata);
  if (typeof desc === "string") return desc;
  return action.replace(/\./g, " ").replace(/_/g, " ");
}

function getActivityIcon(action: string): string {
  const icons: Record<string, string> = {
    "upload.created": "upload",
    "upload.completed": "upload-check",
    "upload.approved": "check-circle",
    "upload.rejected": "x-circle",
    "upload.reviewed": "eye",
    "comment.created": "message-square",
    "comment.updated": "edit",
    "comment.deleted": "trash",
    "request.created": "file-plus",
    "request.updated": "file-edit",
    "request.submitted": "send",
    "request.approved": "check-circle",
    "request.rejected": "x-circle",
    "request.revision_requested": "alert-circle",
    "request.status_changed": "refresh-cw",
    "reminder.sent": "bell",
    "reminder.scheduled": "clock",
    "reminder.escalation": "alert-triangle",
    "creator.invited": "user-plus",
    "creator.login": "log-in",
    "creator.portal_accessed": "external-link",
    "creator.updated": "user-cog",
    "creator.note_added": "sticky-note",
    "creator.note_updated": "edit-3",
    "creator.note_deleted": "trash-2",
  };
  return icons[action] || "activity";
}

function getActivityColor(action: string): string {
  if (action.includes("approved") || action.includes("completed")) return "emerald";
  if (action.includes("rejected") || action.includes("revision") || action.includes("deleted")) return "red";
  if (action.includes("upload")) return "violet";
  if (action.includes("request") || action.includes("created")) return "blue";
  if (action.includes("comment") || action.includes("message") || action.includes("note")) return "amber";
  if (action.includes("reminder") || action.includes("escalation")) return "orange";
  if (action.includes("login") || action.includes("portal") || action.includes("invited")) return "indigo";
  return "gray";
}

function getActivityCategory(action: string): string {
  if (action.startsWith("upload")) return "upload";
  if (action.startsWith("comment")) return "comment";
  if (action.startsWith("request")) return "request";
  if (action.startsWith("reminder")) return "reminder";
  if (action.startsWith("creator")) return "creator";
  return "other";
}
