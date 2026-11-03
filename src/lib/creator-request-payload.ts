import { getPublicFileUrl, getViewPresignedUrl, useLocalStorage } from "./storage";
import { isCreatorPseudoEmail, staffFirstName } from "./portal-auth";

/**
 * A request's uploads and comments exactly as the creator's request page gets
 * them: the creator API (api/portal/requests/[id]) and the staff "Preview as
 * creator" (preview/request/[id]) both build them here. Server only.
 */

/** What is read for each upload the creator sees (finished uploads only) */
export const CREATOR_UPLOAD_SELECT = {
  id: true,
  fileName: true,
  originalName: true,
  fileType: true,
  fileSize: true,
  status: true,
  uploadStatus: true,
  storageKey: true,
  thumbnailUrl: true,
  thumbnailKey: true,
  fieldId: true,
  reviewNote: true,
  createdAt: true,
} as const;

interface UploadRow {
  id: string;
  fileName: string;
  originalName: string;
  fileType: string;
  fileSize: bigint;
  status: string;
  uploadStatus: string;
  storageKey: string;
  thumbnailUrl: string | null;
  thumbnailKey: string | null;
  fieldId: string | null;
  reviewNote: string | null;
  createdAt: Date;
}

/** BigInt to number, and a short-lived preview link for images and video thumbnails */
export async function serializeCreatorUpload(upload: UploadRow) {
  let thumbnailUrl = upload.thumbnailUrl;

  // For images, use the actual file as preview (via public URL if available)
  const isImage = upload.fileType.startsWith("image/");

  // Try to get a preview URL - prioritize public URL for zero bandwidth
  let previewUrl: string | null = null;
  const keyToUse = isImage ? upload.storageKey : upload.thumbnailKey;

  if (keyToUse) {
    try {
      // Creator content: getPublicFileUrl returns null, so this signs
      previewUrl = getPublicFileUrl(keyToUse);
      if (!previewUrl) {
        if (useLocalStorage) {
          previewUrl = `/api/local-files/${encodeURIComponent(keyToUse)}`;
        } else {
          previewUrl = await getViewPresignedUrl(keyToUse);
        }
      }
    } catch {
      // Preview generation failed
    }
  }

  // Use computed preview URL as thumbnail for images
  if (isImage && previewUrl && !thumbnailUrl) {
    thumbnailUrl = previewUrl;
  }

  return {
    id: upload.id,
    fileName: upload.fileName,
    originalName: upload.originalName,
    fileType: upload.fileType,
    fileSize: Number(upload.fileSize),
    status: upload.status,
    uploadStatus: upload.uploadStatus,
    storageKey: upload.storageKey,
    thumbnailUrl: thumbnailUrl || previewUrl,
    fieldId: upload.fieldId,
    // CCM's note on a file it sent back, so the creator sees why
    reviewNote: upload.status === "REJECTED" ? upload.reviewNote : null,
    createdAt: upload.createdAt.toISOString(),
  };
}

interface CommentRow {
  id: string;
  message: string;
  createdAt: Date;
  fieldId: string | null;
  mentions: unknown;
  user: { name: string | null; avatar: string | null; email: string } | null;
}

/** A comment as the creator sees it: their own as "You", staff by first name only */
export function serializeCreatorComment(comment: CommentRow, creatorName: string) {
  // Check if this is a creator comment (stored in mentions field)
  let isCreatorComment = false;
  let creatorInfo: { name?: string } | null = null;
  try {
    const mentions = typeof comment.mentions === "string" ? JSON.parse(comment.mentions) : comment.mentions;
    if (Array.isArray(mentions) && mentions.length > 0 && mentions[0]?.type === "creator") {
      isCreatorComment = true;
      creatorInfo = mentions[0];
    }
  } catch {
    // Invalid JSON, not a creator comment
  }

  // A creator's own comment (marker, or a hidden .internal pseudo-user)
  // shows as "You"; staff show by first name only, never an email
  const mine = isCreatorComment || isCreatorPseudoEmail(comment.user?.email);
  return {
    id: comment.id,
    content: comment.message,
    createdAt: comment.createdAt.toISOString(),
    fieldId: comment.fieldId,
    isAgency: !mine,
    user: mine
      ? { name: creatorInfo?.name || creatorName }
      : comment.user
        ? { name: staffFirstName(comment.user.name), image: comment.user.avatar ?? undefined }
        : undefined,
  };
}
