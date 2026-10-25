import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { broadcastConversationMessage } from "@/lib/realtime-broadcast";
import { cleanGroupName, findStaffConversation, staffIdsInAgency } from "@/lib/conversation-access";
import { extractMentionIds, formatMentionsForDisplay } from "@/lib/mention-parser";
import { notifyTeam, NotificationType } from "@/lib/notifications";

const notFound = () =>
  NextResponse.json({ error: "Conversation not found" }, { status: 404 });

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
    if (!session?.user?.id || !session.user.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { conversationId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const before = searchParams.get("before"); // For pagination

    const userId = session.user.id;

    // Same agency and a participant, or it does not exist for this user
    if (!(await findStaffConversation(conversationId, userId, session.user.agencyId))) {
      return notFound();
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
      // Append in SQL (not from the stale readBy we fetched) so concurrent readers
      // can't overwrite each other's marks; the @> guard skips already-read rows.
      const ids = unreadMessages.map((msg) => msg.id);
      await db.$executeRaw`
        UPDATE "Message"
        SET "readBy" = COALESCE("readBy", '[]'::jsonb) || jsonb_build_array(jsonb_build_object('userId', ${userId}::text, 'readAt', ${now}::text))
        WHERE id = ANY(${ids}::text[])
          AND NOT (COALESCE("readBy", '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('userId', ${userId}::text)))`;
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
    if (!session?.user?.id || !session.user.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { conversationId } = await params;
    const body = await request.json();
    const { content, forwardedContent, attachments } = body;

    const userId = session.user.id;

    // Same agency and a participant, or it does not exist for this user
    const convo = await findStaffConversation(conversationId, userId, session.user.agencyId);
    if (!convo) {
      return notFound();
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
        lastMessagePreview: (content ? formatMentionsForDisplay(content) : "Shared content").substring(0, 100),
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

    // Team threads notify the other members through the in-app staff path
    // (the same MESSAGE_RECEIVED notifications creator messages use; no email).
    // In a group, @mentioned members get a mention instead of the plain notice.
    if (convo.type === "GROUP" || convo.type === "DIRECT") {
      try {
        await notifyTeamThread({
          conversationId,
          convo,
          senderId: userId,
          senderName: message.sender?.name || "A teammate",
          agencyId: session.user.agencyId,
          messageId: message.id,
          content: content || "",
        });
      } catch (notifyError) {
        console.warn("Failed to notify team thread members:", notifyError);
      }
    }

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

async function notifyTeamThread({
  conversationId,
  convo,
  senderId,
  senderName,
  agencyId,
  messageId,
  content,
}: {
  conversationId: string;
  convo: { type: string; name: string | null };
  senderId: string;
  senderName: string;
  agencyId: string;
  messageId: string;
  content: string;
}) {
  const others = (
    await db.conversationParticipant.findMany({
      where: { conversationId, userId: { not: senderId } },
      select: { userId: true },
    })
  ).map((p) => p.userId);
  if (others.length === 0) return;

  const link = `/dashboard/messages?conversation=${conversationId}`;
  const text = formatMentionsForDisplay(content);
  const preview = text ? (text.length > 80 ? text.slice(0, 77) + "..." : text) : "Shared content";
  const where = convo.type === "GROUP" && convo.name ? ` in ${convo.name}` : "";

  // Mentions only count for people who are in this thread
  const mentioned =
    convo.type === "GROUP" ? extractMentionIds(content).filter((id) => others.includes(id)) : [];
  if (mentioned.length > 0) {
    await db.mention.createMany({
      data: mentioned.map((mentionedUserId) => ({
        agencyId,
        mentionedById: senderId,
        mentionedUserId,
        contextType: "MESSAGE" as const,
        contextId: messageId,
        contextUrl: link,
        content: text.substring(0, 500),
      })),
    });
    await notifyTeam(mentioned, NotificationType.MENTION, `${senderName} mentioned you${where}`, preview, link);
  }

  const rest = others.filter((id) => !mentioned.includes(id));
  if (rest.length > 0) {
    await notifyTeam(rest, NotificationType.MESSAGE_RECEIVED, `New message from ${senderName}${where}`, preview, link);
  }
}

async function groupMembers(conversationId: string) {
  const rows = await db.conversationParticipant.findMany({
    where: { conversationId },
    orderBy: { joinedAt: "asc" },
    select: { user: { select: { id: true, name: true, email: true } } },
  });
  return rows.map((r) => r.user);
}

/**
 * PATCH /api/inbox/[conversationId] - Manage a team group
 * Body: { name?: string, add?: string[], remove?: string[] }
 * Any member may rename the group, add teammates or remove other members.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { conversationId } = await params;
    const userId = session.user.id;
    const agencyId = session.user.agencyId;

    const convo = await findStaffConversation(conversationId, userId, agencyId);
    if (!convo) return notFound();
    if (convo.type !== "GROUP") {
      return NextResponse.json({ error: "Only team groups can be changed" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const ids = (v: unknown) =>
      Array.isArray(v) ? Array.from(new Set(v.filter((x): x is string => typeof x === "string" && !!x))) : [];
    const add = ids(body.add);
    // Removing yourself is leaving (DELETE)
    const remove = ids(body.remove).filter((id) => id !== userId);

    let name: string | undefined;
    if (body.name !== undefined) {
      const clean = cleanGroupName(body.name);
      if (!clean) return NextResponse.json({ error: "Give the group a name" }, { status: 400 });
      name = clean;
    }

    if (add.length > 0) {
      const valid = await staffIdsInAgency(add, agencyId);
      if (valid.length !== add.length) {
        return NextResponse.json({ error: "Only people on your team can be added" }, { status: 400 });
      }
    }

    const current = (
      await db.conversationParticipant.findMany({ where: { conversationId }, select: { userId: true } })
    ).map((p) => p.userId);
    const after = new Set([...current, ...add]);
    remove.forEach((id) => after.delete(id));
    if (after.size < 2) {
      return NextResponse.json(
        { error: "A group needs at least two people. Leave the group instead" },
        { status: 400 }
      );
    }

    await db.$transaction([
      ...(name !== undefined ? [db.conversation.update({ where: { id: conversationId }, data: { name } })] : []),
      ...(add.length > 0
        ? [
            db.conversationParticipant.createMany({
              data: add.map((id) => ({ conversationId, userId: id })),
              skipDuplicates: true,
            }),
          ]
        : []),
      ...(remove.length > 0
        ? [db.conversationParticipant.deleteMany({ where: { conversationId, userId: { in: remove } } })]
        : []),
    ]);

    return NextResponse.json({
      success: true,
      name: name ?? convo.name,
      members: await groupMembers(conversationId),
    });
  } catch (error) {
    console.error("Error updating group:", error);
    return NextResponse.json({ error: "The group could not be changed" }, { status: 500 });
  }
}

/**
 * DELETE /api/inbox/[conversationId] - Leave a team group
 * The last member to leave removes the group and its messages.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { conversationId } = await params;
    const userId = session.user.id;

    const convo = await findStaffConversation(conversationId, userId, session.user.agencyId);
    if (!convo) return notFound();
    if (convo.type !== "GROUP") {
      return NextResponse.json({ error: "Only team groups can be left" }, { status: 400 });
    }

    await db.conversationParticipant.delete({
      where: { conversationId_userId: { conversationId, userId } },
    });
    const left = await db.conversationParticipant.count({ where: { conversationId } });
    if (left === 0) {
      await db.conversation.delete({ where: { id: conversationId } });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error leaving group:", error);
    return NextResponse.json({ error: "You could not leave the group" }, { status: 500 });
  }
}
