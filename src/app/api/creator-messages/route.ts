import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/creator-messages
 * Fetch all comments from creators across all requests for the agency
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const agencyId = session.user.agencyId;
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const unreadOnly = url.searchParams.get("unreadOnly") === "true";

    // Find the system user for creator comments
    const systemUser = await db.user.findFirst({
      where: {
        email: {
          endsWith: `@${agencyId}.internal`,
        },
      },
    });

    if (!systemUser) {
      // No creator comments exist yet
      return NextResponse.json({
        messages: [],
        total: 0,
        unreadCount: 0,
      });
    }

    // Get all comments from the system user (these are creator comments)
    // Only non-internal comments (visible to creators = from creators)
    const whereClause = {
      userId: systemUser.id,
      isInternal: false,
      request: {
        agencyId: agencyId,
      },
    };

    const [comments, total] = await Promise.all([
      db.comment.findMany({
        where: whereClause,
        include: {
          request: {
            select: {
              id: true,
              title: true,
              status: true,
              creator: {
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
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      db.comment.count({ where: whereClause }),
    ]);

    // Parse creator info from mentions field and format response
    const messages = comments.map((comment) => {
      let creatorInfo = null;
      try {
        const mentions =
          typeof comment.mentions === "string"
            ? JSON.parse(comment.mentions)
            : comment.mentions;
        if (
          Array.isArray(mentions) &&
          mentions.length > 0 &&
          mentions[0]?.type === "creator"
        ) {
          creatorInfo = mentions[0];
        }
      } catch {
        // Invalid JSON
      }

      return {
        id: comment.id,
        message: comment.message,
        createdAt: comment.createdAt.toISOString(),
        request: comment.request
          ? {
              id: comment.request.id,
              title: comment.request.title,
              status: comment.request.status,
            }
          : null,
        creator: creatorInfo
          ? {
              id: creatorInfo.id,
              name: creatorInfo.name,
              avatar: comment.request?.creator?.avatar || null,
            }
          : comment.request?.creator
            ? {
                id: comment.request.creator.id,
                name: comment.request.creator.name,
                avatar: comment.request.creator.avatar,
              }
            : null,
      };
    });

    return NextResponse.json({
      messages,
      total,
      unreadCount: total, // For now, all are "unread" - could add read tracking later
    });
  } catch (error) {
    console.error("Error fetching creator messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch creator messages" },
      { status: 500 }
    );
  }
}
