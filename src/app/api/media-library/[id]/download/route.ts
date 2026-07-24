import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDownloadPresignedUrl, useLocalStorage } from "@/lib/storage";

// GET /api/media-library/[id]/download
// Opened via window.open(); 302-redirects to a presigned attachment download URL.
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

    const item = await db.mediaItem.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
      select: { storageKey: true, fileName: true, name: true },
    });

    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (useLocalStorage) {
      const encoded = item.storageKey.split("/").map(encodeURIComponent).join("/");
      return NextResponse.redirect(
        new URL(`/api/local-files/${encoded}`, req.url),
        302
      );
    }

    // Presigned URL carries Content-Disposition: attachment so the file downloads.
    const url = await getDownloadPresignedUrl(
      item.storageKey,
      item.fileName || item.name
    );
    return NextResponse.redirect(url, 302);
  } catch (error) {
    console.error("Error resolving media download:", error);
    return NextResponse.json(
      { error: "Failed to download file" },
      { status: 500 }
    );
  }
}
