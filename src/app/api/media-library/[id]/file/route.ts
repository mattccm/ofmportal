import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getViewPresignedUrl, getPublicFileUrl, useLocalStorage } from "@/lib/storage";

// GET /api/media-library/[id]/file
// Used directly as <img>/<video>/<audio> src, so it 302-redirects to an inline
// (view) URL for the underlying file.
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
    return NextResponse.redirect(url, 302);
  } catch (error) {
    console.error("Error resolving media file:", error);
    return NextResponse.json(
      { error: "Failed to load file" },
      { status: 500 }
    );
  }
}
