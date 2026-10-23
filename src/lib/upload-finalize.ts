import { db } from "@/lib/db";
import { createHash } from "crypto";
import { fileExists, getFileMetadata, getObjectBytes } from "@/lib/storage";
import { after } from "next/server";
import { dispatchWebhookEvent } from "@/lib/webhooks";
import type { Upload, ContentRequest, Creator } from "@prisma/client";

// The upload record shape both complete flows fetch (request + its creator).
export type UploadWithRequest = Upload & {
  request: ContentRequest & { creator: Creator };
};

// A single field definition from ContentRequest.fields (stored as JSON).
// A "file" field is an upload slot the creator submits content into.
interface RequestFieldDef {
  id: string;
  type: string;
  required?: boolean;
}

function isFileField(value: unknown): value is RequestFieldDef {
  return (
    !!value &&
    typeof value === "object" &&
    (value as RequestFieldDef).type === "file" &&
    typeof (value as RequestFieldDef).id === "string"
  );
}

/**
 * The set of file-field (upload slot) ids that MUST have an approved upload
 * before a request can roll up to APPROVED.
 *
 * A request's `fields` JSON is an array of `{ id, label, type, required }`.
 * The upload slots are the `type === "file"` entries; a slot is mandatory when
 * `required === true`. If a template marks no file field as required we treat
 * every file field as a required slot (matching the field-review rollup, which
 * requires every file field to be approved). Ad-hoc requests with no file
 * fields return an empty array, so callers fall back to raw upload counts.
 */
export function getRequiredFileFieldIds(fields: unknown): string[] {
  if (!Array.isArray(fields)) return [];
  const fileFields = fields.filter(isFileField);
  const requiredFileFields = fileFields.filter((f) => f.required === true);
  const slots = requiredFileFields.length > 0 ? requiredFileFields : fileFields;
  return slots.map((f) => f.id);
}

// Content-hash scheme shared with the browser duplicate check. Files up to
// FULL_HASH_MAX_BYTES are hashed whole; larger files hash the first and last
// EDGE_HASH_BYTES followed by the decimal file size as UTF-8, i.e.
// SHA-256(first 8MB || last 8MB || String(size)), hex encoded.
export const FULL_HASH_MAX_BYTES = 100 * 1024 * 1024; // 100MB
export const EDGE_HASH_BYTES = 8 * 1024 * 1024; // 8MB

async function computeStoredFileHash(key: string, size: number): Promise<string> {
  const hash = createHash("sha256");
  if (size <= FULL_HASH_MAX_BYTES) {
    hash.update(await getObjectBytes(key));
  } else {
    hash.update(await getObjectBytes(key, { start: 0, end: EDGE_HASH_BYTES - 1 }));
    hash.update(await getObjectBytes(key, { start: size - EDGE_HASH_BYTES, end: size - 1 }));
    hash.update(String(size));
  }
  return hash.digest("hex");
}

/**
 * Best-effort: hash the stored object and record a ContentFingerprint so
 * later duplicate checks can match against this upload. Never throws.
 */
async function storeContentFingerprint(upload: UploadWithRequest): Promise<void> {
  try {
    const metadata = await getFileMetadata(upload.storageKey);
    const size = metadata?.size || Number(upload.fileSize);
    if (!size) return;

    const fileHash = await computeStoredFileHash(upload.storageKey, size);

    await db.contentFingerprint.upsert({
      where: { uploadId: upload.id },
      create: {
        uploadId: upload.id,
        creatorId: upload.creatorId,
        agencyId: upload.request.agencyId,
        fileHash,
        fileName: upload.originalName,
        fileSize: BigInt(size),
        mimeType: upload.fileType || "application/octet-stream",
      },
      // Server-computed hash is authoritative; keep any client-supplied
      // perceptual hash / dimensions already stored
      update: { fileHash },
    });
  } catch (error) {
    console.error(`[UploadFinalize] Failed to store fingerprint for ${upload.id}:`, error);
  }
}

// The API serializes fileSize (a BigInt column) down to a number.
type SerializedUpload = Omit<Upload, "fileSize"> & { fileSize: number };

export type FinalizeResult =
  | { ok: true; upload: SerializedUpload }
  | { ok: false; status: number; error: string };

/**
 * Shared post-upload bookkeeping used by BOTH the single-shot presigned-PUT
 * complete flow and the multipart complete flow.
 *
 * The caller is responsible for authenticating the request and confirming the
 * upload record belongs to the caller. This function then:
 *   1. Verifies the object actually landed in storage (with a retry for R2
 *      eventual consistency). Skippable via `verifyExists: false` when the
 *      caller already knows the object exists (e.g. right after
 *      CompleteMultipartUpload).
 *   2. Transitions the Upload record to COMPLETED, idempotently.
 *   3. Fires the same webhooks and request-status roll-up as before.
 */
export async function finalizeUpload(
  upload: UploadWithRequest,
  options: { verifyExists?: boolean } = {}
): Promise<FinalizeResult> {
  const { verifyExists = true } = options;

  if (verifyExists) {
    // Verify file exists in storage (with retry for eventual consistency)
    let exists = await fileExists(upload.storageKey);

    // If not found, wait a moment and try again (R2 eventual consistency)
    if (!exists) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      exists = await fileExists(upload.storageKey);
    }

    if (!exists) {
      console.error(`[UploadFinalize] File verification failed for ${upload.storageKey}`);
      return {
        ok: false,
        status: 400,
        error: "File not found in storage. Please retry the upload.",
      };
    }
  }

  // Update upload status (only if not already completed, so retries are idempotent)
  const transition = await db.upload.updateMany({
    where: {
      id: upload.id,
      uploadStatus: { not: "COMPLETED" },
    },
    data: {
      uploadStatus: "COMPLETED",
      uploadProgress: 100,
      uploadedAt: new Date(),
    },
  });
  const transitioned = transition.count > 0;

  const updatedUpload = await db.upload.findUnique({
    where: { id: upload.id },
  });

  if (!updatedUpload) {
    return { ok: false, status: 404, error: "Upload not found" };
  }

  if (transitioned) {
    // Fire webhook events
    // after() keeps the serverless function alive until delivery finishes
    after(() =>
      dispatchWebhookEvent(upload.request.agencyId, "upload.completed", {
        uploadId: updatedUpload.id,
        fileName: updatedUpload.originalName,
        fileSize: Number(updatedUpload.fileSize),
        requestId: upload.requestId,
        creatorId: upload.creatorId,
        creatorName: upload.request.creator.name,
      })
    );

    // Also fire creator.uploaded
    after(() =>
      dispatchWebhookEvent(upload.request.agencyId, "creator.uploaded", {
        creatorId: upload.creatorId,
        creatorName: upload.request.creator.name,
        uploadId: updatedUpload.id,
        fileName: updatedUpload.originalName,
        requestId: upload.requestId,
      })
    );

    // Record a content fingerprint for duplicate detection (after the response)
    after(() => storeContentFingerprint(upload));

    // This upload just reached COMPLETED, so the creator has started submitting.
    // Roll the request forward from PENDING (idempotent via the where clause).
    await db.contentRequest.updateMany({
      where: { id: upload.requestId, status: "PENDING" },
      data: { status: "IN_PROGRESS" },
    });
  }

  return {
    ok: true,
    upload: {
      ...updatedUpload,
      fileSize: Number(updatedUpload.fileSize),
    },
  };
}
