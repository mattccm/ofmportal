import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDownloadPresignedUrl } from "@/lib/storage";

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
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get request with uploads
    const request = await db.contentRequest.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
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

    // Return URLs - client handles the downloads directly from R2
    // This uses ZERO Vercel bandwidth for file transfer
    return NextResponse.json({
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
    });
  } catch (error) {
    console.error("Error creating download:", error);
    return NextResponse.json(
      { error: "Failed to create download" },
      { status: 500 }
    );
  }
}
