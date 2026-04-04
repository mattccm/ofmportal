import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/inbox/unread - Get total unread message count
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const agencyId = session.user.agencyId;

    // Get all conversations user participates in
    const conversations = await db.conversation.findMany({
      where: {
        participants: {
          some: { userId },
        },
        OR: [
          { agencyId },
          { agencyId: null },
        ],
      },
      select: {
        id: true,
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            senderId: true,
            creatorId: true,
            readBy: true,
          },
        },
      },
    });

    // Count conversations with unread messages
    let unreadCount = 0;
    const unreadConversationIds: string[] = [];

    for (const conv of conversations) {
      const lastMessage = conv.messages[0];
      if (lastMessage) {
        const readBy = (lastMessage.readBy as Array<{ userId: string }>) || [];
        const isFromOther =
          lastMessage.senderId !== userId || lastMessage.creatorId;
        const hasRead = readBy.some((r) => r.userId === userId);

        if (isFromOther && !hasRead) {
          unreadCount++;
          unreadConversationIds.push(conv.id);
        }
      }
    }

    return NextResponse.json({
      count: unreadCount,
      conversationIds: unreadConversationIds,
    });
  } catch (error) {
    console.error("Error getting unread count:", error);
    return NextResponse.json(
      { error: "Failed to get unread count" },
      { status: 500 }
    );
  }
}
