import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { creatorWhere, requestWhere, type Access } from "./access/server";
import {
  startOfDay,
  endOfDay,
  subDays,
  subWeeks,
  startOfWeek,
  endOfWeek,
  differenceInHours,
  eachDayOfInterval,
  format,
} from "date-fns";

/**
 * Whose numbers: an agency id (every creator) or a staff member's access,
 * which limits every count to the creators inside their creator scope.
 */
export type AnalyticsScope = string | Pick<Access, "agencyId" | "creatorScope">;

/** Requests inside the scope */
export function scopeRequests(scope: AnalyticsScope): Prisma.ContentRequestWhereInput {
  return typeof scope === "string" ? { agencyId: scope } : requestWhere(scope);
}

/** Creators inside the scope */
export function scopeCreators(scope: AnalyticsScope): Prisma.CreatorWhereInput {
  return typeof scope === "string" ? { agencyId: scope } : creatorWhere(scope);
}

export type DateRange = "7d" | "30d" | "90d" | "custom";

export interface DateRangeParams {
  range: DateRange;
  startDate?: Date;
  endDate?: Date;
}

export interface OverviewStats {
  totalUploads: number;
  previousUploads: number;
  approvalRate: number;
  previousApprovalRate: number;
  avgTurnaroundHours: number;
  previousAvgTurnaroundHours: number;
  activeCreators: number;
  previousActiveCreators: number;
  totalRequests: number;
  previousRequests: number;
}

export interface StatusBreakdown {
  status: string;
  count: number;
  percentage: number;
  color: string;
}

export interface WeeklyActivity {
  week: string;
  startDate: Date;
  uploads: number;
  approvals: number;
  requests: number;
}

export interface CreatorStats {
  id: string;
  name: string;
  email?: string;
  avatar: string | null;
  uploadCount: number;
  approvalRate: number;
  avgResponseHours: number;
  trend: "up" | "down" | "stable";
  trendValue: number;
}

export interface ApprovalMetrics {
  approved: number;
  rejected: number;
  pending: number;
  approvalRate: number;
  rejectionRate: number;
  avgReviewTimeHours: number;
}

export interface TurnaroundMetrics {
  avgHours: number;
  minHours: number;
  maxHours: number;
  medianHours: number;
  byUrgency: {
    urgency: string;
    avgHours: number;
    count: number;
  }[];
}

export interface DailyActivity {
  date: Date;
  dateString: string;
  uploads: number;
  level: 0 | 1 | 2 | 3 | 4; // 0 = no activity, 4 = highest
}

function getDateRange(params: DateRangeParams): { start: Date; end: Date } {
  const now = new Date();
  const end = endOfDay(now);

  switch (params.range) {
    case "7d":
      return { start: startOfDay(subDays(now, 7)), end };
    case "30d":
      return { start: startOfDay(subDays(now, 30)), end };
    case "90d":
      return { start: startOfDay(subDays(now, 90)), end };
    case "custom":
      return {
        start: params.startDate ? startOfDay(params.startDate) : startOfDay(subDays(now, 30)),
        end: params.endDate ? endOfDay(params.endDate) : end,
      };
    default:
      return { start: startOfDay(subDays(now, 30)), end };
  }
}

function getPreviousDateRange(start: Date, end: Date): { start: Date; end: Date } {
  const duration = end.getTime() - start.getTime();
  return {
    start: new Date(start.getTime() - duration),
    end: new Date(start.getTime() - 1), // 1ms before current period starts
  };
}

export async function getOverviewStats(
  scope: AnalyticsScope,
  dateRangeParams: DateRangeParams,
  creatorId?: string
): Promise<OverviewStats> {
  const { start, end } = getDateRange(dateRangeParams);
  const { start: prevStart, end: prevEnd } = getPreviousDateRange(start, end);

  // Build creator filter
  const creatorFilter = creatorId ? { creatorId } : {};
  const requestCreatorFilter = creatorId ? { creatorId } : {};

  // Current period stats
  const [
    currentUploads,
    currentApprovedUploads,
    currentRejectedUploads,
    currentRequests,
    currentActiveCreators,
    completedRequests,
  ] = await Promise.all([
    // Total uploads in period
    db.upload.count({
      where: {
        request: scopeRequests(scope),
        uploadedAt: { gte: start, lte: end },
        ...creatorFilter,
      },
    }),
    // Approved uploads in period
    db.upload.count({
      where: {
        request: scopeRequests(scope),
        status: "APPROVED",
        updatedAt: { gte: start, lte: end },
        ...creatorFilter,
      },
    }),
    // Rejected uploads in period (approval rate = approved / (approved + rejected),
    // matching getApprovalMetrics and staying <= 100%)
    db.upload.count({
      where: {
        request: scopeRequests(scope),
        status: "REJECTED",
        updatedAt: { gte: start, lte: end },
        ...creatorFilter,
      },
    }),
    // Total requests created in period
    db.contentRequest.count({
      where: {
        ...scopeRequests(scope),
        createdAt: { gte: start, lte: end },
        ...requestCreatorFilter,
      },
    }),
    // Active creators (creators with uploads in period)
    db.upload.groupBy({
      by: ["creatorId"],
      where: {
        request: scopeRequests(scope),
        uploadedAt: { gte: start, lte: end },
        ...creatorFilter,
      },
    }),
    // Completed requests for turnaround calculation
    db.contentRequest.findMany({
      where: {
        ...scopeRequests(scope),
        status: "APPROVED",
        reviewedAt: { gte: start, lte: end },
        ...requestCreatorFilter,
      },
      select: {
        createdAt: true,
        reviewedAt: true,
      },
    }),
  ]);

  // Previous period stats
  const [
    prevUploads,
    prevApprovedUploads,
    prevRejectedUploads,
    prevRequests,
    prevActiveCreators,
  ] =
    await Promise.all([
      db.upload.count({
        where: {
          request: scopeRequests(scope),
          uploadedAt: { gte: prevStart, lte: prevEnd },
          ...creatorFilter,
        },
      }),
      db.upload.count({
        where: {
          request: scopeRequests(scope),
          status: "APPROVED",
          updatedAt: { gte: prevStart, lte: prevEnd },
          ...creatorFilter,
        },
      }),
      db.upload.count({
        where: {
          request: scopeRequests(scope),
          status: "REJECTED",
          updatedAt: { gte: prevStart, lte: prevEnd },
          ...creatorFilter,
        },
      }),
      db.contentRequest.count({
        where: {
          ...scopeRequests(scope),
          createdAt: { gte: prevStart, lte: prevEnd },
          ...requestCreatorFilter,
        },
      }),
      db.upload.groupBy({
        by: ["creatorId"],
        where: {
          request: scopeRequests(scope),
          uploadedAt: { gte: prevStart, lte: prevEnd },
          ...creatorFilter,
        },
      }),
    ]);

  // Calculate approval rates
  const currentDecided = currentApprovedUploads + currentRejectedUploads;
  const prevDecided = prevApprovedUploads + prevRejectedUploads;
  const approvalRate =
    currentDecided > 0 ? (currentApprovedUploads / currentDecided) * 100 : 0;
  const prevApprovalRate =
    prevDecided > 0 ? (prevApprovedUploads / prevDecided) * 100 : 0;

  // Calculate average turnaround time
  const turnaroundHours = completedRequests
    .filter((r) => r.reviewedAt)
    .map((r) => differenceInHours(r.reviewedAt!, r.createdAt));

  const avgTurnaroundHours =
    turnaroundHours.length > 0
      ? turnaroundHours.reduce((a, b) => a + b, 0) / turnaroundHours.length
      : 0;

  // Previous period turnaround
  const prevCompletedRequests = await db.contentRequest.findMany({
    where: {
      ...scopeRequests(scope),
      status: "APPROVED",
      reviewedAt: { gte: prevStart, lte: prevEnd },
      ...requestCreatorFilter,
    },
    select: { createdAt: true, reviewedAt: true },
  });

  const prevTurnaroundHours = prevCompletedRequests
    .filter((r) => r.reviewedAt)
    .map((r) => differenceInHours(r.reviewedAt!, r.createdAt));

  const prevAvgTurnaroundHours =
    prevTurnaroundHours.length > 0
      ? prevTurnaroundHours.reduce((a, b) => a + b, 0) / prevTurnaroundHours.length
      : 0;

  return {
    totalUploads: currentUploads,
    previousUploads: prevUploads,
    approvalRate: Math.round(approvalRate * 10) / 10,
    previousApprovalRate: Math.round(prevApprovalRate * 10) / 10,
    avgTurnaroundHours: Math.round(avgTurnaroundHours * 10) / 10,
    previousAvgTurnaroundHours: Math.round(prevAvgTurnaroundHours * 10) / 10,
    activeCreators: currentActiveCreators.length,
    previousActiveCreators: prevActiveCreators.length,
    totalRequests: currentRequests,
    previousRequests: prevRequests,
  };
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "#f59e0b",
  IN_PROGRESS: "#3b82f6",
  SUBMITTED: "#8b5cf6",
  UNDER_REVIEW: "#f97316",
  NEEDS_REVISION: "#ef4444",
  APPROVED: "#d3d7de",
  CANCELLED: "#6b7280",
};

export async function getRequestStatusBreakdown(
  scope: AnalyticsScope,
  dateRangeParams: DateRangeParams,
  creatorId?: string
): Promise<StatusBreakdown[]> {
  const { start, end } = getDateRange(dateRangeParams);
  const creatorFilter = creatorId ? { creatorId } : {};

  const statusCounts = await db.contentRequest.groupBy({
    by: ["status"],
    where: {
      ...scopeRequests(scope),
      createdAt: { gte: start, lte: end },
      ...creatorFilter,
    },
    _count: true,
  });

  const total = statusCounts.reduce((acc, item) => acc + item._count, 0);

  return statusCounts.map((item) => ({
    status: item.status,
    count: item._count,
    percentage: total > 0 ? Math.round((item._count / total) * 100) : 0,
    color: STATUS_COLORS[item.status] || "#6b7280",
  }));
}

export async function getWeeklyActivity(
  scope: AnalyticsScope,
  weeks: number = 8,
  creatorId?: string
): Promise<WeeklyActivity[]> {
  const now = new Date();
  const results: WeeklyActivity[] = [];
  const creatorFilter = creatorId ? { creatorId } : {};
  const requestCreatorFilter = creatorId ? { creatorId } : {};

  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(subWeeks(now, i), { weekStartsOn: 1 });

    const [uploads, approvals, requests] = await Promise.all([
      db.upload.count({
        where: {
          request: scopeRequests(scope),
          uploadedAt: { gte: weekStart, lte: weekEnd },
          ...creatorFilter,
        },
      }),
      db.upload.count({
        where: {
          request: scopeRequests(scope),
          status: "APPROVED",
          updatedAt: { gte: weekStart, lte: weekEnd },
          ...creatorFilter,
        },
      }),
      db.contentRequest.count({
        where: {
          ...scopeRequests(scope),
          createdAt: { gte: weekStart, lte: weekEnd },
          ...requestCreatorFilter,
        },
      }),
    ]);

    results.push({
      week: format(weekStart, "MMM d"),
      startDate: weekStart,
      uploads,
      approvals,
      requests,
    });
  }

  return results;
}

export async function getCreatorLeaderboard(
  scope: AnalyticsScope,
  limit: number = 10
): Promise<CreatorStats[]> {
  const thirtyDaysAgo = subDays(new Date(), 30);
  const sixtyDaysAgo = subDays(new Date(), 60);

  // Rank all creators by 30-day upload count first, then load stats for the top N
  const top = await db.upload.groupBy({
    by: ["creatorId"],
    where: { request: scopeRequests(scope), uploadedAt: { gte: thirtyDaysAgo } },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: limit,
  });
  const topIds = top.map((t) => t.creatorId);
  if (topIds.length === 0) return [];

  // Get creators with upload stats
  const creators = await db.creator.findMany({
    where: { AND: [scopeCreators(scope), { id: { in: topIds } }] },
    include: {
      uploads: {
        where: {
          uploadedAt: { gte: sixtyDaysAgo },
        },
        select: {
          id: true,
          status: true,
          uploadedAt: true,
          request: {
            select: {
              createdAt: true,
            },
          },
        },
      },
    },
  });

  const creatorStats: CreatorStats[] = creators
    .map((creator) => {
      // Current period uploads
      const currentPeriodUploads = creator.uploads.filter(
        (u) => u.uploadedAt && u.uploadedAt >= thirtyDaysAgo
      );

      // Previous period uploads
      const prevPeriodUploads = creator.uploads.filter(
        (u) => u.uploadedAt && u.uploadedAt >= sixtyDaysAgo && u.uploadedAt < thirtyDaysAgo
      );

      const approvedCount = currentPeriodUploads.filter(
        (u) => u.status === "APPROVED"
      ).length;
      const totalCount = currentPeriodUploads.length;
      const approvalRate = totalCount > 0 ? (approvedCount / totalCount) * 100 : 0;

      // Calculate average response time
      const responseTimes = currentPeriodUploads
        .filter((u) => u.uploadedAt && u.request.createdAt)
        .map((u) => differenceInHours(u.uploadedAt!, u.request.createdAt));

      const avgResponseHours =
        responseTimes.length > 0
          ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
          : 0;

      // Calculate trend
      const prevCount = prevPeriodUploads.length;
      const currentCount = currentPeriodUploads.length;
      let trend: "up" | "down" | "stable" = "stable";
      let trendValue = 0;

      if (prevCount > 0) {
        trendValue = ((currentCount - prevCount) / prevCount) * 100;
        if (trendValue > 10) trend = "up";
        else if (trendValue < -10) trend = "down";
      } else if (currentCount > 0) {
        trend = "up";
        trendValue = 100;
      }

      return {
        id: creator.id,
        name: creator.name,
        email: creator.email,
        avatar: creator.avatar,
        uploadCount: totalCount,
        approvalRate: Math.round(approvalRate * 10) / 10,
        avgResponseHours: Math.round(avgResponseHours * 10) / 10,
        trend,
        trendValue: Math.round(Math.abs(trendValue)),
      };
    })
    .filter((c) => c.uploadCount > 0)
    .sort((a, b) => b.uploadCount - a.uploadCount)
    .slice(0, limit);

  return creatorStats;
}

export async function getApprovalMetrics(
  scope: AnalyticsScope,
  dateRangeParams: DateRangeParams
): Promise<ApprovalMetrics> {
  const { start, end } = getDateRange(dateRangeParams);

  const [approved, rejected, pending] = await Promise.all([
    db.upload.count({
      where: {
        request: scopeRequests(scope),
        status: "APPROVED",
        updatedAt: { gte: start, lte: end },
      },
    }),
    db.upload.count({
      where: {
        request: scopeRequests(scope),
        status: "REJECTED",
        updatedAt: { gte: start, lte: end },
      },
    }),
    db.upload.count({
      where: {
        request: scopeRequests(scope),
        status: "PENDING",
        createdAt: { gte: start, lte: end },
      },
    }),
  ]);

  const total = approved + rejected;
  const approvalRate = total > 0 ? (approved / total) * 100 : 0;
  const rejectionRate = total > 0 ? (rejected / total) * 100 : 0;

  // Get average review time
  const reviewedUploads = await db.upload.findMany({
    where: {
      request: scopeRequests(scope),
      status: { in: ["APPROVED", "REJECTED"] },
      updatedAt: { gte: start, lte: end },
    },
    select: {
      createdAt: true,
      updatedAt: true,
    },
  });

  const reviewTimes = reviewedUploads.map((u) =>
    differenceInHours(u.updatedAt, u.createdAt)
  );
  const avgReviewTimeHours =
    reviewTimes.length > 0
      ? reviewTimes.reduce((a, b) => a + b, 0) / reviewTimes.length
      : 0;

  return {
    approved,
    rejected,
    pending,
    approvalRate: Math.round(approvalRate * 10) / 10,
    rejectionRate: Math.round(rejectionRate * 10) / 10,
    avgReviewTimeHours: Math.round(avgReviewTimeHours * 10) / 10,
  };
}

export async function getTurnaroundMetrics(
  scope: AnalyticsScope,
  dateRangeParams: DateRangeParams
): Promise<TurnaroundMetrics> {
  const { start, end } = getDateRange(dateRangeParams);

  // Get completed requests with urgency
  const completedRequests = await db.contentRequest.findMany({
    where: {
      ...scopeRequests(scope),
      status: "APPROVED",
      reviewedAt: { gte: start, lte: end },
    },
    select: {
      createdAt: true,
      reviewedAt: true,
      urgency: true,
    },
  });

  const turnaroundHours = completedRequests
    .filter((r) => r.reviewedAt)
    .map((r) => ({
      hours: differenceInHours(r.reviewedAt!, r.createdAt),
      urgency: r.urgency,
    }));

  if (turnaroundHours.length === 0) {
    return {
      avgHours: 0,
      minHours: 0,
      maxHours: 0,
      medianHours: 0,
      byUrgency: [],
    };
  }

  const hours = turnaroundHours.map((t) => t.hours);
  const sortedHours = [...hours].sort((a, b) => a - b);

  // Group by urgency
  const urgencyGroups = turnaroundHours.reduce(
    (acc, item) => {
      if (!acc[item.urgency]) {
        acc[item.urgency] = { total: 0, count: 0 };
      }
      acc[item.urgency].total += item.hours;
      acc[item.urgency].count += 1;
      return acc;
    },
    {} as Record<string, { total: number; count: number }>
  );

  const byUrgency = Object.entries(urgencyGroups).map(([urgency, data]) => ({
    urgency,
    avgHours: Math.round((data.total / data.count) * 10) / 10,
    count: data.count,
  }));

  return {
    avgHours:
      Math.round((hours.reduce((a, b) => a + b, 0) / hours.length) * 10) / 10,
    minHours: Math.min(...hours),
    maxHours: Math.max(...hours),
    medianHours: sortedHours[Math.floor(sortedHours.length / 2)],
    byUrgency,
  };
}

export async function getDailyActivity(
  scope: AnalyticsScope,
  days: number = 90,
  creatorId?: string
): Promise<DailyActivity[]> {
  const end = endOfDay(new Date());
  const start = startOfDay(subDays(new Date(), days));
  const creatorFilter = creatorId ? { creatorId } : {};

  // Get all uploads in the range grouped by day
  const uploads = await db.upload.findMany({
    where: {
      request: scopeRequests(scope),
      uploadedAt: { gte: start, lte: end },
      ...creatorFilter,
    },
    select: {
      uploadedAt: true,
    },
  });

  // Create a map of date strings to upload counts
  const uploadsByDate = new Map<string, number>();
  uploads.forEach((upload) => {
    if (upload.uploadedAt) {
      const dateStr = format(upload.uploadedAt, "yyyy-MM-dd");
      uploadsByDate.set(dateStr, (uploadsByDate.get(dateStr) || 0) + 1);
    }
  });

  // Find max uploads for level calculation
  const maxUploads = Math.max(...Array.from(uploadsByDate.values()), 1);

  // Generate activity data for each day
  const allDays = eachDayOfInterval({ start, end });

  return allDays.map((date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const uploadCount = uploadsByDate.get(dateStr) || 0;

    // Calculate activity level (0-4)
    let level: 0 | 1 | 2 | 3 | 4 = 0;
    if (uploadCount > 0) {
      const ratio = uploadCount / maxUploads;
      if (ratio <= 0.25) level = 1;
      else if (ratio <= 0.5) level = 2;
      else if (ratio <= 0.75) level = 3;
      else level = 4;
    }

    return {
      date,
      dateString: dateStr,
      uploads: uploadCount,
      level,
    };
  });
}

export async function getAnalyticsSummary(
  scope: AnalyticsScope,
  dateRangeParams: DateRangeParams,
  creatorId?: string
) {
  const [overview, statusBreakdown, weeklyActivity, leaderboard, dailyActivity] =
    await Promise.all([
      getOverviewStats(scope, dateRangeParams, creatorId),
      getRequestStatusBreakdown(scope, dateRangeParams, creatorId),
      getWeeklyActivity(scope, 8, creatorId),
      // Only show leaderboard when viewing all creators
      creatorId ? Promise.resolve([]) : getCreatorLeaderboard(scope, 5),
      getDailyActivity(scope, 90, creatorId),
    ]);

  return {
    overview,
    statusBreakdown,
    weeklyActivity,
    leaderboard,
    dailyActivity,
  };
}
