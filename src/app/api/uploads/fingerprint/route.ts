import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import type {
  StoreFingerprintRequest,
  StoreFingerprintResponse,
} from "@/types/content-fingerprint";

// Schema for storing fingerprint
const storeFingerprintSchema = z.object({
  uploadId: z.string().min(1, "Upload ID is required"),
  fileHash: z.string().min(1, "File hash is required"),
  fileName: z.string().min(1, "File name is required"),
  fileSize: z.number().min(1, "File size is required"),
  mimeType: z.string().min(1, "Mime type is required"),
  perceptualHash: z.string().optional(),
  dimensions: z
    .object({
      width: z.number(),
      height: z.number(),
    })
    .optional(),
  duration: z.number().optional(),
  frameHashes: z.array(z.string()).optional(),
});

/**
 * POST /api/uploads/fingerprint
 * Store fingerprint data for an upload after it completes.
 * This creates a ContentFingerprint record for future duplicate detection.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const creatorToken = req.headers.get("x-creator-token");

    if (!session?.user?.agencyId && !creatorToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = storeFingerprintSchema.parse(body);

    // Get upload and verify access
    const upload = await db.upload.findUnique({
      where: { id: validatedData.uploadId },
      include: {
        request: {
          select: {
            agencyId: true,
            creatorId: true,
          },
        },
      },
    });

    if (!upload) {
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }

    // Verify access
    let hasAccess = false;
    let agencyId: string;
    let creatorId: string;

    if (session?.user?.agencyId) {
      hasAccess = upload.request.agencyId === session.user.agencyId;
      agencyId = upload.request.agencyId;
      creatorId = upload.creatorId;
    } else if (creatorToken) {
      const creator = await db.creator.findFirst({
        where: {
          sessionToken: creatorToken,
          inviteStatus: "ACCEPTED",
          sessionExpiry: { gt: new Date() },
        },
      });

      if (creator && upload.creatorId === creator.id) {
        hasAccess = true;
        agencyId = creator.agencyId;
        creatorId = creator.id;
      } else {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    } else {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Check if fingerprint already exists for this upload
    const existingFingerprint = await db.contentFingerprint.findUnique({
      where: { uploadId: validatedData.uploadId },
    });

    let fingerprint;

    if (existingFingerprint) {
      // Update existing fingerprint
      fingerprint = await db.contentFingerprint.update({
        where: { uploadId: validatedData.uploadId },
        data: {
          fileHash: validatedData.fileHash,
          perceptualHash: validatedData.perceptualHash || null,
          fileName: validatedData.fileName,
          fileSize: BigInt(validatedData.fileSize),
          mimeType: validatedData.mimeType,
          width: validatedData.dimensions?.width || null,
          height: validatedData.dimensions?.height || null,
          duration: validatedData.duration || null,
          frameHashes: validatedData.frameHashes || [],
        },
      });
    } else {
      // Create new fingerprint record
      fingerprint = await db.contentFingerprint.create({
        data: {
          uploadId: validatedData.uploadId,
          creatorId: creatorId!,
          agencyId: agencyId!,
          fileHash: validatedData.fileHash,
          perceptualHash: validatedData.perceptualHash || null,
          fileName: validatedData.fileName,
          fileSize: BigInt(validatedData.fileSize),
          mimeType: validatedData.mimeType,
          width: validatedData.dimensions?.width || null,
          height: validatedData.dimensions?.height || null,
          duration: validatedData.duration || null,
          frameHashes: validatedData.frameHashes || [],
        },
      });
    }

    // Also update upload metadata for backwards compatibility
    const existingMetadata = (upload.metadata || {}) as Record<string, unknown>;

    await db.upload.update({
      where: { id: validatedData.uploadId },
      data: {
        metadata: {
          ...existingMetadata,
          fileHash: validatedData.fileHash,
          perceptualHash: validatedData.perceptualHash,
          dimensions: validatedData.dimensions,
          duration: validatedData.duration,
          frameHashes: validatedData.frameHashes,
          fingerprintVersion: 2,
          fingerprintedAt: new Date().toISOString(),
        } as object,
      },
    });

    const response: StoreFingerprintResponse = {
      fingerprintId: fingerprint.id,
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error storing fingerprint:", error);
    return NextResponse.json(
      { error: "Failed to store fingerprint" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/uploads/fingerprint?uploadId=xxx
 * Retrieve fingerprint data for an upload
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const creatorToken = req.headers.get("x-creator-token");

    if (!session?.user?.agencyId && !creatorToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const uploadId = searchParams.get("uploadId");

    if (!uploadId) {
      return NextResponse.json(
        { error: "Upload ID is required" },
        { status: 400 }
      );
    }

    // Try to get from ContentFingerprint table first
    const fingerprint = await db.contentFingerprint.findUnique({
      where: { uploadId },
      include: {
        upload: {
          select: {
            request: {
              select: {
                agencyId: true,
              },
            },
          },
        },
      },
    });

    if (fingerprint) {
      // Verify access
      let hasAccess = false;

      if (session?.user?.agencyId) {
        hasAccess = fingerprint.upload.request.agencyId === session.user.agencyId;
      } else if (creatorToken) {
        const creator = await db.creator.findFirst({
          where: {
            OR: [{ inviteToken: creatorToken }, { id: creatorToken }],
            inviteStatus: "ACCEPTED",
          },
        });

        if (creator && fingerprint.creatorId === creator.id) {
          hasAccess = true;
        }
      }

      if (!hasAccess) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      return NextResponse.json({
        id: fingerprint.id,
        uploadId: fingerprint.uploadId,
        creatorId: fingerprint.creatorId,
        fileHash: fingerprint.fileHash,
        perceptualHash: fingerprint.perceptualHash,
        fileName: fingerprint.fileName,
        fileSize: Number(fingerprint.fileSize),
        mimeType: fingerprint.mimeType,
        dimensions: fingerprint.width && fingerprint.height
          ? { width: fingerprint.width, height: fingerprint.height }
          : null,
        duration: fingerprint.duration,
        frameHashes: fingerprint.frameHashes,
        createdAt: fingerprint.createdAt,
        fingerprintVersion: 2,
      });
    }

    // Fallback to upload metadata for backwards compatibility
    const upload = await db.upload.findUnique({
      where: { id: uploadId },
      select: {
        id: true,
        originalName: true,
        fileSize: true,
        fileType: true,
        creatorId: true,
        createdAt: true,
        metadata: true,
        request: {
          select: {
            agencyId: true,
          },
        },
      },
    });

    if (!upload) {
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }

    // Verify access
    let hasAccess = false;

    if (session?.user?.agencyId) {
      hasAccess = upload.request.agencyId === session.user.agencyId;
    } else if (creatorToken) {
      const creator = await db.creator.findFirst({
        where: {
          sessionToken: creatorToken,
          inviteStatus: "ACCEPTED",
          sessionExpiry: { gt: new Date() },
        },
      });

      if (creator && upload.creatorId === creator.id) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const metadata = (upload.metadata || {}) as Record<string, unknown>;

    return NextResponse.json({
      id: `fp_${upload.id}`,
      uploadId: upload.id,
      creatorId: upload.creatorId,
      fileHash: metadata.fileHash || metadata.contentHash || null,
      perceptualHash: metadata.perceptualHash || null,
      fileName: upload.originalName,
      fileSize: Number(upload.fileSize),
      mimeType: upload.fileType,
      dimensions: metadata.dimensions || null,
      duration: metadata.duration || null,
      frameHashes: metadata.frameHashes || null,
      createdAt: upload.createdAt,
      fingerprintVersion: metadata.fingerprintVersion || 0,
    });
  } catch (error) {
    console.error("Error getting fingerprint:", error);
    return NextResponse.json(
      { error: "Failed to get fingerprint" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/uploads/fingerprint?uploadId=xxx
 * Remove fingerprint data from an upload
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins and owners can delete fingerprints
    if (!["ADMIN", "OWNER"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "You do not have permission to delete fingerprints" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const uploadId = searchParams.get("uploadId");

    if (!uploadId) {
      return NextResponse.json(
        { error: "Upload ID is required" },
        { status: 400 }
      );
    }

    const upload = await db.upload.findUnique({
      where: { id: uploadId },
      include: {
        request: {
          select: {
            agencyId: true,
          },
        },
      },
    });

    if (!upload) {
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }

    if (upload.request.agencyId !== session.user.agencyId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Delete from ContentFingerprint table
    await db.contentFingerprint.deleteMany({
      where: { uploadId },
    });

    // Remove fingerprint fields from metadata
    const existingMetadata = (upload.metadata || {}) as Record<string, unknown>;
    const {
      fileHash,
      perceptualHash,
      dimensions,
      duration,
      frameHashes,
      fingerprintVersion,
      fingerprintedAt,
      contentHash, // Also remove legacy field
      ...cleanedMetadata
    } = existingMetadata;

    await db.upload.update({
      where: { id: uploadId },
      data: {
        metadata: cleanedMetadata as object,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting fingerprint:", error);
    return NextResponse.json(
      { error: "Failed to delete fingerprint" },
      { status: 500 }
    );
  }
}
