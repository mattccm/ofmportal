import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateCreatorSession } from "@/lib/portal-auth";
import { getDownloadPresignedUrl, useLocalStorage } from "@/lib/storage";

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

    // Get request
    const request = await db.contentRequest.findFirst({
      where: {
        id,
        creatorId: creator.id,
      },
    });

    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    // Track view - update view tracking fields
    // Using raw update to handle schema that may not have these fields yet
    const now = new Date();
    let viewTracking = null;

    try {
      // Check if viewedAt field exists by trying to access it
      const requestAny = request as Record<string, unknown>;
      const hasViewTracking = "viewedAt" in requestAny;

      if (hasViewTracking) {
        const isFirstView = !requestAny.viewedAt;

        await db.contentRequest.update({
          where: { id },
          data: {
            viewedByCreator: true,
            viewedAt: isFirstView ? now : (requestAny.viewedAt as Date),
            lastViewedAt: now,
            viewCount: {
              increment: 1,
            },
          } as Record<string, unknown>,
        });

        // Get updated request with view data
        const updatedRequest = await db.contentRequest.findFirst({
          where: { id },
        }) as Record<string, unknown> | null;

        viewTracking = updatedRequest ? {
          viewedAt: updatedRequest.viewedAt,
          viewedByCreator: updatedRequest.viewedByCreator,
          viewCount: updatedRequest.viewCount,
          lastViewedAt: updatedRequest.lastViewedAt,
          isFirstView,
        } : null;
      }
    } catch (viewError) {
      // View tracking fields may not exist in schema yet, continue without tracking
      console.log("View tracking not available:", viewError);
    }

    // Get uploads
    const uploads = await db.upload.findMany({
      where: {
        requestId: id,
        uploadStatus: "COMPLETED",
      },
      orderBy: { createdAt: "desc" },
    });

    // Convert BigInt to number and generate presigned URLs for thumbnails
    const serializedUploads = await Promise.all(
      uploads.map(async (upload) => {
        let thumbnailUrl = upload.thumbnailUrl;

        // Generate presigned URL for thumbnail if it exists
        if (upload.thumbnailKey && !thumbnailUrl) {
          try {
            if (useLocalStorage) {
              thumbnailUrl = `/api/local-files/${encodeURIComponent(upload.thumbnailKey)}`;
            } else {
              thumbnailUrl = await getDownloadPresignedUrl(upload.thumbnailKey);
            }
          } catch {
            // Thumbnail generation failed, leave as null
          }
        }

        return {
          ...upload,
          fileSize: Number(upload.fileSize),
          thumbnailUrl,
        };
      })
    );

    // Get comments (non-internal only)
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
            image: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Transform comments for the frontend
    const transformedComments = comments.map((comment) => {
      // Check if this is a creator comment (stored in mentions field)
      let isCreatorComment = false;
      let creatorInfo = null;
      try {
        const mentions = typeof comment.mentions === "string"
          ? JSON.parse(comment.mentions)
          : comment.mentions;
        if (Array.isArray(mentions) && mentions.length > 0 && mentions[0]?.type === "creator") {
          isCreatorComment = true;
          creatorInfo = mentions[0];
        }
      } catch {
        // Invalid JSON, not a creator comment
      }

      return {
        id: comment.id,
        content: comment.message,
        createdAt: comment.createdAt.toISOString(),
        isAgency: !isCreatorComment,
        user: isCreatorComment
          ? { name: creatorInfo?.name || creator.name }
          : comment.user
            ? { name: comment.user.name, image: comment.user.image }
            : undefined,
      };
    });

    return NextResponse.json({
      request,
      uploads: serializedUploads,
      comments: transformedComments,
      ...(viewTracking && { viewTracking }),
    });
  } catch (error) {
    console.error("Error fetching request:", error);
    return NextResponse.json(
      { error: "Failed to fetch request" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/portal/requests/[id]
 * Update request view status (for tracking without fetching full request)
 */
export async function PATCH(
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
    const { markViewed } = body;

    if (markViewed) {
      try {
        const requestAny = request as Record<string, unknown>;
        const hasViewTracking = "viewedAt" in requestAny;

        if (hasViewTracking) {
          const now = new Date();
          const isFirstView = !requestAny.viewedAt;

          const updatedRequest = await db.contentRequest.update({
            where: { id },
            data: {
              viewedByCreator: true,
              viewedAt: isFirstView ? now : (requestAny.viewedAt as Date),
              lastViewedAt: now,
              viewCount: {
                increment: 1,
              },
            } as Record<string, unknown>,
          }) as Record<string, unknown>;

          return NextResponse.json({
            success: true,
            isFirstView,
            viewTracking: {
              viewedAt: updatedRequest.viewedAt,
              viewedByCreator: updatedRequest.viewedByCreator,
              viewCount: updatedRequest.viewCount,
              lastViewedAt: updatedRequest.lastViewedAt,
            },
          });
        }
      } catch (viewError) {
        console.log("View tracking not available:", viewError);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating request view:", error);
    return NextResponse.json(
      { error: "Failed to update request view" },
      { status: 500 }
    );
  }
}
