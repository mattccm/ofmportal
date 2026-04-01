import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { ActivityPageClient } from "./activity-page-client";

export const metadata = {
  title: "Activity Log | Dashboard",
  description: "View all activity across your agency",
};

async function getInitialData(agencyId: string) {
  // Get initial activities
  const [uploads, requests, creators] = await Promise.all([
    db.upload.findMany({
      where: { request: { agencyId } },
      select: { id: true },
    }),
    db.contentRequest.findMany({
      where: { agencyId },
      select: { id: true },
    }),
    db.creator.findMany({
      where: { agencyId },
      select: { id: true },
    }),
  ]);

  const uploadIds = uploads.map((u) => u.id);
  const requestIds = requests.map((r) => r.id);
  const creatorIds = creators.map((c) => c.id);

  const activities = await db.activityLog.findMany({
    where: {
      OR: [
        { entityType: "Upload", entityId: { in: uploadIds } },
        { entityType: "ContentRequest", entityId: { in: requestIds } },
        { entityType: "Creator", entityId: { in: creatorIds } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 20,
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
  });

  // Get users for filter dropdown
  const users = await db.user.findMany({
    where: { agencyId },
    select: { id: true, name: true, avatar: true },
    orderBy: { name: "asc" },
  });

  // Get activity stats
  const now = new Date();
  const startOfDay = new Date(now.setHours(0, 0, 0, 0));
  const startOfWeek = new Date(now);
  startOfWeek.setDate(startOfWeek.getDate() - 7);

  const [todayCount, weekCount, totalCount] = await Promise.all([
    db.activityLog.count({
      where: {
        OR: [
          { entityType: "Upload", entityId: { in: uploadIds } },
          { entityType: "ContentRequest", entityId: { in: requestIds } },
          { entityType: "Creator", entityId: { in: creatorIds } },
        ],
        createdAt: { gte: startOfDay },
      },
    }),
    db.activityLog.count({
      where: {
        OR: [
          { entityType: "Upload", entityId: { in: uploadIds } },
          { entityType: "ContentRequest", entityId: { in: requestIds } },
          { entityType: "Creator", entityId: { in: creatorIds } },
        ],
        createdAt: { gte: startOfWeek },
      },
    }),
    db.activityLog.count({
      where: {
        OR: [
          { entityType: "Upload", entityId: { in: uploadIds } },
          { entityType: "ContentRequest", entityId: { in: requestIds } },
          { entityType: "Creator", entityId: { in: creatorIds } },
        ],
      },
    }),
  ]);

  return {
    activities: activities.map((activity) => ({
      id: activity.id,
      action: activity.action,
      entityType: activity.entityType,
      entityId: activity.entityId,
      timestamp: activity.createdAt.toISOString(),
      user: activity.user,
      metadata: activity.metadata as Record<string, unknown>,
      description: getActivityDescription(activity.action, activity.metadata as Record<string, unknown>),
      icon: getActivityIcon(activity.action),
      color: getActivityColor(activity.action),
      category: getActivityCategory(activity.action),
    })),
    users,
    stats: {
      today: todayCount,
      thisWeek: weekCount,
      total: totalCount,
    },
  };
}

function getActivityDescription(
  action: string,
  metadata: Record<string, unknown>
): string {
  const descriptions: Record<string, string | ((m: Record<string, unknown>) => string)> = {
    "upload.created": (m) => `Started uploading "${m.fileName || "file"}"`,
    "upload.completed": (m) => `Completed upload "${m.fileName || "file"}"`,
    "upload.approved": (m) => `Approved upload "${m.fileName || "file"}"`,
    "upload.rejected": (m) => `Rejected upload "${m.fileName || "file"}"`,
    "upload.reviewed": (m) => `Reviewed upload "${m.fileName || "file"}"`,
    "comment.created": (m) => `Added a comment${m.requestTitle ? ` on "${m.requestTitle}"` : ""}`,
    "comment.updated": "Updated a comment",
    "comment.deleted": "Deleted a comment",
    "request.created": (m) => `Created request "${m.title || "Untitled"}"`,
    "request.updated": (m) => `Updated request "${m.title || "Untitled"}"`,
    "request.submitted": (m) => `Submitted content for "${m.title || "request"}"`,
    "request.approved": (m) => `Approved request "${m.title || "Untitled"}"`,
    "request.rejected": (m) => `Rejected request "${m.title || "Untitled"}"`,
    "request.revision_requested": (m) => `Requested revision on "${m.title || "request"}"`,
    "request.status_changed": (m) => `Changed status of "${m.title || "request"}"`,
    "reminder.sent": (m) => `Sent reminder to ${m.creatorName || "creator"}`,
    "reminder.scheduled": (m) => `Scheduled reminder for ${m.creatorName || "creator"}`,
    "reminder.escalation": (m) => `Escalation reminder sent for "${m.requestTitle || "request"}"`,
    "creator.invited": (m) => `Invited ${m.creatorName || "creator"} to the platform`,
    "creator.login": (m) => `${m.creatorName || "Creator"} logged into the portal`,
    "creator.portal_accessed": (m) => `${m.creatorName || "Creator"} accessed the portal`,
    "creator.updated": (m) => `Updated ${m.creatorName || "creator"}'s profile`,
  };

  const desc = descriptions[action];
  if (typeof desc === "function") {
    return desc(metadata);
  }
  if (typeof desc === "string") {
    return desc;
  }

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
  if (action.includes("comment") || action.includes("message")) {
    return "amber";
  }
  if (action.includes("reminder") || action.includes("escalation")) {
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

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="h-4 w-80 bg-muted rounded" />
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-muted rounded-xl" />
        ))}
      </div>

      {/* Filter skeleton */}
      <div className="flex gap-4">
        <div className="h-10 flex-1 bg-muted rounded-lg" />
        <div className="h-10 w-32 bg-muted rounded-lg" />
      </div>

      {/* Activity list skeleton */}
      <div className="bg-muted rounded-xl p-6 space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-background" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 bg-background rounded" />
              <div className="h-3 w-1/2 bg-background rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function ActivityPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.agencyId) {
    redirect("/login");
  }

  const data = await getInitialData(session.user.agencyId);

  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <ActivityPageClient
        initialActivities={data.activities}
        users={data.users}
        stats={data.stats}
      />
    </Suspense>
  );
}
