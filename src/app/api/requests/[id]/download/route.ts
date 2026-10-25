import { NextRequest, NextResponse } from "next/server";
import { requireAccess, requestWhere, redactCreatorsIn } from "@/lib/access/server";
import { db } from "@/lib/db";
import { getDownloadPresignedUrl, SIGNED_URL_NO_STORE } from "@/lib/storage";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const gate = await requireAccess("review.download");
    if (gate.error) return gate.error;
    const { access, session } = gate;

    // Get request with uploads
    const request = await db.contentRequest.findFirst({
      where: { AND: [requestWhere(access), { id }] },
      include: {
        uploads: {
          where: {
            uploadStatus: "COMPLETED",
          },
        },
        creator: {
          select: { name: true, email: true },
        },
      },
    });

    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    if (request.uploads.length === 0) {
      return NextResponse.json(
        { error: "No uploads to download" },
        { status: 400 }
      );
    }

    // Generate presigned download URLs for each file
    // We use presigned URLs (not public URLs) because:
    // 1. Presigned URLs have proper CORS headers from R2 directly
    // 2. Public custom domain URLs may not have CORS configured correctly
    // 3. The browser needs to fetch these URLs to create the ZIP client-side
    const downloadFiles = await Promise.all(
      request.uploads.map(async (upload) => {
        // Always use presigned URL for ZIP downloads - includes proper CORS headers
        const url = await getDownloadPresignedUrl(upload.storageKey, upload.originalName);

        return {
          id: upload.id,
          url,
          fileName: upload.originalName,
          fileType: upload.fileType,
          fileSize: Number(upload.fileSize),
          fileSizeFormatted: formatBytes(Number(upload.fileSize)),
        };
      })
    );

    // Audit trail: one row per upload, best-effort, never blocks the download
    try {
      await db.activityLog.createMany({
        data: request.uploads.map((upload) => ({
          userId: session.user.id,
          action: "content.download",
          entityType: "Upload",
          entityId: upload.id,
          metadata: {
            creatorId: upload.creatorId,
            requestId: request.id,
            fileName: upload.originalName,
            count: request.uploads.length,
          },
        })),
      });
    } catch (logError) {
      console.warn("Failed to log request content download:", logError);
    }

    // Return URLs - client handles the downloads directly from R2
    // This uses ZERO Vercel bandwidth for file transfer
    return NextResponse.json(
      redactCreatorsIn(access, {
        success: true,
        message: "Download URLs generated. Files will download directly from storage.",
        request: {
          id: request.id,
          title: request.title,
          creator: request.creator,
        },
        files: downloadFiles,
        totalFiles: downloadFiles.length,
        totalSize: downloadFiles.reduce((acc, f) => acc + f.fileSize, 0),
        totalSizeFormatted: formatBytes(downloadFiles.reduce((acc, f) => acc + f.fileSize, 0)),
      }),
      { headers: { "Cache-Control": SIGNED_URL_NO_STORE } }
    );
  } catch (error) {
    console.error("Error creating download:", error);
    return NextResponse.json(
      { error: "Failed to create download" },
      { status: 500 }
    );
  }
}
