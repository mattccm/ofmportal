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
    const agencyId = session.user.agencyId;

    const contentRequest = await db.contentRequest.findFirst({
      where: { id: requestId, agencyId },
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
    const creator = await db.creator.findFirst({
      where: {
        sessionToken: creatorToken,
        inviteStatus: "ACCEPTED",
        sessionExpiry: { gt: new Date() },
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

    const contentRequest = await db.contentRequest.findFirst({
      where: { id: requestId, creatorId: creator.id },
    });

    if (!contentRequest) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Request not found" }, { status: 404 }),
      };
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
    if (upload.request.agencyId !== session.user.agencyId) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      };
    }
  } else if (creatorToken) {
    const creator = await db.creator.findFirst({
      where: {
        sessionToken: creatorToken,
        inviteStatus: "ACCEPTED",
        sessionExpiry: { gt: new Date() },
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
