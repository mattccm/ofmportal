import { NextRequest, NextResponse } from "next/server";
import { requireAccess, redactCreator } from "@/lib/access/server";
import {
  getOverviewStats,
  getRequestStatusBreakdown,
  getWeeklyActivity,
  getCreatorLeaderboard,
  getApprovalMetrics,
  getTurnaroundMetrics,
  getDailyActivity,
  getAnalyticsSummary,
  type DateRange,
  type DateRangeParams,
} from "@/lib/analytics";

export async function GET(request: NextRequest) {
  try {
    const gate = await requireAccess("analytics.view");
    if (gate.error) return gate.error;
    const { access } = gate;
    // Every count is limited to the creators this person may see
    const scope = access;
    const searchParams = request.nextUrl.searchParams;

    // Parse date range parameters
    const range = (searchParams.get("range") as DateRange) || "30d";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const type = searchParams.get("type") || "summary";

    const dateRangeParams: DateRangeParams = {
      range,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    };

    // Handle different analytics types
    switch (type) {
      case "summary": {
        // Get all analytics data in one call
        const data = await getAnalyticsSummary(scope, dateRangeParams);
        return NextResponse.json({ ...data, leaderboard: redactCreator(access, data.leaderboard) });
      }

      case "overview": {
        const data = await getOverviewStats(scope, dateRangeParams);
        return NextResponse.json(data);
      }

      case "status-breakdown": {
        const data = await getRequestStatusBreakdown(scope, dateRangeParams);
        return NextResponse.json(data);
      }

      case "weekly-activity": {
        const weeks = parseInt(searchParams.get("weeks") || "8", 10);
        const data = await getWeeklyActivity(scope, weeks);
        return NextResponse.json(data);
      }

      case "leaderboard": {
        const limit = parseInt(searchParams.get("limit") || "10", 10);
        const data = await getCreatorLeaderboard(scope, limit);
        return NextResponse.json(redactCreator(access, data));
      }

      case "approval-metrics": {
        const data = await getApprovalMetrics(scope, dateRangeParams);
        return NextResponse.json(data);
      }

      case "turnaround-metrics": {
        const data = await getTurnaroundMetrics(scope, dateRangeParams);
        return NextResponse.json(data);
      }

      case "daily-activity": {
        const days = parseInt(searchParams.get("days") || "90", 10);
        const data = await getDailyActivity(scope, days);
        return NextResponse.json(data);
      }

      default:
        return NextResponse.json(
          { error: "Invalid analytics type" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Analytics API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics data" },
      { status: 500 }
    );
  }
}

// POST endpoint for custom date range queries
export async function POST(request: NextRequest) {
  try {
    const gate = await requireAccess("analytics.view");
    if (gate.error) return gate.error;
    const { access } = gate;
    // Every count is limited to the creators this person may see
    const scope = access;
    const body = await request.json();

    const { types, dateRange } = body as {
      types: string[];
      dateRange: DateRangeParams;
    };

    if (!Array.isArray(types) || types.length === 0) {
      return NextResponse.json(
        { error: "No analytics types specified" },
        { status: 400 }
      );
    }

    const results: Record<string, unknown> = {};

    // Fetch requested analytics types in parallel
    const promises = types.map(async (type) => {
      switch (type) {
        case "overview":
          results.overview = await getOverviewStats(scope, dateRange);
          break;
        case "status-breakdown":
          results.statusBreakdown = await getRequestStatusBreakdown(scope, dateRange);
          break;
        case "weekly-activity":
          results.weeklyActivity = await getWeeklyActivity(scope, 8);
          break;
        case "leaderboard":
          results.leaderboard = redactCreator(access, await getCreatorLeaderboard(scope, 10));
          break;
        case "approval-metrics":
          results.approvalMetrics = await getApprovalMetrics(scope, dateRange);
          break;
        case "turnaround-metrics":
          results.turnaroundMetrics = await getTurnaroundMetrics(scope, dateRange);
          break;
        case "daily-activity":
          results.dailyActivity = await getDailyActivity(scope, 90);
          break;
      }
    });

    await Promise.all(promises);

    return NextResponse.json(results);
  } catch (error) {
    console.error("Analytics API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics data" },
      { status: 500 }
    );
  }
}
