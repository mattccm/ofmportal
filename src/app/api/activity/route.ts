import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

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

    // Build filters
    const whereConditions: Record<string, unknown> = {};

    // Get all entity IDs belonging to the agency
    const [uploads, requests, creators] = await Promise.all([
      db.upload.findMany({
        where: { request: { agencyId: session.user.agencyId } },
        select: { id: true },
      }),
      db.contentRequest.findMany({
        where: { agencyId: session.user.agencyId },
        select: { id: true },
      }),
      db.creator.findMany({
        where: { agencyId: session.user.agencyId },
        select: { id: true },
      }),
    ]);

    const uploadIds = uploads.map((u) => u.id);
    const requestIds = requests.map((r) => r.id);
    const creatorIds = creators.map((c) => c.id);

    // Only show activity for entities belonging to this agency
    const entityFilters: Record<string, unknown>[] = [
      { entityType: "Upload", entityId: { in: uploadIds } },
      { entityType: "ContentRequest", entityId: { in: requestIds } },
      { entityType: "Creator", entityId: { in: creatorIds } },
    ];

    whereConditions.OR = entityFilters;

    // Filter by activity type
    if (type) {
      let actionFilters: string[] = [];
      switch (type) {
        case "upload":
          actionFilters = [
            "upload.created",
            "upload.completed",
            "upload.approved",
            "upload.rejected",
            "upload.reviewed",
          ];
          break;
        case "comment":
          actionFilters = [
            "comment.created",
            "comment.updated",
            "comment.deleted",
          ];
          break;
        case "status_change":
          actionFilters = [
            "request.status_changed",
            "request.approved",
            "request.rejected",
            "request.submitted",
            "upload.approved",
            "upload.rejected",
          ];
          break;
        case "request":
          actionFilters = [
            "request.created",
            "request.updated",
            "request.submitted",
            "request.approved",
            "request.rejected",
            "request.revision_requested",
            "request.status_changed",
          ];
          break;
        case "reminder":
          actionFilters = [
            "reminder.sent",
            "reminder.scheduled",
            "reminder.escalation",
          ];
          break;
      }
      if (actionFilters.length > 0) {
        whereConditions.action = { in: actionFilters };
      }
    }

    // Filter by user
    if (userId) {
      whereConditions.userId = userId;
    }

    // Filter by entity
    if (entityId && entityType) {
      whereConditions.entityId = entityId;
      whereConditions.entityType = entityType;
    }

    // Filter by date range
    if (dateFrom || dateTo) {
      whereConditions.createdAt = {};
      if (dateFrom) {
        (whereConditions.createdAt as Record<string, unknown>).gte = new Date(dateFrom);
      }
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        (whereConditions.createdAt as Record<string, unknown>).lte = endDate;
      }
    }

    const skip = (page - 1) * pageSize;

    // Fetch activities
    const [activities, total] = await Promise.all([
      db.activityLog.findMany({
        where: whereConditions,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatar: true,
              email: true,
            },
          },
        },
      }),
      db.activityLog.count({
        where: whereConditions,
      }),
    ]);

    // Batch fetch all entity details to avoid N+1 queries
    // Group activities by entity type
    const uploadIds = activities.filter(a => a.entityType === "Upload").map(a => a.entityId);
    const requestEntityIds = activities.filter(a => a.entityType === "ContentRequest").map(a => a.entityId);
    const creatorEntityIds = activities.filter(a => a.entityType === "Creator").map(a => a.entityId);

    // Batch fetch all related entities in 3 queries instead of N queries
    const [uploadsData, requestsData, creatorsData] = await Promise.all([
      uploadIds.length > 0 ? db.upload.findMany({
        where: { id: { in: uploadIds } },
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
      requestEntityIds.length > 0 ? db.contentRequest.findMany({
        where: { id: { in: requestEntityIds } },
        select: {
          id: true,
          title: true,
          status: true,
          creator: { select: { id: true, name: true, avatar: true } },
        },
      }) : [],
      creatorEntityIds.length > 0 ? db.creator.findMany({
        where: { id: { in: creatorEntityIds } },
        select: {
          id: true,
          name: true,
          avatar: true,
          email: true,
        },
      }) : [],
    ]);

    // Create lookup maps for O(1) access
    const uploadsMap = new Map(uploadsData.map(u => [u.id, u]));
    const requestsMap = new Map(requestsData.map(r => [r.id, r]));
    const creatorsMap = new Map(creatorsData.map(c => [c.id, c]));

    // Format activities with details from lookup maps (no additional queries)
    const formattedActivities = activities.map((activity) => {
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
        // If entity lookup fails, continue with empty details
        console.warn(`Failed to get entity details for ${activity.entityType}:${activity.entityId}`, err);
      }

      // Build description
      const description = getActivityDescription(activity.action, { ...metadata, ...entityDetails });

      // If search query provided, filter by description/metadata
      if (search) {
        const searchLower = search.toLowerCase();
        const searchableText = [
          description,
          activity.user?.name,
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
        user: activity.user,
        metadata: { ...metadata, ...entityDetails },
        description,
        icon: getActivityIcon(activity.action),
        color: getActivityColor(activity.action),
        category: getActivityCategory(activity.action),
      };
    });

    // Filter out null results from search
    const filteredActivities = formattedActivities.filter(Boolean);

    // Get unique users for filter dropdown
    const users = await db.user.findMany({
      where: { agencyId: session.user.agencyId },
      select: { id: true, name: true, avatar: true },
      orderBy: { name: "asc" },
    });

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

function getActivityDescription(
  action: string,
  metadata: Record<string, unknown>
): string {
  const descriptions: Record<string, string | ((m: Record<string, unknown>) => string)> = {
    // Upload activities
    "upload.created": (m) => `Started uploading "${m.uploadName || m.fileName || "file"}"`,
    "upload.completed": (m) => `Completed upload "${m.uploadName || m.fileName || "file"}"`,
    "upload.approved": (m) => `Approved upload "${m.uploadName || m.fileName || "file"}"`,
    "upload.rejected": (m) => `Rejected upload "${m.uploadName || m.fileName || "file"}"`,
    "upload.reviewed": (m) => `Reviewed upload "${m.uploadName || m.fileName || "file"}"`,

    // Comment activities
    "comment.created": (m) => `Added a comment${m.requestTitle ? ` on "${m.requestTitle}"` : ""}`,
    "comment.updated": "Updated a comment",
    "comment.deleted": "Deleted a comment",

    // Request activities
    "request.created": (m) => `Created request "${m.requestTitle || m.title || "Untitled"}"`,
    "request.updated": (m) => `Updated request "${m.requestTitle || m.title || "Untitled"}"`,
    "request.submitted": (m) => `Submitted content for "${m.requestTitle || m.title || "request"}"`,
    "request.approved": (m) => `Approved request "${m.requestTitle || m.title || "Untitled"}"`,
    "request.rejected": (m) => `Rejected request "${m.requestTitle || m.title || "Untitled"}"`,
    "request.revision_requested": (m) => `Requested revision on "${m.requestTitle || m.title || "request"}"`,
    "request.status_changed": (m) => `Changed status of "${m.requestTitle || m.title || "request"}" to ${m.newStatus || m.requestStatus || "new status"}`,

    // Reminder activities
    "reminder.sent": (m) => `Sent reminder to ${m.creatorName || "creator"}`,
    "reminder.scheduled": (m) => `Scheduled reminder for ${m.creatorName || "creator"}`,
    "reminder.escalation": (m) => `Escalation reminder sent for "${m.requestTitle || "request"}"`,

    // Creator activities
    "creator.invited": (m) => `Invited ${m.creatorName || "creator"} to the platform`,
    "creator.login": (m) => `${m.creatorName || "Creator"} logged into the portal`,
    "creator.portal_accessed": (m) => `${m.creatorName || "Creator"} accessed the portal`,
    "creator.updated": (m) => `Updated ${m.creatorName || "creator"}'s profile`,
    "creator.note_added": "Added internal note",
    "creator.note_updated": "Updated internal note",
    "creator.note_deleted": "Deleted internal note",
  };

  const desc = descriptions[action];
  if (typeof desc === "function") {
    return desc(metadata);
  }
  if (typeof desc === "string") {
    return desc;
  }

  // Fallback: convert action to readable text
  return action.replace(/\./g, " ").replace(/_/g, " ");
}

function getActivityIcon(action: string): string {
  const icons: Record<string, string> = {
    // Upload
    "upload.created": "upload",
    "upload.completed": "upload-check",
    "upload.approved": "check-circle",
    "upload.rejected": "x-circle",
    "upload.reviewed": "eye",

    // Comment
    "comment.created": "message-square",
    "comment.updated": "edit",
    "comment.deleted": "trash",

    // Request
    "request.created": "file-plus",
    "request.updated": "file-edit",
    "request.submitted": "send",
    "request.approved": "check-circle",
    "request.rejected": "x-circle",
    "request.revision_requested": "alert-circle",
    "request.status_changed": "refresh-cw",

    // Reminder
    "reminder.sent": "bell",
    "reminder.scheduled": "clock",
    "reminder.escalation": "alert-triangle",

    // Creator
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
  if (action.includes("approved") || action.includes("completed") || action.includes("check")) {
    return "emerald";
  }
  if (action.includes("rejected") || action.includes("revision") || action.includes("deleted")) {
    return "red";
  }
  if (action.includes("upload")) {
    return "violet";
  }
  if (action.includes("request") || action.includes("created")) {
    return "blue";
  }
  if (action.includes("comment") || action.includes("message") || action.includes("note")) {
    return "amber";
  }
  if (action.includes("reminder") || action.includes("bell") || action.includes("escalation")) {
    return "orange";
  }
  if (action.includes("login") || action.includes("portal") || action.includes("invited")) {
    return "indigo";
  }
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
