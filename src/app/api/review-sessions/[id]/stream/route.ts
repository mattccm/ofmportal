// GET /api/review-sessions/[id]/stream - SSE endpoint for real-time updates

import { getReviewSessionUser } from "@/lib/review-session-auth";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { createSSEStream, sessionStore } from "@/lib/realtime-session";


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const reviewUser = await getReviewSessionUser();
    if (!reviewUser) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { agencyId } = reviewUser;

    // Verify session exists and user has access
    const session = await db.reviewSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return new Response("Session not found", { status: 404 });
    }

    if (session.agencyId !== agencyId) {
      return new Response("Access denied", { status: 403 });
    }

    if (session.status !== "ACTIVE" && session.status !== "PAUSED") {
      return new Response("Session is no longer active", { status: 400 });
    }

    // Create SSE stream
    const stream = createSSEStream(sessionId);

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no", // For nginx proxy
      },
    });
  } catch (error) {
    console.error("Error creating SSE stream:", error);
    return new Response("Internal server error", { status: 500 });
  }
}

// Polling fallback endpoint
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const reviewUser = await getReviewSessionUser();
    if (!reviewUser) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { agencyId } = reviewUser;

    // Verify session exists and user has access
    const session = await db.reviewSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (session.agencyId !== agencyId) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get current state from store
    const state = sessionStore.getSession(sessionId);

    return new Response(
      JSON.stringify({
        state,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in polling endpoint:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
