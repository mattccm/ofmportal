import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateCreatorSession, CREATOR_HIDDEN_STATUSES } from "@/lib/portal-auth";
import { notifyTeam, NotificationType } from "@/lib/notifications";

/**
 * GET /api/portal/requests/[id]/comments
 * Fetch comments for a specific request (creator-visible comments only)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authResult = await validateCreatorSession(req);
    if (!authResult.success) {
      return authResult.error;
    }
    const creator = authResult.creator;

    // Verify request belongs to creator
    const request = await db.contentRequest.findFirst({
      where: {
        id,
        creatorId: creator.id,
        status: { notIn: CREATOR_HIDDEN_STATUSES },
      },
    });

    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    // Fetch comments (non-internal only)
    const comments = await db.comment.findMany({
      where: {
        requestId: id,
        isInternal: false,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Transform comments for the frontend
    // Creator comments carry a { type: "creator" } marker in `mentions`
    const transformedComments = comments.map((comment) => {
      let creatorInfo: { name?: string } | null = null;
      try {
        const mentions =
          typeof comment.mentions === "string"
            ? JSON.parse(comment.mentions)
            : comment.mentions;
        if (Array.isArray(mentions) && mentions[0]?.type === "creator") {
          creatorInfo = mentions[0];
        }
      } catch {
        // Not a creator comment
      }
      const isCreatorComment = creatorInfo !== null;

      return {
        id: comment.id,
        content: comment.message,
        createdAt: comment.createdAt.toISOString(),
        fieldId: comment.fieldId,
        isAgency: !isCreatorComment,
        user: isCreatorComment
          ? { name: creatorInfo?.name || creator.name }
          : comment.user
            ? {
                name: comment.user.name,
                image: comment.user.avatar,
              }
            : undefined,
      };
    });

    return NextResponse.json(transformedComments);
  } catch (error) {
    console.error("Error fetching comments:", error);
    return NextResponse.json(
      { error: "Failed to fetch comments" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/portal/requests/[id]/comments
 * Add a new comment from the creator
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authResult = await validateCreatorSession(req);
    if (!authResult.success) {
      return authResult.error;
    }
    const creator = authResult.creator;

    // Verify request belongs to creator
    const request = await db.contentRequest.findFirst({
      where: {
        id,
        creatorId: creator.id,
        status: { notIn: CREATOR_HIDDEN_STATUSES },
      },
    });

    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    const body = await req.json();
    const { content, fieldId } = body;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json(
        { error: "Comment content is required" },
        { status: 400 }
      );
    }

    // Optional section/field this reply belongs to
    const targetFieldId =
      typeof fieldId === "string" && fieldId.trim().length > 0 ? fieldId : null;

    // For creator comments, we need to create a special system
    // since creators don't have User accounts - we'll store creator info in the comment
    // We'll use a pseudo-user approach or store creator info directly

    // Since Comment requires a userId, we'll need to handle this differently
    // Option 1: Create a system user for creator comments
    // Option 2: Store creator comments with metadata
    // For now, let's use a different approach - store in a JSON field or use the message with metadata

    // Find or create a system user for this specific creator's messages
    // Use creator-specific email to show the right name on team member side
    const creatorSystemEmail = `creator-${creator.id}@${request.agencyId}.internal`;
    // Upsert (not findFirst + create) so concurrent first comments don't
    // race on the unique email. Name/avatar are refreshed on every comment.
    const systemUser = await db.user.upsert({
      where: { email: creatorSystemEmail },
      create: {
        email: creatorSystemEmail,
        password: "", // No password - system account
        name: creator.name, // Use the actual creator's name
        avatar: creator.avatar, // Copy their avatar too
        agencyId: request.agencyId,
        role: "MEMBER",
      },
      update: {
        name: creator.name,
        avatar: creator.avatar,
      },
    });

    // Create the comment with creator info in metadata
    const comment = await db.comment.create({
      data: {
        requestId: id,
        userId: systemUser.id,
        fieldId: targetFieldId,
        message: content.trim(),
        isInternal: false,
        // Store creator info so we can identify it as a creator comment
        mentions: JSON.stringify([{ type: "creator", id: creator.id, name: creator.name }]),
      },
    });

    // Notify the agency's staff of the new creator comment. Requests have no
    // single staff owner and watching is opt-in, so a creator comment must
    // reach the whole team by default. Exclude the per-creator pseudo-users
    // (`.internal` emails) that back creator comments. Guard so a notification
    // failure never blocks the comment from being saved.
    try {
      const staff = await db.user.findMany({
        where: {
          agencyId: request.agencyId,
          email: { not: { endsWith: ".internal" } },
        },
        select: { id: true },
      });
      if (staff.length > 0) {
        const preview =
          comment.message.length > 50
            ? comment.message.slice(0, 50) + "..."
            : comment.message;
        await notifyTeam(
          staff.map((s) => s.id),
          NotificationType.COMMENT_ADDED,
          "New creator comment",
          `${creator.name} commented on "${request.title}": ${preview}`,
          `/dashboard/requests/${id}`
        );
      }
    } catch (notifyError) {
      console.warn("Failed to notify staff of creator comment:", notifyError);
    }

    return NextResponse.json({
      id: comment.id,
      content: comment.message,
      createdAt: comment.createdAt.toISOString(),
      fieldId: comment.fieldId,
      isAgency: false,
      creatorName: creator.name,
    });
  } catch (error) {
    console.error("Error creating comment:", error);
    return NextResponse.json(
      { error: "Failed to create comment" },
      { status: 500 }
    );
  }
}
