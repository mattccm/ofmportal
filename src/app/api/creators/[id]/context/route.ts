import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// GET - Fetch complete creator context in a single optimized call
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

    const now = new Date();

    // Fetch creator with related data in a single query
    const creator = await db.creator.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatar: true,
        inviteStatus: true,
        timezone: true,
        lastLoginAt: true,
        createdAt: true,
        contentPreferences: true,
        requests: {
          where: {
            status: {
              notIn: ["APPROVED", "CANCELLED", "ARCHIVED"],
            },
          },
          orderBy: { dueDate: "asc" },
          take: 10,
          select: {
            id: true,
            title: true,
            status: true,
            dueDate: true,
            createdAt: true,
            urgency: true,
          },
        },
        uploads: {
          orderBy: { createdAt: "desc" },
          take: 6,
          select: {
            id: true,
            originalName: true,
            fileType: true,
            status: true,
            storageKey: true,
            uploadedAt: true,
            createdAt: true,
            request: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
        _count: {
          select: {
            requests: true,
            uploads: true,
          },
        },
      },
    });

    if (!creator) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    // Get all completed requests for stats calculation
    const completedRequests = await db.contentRequest.findMany({
      where: {
        creatorId: id,
        agencyId: session.user.agencyId,
        status: "APPROVED",
      },
      select: {
        id: true,
        createdAt: true,
        dueDate: true,
        submittedAt: true,
        uploads: {
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { createdAt: true },
        },
      },
    });

    // Calculate stats
    const totalCompleted = completedRequests.length;

    // Calculate on-time completion rate
    let onTimeCount = 0;
    completedRequests.forEach((req) => {
      if (req.submittedAt && req.dueDate) {
        if (new Date(req.submittedAt) <= new Date(req.dueDate)) {
          onTimeCount++;
        }
      } else if (req.submittedAt && !req.dueDate) {
        // No due date = on time
        onTimeCount++;
      }
    });
    const onTimeCompletionRate = totalCompleted > 0
      ? Math.round((onTimeCount / totalCompleted) * 100)
      : 0;

    // Calculate average response time (request creation to first upload)
    let totalResponseTime = 0;
    let responseTimeCount = 0;
    completedRequests.forEach((req) => {
      if (req.uploads[0]) {
        const diff = req.uploads[0].createdAt.getTime() - req.createdAt.getTime();
        totalResponseTime += diff;
        responseTimeCount++;
      }
    });
    const avgResponseTimeHours = responseTimeCount > 0
      ? Math.round((totalResponseTime / responseTimeCount / (1000 * 60 * 60)) * 10) / 10
      : 0;

    // Get upload approval stats
    const uploadStats = await db.upload.groupBy({
      by: ["status"],
      where: {
        creatorId: id,
      },
      _count: true,
    });

    const totalUploads = uploadStats.reduce((sum, stat) => sum + stat._count, 0);
    const approvedUploads = uploadStats.find((s) => s.status === "APPROVED")?._count || 0;
    const approvalRate = totalUploads > 0 ? Math.round((approvedUploads / totalUploads) * 100) : 0;

    // Process active requests and identify overdue ones
    const activeRequests = creator.requests.map((req) => {
      const isOverdue = req.dueDate ? new Date(req.dueDate) < now : false;
      return {
        id: req.id,
        title: req.title,
        status: req.status,
        dueDate: req.dueDate?.toISOString() || null,
        createdAt: req.createdAt.toISOString(),
        isOverdue,
        urgency: req.urgency,
      };
    });

    const overdueCount = activeRequests.filter((r) => r.isOverdue).length;

    // Process recent uploads with thumbnail URLs
    const recentUploads = creator.uploads.map((upload) => ({
      id: upload.id,
      originalName: upload.originalName,
      fileType: upload.fileType,
      status: upload.status,
      thumbnailUrl: upload.fileType.startsWith("image/")
        ? `/api/uploads/${upload.id}/thumbnail`
        : null,
      uploadedAt: upload.uploadedAt?.toISOString() || null,
      requestId: upload.request.id,
      requestTitle: upload.request.title,
    }));

    // Get notes from contentPreferences
    interface NoteData {
      id: string;
      content: string;
      createdAt: string;
      updatedAt: string;
      authorId: string;
      authorName: string;
    }

    const prefs = (creator.contentPreferences as Record<string, unknown>) || {};
    const notes: NoteData[] = (prefs.internalNotes as NoteData[]) || [];

    // Get recent activity logs
    const activityLogs = await db.activityLog.findMany({
      where: {
        OR: [
          { entityType: "Creator", entityId: id },
          {
            entityType: "Upload",
            entityId: {
              in: creator.uploads.map((u) => u.id),
            },
          },
          {
            entityType: "ContentRequest",
            entityId: {
              in: creator.requests.map((r) => r.id),
            },
          },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const recentActivity = activityLogs.map((log) => {
      const metadata = (log.metadata as Record<string, unknown>) || {};
      return {
        id: log.id,
        action: log.action,
        description: getActivityDescription(log.action, metadata),
        timestamp: log.createdAt.toISOString(),
        icon: getActivityIcon(log.action),
        color: getActivityColor(log.action),
        metadata,
      };
    });

    // Construct the complete context response
    const contextData = {
      id: creator.id,
      name: creator.name,
      email: creator.email,
      phone: creator.phone,
      avatar: creator.avatar,
      inviteStatus: creator.inviteStatus,
      timezone: creator.timezone,
      lastLoginAt: creator.lastLoginAt?.toISOString() || null,
      createdAt: creator.createdAt.toISOString(),
      activeRequests,
      recentUploads,
      stats: {
        avgResponseTimeHours,
        onTimeCompletionRate,
        totalRequestsCompleted: totalCompleted,
        approvalRate,
        totalUploads: creator._count.uploads,
        pendingRequests: activeRequests.length,
        overdueRequests: overdueCount,
      },
      notes,
      recentActivity,
      requestSummary: {
        active: activeRequests.length,
        overdue: overdueCount,
      },
    };

    // Set cache headers for client-side caching
    const response = NextResponse.json(contextData);
    response.headers.set(
      "Cache-Control",
      "private, max-age=30, stale-while-revalidate=60"
    );

    return response;
  } catch (error) {
    console.error("Error fetching creator context:", error);
    return NextResponse.json(
      { error: "Failed to fetch creator context" },
      { status: 500 }
    );
  }
}

function getActivityDescription(
  action: string,
  metadata: Record<string, unknown>
): string {
  const descriptions: Record<string, string> = {
    "creator.invited": "Invited to the platform",
    "creator.login": "Logged into the portal",
    "creator.portal_accessed": "Accessed the creator portal",
    "creator.updated": "Profile was updated",
    "creator.note_added": "Note added",
    "creator.note_updated": "Note updated",
    "upload.created": `Started uploading "${(metadata.fileName as string) || "file"}"`,
    "upload.completed": `Completed uploading "${(metadata.fileName as string) || "file"}"`,
    "upload.approved": `Upload approved`,
    "upload.rejected": `Upload rejected`,
    "request.created": `Request assigned`,
    "request.submitted": "Submitted content for review",
    "request.revision_requested": "Revision requested",
    "request.approved": "Request approved",
    "comment.created": "Comment added",
    "message.sent": "Message sent",
  };

  return descriptions[action] || action.replace(/\./g, " ").replace(/_/g, " ");
}

function getActivityIcon(action: string): string {
  const icons: Record<string, string> = {
    "creator.invited": "mail",
    "creator.login": "log-in",
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
