import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAccess, requestWhere } from "@/lib/access/server";

/**
 * GET /api/requests/[id]/views
 * Get view status for a specific request
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAccess("requests.view");
    if (gate.error) return gate.error;
    const { access } = gate;

    const { id } = await params;

    // Get the request with view tracking data
    const request = await db.contentRequest.findFirst({
      where: { AND: [requestWhere(access), { id }] },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!request) {
      return NextResponse.json(
        { error: "Request not found" },
        { status: 404 }
      );
    }

    // Access view fields dynamically since they may not exist in schema yet
    const requestAny = request as Record<string, unknown>;
    const hasViewTracking = "viewedAt" in requestAny;

    if (!hasViewTracking) {
      return NextResponse.json({
        requestId: request.id,
        viewedAt: null,
        viewedByCreator: false,
        viewCount: 0,
        lastViewedAt: null,
        viewedBy: null,
        viewTrackingAvailable: false,
      });
    }

    return NextResponse.json({
      requestId: request.id,
      viewedAt: requestAny.viewedAt,
      viewedByCreator: requestAny.viewedByCreator,
      viewCount: requestAny.viewCount,
      lastViewedAt: requestAny.lastViewedAt,
      viewedBy: requestAny.viewedByCreator
        ? {
            id: request.creator.id,
            name: request.creator.name,
            ...(access.has("creatorInfo.email") ? { email: request.creator.email } : {}),
          }
        : null,
      viewTrackingAvailable: true,
    });
  } catch (error) {
    console.error("Error fetching request views:", error);
    return NextResponse.json(
      { error: "Failed to fetch request views" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/requests/[id]/views
 * Manually record a view (for internal tracking by agency users)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAccess("requests.view");
    if (gate.error) return gate.error;
    const { access } = gate;

    const { id } = await params;

    // Verify request exists and user has access
    const request = await db.contentRequest.findFirst({
      where: { AND: [requestWhere(access), { id }] },
    });

    if (!request) {
      return NextResponse.json(
        { error: "Request not found" },
        { status: 404 }
      );
    }

    // Access view fields dynamically
    const requestAny = request as Record<string, unknown>;
    const hasViewTracking = "viewedAt" in requestAny;

    // This endpoint is for agency-side tracking (not creator views)
    return NextResponse.json({
      success: true,
      requestId: id,
      viewedAt: hasViewTracking ? requestAny.viewedAt : null,
      viewedByCreator: hasViewTracking ? requestAny.viewedByCreator : false,
      viewCount: hasViewTracking ? requestAny.viewCount : 0,
      lastViewedAt: hasViewTracking ? requestAny.lastViewedAt : null,
      viewTrackingAvailable: hasViewTracking,
    });
  } catch (error) {
    console.error("Error recording view:", error);
    return NextResponse.json(
      { error: "Failed to record view" },
      { status: 500 }
    );
  }
}
