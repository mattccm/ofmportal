// POST /api/review-sessions/[id]/rejoin - Rejoin a session with state sync

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  sessionStore,
  emitParticipantJoined,
  buildSessionState,
} from "@/lib/realtime-session";
import {
  RejoinSessionRequest,
  RejoinSessionResponse,
  ReviewUploadInfo,
  SessionRecordingEvent,
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
    const body: RejoinSessionRequest = await request.json().catch(() => ({}));

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

    // Check if was previously a participant
    const existingParticipant = await db.reviewSessionParticipant.findUnique({
      where: {
        sessionId_userId: { sessionId, userId },
      },
    });

    if (!existingParticipant) {
      // If never was a participant, redirect to join
      return NextResponse.json(
        { error: "You were not a participant in this session. Please join instead." },
        { status: 400 }
      );
    }

    // Rejoin - update as active
    const participant = await db.reviewSessionParticipant.update({
      where: { id: existingParticipant.id },
      data: {
        isActive: true,
        leftAt: null,
      },
    });

    const participantWithUser = {
      ...participant,
      user,
    };

    // Get events that happened since they left
    const missedEvents: SessionRecordingEvent[] = [];

    if (existingParticipant.leftAt) {
      // Get votes since they left
      const missedVotes = await db.reviewSessionVote.findMany({
        where: {
          sessionId,
          votedAt: { gt: existingParticipant.leftAt },
        },
        orderBy: { votedAt: "asc" },
      });

      // Get messages since they left
      const missedMessages = await db.reviewSessionChat.findMany({
        where: {
          sessionId,
          createdAt: { gt: existingParticipant.leftAt },
        },
        orderBy: { createdAt: "asc" },
      });

      // Get participants who joined/left since they left
      const participantChanges = await db.reviewSessionParticipant.findMany({
        where: {
          sessionId,
          OR: [
            { joinedAt: { gt: existingParticipant.leftAt } },
            { leftAt: { gt: existingParticipant.leftAt } },
          ],
        },
        orderBy: { joinedAt: "asc" },
      });

      // Build missed events
      const userIds = [
        ...missedVotes.map((v) => v.userId),
        ...missedMessages.map((m) => m.userId),
        ...participantChanges.map((p) => p.userId),
      ];

      const users = await db.user.findMany({
        where: { id: { in: [...new Set(userIds)] } },
        select: { id: true, name: true },
      });
      const userMap = new Map(users.map((u) => [u.id, u.name]));

      // Get upload info for vote context
      const uploadIds = session.uploadIds as string[];
      const uploads = await db.upload.findMany({
        where: { id: { in: uploadIds } },
        select: { id: true, originalName: true },
      });
      const uploadMap = new Map(uploads.map((u) => [u.id, u.originalName]));

      // Add vote events
      missedVotes.forEach((v) => {
        missedEvents.push({
          timestamp: v.votedAt,
          type: "vote_cast",
          userId: v.userId,
          data: {
            uploadId: v.uploadId,
            uploadName: uploadMap.get(v.uploadId) || "Unknown",
            vote: v.vote,
            note: v.note,
            userName: userMap.get(v.userId) || "Unknown",
          },
        });
      });

      // Add message events
      missedMessages.forEach((m) => {
        missedEvents.push({
          timestamp: m.createdAt,
          type: m.type === "VOICE_NOTE" ? "voice_note" : "chat_message",
          userId: m.userId,
          data: {
            message: m.message,
            type: m.type,
            uploadId: m.uploadId,
            voiceNoteDuration: m.voiceNoteDuration,
            userName: userMap.get(m.userId) || "Unknown",
          },
        });
      });

      // Add participant change events
      participantChanges.forEach((p) => {
        if (p.joinedAt > existingParticipant.leftAt!) {
          missedEvents.push({
            timestamp: p.joinedAt,
            type: "participant_joined",
            userId: p.userId,
            data: {
              userName: userMap.get(p.userId) || "Unknown",
              role: p.role,
            },
          });
        }
        if (p.leftAt && p.leftAt > existingParticipant.leftAt!) {
          missedEvents.push({
            timestamp: p.leftAt,
            type: "participant_left",
            userId: p.userId,
            data: {
              userName: userMap.get(p.userId) || "Unknown",
            },
          });
        }
      });

      // Sort by timestamp
      missedEvents.sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
    }

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
        const allUserIds = [
          ...new Set([
            ...fullSession.participants.map((p) => p.userId),
            ...fullSession.votes.map((v) => v.userId),
            ...fullSession.chatMessages.map((m) => m.userId),
          ]),
        ];

        const allUsers = await db.user.findMany({
          where: { id: { in: allUserIds } },
          select: { id: true, name: true, avatar: true, email: true },
        });
        const allUserMap = new Map(allUsers.map((u) => [u.id, u]));

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
          user: allUserMap.get(p.userId) || {
            id: p.userId,
            name: "Unknown",
            avatar: null,
            email: "",
          },
        }));

        const votesWithUsers = fullSession.votes.map((v) => ({
          ...v,
          user: allUserMap.get(v.userId) || {
            id: v.userId,
            name: "Unknown",
            avatar: null,
          },
        }));

        const messagesWithUsers = fullSession.chatMessages.map((m) => ({
          ...m,
          user: allUserMap.get(m.userId) || {
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

    // Update state with rejoined participant
    if (state) {
      const updatedParticipants = [...state.participants];
      const existingIndex = updatedParticipants.findIndex(
        (p) => p.userId === userId
      );
      if (existingIndex >= 0) {
        updatedParticipants[existingIndex] = {
          ...updatedParticipants[existingIndex],
          ...participantWithUser,
          isActive: true,
          leftAt: null,
        };
      }

      state = { ...state, participants: updatedParticipants };
      sessionStore.setSession(sessionId, state);

      // Broadcast rejoin event
      emitParticipantJoined(sessionId, participantWithUser);
    }

    // Check if navigation has changed since they left
    let navigationChanged = false;
    if (body.lastKnownIndex !== undefined && body.lastKnownIndex !== session.currentUploadIndex) {
      navigationChanged = true;
    }

    const response: RejoinSessionResponse = {
      participant: participantWithUser,
      state: state!,
      missedEvents,
      rejoinedAt: new Date(),
    };

    // Add additional context to help client understand what changed
    return NextResponse.json({
      ...response,
      context: {
        navigationChanged,
        currentIndex: session.currentUploadIndex,
        previousIndex: body.lastKnownIndex,
        missedEventsCount: missedEvents.length,
        timeAway: existingParticipant.leftAt
          ? Math.floor((Date.now() - new Date(existingParticipant.leftAt).getTime()) / 1000)
          : 0,
      },
    });
  } catch (error) {
    console.error("Error rejoining session:", error);
    return NextResponse.json(
      { error: "Failed to rejoin session" },
      { status: 500 }
    );
  }
}
