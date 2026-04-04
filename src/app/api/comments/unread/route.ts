import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

interface ReadByEntry {
  userId: string;
  readAt: string;
}

// GET /api/comments/unread - Get unread comment counts
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestId = searchParams.get("requestId");
    const groupBy = searchParams.get("groupBy"); // "request" to get per-request counts

    const userId = session.user.id;
    const agencyId = session.user.agencyId;

    // Build where clause
    const where: Record<string, unknown> = {
      // Only count non-internal comments not authored by the current user
      userId: { not: userId },
      isInternal: false,
      request: {
        agencyId,
      },
    };

    if (requestId) {
      where.requestId = requestId;
    }

    // Get all relevant comments
    const comments = await db.comment.findMany({
      where,
      select: {
        id: true,
        requestId: true,
        readBy: true,
        createdAt: true,
      },
    });

    // Filter to unread comments (not in readBy array for current user)
    const unreadComments = comments.filter((comment) => {
      const readBy = (comment.readBy as unknown as ReadByEntry[]) || [];
      return !readBy.some((r) => r.userId === userId);
    });

    if (groupBy === "request") {
      // Group by requestId
      const countsByRequest: Record<string, number> = {};
      for (const comment of unreadComments) {
        if (comment.requestId) {
          countsByRequest[comment.requestId] = (countsByRequest[comment.requestId] || 0) + 1;
        }
      }
      return NextResponse.json({
        total: unreadComments.length,
        byRequest: countsByRequest,
      });
    }

    return NextResponse.json({
      total: unreadComments.length,
      requestId: requestId || null,
    });
  } catch (error) {
    console.error("Error getting unread comment counts:", error);
    return NextResponse.json(
      { error: "Failed to get unread counts" },
      { status: 500 }
    );
  }
}
