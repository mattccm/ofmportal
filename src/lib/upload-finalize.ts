import { db } from "@/lib/db";
import { fileExists } from "@/lib/storage";
import { dispatchWebhookEvent } from "@/lib/webhooks";
import type { Upload, ContentRequest, Creator } from "@prisma/client";

// The upload record shape both complete flows fetch (request + its creator).
export type UploadWithRequest = Upload & {
  request: ContentRequest & { creator: Creator };
};

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
    dispatchWebhookEvent(upload.request.agencyId, "upload.completed", {
      uploadId: updatedUpload.id,
      fileName: updatedUpload.originalName,
      fileSize: Number(updatedUpload.fileSize),
      requestId: upload.requestId,
      creatorId: upload.creatorId,
      creatorName: upload.request.creator.name,
    });

    // Also fire creator.uploaded
    dispatchWebhookEvent(upload.request.agencyId, "creator.uploaded", {
      creatorId: upload.creatorId,
      creatorName: upload.request.creator.name,
      uploadId: updatedUpload.id,
      fileName: updatedUpload.originalName,
      requestId: upload.requestId,
    });

    // Check if all uploads for this request are complete
    // and update request status if needed
    const pendingUploads = await db.upload.count({
      where: {
        requestId: upload.requestId,
        uploadStatus: { not: "COMPLETED" },
      },
    });

    if (pendingUploads === 0) {
      // Check total uploads for this request
      const totalUploads = await db.upload.count({
        where: {
          requestId: upload.requestId,
          uploadStatus: "COMPLETED",
        },
      });

      if (totalUploads > 0) {
        // Update request status to IN_PROGRESS if it was PENDING
        await db.contentRequest.updateMany({
          where: {
            id: upload.requestId,
            status: "PENDING",
          },
          data: {
            status: "IN_PROGRESS",
          },
        });
      }
    }
  }

  return {
    ok: true,
    upload: {
      ...updatedUpload,
      fileSize: Number(updatedUpload.fileSize),
    },
  };
}
