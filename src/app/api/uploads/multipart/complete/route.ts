import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "@/lib/api";
import { completeMultipartUpload, fileExists } from "@/lib/storage";
import { authorizeUploadRecord } from "@/lib/upload-auth";
import { finalizeUpload } from "@/lib/upload-finalize";

const completeSchema = z.object({
  uploadId: z.string().min(1, "Upload ID is required"), // our DB Upload record id
  multipartUploadId: z.string().min(1, "Multipart upload ID is required"),
  parts: z
    .array(
      z.object({
        PartNumber: z
          .number()
          .int("Part numbers must be whole numbers")
          .min(1, "Part numbers must be between 1 and 10000")
          .max(10000, "Part numbers must be between 1 and 10000"),
        ETag: z.string().min(1),
      })
    )
    .min(1, "At least one part is required"),
});

// S3/R2 error names meaning this multipart upload can never be completed as
// sent: the session is gone, or the part list doesn't match what was staged.
// Reported with a stable `code` so the client knows to drop its resume state
// and start over instead of retrying.
const MULTIPART_GONE_ERRORS = new Set(["NoSuchUpload"]);
const MULTIPART_INVALID_PARTS_ERRORS = new Set([
  "InvalidPart",
  "InvalidPartOrder",
  "EntityTooSmall",
]);

function storageErrorName(err: unknown): string | undefined {
  if (!err || typeof err !== "object") return undefined;
  const e = err as { name?: unknown; Code?: unknown };
  if (typeof e.Code === "string") return e.Code;
  return typeof e.name === "string" ? e.name : undefined;
}

export async function POST(req: NextRequest) {
  try {
    const body = await parseJsonBody(req);
    if (!body.ok) return body.response;
    const data = completeSchema.parse(body.data);

    // Authorize against the DB record (storage key comes from the record).
    const auth = await authorizeUploadRecord(req, data.uploadId);
    if (!auth.ok) {
      return auth.response;
    }

    // Assemble the object from its parts on the storage backend. Skip when a
    // previous call already finished (client retry after a lost response):
    // the multipart session no longer exists, so completing again would fail.
    if (auth.upload.uploadStatus !== "COMPLETED") {
      try {
        await completeMultipartUpload(
          auth.upload.storageKey,
          data.multipartUploadId,
          data.parts
        );
      } catch (err) {
        // The first call may have assembled the object but failed before the
        // DB update; treat it as done if the object is there.
        if (!(await fileExists(auth.upload.storageKey))) {
          const name = storageErrorName(err);
          if (name && MULTIPART_GONE_ERRORS.has(name)) {
            console.error(
              `[MultipartComplete] Multipart upload gone for ${auth.upload.id}:`,
              err
            );
            return NextResponse.json(
              {
                error: "This upload expired before it finished. Please upload the file again.",
                code: "MULTIPART_UPLOAD_GONE",
              },
              { status: 404 }
            );
          }
          if (name && MULTIPART_INVALID_PARTS_ERRORS.has(name)) {
            console.error(
              `[MultipartComplete] Invalid parts for ${auth.upload.id}:`,
              err
            );
            return NextResponse.json(
              {
                error: "Some parts of this upload were invalid. Please upload the file again.",
                code: "MULTIPART_PARTS_INVALID",
              },
              { status: 400 }
            );
          }
          throw err;
        }
      }
    }

    // Run the SAME post-upload bookkeeping as the single-shot complete flow,
    // including the HEAD check of the assembled object's real size.
    const result = await finalizeUpload(auth.upload);

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
