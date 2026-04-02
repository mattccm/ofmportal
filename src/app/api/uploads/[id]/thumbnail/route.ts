import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getViewPresignedUrl } from "@/lib/storage";

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
      select: {
        storageKey: true,
        fileType: true,
        thumbnailKey: true,
      },
    });

    if (!upload) {
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }

    // For images, use the actual file as the thumbnail
    // For other types, use the thumbnailKey if available
    const isImage = upload.fileType.startsWith("image/");
    const keyToUse = isImage ? upload.storageKey : upload.thumbnailKey;

    if (!keyToUse) {
      return NextResponse.json({ url: null });
    }

    const url = await getViewPresignedUrl(keyToUse);

    return NextResponse.json({ url });
  } catch (error) {
    console.error("Error getting thumbnail URL:", error);
    return NextResponse.json(
      { error: "Failed to get thumbnail URL" },
      { status: 500 }
    );
  }
}
