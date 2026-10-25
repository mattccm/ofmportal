import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requestWhere, requireAccess } from "@/lib/access/server";

/** Comments page and nav badge follow the Comments nav item: "See requests" */
const COMMENTS_KEY = "requests.view" as const;

interface ReadByEntry {
  userId: string;
  readAt: string;
}

/**
 * GET /api/creator-messages
 * Fetch all comments from creators across all requests for the agency
 */
export async function GET(req: NextRequest) {
  try {
    const gate = await requireAccess(COMMENTS_KEY);
    if (gate.error) return gate.error;
    const { access, session } = gate;

    const agencyId = access.agencyId;
    const userId = session.user.id;
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const unreadOnly = url.searchParams.get("unreadOnly") === "true";

    // Creator comments are authored by per-creator pseudo-users
    // (creator-<id>@<agencyId>.internal), so match all of them, not just one.
    // Only non-internal comments (visible to creators = from creators)
    // Only comments on requests whose creator this person can see
    const whereClause: Prisma.CommentWhereInput = {
      isInternal: false,
      request: requestWhere(access),
      user: {
        email: { endsWith: `@${agencyId}.internal` },
      },
    };

    // Get all creator comments to calculate unread count
    const allComments = await db.comment.findMany({
      where: whereClause,
      select: {
        id: true,
        readBy: true,
      },
    });

    // Calculate unread count - comments where current user hasn't read
    const unreadCount = allComments.filter((comment) => {
      const readBy = (comment.readBy as unknown as ReadByEntry[]) || [];
      return !readBy.some((r) => r.userId === userId);
    }).length;

    const [comments, total] = await Promise.all([
      db.comment.findMany({
        where: whereClause,
        select: {
          id: true,
          message: true,
          createdAt: true,
          mentions: true,
          readBy: true,
          request: {
            select: {
              id: true,
              title: true,
              status: true,
              creator: {
                select: {
                  id: true,
                  name: true,
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

      // Check if current user has read this comment
      const readBy = (comment.readBy as Array<{ userId: string; readAt: string }>) || [];
      const isRead = readBy.some((r) => r.userId === userId);

      return {
        id: comment.id,
        message: comment.message,
        createdAt: comment.createdAt.toISOString(),
        isRead,
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
      unreadCount,
    });
  } catch (error) {
    console.error("Error fetching creator messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch creator messages" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/creator-messages
 * Mark creator comments as read
 */
export async function POST(req: NextRequest) {
  try {
    const gate = await requireAccess(COMMENTS_KEY);
    if (gate.error) return gate.error;
    const { access, session } = gate;

    const agencyId = access.agencyId;
    const userId = session.user.id;
    const body = await req.json();
    const { commentIds, markAllRead } = body as { commentIds?: string[]; markAllRead?: boolean };

    let commentsToMark: { id: string; readBy: unknown }[] = [];

    if (markAllRead) {
      // Get all unread creator comments
      const whereClause: Prisma.CommentWhereInput = {
        isInternal: false,
        request: requestWhere(access),
        user: {
          email: { endsWith: `@${agencyId}.internal` },
        },
      };

      commentsToMark = await db.comment.findMany({
        where: whereClause,
        select: {
          id: true,
          readBy: true,
        },
      });
    } else if (commentIds && commentIds.length > 0) {
      // Get specific comments
      commentsToMark = await db.comment.findMany({
        where: {
          id: { in: commentIds },
          isInternal: false,
          request: requestWhere(access),
          user: { email: { endsWith: `@${agencyId}.internal` } },
        },
        select: {
          id: true,
          readBy: true,
        },
      });
    }

    // Append this user to readBy atomically in one statement, so concurrent readers
    // can't overwrite each other's marks; the @> guard skips already-read comments.
    const now = new Date().toISOString();
    const ids = commentsToMark.map((c) => c.id);
    const marked =
      ids.length === 0
        ? 0
        : await db.$executeRaw`
            UPDATE "Comment"
            SET "readBy" = COALESCE("readBy", '[]'::jsonb) || jsonb_build_array(jsonb_build_object('userId', ${userId}::text, 'readAt', ${now}::text))
            WHERE id = ANY(${ids}::text[])
              AND NOT (COALESCE("readBy", '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('userId', ${userId}::text)))`;

    return NextResponse.json({ marked });
  } catch (error) {
    console.error("Error marking creator messages as read:", error);
    return NextResponse.json(
      { error: "Failed to mark messages as read" },
      { status: 500 }
    );
  }
}
