// POST /api/review-sessions/[id]/leave - Leave a review session

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  sessionStore,
  emitParticipantLeft,
} from "@/lib/realtime-session";

// Mock auth helper - replace with real auth in production
async function getCurrentUser(request: NextRequest) {
  const userId = request.headers.get("x-user-id") || "user_demo";
  const agencyId = request.headers.get("x-agency-id") || "agency_demo";
  return { userId, agencyId };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const { userId, agencyId } = await getCurrentUser(request);

    // Get session
    const session = await db.reviewSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    if (session.agencyId !== agencyId) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Find participant
    const participant = await db.reviewSessionParticipant.findUnique({
      where: {
        sessionId_userId: { sessionId, userId },
      },
    });

    if (!participant) {
      return NextResponse.json(
        { error: "Not a participant" },
        { status: 400 }
      );
    }

    // Update participant as inactive
    await db.reviewSessionParticipant.update({
      where: { id: participant.id },
      data: {
        isActive: false,
        leftAt: new Date(),
      },
    });

    // Update in-memory state
    const state = sessionStore.getSession(sessionId);
    if (state) {
      const updatedParticipants = state.participants.map((p) =>
        p.userId === userId
          ? { ...p, isActive: false, leftAt: new Date() }
          : p
      );
      sessionStore.updateSession(sessionId, { participants: updatedParticipants });

      // Broadcast leave event
      emitParticipantLeft(sessionId, userId);
    }

    // If host leaves, check if session should end
    if (session.hostUserId === userId && session.status === "ACTIVE") {
      // Check for other active participants
      const activeParticipants = await db.reviewSessionParticipant.count({
        where: {
          sessionId,
          isActive: true,
          userId: { not: userId },
        },
      });

      // If no other participants, mark session as completed
      if (activeParticipants === 0) {
        await db.reviewSession.update({
          where: { id: sessionId },
          data: {
            status: "COMPLETED",
            endedAt: new Date(),
          },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error leaving session:", error);
    return NextResponse.json(
      { error: "Failed to leave session" },
      { status: 500 }
    );
  }
}
