import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateCreatorSession } from "@/lib/portal-auth";

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
    const transformedComments = comments.map((comment) => ({
      id: comment.id,
      content: comment.message,
      createdAt: comment.createdAt.toISOString(),
      isAgency: true, // Agency user comments
      user: comment.user
        ? {
            name: comment.user.name,
            image: comment.user.avatar,
          }
        : undefined,
    }));

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
      },
    });

    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    const body = await req.json();
    const { content } = body;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json(
        { error: "Comment content is required" },
        { status: 400 }
      );
    }

    // For creator comments, we need to create a special system
    // since creators don't have User accounts - we'll store creator info in the comment
    // We'll use a pseudo-user approach or store creator info directly

    // Since Comment requires a userId, we'll need to handle this differently
    // Option 1: Create a system user for creator comments
    // Option 2: Store creator comments with metadata
    // For now, let's use a different approach - store in a JSON field or use the message with metadata

    // Find or create a system user for creator messages
    let systemUser = await db.user.findFirst({
      where: {
        email: `creator-system@${request.agencyId}.internal`,
      },
    });

    if (!systemUser) {
      // Create a system user for creator comments for this agency
      systemUser = await db.user.create({
        data: {
          email: `creator-system@${request.agencyId}.internal`,
          password: "", // No password - system account
          name: "Creator Messages",
          agencyId: request.agencyId,
          role: "MEMBER",
        },
      });
    }

    // Create the comment with creator info in metadata
    const comment = await db.comment.create({
      data: {
        requestId: id,
        userId: systemUser.id,
        message: content.trim(),
        isInternal: false,
        // Store creator info so we can identify it as a creator comment
        mentions: JSON.stringify([{ type: "creator", id: creator.id, name: creator.name }]),
      },
    });

    return NextResponse.json({
      id: comment.id,
      content: comment.message,
      createdAt: comment.createdAt.toISOString(),
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
