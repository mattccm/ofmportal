import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDownloadPresignedUrl, useLocalStorage, SIGNED_URL_NO_STORE } from "@/lib/storage";

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
      select: { id: true, storageKey: true, fileName: true, name: true, creatorId: true },
    });

    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Audit trail: best-effort, never blocks the download
    try {
      await db.activityLog.create({
        data: {
          userId: session.user.id,
          action: "content.download",
          entityType: "MediaItem",
          entityId: item.id,
          metadata: {
            creatorId: item.creatorId,
            fileName: item.fileName || item.name,
          },
        },
      });
    } catch (logError) {
      console.warn("Failed to log media download:", logError);
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
    const response = NextResponse.redirect(url, 302);
    response.headers.set("Cache-Control", SIGNED_URL_NO_STORE);
    return response;
  } catch (error) {
    console.error("Error resolving media download:", error);
    return NextResponse.json(
      { error: "Failed to download file" },
      { status: 500 }
    );
  }
}
