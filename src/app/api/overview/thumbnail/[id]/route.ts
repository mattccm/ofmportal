import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAccess, uploadWhere } from "@/lib/access/server";
import { getPublicFileUrl, getViewPresignedUrl, SIGNED_URL_NO_STORE } from "@/lib/storage";

/**
 * GET /api/overview/thumbnail/:id
 *
 * A staff-only redirect to a short-lived signed preview of one upload, so a
 * discreet preview plate can use it as an <img src>. The plate only renders
 * the <img> once the preview is revealed, so nothing is requested (and no URL
 * is signed) until staff peek. Images preview as themselves; videos use their
 * poster frame, and have no preview without one.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // A preview is only signed for someone who may reveal previews
  const gate = await requireAccess("review.reveal");
  if (gate.error) return gate.error;
  const { access } = gate;
  const { id } = await params;
  try {
    const upload = await db.upload.findFirst({
      where: { AND: [uploadWhere(access), { id }] },
      select: { storageKey: true, thumbnailKey: true, fileType: true },
    });
    if (!upload) return NextResponse.json({ error: "Upload not found" }, { status: 404 });

    const key = upload.fileType.startsWith("image/") ? upload.storageKey : upload.thumbnailKey;
    if (!key) return NextResponse.json({ error: "No preview for this file" }, { status: 404 });

    const url = getPublicFileUrl(key) ?? (await getViewPresignedUrl(key));
    const res = NextResponse.redirect(new URL(url, req.url), 302);
    res.headers.set("Cache-Control", SIGNED_URL_NO_STORE);
    return res;
  } catch (error) {
    console.error("Error getting overview preview:", error);
    return NextResponse.json({ error: "Could not load the preview" }, { status: 500 });
  }
}
