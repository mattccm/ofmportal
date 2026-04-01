import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";

// Types for read receipt tracking
export interface ReadReceiptData {
  userId: string;
  userName: string;
  userAvatar?: string | null;
  readAt: string;
}

export interface MessageReadStatus {
  messageId: string;
  isRead: boolean;
  readBy: ReadReceiptData[];
  readCount: number;
}

/**
 * POST /api/messages/read
 * Mark messages as read by the current user
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { messageId, messageIds, conversationId } = body;

    // Validate input - accept single message or array of messages
    const idsToMark: string[] = messageIds || (messageId ? [messageId] : []);

    if (idsToMark.length === 0 && !conversationId) {
      return NextResponse.json(
        { error: "messageId, messageIds, or conversationId is required" },
        { status: 400 }
      );
    }

    const userId = session.user.id;
    const now = new Date();
    const updatedMessages: string[] = [];

    // If conversationId is provided, mark all messages in conversation as read
    if (conversationId) {
      // Verify user is a participant in the conversation
      const participant = await db.conversationParticipant.findUnique({
        where: {
          conversationId_userId: {
            conversationId,
            userId,
          },
        },
      });

      if (!participant) {
        return NextResponse.json(
          { error: "Not a participant in this conversation" },
          { status: 403 }
        );
      }

      // Get all unread messages in the conversation
      const messages = await db.message.findMany({
        where: {
          conversationId,
          senderId: { not: userId },
        },
        select: {
          id: true,
          readBy: true,
        },
      });

      // Update each message that hasn't been read by this user
      for (const message of messages) {
        const readByArray = (message.readBy as string[]) || [];
        if (!readByArray.includes(userId)) {
          await db.message.update({
            where: { id: message.id },
            data: {
              readBy: [...readByArray, userId],
            },
          });
          updatedMessages.push(message.id);
        }
      }
    } else {
      // Mark specific messages as read
      for (const id of idsToMark) {
        const message = await db.message.findUnique({
          where: { id },
          include: {
            conversation: {
              include: {
                participants: true,
              },
            },
          },
        });

        if (!message) {
          continue;
        }

        // Verify user is a participant in the conversation
        const isParticipant = message.conversation.participants.some(
          (p) => p.userId === userId
        );

        if (!isParticipant) {
          continue;
        }

        // Don't mark own messages as read
        if (message.senderId === userId) {
          continue;
        }

        // Check if already read
        const readByArray = (message.readBy as string[]) || [];
        if (readByArray.includes(userId)) {
          continue;
        }

        // Update the message
        await db.message.update({
          where: { id },
          data: {
            readBy: [...readByArray, userId],
          },
        });

        updatedMessages.push(id);
      }
    }

    return NextResponse.json({
      success: true,
      markedAsRead: updatedMessages.length,
      messageIds: updatedMessages,
      readAt: now.toISOString(),
    });
  } catch (error) {
    console.error("Error marking messages as read:", error);
    return NextResponse.json(
      { error: "Failed to mark messages as read" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/messages/read
 * Get read status for messages
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const messageId = searchParams.get("messageId");
    const messageIds = searchParams.get("messageIds");
    const conversationId = searchParams.get("conversationId");

    const userId = session.user.id;

    // Get read status for a single message
    if (messageId) {
      const message = await db.message.findUnique({
        where: { id: messageId },
        include: {
          conversation: {
            include: {
              participants: {
                include: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      avatar: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!message) {
        return NextResponse.json(
          { error: "Message not found" },
          { status: 404 }
        );
      }

      // Verify user is a participant
      const isParticipant = message.conversation.participants.some(
        (p) => p.userId === userId
      );

      if (!isParticipant) {
        return NextResponse.json(
          { error: "Not authorized to view this message" },
          { status: 403 }
        );
      }

      const readByArray = (message.readBy as string[]) || [];
      const readByUsers = message.conversation.participants
        .filter((p) => readByArray.includes(p.userId))
        .map((p) => ({
          userId: p.userId,
          userName: p.user.name,
          userAvatar: p.user.avatar,
          readAt: new Date().toISOString(), // Would be actual read time with proper tracking
        }));

      const status: MessageReadStatus = {
        messageId: message.id,
        isRead: readByArray.length > 0,
        readBy: readByUsers,
        readCount: readByArray.length,
      };

      return NextResponse.json(status);
    }

    // Get read status for multiple messages
    if (messageIds) {
      const ids = messageIds.split(",");
      const messages = await db.message.findMany({
        where: {
          id: { in: ids },
        },
        include: {
          conversation: {
            include: {
              participants: {
                include: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      avatar: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      const statuses: MessageReadStatus[] = messages
        .filter((message) =>
          message.conversation.participants.some((p) => p.userId === userId)
        )
        .map((message) => {
          const readByArray = (message.readBy as string[]) || [];
          const readByUsers = message.conversation.participants
            .filter((p) => readByArray.includes(p.userId))
            .map((p) => ({
              userId: p.userId,
              userName: p.user.name,
              userAvatar: p.user.avatar,
              readAt: new Date().toISOString(),
            }));

          return {
            messageId: message.id,
            isRead: readByArray.length > 0,
            readBy: readByUsers,
            readCount: readByArray.length,
          };
        });

      return NextResponse.json({ statuses });
    }

    // Get unread count for a conversation
    if (conversationId) {
      // Verify user is a participant
      const participant = await db.conversationParticipant.findUnique({
        where: {
          conversationId_userId: {
            conversationId,
            userId,
          },
        },
      });

      if (!participant) {
        return NextResponse.json(
          { error: "Not a participant in this conversation" },
          { status: 403 }
        );
      }

      const messages = await db.message.findMany({
        where: {
          conversationId,
          senderId: { not: userId },
        },
        select: {
          id: true,
          readBy: true,
        },
      });

      const unreadCount = messages.filter((message) => {
        const readByArray = (message.readBy as string[]) || [];
        return !readByArray.includes(userId);
      }).length;

      return NextResponse.json({
        conversationId,
        unreadCount,
        totalMessages: messages.length,
      });
    }

    return NextResponse.json(
      { error: "messageId, messageIds, or conversationId is required" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error getting read status:", error);
    return NextResponse.json(
      { error: "Failed to get read status" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/messages/read
 * Remove read receipt (if privacy settings changed)
 * This is an advanced feature for privacy-conscious users
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const messageId = searchParams.get("messageId");
    const conversationId = searchParams.get("conversationId");

    const userId = session.user.id;

    if (conversationId) {
      // Remove all read receipts from this user in the conversation
      const messages = await db.message.findMany({
        where: {
          conversationId,
          senderId: { not: userId },
        },
        select: {
          id: true,
          readBy: true,
        },
      });

      let removedCount = 0;

      for (const message of messages) {
        const readByArray = (message.readBy as string[]) || [];
        if (readByArray.includes(userId)) {
          await db.message.update({
            where: { id: message.id },
            data: {
              readBy: readByArray.filter((id) => id !== userId),
            },
          });
          removedCount++;
        }
      }

      return NextResponse.json({
        success: true,
        removedCount,
      });
    }

    if (messageId) {
      const message = await db.message.findUnique({
        where: { id: messageId },
      });

      if (!message) {
        return NextResponse.json(
          { error: "Message not found" },
          { status: 404 }
        );
      }

      const readByArray = (message.readBy as string[]) || [];

      if (!readByArray.includes(userId)) {
        return NextResponse.json({
          success: true,
          message: "Read receipt not found",
        });
      }

      await db.message.update({
        where: { id: messageId },
        data: {
          readBy: readByArray.filter((id) => id !== userId),
        },
      });

      return NextResponse.json({
        success: true,
        message: "Read receipt removed",
      });
    }

    return NextResponse.json(
      { error: "messageId or conversationId is required" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error removing read receipt:", error);
    return NextResponse.json(
      { error: "Failed to remove read receipt" },
      { status: 500 }
    );
  }
}
