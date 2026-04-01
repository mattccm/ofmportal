// POST /api/review-sessions/[id]/vote - Cast a vote

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  sessionStore,
  emitVoteCast,
  calculateVoteSummary,
} from "@/lib/realtime-session";
import { VoteRequest, VoteResponse, ReviewVoteType } from "@/types/review-session";

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
    const body: VoteRequest = await request.json();

    // Validate vote type
    const validVotes: ReviewVoteType[] = ["APPROVE", "REJECT", "DISCUSS", "SKIP"];
    if (!validVotes.includes(body.vote)) {
      return NextResponse.json(
        { error: "Invalid vote type" },
        { status: 400 }
      );
    }

    if (!body.uploadId) {
      return NextResponse.json(
        { error: "Upload ID is required" },
        { status: 400 }
      );
    }

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

    if (session.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Session is not active" },
        { status: 400 }
      );
    }

    // Verify user is a participant
    const participant = await db.reviewSessionParticipant.findUnique({
      where: {
        sessionId_userId: { sessionId, userId },
      },
    });

    if (!participant || !participant.isActive) {
      return NextResponse.json(
        { error: "You must join the session first" },
        { status: 403 }
      );
    }

    if (participant.role === "OBSERVER") {
      return NextResponse.json(
        { error: "Observers cannot vote" },
        { status: 403 }
      );
    }

    // Verify upload is in session
    const uploadIds = session.uploadIds as string[];
    if (!uploadIds.includes(body.uploadId)) {
      return NextResponse.json(
        { error: "Upload is not part of this session" },
        { status: 400 }
      );
    }

    // Get user info
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, avatar: true },
    });

    // Upsert vote (one vote per user per upload per session)
    const vote = await db.reviewSessionVote.upsert({
      where: {
        sessionId_uploadId_userId: {
          sessionId,
          uploadId: body.uploadId,
          userId,
        },
      },
      update: {
        vote: body.vote,
        note: body.note || null,
        votedAt: new Date(),
      },
      create: {
        sessionId,
        uploadId: body.uploadId,
        userId,
        vote: body.vote,
        note: body.note || null,
      },
    });

    // Update participant vote count
    await db.reviewSessionParticipant.update({
      where: { id: participant.id },
      data: {
        votesCount: { increment: 1 },
      },
    });

    const voteWithUser = {
      ...vote,
      user: user || { id: userId, name: "Unknown", avatar: null },
    };

    // Get all votes for this upload to calculate summary
    const allVotes = await db.reviewSessionVote.findMany({
      where: { sessionId, uploadId: body.uploadId },
    });

    const votesWithUsers = await Promise.all(
      allVotes.map(async (v) => {
        const vUser = await db.user.findUnique({
          where: { id: v.userId },
          select: { id: true, name: true, avatar: true },
        });
        return {
          ...v,
          user: vUser || { id: v.userId, name: "Unknown", avatar: null },
        };
      })
    );

    const summary = calculateVoteSummary(votesWithUsers, body.uploadId);

    // Update in-memory state
    const state = sessionStore.getSession(sessionId);
    if (state) {
      // Update votes in state
      const updatedVotes = [...state.votes];
      const existingIndex = updatedVotes.findIndex(
        (v) => v.uploadId === body.uploadId && v.userId === userId
      );
      if (existingIndex >= 0) {
        updatedVotes[existingIndex] = voteWithUser;
      } else {
        updatedVotes.push(voteWithUser);
      }

      sessionStore.updateSession(sessionId, {
        votes: updatedVotes,
        voteSummary: summary,
      });

      // Broadcast vote event
      emitVoteCast(sessionId, voteWithUser, summary);
    }

    const response: VoteResponse = {
      vote: voteWithUser,
      summary,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error casting vote:", error);
    return NextResponse.json(
      { error: "Failed to cast vote" },
      { status: 500 }
    );
  }
}
