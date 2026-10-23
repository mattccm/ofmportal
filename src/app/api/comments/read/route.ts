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

    const userId = session.user.id;

    // Either mark specific comments or all comments on a request. We also collect
    // the affected requestIds so any related unread notifications can be cleared.
    let commentsToMark: { id: string; userId: string; requestId: string | null }[] = [];

    if (commentIds && Array.isArray(commentIds)) {
      commentsToMark = await db.comment.findMany({
        where: { id: { in: commentIds } },
        select: { id: true, userId: true, requestId: true },
      });
    } else if (requestId) {
      commentsToMark = await db.comment.findMany({
        where: { requestId },
        select: { id: true, userId: true, requestId: true },
      });
    }

    const now = new Date().toISOString();

    const affectedRequestIds = new Set<string>();
    for (const c of commentsToMark) if (c.requestId) affectedRequestIds.add(c.requestId);

    // Don't need to mark your own comments as read
    const ids = commentsToMark.filter((c) => c.userId !== userId).map((c) => c.id);

    // Append this user to readBy atomically in one statement, so concurrent readers
    // can't overwrite each other's marks; the @> guard skips already-read comments.
    const markedCount =
      ids.length === 0
        ? 0
        : await db.$executeRaw`
            UPDATE "Comment"
            SET "readBy" = COALESCE("readBy", '[]'::jsonb) || jsonb_build_array(jsonb_build_object('userId', ${userId}::text, 'readAt', ${now}::text))
            WHERE id = ANY(${ids}::text[])
              AND "userId" <> ${userId}
              AND NOT (COALESCE("readBy", '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('userId', ${userId}::text)))`;

    // Clear any unread comment/mention notifications for this user that point at
    // the affected requests, so the bell count stays in sync with what's read.
    if (affectedRequestIds.size > 0) {
      await Promise.all(
        Array.from(affectedRequestIds).map((rid) =>
          db.notification.updateMany({
            where: {
              userId,
              readAt: null,
              type: { in: ["COMMENT_ADDED", "MENTION"] },
              link: { contains: `/requests/${rid}` },
            },
            data: { readAt: new Date() },
          })
        )
      );
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
