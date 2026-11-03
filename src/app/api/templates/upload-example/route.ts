import { NextRequest, NextResponse } from "next/server";
import { requireAccess } from "@/lib/access/server";
import { getUploadPresignedUrl } from "@/lib/storage";
import { TEMPLATE_ASSETS_PREFIX, templateAssetUrl } from "@/lib/template-assets";

// Maximum file sizes
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

// POST: Get presigned URL for template example upload
// Returns a presigned URL for direct browser-to-R2 upload
export async function POST(request: NextRequest) {
  try {
    const gate = await requireAccess(["templates.create", "templates.edit"]);
    if (gate.error) return gate.error;
    const { session } = gate;

    const body = await request.json();
    const { fileName, fileType, fileSize } = body;

    if (!fileName || !fileType || !fileSize) {
      return NextResponse.json(
        { error: "Missing required fields: fileName, fileType, fileSize" },
        { status: 400 }
      );
    }

    // Validate file type
    const isImage = fileType.startsWith("image/");
    const isVideo = fileType.startsWith("video/");

    if (!isImage && !isVideo) {
      return NextResponse.json(
        { error: "Invalid file type. Only images and videos are allowed." },
        { status: 400 }
      );
    }

    // Validate size
    const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
    if (fileSize > maxSize) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${maxSize / (1024 * 1024)}MB` },
        { status: 400 }
      );
    }

    // Generate unique key
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const key = `${TEMPLATE_ASSETS_PREFIX}/${session.user.agencyId}/${timestamp}-${sanitizedFileName}`;

    // Get presigned URL for upload
    const { url: uploadUrl } = await getUploadPresignedUrl(key, fileType, fileSize);

    // Get the public URL where the file will be accessible after upload
    const publicUrl = templateAssetUrl(key);

    return NextResponse.json({
      success: true,
      uploadUrl, // Presigned URL for PUT request
      publicUrl, // URL to access the file after upload
      key,
      type: isImage ? "image" : "video",
    });
  } catch (error) {
    console.error("Error generating presigned URL for template asset:", error);
    return NextResponse.json(
      { error: "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}
