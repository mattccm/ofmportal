import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import {
  generateStorageKey,
  getUploadPresignedUrl,
  isAllowedFileType,
  MAX_FILE_SIZE,
} from "@/lib/storage";
import { handleCreatorResponse } from "@/lib/auto-reminder-scheduler";

const presignRequestSchema = z.object({
  requestId: z.string().min(1, "Request ID is required"),
  fileName: z.string().min(1, "File name is required"),
  fileType: z.string().min(1, "File type is required"),
  fileSize: z.number().min(1, "File size is required"),
  fieldId: z.string().optional(), // Template field ID for per-field uploads
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    // Allow both agency users and creators (via portal)
    // For creators, we'll check the request header for their token
    const creatorToken = req.headers.get("x-creator-token");

    let agencyId: string;
    let creatorId: string;

    if (session?.user?.agencyId) {
      // Agency user
      agencyId = session.user.agencyId;
      const body = await req.json();
      const validatedData = presignRequestSchema.parse(body);

      // Get request to verify it belongs to agency
      const contentRequest = await db.contentRequest.findFirst({
        where: {
          id: validatedData.requestId,
          agencyId,
        },
      });

      if (!contentRequest) {
        return NextResponse.json(
          { error: "Request not found" },
          { status: 404 }
        );
      }

      creatorId = contentRequest.creatorId;

      // Validate file type and size
      if (!isAllowedFileType(validatedData.fileType)) {
        return NextResponse.json(
          { error: "File type not allowed" },
          { status: 400 }
        );
      }

      if (validatedData.fileSize > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: "File size exceeds 5GB limit" },
          { status: 400 }
        );
      }

      // Generate storage key
      const storageKey = generateStorageKey(
        agencyId,
        creatorId,
        validatedData.requestId,
        validatedData.fileName
      );

      // Get presigned URL
      const { url, key } = await getUploadPresignedUrl(
        storageKey,
        validatedData.fileType,
        validatedData.fileSize
      );

      // Create upload record
      const upload = await db.upload.create({
        data: {
          requestId: validatedData.requestId,
          creatorId,
          fileName: validatedData.fileName,
          originalName: validatedData.fileName,
          fileType: validatedData.fileType,
          fileSize: BigInt(validatedData.fileSize),
          storageKey: key,
          uploadStatus: "PENDING",
          fieldId: validatedData.fieldId || null,
        },
      });

      // Trigger response detection for reminder system
      await handleCreatorResponse(validatedData.requestId, "upload_started").catch((err) => {
        console.error("Error handling creator response detection:", err);
      });

      return NextResponse.json({
        uploadId: upload.id,
        uploadUrl: url,
        storageKey: key,
      });
    } else if (creatorToken) {
      // Creator via portal - verify session token
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

      const body = await req.json();
      const validatedData = presignRequestSchema.parse(body);

      // Verify request belongs to this creator
      const contentRequest = await db.contentRequest.findFirst({
        where: {
          id: validatedData.requestId,
          creatorId: creator.id,
        },
      });

      if (!contentRequest) {
        return NextResponse.json(
          { error: "Request not found" },
          { status: 404 }
        );
      }

      // Validate file type and size
      if (!isAllowedFileType(validatedData.fileType)) {
        return NextResponse.json(
          { error: "File type not allowed" },
          { status: 400 }
        );
      }

      if (validatedData.fileSize > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: "File size exceeds 5GB limit" },
          { status: 400 }
        );
      }

      // Generate storage key
      const storageKey = generateStorageKey(
        agencyId,
        creatorId,
        validatedData.requestId,
        validatedData.fileName
      );

      // Get presigned URL
      const { url, key } = await getUploadPresignedUrl(
        storageKey,
        validatedData.fileType,
        validatedData.fileSize
      );

      // Create upload record
      const upload = await db.upload.create({
        data: {
          requestId: validatedData.requestId,
          creatorId,
          fileName: validatedData.fileName,
          originalName: validatedData.fileName,
          fileType: validatedData.fileType,
          fileSize: BigInt(validatedData.fileSize),
          storageKey: key,
          uploadStatus: "PENDING",
          fieldId: validatedData.fieldId || null,
        },
      });

      // Trigger response detection for reminder system (creator portal upload)
      await handleCreatorResponse(validatedData.requestId, "upload_started").catch((err) => {
        console.error("Error handling creator response detection:", err);
      });

      return NextResponse.json({
        uploadId: upload.id,
        uploadUrl: url,
        storageKey: key,
      });
    } else {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error generating presigned URL:", error);
    return NextResponse.json(
      { error: "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}
