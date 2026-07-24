import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { completeMultipartUpload } from "@/lib/storage";
import { authorizeUploadRecord } from "@/lib/upload-auth";
import { finalizeUpload } from "@/lib/upload-finalize";

const completeSchema = z.object({
  uploadId: z.string().min(1, "Upload ID is required"), // our DB Upload record id
  multipartUploadId: z.string().min(1, "Multipart upload ID is required"),
  parts: z
    .array(
      z.object({
        PartNumber: z.number().int().min(1).max(10000),
        ETag: z.string().min(1),
      })
    )
    .min(1, "At least one part is required"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = completeSchema.parse(body);

    // Authorize against the DB record (storage key comes from the record).
    const auth = await authorizeUploadRecord(req, data.uploadId);
    if (!auth.ok) {
      return auth.response;
    }

    // Assemble the object from its parts on the storage backend.
    await completeMultipartUpload(
      auth.upload.storageKey,
      data.multipartUploadId,
      data.parts
    );

    // Run the SAME post-upload bookkeeping as the single-shot complete flow.
    // The object is guaranteed to exist right after CompleteMultipartUpload,
    // so skip the extra HEAD round-trip.
    const result = await finalizeUpload(auth.upload, { verifyExists: false });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      success: true,
      upload: result.upload,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }

    console.error("[MultipartComplete] Error completing multipart upload:", error);
    return NextResponse.json(
      {
        error: "Failed to complete upload",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
