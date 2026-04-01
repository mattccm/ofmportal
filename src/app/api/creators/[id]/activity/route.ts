import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// GET - Fetch activity timeline for a creator
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify creator belongs to agency
    const creator = await db.creator.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
      select: { id: true, lastLoginAt: true },
    });

    if (!creator) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    const url = new URL(req.url);
    const activityType = url.searchParams.get("type");
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const pageSize = parseInt(url.searchParams.get("pageSize") || "50", 10);

    // Get all uploads by this creator
    const uploads = await db.upload.findMany({
      where: { creatorId: id },
      select: { id: true },
    });
    const uploadIds = uploads.map((u) => u.id);

    // Get all requests for this creator
    const requests = await db.contentRequest.findMany({
      where: { creatorId: id },
      select: { id: true },
    });
    const requestIds = requests.map((r) => r.id);

    // Build activity log query
    const whereConditions: Record<string, unknown>[] = [
      {
        entityType: "Creator",
        entityId: id,
      },
    ];

    if (uploadIds.length > 0) {
      whereConditions.push({
        entityType: "Upload",
        entityId: { in: uploadIds },
      });
    }

    if (requestIds.length > 0) {
      whereConditions.push({
        entityType: "ContentRequest",
        entityId: { in: requestIds },
      });
    }

    // Filter by activity type if specified
    let actionFilter: string[] | undefined;
    if (activityType) {
      switch (activityType) {
        case "uploads":
          actionFilter = [
            "upload.created",
            "upload.completed",
            "upload.approved",
            "upload.rejected",
          ];
          break;
        case "submissions":
          actionFilter = [
            "request.submitted",
            "request.revision_requested",
          ];
          break;
        case "messages":
          actionFilter = [
            "message.sent",
            "comment.created",
          ];
          break;
        case "logins":
          actionFilter = [
            "creator.login",
            "creator.portal_accessed",
          ];
          break;
      }
    }

    const skip = (page - 1) * pageSize;

    // Fetch activity logs
    const [activities, total] = await Promise.all([
      db.activityLog.findMany({
        where: {
          OR: whereConditions,
          ...(actionFilter && { action: { in: actionFilter } }),
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
        },
      }),
      db.activityLog.count({
        where: {
          OR: whereConditions,
          ...(actionFilter && { action: { in: actionFilter } }),
        },
      }),
    ]);

    // Format activities for the timeline
    const formattedActivities = activities.map((activity) => {
      const metadata = activity.metadata as Record<string, unknown>;

      return {
        id: activity.id,
        action: activity.action,
        entityType: activity.entityType,
        entityId: activity.entityId,
        timestamp: activity.createdAt,
        user: activity.user,
        metadata,
        description: getActivityDescription(activity.action, metadata),
        icon: getActivityIcon(activity.action),
        color: getActivityColor(activity.action),
      };
    });

    // Add login activity if available
    if (creator.lastLoginAt && !activityType) {
      formattedActivities.unshift({
        id: "last-login",
        action: "creator.login",
        entityType: "Creator",
        entityId: id,
        timestamp: creator.lastLoginAt,
        user: null,
        metadata: {},
        description: "Last portal login",
        icon: "login",
        color: "blue",
      });
    }

    return NextResponse.json({
      activities: formattedActivities,
      pagination: {
        total,
        pageSize,
        currentPage: page,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Error fetching creator activity:", error);
    return NextResponse.json(
      { error: "Failed to fetch activity" },
      { status: 500 }
    );
  }
}

function getActivityDescription(action: string, metadata: Record<string, unknown>): string {
  const descriptions: Record<string, string> = {
    "creator.invited": "Creator invited to the platform",
    "creator.login": "Logged into the portal",
    "creator.portal_accessed": "Accessed the creator portal",
    "creator.updated": "Profile was updated",
    "creator.note_added": "Internal note added",
    "creator.note_updated": "Internal note updated",
    "creator.note_deleted": "Internal note deleted",
    "upload.created": `Started uploading "${metadata.fileName || "file"}"`,
    "upload.completed": `Completed uploading "${metadata.fileName || "file"}"`,
    "upload.approved": `Upload "${metadata.fileName || "file"}" was approved`,
    "upload.rejected": `Upload "${metadata.fileName || "file"}" was rejected`,
    "request.created": `New request "${metadata.title || "Untitled"}" assigned`,
    "request.submitted": "Submitted content for review",
    "request.revision_requested": "Revision requested on submission",
    "request.approved": "Request was approved",
    "comment.created": "New comment added",
    "message.sent": "Message sent",
  };

  return descriptions[action] || action.replace(/\./g, " ").replace(/_/g, " ");
}

function getActivityIcon(action: string): string {
  const icons: Record<string, string> = {
    "creator.invited": "mail",
    "creator.login": "login",
    "creator.portal_accessed": "eye",
    "creator.updated": "edit",
    "creator.note_added": "sticky-note",
    "upload.created": "upload",
    "upload.completed": "check-circle",
    "upload.approved": "check-circle",
    "upload.rejected": "x-circle",
    "request.created": "file-text",
    "request.submitted": "send",
    "request.revision_requested": "alert-circle",
    "comment.created": "message-square",
    "message.sent": "message-circle",
  };

  return icons[action] || "activity";
}

function getActivityColor(action: string): string {
  if (action.includes("approved") || action.includes("completed")) return "green";
  if (action.includes("rejected") || action.includes("revision")) return "red";
  if (action.includes("upload")) return "violet";
  if (action.includes("request")) return "blue";
  if (action.includes("comment") || action.includes("message")) return "amber";
  if (action.includes("login") || action.includes("accessed")) return "blue";
  return "gray";
}
