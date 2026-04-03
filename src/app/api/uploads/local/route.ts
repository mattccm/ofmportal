import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

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
    const session = await getServerSession(authOptions);
    const creatorToken = req.headers.get("x-creator-token");

    let agencyId: string;
    let creatorId: string | undefined;

    if (session?.user?.agencyId) {
      agencyId = session.user.agencyId;
      // creatorId will be set from contentRequest below
    } else if (creatorToken) {
      const creator = await db.creator.findFirst({
        where: {
          sessionToken: creatorToken,
          inviteStatus: "ACCEPTED",
          sessionExpiry: {
            gt: new Date(),
          },
        },
      });

      if (!creator) {
        return NextResponse.json(
          { error: "Invalid or expired session" },
          { status: 401 }
        );
      }

      agencyId = creator.agencyId;
      creatorId = creator.id;
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
        fileType: file.type,
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
