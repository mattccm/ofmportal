import { Suspense } from "react";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { excludePseudoUsers } from "@/lib/staff";
import { getPageAccess, staffWhere, type Access } from "@/lib/access/server";
import { ACTIVITY_KEYS, activityFeedSql, activityScopeOf, redactActivityMetadata } from "@/lib/activity-scope";
import { NoAccess } from "@/components/access/no-access";
import { ActivityPageClient } from "./activity-page-client";

export const metadata = {
  title: "Activity Log | Dashboard",
  description: "View all activity across your agency",
};

async function getInitialData(access: Access) {
  // Activity on this agency's uploads, requests and creators, limited to the
  // creators and teammates inside this person's role scopes
  const feed = activityFeedSql(access.agencyId, await activityScopeOf(access));

  let activities;
  try {
    const rows = await db.$queryRaw<
      Array<{
        id: string;
        action: string;
        entityType: string;
        entityId: string;
        metadata: Prisma.JsonValue;
        createdAt: Date;
        userId: string | null;
        userName: string | null;
        userAvatar: string | null;
        userEmail: string | null;
      }>
    >(Prisma.sql`
      SELECT a.id, a.action, a."entityType", a."entityId", a.metadata, a."createdAt", a."userId",
        u.name as "userName", u.avatar as "userAvatar", u.email as "userEmail"
      FROM "ActivityLog" a
      LEFT JOIN "User" u ON a."userId" = u.id
      WHERE ${feed}
      ORDER BY a."createdAt" DESC
      LIMIT 20
    `);
    activities = rows.map((a) => ({
      id: a.id,
      action: a.action,
      entityType: a.entityType,
      entityId: a.entityId,
      metadata: redactActivityMetadata(access, (a.metadata as Record<string, unknown>) || {}),
      createdAt: a.createdAt,
      user: a.userId ? { id: a.userId, name: a.userName ?? "", avatar: a.userAvatar, email: a.userEmail ?? "" } : null,
    }));
  } catch (error) {
    console.error("Failed to fetch initial activity data:", error);
    return {
      activities: [],
      users: [],
      stats: { today: 0, thisWeek: 0, total: 0 },
    };
  }

  // Get users for filter dropdown (teammates inside the team scope)
  const users = await db.user.findMany({
    where: { AND: [staffWhere(access), excludePseudoUsers] },
    select: { id: true, name: true, avatar: true },
    orderBy: { name: "asc" },
  });

  // Get activity stats
  const now = new Date();
  const startOfDay = new Date(now.setHours(0, 0, 0, 0));
  const startOfWeek = new Date(now);
  startOfWeek.setDate(startOfWeek.getDate() - 7);

  const countSince = async (since: Date | null) => {
    const r = await db.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*) as count FROM "ActivityLog" a
      WHERE ${feed} ${since ? Prisma.sql`AND a."createdAt" >= ${since}` : Prisma.empty}
    `);
    return Number(r[0]?.count || 0);
  };

  let todayCount = 0, weekCount = 0, totalCount = 0;
  try {
    [todayCount, weekCount, totalCount] = await Promise.all([
      countSince(startOfDay),
      countSince(startOfWeek),
      countSince(null),
    ]);
  } catch (error) {
    console.error("Failed to fetch activity stats:", error);
  }

  return {
    activities: activities.map((activity) => ({
      id: activity.id,
      action: activity.action,
      entityType: activity.entityType,
      entityId: activity.entityId,
      timestamp: activity.createdAt.toISOString(),
      user: activity.user,
      metadata: activity.metadata,
      description: getActivityDescription(activity.action, activity.metadata),
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
  const access = await getPageAccess();
  if (!access.hasAny(ACTIVITY_KEYS)) {
    return <NoAccess what="the activity log" roleName={access.role.name} />;
  }

  const data = await getInitialData(access);

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
