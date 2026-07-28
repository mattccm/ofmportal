import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getViewPresignedUrl, getPublicFileUrl } from "@/lib/storage";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    const creatorToken = req.headers.get("x-creator-token");

    const upload = await db.upload.findUnique({
      where: { id },
      select: {
        storageKey: true,
        fileType: true,
        thumbnailKey: true,
        creatorId: true,
        request: { select: { agencyId: true } },
      },
    });

    if (!upload) {
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }

    // Authorize as agency staff (session) or the owning creator (portal token).
    if (session?.user?.agencyId) {
      if (upload.request.agencyId !== session.user.agencyId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    } else if (creatorToken) {
      const creator = await db.creator.findFirst({
        where: {
          sessionToken: creatorToken,
          sessionExpiry: { gt: new Date() },
        },
        select: { id: true },
      });

      if (!creator || creator.id !== upload.creatorId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    } else {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // For images, use the actual file as the thumbnail
    // For other types, use the thumbnailKey if available
    const isImage = upload.fileType.startsWith("image/");
    const keyToUse = isImage ? upload.storageKey : upload.thumbnailKey;

    if (!keyToUse) {
      return NextResponse.json({ url: null });
    }

    // Prefer public URL for zero bandwidth
    let url = getPublicFileUrl(keyToUse);
    if (!url) {
      url = await getViewPresignedUrl(keyToUse);
    }

    return NextResponse.json({ url });
  } catch (error) {
    console.error("Error getting thumbnail URL:", error);
    return NextResponse.json(
      { error: "Failed to get thumbnail URL" },
      { status: 500 }
    );
  }
}
