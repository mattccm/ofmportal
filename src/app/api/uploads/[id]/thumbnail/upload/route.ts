import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { uploadToStorage } from "@/lib/storage";

/**
 * POST /api/uploads/[id]/thumbnail/upload
 *
 * Upload a thumbnail for a video upload.
 * Accepts multipart form data with a 'thumbnail' file.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    const creatorToken = req.headers.get("x-creator-token");

    // Get the upload record
    const upload = await db.upload.findUnique({
      where: { id },
      include: {
        request: true,
      },
    });

    if (!upload) {
      return NextResponse.json(
        { error: "Upload not found" },
        { status: 404 }
      );
    }

    // Verify authorization
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
      });

      if (!creator || creator.id !== upload.creatorId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    } else {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse form data
    const formData = await req.formData();
    const thumbnailFile = formData.get("thumbnail") as File | null;

    if (!thumbnailFile) {
      return NextResponse.json(
        { error: "No thumbnail file provided" },
        { status: 400 }
      );
    }

    // Validate it's an image
    if (!thumbnailFile.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Thumbnail must be an image file" },
        { status: 400 }
      );
    }

    // Generate a unique key for the thumbnail
    const thumbnailKey = `${upload.storageKey.replace(/\.[^.]+$/, "")}_thumb.jpg`;

    try {
      // Convert File to Buffer
      const arrayBuffer = await thumbnailFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Upload the thumbnail
      await uploadToStorage(thumbnailKey, buffer, thumbnailFile.type);

      // Update the upload record with thumbnail key
      const updatedUpload = await db.upload.update({
        where: { id },
        data: {
          thumbnailKey,
          // Clear cached URL so it gets regenerated
          thumbnailUrl: null,
        },
      });

      return NextResponse.json({
        success: true,
        thumbnailKey,
      });
    } catch (uploadError) {
      console.error("Failed to upload thumbnail:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload thumbnail" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Thumbnail upload error:", error);
    return NextResponse.json(
      { error: "Failed to process thumbnail upload" },
      { status: 500 }
    );
  }
}
