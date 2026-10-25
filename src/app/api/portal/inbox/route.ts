import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateCreatorSession, staffFirstName, isCreatorPseudoEmail } from "@/lib/portal-auth";
import { excludePseudoUsers } from "@/lib/staff";
import { broadcastConversationMessage } from "@/lib/realtime-broadcast";
import { notifyTeam, NotificationType } from "@/lib/notifications";

// GET /api/portal/inbox - Get creator's conversations
export async function GET(request: NextRequest) {
  try {
    const auth = await validateCreatorSession(request);
    if (!auth.success) return auth.error;
    const creator = auth.creator;

    // Find or create the creator's conversation with the team
    const conversation = await db.conversation.findFirst({
      where: {
        type: "CREATOR",
        creatorId: creator.id,
        agencyId: creator.agencyId,
      },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 50,
          include: {
            sender: {
              select: { id: true, name: true, avatar: true, email: true },
            },
          },
        },
        participants: {
          include: {
            user: {
              select: { id: true, name: true, avatar: true, email: true },
            },
          },
        },
      },
    });

    // If no conversation exists, return empty
    if (!conversation) {
      return NextResponse.json({
        conversation: null,
        messages: [],
      });
    }

    // Format messages
    // Staff are named by first name only ("Sam"); the email never leaves the
    // server. A hidden .internal pseudo-user is the creator's own voice.
    const messages = conversation.messages.reverse().map((msg) => ({
      id: msg.id,
      content: msg.content,
      sender:
        msg.sender && !isCreatorPseudoEmail(msg.sender.email)
          ? { id: msg.sender.id, name: staffFirstName(msg.sender.name), avatar: msg.sender.avatar }
          : null,
      isFromCreator: msg.creatorId === creator.id || isCreatorPseudoEmail(msg.sender?.email),
      attachments: msg.attachments,
      forwardedContent: msg.forwardedContent,
      createdAt: msg.createdAt,
    }));

    // Unread: staff messages this creator has not read yet
    const isUnread = (msg: (typeof conversation.messages)[number]) =>
      !!msg.senderId &&
      msg.senderId !== creator.id &&
      !((msg.readBy as Array<{ creatorId?: string }> | null) || []).some((r) => r.creatorId === creator.id);
    const unreadCount = conversation.messages.filter(isUnread).length;

    // ?peek=1 (the creator home's preview) reads without marking anything read
    const peek = request.nextUrl.searchParams.get("peek") === "1";

    // Mark messages as read by creator (using creator's ID)
    const now = new Date().toISOString();
    for (const msg of peek ? [] : conversation.messages) {
      if (msg.senderId && msg.senderId !== creator.id) {
        const readBy = (msg.readBy as Array<{ creatorId?: string; userId?: string; readAt: string }>) || [];
        if (!readBy.some((r) => r.creatorId === creator.id)) {
          await db.message.update({
            where: { id: msg.id },
            data: {
              readBy: [...readBy, { creatorId: creator.id, readAt: now }],
            },
          });
        }
      }
    }

    const agency = await db.agency.findUnique({
      where: { id: creator.agencyId },
      select: { name: true },
    });

    return NextResponse.json({
      conversation: {
        id: conversation.id,
        teamName: agency?.name ?? "",
        participants: conversation.participants
          .filter((p) => !isCreatorPseudoEmail(p.user.email))
          .map((p) => ({
            id: p.user.id,
            name: staffFirstName(p.user.name),
            avatar: p.user.avatar,
          })),
      },
      messages,
      unreadCount,
    });
  } catch (error) {
    console.error("Error fetching creator inbox:", error);
    return NextResponse.json(
      { error: "Failed to fetch inbox" },
      { status: 500 }
    );
  }
}

// POST /api/portal/inbox - Creator sends a message
export async function POST(request: NextRequest) {
  try {
    const auth = await validateCreatorSession(request);
    if (!auth.success) return auth.error;
    const creator = auth.creator;

    const body = await request.json().catch(() => ({}));
    // Only text is accepted from creators. Client-supplied attachments and
    // forwardedContent are ignored: the creator UI never sends them and staff
    // chat renders them as links/images.
    const content = typeof body.content === "string" ? body.content.trim().slice(0, 5000) : "";

    if (!content) {
      return NextResponse.json(
        { error: "Message must have content" },
        { status: 400 }
      );
    }

    // Find or create the creator's conversation
    let conversation = await db.conversation.findFirst({
      where: {
        type: "CREATOR",
        creatorId: creator.id,
        agencyId: creator.agencyId,
      },
    });

    if (!conversation) {
      // Create a new conversation
      // All staff in the agency are participants so every role can see it
      const teamMembers = await db.user.findMany({
        where: {
          AND: [{ agencyId: creator.agencyId }, excludePseudoUsers],
        },
        select: { id: true },
      });

      conversation = await db.conversation.create({
        data: {
          type: "CREATOR",
          creatorId: creator.id,
          agencyId: creator.agencyId,
          participants: {
            create: teamMembers.map((m) => ({ userId: m.id })),
          },
        },
      });
    }

    // Create the message (from creator)
    const message = await db.message.create({
      data: {
        conversationId: conversation.id,
        creatorId: creator.id,
        content,
        forwardedContent: [],
        attachments: [],
      },
    });

    // Update conversation
    await db.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: message.createdAt,
        lastMessagePreview: content.substring(0, 100),
      },
    });

    // Broadcast new message to conversation channel (fire and forget)
    broadcastConversationMessage(conversation.id, {
      id: message.id,
      content: message.content,
      senderName: creator.name,
      createdAt: message.createdAt.toISOString(),
    }).catch(() => {});

    // Notify the agency's staff of the new creator message. The sender is the
    // creator (not a User), so every real staff member is notified; the
    // `.internal` pseudo-users are excluded. Guard so a notification failure
    // never fails the creator's send.
    try {
      const staff = await db.user.findMany({
        where: {
          AND: [{ agencyId: creator.agencyId }, excludePseudoUsers],
        },
        select: { id: true },
      });
      if (staff.length > 0) {
        const preview =
          content.length > 80 ? content.slice(0, 77) + "..." : content;
        await notifyTeam(
          staff.map((s) => s.id),
          NotificationType.MESSAGE_RECEIVED,
          `New message from ${creator.name}`,
          preview,
          `/dashboard/messages?conversation=${conversation.id}`
        );
      }
    } catch (notifyError) {
      console.warn("Failed to notify staff of creator message:", notifyError);
    }

    return NextResponse.json({
      message: {
        id: message.id,
        content: message.content,
        isFromCreator: true,
        attachments: [],
        forwardedContent: [],
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
