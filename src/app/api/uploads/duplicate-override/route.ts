import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import type { DuplicateOverrideReason } from "@/types/content-fingerprint";

// Schema for override request
const overrideSchema = z.object({
  uploadId: z.string().min(1, "Upload ID is required"),
  matchedUploadId: z.string().min(1, "Matched upload ID is required"),
  reason: z.enum([
    "different_angle",
    "different_lighting",
    "different_edit",
    "retake",
    "different_version",
    "intentional_duplicate",
    "false_positive",
    "other",
  ] as const),
  customReason: z.string().optional(),
});

/**
 * POST /api/uploads/duplicate-override
 * Override a duplicate detection decision
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const creatorToken = req.headers.get("x-creator-token");

    if (!session?.user?.agencyId && !creatorToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = overrideSchema.parse(body);

    // Validate custom reason if reason is "other"
    if (validatedData.reason === "other" && !validatedData.customReason?.trim()) {
      return NextResponse.json(
        { error: "Custom reason is required when selecting 'other'" },
        { status: 400 }
      );
    }

    // Get upload and verify access
    const upload = await db.upload.findUnique({
      where: { id: validatedData.uploadId },
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

    // Determine who is making the override
    let overrideBy: string;
    let hasAccess = false;

    if (session?.user?.agencyId) {
      hasAccess = upload.request.agencyId === session.user.agencyId;
      overrideBy = session.user.id;
    } else if (creatorToken) {
      const creator = await db.creator.findFirst({
        where: {
          OR: [{ inviteToken: creatorToken }, { id: creatorToken }],
          inviteStatus: "ACCEPTED",
        },
      });

      if (creator && upload.creatorId === creator.id) {
        hasAccess = true;
        overrideBy = creator.id;
      } else {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    } else {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Update upload metadata with override information
    const existingMetadata = (upload.metadata || {}) as Record<string, unknown>;
    const existingDuplicateCheck = (existingMetadata.duplicateCheck || {}) as Record<
      string,
      unknown
    >;

    await db.upload.update({
      where: { id: validatedData.uploadId },
      data: {
        metadata: {
          ...existingMetadata,
          duplicateCheck: {
            ...existingDuplicateCheck,
            action: "overridden",
            overrideReason: validatedData.reason,
            customReason: validatedData.customReason,
            overrideBy,
            overrideAt: new Date().toISOString(),
            matchedUploadIds: [
              ...(existingDuplicateCheck.matchedUploadIds as string[] || []),
              validatedData.matchedUploadId,
            ].filter((id, index, arr) => arr.indexOf(id) === index), // Dedupe
          },
          duplicateOverride: {
            matchedUploadId: validatedData.matchedUploadId,
            reason: validatedData.reason,
            customReason: validatedData.customReason,
            overrideBy,
            overrideAt: new Date().toISOString(),
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Duplicate override recorded",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error recording duplicate override:", error);
    return NextResponse.json(
      { error: "Failed to record duplicate override" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/uploads/duplicate-override?uploadId=xxx
 * Get override information for an upload
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

    const upload = await db.upload.findUnique({
      where: { id: uploadId },
      select: {
        id: true,
        metadata: true,
        request: {
          select: {
            agencyId: true,
          },
        },
        creatorId: true,
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
          OR: [{ inviteToken: creatorToken }, { id: creatorToken }],
          inviteStatus: "ACCEPTED",
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
    const override = metadata.duplicateOverride as Record<string, unknown> | null;

    if (!override) {
      return NextResponse.json({
        hasOverride: false,
        override: null,
      });
    }

    return NextResponse.json({
      hasOverride: true,
      override: {
        id: `override_${upload.id}`,
        uploadId: upload.id,
        matchedUploadId: override.matchedUploadId,
        reason: override.reason,
        customReason: override.customReason,
        createdBy: override.overrideBy,
        createdAt: override.overrideAt,
      },
    });
  } catch (error) {
    console.error("Error getting duplicate override:", error);
    return NextResponse.json(
      { error: "Failed to get duplicate override" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/uploads/duplicate-override?uploadId=xxx
 * Remove an override (revert to original duplicate status)
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    // Only agency users can delete overrides
    if (!session?.user?.agencyId) {
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

    // Remove override from metadata
    const existingMetadata = (upload.metadata || {}) as Record<string, unknown>;
    const existingDuplicateCheck = (existingMetadata.duplicateCheck || {}) as Record<
      string,
      unknown
    >;

    // Remove override-related fields
    const {
      action: _action,
      overrideReason: _overrideReason,
      customReason: _customReason,
      overrideBy: _overrideBy,
      overrideAt: _overrideAt,
      ...cleanedDuplicateCheck
    } = existingDuplicateCheck;

    const { duplicateOverride: _override, ...cleanedMetadata } = existingMetadata;

    await db.upload.update({
      where: { id: uploadId },
      data: {
        metadata: {
          ...cleanedMetadata,
          duplicateCheck: {
            ...cleanedDuplicateCheck,
            action: "warned", // Revert to warned state
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Override removed",
    });
  } catch (error) {
    console.error("Error deleting duplicate override:", error);
    return NextResponse.json(
      { error: "Failed to delete duplicate override" },
      { status: 500 }
    );
  }
}
