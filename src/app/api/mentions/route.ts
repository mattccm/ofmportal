import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { extractMentionIds } from "@/lib/mention-parser";
import { MentionContextType } from "@prisma/client";

// ============================================
// GET /api/mentions - List mentions for current user
// ============================================

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");
    const readParam = searchParams.get("read");
    const contextType = searchParams.get("contextType");

    // Build where clause
    const where: Record<string, unknown> = {
      mentionedUserId: session.user.id,
    };

    if (readParam !== null) {
      where.read = readParam === "true";
    }

    if (contextType && contextType !== "all") {
      where.contextType = contextType as MentionContextType;
    }

    // Fetch mentions
    const [mentions, total] = await Promise.all([
      db.mention.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      db.mention.count({ where }),
    ]);

    // Get mentioned by user details
    const mentionedByIds = [...new Set(mentions.map((m) => m.mentionedById))];
    const users = await db.user.findMany({
      where: { id: { in: mentionedByIds } },
      select: { id: true, name: true, email: true, avatar: true },
    });
    const usersMap = new Map(users.map((u) => [u.id, u]));

    // Transform mentions with user details and context info
    const mentionsWithDetails = await Promise.all(
      mentions.map(async (mention) => {
        const mentionedBy = usersMap.get(mention.mentionedById);
        let contextDetails = { title: "Unknown", url: mention.contextUrl || "#" };

        try {
          // Fetch context details based on type
          if (mention.contextType === "REQUEST") {
            const request = await db.contentRequest.findUnique({
              where: { id: mention.contextId },
              select: { id: true, title: true },
            });
            if (request) {
              contextDetails = {
                title: request.title,
                url: `/dashboard/requests/${request.id}`,
              };
            }
          } else if (mention.contextType === "COMMENT") {
            const comment = await db.comment.findUnique({
              where: { id: mention.contextId },
              select: { id: true, requestId: true, uploadId: true },
            });
            if (comment) {
              const url = comment.requestId
                ? `/dashboard/requests/${comment.requestId}#comment-${comment.id}`
                : comment.uploadId
                ? `/dashboard/uploads/${comment.uploadId}#comment-${comment.id}`
                : "#";
              contextDetails = {
                title: "Comment",
                url,
              };
            }
          } else if (mention.contextType === "MESSAGE") {
            const message = await db.message.findUnique({
              where: { id: mention.contextId },
              select: { id: true, conversationId: true },
            });
            if (message) {
              contextDetails = {
                title: "Message",
                url: `/dashboard/messages/${message.conversationId}`,
              };
            }
          }
        } catch (error) {
          console.error("Error fetching context details:", error);
        }

        return {
          id: mention.id,
          content: mention.content,
          contextType: mention.contextType,
          contextId: mention.contextId,
          contextUrl: contextDetails.url,
          contextTitle: contextDetails.title,
          read: mention.read,
          readAt: mention.readAt,
          createdAt: mention.createdAt,
          mentionedBy: mentionedBy
            ? {
                id: mentionedBy.id,
                name: mentionedBy.name,
                email: mentionedBy.email,
                initials: mentionedBy.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2),
                avatarUrl: mentionedBy.avatar,
              }
            : null,
        };
      })
    );

    return NextResponse.json({
      mentions: mentionsWithDetails,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    console.error("Error fetching mentions:", error);
    return NextResponse.json(
      { error: "Failed to fetch mentions" },
      { status: 500 }
    );
  }
}

// ============================================
// POST /api/mentions - Create mentions from content
// ============================================

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { content, contextType, contextId, contextUrl } = body;

    if (!content || !contextType || !contextId) {
      return NextResponse.json(
        { error: "Missing required fields: content, contextType, contextId" },
        { status: 400 }
      );
    }

    // Extract user IDs from @mentions
    const mentionedUserIds = extractMentionIds(content);

    if (mentionedUserIds.length === 0) {
      return NextResponse.json({ mentions: [], created: 0 });
    }

    // Verify mentioned users exist and belong to the same agency
    const validUsers = await db.user.findMany({
      where: {
        id: { in: mentionedUserIds },
        agencyId: session.user.agencyId,
      },
      select: { id: true },
    });

    const validUserIds = validUsers.map((u) => u.id);

    // Create mentions
    const mentions = await Promise.all(
      validUserIds.map((userId) =>
        db.mention.create({
          data: {
            agencyId: session.user.agencyId!,
            mentionedById: session.user.id,
            mentionedUserId: userId,
            contextType: contextType as MentionContextType,
            contextId,
            contextUrl: contextUrl || null,
            content: content.substring(0, 500), // Limit content length
          },
        })
      )
    );

    // Create notifications for each mentioned user
    await Promise.all(
      mentions.map((mention) =>
        db.notification.create({
          data: {
            userId: mention.mentionedUserId,
            type: "mention",
            title: "You were mentioned",
            message: `${session.user.name} mentioned you`,
            link: mention.contextUrl,
          },
        })
      )
    );

    return NextResponse.json({
      mentions,
      created: mentions.length,
    });
  } catch (error) {
    console.error("Error creating mentions:", error);
    return NextResponse.json(
      { error: "Failed to create mentions" },
      { status: 500 }
    );
  }
}
