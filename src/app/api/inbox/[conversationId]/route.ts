import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { broadcastConversationMessage } from "@/lib/realtime-broadcast";

interface ForwardedItem {
  type: "upload" | "request";
  id: string;
}

// GET /api/inbox/[conversationId] - Get messages for a conversation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { conversationId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const before = searchParams.get("before"); // For pagination

    const userId = session.user.id;

    // Verify user is participant
    const participant = await db.conversationParticipant.findUnique({
      where: {
        conversationId_userId: { conversationId, userId },
      },
    });

    if (!participant) {
      return NextResponse.json(
        { error: "Not a participant in this conversation" },
        { status: 403 }
      );
    }

    // Get conversation details
    const conversation = await db.conversation.findUnique({
      where: { id: conversationId },
      include: {
        creator: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        request: {
          select: { id: true, title: true, status: true },
        },
        participants: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatar: true },
            },
          },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    // Build messages query
    const messagesWhere: Record<string, unknown> = { conversationId };
    if (before) {
      messagesWhere.createdAt = { lt: new Date(before) };
    }

    // Fetch messages
    const messages = await db.message.findMany({
      where: messagesWhere,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        sender: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        creator: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });

    // Batch collect all forwarded content IDs to avoid N+1 queries
    const uploadIds = new Set<string>();
    const requestIds = new Set<string>();

    for (const msg of messages) {
      const forwardedContent = (msg.forwardedContent as unknown as ForwardedItem[]) || [];
      for (const item of forwardedContent) {
        if (item.type === "upload") uploadIds.add(item.id);
        else if (item.type === "request") requestIds.add(item.id);
      }
    }

    // Batch fetch all forwarded entities in just 2 queries
    const [uploads, requests] = await Promise.all([
      uploadIds.size > 0
        ? db.upload.findMany({
            where: { id: { in: Array.from(uploadIds) } },
            select: {
              id: true,
              originalName: true,
              fileType: true,
              thumbnailUrl: true,
              status: true,
            },
          })
        : [],
      requestIds.size > 0
        ? db.contentRequest.findMany({
            where: { id: { in: Array.from(requestIds) } },
            select: {
              id: true,
              title: true,
              status: true,
              dueDate: true,
            },
          })
        : [],
    ]);

    // Create lookup maps for O(1) access
    const uploadsMap = new Map(uploads.map((u) => [u.id, u]));
    const requestsMap = new Map(requests.map((r) => [r.id, r]));

    // Expand forwarded content using the maps (no additional queries)
    const messagesWithContent = messages.map((msg) => {
      const forwardedContent = (msg.forwardedContent as unknown as ForwardedItem[]) || [];
      const expandedForwarded = forwardedContent.map((item) => {
        if (item.type === "upload") {
          return { type: "upload", id: item.id, data: uploadsMap.get(item.id) || null };
        } else if (item.type === "request") {
          return { type: "request", id: item.id, data: requestsMap.get(item.id) || null };
        }
        return { type: item.type, id: item.id, data: null };
      });

      return {
        id: msg.id,
        content: msg.content,
        sender: msg.sender,
        creator: msg.creator,
        isFromCreator: !!msg.creatorId,
        attachments: msg.attachments,
        forwardedContent: expandedForwarded,
        createdAt: msg.createdAt,
      };
    });

    // Mark messages as read - batch update using a transaction for atomicity
    const now = new Date().toISOString();
    const unreadMessages = messages.filter((msg) => {
      const readBy = (msg.readBy as Array<{ userId: string; readAt: string }>) || [];
      return !readBy.some((r) => r.userId === userId);
    });

    if (unreadMessages.length > 0) {
      // Use a transaction to atomically update all messages
      // Each update reads current readBy and appends, preventing race conditions
      await db.$transaction(
        unreadMessages.map((msg) => {
          const readBy = (msg.readBy as Array<{ userId: string; readAt: string }>) || [];
          return db.message.update({
            where: { id: msg.id },
            data: {
              readBy: [...readBy, { userId, readAt: now }],
            },
          });
        })
      );
    }

    return NextResponse.json({
      conversation: {
        id: conversation.id,
        type: conversation.type,
        name: conversation.name,
        creator: conversation.creator,
        request: conversation.request,
        participants: conversation.participants.map((p) => p.user),
      },
      messages: messagesWithContent.reverse(), // Return oldest first
      hasMore: messages.length === limit,
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

// POST /api/inbox/[conversationId] - Send a message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { conversationId } = await params;
    const body = await request.json();
    const { content, forwardedContent, attachments } = body;

    const userId = session.user.id;

    // Verify user is participant
    const participant = await db.conversationParticipant.findUnique({
      where: {
        conversationId_userId: { conversationId, userId },
      },
    });

    if (!participant) {
      return NextResponse.json(
        { error: "Not a participant in this conversation" },
        { status: 403 }
      );
    }

    if (!content && !forwardedContent?.length && !attachments?.length) {
      return NextResponse.json(
        { error: "Message must have content, forwarded items, or attachments" },
        { status: 400 }
      );
    }

    // Create message
    const message = await db.message.create({
      data: {
        conversationId,
        senderId: userId,
        content: content || "",
        forwardedContent: forwardedContent || [],
        attachments: attachments || [],
      },
      include: {
        sender: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });

    // Update conversation
    await db.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: message.createdAt,
        lastMessagePreview: (content || "Shared content").substring(0, 100),
      },
    });

    // Broadcast new message to conversation channel (fire and forget)
    broadcastConversationMessage(conversationId, {
      id: message.id,
      content: message.content,
      senderId: userId,
      senderName: message.sender?.name || undefined,
      createdAt: message.createdAt.toISOString(),
    }).catch(() => {});

    return NextResponse.json({
      message: {
        id: message.id,
        content: message.content,
        sender: message.sender,
        isFromCreator: false,
        attachments: message.attachments,
        forwardedContent: forwardedContent || [],
        createdAt: message.createdAt,
      },
    });
  } catch (error) {
    console.error("Error sending message:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
