// POST /api/review-sessions/[id]/end - End the review session

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  sessionStore,
  emitSessionEnded,
  generateSessionSummary,
} from "@/lib/realtime-session";
import { EndSessionRequest, ReviewUploadInfo } from "@/types/review-session";

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
    const body: EndSessionRequest = await request.json().catch(() => ({}));

    // Get session with all related data
    const session = await db.reviewSession.findUnique({
      where: { id: sessionId },
      include: {
        participants: true,
        votes: true,
        chatMessages: true,
      },
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

    // Only host can end the session
    if (session.hostUserId !== userId) {
      return NextResponse.json(
        { error: "Only the host can end the session" },
        { status: 403 }
      );
    }

    if (session.status !== "ACTIVE" && session.status !== "PAUSED") {
      return NextResponse.json(
        { error: "Session has already ended" },
        { status: 400 }
      );
    }

    const endStatus = body.status || "COMPLETED";
    const endedAt = new Date();

    // Update session
    await db.reviewSession.update({
      where: { id: sessionId },
      data: {
        status: endStatus,
        endedAt,
      },
    });

    // Mark all participants as left
    await db.reviewSessionParticipant.updateMany({
      where: {
        sessionId,
        isActive: true,
      },
      data: {
        isActive: false,
        leftAt: endedAt,
      },
    });

    // Fetch user info for summary
    const userIds = [
      ...new Set([
        ...session.participants.map((p) => p.userId),
        ...session.votes.map((v) => v.userId),
        ...session.chatMessages.map((m) => m.userId),
      ]),
    ];

    const users = await db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, avatar: true, email: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    // Fetch upload info
    const uploadIds = session.uploadIds as string[];
    const uploads = await db.upload.findMany({
      where: { id: { in: uploadIds } },
      include: {
        creator: { select: { id: true, name: true } },
        request: { select: { id: true, title: true } },
      },
    });

    const uploadsInfo: ReviewUploadInfo[] = uploads.map((upload) => ({
      id: upload.id,
      fileName: upload.fileName,
      originalName: upload.originalName,
      fileType: upload.fileType,
      fileSize: Number(upload.fileSize),
      storageUrl: upload.storageUrl,
      thumbnailUrl: upload.thumbnailUrl,
      metadata: upload.metadata as Record<string, unknown>,
      creatorId: upload.creatorId,
      creatorName: upload.creator.name,
      requestId: upload.requestId,
      requestTitle: upload.request.title,
      uploadedAt: upload.uploadedAt,
    }));

    // Build enriched data
    const participantsWithUser = session.participants.map((p) => ({
      ...p,
      user: userMap.get(p.userId) || {
        id: p.userId,
        name: "Unknown",
        avatar: null,
        email: "",
      },
    }));

    const votesWithUser = session.votes.map((v) => ({
      ...v,
      user: userMap.get(v.userId) || {
        id: v.userId,
        name: "Unknown",
        avatar: null,
      },
    }));

    const messagesWithUser = session.chatMessages.map((m) => ({
      ...m,
      user: userMap.get(m.userId) || {
        id: m.userId,
        name: "Unknown",
        avatar: null,
      },
    }));

    const sessionWithTypes = {
      ...session,
      endedAt,
      uploadIds: session.uploadIds as string[],
      settings: session.settings as Record<string, unknown>,
    };

    // Generate summary
    const summary = generateSessionSummary(
      sessionWithTypes,
      participantsWithUser,
      votesWithUser,
      messagesWithUser,
      uploadsInfo
    );

    // Broadcast end event
    emitSessionEnded(sessionId, endStatus, summary);

    // Clean up in-memory store
    sessionStore.deleteSession(sessionId);

    // Create activity log
    await db.activityLog.create({
      data: {
        userId,
        action: "review_session.ended",
        entityType: "ReviewSession",
        entityId: sessionId,
        metadata: {
          sessionName: session.name,
          status: endStatus,
          duration: summary.duration,
          totalItems: summary.totalItems,
          reviewedItems: summary.reviewedItems,
          participantCount: summary.participantCount,
        },
      },
    });

    return NextResponse.json({
      success: true,
      summary,
    });
  } catch (error) {
    console.error("Error ending session:", error);
    return NextResponse.json(
      { error: "Failed to end session" },
      { status: 500 }
    );
  }
}
