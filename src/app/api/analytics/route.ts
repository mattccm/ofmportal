import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const agencyId = session.user.agencyId;
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
        const data = await getAnalyticsSummary(agencyId, dateRangeParams);
        return NextResponse.json(data);
      }

      case "overview": {
        const data = await getOverviewStats(agencyId, dateRangeParams);
        return NextResponse.json(data);
      }

      case "status-breakdown": {
        const data = await getRequestStatusBreakdown(agencyId, dateRangeParams);
        return NextResponse.json(data);
      }

      case "weekly-activity": {
        const weeks = parseInt(searchParams.get("weeks") || "8", 10);
        const data = await getWeeklyActivity(agencyId, weeks);
        return NextResponse.json(data);
      }

      case "leaderboard": {
        const limit = parseInt(searchParams.get("limit") || "10", 10);
        const data = await getCreatorLeaderboard(agencyId, limit);
        return NextResponse.json(data);
      }

      case "approval-metrics": {
        const data = await getApprovalMetrics(agencyId, dateRangeParams);
        return NextResponse.json(data);
      }

      case "turnaround-metrics": {
        const data = await getTurnaroundMetrics(agencyId, dateRangeParams);
        return NextResponse.json(data);
      }

      case "daily-activity": {
        const days = parseInt(searchParams.get("days") || "90", 10);
        const data = await getDailyActivity(agencyId, days);
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
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const agencyId = session.user.agencyId;
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
          results.overview = await getOverviewStats(agencyId, dateRange);
          break;
        case "status-breakdown":
          results.statusBreakdown = await getRequestStatusBreakdown(agencyId, dateRange);
          break;
        case "weekly-activity":
          results.weeklyActivity = await getWeeklyActivity(agencyId, 8);
          break;
        case "leaderboard":
          results.leaderboard = await getCreatorLeaderboard(agencyId, 10);
          break;
        case "approval-metrics":
          results.approvalMetrics = await getApprovalMetrics(agencyId, dateRange);
          break;
        case "turnaround-metrics":
          results.turnaroundMetrics = await getTurnaroundMetrics(agencyId, dateRange);
          break;
        case "daily-activity":
          results.dailyActivity = await getDailyActivity(agencyId, 90);
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
