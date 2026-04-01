// POST /api/review-sessions - Create a new review session
// GET /api/review-sessions - List active sessions for agency

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  CreateSessionRequest,
  CreateSessionResponse,
  DEFAULT_SESSION_SETTINGS,
  ActiveSessionIndicator,
} from "@/types/review-session";
import {
  sessionStore,
  buildSessionState,
} from "@/lib/realtime-session";

// Mock auth helper - replace with real auth in production
async function getCurrentUser(request: NextRequest) {
  // In production, get from session/JWT
  const userId = request.headers.get("x-user-id") || "user_demo";
  const agencyId = request.headers.get("x-agency-id") || "agency_demo";
  return { userId, agencyId };
}

export async function POST(request: NextRequest) {
  try {
    const { userId, agencyId } = await getCurrentUser(request);
    const body: CreateSessionRequest = await request.json();

    // Validate request
    if (!body.name || body.name.trim().length === 0) {
      return NextResponse.json(
        { error: "Session name is required" },
        { status: 400 }
      );
    }

    if (!body.uploadIds || body.uploadIds.length === 0) {
      return NextResponse.json(
        { error: "At least one upload is required for review" },
        { status: 400 }
      );
    }

    // Merge settings with defaults
    const settings = {
      ...DEFAULT_SESSION_SETTINGS,
      ...body.settings,
    };

    // Create the session
    const session = await db.reviewSession.create({
      data: {
        agencyId,
        name: body.name.trim(),
        description: body.description?.trim() || null,
        status: "ACTIVE",
        hostUserId: userId,
        uploadIds: body.uploadIds,
        currentUploadIndex: 0,
        settings,
      },
    });

    // Add host as first participant
    const hostParticipant = await db.reviewSessionParticipant.create({
      data: {
        sessionId: session.id,
        userId,
        role: "HOST",
        isActive: true,
      },
    });

    // Get host user info
    const hostUser = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, avatar: true, email: true },
    });

    // Get first upload info
    const firstUploadId = body.uploadIds[0];
    const firstUpload = await db.upload.findUnique({
      where: { id: firstUploadId },
      include: {
        creator: { select: { id: true, name: true } },
        request: { select: { id: true, title: true } },
      },
    });

    const currentUpload = firstUpload
      ? {
          id: firstUpload.id,
          fileName: firstUpload.fileName,
          originalName: firstUpload.originalName,
          fileType: firstUpload.fileType,
          fileSize: Number(firstUpload.fileSize),
          storageUrl: firstUpload.storageUrl,
          thumbnailUrl: firstUpload.thumbnailUrl,
          metadata: firstUpload.metadata as Record<string, unknown>,
          creatorId: firstUpload.creatorId,
          creatorName: firstUpload.creator.name,
          requestId: firstUpload.requestId,
          requestTitle: firstUpload.request.title,
          uploadedAt: firstUpload.uploadedAt,
        }
      : null;

    // Build initial session state
    const sessionWithSettings = {
      ...session,
      uploadIds: session.uploadIds as string[],
      settings: session.settings as typeof settings,
    };

    const participantWithUser = {
      ...hostParticipant,
      user: hostUser || { id: userId, name: "Unknown", avatar: null, email: "" },
    };

    const initialState = buildSessionState(
      sessionWithSettings,
      [participantWithUser],
      [],
      [],
      currentUpload
    );

    // Store in memory for real-time sync
    sessionStore.setSession(session.id, initialState);

    // Invite other users if specified
    if (body.inviteUserIds && body.inviteUserIds.length > 0) {
      // Create notifications for invited users
      await db.notification.createMany({
        data: body.inviteUserIds.map((invitedUserId) => ({
          userId: invitedUserId,
          type: "review_session_invite",
          title: "Review Session Invitation",
          message: `You've been invited to join the review session "${body.name}"`,
          link: `/review-sessions/${session.id}`,
        })),
      });
    }

    // Generate invite link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const inviteLink = `${baseUrl}/review-sessions/${session.id}`;

    const response: CreateSessionResponse = {
      session: sessionWithSettings,
      inviteLink,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("Error creating review session:", error);
    return NextResponse.json(
      { error: "Failed to create review session" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { agencyId } = await getCurrentUser(request);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "ACTIVE";
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    // Get sessions
    const sessions = await db.reviewSession.findMany({
      where: {
        agencyId,
        status: status as "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED",
      },
      include: {
        participants: {
          where: { isActive: true },
          select: { userId: true },
        },
      },
      orderBy: { startedAt: "desc" },
      take: limit,
    });

    // Get host user info for each session
    const hostUserIds = [...new Set(sessions.map((s) => s.hostUserId))];
    const hostUsers = await db.user.findMany({
      where: { id: { in: hostUserIds } },
      select: { id: true, name: true },
    });
    const hostUserMap = new Map(hostUsers.map((u) => [u.id, u.name]));

    const activeSessions: ActiveSessionIndicator[] = sessions.map((session) => ({
      sessionId: session.id,
      sessionName: session.name,
      participantCount: session.participants.length,
      currentItemIndex: session.currentUploadIndex,
      totalItems: (session.uploadIds as string[]).length,
      hostName: hostUserMap.get(session.hostUserId) || "Unknown",
      startedAt: session.startedAt,
    }));

    return NextResponse.json({ sessions: activeSessions });
  } catch (error) {
    console.error("Error fetching review sessions:", error);
    return NextResponse.json(
      { error: "Failed to fetch review sessions" },
      { status: 500 }
    );
  }
}
