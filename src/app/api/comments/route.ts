import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { notifyMention } from "@/lib/notifications";

// ============================================
// SCHEMAS
// ============================================

const createCommentSchema = z.object({
  requestId: z.string().optional(),
  uploadId: z.string().optional(),
  message: z.string().min(1, "Message is required"),
  isInternal: z.boolean().default(false),
  parentId: z.string().optional(),
  mentions: z.array(z.string()).default([]),
});

const updateCommentSchema = z.object({
  id: z.string(),
  message: z.string().min(1, "Message is required"),
  mentions: z.array(z.string()).default([]),
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Extract mentioned user IDs from message
 * Format: @[Name](userId)
 */
function extractMentions(message: string): string[] {
  const mentionRegex = /@\[[^\]]+\]\(([^)]+)\)/g;
  const mentions: string[] = [];
  let match;

  while ((match = mentionRegex.exec(message)) !== null) {
    mentions.push(match[1]);
  }

  return [...new Set(mentions)]; // Remove duplicates
}

/**
 * Send notifications to mentioned users
 */
async function sendMentionNotifications(
  mentionedUserIds: string[],
  mentionerName: string,
  message: string,
  requestId: string | null,
  uploadId: string | null,
  currentUserId: string
) {
  // Don't notify yourself
  const usersToNotify = mentionedUserIds.filter((id) => id !== currentUserId);

  // Get preview of message (remove mention markup)
  const cleanMessage = message.replace(/@\[([^\]]+)\]\([^)]+\)/g, "@$1");
  const preview = cleanMessage.length > 100
    ? cleanMessage.slice(0, 100) + "..."
    : cleanMessage;

  // Build the link
  const link = requestId
    ? `/dashboard/requests/${requestId}${uploadId ? `?upload=${uploadId}` : ""}`
    : "#";

  // Send notifications (use allSettled so one failure doesn't block others)
  const results = await Promise.allSettled(
    usersToNotify.map((userId) =>
      notifyMention(userId, mentionerName, preview, link)
    )
  );

  // Log any failures but don't throw
  const failures = results.filter(r => r.status === "rejected");
  if (failures.length > 0) {
    console.warn(`Failed to send ${failures.length}/${results.length} mention notifications:`,
      failures.map(f => (f as PromiseRejectedResult).reason)
    );
  }
}

/**
 * Parse form data for file uploads
 */
async function parseFormData(req: NextRequest) {
  const formData = await req.formData();

  const data: Record<string, unknown> = {};
  const attachments: { name: string; type: string; size: number; url: string }[] = [];

  for (const [key, value] of formData.entries()) {
    if (key === "attachments" && value instanceof File) {
      // In a real implementation, you would upload to S3/R2 here
      // For now, we'll just store file metadata
      attachments.push({
        name: value.name,
        type: value.type,
        size: value.size,
        url: "#", // Would be the uploaded file URL
      });
    } else if (key === "mentions") {
      try {
        data.mentions = JSON.parse(value as string);
      } catch (e) {
        console.warn("Failed to parse mentions JSON, using empty array:", e);
        data.mentions = [];
      }
    } else if (key === "isInternal") {
      data.isInternal = value === "true";
    } else {
      data[key] = value;
    }
  }

  return { data, attachments };
}

// ============================================
// GET - Fetch comments for a request/upload
// ============================================

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || !session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const requestId = searchParams.get("requestId");
    const uploadId = searchParams.get("uploadId");
    const includeReplies = searchParams.get("includeReplies") !== "false";

    if (!requestId && !uploadId) {
      return NextResponse.json(
        { error: "requestId or uploadId is required" },
        { status: 400 }
      );
    }

    // Verify access
    if (requestId) {
      const request = await db.contentRequest.findFirst({
        where: {
          id: requestId,
          agencyId: session.user.agencyId,
        },
      });

      if (!request) {
        return NextResponse.json(
          { error: "Request not found" },
          { status: 404 }
        );
      }
    }

    // Fetch comments
    const whereClause: Record<string, unknown> = {};
    if (requestId) whereClause.requestId = requestId;
    if (uploadId) whereClause.uploadId = uploadId;

    // Only fetch root-level comments if building tree
    if (includeReplies) {
      whereClause.parentId = null;
    }

    const comments = await db.comment.findMany({
      where: whereClause,
      include: {
        user: {
          select: { id: true, name: true, avatar: true },
        },
        replies: includeReplies
          ? {
              include: {
                user: {
                  select: { id: true, name: true, avatar: true },
                },
                replies: {
                  include: {
                    user: {
                      select: { id: true, name: true, avatar: true },
                    },
                  },
                  orderBy: { createdAt: "asc" },
                },
              },
              orderBy: { createdAt: "asc" },
            }
          : false,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ comments });
  } catch (error) {
    console.error("Error fetching comments:", error);
    return NextResponse.json(
      { error: "Failed to fetch comments" },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Create a new comment
// ============================================

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || !session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check content type to determine how to parse
    const contentType = req.headers.get("content-type") || "";
    let validatedData;
    let attachments: { name: string; type: string; size: number; url: string }[] = [];

    if (contentType.includes("multipart/form-data")) {
      const { data, attachments: parsedAttachments } = await parseFormData(req);
      validatedData = createCommentSchema.parse(data);
      attachments = parsedAttachments;
    } else {
      const body = await req.json();
      validatedData = createCommentSchema.parse(body);
    }

    // Verify access to the request/upload
    if (validatedData.requestId) {
      const request = await db.contentRequest.findFirst({
        where: {
          id: validatedData.requestId,
          agencyId: session.user.agencyId,
        },
      });

      if (!request) {
        return NextResponse.json(
          { error: "Request not found" },
          { status: 404 }
        );
      }
    }

    if (validatedData.uploadId) {
      const upload = await db.upload.findFirst({
        where: {
          id: validatedData.uploadId,
          request: {
            agencyId: session.user.agencyId,
          },
        },
      });

      if (!upload) {
        return NextResponse.json(
          { error: "Upload not found" },
          { status: 404 }
        );
      }
    }

    // Verify parent comment exists and belongs to same request/upload
    if (validatedData.parentId) {
      const parentComment = await db.comment.findFirst({
        where: {
          id: validatedData.parentId,
          ...(validatedData.requestId && { requestId: validatedData.requestId }),
          ...(validatedData.uploadId && { uploadId: validatedData.uploadId }),
        },
      });

      if (!parentComment) {
        return NextResponse.json(
          { error: "Parent comment not found" },
          { status: 404 }
        );
      }
    }

    // Extract mentions from message
    const mentionedUserIds = extractMentions(validatedData.message);

    // Create comment
    const comment = await db.comment.create({
      data: {
        requestId: validatedData.requestId || null,
        uploadId: validatedData.uploadId || null,
        userId: session.user.id,
        message: validatedData.message,
        isInternal: validatedData.isInternal,
        parentId: validatedData.parentId || null,
        mentions: mentionedUserIds,
        attachments: attachments,
        reactions: {},
      },
      include: {
        user: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    // Send mention notifications
    if (mentionedUserIds.length > 0) {
      await sendMentionNotifications(
        mentionedUserIds,
        session.user.name || "Someone",
        validatedData.message,
        validatedData.requestId || null,
        validatedData.uploadId || null,
        session.user.id
      );
    }

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error creating comment:", error);
    return NextResponse.json(
      { error: "Failed to create comment" },
      { status: 500 }
    );
  }
}

// ============================================
// PATCH - Update a comment
// ============================================

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check content type
    const contentType = req.headers.get("content-type") || "";
    let validatedData;
    let newAttachments: { name: string; type: string; size: number; url: string }[] = [];

    if (contentType.includes("multipart/form-data")) {
      const { data, attachments } = await parseFormData(req);
      validatedData = updateCommentSchema.parse(data);
      newAttachments = attachments;
    } else {
      const body = await req.json();
      validatedData = updateCommentSchema.parse(body);
    }

    // Verify ownership
    const existingComment = await db.comment.findUnique({
      where: { id: validatedData.id },
    });

    if (!existingComment) {
      return NextResponse.json(
        { error: "Comment not found" },
        { status: 404 }
      );
    }

    if (existingComment.userId !== session.user.id) {
      return NextResponse.json(
        { error: "You can only edit your own comments" },
        { status: 403 }
      );
    }

    // Extract mentions from new message
    const mentionedUserIds = extractMentions(validatedData.message);

    // Merge attachments (keep existing, add new)
    const existingAttachments = (existingComment.attachments as { name: string; type: string; size: number; url: string }[]) || [];
    const mergedAttachments = [...existingAttachments, ...newAttachments] as { name: string; type: string; size: number; url: string }[];

    // Update comment
    const updatedComment = await db.comment.update({
      where: { id: validatedData.id },
      data: {
        message: validatedData.message,
        mentions: mentionedUserIds,
        attachments: mergedAttachments,
        editedAt: new Date(),
      },
      include: {
        user: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    // Find new mentions (that weren't in the original comment)
    const oldMentions = (existingComment.mentions as string[]) || [];
    const newMentions = mentionedUserIds.filter(
      (id) => !oldMentions.includes(id)
    );

    // Send notifications for new mentions
    if (newMentions.length > 0) {
      await sendMentionNotifications(
        newMentions,
        session.user.name || "Someone",
        validatedData.message,
        existingComment.requestId,
        existingComment.uploadId,
        session.user.id
      );
    }

    return NextResponse.json(updatedComment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error updating comment:", error);
    return NextResponse.json(
      { error: "Failed to update comment" },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - Delete a comment
// ============================================

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const commentId = searchParams.get("id");

    if (!commentId) {
      return NextResponse.json(
        { error: "Comment ID is required" },
        { status: 400 }
      );
    }

    // Verify ownership
    const comment = await db.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      return NextResponse.json(
        { error: "Comment not found" },
        { status: 404 }
      );
    }

    if (comment.userId !== session.user.id) {
      return NextResponse.json(
        { error: "You can only delete your own comments" },
        { status: 403 }
      );
    }

    // Delete comment (cascades to replies due to schema)
    await db.comment.delete({
      where: { id: commentId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting comment:", error);
    return NextResponse.json(
      { error: "Failed to delete comment" },
      { status: 500 }
    );
  }
}
