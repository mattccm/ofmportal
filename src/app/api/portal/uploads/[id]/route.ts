import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateCreatorSession } from "@/lib/portal-auth";
import { getDownloadPresignedUrl, useLocalStorage, LOCAL_UPLOAD_DIR } from "@/lib/storage";
import path from "path";

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
      url = await getDownloadPresignedUrl(upload.storageKey);
      if (upload.thumbnailKey) {
        thumbnailUrl = await getDownloadPresignedUrl(upload.thumbnailKey);
      }
    }

    return NextResponse.json({
      url,
      thumbnailUrl,
      fileName: upload.originalName,
      fileType: upload.fileType,
      fileSize: Number(upload.fileSize),
    });
  } catch (error) {
    console.error("Error getting upload URL:", error);
    return NextResponse.json(
      { error: "Failed to get upload URL" },
      { status: 500 }
    );
  }
}
