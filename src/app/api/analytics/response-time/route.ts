import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getResponseTimeMetrics,
  getSLAComplianceMetrics,
  getResponseTimeByCreator,
  getResponseTimeByRequestType,
  getResponseTimeTrends,
  getResponseTimeAnalytics,
  calculateSLAStatus,
  urgencyToPriority,
  type SLAType,
} from "@/lib/response-time";
import { db } from "@/lib/db";
import type { DateRange, DateRangeParams } from "@/lib/analytics";

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
    const type = searchParams.get("type") || "full";

    const dateRangeParams: DateRangeParams = {
      range,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    };

    // Handle different response time analytics types
    switch (type) {
      case "full": {
        // Get all response time analytics in one call
        const data = await getResponseTimeAnalytics(agencyId, dateRangeParams);
        return NextResponse.json(data);
      }

      case "metrics": {
        const data = await getResponseTimeMetrics(agencyId, dateRangeParams);
        return NextResponse.json(data);
      }

      case "sla-compliance": {
        const data = await getSLAComplianceMetrics(agencyId, dateRangeParams);
        return NextResponse.json(data);
      }

      case "by-creator": {
        const data = await getResponseTimeByCreator(agencyId, dateRangeParams);
        return NextResponse.json(data);
      }

      case "by-request-type": {
        const data = await getResponseTimeByRequestType(agencyId, dateRangeParams);
        return NextResponse.json(data);
      }

      case "trends": {
        const data = await getResponseTimeTrends(agencyId, dateRangeParams);
        return NextResponse.json(data);
      }

      case "pending-sla": {
        // Get requests with pending SLA status
        const pendingRequests = await db.contentRequest.findMany({
          where: {
            agencyId,
            status: {
              in: ["PENDING", "IN_PROGRESS", "SUBMITTED", "UNDER_REVIEW"],
            },
          },
          select: {
            id: true,
            title: true,
            createdAt: true,
            urgency: true,
            status: true,
            uploads: {
              select: {
                uploadedAt: true,
              },
              orderBy: {
                uploadedAt: "asc",
              },
              take: 1,
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        });

        const pendingSLA = pendingRequests.map((request) => {
          const priority = urgencyToPriority(request.urgency);
          const hasFirstResponse = request.uploads.length > 0 && request.uploads[0].uploadedAt;

          // Calculate SLA status for first response or completion
          const slaType: SLAType = hasFirstResponse ? "completion" : "firstResponse";
          const responseDate = hasFirstResponse ? request.uploads[0].uploadedAt : null;

          const slaStatus = calculateSLAStatus(
            request.createdAt,
            responseDate,
            priority,
            slaType
          );

          return {
            id: request.id,
            title: request.title,
            status: request.status,
            priority: request.urgency,
            createdAt: request.createdAt,
            slaType,
            slaStatus,
          };
        });

        // Sort by SLA status urgency and time remaining
        pendingSLA.sort((a, b) => {
          const statusOrder = { breached: 0, at_risk: 1, met: 2 };
          const statusDiff = statusOrder[a.slaStatus.status] - statusOrder[b.slaStatus.status];
          if (statusDiff !== 0) return statusDiff;
          return a.slaStatus.hoursRemaining - b.slaStatus.hoursRemaining;
        });

        return NextResponse.json(pendingSLA);
      }

      case "request-sla": {
        // Get SLA status for a specific request
        const requestId = searchParams.get("requestId");
        if (!requestId) {
          return NextResponse.json(
            { error: "Request ID required" },
            { status: 400 }
          );
        }

        const contentRequest = await db.contentRequest.findUnique({
          where: { id: requestId },
          select: {
            id: true,
            title: true,
            createdAt: true,
            reviewedAt: true,
            urgency: true,
            status: true,
            agencyId: true,
            uploads: {
              select: {
                uploadedAt: true,
              },
              orderBy: {
                uploadedAt: "asc",
              },
              take: 1,
            },
          },
        });

        if (!contentRequest) {
          return NextResponse.json(
            { error: "Request not found" },
            { status: 404 }
          );
        }

        if (contentRequest.agencyId !== agencyId) {
          return NextResponse.json(
            { error: "Unauthorized" },
            { status: 403 }
          );
        }

        const priority = urgencyToPriority(contentRequest.urgency);
        const firstUpload = contentRequest.uploads[0]?.uploadedAt || null;

        const firstResponseSLA = calculateSLAStatus(
          contentRequest.createdAt,
          firstUpload,
          priority,
          "firstResponse"
        );

        const completionSLA = calculateSLAStatus(
          contentRequest.createdAt,
          contentRequest.reviewedAt,
          priority,
          "completion"
        );

        return NextResponse.json({
          requestId: contentRequest.id,
          title: contentRequest.title,
          priority: contentRequest.urgency,
          status: contentRequest.status,
          createdAt: contentRequest.createdAt,
          firstResponseAt: firstUpload,
          completedAt: contentRequest.reviewedAt,
          firstResponseSLA,
          completionSLA,
        });
      }

      default:
        return NextResponse.json(
          { error: "Invalid response time analytics type" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Response Time Analytics API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch response time analytics" },
      { status: 500 }
    );
  }
}

// POST endpoint for custom queries
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
        case "metrics":
          results.metrics = await getResponseTimeMetrics(agencyId, dateRange);
          break;
        case "sla-compliance":
          results.slaCompliance = await getSLAComplianceMetrics(agencyId, dateRange);
          break;
        case "by-creator":
          results.byCreator = await getResponseTimeByCreator(agencyId, dateRange);
          break;
        case "by-request-type":
          results.byRequestType = await getResponseTimeByRequestType(agencyId, dateRange);
          break;
        case "trends":
          results.trends = await getResponseTimeTrends(agencyId, dateRange);
          break;
      }
    });

    await Promise.all(promises);

    return NextResponse.json(results);
  } catch (error) {
    console.error("Response Time Analytics API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch response time analytics" },
      { status: 500 }
    );
  }
}
