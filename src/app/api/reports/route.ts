import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  activityWhere,
  creatorWhere,
  redactCreator,
  requestWhere,
  requireAccess,
  staffWhere,
  type Access,
} from "@/lib/access/server";
import {
  startOfDay,
  endOfDay,
  subDays,
  startOfWeek,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  differenceInHours,
  format,
} from "date-fns";

export type ReportType =
  | "creator_performance"
  | "content_delivery"
  | "request_summary"
  | "team_activity";

export type DateRangePreset =
  | "this_week"
  | "this_month"
  | "this_quarter"
  | "this_year"
  | "custom";

export type GroupBy = "day" | "week" | "month";

export interface ReportFilters {
  creatorIds?: string[];
  teamMemberIds?: string[];
  requestTypes?: string[];
}

export interface ReportParams {
  reportType: ReportType;
  dateRange: DateRangePreset;
  startDate?: string;
  endDate?: string;
  groupBy: GroupBy;
  filters?: ReportFilters;
}

function getDateRangeFromPreset(
  preset: DateRangePreset,
  customStart?: string,
  customEnd?: string
): { start: Date; end: Date } {
  const now = new Date();
  const end = endOfDay(now);

  switch (preset) {
    case "this_week":
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end };
    case "this_month":
      return { start: startOfMonth(now), end };
    case "this_quarter":
      return { start: startOfQuarter(now), end };
    case "this_year":
      return { start: startOfYear(now), end };
    case "custom":
      return {
        start: customStart ? startOfDay(new Date(customStart)) : subDays(now, 30),
        end: customEnd ? endOfDay(new Date(customEnd)) : end,
      };
    default:
      return { start: startOfDay(subDays(now, 30)), end };
  }
}

// Creator Performance Report
async function generateCreatorPerformanceReport(
  access: Access,
  start: Date,
  end: Date,
  filters?: ReportFilters
) {
  // Only creators inside this person's creator scope
  const creators = await db.creator.findMany({
    where: {
      AND: [
        creatorWhere(access),
        filters?.creatorIds && filters.creatorIds.length > 0 ? { id: { in: filters.creatorIds } } : {},
      ],
    },
    include: {
      uploads: {
        where: {
          uploadedAt: { gte: start, lte: end },
        },
        include: {
          request: {
            select: {
              createdAt: true,
              urgency: true,
            },
          },
        },
      },
      requests: {
        where: {
          createdAt: { gte: start, lte: end },
        },
      },
    },
  });

  const rows = creators.map((creator) => {
    const totalUploads = creator.uploads.length;
    const approvedUploads = creator.uploads.filter((u) => u.status === "APPROVED").length;
    const rejectedUploads = creator.uploads.filter((u) => u.status === "REJECTED").length;
    const pendingUploads = creator.uploads.filter((u) => u.status === "PENDING").length;

    const approvalRate = totalUploads > 0 ? (approvedUploads / totalUploads) * 100 : 0;

    // Calculate average response time
    const responseTimes = creator.uploads
      .filter((u) => u.uploadedAt && u.request.createdAt)
      .map((u) => differenceInHours(u.uploadedAt!, u.request.createdAt));

    const avgResponseHours =
      responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : 0;

    const totalRequests = creator.requests.length;
    const completedRequests = creator.requests.filter((r) => r.status === "APPROVED").length;

    return {
      id: creator.id,
      name: creator.name,
      email: creator.email,
      totalUploads,
      approvedUploads,
      rejectedUploads,
      pendingUploads,
      approvalRate: Math.round(approvalRate * 10) / 10,
      avgResponseHours: Math.round(avgResponseHours * 10) / 10,
      totalRequests,
      completedRequests,
      completionRate:
        totalRequests > 0
          ? Math.round((completedRequests / totalRequests) * 1000) / 10
          : 0,
    };
  });

  // Each row is a creator: drop the creator fields this role can't see (email)
  const reportData = redactCreator(access, rows);

  // Calculate summary metrics (averages only over creators with uploads in range)
  const active = reportData.filter((c) => c.totalUploads > 0);
  const summary = {
    totalCreators: reportData.length,
    totalUploads: reportData.reduce((acc, c) => acc + c.totalUploads, 0),
    avgApprovalRate:
      active.length > 0
        ? Math.round(
            (active.reduce((acc, c) => acc + c.approvalRate, 0) / active.length) * 10
          ) / 10
        : 0,
    avgResponseHours:
      active.length > 0
        ? Math.round(
            (active.reduce((acc, c) => acc + c.avgResponseHours, 0) / active.length) * 10
          ) / 10
        : 0,
    topPerformer: [...active].sort((a, b) => b.approvalRate - a.approvalRate)[0]?.name || "N/A",
  };

  return { data: reportData, summary };
}

// A request is only delivered once approved/archived; reviewedAt is also set on NEEDS_REVISION
const isCompleted = (r: { status: string; reviewedAt: Date | null }) =>
  !!r.reviewedAt && (r.status === "APPROVED" || r.status === "ARCHIVED");

// Content Delivery Report
async function generateContentDeliveryReport(
  access: Access,
  start: Date,
  end: Date,
  groupBy: GroupBy
) {
  const requests = await db.contentRequest.findMany({
    where: {
      ...requestWhere(access),
      createdAt: { gte: start, lte: end },
    },
    include: {
      creator: {
        select: { name: true },
      },
      uploads: {
        select: {
          uploadedAt: true,
          status: true,
        },
      },
    },
  });

  const reportData = requests.map((request) => {
    const completedAt = isCompleted(request) ? request.reviewedAt : null;
    const deliveryHours = completedAt
      ? differenceInHours(completedAt, request.createdAt)
      : null;

    const isOnTime = request.dueDate
      ? completedAt
        ? completedAt <= request.dueDate
        : new Date() <= request.dueDate
      : null;

    return {
      id: request.id,
      title: request.title,
      creator: request.creator.name,
      status: request.status,
      urgency: request.urgency,
      createdAt: format(request.createdAt, "yyyy-MM-dd"),
      dueDate: request.dueDate ? format(request.dueDate, "yyyy-MM-dd") : "N/A",
      completedAt: completedAt ? format(completedAt, "yyyy-MM-dd") : "Pending",
      deliveryHours: deliveryHours ?? "N/A",
      isOnTime: isOnTime === null ? "N/A" : isOnTime ? "Yes" : "No",
      uploadCount: request.uploads.length,
    };
  });

  // Calculate delivery metrics
  const completedRequests = requests.filter(isCompleted);
  const onTimeDeliveries = completedRequests.filter(
    (r) => r.dueDate && r.reviewedAt && r.reviewedAt <= r.dueDate
  );

  const deliveryTimes = completedRequests.map((r) =>
    differenceInHours(r.reviewedAt!, r.createdAt)
  );

  const summary = {
    totalRequests: requests.length,
    completedRequests: completedRequests.length,
    completionRate:
      requests.length > 0
        ? Math.round((completedRequests.length / requests.length) * 1000) / 10
        : 0,
    onTimeRate:
      completedRequests.length > 0
        ? Math.round((onTimeDeliveries.length / completedRequests.length) * 1000) / 10
        : 0,
    avgDeliveryHours:
      deliveryTimes.length > 0
        ? Math.round((deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length) * 10) / 10
        : 0,
    fastestDelivery: deliveryTimes.length > 0 ? Math.min(...deliveryTimes) : 0,
    slowestDelivery: deliveryTimes.length > 0 ? Math.max(...deliveryTimes) : 0,
  };

  return { data: reportData, summary };
}

// Request Summary Report
async function generateRequestSummaryReport(
  access: Access,
  start: Date,
  end: Date,
  groupBy: GroupBy
) {
  const requests = await db.contentRequest.findMany({
    where: {
      ...requestWhere(access),
      createdAt: { gte: start, lte: end },
    },
    include: {
      creator: {
        select: { name: true },
      },
    },
  });

  // Group by status
  const byStatus = requests.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Group by urgency
  const byUrgency = requests.reduce(
    (acc, r) => {
      acc[r.urgency] = (acc[r.urgency] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Group by time period
  const formatKey = groupBy === "day" ? "yyyy-MM-dd" : groupBy === "week" ? "RRRR-'W'II" : "yyyy-MM";
  const byPeriod = requests.reduce(
    (acc, r) => {
      const key = format(r.createdAt, formatKey);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Detailed data
  const reportData = requests.map((r) => ({
    id: r.id,
    title: r.title,
    creator: r.creator.name,
    status: r.status,
    urgency: r.urgency,
    createdAt: format(r.createdAt, "yyyy-MM-dd"),
    dueDate: r.dueDate ? format(r.dueDate, "yyyy-MM-dd") : "N/A",
    period: format(r.createdAt, formatKey),
  }));

  const summary = {
    totalRequests: requests.length,
    byStatus: Object.entries(byStatus).map(([status, count]) => ({
      status,
      count,
      percentage: Math.round((count / requests.length) * 1000) / 10,
    })),
    byUrgency: Object.entries(byUrgency).map(([urgency, count]) => ({
      urgency,
      count,
      percentage: Math.round((count / requests.length) * 1000) / 10,
    })),
    byPeriod: Object.entries(byPeriod)
      .map(([period, count]) => ({ period, count }))
      .sort((a, b) => a.period.localeCompare(b.period)),
  };

  return { data: reportData, summary };
}

// Team Activity Report
async function generateTeamActivityReport(
  access: Access,
  start: Date,
  end: Date,
  filters?: ReportFilters
) {
  const whereClause: Record<string, unknown> = {
    // Only teammates inside this person's team scope
    ...activityWhere(access),
    createdAt: { gte: start, lte: end },
  };

  if (filters?.teamMemberIds && filters.teamMemberIds.length > 0) {
    whereClause.userId = { in: filters.teamMemberIds };
  }

  const activityLogs = await db.activityLog.findMany({
    where: whereClause,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Group activities by user
  const userActivityMap = new Map<
    string,
    {
      user: { id: string; name: string; email: string; role: string };
      actions: Record<string, number>;
      totalActions: number;
    }
  >();

  activityLogs.forEach((log) => {
    if (!log.user) return;

    const existing = userActivityMap.get(log.user.id);
    if (existing) {
      existing.actions[log.action] = (existing.actions[log.action] || 0) + 1;
      existing.totalActions++;
    } else {
      userActivityMap.set(log.user.id, {
        user: log.user,
        actions: { [log.action]: 1 },
        totalActions: 1,
      });
    }
  });

  const reportData = Array.from(userActivityMap.values()).map((entry) => ({
    id: entry.user.id,
    name: entry.user.name,
    email: entry.user.email,
    role: entry.user.role,
    totalActions: entry.totalActions,
    uploadsReviewed: (entry.actions["upload.approved"] || 0) + (entry.actions["upload.rejected"] || 0),
    requestsCreated: entry.actions["request.created"] || 0,
    commentsAdded: entry.actions["comment.created"] || 0,
    creatorsInvited: entry.actions["creator.invited"] || 0,
  }));

  // Sort by total actions
  reportData.sort((a, b) => b.totalActions - a.totalActions);

  // Calculate summary
  const summary = {
    totalTeamMembers: reportData.length,
    totalActions: reportData.reduce((acc, u) => acc + u.totalActions, 0),
    avgActionsPerMember:
      reportData.length > 0
        ? Math.round(
            (reportData.reduce((acc, u) => acc + u.totalActions, 0) / reportData.length) * 10
          ) / 10
        : 0,
    mostActiveUser: reportData[0]?.name || "N/A",
    topActions: activityLogs.reduce(
      (acc, log) => {
        acc[log.action] = (acc[log.action] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    ),
  };

  return { data: reportData, summary };
}

export async function POST(request: NextRequest) {
  try {
    const gate = await requireAccess("reports.view");
    if (gate.error) return gate.error;
    const { access } = gate;
    const body = (await request.json()) as ReportParams;

    const { reportType, dateRange, startDate, endDate, groupBy, filters } = body;

    if (!reportType) {
      return NextResponse.json({ error: "Report type is required" }, { status: 400 });
    }

    const { start, end } = getDateRangeFromPreset(dateRange, startDate, endDate);

    let result;

    switch (reportType) {
      case "creator_performance":
        result = await generateCreatorPerformanceReport(access, start, end, filters);
        break;
      case "content_delivery":
        result = await generateContentDeliveryReport(access, start, end, groupBy);
        break;
      case "request_summary":
        result = await generateRequestSummaryReport(access, start, end, groupBy);
        break;
      case "team_activity":
        result = await generateTeamActivityReport(access, start, end, filters);
        break;
      default:
        return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
    }

    return NextResponse.json({
      ...result,
      meta: {
        reportType,
        dateRange: {
          preset: dateRange,
          start: format(start, "yyyy-MM-dd"),
          end: format(end, "yyyy-MM-dd"),
        },
        groupBy,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Reports API error:", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}

// GET endpoint for fetching available filter options
export async function GET(request: NextRequest) {
  try {
    const gate = await requireAccess("reports.view");
    if (gate.error) return gate.error;
    const { access } = gate;

    // Get creators for filter dropdown (only those in scope, fields redacted)
    const scoped = await db.creator.findMany({
      where: creatorWhere(access),
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    });

    const creators = redactCreator(access, scoped);

    // Get team members for filter dropdown (only those in team scope)
    const teamMembers = await db.user.findMany({
      where: staffWhere(access),
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      creators,
      teamMembers,
      reportTypes: [
        { value: "creator_performance", label: "Creator Performance Report" },
        { value: "content_delivery", label: "Content Delivery Report" },
        { value: "request_summary", label: "Request Summary Report" },
        { value: "team_activity", label: "Team Activity Report" },
      ],
      dateRangePresets: [
        { value: "this_week", label: "This Week" },
        { value: "this_month", label: "This Month" },
        { value: "this_quarter", label: "This Quarter" },
        { value: "this_year", label: "This Year" },
        { value: "custom", label: "Custom Range" },
      ],
      groupByOptions: [
        { value: "day", label: "Day" },
        { value: "week", label: "Week" },
        { value: "month", label: "Month" },
      ],
    });
  } catch (error) {
    console.error("Reports API error:", error);
    return NextResponse.json({ error: "Failed to fetch report options" }, { status: 500 });
  }
}
