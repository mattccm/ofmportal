import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getViewPresignedUrl, getPublicFileUrl, SIGNED_URL_NO_STORE } from "@/lib/storage";

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

    // Creator content is private: getPublicFileUrl returns null for it, so this
    // is a signed inline (view) URL used for previews and video playback.
    let url = getPublicFileUrl(upload.storageKey);
    if (!url) {
      url = await getViewPresignedUrl(upload.storageKey);
    }

    // Audit trail: best-effort, never blocks access
    try {
      await db.activityLog.create({
        data: {
          userId: session.user.id,
          action: "content.url_issued",
          entityType: "Upload",
          entityId: upload.id,
          metadata: {
            creatorId: upload.creatorId,
            requestId: upload.requestId,
            fileName: upload.originalName || upload.fileName,
          },
        },
      });
    } catch (logError) {
      console.warn("Failed to log content URL access:", logError);
    }

    return NextResponse.json(
      { url },
      { headers: { "Cache-Control": SIGNED_URL_NO_STORE } }
    );
  } catch (error) {
    console.error("Error getting upload URL:", error);
    return NextResponse.json(
      { error: "Failed to get upload URL" },
      { status: 500 }
    );
  }
}
