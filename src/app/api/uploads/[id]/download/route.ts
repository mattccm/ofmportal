import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDownloadPresignedUrl } from "@/lib/storage";

/**
 * GET /api/uploads/[id]/download
 *
 * Returns a presigned download URL with Content-Disposition: attachment
 * This ensures the file downloads rather than opens in browser.
 *
 * Unlike the /url endpoint which returns public URLs (for previews/thumbnails),
 * this always returns a presigned URL with download headers.
 */
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

    const upload = await db.upload.findFirst({
      where: {
        id,
        request: {
          agencyId: session.user.agencyId,
        },
      },
    });

    if (!upload) {
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }

    // Always use presigned URL for downloads - it includes Content-Disposition: attachment
    const url = await getDownloadPresignedUrl(
      upload.storageKey,
      upload.originalName || upload.fileName
    );

    // Redirect to the presigned URL
    return NextResponse.redirect(url);
  } catch (error) {
    console.error("Error getting download URL:", error);
    return NextResponse.json(
      { error: "Failed to get download URL" },
      { status: 500 }
    );
  }
}
