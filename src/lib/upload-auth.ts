import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  isAllowedFileType,
  isAllowedFileExtension,
  MAX_FILE_SIZE,
} from "@/lib/storage";
import type { UploadWithRequest } from "@/lib/upload-finalize";
import { CREATOR_HIDDEN_STATUSES } from "@/lib/portal-auth";
import type { RequestStatus } from "@prisma/client";
import { forbidden, getAccess, requestWhere } from "@/lib/access/server";

/**
 * Request statuses that no longer accept creator uploads: everything a creator
 * can't see (draft / cancelled / archived) plus requests that are already
 * approved.
 */
export const UPLOAD_CLOSED_STATUSES: RequestStatus[] = [
  ...CREATOR_HIDDEN_STATUSES,
  "APPROVED",
];

/** Machine-readable code sent with the 409 so clients can tell it apart. */
export const UPLOAD_CLOSED_CODE = "UPLOAD_CLOSED";

export const UPLOAD_CLOSED_MESSAGE =
  "This request is closed for uploads. Contact your manager if you need to add more.";

const CREATOR_ARCHIVED_MESSAGE =
  "Your account is no longer accepting uploads. Contact your manager if you need to add more.";

/**
 * Creator-side upload gate shared by the presign, local and multipart initiate
 * routes. Returns a 409 response when the creator is archived or the request
 * is closed for uploads, or null when the upload may proceed.
 */
export function checkCreatorUploadAllowed(input: {
  creatorArchivedAt: Date | null;
  requestStatus: RequestStatus;
}): NextResponse | null {
  if (input.creatorArchivedAt) {
    return NextResponse.json(
      { error: CREATOR_ARCHIVED_MESSAGE, code: UPLOAD_CLOSED_CODE },
      { status: 409 }
    );
  }
  if (UPLOAD_CLOSED_STATUSES.includes(input.requestStatus)) {
    return NextResponse.json(
      { error: UPLOAD_CLOSED_MESSAGE, code: UPLOAD_CLOSED_CODE },
      { status: 409 }
    );
  }
  return null;
}

/**
 * Look up a creator by session token for an upload. Unlike session validation
 * elsewhere this does NOT filter out archived creators, so the caller can tell
 * an archived creator (409, readable message) apart from a bad session (401).
 */
export async function findCreatorForUpload(creatorToken: string) {
  return db.creator.findFirst({
    where: {
      sessionToken: creatorToken,
      inviteStatus: "ACCEPTED",
      sessionExpiry: { gt: new Date() },
    },
  });
}

export interface UploadContext {
  agencyId: string;
  creatorId: string;
  requestId: string;
}

export type UploadContextResult =
  | { ok: true; context: UploadContext }
  | { ok: false; response: NextResponse };

/**
 * Resolve and authorize the creator/agency + request for a NEW upload, using
 * the exact same rules as the single-shot presign route:
 *   - agency users are scoped to their agency's requests
 *   - creators are authenticated via the x-creator-token session and scoped to
 *     their own requests
 * This keeps agency/creator scoping identical across the presign and multipart
 * entry points.
 */
export async function resolveUploadContext(
  req: NextRequest,
  requestId: string
): Promise<UploadContextResult> {
  const session = await getServerSession(authOptions);
  const creatorToken = req.headers.get("x-creator-token");

  if (session?.user?.agencyId) {
    const access = await getAccess(session);
    if (!access) {
      return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    }
    // Staff uploading on a creator's behalf
    if (!access.has("requests.upload")) return { ok: false, response: forbidden("requests.upload") };
    const agencyId = access.agencyId;

    const contentRequest = await db.contentRequest.findFirst({
      where: { AND: [requestWhere(access), { id: requestId }] },
    });

    if (!contentRequest) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Request not found" }, { status: 404 }),
      };
    }

    return {
      ok: true,
      context: { agencyId, creatorId: contentRequest.creatorId, requestId },
    };
  }

  if (creatorToken) {
    const creator = await findCreatorForUpload(creatorToken);

    if (!creator) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Invalid or expired session" },
          { status: 401 }
        ),
      };
    }

    const contentRequest = await db.contentRequest.findFirst({
      where: { id: requestId, creatorId: creator.id },
    });

    if (!contentRequest) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Request not found" }, { status: 404 }),
      };
    }

    // Closed requests / archived creators can't take new uploads.
    const closed = checkCreatorUploadAllowed({
      creatorArchivedAt: creator.archivedAt,
      requestStatus: contentRequest.status,
    });
    if (closed) {
      return { ok: false, response: closed };
    }

    return {
      ok: true,
      context: { agencyId: creator.agencyId, creatorId: creator.id, requestId },
    };
  }

  return {
    ok: false,
    response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
  };
}

/**
 * Validate file type / extension / size, matching the presign route exactly.
 * Returns an error response, or null when the file passes.
 */
export function validateUploadFile(input: {
  fileName: string;
  fileType: string;
  fileSize: number;
}): NextResponse | null {
  if (!isAllowedFileType(input.fileType)) {
    return NextResponse.json({ error: "File type not allowed" }, { status: 400 });
  }

  if (!isAllowedFileExtension(input.fileName)) {
    return NextResponse.json({ error: "File extension not allowed" }, { status: 400 });
  }

  if (input.fileSize > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File size exceeds 5GB limit" },
      { status: 400 }
    );
  }

  return null;
}

export type UploadRecordResult =
  | { ok: true; upload: UploadWithRequest }
  | { ok: false; response: NextResponse };

/**
 * Load an existing Upload record by its database id and authorize the caller
 * against it, using the same checks as the single-shot complete route. Used by
 * the multipart sign-part / complete / abort routes so an authenticated creator
 * can only ever touch their own in-flight upload.
 */
export async function authorizeUploadRecord(
  req: NextRequest,
  uploadId: string
): Promise<UploadRecordResult> {
  const session = await getServerSession(authOptions);
  const creatorToken = req.headers.get("x-creator-token");

  const upload = await db.upload.findUnique({
    where: { id: uploadId },
    include: {
      request: {
        include: { creator: true },
      },
    },
  });

  if (!upload) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Upload not found" }, { status: 404 }),
    };
  }

  if (session?.user?.agencyId) {
    const access = await getAccess(session);
    if (!access || upload.request.agencyId !== access.agencyId) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      };
    }
    if (!access.has("requests.upload")) return { ok: false, response: forbidden("requests.upload") };
    const visible = await db.contentRequest.count({
      where: { AND: [requestWhere(access), { id: upload.requestId }] },
    });
    if (!visible) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Upload not found" }, { status: 404 }),
      };
    }
  } else if (creatorToken) {
    const creator = await db.creator.findFirst({
      where: {
        sessionToken: creatorToken,
        inviteStatus: "ACCEPTED",
        sessionExpiry: { gt: new Date() },
        archivedAt: null,
      },
    });

    if (!creator) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Invalid or expired session" },
          { status: 401 }
        ),
      };
    }

    if (creator.id !== upload.creatorId) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Not authorized for this upload" },
          { status: 401 }
        ),
      };
    }
  } else {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { ok: true, upload };
}
