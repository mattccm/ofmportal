import { NextRequest, NextResponse } from "next/server";
import { forbidden, requireAccess } from "@/lib/access/server";
import { mediaScope } from "@/app/api/media-library/_scope";
import { db } from "@/lib/db";
import {
  getViewPresignedUrl,
  getPublicFileUrl,
  useLocalStorage,
  SIGNED_URL_SHORT_CACHE,
} from "@/lib/storage";

// GET /api/media-library/[id]/file
// Used directly as <img>/<video>/<audio> src, so it 302-redirects to an inline
// (view) URL for the underlying file.
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
      select: { storageKey: true },
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

    const url =
      getPublicFileUrl(item.storageKey) ??
      (await getViewPresignedUrl(item.storageKey));
    // Signed view URL: cache the redirect privately, well below its expiry
    const response = NextResponse.redirect(url, 302);
    response.headers.set("Cache-Control", SIGNED_URL_SHORT_CACHE);
    return response;
  } catch (error) {
    console.error("Error resolving media file:", error);
    return NextResponse.json(
      { error: "Failed to load file" },
      { status: 500 }
    );
  }
}
