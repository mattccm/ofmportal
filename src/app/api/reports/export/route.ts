import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
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

type ReportType =
  | "creator_performance"
  | "content_delivery"
  | "request_summary"
  | "team_activity";

type DateRangePreset =
  | "this_week"
  | "this_month"
  | "this_quarter"
  | "this_year"
  | "custom";

interface ExportParams {
  reportType: ReportType;
  dateRange: DateRangePreset;
  startDate?: string;
  endDate?: string;
  format: "csv" | "pdf";
  creatorIds?: string[];
  teamMemberIds?: string[];
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

function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function arrayToCSV(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const headerLine = headers.map(escapeCSV).join(",");
  const dataLines = rows.map((row) => row.map(escapeCSV).join(","));
  return [headerLine, ...dataLines].join("\n");
}

async function generateCreatorPerformanceCSV(
  agencyId: string,
  start: Date,
  end: Date,
  creatorIds?: string[]
): Promise<string> {
  const whereClause: Record<string, unknown> = { agencyId };
  if (creatorIds && creatorIds.length > 0) {
    whereClause.id = { in: creatorIds };
  }

  const creators = await db.creator.findMany({
    where: whereClause,
    include: {
      uploads: {
        where: {
          uploadedAt: { gte: start, lte: end },
        },
        include: {
          request: {
            select: { createdAt: true },
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

  const headers = [
    "Creator Name",
    "Email",
    "Total Uploads",
    "Approved",
    "Rejected",
    "Pending",
    "Approval Rate (%)",
    "Avg Response (Hours)",
    "Total Requests",
    "Completed Requests",
    "Completion Rate (%)",
  ];

  const rows = creators.map((creator) => {
    const totalUploads = creator.uploads.length;
    const approvedUploads = creator.uploads.filter((u) => u.status === "APPROVED").length;
    const rejectedUploads = creator.uploads.filter((u) => u.status === "REJECTED").length;
    const pendingUploads = creator.uploads.filter((u) => u.status === "PENDING").length;
    const approvalRate = totalUploads > 0 ? (approvedUploads / totalUploads) * 100 : 0;

    const responseTimes = creator.uploads
      .filter((u) => u.uploadedAt && u.request.createdAt)
      .map((u) => differenceInHours(u.uploadedAt!, u.request.createdAt));

    const avgResponseHours =
      responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : 0;

    const totalRequests = creator.requests.length;
    const completedRequests = creator.requests.filter((r) => r.status === "APPROVED").length;
    const completionRate = totalRequests > 0 ? (completedRequests / totalRequests) * 100 : 0;

    return [
      creator.name,
      creator.email,
      totalUploads,
      approvedUploads,
      rejectedUploads,
      pendingUploads,
      Math.round(approvalRate * 10) / 10,
      Math.round(avgResponseHours * 10) / 10,
      totalRequests,
      completedRequests,
      Math.round(completionRate * 10) / 10,
    ];
  });

  return arrayToCSV(headers, rows);
}

async function generateContentDeliveryCSV(
  agencyId: string,
  start: Date,
  end: Date
): Promise<string> {
  const requests = await db.contentRequest.findMany({
    where: {
      agencyId,
      createdAt: { gte: start, lte: end },
    },
    include: {
      creator: {
        select: { name: true },
      },
      uploads: {
        select: { id: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const headers = [
    "Request Title",
    "Creator",
    "Status",
    "Urgency",
    "Created Date",
    "Due Date",
    "Completed Date",
    "Delivery Hours",
    "On Time",
    "Upload Count",
  ];

  const rows = requests.map((request) => {
    const deliveryHours = request.reviewedAt
      ? differenceInHours(request.reviewedAt, request.createdAt)
      : null;

    const isOnTime = request.dueDate
      ? request.reviewedAt
        ? request.reviewedAt <= request.dueDate
        : new Date() <= request.dueDate
      : null;

    return [
      request.title,
      request.creator.name,
      request.status,
      request.urgency,
      format(request.createdAt, "yyyy-MM-dd"),
      request.dueDate ? format(request.dueDate, "yyyy-MM-dd") : "N/A",
      request.reviewedAt ? format(request.reviewedAt, "yyyy-MM-dd") : "Pending",
      deliveryHours ?? "N/A",
      isOnTime === null ? "N/A" : isOnTime ? "Yes" : "No",
      request.uploads.length,
    ];
  });

  return arrayToCSV(headers, rows);
}

async function generateRequestSummaryCSV(
  agencyId: string,
  start: Date,
  end: Date
): Promise<string> {
  const requests = await db.contentRequest.findMany({
    where: {
      agencyId,
      createdAt: { gte: start, lte: end },
    },
    include: {
      creator: {
        select: { name: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const headers = [
    "Request ID",
    "Title",
    "Creator",
    "Status",
    "Urgency",
    "Created Date",
    "Due Date",
    "Submitted Date",
    "Reviewed Date",
  ];

  const rows = requests.map((r) => [
    r.id,
    r.title,
    r.creator.name,
    r.status,
    r.urgency,
    format(r.createdAt, "yyyy-MM-dd"),
    r.dueDate ? format(r.dueDate, "yyyy-MM-dd") : "N/A",
    r.submittedAt ? format(r.submittedAt, "yyyy-MM-dd") : "N/A",
    r.reviewedAt ? format(r.reviewedAt, "yyyy-MM-dd") : "N/A",
  ]);

  return arrayToCSV(headers, rows);
}

async function generateTeamActivityCSV(
  agencyId: string,
  start: Date,
  end: Date,
  teamMemberIds?: string[]
): Promise<string> {
  const whereClause: Record<string, unknown> = {
    user: { agencyId },
    createdAt: { gte: start, lte: end },
  };

  if (teamMemberIds && teamMemberIds.length > 0) {
    whereClause.userId = { in: teamMemberIds };
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

  const headers = [
    "Team Member",
    "Email",
    "Role",
    "Total Actions",
    "Uploads Reviewed",
    "Requests Created",
    "Comments Added",
    "Creators Invited",
  ];

  const rows = Array.from(userActivityMap.values()).map((entry) => [
    entry.user.name,
    entry.user.email,
    entry.user.role,
    entry.totalActions,
    (entry.actions["upload.approved"] || 0) + (entry.actions["upload.rejected"] || 0),
    entry.actions["request.created"] || 0,
    entry.actions["comment.created"] || 0,
    entry.actions["creator.invited"] || 0,
  ]);

  return arrayToCSV(headers, rows);
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const agencyId = session.user.agencyId;
    const body = (await request.json()) as ExportParams;

    const { reportType, dateRange, startDate, endDate, format: exportFormat, creatorIds, teamMemberIds } = body;

    if (!reportType) {
      return NextResponse.json({ error: "Report type is required" }, { status: 400 });
    }

    // PDF export is a placeholder
    if (exportFormat === "pdf") {
      return NextResponse.json(
        { error: "PDF export is coming soon. Please use CSV export for now." },
        { status: 501 }
      );
    }

    const { start, end } = getDateRangeFromPreset(dateRange, startDate, endDate);

    let csv: string;
    let filename: string;

    switch (reportType) {
      case "creator_performance":
        csv = await generateCreatorPerformanceCSV(agencyId, start, end, creatorIds);
        filename = `creator-performance-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
        break;
      case "content_delivery":
        csv = await generateContentDeliveryCSV(agencyId, start, end);
        filename = `content-delivery-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
        break;
      case "request_summary":
        csv = await generateRequestSummaryCSV(agencyId, start, end);
        filename = `request-summary-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
        break;
      case "team_activity":
        csv = await generateTeamActivityCSV(agencyId, start, end, teamMemberIds);
        filename = `team-activity-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
        break;
      default:
        return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
    }

    // Return CSV file
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Export API error:", error);
    return NextResponse.json({ error: "Failed to export report" }, { status: 500 });
  }
}
