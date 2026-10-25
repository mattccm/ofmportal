import { NextRequest, NextResponse } from "next/server";
import { forbidden, requireAccess } from "@/lib/access/server";
import { mediaScope } from "@/app/api/media-library/_scope";
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
    const gate = await requireAccess("settings.mediaLibrary");
    if (gate.error) return gate.error;
    const { access } = gate;
    // The library is the creators' content, so it also needs "Their content library"
    if (!access.has("creatorInfo.content")) return forbidden("creatorInfo.content");

    const item = await db.mediaItem.findFirst({
      where: {
        id,
        ...(await mediaScope(access)),
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
          userId: access.userId,
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
