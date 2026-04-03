import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateCreatorSession } from "@/lib/portal-auth";
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
const AVATAR_PREFIX = "creator-avatars";
const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2MB

function generateAvatarKey(creatorId: string): string {
  const timestamp = Date.now();
  return `${AVATAR_PREFIX}/${creatorId}/${timestamp}.jpg`;
}

function extractKeyFromUrl(url: string): string | null {
  try {
    if (url.startsWith("data:")) {
      return null;
    }
    if (url.startsWith("http")) {
      const urlObj = new URL(url);
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

function getAvatarPublicUrl(key: string): string {
  if (isLocal) {
    return `${process.env.R2_ENDPOINT}/${BUCKET_NAME}/${key}`;
  }
  const publicDomain = process.env.R2_PUBLIC_DOMAIN;
  if (!publicDomain) {
    console.error(
      "R2_PUBLIC_DOMAIN is not set. Avatar URLs will not work. " +
      "Set R2_PUBLIC_DOMAIN to your custom domain or r2.dev URL."
    );
    return `https://missing-r2-public-domain/${key}`;
  }
  return `https://${publicDomain}/${key}`;
}

async function tryS3Upload(
  buffer: Buffer,
  mimeType: string,
  creatorId: string,
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
          console.warn("Failed to delete old creator avatar:", deleteError);
        }
      }
    }

    const key = generateAvatarKey(creatorId);

    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        CacheControl: "no-cache, no-store, must-revalidate",
        Metadata: {
          creatorId: creatorId,
          uploadedAt: new Date().toISOString(),
        },
      })
    );

    return getAvatarPublicUrl(key);
  } catch (error) {
    console.warn("S3 upload failed for creator avatar, falling back to database storage:", error);
    return null;
  }
}

// POST: Upload creator's own avatar
export async function POST(request: NextRequest) {
  try {
    const authResult = await validateCreatorSession(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const creatorId = authResult.creator.id;

    // Get current avatar
    const creator = await db.creator.findUnique({
      where: { id: creatorId },
      select: { avatar: true },
    });

    const body = await request.json();
    const { image } = body;

    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    if (!image.startsWith("data:image/")) {
      return NextResponse.json({ error: "Invalid image format" }, { status: 400 });
    }

    const matches = image.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      return NextResponse.json({ error: "Invalid base64 image" }, { status: 400 });
    }

    const mimeType = matches[1];
    const base64Data = matches[2];

    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(mimeType)) {
      return NextResponse.json(
        { error: "Invalid image type. Allowed: JPEG, PNG, GIF, WebP" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(base64Data, "base64");

    if (buffer.length > MAX_AVATAR_SIZE) {
      return NextResponse.json(
        { error: "Image too large. Maximum size is 2MB" },
        { status: 400 }
      );
    }

    // Try S3/R2 upload
    const avatarUrl = await tryS3Upload(
      buffer,
      mimeType,
      creatorId,
      creator?.avatar || null
    );

    // If S3/R2 fails, return an error - DO NOT store base64 in DB
    if (!avatarUrl) {
      console.error("S3/R2 upload failed - avatar storage requires R2 to be configured");
      return NextResponse.json(
        { error: "Avatar storage is not configured. Please contact support." },
        { status: 503 }
      );
    }

    // Update creator record
    const updatedCreator = await db.creator.update({
      where: { id: creatorId },
      data: { avatar: avatarUrl },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
      },
    });

    return NextResponse.json({
      success: true,
      url: avatarUrl,
      creator: updatedCreator,
    });
  } catch (error) {
    console.error("Error uploading creator avatar:", error);
    return NextResponse.json(
      { error: "Failed to upload avatar" },
      { status: 500 }
    );
  }
}

// DELETE: Remove creator's own avatar
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await validateCreatorSession(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const creatorId = authResult.creator.id;

    const creator = await db.creator.findUnique({
      where: { id: creatorId },
      select: { avatar: true },
    });

    if (!creator?.avatar) {
      return NextResponse.json({
        success: true,
        message: "No avatar to delete",
      });
    }

    // Delete from S3/R2 if applicable
    if (s3Client && !creator.avatar.startsWith("data:")) {
      const key = extractKeyFromUrl(creator.avatar);
      if (key && key.startsWith(AVATAR_PREFIX)) {
        try {
          await s3Client.send(
            new DeleteObjectCommand({
              Bucket: BUCKET_NAME,
              Key: key,
            })
          );
        } catch (deleteError) {
          console.warn("Failed to delete creator avatar from storage:", deleteError);
        }
      }
    }

    // Update creator record
    await db.creator.update({
      where: { id: creatorId },
      data: { avatar: null },
    });

    return NextResponse.json({
      success: true,
      message: "Avatar deleted",
    });
  } catch (error) {
    console.error("Error deleting creator avatar:", error);
    return NextResponse.json(
      { error: "Failed to delete avatar" },
      { status: 500 }
    );
  }
}
