import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import type { DuplicateDetectionSettings } from "@/types/content-fingerprint";

const updateSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  similarityThreshold: z.number().min(50).max(100).optional(),
  perceptualThreshold: z.number().min(50).max(100).optional(),
  enableHashCheck: z.boolean().optional(),
  enablePerceptualHash: z.boolean().optional(),
  enableMetadataCheck: z.boolean().optional(),
  enableVideoFrameHash: z.boolean().optional(),
  blockExactDuplicates: z.boolean().optional(),
  blockNearDuplicates: z.boolean().optional(),
  warnSimilarContent: z.boolean().optional(),
  checkScope: z.enum(["CREATOR", "AGENCY", "REQUEST"]).optional(),
  videoSampleFrames: z.number().min(1).max(20).optional(),
});

/**
 * GET /api/duplicate-attempts/settings
 *
 * Get duplicate detection settings for the agency.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["ADMIN", "OWNER"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "You do not have permission to view settings" },
        { status: 403 }
      );
    }

    const agencyId = session.user.agencyId;

    // Get or create default settings
    let settings = await db.duplicateDetectionSettings.findUnique({
      where: { agencyId },
    });

    if (!settings) {
      settings = await db.duplicateDetectionSettings.create({
        data: {
          agencyId,
          enabled: true,
          similarityThreshold: 90,
          perceptualThreshold: 90,
          enableHashCheck: true,
          enablePerceptualHash: true,
          enableMetadataCheck: true,
          enableVideoFrameHash: true,
          blockExactDuplicates: true,
          blockNearDuplicates: true,
          warnSimilarContent: true,
          checkScope: "CREATOR",
          videoSampleFrames: 5,
        },
      });
    }

    const response: DuplicateDetectionSettings = {
      id: settings.id,
      agencyId: settings.agencyId,
      enabled: settings.enabled,
      similarityThreshold: settings.similarityThreshold,
      perceptualThreshold: settings.perceptualThreshold,
      enableHashCheck: settings.enableHashCheck,
      enablePerceptualHash: settings.enablePerceptualHash,
      enableMetadataCheck: settings.enableMetadataCheck,
      enableVideoFrameHash: settings.enableVideoFrameHash,
      blockExactDuplicates: settings.blockExactDuplicates,
      blockNearDuplicates: settings.blockNearDuplicates,
      warnSimilarContent: settings.warnSimilarContent,
      checkScope: settings.checkScope as DuplicateDetectionSettings["checkScope"],
      videoSampleFrames: settings.videoSampleFrames,
      notifyAdminOnDuplicate: (settings as Record<string, unknown>).notifyAdminOnDuplicate as boolean ?? false,
      adminNotificationEmail: (settings as Record<string, unknown>).adminNotificationEmail as string | undefined,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/duplicate-attempts/settings
 *
 * Update duplicate detection settings for the agency.
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["ADMIN", "OWNER"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "You do not have permission to update settings" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const updates = updateSettingsSchema.parse(body);

    const agencyId = session.user.agencyId;

    // Upsert settings
    const settings = await db.duplicateDetectionSettings.upsert({
      where: { agencyId },
      create: {
        agencyId,
        enabled: updates.enabled ?? true,
        similarityThreshold: updates.similarityThreshold ?? 90,
        perceptualThreshold: updates.perceptualThreshold ?? 90,
        enableHashCheck: updates.enableHashCheck ?? true,
        enablePerceptualHash: updates.enablePerceptualHash ?? true,
        enableMetadataCheck: updates.enableMetadataCheck ?? true,
        enableVideoFrameHash: updates.enableVideoFrameHash ?? true,
        blockExactDuplicates: updates.blockExactDuplicates ?? true,
        blockNearDuplicates: updates.blockNearDuplicates ?? true,
        warnSimilarContent: updates.warnSimilarContent ?? true,
        checkScope: updates.checkScope ?? "CREATOR",
        videoSampleFrames: updates.videoSampleFrames ?? 5,
      },
      update: updates,
    });

    const response: DuplicateDetectionSettings = {
      id: settings.id,
      agencyId: settings.agencyId,
      enabled: settings.enabled,
      similarityThreshold: settings.similarityThreshold,
      perceptualThreshold: settings.perceptualThreshold,
      enableHashCheck: settings.enableHashCheck,
      enablePerceptualHash: settings.enablePerceptualHash,
      enableMetadataCheck: settings.enableMetadataCheck,
      enableVideoFrameHash: settings.enableVideoFrameHash,
      blockExactDuplicates: settings.blockExactDuplicates,
      blockNearDuplicates: settings.blockNearDuplicates,
      warnSimilarContent: settings.warnSimilarContent,
      checkScope: settings.checkScope as DuplicateDetectionSettings["checkScope"],
      videoSampleFrames: settings.videoSampleFrames,
      notifyAdminOnDuplicate: (settings as Record<string, unknown>).notifyAdminOnDuplicate as boolean ?? false,
      adminNotificationEmail: (settings as Record<string, unknown>).adminNotificationEmail as string | undefined,
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error updating settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
