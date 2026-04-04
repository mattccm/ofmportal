import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUploadPresignedUrl, getPublicFileUrl } from "@/lib/storage";

// Determine if we're using local MinIO or Cloudflare R2
const isLocal = process.env.R2_ENDPOINT?.includes("localhost");
const BUCKET_NAME = process.env.R2_BUCKET_NAME || "upload-portal";
const TEMPLATE_ASSETS_PREFIX = "template-assets";

// Maximum file sizes
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Get public URL for template asset
 */
function getAssetPublicUrl(key: string): string {
  // Try to use the public domain if configured
  const publicUrl = getPublicFileUrl(key);
  if (publicUrl) {
    return publicUrl;
  }

  // Fallback for local development
  if (isLocal) {
    return `${process.env.R2_ENDPOINT}/${BUCKET_NAME}/${key}`;
  }

  // If no public domain is configured, we'll need to use presigned URLs for access
  // This shouldn't happen in production with proper R2 setup
  const publicDomain = process.env.R2_PUBLIC_DOMAIN;
  if (!publicDomain) {
    console.error(
      "R2_PUBLIC_DOMAIN is not set. Template asset URLs will not work. " +
      "Set R2_PUBLIC_DOMAIN to your custom domain or r2.dev URL."
    );
    return `https://missing-r2-public-domain/${key}`;
  }
  return `https://${publicDomain}/${key}`;
}

// POST: Get presigned URL for template example upload
// Returns a presigned URL for direct browser-to-R2 upload
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
    const publicUrl = getAssetPublicUrl(key);

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
