import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { isAllowedFileType, isAllowedFileExtension, MAX_FILE_SIZE, useLocalStorage } from "@/lib/storage";
import { resolveMimeType } from "@/lib/file-utils";
import { checkCreatorUploadAllowed, findCreatorForUpload } from "@/lib/upload-auth";

// Local file upload handler for development when S3/R2 is not configured
// This endpoint receives files directly and stores them locally

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

// Ensure upload directory exists
async function ensureUploadDir(): Promise<void> {
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }
}

export async function POST(req: NextRequest) {
  try {
    // Local-disk uploads are a dev fallback only. When R2 is configured, files
    // written here would land on ephemeral disk and vanish on the next deploy.
    if (!useLocalStorage) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const session = await getServerSession(authOptions);
    const creatorToken = req.headers.get("x-creator-token");

    let agencyId: string;
    let creatorId: string | undefined;
    let creatorArchivedAt: Date | null = null;

    if (session?.user?.agencyId) {
      agencyId = session.user.agencyId;
      // creatorId will be set from contentRequest below
    } else if (creatorToken) {
      const creator = await findCreatorForUpload(creatorToken);

      if (!creator) {
        return NextResponse.json(
          { error: "Invalid or expired session" },
          { status: 401 }
        );
      }

      agencyId = creator.agencyId;
      creatorId = creator.id;
      creatorArchivedAt = creator.archivedAt;
    } else {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const requestId = formData.get("requestId") as string | null;
    const fieldId = formData.get("fieldId") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    if (!requestId) {
      return NextResponse.json(
        { error: "Request ID is required" },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds 5GB limit" },
        { status: 400 }
      );
    }

    // Validate file type (browsers report empty/alias types for some valid media)
    const fileType = resolveMimeType(file.name, file.type);
    if (!isAllowedFileType(fileType)) {
      return NextResponse.json(
        { error: "File type not allowed" },
        { status: 400 }
      );
    }

    if (!isAllowedFileExtension(file.name)) {
      return NextResponse.json(
        { error: "File extension not allowed" },
        { status: 400 }
      );
    }

    // Verify request belongs to the creator/agency
    const contentRequest = await db.contentRequest.findFirst({
      where: {
        id: requestId,
        ...(session?.user?.agencyId
          ? { agencyId: session.user.agencyId }
          : { creatorId }),
      },
    });

    if (!contentRequest) {
      return NextResponse.json(
        { error: "Request not found" },
        { status: 404 }
      );
    }

    // Creators can't upload to closed requests or once archived
    if (!session?.user?.agencyId) {
      const closed = checkCreatorUploadAllowed({
        creatorArchivedAt,
        requestStatus: contentRequest.status,
      });
      if (closed) {
        return closed;
      }
    }

    // If agency user, get creatorId from the request
    if (session?.user?.agencyId) {
      creatorId = contentRequest.creatorId;
    }

    // Ensure upload directory exists
    await ensureUploadDir();

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const storageKey = `${agencyId}/${creatorId!}/${requestId}/${timestamp}-${sanitizedFilename}`;
    const filePath = path.join(UPLOAD_DIR, storageKey);

    // Create subdirectories
    const fileDir = path.dirname(filePath);
    if (!existsSync(fileDir)) {
      await mkdir(fileDir, { recursive: true });
    }

    // Write file
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    // Create upload record
    const upload = await db.upload.create({
      data: {
        requestId,
        creatorId: creatorId!,
        fileName: file.name,
        originalName: file.name,
        fileType,
        fileSize: BigInt(file.size),
        storageKey,
        uploadStatus: "COMPLETED",
        uploadProgress: 100,
        uploadedAt: new Date(),
        fieldId: fieldId || null,
      },
    });

    // Update request status to IN_PROGRESS if it was PENDING
    await db.contentRequest.updateMany({
      where: {
        id: requestId,
        status: "PENDING",
      },
      data: {
        status: "IN_PROGRESS",
      },
    });

    return NextResponse.json({
      success: true,
      uploadId: upload.id,
      storageKey,
    });
  } catch (error) {
    console.error("Error uploading file locally:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
