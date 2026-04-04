import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Helper to get creator from session token header
async function getCreatorFromSession(request: NextRequest) {
  const sessionToken = request.headers.get("x-creator-token");

  if (!sessionToken) return null;

  const creator = await db.creator.findFirst({
    where: {
      sessionToken,
      sessionExpiry: { gt: new Date() },
    },
    include: {
      agency: { select: { id: true, name: true } },
    },
  });

  return creator;
}

// GET /api/portal/inbox - Get creator's conversations
export async function GET(request: NextRequest) {
  try {
    const creator = await getCreatorFromSession(request);
    if (!creator) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find or create the creator's conversation with the team
    let conversation = await db.conversation.findFirst({
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

    return NextResponse.json({
      conversation: {
        id: conversation.id,
        teamName: creator.agency.name,
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
    const creator = await getCreatorFromSession(request);
    if (!creator) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { content, forwardedContent, attachments } = body;

    if (!content && !forwardedContent?.length && !attachments?.length) {
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
      // Get team members who should be participants (e.g., admins)
      const teamMembers = await db.user.findMany({
        where: {
          agencyId: creator.agencyId,
          role: { in: ["ADMIN", "OWNER"] },
        },
        select: { id: true },
        take: 5,
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
        content: content || "",
        forwardedContent: forwardedContent || [],
        attachments: attachments || [],
      },
    });

    // Update conversation
    await db.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: message.createdAt,
        lastMessagePreview: (content || "Shared content").substring(0, 100),
      },
    });

    return NextResponse.json({
      message: {
        id: message.id,
        content: message.content,
        isFromCreator: true,
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
