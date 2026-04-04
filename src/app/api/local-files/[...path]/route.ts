import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { LOCAL_UPLOAD_DIR } from "@/lib/storage";

// MIME type mapping
const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".avi": "video/x-msvideo",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".pdf": "application/pdf",
};

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}

/**
 * Serve files from local storage (development/fallback mode).
 *
 * WARNING: This route is for development only when R2 is not configured.
 * In production, files should be served directly from R2 via public domain.
 *
 * This route DOES consume Vercel bandwidth - use R2 public domain in production!
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;

    if (!pathSegments || pathSegments.length === 0) {
      return NextResponse.json({ error: "No file path provided" }, { status: 400 });
    }

    // Reconstruct the storage key from path segments
    const storageKey = pathSegments.map(decodeURIComponent).join("/");

    // Validate path to prevent directory traversal
    const normalizedKey = path.normalize(storageKey);
    if (normalizedKey.includes("..") || path.isAbsolute(normalizedKey)) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    // Construct full file path
    const filePath = path.join(LOCAL_UPLOAD_DIR, normalizedKey);

    // Verify file is within upload directory
    const resolvedPath = path.resolve(filePath);
    const resolvedUploadDir = path.resolve(LOCAL_UPLOAD_DIR);
    if (!resolvedPath.startsWith(resolvedUploadDir)) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    // Check if file exists
    if (!existsSync(filePath)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Read file
    const fileBuffer = await readFile(filePath);
    const mimeType = getMimeType(filePath);

    // Return file with appropriate headers
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": mimeType,
        "Content-Length": fileBuffer.length.toString(),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Error serving local file:", error);
    return NextResponse.json(
      { error: "Failed to serve file" },
      { status: 500 }
    );
  }
}
