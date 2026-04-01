import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

// ============================================
// SCHEMAS
// ============================================

const reactionSchema = z.object({
  commentId: z.string(),
  emoji: z.string().min(1).max(10), // Single emoji or emoji sequence
});

// ============================================
// POST - Toggle reaction on a comment
// ============================================

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || !session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { commentId, emoji } = reactionSchema.parse(body);

    // Fetch the comment
    const comment = await db.comment.findUnique({
      where: { id: commentId },
      include: {
        request: {
          select: { agencyId: true },
        },
        upload: {
          select: {
            request: {
              select: { agencyId: true },
            },
          },
        },
      },
    });

    if (!comment) {
      return NextResponse.json(
        { error: "Comment not found" },
        { status: 404 }
      );
    }

    // Verify access - user must belong to the same agency
    const commentAgencyId =
      comment.request?.agencyId || comment.upload?.request?.agencyId;

    if (commentAgencyId && commentAgencyId !== session.user.agencyId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Get current reactions
    const currentReactions = (comment.reactions as Record<string, string[]>) || {};

    // Toggle reaction for this user
    const userReactions = currentReactions[emoji] || [];
    const hasReacted = userReactions.includes(session.user.id);

    let updatedReactions: Record<string, string[]>;

    if (hasReacted) {
      // Remove reaction
      updatedReactions = {
        ...currentReactions,
        [emoji]: userReactions.filter((id) => id !== session.user.id),
      };

      // Clean up empty emoji arrays
      if (updatedReactions[emoji].length === 0) {
        delete updatedReactions[emoji];
      }
    } else {
      // Add reaction
      updatedReactions = {
        ...currentReactions,
        [emoji]: [...userReactions, session.user.id],
      };
    }

    // Update the comment
    await db.comment.update({
      where: { id: commentId },
      data: {
        reactions: updatedReactions,
      },
    });

    return NextResponse.json({
      reactions: updatedReactions,
      action: hasReacted ? "removed" : "added",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error toggling reaction:", error);
    return NextResponse.json(
      { error: "Failed to toggle reaction" },
      { status: 500 }
    );
  }
}

// ============================================
// GET - Get reactions for a comment
// ============================================

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const commentId = searchParams.get("commentId");

    if (!commentId) {
      return NextResponse.json(
        { error: "commentId is required" },
        { status: 400 }
      );
    }

    const comment = await db.comment.findUnique({
      where: { id: commentId },
      select: { reactions: true },
    });

    if (!comment) {
      return NextResponse.json(
        { error: "Comment not found" },
        { status: 404 }
      );
    }

    const reactions = (comment.reactions as Record<string, string[]>) || {};

    // Get user details for reaction tooltips
    const allUserIds = [...new Set(Object.values(reactions).flat())];

    const users = await db.user.findMany({
      where: { id: { in: allUserIds } },
      select: { id: true, name: true, avatar: true },
    });

    const userMap = Object.fromEntries(
      users.map((user) => [user.id, user])
    );

    // Build response with user details
    const reactionsWithUsers: Record<
      string,
      { userId: string; name: string; avatar: string | null }[]
    > = {};

    for (const [emoji, userIds] of Object.entries(reactions)) {
      reactionsWithUsers[emoji] = userIds.map((userId) => ({
        userId,
        name: userMap[userId]?.name || "Unknown",
        avatar: userMap[userId]?.avatar || null,
      }));
    }

    return NextResponse.json({
      reactions,
      reactionsWithUsers,
    });
  } catch (error) {
    console.error("Error fetching reactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch reactions" },
      { status: 500 }
    );
  }
}
