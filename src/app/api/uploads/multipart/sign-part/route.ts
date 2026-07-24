import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUploadPartPresignedUrls } from "@/lib/storage";
import { authorizeUploadRecord } from "@/lib/upload-auth";

const signPartSchema = z.object({
  uploadId: z.string().min(1, "Upload ID is required"), // our DB Upload record id
  multipartUploadId: z.string().min(1, "Multipart upload ID is required"),
  // Request one or more part URLs at once to cut down on round-trips.
  partNumbers: z
    .array(z.number().int().min(1).max(10000))
    .min(1, "At least one part number is required")
    .max(100, "Too many part numbers requested at once"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = signPartSchema.parse(body);

    // Authorize against the DB record; the storage key is taken from the
    // record (never trusted from the client).
    const auth = await authorizeUploadRecord(req, data.uploadId);
    if (!auth.ok) {
      return auth.response;
    }

    const urls = await getUploadPartPresignedUrls(
      auth.upload.storageKey,
      data.multipartUploadId,
      data.partNumbers
    );

    return NextResponse.json({ parts: urls });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }

    console.error("[MultipartSignPart] Error signing part URLs:", error);
    return NextResponse.json(
      { error: "Failed to sign upload parts" },
      { status: 500 }
    );
  }
}
