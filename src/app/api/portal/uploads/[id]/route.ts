import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateCreatorSession } from "@/lib/portal-auth";
import {
  getPublicFileUrl,
  getViewPresignedUrl,
  useLocalStorage,
  SIGNED_URL_NO_STORE,
} from "@/lib/storage";

/**
 * GET /api/portal/uploads/[id]
 * Get a presigned URL for a creator's own upload
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

    // Find the upload and verify it belongs to this creator
    const upload = await db.upload.findFirst({
      where: {
        id,
        creatorId: creator.id,
      },
    });

    if (!upload) {
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }

    // Generate presigned URL
    let url: string;
    let thumbnailUrl: string | null = null;

    if (useLocalStorage) {
      // For local storage, return a local URL
      url = `/api/local-files/${encodeURIComponent(upload.storageKey)}`;
      if (upload.thumbnailKey) {
        thumbnailUrl = `/api/local-files/${encodeURIComponent(upload.thumbnailKey)}`;
      }
    } else {
      // Creator content is private: getPublicFileUrl returns null, so these
      // are signed inline (view) URLs
      url =
        getPublicFileUrl(upload.storageKey) ??
        (await getViewPresignedUrl(upload.storageKey));
      if (upload.thumbnailKey) {
        thumbnailUrl =
          getPublicFileUrl(upload.thumbnailKey) ??
          (await getViewPresignedUrl(upload.thumbnailKey));
      }
    }

    return NextResponse.json(
      {
        url,
        thumbnailUrl,
        fileName: upload.originalName,
        fileType: upload.fileType,
        fileSize: Number(upload.fileSize),
      },
      { headers: { "Cache-Control": SIGNED_URL_NO_STORE } }
    );
  } catch (error) {
    console.error("Error getting upload URL:", error);
    return NextResponse.json(
      { error: "Failed to get upload URL" },
      { status: 500 }
    );
  }
}
