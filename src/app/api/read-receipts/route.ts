import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { forbidden, requestWhere, requireAccess, type Access } from "@/lib/access/server";
import { INBOX_KEYS, visibleConversationWhere } from "@/lib/conversation-access";

/** Messages in threads this person is in and their role lets them see */
function myMessagesWhere(access: Access): Prisma.MessageWhereInput {
  return {
    conversation: {
      AND: [
        { participants: { some: { userId: access.userId } } },
        { OR: [{ agencyId: access.agencyId }, { agencyId: null }] },
        visibleConversationWhere(access),
      ],
    },
  };
}

/** Per-target permission: messages need a messages key, requests and comments need "See requests" */
function targetDenied(access: Access, target: { messageId?: unknown; requestId?: unknown; commentId?: unknown }) {
  if (target.messageId && !access.hasAny([...INBOX_KEYS])) return forbidden([...INBOX_KEYS]);
  if (!target.messageId && (target.requestId || target.commentId) && !access.has("requests.view")) {
    return forbidden("requests.view");
  }
  return null;
}
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
    const gate = await requireAccess(null);
    if (gate.error) return gate.error;
    const { access, session } = gate;

    const body: MarkAsReadRequest = await req.json();
    const { messageId, requestId, commentId, deviceType } = body;

    // Validate that at least one ID is provided
    if (!messageId && !requestId && !commentId) {
      return NextResponse.json(
        { error: "messageId, requestId, or commentId is required" },
        { status: 400 }
      );
    }
    const denied = targetDenied(access, body);
    if (denied) return denied;

    const userId = session.user.id;
    const now = new Date();

    // Handle message read receipt
    if (messageId) {
      const message = await db.message.findFirst({
        where: { AND: [{ id: messageId }, myMessagesWhere(access)] },
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
      const request = await db.contentRequest.findFirst({
        where: { AND: [requestWhere(access), { id: requestId }] },
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
      const comment = await db.comment.findFirst({
        where: { id: commentId, request: requestWhere(access) },
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
    const gate = await requireAccess(null);
    if (gate.error) return gate.error;
    const { access, session } = gate;

    const { searchParams } = new URL(req.url);
    const messageId = searchParams.get("messageId");
    const requestId = searchParams.get("requestId");
    const commentId = searchParams.get("commentId");
    const denied = targetDenied(access, { messageId, requestId, commentId });
    if (denied) return denied;

    const userId = session.user.id;

    // Get read receipts for a message
    if (messageId) {
      const message = await db.message.findFirst({
        where: { AND: [{ id: messageId }, myMessagesWhere(access)] },
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
      const request = await db.contentRequest.findFirst({
        where: { AND: [requestWhere(access), { id: requestId }] },
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
          // The creator's email only for roles that may see it
          userEmail: access.has("creatorInfo.email") ? request.creator.email || undefined : undefined,
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
      const comment = await db.comment.findFirst({
        where: { id: commentId, request: requestWhere(access) },
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
    const gate = await requireAccess(null);
    if (gate.error) return gate.error;
    const { access, session } = gate;

    const { searchParams } = new URL(req.url);
    const messageId = searchParams.get("messageId");
    const requestId = searchParams.get("requestId");
    if (!messageId && requestId && !access.has("requests.edit")) return forbidden("requests.edit");
    const denied = targetDenied(access, { messageId, requestId });
    if (denied) return denied;

    const userId = session.user.id;

    // Remove read receipt from a message
    if (messageId) {
      const message = await db.message.findFirst({
        where: { AND: [{ id: messageId }, myMessagesWhere(access)] },
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
      const request = await db.contentRequest.findFirst({
        where: { AND: [requestWhere(access), { id: requestId }] },
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
