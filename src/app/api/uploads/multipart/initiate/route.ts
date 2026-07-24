import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  generateStorageKey,
  createMultipartUpload,
  useLocalStorage,
} from "@/lib/storage";
import { resolveUploadContext, validateUploadFile } from "@/lib/upload-auth";
import { handleCreatorResponse } from "@/lib/auto-reminder-scheduler";

const initiateSchema = z.object({
  requestId: z.string().min(1, "Request ID is required"),
  fileName: z.string().min(1, "File name is required"),
  fileType: z.string().min(1, "File type is required"),
  fileSize: z.number().min(1, "File size is required"),
  fieldId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    // Multipart requires an S3-compatible backend. When storage isn't
    // configured the client falls back to the local single-shot endpoint.
    if (useLocalStorage) {
      return NextResponse.json(
        { error: "Multipart upload is not available for local storage" },
        { status: 409 }
      );
    }

    const body = await req.json();
    const data = initiateSchema.parse(body);

    // Auth + agency/creator scoping (same rules as the presign route)
    const auth = await resolveUploadContext(req, data.requestId);
    if (!auth.ok) {
      return auth.response;
    }
    const { agencyId, creatorId } = auth.context;

    // File type / extension / size validation (same rules as the presign route)
    const invalid = validateUploadFile(data);
    if (invalid) {
      return invalid;
    }

    // Reuse the shared storage-key generation
    const storageKey = generateStorageKey(
      agencyId,
      creatorId,
      data.requestId,
      data.fileName
    );

    // Start the multipart upload on the storage backend
    const { uploadId: multipartUploadId, key } = await createMultipartUpload(
      storageKey,
      data.fileType
    );

    // Create the Upload record in PENDING, mirroring the presign route
    const upload = await db.upload.create({
      data: {
        requestId: data.requestId,
        creatorId,
        fileName: data.fileName,
        originalName: data.fileName,
        fileType: data.fileType,
        fileSize: BigInt(data.fileSize),
        storageKey: key,
        uploadStatus: "PENDING",
        fieldId: data.fieldId || null,
      },
    });

    // Trigger response detection for the reminder system (same as presign)
    await handleCreatorResponse(data.requestId, "upload_started").catch((err) => {
      console.error("Error handling creator response detection:", err);
    });

    return NextResponse.json({
      uploadId: upload.id, // our DB Upload record id
      multipartUploadId, // storage backend multipart upload id
      storageKey: key,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }

    console.error("[MultipartInitiate] Error initiating multipart upload:", error);
    return NextResponse.json(
      { error: "Failed to initiate upload" },
      { status: 500 }
    );
  }
}
