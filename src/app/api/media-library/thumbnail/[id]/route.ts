import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getViewPresignedUrl, getPublicFileUrl, useLocalStorage } from "@/lib/storage";

// GET /api/media-library/thumbnail/[id]
// Used directly as an <img src>, so it 302-redirects to the resolved image URL.
// For images the original file doubles as the thumbnail; other types use the
// stored thumbnailKey.
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
      select: {
        storageKey: true,
        thumbnailKey: true,
        type: true,
        fileType: true,
      },
    });

    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Images use the full file as the thumbnail; everything else needs a thumbnailKey.
    const isImage =
      item.type === "IMAGE" || item.fileType.startsWith("image/");
    const keyToUse = isImage ? item.storageKey : item.thumbnailKey;

    if (!keyToUse) {
      return NextResponse.json({ error: "No thumbnail" }, { status: 404 });
    }

    // Local-storage fallback: serve via the local file route.
    if (useLocalStorage) {
      const encoded = keyToUse.split("/").map(encodeURIComponent).join("/");
      return NextResponse.redirect(
        new URL(`/api/local-files/${encoded}`, req.url),
        302
      );
    }

    // Prefer the public (zero-bandwidth) URL, fall back to a presigned view URL.
    const url = getPublicFileUrl(keyToUse) ?? (await getViewPresignedUrl(keyToUse));
    return NextResponse.redirect(url, 302);
  } catch (error) {
    console.error("Error resolving media thumbnail:", error);
    return NextResponse.json(
      { error: "Failed to load thumbnail" },
      { status: 500 }
    );
  }
}
