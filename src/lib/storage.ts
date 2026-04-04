import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { existsSync, statSync, unlinkSync } from "fs";
import path from "path";

// Determine if we're using local MinIO or Cloudflare R2
const isLocal = process.env.R2_ENDPOINT?.includes("localhost");

// Check if storage is properly configured
export const isStorageConfigured = Boolean(
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY &&
  (process.env.R2_ACCOUNT_ID || process.env.R2_ENDPOINT)
);

// Use local file storage as fallback when S3/R2 is not configured
export const useLocalStorage = !isStorageConfigured;

// Local upload directory
export const LOCAL_UPLOAD_DIR = path.join(process.cwd(), "uploads");

// S3-compatible client (works with both MinIO and R2)
const s3Client = new S3Client({
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

const BUCKET_NAME = process.env.R2_BUCKET_NAME || "upload-portal";

// Ensure bucket exists (for local development)
export async function ensureBucketExists(): Promise<void> {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
  } catch {
    // Bucket doesn't exist, create it
    try {
      await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
      console.log(`Created bucket: ${BUCKET_NAME}`);
    } catch (createError) {
      console.error("Failed to create bucket:", createError);
    }
  }
}

// Generate a unique storage key
export function generateStorageKey(
  agencyId: string,
  creatorId: string,
  requestId: string,
  filename: string
): string {
  const timestamp = Date.now();
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
  return `${agencyId}/${creatorId}/${requestId}/${timestamp}-${sanitizedFilename}`;
}

// Generate presigned URL for upload (5GB max, 1 hour expiry)
export async function getUploadPresignedUrl(
  key: string,
  contentType: string,
  contentLength: number
): Promise<{ url: string; key: string }> {
  // Ensure bucket exists for local dev
  if (isLocal) {
    await ensureBucketExists();
  }

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
  });

  const url = await getSignedUrl(s3Client, command, {
    expiresIn: 3600, // 1 hour
  });

  return { url, key };
}

// Generate presigned URL for download (1 hour expiry)
export async function getDownloadPresignedUrl(key: string, filename?: string): Promise<string> {
  // Extract filename from key if not provided
  const downloadFilename = filename || key.split("/").pop() || "download";

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${downloadFilename}"`,
  });

  return getSignedUrl(s3Client, command, {
    expiresIn: 3600, // 1 hour
  });
}

// Generate presigned URL for viewing/preview (inline, 1 hour expiry)
export async function getViewPresignedUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(s3Client, command, {
    expiresIn: 3600, // 1 hour
  });
}

// Check if file exists
export async function fileExists(key: string): Promise<boolean> {
  // Check local storage first if using local mode
  if (useLocalStorage) {
    const localPath = path.join(LOCAL_UPLOAD_DIR, key);
    return existsSync(localPath);
  }

  try {
    await s3Client.send(
      new HeadObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })
    );
    return true;
  } catch {
    // Also check local as fallback
    const localPath = path.join(LOCAL_UPLOAD_DIR, key);
    return existsSync(localPath);
  }
}

// Delete file
export async function deleteFile(key: string): Promise<void> {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    })
  );
}

// Get file metadata
export async function getFileMetadata(key: string): Promise<{
  size: number;
  contentType: string;
  lastModified: Date;
} | null> {
  try {
    const response = await s3Client.send(
      new HeadObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })
    );

    return {
      size: response.ContentLength || 0,
      contentType: response.ContentType || "application/octet-stream",
      lastModified: response.LastModified || new Date(),
    };
  } catch {
    return null;
  }
}

// Allowed file types
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
];

export const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/quicktime", // .mov
  "video/x-msvideo", // .avi
  "video/webm",
  "video/x-matroska", // .mkv
];

export const ALLOWED_AUDIO_TYPES = [
  "audio/mpeg", // .mp3
  "audio/wav",
  "audio/aac",
  "audio/ogg",
];

export const ALLOWED_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  ...ALLOWED_VIDEO_TYPES,
  ...ALLOWED_AUDIO_TYPES,
];

export const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5GB

export function isAllowedFileType(mimeType: string): boolean {
  return ALLOWED_TYPES.includes(mimeType);
}

export function getFileCategory(mimeType: string): "image" | "video" | "audio" | "unknown" {
  if (ALLOWED_IMAGE_TYPES.includes(mimeType)) return "image";
  if (ALLOWED_VIDEO_TYPES.includes(mimeType)) return "video";
  if (ALLOWED_AUDIO_TYPES.includes(mimeType)) return "audio";
  return "unknown";
}

// Format file size for display
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// Check if R2 public domain is configured
export const hasPublicDomain = Boolean(process.env.R2_PUBLIC_DOMAIN);

/**
 * Get a public URL for a file stored in R2.
 * This serves files directly from Cloudflare's CDN with ZERO egress through Vercel.
 *
 * Requires R2_PUBLIC_DOMAIN to be set (e.g., "files.yourdomain.com")
 * Set this up in Cloudflare Dashboard > R2 > Your Bucket > Settings > Custom Domains
 */
export function getPublicFileUrl(key: string): string | null {
  const publicDomain = process.env.R2_PUBLIC_DOMAIN;
  if (!publicDomain) {
    return null;
  }
  // Ensure proper URL encoding for special characters in filenames
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  return `https://${publicDomain}/${encodedKey}`;
}

/**
 * Get the best URL for serving a file - prefers public URL if available,
 * falls back to presigned URL.
 *
 * Public URL = zero Vercel bandwidth (served from Cloudflare CDN)
 * Presigned URL = still direct to R2, but requires signing overhead
 */
export async function getFileUrl(key: string, filename?: string): Promise<string> {
  // Try public URL first (zero bandwidth cost)
  const publicUrl = getPublicFileUrl(key);
  if (publicUrl) {
    return publicUrl;
  }

  // Fall back to presigned URL
  return getDownloadPresignedUrl(key, filename);
}
