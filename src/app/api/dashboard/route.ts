import { NextResponse } from "next/server";
import { activityWhere, creatorWhere, requestWhere, requireAccess, type Access } from "@/lib/access/server";
import { db } from "@/lib/db";
import {
  startOfDay,
  endOfDay,
  addDays,
  startOfMonth,
  endOfMonth,
  subDays,
  differenceInDays,
  differenceInHours,
} from "date-fns";

// Types for dashboard data
export interface ActivityItem {
  id: string;
  type: "upload" | "status_change" | "creator_signup" | "team_activity" | "comment" | "message";
  title: string;
  description: string;
  timestamp: Date;
  avatar?: string | null;
  userName: string;
  link?: string;
  metadata?: Record<string, unknown>;
}

export interface QuickStats {
  activeCreators: number;
  pendingRequests: number;
  awaitingReview: number;
  dueThisWeek: number;
  overdueItems: number;
}

export interface UpcomingDeadline {
  id: string;
  title: string;
  creatorName: string;
  creatorAvatar?: string | null;
  dueDate: Date;
  urgency: "low" | "medium" | "high" | "critical";
  status: string;
  daysUntilDue: number;
}

export interface CreatorPerformance {
  id: string;
  name: string;
  avatar?: string | null;
  uploadsThisMonth: number;
  approvalRate: number;
  avgResponseTimeHours: number;
  rank: number;
}

export interface DashboardData {
  activityFeed: ActivityItem[];
  quickStats: QuickStats;
  upcomingDeadlines: UpcomingDeadline[];
  creatorPerformance: CreatorPerformance[];
}

async function getActivityFeed(access: Access): Promise<ActivityItem[]> {
  const activities: ActivityItem[] = [];
  const since = subDays(new Date(), 7); // Last 7 days

  // Get recent uploads
  const recentUploads = await db.upload.findMany({
    where: {
      request: requestWhere(access),
      uploadedAt: { gte: since },
    },
    orderBy: { uploadedAt: "desc" },
    take: 10,
    include: {
      creator: { select: { id: true, name: true, avatar: true } },
      request: { select: { id: true, title: true } },
    },
  });

  for (const upload of recentUploads) {
    // Skip if creator or request is missing (orphaned record)
    if (!upload.creator || !upload.request) continue;
    activities.push({
      id: `upload-${upload.id}`,
      type: "upload",
      title: "New upload",
      description: `${upload.creator.name} uploaded "${upload.originalName}" for "${upload.request.title}"`,
      timestamp: upload.uploadedAt || upload.createdAt,
      avatar: upload.creator.avatar,
      userName: upload.creator.name,
      link: `/dashboard/requests/${upload.request.id}`,
      metadata: { uploadId: upload.id, fileName: upload.originalName },
    });
  }

  // Get recent status changes from activity log
  const loggedChanges = await db.activityLog.findMany({
    where: {
      // By teammates this person may see, in their agency
      ...activityWhere(access),
      entityType: "ContentRequest",
      action: { contains: "status" },
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      user: { select: { id: true, name: true, avatar: true } },
    },
  });

  // Only requests whose creator is inside this person's creator scope
  const visibleRequestIds = new Set(
    (
      await db.contentRequest.findMany({
        where: { AND: [requestWhere(access), { id: { in: loggedChanges.map((l) => l.entityId).filter((x): x is string => !!x) } }] },
        select: { id: true },
      })
    ).map((r) => r.id)
  );
  const statusChanges = loggedChanges.filter((l) => l.entityId && visibleRequestIds.has(l.entityId));

  for (const log of statusChanges) {
    const metadata = log.metadata as Record<string, unknown>;
    activities.push({
      id: `status-${log.id}`,
      type: "status_change",
      title: "Status updated",
      description: `${log.user?.name || "System"} changed request status to ${metadata?.newStatus || "updated"}`,
      timestamp: log.createdAt,
      avatar: log.user?.avatar,
      userName: log.user?.name || "System",
      link: `/dashboard/requests/${log.entityId}`,
      metadata,
    });
  }

  // Get new creator sign-ups
  const newCreators = await db.creator.findMany({
    where: {
      ...creatorWhere(access),
      inviteStatus: "ACCEPTED",
      lastLoginAt: { gte: since },
    },
    orderBy: { lastLoginAt: "desc" },
    take: 5,
    select: {
      id: true,
      name: true,
      avatar: true,
      lastLoginAt: true,
    },
  });

  for (const creator of access.has("creatorInfo.activity") ? newCreators : []) {
    activities.push({
      id: `creator-${creator.id}`,
      type: "creator_signup",
      title: "Creator joined",
      description: `${creator.name} completed portal setup`,
      timestamp: creator.lastLoginAt || new Date(),
      avatar: creator.avatar,
      userName: creator.name,
      link: `/dashboard/creators/${creator.id}`,
    });
  }

  // Get recent comments
  const recentComments = await db.comment.findMany({
    where: {
      request: requestWhere(access),
      createdAt: { gte: since },
      isInternal: false,
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      user: { select: { id: true, name: true, avatar: true } },
      request: { select: { id: true, title: true } },
    },
  });

  for (const comment of recentComments) {
    // Skip if user is missing
    if (!comment.user) continue;
    activities.push({
      id: `comment-${comment.id}`,
      type: "comment",
      title: "New comment",
      description: `${comment.user.name} commented on "${comment.request?.title || "a request"}"`,
      timestamp: comment.createdAt,
      avatar: comment.user.avatar,
      userName: comment.user.name,
      link: comment.request ? `/dashboard/requests/${comment.request.id}` : undefined,
    });
  }

  // Get recent messages
  // Conversations aren't scoped by creator here, so they show only to people who see every conversation
  const seesMessages = access.has("messages.creators") && access.has("messages.team") && access.creatorScope.type === "all";
  const recentMessages = !seesMessages ? [] : await db.message.findMany({
    where: {
      conversation: {
        participants: {
          some: {
            user: { agencyId: access.agencyId },
          },
        },
      },
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: {
      sender: { select: { id: true, name: true, avatar: true } },
      conversation: { select: { id: true, name: true, requestId: true } },
    },
  });

  for (const message of recentMessages) {
    // Skip if sender or conversation is missing
    if (!message.sender || !message.conversation) continue;
    activities.push({
      id: `message-${message.id}`,
      type: "message",
      title: "New message",
      description: `${message.sender.name} sent a message${message.conversation.name ? ` in ${message.conversation.name}` : ""}`,
      timestamp: message.createdAt,
      avatar: message.sender.avatar,
      userName: message.sender.name,
      link: message.conversation.requestId
        ? `/dashboard/requests/${message.conversation.requestId}`
        : `/dashboard/messages?conversation=${message.conversation.id}`,
    });
  }

  // Sort all activities by timestamp
  return activities
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 15);
}

async function getQuickStats(access: Access): Promise<QuickStats> {
  const now = new Date();
  const weekFromNow = addDays(now, 7);

  const [
    activeCreators,
    pendingRequests,
    awaitingReview,
    dueThisWeek,
    overdueItems,
  ] = await Promise.all([
    // Active creators (those who have accepted invite)
    db.creator.count({
      where: {
        ...creatorWhere(access),
        inviteStatus: "ACCEPTED",
      },
    }),
    // Pending requests
    db.contentRequest.count({
      where: {
        ...requestWhere(access),
        status: { in: ["PENDING", "IN_PROGRESS"] },
      },
    }),
    // Uploads awaiting review
    db.upload.count({
      where: {
        request: requestWhere(access),
        status: "PENDING",
        uploadStatus: "COMPLETED",
      },
    }),
    // Requests due this week
    db.contentRequest.count({
      where: {
        ...requestWhere(access),
        status: { notIn: ["APPROVED", "CANCELLED"] },
        dueDate: {
          gte: startOfDay(now),
          lte: endOfDay(weekFromNow),
        },
      },
    }),
    // Overdue items
    db.contentRequest.count({
      where: {
        ...requestWhere(access),
        status: { notIn: ["APPROVED", "CANCELLED"] },
        dueDate: {
          lt: startOfDay(now),
        },
      },
    }),
  ]);

  return {
    activeCreators,
    pendingRequests,
    awaitingReview,
    dueThisWeek,
    overdueItems,
  };
}

async function getUpcomingDeadlines(access: Access): Promise<UpcomingDeadline[]> {
  const now = new Date();
  const weekFromNow = addDays(now, 7);

  const requests = await db.contentRequest.findMany({
    where: {
      ...requestWhere(access),
      status: { notIn: ["APPROVED", "CANCELLED"] },
      dueDate: {
        gte: startOfDay(now),
        lte: endOfDay(weekFromNow),
      },
    },
    orderBy: { dueDate: "asc" },
    take: 10,
    include: {
      creator: { select: { id: true, name: true, avatar: true } },
    },
  });

  return requests
    .filter((request) => request.dueDate && request.creator) // Filter out invalid records
    .map((request) => {
      const daysUntilDue = differenceInDays(request.dueDate!, now);
      let urgency: "low" | "medium" | "high" | "critical";

      if (daysUntilDue <= 0) {
        urgency = "critical";
      } else if (daysUntilDue <= 1) {
        urgency = "high";
      } else if (daysUntilDue <= 3) {
        urgency = "medium";
      } else {
        urgency = "low";
      }

      return {
        id: request.id,
        title: request.title,
        creatorName: request.creator.name,
        creatorAvatar: request.creator.avatar,
        dueDate: request.dueDate!,
        urgency,
        status: request.status,
        daysUntilDue,
      };
    });
}

async function getCreatorPerformance(access: Access): Promise<CreatorPerformance[]> {
  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());

  // Step 1: Get creators with upload counts using _count (very efficient)
  const creatorsWithCounts = await db.creator.findMany({
    where: {
      ...creatorWhere(access),
      inviteStatus: "ACCEPTED",
    },
    select: {
      id: true,
      name: true,
      avatar: true,
      _count: {
        select: {
          uploads: {
            where: { uploadedAt: { gte: monthStart, lte: monthEnd } },
          },
        },
      },
    },
    orderBy: {
      uploads: { _count: "desc" },
    },
    take: 10, // Only fetch top 10 candidates (we return top 5)
  });

  // Step 2: For top candidates only, fetch detailed stats
  const topCreatorIds = creatorsWithCounts.map(c => c.id);

  const creatorsWithStats = await db.creator.findMany({
    where: {
      id: { in: topCreatorIds },
    },
    select: {
      id: true,
      name: true,
      avatar: true,
      uploads: {
        where: {
          uploadedAt: { gte: monthStart, lte: monthEnd },
        },
        select: {
          id: true,
          status: true,
          uploadedAt: true,
        },
        take: 100, // Limit uploads per creator
      },
      requests: {
        where: {
          createdAt: { gte: monthStart, lte: monthEnd },
        },
        select: {
          createdAt: true,
          uploads: {
            orderBy: { uploadedAt: "asc" },
            take: 1,
            select: { uploadedAt: true },
          },
        },
        take: 50, // Limit requests per creator
      },
    },
  });

  const performances: CreatorPerformance[] = creatorsWithStats.map((creator) => {
    // Calculate upload stats from loaded data
    const uploadsThisMonth = creator.uploads.length;
    const approvedUploads = creator.uploads.filter((u) => u.status === "APPROVED").length;
    const totalReviewedUploads = creator.uploads.filter(
      (u) => u.status === "APPROVED" || u.status === "REJECTED"
    ).length;

    // Calculate approval rate
    const approvalRate =
      totalReviewedUploads > 0
        ? Math.round((approvedUploads / totalReviewedUploads) * 100)
        : 0;

    // Calculate average response time from loaded data
    let totalResponseHours = 0;
    let responseCount = 0;

    for (const request of creator.requests) {
      const firstUpload = request.uploads[0];
      if (firstUpload?.uploadedAt) {
        totalResponseHours += differenceInHours(firstUpload.uploadedAt, request.createdAt);
        responseCount++;
      }
    }

    const avgResponseTimeHours =
      responseCount > 0 ? Math.round(totalResponseHours / responseCount) : 0;

    return {
      id: creator.id,
      name: creator.name,
      avatar: creator.avatar,
      uploadsThisMonth,
      approvalRate,
      avgResponseTimeHours,
      rank: 0, // Will be set after sorting
    };
  });

  // Sort by uploads this month (descending) and assign ranks
  performances.sort((a, b) => b.uploadsThisMonth - a.uploadsThisMonth);
  performances.forEach((p, index) => {
    p.rank = index + 1;
  });

  // Return top 5
  return performances.slice(0, 5);
}

export async function GET() {
  try {
    const gate = await requireAccess("overview.view");
    if (gate.error) return gate.error;
    const { access } = gate;

    // NOTE: Server-side caching removed intentionally for this content management platform
    // Dashboard data needs to be fresh - uploads, approvals, and activity change frequently
    // The query optimizations (limits, batching) provide sufficient performance improvement
    // Client-side caching via React Query handles repeated requests within a session

    // Fetch all dashboard data in parallel
    const [activityFeed, quickStats, upcomingDeadlines, creatorPerformance] =
      await Promise.all([
        getActivityFeed(access),
        getQuickStats(access),
        getUpcomingDeadlines(access),
        getCreatorPerformance(access),
      ]);

    const dashboardData: DashboardData = {
      activityFeed,
      quickStats,
      upcomingDeadlines,
      creatorPerformance,
    };

    return NextResponse.json(dashboardData);
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
