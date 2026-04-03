import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
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
// Only create if storage is configured
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
    forcePathStyle: isLocal, // Required for MinIO
  });
}

const BUCKET_NAME = process.env.R2_BUCKET_NAME || "upload-portal";
const AVATAR_PREFIX = "avatars";

// Maximum avatar file size (2MB after base64 decode - base64 is ~33% larger)
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;

/**
 * Generate a storage key for avatar
 */
function generateAvatarKey(userId: string): string {
  const timestamp = Date.now();
  return `${AVATAR_PREFIX}/${userId}/${timestamp}.jpg`;
}

/**
 * Extract storage key from avatar URL
 */
function extractKeyFromUrl(url: string): string | null {
  try {
    // If it's a data URL (base64), it's not in S3
    if (url.startsWith("data:")) {
      return null;
    }
    // Handle both full URLs and relative paths
    if (url.startsWith("http")) {
      const urlObj = new URL(url);
      // Remove leading slash and bucket name if present
      let path = urlObj.pathname;
      if (path.startsWith("/")) path = path.slice(1);
      if (path.startsWith(BUCKET_NAME + "/")) {
        path = path.slice(BUCKET_NAME.length + 1);
      }
      return path;
    }
    return url;
  } catch {
    return null;
  }
}

/**
 * Get public URL for avatar
 */
function getAvatarPublicUrl(key: string): string {
  if (isLocal) {
    // Local MinIO URL
    return `${process.env.R2_ENDPOINT}/${BUCKET_NAME}/${key}`;
  }
  // Cloudflare R2 public URL (requires public bucket or custom domain)
  // Adjust this based on your R2 configuration
  const publicDomain = process.env.R2_PUBLIC_DOMAIN;
  if (publicDomain) {
    return `https://${publicDomain}/${key}`;
  }
  // Fallback to R2.dev URL if configured
  return `https://${process.env.R2_BUCKET_NAME}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;
}

/**
 * Try to upload to S3, returns URL on success or null on failure
 */
async function tryS3Upload(
  buffer: Buffer,
  mimeType: string,
  userId: string,
  currentImageUrl: string | null
): Promise<string | null> {
  if (!s3Client) {
    return null;
  }

  try {
    // Delete old avatar if exists in S3
    if (currentImageUrl) {
      const oldKey = extractKeyFromUrl(currentImageUrl);
      if (oldKey && oldKey.startsWith(AVATAR_PREFIX)) {
        try {
          await s3Client.send(
            new DeleteObjectCommand({
              Bucket: BUCKET_NAME,
              Key: oldKey,
            })
          );
        } catch (deleteError) {
          console.warn("Failed to delete old avatar:", deleteError);
        }
      }
    }

    // Generate new avatar key
    const key = generateAvatarKey(userId);

    // Upload to S3/R2
    // Using no-cache for avatars so updates show immediately
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        CacheControl: "no-cache, no-store, must-revalidate", // No cache for avatars - they change
        Metadata: {
          userId: userId,
          uploadedAt: new Date().toISOString(),
        },
      })
    );

    // Get public URL
    return getAvatarPublicUrl(key);
  } catch (error) {
    console.warn("S3 upload failed, falling back to database storage:", error);
    return null;
  }
}

// POST: Upload avatar image
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { image } = body;

    if (!image) {
      return NextResponse.json(
        { error: "No image provided" },
        { status: 400 }
      );
    }

    // Validate base64 image
    if (!image.startsWith("data:image/")) {
      return NextResponse.json(
        { error: "Invalid image format" },
        { status: 400 }
      );
    }

    // Extract mime type and base64 data
    const matches = image.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      return NextResponse.json(
        { error: "Invalid base64 image" },
        { status: 400 }
      );
    }

    const mimeType = matches[1];
    const base64Data = matches[2];

    // Validate mime type
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(mimeType)) {
      return NextResponse.json(
        { error: "Invalid image type. Allowed: JPEG, PNG, GIF, WebP" },
        { status: 400 }
      );
    }

    // Decode base64 to buffer
    const buffer = Buffer.from(base64Data, "base64");

    // Validate size
    if (buffer.length > MAX_AVATAR_SIZE) {
      return NextResponse.json(
        { error: "Image too large. Maximum size is 2MB" },
        { status: 400 }
      );
    }

    // Get current user to check for existing avatar
    const currentUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { avatar: true },
    });

    // Try to upload to S3 first
    let avatarUrl = await tryS3Upload(
      buffer,
      mimeType,
      session.user.id,
      currentUser?.avatar || null
    );

    // If S3 fails or is not configured, store base64 directly in DB
    if (!avatarUrl) {
      console.log("Using database storage for avatar (S3 not available)");
      avatarUrl = image; // Store the original base64 data URL
    }

    // Update user record - use 'avatar' field (not 'image' which is for OAuth)
    await db.user.update({
      where: { id: session.user.id },
      data: { avatar: avatarUrl },
    });

    return NextResponse.json({
      success: true,
      url: avatarUrl,
    });
  } catch (error) {
    console.error("Error uploading avatar:", error);
    return NextResponse.json(
      { error: "Failed to upload avatar" },
      { status: 500 }
    );
  }
}

// DELETE: Remove avatar
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get current user
    const currentUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { avatar: true },
    });

    if (!currentUser?.avatar) {
      return NextResponse.json({
        success: true,
        message: "No avatar to delete",
      });
    }

    // Delete from S3/R2 if it's our avatar (not a base64 URL)
    if (s3Client && !currentUser.avatar.startsWith("data:")) {
      const key = extractKeyFromUrl(currentUser.avatar);
      if (key && key.startsWith(AVATAR_PREFIX)) {
        try {
          await s3Client.send(
            new DeleteObjectCommand({
              Bucket: BUCKET_NAME,
              Key: key,
            })
          );
        } catch (deleteError) {
          console.warn("Failed to delete avatar from storage:", deleteError);
          // Continue anyway - we'll still remove from DB
        }
      }
    }

    // Update user record to remove avatar - use 'avatar' field (not 'image' which is for OAuth)
    await db.user.update({
      where: { id: session.user.id },
      data: { avatar: null },
    });

    return NextResponse.json({
      success: true,
      message: "Avatar deleted",
    });
  } catch (error) {
    console.error("Error deleting avatar:", error);
    return NextResponse.json(
      { error: "Failed to delete avatar" },
      { status: 500 }
    );
  }
}
