// GET /api/review-sessions/[id] - Get session state
// DELETE /api/review-sessions/[id] - Delete/cancel session

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  sessionStore,
  buildSessionState,
} from "@/lib/realtime-session";
import { ReviewUploadInfo } from "@/types/review-session";

// Mock auth helper - replace with real auth in production
async function getCurrentUser(request: NextRequest) {
  const userId = request.headers.get("x-user-id") || "user_demo";
  const agencyId = request.headers.get("x-agency-id") || "agency_demo";
  return { userId, agencyId };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const { agencyId } = await getCurrentUser(request);

    // Try to get from in-memory store first
    let state = sessionStore.getSession(sessionId);

    if (state) {
      return NextResponse.json({ state });
    }

    // Fetch from database
    const session = await db.reviewSession.findUnique({
      where: { id: sessionId },
      include: {
        participants: {
          include: {
            // We'll fetch user info separately
          },
        },
        votes: true,
        chatMessages: {
          orderBy: { createdAt: "desc" },
          take: 50,
        },
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

    // Fetch user info for participants
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

    // Get current upload info
    const uploadIds = session.uploadIds as string[];
    const currentUploadId = uploadIds[session.currentUploadIndex];
    let currentUpload: ReviewUploadInfo | null = null;

    if (currentUploadId) {
      const upload = await db.upload.findUnique({
        where: { id: currentUploadId },
        include: {
          creator: { select: { id: true, name: true } },
          request: { select: { id: true, title: true } },
        },
      });

      if (upload) {
        currentUpload = {
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
        };
      }
    }

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
      uploadIds: session.uploadIds as string[],
      settings: session.settings as Record<string, unknown>,
    };

    state = buildSessionState(
      sessionWithTypes,
      participantsWithUser,
      votesWithUser,
      messagesWithUser.reverse(),
      currentUpload
    );

    // Store for future real-time updates
    sessionStore.setSession(sessionId, state);

    return NextResponse.json({ state });
  } catch (error) {
    console.error("Error fetching session:", error);
    return NextResponse.json(
      { error: "Failed to fetch session" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const { userId, agencyId } = await getCurrentUser(request);

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

    if (session.hostUserId !== userId) {
      return NextResponse.json(
        { error: "Only the host can cancel the session" },
        { status: 403 }
      );
    }

    // Update session status
    await db.reviewSession.update({
      where: { id: sessionId },
      data: {
        status: "CANCELLED",
        endedAt: new Date(),
      },
    });

    // Remove from store and notify subscribers
    sessionStore.deleteSession(sessionId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error cancelling session:", error);
    return NextResponse.json(
      { error: "Failed to cancel session" },
      { status: 500 }
    );
  }
}
