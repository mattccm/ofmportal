import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  MarkAsReadRequest,
  MarkAsReadResponse,
  GetReadReceiptsResponse,
  ReadReceiptWithUser,
} from "@/types/read-receipts";

/**
 * POST /api/read-receipts
 * Mark a message, request, or comment as read
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: MarkAsReadRequest = await req.json();
    const { messageId, requestId, commentId, deviceType } = body;

    // Validate that at least one ID is provided
    if (!messageId && !requestId && !commentId) {
      return NextResponse.json(
        { error: "messageId, requestId, or commentId is required" },
        { status: 400 }
      );
    }

    const userId = session.user.id;
    const now = new Date();

    // Handle message read receipt
    if (messageId) {
      const message = await db.message.findUnique({
        where: { id: messageId },
        include: {
          conversation: {
            include: {
              participants: true,
            },
          },
        },
      });

      if (!message) {
        return NextResponse.json({ error: "Message not found" }, { status: 404 });
      }

      // Verify user is a participant
      const isParticipant = message.conversation.participants.some(
        (p) => p.userId === userId
      );

      if (!isParticipant) {
        return NextResponse.json(
          { error: "Not authorized to mark this message as read" },
          { status: 403 }
        );
      }

      // Don't mark own messages as read
      if (message.senderId === userId) {
        return NextResponse.json({
          success: true,
          receipt: {
            id: `receipt_${messageId}_${userId}`,
            messageId,
            userId,
            readAt: now,
            deviceType,
          },
        });
      }

      // Update read status
      const readByArray = (message.readBy as string[]) || [];
      if (!readByArray.includes(userId)) {
        await db.message.update({
          where: { id: messageId },
          data: {
            readBy: [...readByArray, userId],
          },
        });
      }

      const response: MarkAsReadResponse = {
        success: true,
        receipt: {
          id: `receipt_${messageId}_${userId}`,
          messageId,
          userId,
          readAt: now,
          deviceType,
        },
      };

      return NextResponse.json(response);
    }

    // Handle request read receipt
    if (requestId) {
      const request = await db.contentRequest.findUnique({
        where: { id: requestId },
      });

      if (!request) {
        return NextResponse.json({ error: "Request not found" }, { status: 404 });
      }

      // Update the request's view status using available schema fields
      await db.contentRequest.update({
        where: { id: requestId },
        data: {
          viewedAt: now,
          viewedByCreator: true,
          viewCount: { increment: 1 },
          lastViewedAt: now,
        },
      });

      const response: MarkAsReadResponse = {
        success: true,
        receipt: {
          id: `receipt_${requestId}_${userId}`,
          requestId,
          userId,
          readAt: now,
          deviceType,
        },
      };

      return NextResponse.json(response);
    }

    // Handle comment read receipt
    if (commentId) {
      const comment = await db.comment.findUnique({
        where: { id: commentId },
      });

      if (!comment) {
        return NextResponse.json({ error: "Comment not found" }, { status: 404 });
      }

      // For comments, we'd typically track this in a separate table
      // For now, we return success (in production, implement proper tracking)
      const response: MarkAsReadResponse = {
        success: true,
        receipt: {
          id: `receipt_${commentId}_${userId}`,
          commentId,
          userId,
          readAt: now,
          deviceType,
        },
      };

      return NextResponse.json(response);
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (error) {
    console.error("Error marking as read:", error);
    return NextResponse.json(
      { error: "Failed to mark as read" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/read-receipts
 * Get read receipts for a message, request, or comment
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const messageId = searchParams.get("messageId");
    const requestId = searchParams.get("requestId");
    const commentId = searchParams.get("commentId");

    const userId = session.user.id;

    // Get read receipts for a message
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
                      email: true,
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
        return NextResponse.json({ error: "Message not found" }, { status: 404 });
      }

      // Verify user is a participant
      const isParticipant = message.conversation.participants.some(
        (p) => p.userId === userId
      );

      if (!isParticipant) {
        return NextResponse.json(
          { error: "Not authorized to view read receipts for this message" },
          { status: 403 }
        );
      }

      const readByArray = (message.readBy as string[]) || [];
      const receipts: ReadReceiptWithUser[] = message.conversation.participants
        .filter((p) => readByArray.includes(p.userId))
        .map((p) => ({
          id: `receipt_${messageId}_${p.userId}`,
          messageId,
          userId: p.userId,
          userName: p.user.name || "Unknown",
          userEmail: p.user.email || undefined,
          userAvatar: p.user.avatar || undefined,
          readAt: new Date(), // Would be actual read time with proper tracking
        }));

      const response: GetReadReceiptsResponse = {
        receipts,
        totalCount: receipts.length,
      };

      return NextResponse.json(response);
    }

    // Get read receipts for a request
    if (requestId) {
      const request = await db.contentRequest.findUnique({
        where: { id: requestId },
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
        },
      });

      if (!request) {
        return NextResponse.json({ error: "Request not found" }, { status: 404 });
      }

      const receipts: ReadReceiptWithUser[] = [];

      // If the request has been viewed, add the creator as having viewed it
      if (request.viewedAt && request.viewedByCreator && request.creator) {
        receipts.push({
          id: `receipt_${requestId}_${request.creator.id}`,
          requestId,
          userId: request.creator.id,
          userName: request.creator.name || "Unknown",
          userEmail: request.creator.email || undefined,
          userAvatar: request.creator.avatar || undefined,
          readAt: request.viewedAt,
        });
      }

      const response: GetReadReceiptsResponse = {
        receipts,
        totalCount: receipts.length,
      };

      return NextResponse.json(response);
    }

    // Get read receipts for a comment (placeholder - implement based on your schema)
    if (commentId) {
      const comment = await db.comment.findUnique({
        where: { id: commentId },
      });

      if (!comment) {
        return NextResponse.json({ error: "Comment not found" }, { status: 404 });
      }

      // Return empty receipts for now (implement proper tracking in production)
      const response: GetReadReceiptsResponse = {
        receipts: [],
        totalCount: 0,
      };

      return NextResponse.json(response);
    }

    return NextResponse.json(
      { error: "messageId, requestId, or commentId is required" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error getting read receipts:", error);
    return NextResponse.json(
      { error: "Failed to get read receipts" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/read-receipts
 * Remove a read receipt (for privacy)
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const messageId = searchParams.get("messageId");
    const requestId = searchParams.get("requestId");

    const userId = session.user.id;

    // Remove read receipt from a message
    if (messageId) {
      const message = await db.message.findUnique({
        where: { id: messageId },
      });

      if (!message) {
        return NextResponse.json({ error: "Message not found" }, { status: 404 });
      }

      const readByArray = (message.readBy as string[]) || [];

      if (readByArray.includes(userId)) {
        await db.message.update({
          where: { id: messageId },
          data: {
            readBy: readByArray.filter((id) => id !== userId),
          },
        });
      }

      return NextResponse.json({
        success: true,
        message: "Read receipt removed",
      });
    }

    // Remove view from a request
    if (requestId) {
      const request = await db.contentRequest.findUnique({
        where: { id: requestId },
      });

      if (!request) {
        return NextResponse.json({ error: "Request not found" }, { status: 404 });
      }

      // Reset the view state
      await db.contentRequest.update({
        where: { id: requestId },
        data: {
          viewedAt: null,
          viewedByCreator: false,
          lastViewedAt: null,
        },
      });

      return NextResponse.json({
        success: true,
        message: "View receipt removed",
      });
    }

    return NextResponse.json(
      { error: "messageId or requestId is required" },
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
