import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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

// ============================================
// TYPES
// ============================================

interface WidgetConfig {
  id: string;
  type: string;
  title: string;
  size: "small" | "medium" | "large";
  order: number;
  visible: boolean;
  settings?: Record<string, unknown>;
}

// ============================================
// GET - Fetch widget-specific data
// ============================================

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const agencyId = session.user.agencyId;
    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const widget = searchParams.get("widget");

    // If no widget specified, return saved layout
    if (!widget) {
      return await getWidgetLayout(userId);
    }

    // Fetch data for specific widget
    switch (widget) {
      case "pending-requests":
        return await getPendingRequests(agencyId);
      case "recent-uploads":
        return await getRecentUploads(agencyId);
      case "upcoming-deadlines":
        return await getUpcomingDeadlines(agencyId);
      case "top-creators":
        return await getTopCreators(agencyId);
      case "quick-stats":
        return await getQuickStats(agencyId);
      case "activity-feed":
        return await getActivityFeed(agencyId);
      case "reminder-summary":
        return await getReminderSummary(agencyId);
      default:
        return NextResponse.json({ error: "Unknown widget" }, { status: 400 });
    }
  } catch (error) {
    console.error("Dashboard widgets API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch widget data" },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Save widget layout
// ============================================

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();
    const { layout } = body as { layout: WidgetConfig[] };

    if (!Array.isArray(layout)) {
      return NextResponse.json({ error: "Invalid layout format" }, { status: 400 });
    }

    // Save layout to user preferences
    const currentPrefs = await getCurrentPreferences(userId);
    const prefsUpdate = {
      ...currentPrefs,
      dashboardLayout: layout,
    };

    await db.user.update({
      where: { id: userId },
      data: {
        preferences: JSON.parse(JSON.stringify(prefsUpdate)),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Save widget layout error:", error);
    return NextResponse.json(
      { error: "Failed to save layout" },
      { status: 500 }
    );
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function getCurrentPreferences(userId: string): Promise<Record<string, unknown>> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });
  return (user?.preferences as Record<string, unknown>) || {};
}

async function getWidgetLayout(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });

  const preferences = (user?.preferences as Record<string, unknown>) || {};
  const layout = preferences.dashboardLayout || [];

  return NextResponse.json({ layout });
}

// ============================================
// WIDGET DATA FETCHERS
// ============================================

async function getPendingRequests(agencyId: string) {
  const requests = await db.contentRequest.findMany({
    where: {
      agencyId,
      status: { in: ["PENDING", "IN_PROGRESS", "SUBMITTED", "UNDER_REVIEW", "NEEDS_REVISION"] },
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    take: 15,
    include: {
      creator: { select: { id: true, name: true, avatar: true } },
      _count: { select: { uploads: true } },
    },
  });

  return NextResponse.json({
    requests: requests.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      dueDate: r.dueDate?.toISOString() || null,
      createdAt: r.createdAt.toISOString(),
      creator: r.creator,
      uploadCount: r._count.uploads,
    })),
  });
}

async function getRecentUploads(agencyId: string) {
  const uploads = await db.upload.findMany({
    where: {
      request: { agencyId },
      uploadStatus: "COMPLETED",
    },
    orderBy: { uploadedAt: "desc" },
    take: 15,
    include: {
      creator: { select: { id: true, name: true, avatar: true } },
      request: { select: { id: true, title: true } },
    },
  });

  return NextResponse.json({
    uploads: uploads.map((u) => ({
      id: u.id,
      fileName: u.fileName,
      originalName: u.originalName,
      fileType: u.fileType,
      fileSize: Number(u.fileSize),
      thumbnailUrl: u.thumbnailUrl,
      status: u.status,
      uploadedAt: u.uploadedAt?.toISOString() || u.createdAt.toISOString(),
      creator: u.creator,
      request: u.request,
    })),
  });
}

async function getUpcomingDeadlines(agencyId: string) {
  const now = new Date();
  const twoWeeksFromNow = addDays(now, 14);

  // Get both upcoming and overdue
  const requests = await db.contentRequest.findMany({
    where: {
      agencyId,
      status: { notIn: ["APPROVED", "CANCELLED", "ARCHIVED"] },
      dueDate: { lte: endOfDay(twoWeeksFromNow) },
    },
    orderBy: { dueDate: "asc" },
    take: 15,
    include: {
      creator: { select: { id: true, name: true, avatar: true } },
    },
  });

  return NextResponse.json({
    deadlines: requests
      .filter((r) => r.dueDate)
      .map((r) => ({
        id: r.id,
        title: r.title,
        status: r.status,
        dueDate: r.dueDate!.toISOString(),
        creator: r.creator,
      })),
  });
}

async function getTopCreators(agencyId: string) {
  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());

  const creators = await db.creator.findMany({
    where: { agencyId, inviteStatus: "ACCEPTED" },
    select: { id: true, name: true, avatar: true },
  });

  const performances = [];

  for (const creator of creators) {
    const [uploadsThisMonth, approvedUploads, totalReviewedUploads] = await Promise.all([
      db.upload.count({
        where: { creatorId: creator.id, uploadedAt: { gte: monthStart, lte: monthEnd } },
      }),
      db.upload.count({
        where: {
          creatorId: creator.id,
          status: "APPROVED",
          uploadedAt: { gte: monthStart, lte: monthEnd },
        },
      }),
      db.upload.count({
        where: {
          creatorId: creator.id,
          status: { in: ["APPROVED", "REJECTED"] },
          uploadedAt: { gte: monthStart, lte: monthEnd },
        },
      }),
    ]);

    const approvalRate =
      totalReviewedUploads > 0 ? Math.round((approvedUploads / totalReviewedUploads) * 100) : 0;

    // Calculate avg response time
    const requestsWithUploads = await db.contentRequest.findMany({
      where: {
        creatorId: creator.id,
        createdAt: { gte: monthStart, lte: monthEnd },
        uploads: { some: {} },
      },
      select: {
        createdAt: true,
        uploads: { orderBy: { uploadedAt: "asc" }, take: 1, select: { uploadedAt: true } },
      },
    });

    let totalResponseHours = 0;
    let responseCount = 0;
    for (const request of requestsWithUploads) {
      if (request.uploads[0]?.uploadedAt) {
        totalResponseHours += differenceInHours(request.uploads[0].uploadedAt, request.createdAt);
        responseCount++;
      }
    }
    const avgResponseTimeHours = responseCount > 0 ? Math.round(totalResponseHours / responseCount) : 0;

    performances.push({
      id: creator.id,
      name: creator.name,
      avatar: creator.avatar,
      uploadsThisMonth,
      approvalRate,
      avgResponseTimeHours,
      rank: 0,
    });
  }

  // Sort by uploads and assign ranks
  performances.sort((a, b) => b.uploadsThisMonth - a.uploadsThisMonth);
  performances.forEach((p, index) => {
    p.rank = index + 1;
  });

  return NextResponse.json({ creators: performances.slice(0, 10) });
}

async function getQuickStats(agencyId: string) {
  const now = new Date();
  const weekFromNow = addDays(now, 7);
  const lastWeek = subDays(now, 7);

  const [
    activeCreators,
    pendingRequests,
    awaitingReview,
    dueThisWeek,
    overdueItems,
    // Last week stats for trends
    prevActiveCreators,
    prevPendingRequests,
    prevAwaitingReview,
  ] = await Promise.all([
    db.creator.count({ where: { agencyId, inviteStatus: "ACCEPTED" } }),
    db.contentRequest.count({
      where: { agencyId, status: { in: ["PENDING", "IN_PROGRESS"] } },
    }),
    db.upload.count({
      where: { request: { agencyId }, status: "PENDING", uploadStatus: "COMPLETED" },
    }),
    db.contentRequest.count({
      where: {
        agencyId,
        status: { notIn: ["APPROVED", "CANCELLED"] },
        dueDate: { gte: startOfDay(now), lte: endOfDay(weekFromNow) },
      },
    }),
    db.contentRequest.count({
      where: {
        agencyId,
        status: { notIn: ["APPROVED", "CANCELLED"] },
        dueDate: { lt: startOfDay(now) },
      },
    }),
    // Previous period (for trends)
    db.creator.count({
      where: { agencyId, inviteStatus: "ACCEPTED", createdAt: { lt: lastWeek } },
    }),
    db.contentRequest.count({
      where: { agencyId, status: { in: ["PENDING", "IN_PROGRESS"] }, createdAt: { lt: lastWeek } },
    }),
    db.upload.count({
      where: {
        request: { agencyId },
        status: "PENDING",
        uploadStatus: "COMPLETED",
        createdAt: { lt: lastWeek },
      },
    }),
  ]);

  // Calculate trend percentages
  const calcTrend = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  return NextResponse.json({
    stats: {
      activeCreators,
      pendingRequests,
      awaitingReview,
      dueThisWeek,
      overdueItems,
      trends: {
        activeCreators: calcTrend(activeCreators, prevActiveCreators),
        pendingRequests: calcTrend(pendingRequests, prevPendingRequests),
        awaitingReview: calcTrend(awaitingReview, prevAwaitingReview),
      },
    },
  });
}

async function getActivityFeed(agencyId: string) {
  const activities: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    timestamp: string;
    avatar?: string | null;
    userName: string;
    link?: string;
  }> = [];

  const since = subDays(new Date(), 7);

  // Get recent uploads
  const recentUploads = await db.upload.findMany({
    where: { request: { agencyId }, uploadedAt: { gte: since } },
    orderBy: { uploadedAt: "desc" },
    take: 10,
    include: {
      creator: { select: { id: true, name: true, avatar: true } },
      request: { select: { id: true, title: true } },
    },
  });

  for (const upload of recentUploads) {
    if (!upload.creator || !upload.request) continue;
    activities.push({
      id: `upload-${upload.id}`,
      type: "upload",
      title: "New upload",
      description: `${upload.creator.name} uploaded "${upload.originalName}"`,
      timestamp: (upload.uploadedAt || upload.createdAt).toISOString(),
      avatar: upload.creator.avatar,
      userName: upload.creator.name,
      link: `/dashboard/requests/${upload.request.id}`,
    });
  }

  // Get recent comments
  const recentComments = await db.comment.findMany({
    where: { request: { agencyId }, createdAt: { gte: since }, isInternal: false },
    orderBy: { createdAt: "desc" },
    take: 8,
    include: {
      user: { select: { id: true, name: true, avatar: true } },
      request: { select: { id: true, title: true } },
    },
  });

  for (const comment of recentComments) {
    activities.push({
      id: `comment-${comment.id}`,
      type: "comment",
      title: "New comment",
      description: `${comment.user.name} commented on "${comment.request?.title}"`,
      timestamp: comment.createdAt.toISOString(),
      avatar: comment.user.avatar,
      userName: comment.user.name,
      link: comment.request ? `/dashboard/requests/${comment.request.id}` : undefined,
    });
  }

  // Get new creators
  const newCreators = await db.creator.findMany({
    where: { agencyId, inviteStatus: "ACCEPTED", lastLoginAt: { gte: since } },
    orderBy: { lastLoginAt: "desc" },
    take: 5,
    select: { id: true, name: true, avatar: true, lastLoginAt: true },
  });

  for (const creator of newCreators) {
    activities.push({
      id: `creator-${creator.id}`,
      type: "creator_signup",
      title: "Creator joined",
      description: `${creator.name} completed portal setup`,
      timestamp: (creator.lastLoginAt || new Date()).toISOString(),
      avatar: creator.avatar,
      userName: creator.name,
      link: `/dashboard/creators/${creator.id}`,
    });
  }

  // Get recent approvals/rejections
  const recentReviews = await db.upload.findMany({
    where: {
      request: { agencyId },
      status: { in: ["APPROVED", "REJECTED"] },
      updatedAt: { gte: since },
    },
    orderBy: { updatedAt: "desc" },
    take: 8,
    include: {
      reviewedBy: { select: { id: true, name: true, avatar: true } },
      request: { select: { id: true, title: true } },
    },
  });

  for (const upload of recentReviews) {
    if (upload.reviewedBy && upload.request) {
      activities.push({
        id: `review-${upload.id}`,
        type: upload.status === "APPROVED" ? "approval" : "rejection",
        title: upload.status === "APPROVED" ? "Upload approved" : "Upload rejected",
        description: `${upload.reviewedBy.name} ${upload.status === "APPROVED" ? "approved" : "rejected"} "${upload.originalName}"`,
        timestamp: upload.updatedAt.toISOString(),
        avatar: upload.reviewedBy.avatar,
        userName: upload.reviewedBy.name,
        link: `/dashboard/requests/${upload.request.id}`,
      });
    }
  }

  // Sort by timestamp
  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return NextResponse.json({ activities: activities.slice(0, 15) });
}

async function getReminderSummary(agencyId: string) {
  const now = new Date();
  const startOfToday = startOfDay(now);
  const endOfToday = endOfDay(now);

  // Get pending reminders
  const pendingReminders = await db.reminder.findMany({
    where: {
      request: { agencyId },
      status: "PENDING",
    },
    orderBy: { scheduledAt: "asc" },
    take: 10,
    include: {
      request: {
        select: {
          id: true,
          title: true,
          creator: { select: { id: true, name: true } },
        },
      },
    },
  });

  // Count stats
  const [pendingCount, sentTodayCount, failedCount] = await Promise.all([
    db.reminder.count({ where: { request: { agencyId }, status: "PENDING" } }),
    db.reminder.count({
      where: {
        request: { agencyId },
        status: "SENT",
        sentAt: { gte: startOfToday, lte: endOfToday },
      },
    }),
    db.reminder.count({
      where: {
        request: { agencyId },
        status: "FAILED",
        createdAt: { gte: subDays(now, 7) },
      },
    }),
  ]);

  return NextResponse.json({
    pending: pendingCount,
    sentToday: sentTodayCount,
    failed: failedCount,
    reminders: pendingReminders
      .filter((r) => r.request)
      .map((r) => ({
        id: r.id,
        type: r.type,
        channel: r.channel,
        scheduledAt: r.scheduledAt.toISOString(),
        status: r.status,
        request: {
          id: r.request.id,
          title: r.request.title,
          creator: r.request.creator,
        },
      })),
  });
}
