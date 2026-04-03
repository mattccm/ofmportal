import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  S3Client,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

// Check if S3/R2 storage is properly configured
const isStorageConfigured = !!(
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY &&
  (process.env.R2_ENDPOINT || process.env.R2_ACCOUNT_ID)
);

// Determine if we're using local MinIO or Cloudflare R2
const isLocal = process.env.R2_ENDPOINT?.includes("localhost");

// S3-compatible client (works with both MinIO and R2)
let s3Client: S3Client | null = null;
if (isStorageConfigured) {
  s3Client = new S3Client({
    region: "auto",
    endpoint: isLocal
      ? process.env.R2_ENDPOINT
      : `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    },
    forcePathStyle: isLocal,
  });
}

const BUCKET_NAME = process.env.R2_BUCKET_NAME || "upload-portal";
const TEMPLATE_ASSETS_PREFIX = "template-assets";

// Maximum file sizes
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Get public URL for template asset
 */
function getAssetPublicUrl(key: string): string {
  if (isLocal) {
    return `${process.env.R2_ENDPOINT}/${BUCKET_NAME}/${key}`;
  }
  const publicDomain = process.env.R2_PUBLIC_DOMAIN;
  if (publicDomain) {
    return `https://${publicDomain}/${key}`;
  }
  return `https://${process.env.R2_BUCKET_NAME}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;
}

// POST: Upload template example image or video
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if storage is configured
    if (!s3Client) {
      return NextResponse.json(
        { error: "Storage not configured. Please contact support." },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { file, fileName, fileType } = body;

    if (!file || !fileName || !fileType) {
      return NextResponse.json(
        { error: "Missing required fields: file, fileName, fileType" },
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

    // Extract base64 data
    const matches = file.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      return NextResponse.json(
        { error: "Invalid file format" },
        { status: 400 }
      );
    }

    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, "base64");

    // Validate size
    const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
    if (buffer.length > maxSize) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${maxSize / (1024 * 1024)}MB` },
        { status: 400 }
      );
    }

    // Generate unique key
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const key = `${TEMPLATE_ASSETS_PREFIX}/${session.user.agencyId}/${timestamp}-${sanitizedFileName}`;

    // Upload to S3/R2
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        CacheControl: "public, max-age=31536000", // 1 year cache for static assets
        Metadata: {
          agencyId: session.user.agencyId,
          uploadedAt: new Date().toISOString(),
          originalFileName: fileName,
        },
      })
    );

    // Get public URL
    const url = getAssetPublicUrl(key);

    return NextResponse.json({
      success: true,
      url,
      key,
      type: isImage ? "image" : "video",
    });
  } catch (error) {
    console.error("Error uploading template asset:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
