import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateCreatorSession } from "@/lib/portal-auth";
import { excludePseudoUsers } from "@/lib/staff";
import { broadcastConversationMessage } from "@/lib/realtime-broadcast";

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
              select: { id: true, name: true, avatar: true },
            },
          },
        },
        participants: {
          include: {
            user: {
              select: { id: true, name: true, avatar: true },
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
    const messages = conversation.messages.reverse().map((msg) => ({
      id: msg.id,
      content: msg.content,
      sender: msg.sender,
      isFromCreator: msg.creatorId === creator.id,
      attachments: msg.attachments,
      forwardedContent: msg.forwardedContent,
      createdAt: msg.createdAt,
    }));

    // Mark messages as read by creator (using creator's ID)
    const now = new Date().toISOString();
    for (const msg of conversation.messages) {
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
        participants: conversation.participants.map((p) => p.user),
      },
      messages,
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
