// POST /api/review-sessions/[id]/join - Join a review session

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  sessionStore,
  emitParticipantJoined,
  buildSessionState,
} from "@/lib/realtime-session";
import {
  JoinSessionRequest,
  JoinSessionResponse,
  ReviewUploadInfo,
} from "@/types/review-session";

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
    const body: JoinSessionRequest = await request.json().catch(() => ({}));

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

    if (session.status !== "ACTIVE" && session.status !== "PAUSED") {
      return NextResponse.json(
        { error: "Session is no longer active" },
        { status: 400 }
      );
    }

    // Get user info
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, avatar: true, email: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Check if already a participant
    const existingParticipant = await db.reviewSessionParticipant.findUnique({
      where: {
        sessionId_userId: { sessionId, userId },
      },
    });

    let participant;

    if (existingParticipant) {
      // Rejoin - update as active
      participant = await db.reviewSessionParticipant.update({
        where: { id: existingParticipant.id },
        data: {
          isActive: true,
          leftAt: null,
        },
      });
    } else {
      // New participant
      const role = body.role || "REVIEWER";
      participant = await db.reviewSessionParticipant.create({
        data: {
          sessionId,
          userId,
          role,
          isActive: true,
        },
      });
    }

    const participantWithUser = {
      ...participant,
      user,
    };

    // Get current session state
    let state = sessionStore.getSession(sessionId);

    if (!state) {
      // Build state from database
      const fullSession = await db.reviewSession.findUnique({
        where: { id: sessionId },
        include: {
          participants: true,
          votes: true,
          chatMessages: {
            orderBy: { createdAt: "desc" },
            take: 50,
          },
        },
      });

      if (fullSession) {
        // Fetch user info
        const userIds = [
          ...new Set([
            ...fullSession.participants.map((p) => p.userId),
            ...fullSession.votes.map((v) => v.userId),
            ...fullSession.chatMessages.map((m) => m.userId),
          ]),
        ];

        const users = await db.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, avatar: true, email: true },
        });
        const userMap = new Map(users.map((u) => [u.id, u]));

        // Get current upload
        const uploadIds = fullSession.uploadIds as string[];
        const currentUploadId = uploadIds[fullSession.currentUploadIndex];
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

        const participantsWithUsers = fullSession.participants.map((p) => ({
          ...p,
          user: userMap.get(p.userId) || {
            id: p.userId,
            name: "Unknown",
            avatar: null,
            email: "",
          },
        }));

        const votesWithUsers = fullSession.votes.map((v) => ({
          ...v,
          user: userMap.get(v.userId) || {
            id: v.userId,
            name: "Unknown",
            avatar: null,
          },
        }));

        const messagesWithUsers = fullSession.chatMessages.map((m) => ({
          ...m,
          user: userMap.get(m.userId) || {
            id: m.userId,
            name: "Unknown",
            avatar: null,
          },
        }));

        const sessionWithTypes = {
          ...fullSession,
          uploadIds: fullSession.uploadIds as string[],
          settings: fullSession.settings as Record<string, unknown>,
        };

        state = buildSessionState(
          sessionWithTypes,
          participantsWithUsers,
          votesWithUsers,
          messagesWithUsers.reverse(),
          currentUpload
        );

        sessionStore.setSession(sessionId, state);
      }
    }

    // Update state with new participant
    if (state) {
      const updatedParticipants = [...state.participants];
      const existingIndex = updatedParticipants.findIndex(
        (p) => p.userId === userId
      );
      if (existingIndex >= 0) {
        updatedParticipants[existingIndex] = participantWithUser;
      } else {
        updatedParticipants.push(participantWithUser);
      }

      state = { ...state, participants: updatedParticipants };
      sessionStore.setSession(sessionId, state);

      // Broadcast join event
      emitParticipantJoined(sessionId, participantWithUser);
    }

    const response: JoinSessionResponse = {
      participant: participantWithUser,
      state: state!,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error joining session:", error);
    return NextResponse.json(
      { error: "Failed to join session" },
      { status: 500 }
    );
  }
}
