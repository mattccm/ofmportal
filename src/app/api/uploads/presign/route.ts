import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { forbidden, getAccess, requestWhere } from "@/lib/access/server";
import { z } from "zod";
import {
  generateStorageKey,
  getUploadPresignedUrl,
  isAllowedFileType,
  isAllowedFileExtension,
  MAX_FILE_SIZE,
  useLocalStorage,
} from "@/lib/storage";
import { handleCreatorResponse } from "@/lib/auto-reminder-scheduler";
import { checkCreatorUploadAllowed, findCreatorForUpload } from "@/lib/upload-auth";
import { parseJsonBody } from "@/lib/api";

const presignRequestSchema = z.object({
  requestId: z.string().min(1, "Request ID is required"),
  fileName: z.string().min(1, "File name is required"),
  fileType: z.string().min(1, "File type is required"),
  fileSize: z.number().min(1, "File size is required"),
  fieldId: z.string().optional(), // Template field ID for per-field uploads
});

export async function POST(req: NextRequest) {
  try {
    // Presigned PUTs need an S3-compatible backend. 409 tells the client to use
    // the local-disk endpoint instead (dev only; that endpoint is off otherwise).
    if (useLocalStorage) {
      return NextResponse.json(
        { error: "Direct upload is not available for local storage" },
        { status: 409 }
      );
    }

    const session = await getServerSession(authOptions);

    // Allow both agency users and creators (via portal)
    // For creators, we'll check the request header for their token
    const creatorToken = req.headers.get("x-creator-token");

    let agencyId: string;
    let creatorId: string;

    if (session?.user?.agencyId) {
      // Agency user: uploading on a creator's behalf changes the request
      const access = await getAccess(session);
      if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (!access.has("requests.upload")) return forbidden("requests.upload");
      agencyId = access.agencyId;
      const body = await parseJsonBody(req);
      if (!body.ok) return body.response;
      const validatedData = presignRequestSchema.parse(body.data);

      // Get request to verify it belongs to agency
      const contentRequest = await db.contentRequest.findFirst({
        where: { AND: [requestWhere(access), { id: validatedData.requestId }] },
      });

      if (!contentRequest) {
        return NextResponse.json(
          { error: "Request not found" },
          { status: 404 }
        );
      }

      creatorId = contentRequest.creatorId;

      // Validate file type, extension, and size
      if (!isAllowedFileType(validatedData.fileType)) {
        return NextResponse.json(
          { error: "File type not allowed" },
          { status: 400 }
        );
      }

      if (!isAllowedFileExtension(validatedData.fileName)) {
        return NextResponse.json(
          { error: "File extension not allowed" },
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
      const creator = await findCreatorForUpload(creatorToken);

      if (!creator) {
        return NextResponse.json(
          { error: "Invalid or expired session" },
          { status: 401 }
        );
      }

      agencyId = creator.agencyId;
      creatorId = creator.id;

      const body = await parseJsonBody(req);
      if (!body.ok) return body.response;
      const validatedData = presignRequestSchema.parse(body.data);

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

      // Closed requests (draft/approved/cancelled/archived) and archived
      // creators can't take new uploads.
      const closed = checkCreatorUploadAllowed({
        creatorArchivedAt: creator.archivedAt,
        requestStatus: contentRequest.status,
      });
      if (closed) {
        return closed;
      }

      // Validate file type, extension, and size
      if (!isAllowedFileType(validatedData.fileType)) {
        return NextResponse.json(
          { error: "File type not allowed" },
          { status: 400 }
        );
      }

      if (!isAllowedFileExtension(validatedData.fileName)) {
        return NextResponse.json(
          { error: "File extension not allowed" },
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
