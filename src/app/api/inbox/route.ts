import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatMentionsForDisplay } from "@/lib/mention-parser";
import { cleanGroupName, staffIdsInAgency } from "@/lib/conversation-access";
import { excludePseudoUsers } from "@/lib/staff";

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
          // Enough recent messages to count what this user has not read yet
          take: 30,
          select: {
            id: true,
            content: true,
            createdAt: true,
            senderId: true,
            creatorId: true,
            readBy: true,
            sender: { select: { name: true } },
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
          !readBy.some((r) => r.userId === userId);
      }

      // Unread count: recent messages from others that this user has not read
      const unreadCount = conv.messages.filter((m) => {
        if (m.senderId === userId) return false;
        const rb = (m.readBy as Array<{ userId: string } | string>) || [];
        return !rb.some((x) => (typeof x === "string" ? x : x?.userId) === userId);
      }).length;

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
        // Everyone in a team group (including the caller), for the member initials
        members:
          conv.type === "GROUP"
            ? conv.participants.map((p) => ({ id: p.user.id, name: p.user.name }))
            : undefined,
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              content: formatMentionsForDisplay(lastMessage.content).substring(0, 100),
              senderName: lastMessage.sender?.name ?? null,
              createdAt: lastMessage.createdAt,
              isFromCreator: !!lastMessage.creatorId,
              isMine: lastMessage.senderId === userId,
            }
          : null,
        lastMessageAt: conv.lastMessageAt,
        hasUnread,
        unreadCount,
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
        // Make sure the current user can see the existing thread
        await db.conversationParticipant.upsert({
          where: { conversationId_userId: { conversationId: existingConv.id, userId } },
          create: { conversationId: existingConv.id, userId },
          update: {},
        });

        return NextResponse.json({
          conversation: existingConv,
          existing: true,
        });
      }
    }

    // Team threads: every other participant must be real staff of this agency
    // (creator pseudo-users and other agencies' users are refused, not dropped)
    let groupName: string | null = null;
    let requested: string[] = [];
    if (type === "DIRECT" || type === "GROUP") {
      requested = Array.isArray(participantIds)
        ? Array.from(new Set((participantIds as unknown[]).filter((id): id is string => typeof id === "string" && id !== userId)))
        : [];
      const valid = await staffIdsInAgency(requested, agencyId);
      if (valid.length !== requested.length) {
        return NextResponse.json(
          { error: "Only people on your team can be added" },
          { status: 400 }
        );
      }
      if (type === "GROUP") {
        groupName = cleanGroupName(name);
        if (!groupName) {
          return NextResponse.json({ error: "Give the group a name" }, { status: 400 });
        }
        if (requested.length < 2) {
          return NextResponse.json(
            { error: "Pick at least two team members for a group" },
            { status: 400 }
          );
        }
      }
    }

    // Deduplicate participants and always include the current user
    // (creator threads are one creator to the whole team; their participants are staff only)
    const participantUserIds =
      type === "CREATOR"
        ? Array.from(
            new Set<string>([
              userId,
              ...(
                await db.user.findMany({
                  where: { AND: [{ agencyId }, excludePseudoUsers] },
                  select: { id: true },
                })
              ).map((u) => u.id),
            ])
          )
        : [userId, ...requested];

    // For DIRECT conversations, reuse an existing thread between the two users
    if (type === "DIRECT") {
      const otherUserIds = participantUserIds.filter((id) => id !== userId);
      if (otherUserIds.length !== 1) {
        return NextResponse.json(
          { error: "Direct conversations require exactly one other participant" },
          { status: 400 }
        );
      }

      const existingDirect = await db.conversation.findFirst({
        where: {
          type: "DIRECT",
          OR: [{ agencyId }, { agencyId: null }],
          AND: [
            { participants: { some: { userId } } },
            { participants: { some: { userId: otherUserIds[0] } } },
          ],
        },
      });

      if (existingDirect) {
        return NextResponse.json({
          conversation: existingDirect,
          existing: true,
        });
      }
    }

    // Create conversation
    const conversation = await db.conversation.create({
      data: {
        type,
        name: type === "GROUP" ? groupName : null,
        // A new group sorts to the top of everyone's inbox until it has messages
        lastMessageAt: type === "GROUP" ? new Date() : undefined,
        creatorId: type === "CREATOR" ? creatorId : null,
        agencyId,
        participants: {
          create: participantUserIds.map((id) => ({ userId: id })),
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
