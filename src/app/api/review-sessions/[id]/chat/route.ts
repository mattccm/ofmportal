// POST /api/review-sessions/[id]/chat - Send a chat message
// GET /api/review-sessions/[id]/chat - Get chat messages

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  sessionStore,
  emitChatMessage,
} from "@/lib/realtime-session";
import { ChatRequest, ChatResponse } from "@/types/review-session";

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
    const body: ChatRequest = await request.json();

    if (!body.message || body.message.trim().length === 0) {
      return NextResponse.json(
        { error: "Message is required" },
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

    // Check session settings for chat
    const settings = session.settings as Record<string, unknown>;
    if (settings.allowChat === false) {
      return NextResponse.json(
        { error: "Chat is disabled for this session" },
        { status: 403 }
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

    // Get user info
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, avatar: true },
    });

    // Get current upload ID for context
    const uploadIds = session.uploadIds as string[];
    const currentUploadId = uploadIds[session.currentUploadIndex] || null;

    // Create message
    const message = await db.reviewSessionChat.create({
      data: {
        sessionId,
        userId,
        message: body.message.trim(),
        uploadId: currentUploadId,
        type: body.type || "MESSAGE",
      },
    });

    // Update participant message count
    await db.reviewSessionParticipant.update({
      where: { id: participant.id },
      data: {
        messagesCount: { increment: 1 },
      },
    });

    const messageWithUser = {
      ...message,
      user: user || { id: userId, name: "Unknown", avatar: null },
    };

    // Update in-memory state
    const state = sessionStore.getSession(sessionId);
    if (state) {
      const updatedMessages = [...state.recentMessages, messageWithUser].slice(-50);
      sessionStore.updateSession(sessionId, { recentMessages: updatedMessages });

      // Broadcast message
      emitChatMessage(sessionId, messageWithUser);
    }

    const response: ChatResponse = {
      message: messageWithUser,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error sending chat message:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const { agencyId } = await getCurrentUser(request);
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const before = searchParams.get("before"); // Cursor for pagination

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

    // Get messages
    const messages = await db.reviewSessionChat.findMany({
      where: {
        sessionId,
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    // Get user info
    const userIds = [...new Set(messages.map((m) => m.userId))];
    const users = await db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, avatar: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const messagesWithUsers = messages.map((m) => ({
      ...m,
      user: userMap.get(m.userId) || {
        id: m.userId,
        name: "Unknown",
        avatar: null,
      },
    }));

    return NextResponse.json({
      messages: messagesWithUsers.reverse(), // Return in chronological order
      hasMore: messages.length === limit,
    });
  } catch (error) {
    console.error("Error fetching chat messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}
