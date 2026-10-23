import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "@/lib/api";
import { db } from "@/lib/db";
import { abortMultipartUpload } from "@/lib/storage";
import { authorizeUploadRecord } from "@/lib/upload-auth";

const abortSchema = z.object({
  uploadId: z.string().min(1, "Upload ID is required"), // our DB Upload record id
  multipartUploadId: z.string().min(1, "Multipart upload ID is required"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await parseJsonBody(req);
    if (!body.ok) return body.response;
    const data = abortSchema.parse(body.data);

    const auth = await authorizeUploadRecord(req, data.uploadId);
    if (!auth.ok) {
      return auth.response;
    }

    // Free the staged parts on the storage backend. Don't fail the request if
    // the multipart upload was already gone.
    try {
      await abortMultipartUpload(auth.upload.storageKey, data.multipartUploadId);
    } catch (err) {
      console.error("[MultipartAbort] Failed to abort on storage backend:", err);
    }

    // Clean up the placeholder record: PENDING, or FAILED server-side
    // verification. Never a completed upload.
    await db.upload.deleteMany({
      where: { id: data.uploadId, uploadStatus: { in: ["PENDING", "FAILED"] } },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }

    console.error("[MultipartAbort] Error aborting multipart upload:", error);
    return NextResponse.json(
      { error: "Failed to abort upload" },
      { status: 500 }
    );
  }
}
