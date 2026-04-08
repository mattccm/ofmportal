import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateCreatorSession } from "@/lib/portal-auth";
import { getDownloadPresignedUrl, useLocalStorage, getPublicFileUrl } from "@/lib/storage";

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

    // Track view - update and return in single query (saves 1 DB round trip)
    const now = new Date();
    let viewTracking = null;

    try {
      const requestAny = request as Record<string, unknown>;
      const hasViewTracking = "viewedAt" in requestAny;

      if (hasViewTracking) {
        const isFirstView = !requestAny.viewedAt;

        // Single update that returns the updated record - no need for separate fetch
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
          select: {
            viewedAt: true,
            viewedByCreator: true,
            viewCount: true,
            lastViewedAt: true,
          },
        }) as Record<string, unknown>;

        viewTracking = {
          viewedAt: updatedRequest.viewedAt,
          viewedByCreator: updatedRequest.viewedByCreator,
          viewCount: updatedRequest.viewCount,
          lastViewedAt: updatedRequest.lastViewedAt,
          isFirstView,
        };
      }
    } catch (viewError) {
      // View tracking fields may not exist in schema yet, continue without tracking
      console.log("View tracking not available:", viewError);
    }

    // Get uploads with pagination
    const url = new URL(req.url);
    const uploadsLimit = Math.min(parseInt(url.searchParams.get("uploadsLimit") || "100"), 200);
    const commentsLimit = Math.min(parseInt(url.searchParams.get("commentsLimit") || "100"), 200);

    const [uploads, uploadsTotal] = await Promise.all([
      db.upload.findMany({
        where: {
          requestId: id,
          uploadStatus: "COMPLETED",
        },
        orderBy: { createdAt: "desc" },
        take: uploadsLimit,
        select: {
          id: true,
          fileName: true,
          originalName: true,
          fileType: true,
          fileSize: true,
          status: true,
          uploadStatus: true,
          storageKey: true,
          thumbnailUrl: true,
          thumbnailKey: true,
          fieldId: true,
        },
      }),
      db.upload.count({
        where: {
          requestId: id,
          uploadStatus: "COMPLETED",
        },
      }),
    ]);

    // Convert BigInt to number and generate URLs for previews
    const serializedUploads = await Promise.all(
      uploads.map(async (upload) => {
        let thumbnailUrl = upload.thumbnailUrl;

        // For images, use the actual file as preview (via public URL if available)
        const isImage = upload.fileType.startsWith("image/");
        const isVideo = upload.fileType.startsWith("video/");

        // Try to get a preview URL - prioritize public URL for zero bandwidth
        let previewUrl: string | null = null;
        const keyToUse = isImage ? upload.storageKey : upload.thumbnailKey;

        if (keyToUse) {
          try {
            // Prefer public URL (zero bandwidth)
            previewUrl = getPublicFileUrl(keyToUse);
            if (!previewUrl) {
              if (useLocalStorage) {
                previewUrl = `/api/local-files/${encodeURIComponent(keyToUse)}`;
              } else {
                previewUrl = await getDownloadPresignedUrl(keyToUse);
              }
            }
          } catch {
            // Preview generation failed
          }
        }

        // Use computed preview URL as thumbnail for images
        if (isImage && previewUrl && !thumbnailUrl) {
          thumbnailUrl = previewUrl;
        }

        return {
          id: upload.id,
          fileName: upload.fileName,
          originalName: upload.originalName,
          fileType: upload.fileType,
          fileSize: Number(upload.fileSize),
          status: upload.status,
          uploadStatus: upload.uploadStatus,
          storageKey: upload.storageKey,
          thumbnailUrl: thumbnailUrl || previewUrl,
          fieldId: upload.fieldId,
        };
      })
    );

    // Get comments (non-internal only) with pagination
    const [comments, commentsTotal] = await Promise.all([
      db.comment.findMany({
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
              email: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
        take: commentsLimit,
      }),
      db.comment.count({
        where: {
          requestId: id,
          isInternal: false,
        },
      }),
    ]);

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
            ? { name: comment.user.name, image: comment.user.avatar }
            : undefined,
      };
    });

    return NextResponse.json({
      request,
      uploads: serializedUploads,
      comments: transformedComments,
      pagination: {
        uploadsTotal,
        uploadsLimit,
        hasMoreUploads: uploadsTotal > uploadsLimit,
        commentsTotal,
        commentsLimit,
        hasMoreComments: commentsTotal > commentsLimit,
      },
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
