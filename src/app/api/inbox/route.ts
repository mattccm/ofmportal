import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/inbox - List conversations for current user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // "all" | "creator" | "team"
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    const userId = session.user.id;
    const agencyId = session.user.agencyId;

    // Build where clause
    const where: Record<string, unknown> = {
      participants: {
        some: { userId },
      },
      OR: [
        { agencyId },
        { agencyId: null }, // Legacy conversations without agency
      ],
    };

    if (type === "creator") {
      where.type = "CREATOR";
    } else if (type === "team") {
      where.type = { in: ["DIRECT", "GROUP", "REQUEST_THREAD"] };
    }

    // Fetch conversations with participants and last message
    const conversations = await db.conversation.findMany({
      where,
      orderBy: { lastMessageAt: { sort: "desc", nulls: "last" } },
      take: limit,
      skip: offset,
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatar: true },
            },
          },
        },
        creator: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        request: {
          select: { id: true, title: true, status: true },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            content: true,
            createdAt: true,
            senderId: true,
            creatorId: true,
            readBy: true,
          },
        },
      },
    });

    // Count total
    const total = await db.conversation.count({ where });

    // Calculate unread counts
    const conversationsWithUnread = conversations.map((conv) => {
      const lastMessage = conv.messages[0];
      let hasUnread = false;

      if (lastMessage) {
        const readBy = (lastMessage.readBy as Array<{ userId: string }>) || [];
        // Has unread if current user hasn't read it and they didn't send it
        hasUnread =
          lastMessage.senderId !== userId &&
          lastMessage.creatorId !== null && // Or it's from a creator
          !readBy.some((r) => r.userId === userId);
      }

      // Get other participants for display name
      const otherParticipants = conv.participants.filter(
        (p) => p.userId !== userId
      );

      // Determine display name
      let displayName = conv.name;
      if (!displayName) {
        if (conv.type === "CREATOR" && conv.creator) {
          displayName = conv.creator.name;
        } else if (conv.type === "DIRECT" && otherParticipants.length === 1) {
          displayName = otherParticipants[0].user.name || "Unknown";
        } else if (conv.request) {
          displayName = `Request: ${conv.request.title}`;
        } else {
          displayName = otherParticipants.map((p) => p.user.name).join(", ") || "Conversation";
        }
      }

      return {
        id: conv.id,
        type: conv.type,
        name: displayName,
        creator: conv.creator,
        request: conv.request,
        participants: otherParticipants.map((p) => p.user),
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              content: lastMessage.content.substring(0, 100),
              createdAt: lastMessage.createdAt,
              isFromCreator: !!lastMessage.creatorId,
            }
          : null,
        lastMessageAt: conv.lastMessageAt,
        hasUnread,
      };
    });

    return NextResponse.json({
      conversations: conversationsWithUnread,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 }
    );
  }
}

// POST /api/inbox - Create a new conversation
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { type, creatorId, participantIds, name, initialMessage } = body;

    const userId = session.user.id;
    const agencyId = session.user.agencyId;

    // Validate type
    if (!["DIRECT", "GROUP", "CREATOR"].includes(type)) {
      return NextResponse.json(
        { error: "Invalid conversation type" },
        { status: 400 }
      );
    }

    // For CREATOR type, verify the creator exists and belongs to agency
    if (type === "CREATOR") {
      if (!creatorId) {
        return NextResponse.json(
          { error: "creatorId required for creator conversations" },
          { status: 400 }
        );
      }

      const creator = await db.creator.findFirst({
        where: { id: creatorId, agencyId },
      });

      if (!creator) {
        return NextResponse.json(
          { error: "Creator not found" },
          { status: 404 }
        );
      }

      // Check if conversation already exists with this creator
      const existingConv = await db.conversation.findFirst({
        where: {
          type: "CREATOR",
          creatorId,
          agencyId,
        },
      });

      if (existingConv) {
        return NextResponse.json({
          conversation: existingConv,
          existing: true,
        });
      }
    }

    // Create conversation
    const conversation = await db.conversation.create({
      data: {
        type,
        name: type === "GROUP" ? name : null,
        creatorId: type === "CREATOR" ? creatorId : null,
        agencyId,
        participants: {
          create: [
            { userId }, // Creator always participates
            ...(participantIds || []).map((id: string) => ({ userId: id })),
          ],
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatar: true },
            },
          },
        },
        creator: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });

    // If initial message provided, create it
    if (initialMessage) {
      const message = await db.message.create({
        data: {
          conversationId: conversation.id,
          senderId: userId,
          content: initialMessage,
        },
      });

      // Update conversation with last message info
      await db.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: message.createdAt,
          lastMessagePreview: initialMessage.substring(0, 100),
        },
      });
    }

    return NextResponse.json({
      conversation,
      existing: false,
    });
  } catch (error) {
    console.error("Error creating conversation:", error);
    return NextResponse.json(
      { error: "Failed to create conversation" },
      { status: 500 }
    );
  }
}
