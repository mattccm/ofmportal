import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// POST /api/comments/read - Mark comments as read
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { commentIds, requestId } = body;

    // Either mark specific comments or all comments on a request
    let commentsToMark: string[] = [];

    if (commentIds && Array.isArray(commentIds)) {
      commentsToMark = commentIds;
    } else if (requestId) {
      // Get all comment IDs for this request
      const comments = await db.comment.findMany({
        where: { requestId },
        select: { id: true },
      });
      commentsToMark = comments.map((c) => c.id);
    }

    if (commentsToMark.length === 0) {
      return NextResponse.json({ marked: 0 });
    }

    const now = new Date().toISOString();
    const userId = session.user.id;

    // Update each comment's readBy array
    let markedCount = 0;
    for (const commentId of commentsToMark) {
      const comment = await db.comment.findUnique({
        where: { id: commentId },
        select: { readBy: true, userId: true },
      });

      if (!comment) continue;

      // Don't need to mark your own comments as read
      if (comment.userId === userId) continue;

      const readBy = (comment.readBy as Array<{ userId: string; readAt: string }>) || [];

      // Check if already read by this user
      if (readBy.some((r) => r.userId === userId)) continue;

      // Add this user to readBy
      await db.comment.update({
        where: { id: commentId },
        data: {
          readBy: [...readBy, { userId, readAt: now }],
        },
      });
      markedCount++;
    }

    return NextResponse.json({ marked: markedCount });
  } catch (error) {
    console.error("Error marking comments as read:", error);
    return NextResponse.json(
      { error: "Failed to mark comments as read" },
      { status: 500 }
    );
  }
}
