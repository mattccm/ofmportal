import { NextRequest, NextResponse } from "next/server";
import { creatorWhere, forbidden, requireAccess } from "@/lib/access/server";
import { db } from "@/lib/db";
import { z } from "zod";
import {
  getUploadPresignedUrl,
  isAllowedFileType,
  isAllowedFileExtension,
  MAX_FILE_SIZE,
} from "@/lib/storage";

// POST /api/media-library/presign
// Body: { creatorId, fileName, fileType (MIME), fileSize }
// Returns: { uploadUrl, storageKey }
//
// The client (media-uploader.tsx) PUTs the file directly to `uploadUrl`, then
// finalizes by calling POST /api/media-library to create the MediaItem row.
// This route therefore only issues the presigned URL and does NOT create a row.
const presignSchema = z.object({
  creatorId: z.string().min(1, "Creator ID is required"),
  fileName: z.string().min(1, "File name is required"),
  fileType: z.string().min(1, "File type is required"),
  fileSize: z.number().positive("File size is required"),
});

export async function POST(req: NextRequest) {
  try {
    const gate = await requireAccess("settings.mediaLibrary");
    if (gate.error) return gate.error;
    const { access } = gate;
    // The library is the creators' content, so it also needs "Their content library"
    if (!access.has("creatorInfo.content")) return forbidden("creatorInfo.content");

    const body = await req.json();
    const data = presignSchema.parse(body);

    // Verify creator belongs to the caller's agency
    const creator = await db.creator.findFirst({
      where: { AND: [creatorWhere(access), { id: data.creatorId }] },
      select: { id: true },
    });

    if (!creator) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    // Validate file type, extension, and size
    if (!isAllowedFileType(data.fileType)) {
      return NextResponse.json(
        { error: "File type not allowed" },
        { status: 400 }
      );
    }

    if (!isAllowedFileExtension(data.fileName)) {
      return NextResponse.json(
        { error: "File extension not allowed" },
        { status: 400 }
      );
    }

    if (data.fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds 5GB limit" },
        { status: 400 }
      );
    }

    // Media-library storage key namespace (kept separate from request uploads)
    const timestamp = Date.now();
    const sanitizedFilename = data.fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const storageKey = `media/${access.agencyId}/${data.creatorId}/${timestamp}-${sanitizedFilename}`;

    const { url, key } = await getUploadPresignedUrl(
      storageKey,
      data.fileType,
      data.fileSize
    );

    return NextResponse.json({ uploadUrl: url, storageKey: key });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error generating media presigned URL:", error);
    return NextResponse.json(
      { error: "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}
