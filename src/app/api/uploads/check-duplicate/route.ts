import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import type {
  DuplicateCheckResult,
  DuplicateMatch,
  DuplicateBlockedResponse,
} from "@/types/content-fingerprint";
import {
  calculatePerceptualSimilarity,
  calculateStringSimilarity,
  normalizeFileName,
} from "@/lib/content-fingerprinting";

// IMPROVEMENT #8: Email notification for duplicate attempts
async function sendDuplicateNotificationEmail(
  adminEmail: string,
  agencyId: string,
  creatorId: string,
  attemptedFileName: string,
  originalFileName: string,
  similarity: number,
  originalUploadedAt?: Date,
  originalRequestName?: string
): Promise<void> {
  // TODO: Implement actual email sending using your email service
  // For now, just log the notification
  console.log("[DUPLICATE NOTIFICATION]", {
    to: adminEmail,
    agencyId,
    creatorId,
    attemptedFileName,
    originalFileName,
    similarity,
    originalUploadedAt,
    originalRequestName,
    message: `Duplicate upload attempt blocked. Creator tried to upload "${attemptedFileName}" which matches "${originalFileName}" (${similarity}% similar) from ${originalRequestName || "unknown request"}.`,
  });
}

// Schema for fingerprint-based duplicate checking
const checkDuplicateSchema = z.object({
  requestId: z.string().min(1, "Request ID is required"),
  fileName: z.string().min(1, "File name is required"),
  fileSize: z.number().min(1, "File size is required"),
  mimeType: z.string().min(1, "MIME type is required"),
  fileHash: z.string().min(1, "File hash is required"),
  perceptualHash: z.string().optional(),
  dimensions: z.object({
    width: z.number(),
    height: z.number(),
  }).optional(),
  duration: z.number().optional(),
  frameHashes: z.array(z.string()).optional(),
});

/**
 * POST /api/uploads/check-duplicate
 *
 * Check if a file is a duplicate before allowing upload.
 * This is a STRICT system - duplicates are BLOCKED, not just warned.
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const session = await getServerSession(authOptions);
    const creatorToken = req.headers.get("x-creator-token");

    let agencyId: string;
    let creatorId: string;

    const body = await req.json();
    const validatedData = checkDuplicateSchema.parse(body);

    // Authenticate and get context
    if (session?.user?.agencyId) {
      // Agency user
      agencyId = session.user.agencyId;

      const contentRequest = await db.contentRequest.findFirst({
        where: {
          id: validatedData.requestId,
          agencyId,
        },
      });

      if (!contentRequest) {
        return NextResponse.json(
          { error: "Request not found" },
          { status: 404 }
        );
      }

      creatorId = contentRequest.creatorId;
    } else if (creatorToken) {
      // Creator via portal
      const creator = await db.creator.findFirst({
        where: {
          sessionToken: creatorToken,
          inviteStatus: "ACCEPTED",
          sessionExpiry: { gt: new Date() },
        },
      });

      if (!creator) {
        return NextResponse.json(
          { error: "Invalid or expired session" },
          { status: 401 }
        );
      }

      // Verify request belongs to this creator
      const contentRequest = await db.contentRequest.findFirst({
        where: {
          id: validatedData.requestId,
          creatorId: creator.id,
        },
      });

      if (!contentRequest) {
        return NextResponse.json(
          { error: "Request not found" },
          { status: 404 }
        );
      }

      agencyId = creator.agencyId;
      creatorId = creator.id;
    } else {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get duplicate detection settings for this agency
    let settings = await db.duplicateDetectionSettings.findUnique({
      where: { agencyId },
    });

    // Create default settings if not exists
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

    // If duplicate detection is disabled, allow all uploads
    if (!settings.enabled) {
      return NextResponse.json({
        isDuplicate: false,
        matches: [],
        recommendation: "allow",
        checkDuration: Date.now() - startTime,
        methodsUsed: [],
      } as DuplicateCheckResult);
    }

    // Build query based on check scope
    const scopeConditions: Record<string, unknown> = {};

    switch (settings.checkScope) {
      case "REQUEST":
        scopeConditions.upload = { requestId: validatedData.requestId };
        break;
      case "CREATOR":
        scopeConditions.creatorId = creatorId;
        break;
      case "AGENCY":
        scopeConditions.agencyId = agencyId;
        break;
    }

    // IMPROVEMENT #5: Check if content is whitelisted first
    const whitelistedContent = await db.whitelistedContent.findFirst({
      where: {
        agencyId,
        fileHash: validatedData.fileHash,
      },
    });

    if (whitelistedContent) {
      // Content is whitelisted, allow upload
      return NextResponse.json({
        isDuplicate: false,
        matches: [],
        recommendation: "allow",
        checkDuration: Date.now() - startTime,
        methodsUsed: ["hash"],
        whitelisted: true,
        whitelistInfo: {
          name: whitelistedContent.name,
          category: whitelistedContent.category,
        },
      } as DuplicateCheckResult & { whitelisted: boolean; whitelistInfo: { name: string; category: string } });
    }

    // Fetch existing fingerprints
    const existingFingerprints = await db.contentFingerprint.findMany({
      where: {
        agencyId,
        ...scopeConditions,
      },
      include: {
        upload: {
          select: {
            id: true,
            originalName: true,
            uploadedAt: true,
            requestId: true,
            thumbnailUrl: true,
            request: {
              select: {
                id: true,
                title: true, // IMPROVEMENT #1: Get request name for better error messages
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 500, // Limit for performance
    });

    const matches: DuplicateMatch[] = [];
    const methodsUsed: Set<"hash" | "perceptual" | "metadata"> = new Set();

    for (const existing of existingFingerprints) {
      // Skip different file type categories
      const existingCategory = existing.mimeType.split("/")[0];
      const newCategory = validatedData.mimeType.split("/")[0];
      if (existingCategory !== newCategory) continue;

      let hashMatch = false;
      let perceptualMatch = false;
      let metadataMatch = false;
      let confidence = 0;
      let matchType: "exact" | "near" | "similar" = "similar";

      // Hash comparison (fastest, most accurate)
      if (settings.enableHashCheck) {
        methodsUsed.add("hash");
        if (validatedData.fileHash === existing.fileHash) {
          hashMatch = true;
          confidence = 100;
          matchType = "exact";
        }
      }

      // Perceptual hash comparison for images
      if (
        settings.enablePerceptualHash &&
        validatedData.perceptualHash &&
        existing.perceptualHash
      ) {
        methodsUsed.add("perceptual");
        const similarity = calculatePerceptualSimilarity(
          validatedData.perceptualHash,
          existing.perceptualHash
        );

        if (similarity >= settings.perceptualThreshold) {
          perceptualMatch = true;
          if (!hashMatch) {
            confidence = Math.max(confidence, similarity);
            matchType = similarity >= 95 ? "near" : "similar";
          }
        }
      }

      // Video frame hash comparison
      if (
        settings.enableVideoFrameHash &&
        validatedData.frameHashes?.length &&
        (existing.frameHashes as string[])?.length
      ) {
        methodsUsed.add("perceptual");
        const existingFrameHashes = existing.frameHashes as string[];
        const minFrames = Math.min(
          validatedData.frameHashes.length,
          existingFrameHashes.length
        );
        let matchingFrames = 0;

        for (let i = 0; i < minFrames; i++) {
          const frameSimilarity = calculatePerceptualSimilarity(
            validatedData.frameHashes[i],
            existingFrameHashes[i]
          );
          if (frameSimilarity >= 85) {
            matchingFrames++;
          }
        }

        const frameMatchRate = (matchingFrames / minFrames) * 100;
        if (frameMatchRate >= 60) {
          perceptualMatch = true;
          if (!hashMatch) {
            confidence = Math.max(confidence, frameMatchRate);
            matchType = frameMatchRate >= 80 ? "near" : "similar";
          }
        }
      }

      // Metadata comparison
      if (settings.enableMetadataCheck) {
        methodsUsed.add("metadata");

        const fileNameSimilarity = calculateStringSimilarity(
          normalizeFileName(validatedData.fileName),
          normalizeFileName(existing.fileName)
        );

        const sizeDiff = Math.abs(validatedData.fileSize - Number(existing.fileSize));
        const maxSize = Math.max(validatedData.fileSize, Number(existing.fileSize));
        const sizeDiffPercent = (sizeDiff / maxSize) * 100;
        const sizeMatch = sizeDiffPercent <= 5;

        if (fileNameSimilarity >= 0.8 && sizeMatch) {
          metadataMatch = true;
          if (!hashMatch && !perceptualMatch) {
            confidence = Math.max(confidence, fileNameSimilarity * 70);
          }
        }
      }

      // Add to matches if any check passed
      if (hashMatch || perceptualMatch || (metadataMatch && confidence >= 50)) {
        matches.push({
          originalUploadId: existing.uploadId,
          originalRequestId: existing.upload?.requestId || "",
          originalRequestName: existing.upload?.request?.title || undefined, // IMPROVEMENT #1: Include request name
          matchType,
          confidence: Math.round(confidence),
          matchedAt: new Date(),
          hashMatch,
          perceptualMatch,
          metadataMatch,
          originalFileName: existing.upload?.originalName || existing.fileName,
          originalFileSize: Number(existing.fileSize),
          originalUploadedAt: existing.upload?.uploadedAt || existing.createdAt,
          originalThumbnailUrl: existing.upload?.thumbnailUrl || undefined,
        });
      }
    }

    // Sort by confidence
    matches.sort((a, b) => b.confidence - a.confidence);

    // Determine recommendation based on settings (STRICT by default)
    let recommendation: "block" | "warn" | "allow" = "allow";
    let blocked = false;

    if (matches.length > 0) {
      const topMatch = matches[0];

      if (topMatch.matchType === "exact" && settings.blockExactDuplicates) {
        recommendation = "block";
        blocked = true;
      } else if (topMatch.matchType === "near" && settings.blockNearDuplicates) {
        recommendation = "block";
        blocked = true;
      } else if (topMatch.confidence >= settings.similarityThreshold) {
        recommendation = settings.warnSimilarContent ? "warn" : "allow";
      }
    }

    // If blocked, log the duplicate attempt
    if (blocked && matches.length > 0) {
      const topMatch = matches[0];

      await db.duplicateAttempt.create({
        data: {
          agencyId,
          creatorId,
          requestId: validatedData.requestId,
          attemptedFileName: validatedData.fileName,
          attemptedFileSize: BigInt(validatedData.fileSize),
          attemptedFileType: validatedData.mimeType,
          attemptedFileHash: validatedData.fileHash,
          attemptedPerceptualHash: validatedData.perceptualHash,
          originalUploadId: topMatch.originalUploadId,
          originalFileName: topMatch.originalFileName || "",
          originalFileSize: BigInt(topMatch.originalFileSize || 0),
          originalUploadedAt: topMatch.originalUploadedAt || new Date(),
          originalRequestId: topMatch.originalRequestId || null, // IMPROVEMENT #1
          originalRequestName: topMatch.originalRequestName || null, // IMPROVEMENT #1
          originalThumbnailUrl: topMatch.originalThumbnailUrl || null, // IMPROVEMENT #3
          matchType: topMatch.matchType === "exact" ? "EXACT" : topMatch.matchType === "near" ? "NEAR" : "SIMILAR",
          similarity: topMatch.confidence,
          hashMatch: topMatch.hashMatch,
          perceptualMatch: topMatch.perceptualMatch,
          metadataMatch: topMatch.metadataMatch,
          action: "BLOCKED",
        },
      });

      // IMPROVEMENT #8: Send email notification if enabled
      if (settings.notifyAdminOnDuplicate && settings.adminNotificationEmail) {
        // Fire and forget - don't block the response
        sendDuplicateNotificationEmail(
          settings.adminNotificationEmail,
          agencyId,
          creatorId,
          validatedData.fileName,
          topMatch.originalFileName || "",
          topMatch.confidence,
          topMatch.originalUploadedAt,
          topMatch.originalRequestName
        ).catch(console.error);
      }

      // IMPROVEMENT #1: Better error message with request name and exact date
      const originalDate = topMatch.originalUploadedAt
        ? new Date(topMatch.originalUploadedAt).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : "a previous date";

      const requestInfo = topMatch.originalRequestName
        ? ` for the request "${topMatch.originalRequestName}"`
        : "";

      // Return a clear blocked response for the creator portal
      const blockedResponse: DuplicateBlockedResponse = {
        blocked: true,
        reason: `This content was already submitted on ${originalDate}${requestInfo}. The file "${topMatch.originalFileName || "unknown"}" is ${topMatch.confidence}% similar.`,
        originalUploadDate: topMatch.originalUploadedAt || new Date(),
        originalFileName: topMatch.originalFileName || "",
        similarity: topMatch.confidence,
        matchType: topMatch.matchType === "exact" ? "EXACT" : topMatch.matchType === "near" ? "NEAR" : "SIMILAR",
      };

      return NextResponse.json({
        ...blockedResponse,
        isDuplicate: true,
        matches: matches.slice(0, 5),
        recommendation: "block",
        checkDuration: Date.now() - startTime,
        methodsUsed: Array.from(methodsUsed),
        // IMPROVEMENT #1: Include additional context for creators
        originalRequestName: topMatch.originalRequestName,
        originalRequestId: topMatch.originalRequestId,
      });
    }

    const result: DuplicateCheckResult = {
      isDuplicate: matches.length > 0,
      matches: matches.slice(0, 5),
      recommendation,
      checkDuration: Date.now() - startTime,
      methodsUsed: Array.from(methodsUsed),
    };

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error checking for duplicates:", error);
    return NextResponse.json(
      { error: "Failed to check for duplicates" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/uploads/check-duplicate
 *
 * Quick hash-based lookup for existing duplicates
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const creatorToken = req.headers.get("x-creator-token");

    if (!session?.user?.agencyId && !creatorToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const hash = searchParams.get("hash");

    if (!hash) {
      return NextResponse.json(
        { error: "Hash parameter required" },
        { status: 400 }
      );
    }

    let agencyId: string;
    let creatorId: string | undefined;

    if (session?.user?.agencyId) {
      agencyId = session.user.agencyId;
    } else if (creatorToken) {
      const creator = await db.creator.findFirst({
        where: {
          sessionToken: creatorToken,
          inviteStatus: "ACCEPTED",
          sessionExpiry: { gt: new Date() },
        },
      });

      if (!creator) {
        return NextResponse.json(
          { error: "Invalid or expired session" },
          { status: 401 }
        );
      }

      agencyId = creator.agencyId;
      creatorId = creator.id;
    } else {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Look for fingerprint with matching hash
    const existingFingerprint = await db.contentFingerprint.findFirst({
      where: {
        agencyId,
        ...(creatorId && { creatorId }),
        fileHash: hash,
      },
      include: {
        upload: {
          select: {
            id: true,
            originalName: true,
            fileSize: true,
            fileType: true,
            uploadedAt: true,
            requestId: true,
          },
        },
      },
    });

    if (existingFingerprint) {
      return NextResponse.json({
        isDuplicate: true,
        blocked: true,
        match: {
          type: "EXACT",
          confidence: 100,
          originalUploadId: existingFingerprint.uploadId,
          originalFileName: existingFingerprint.upload?.originalName || existingFingerprint.fileName,
          originalFileSize: existingFingerprint.upload?.fileSize.toString() || existingFingerprint.fileSize.toString(),
          originalRequestId: existingFingerprint.upload?.requestId || "",
          originalUploadedAt: existingFingerprint.upload?.uploadedAt || existingFingerprint.createdAt,
          reason: `This content was already submitted on ${existingFingerprint.upload?.uploadedAt?.toLocaleDateString() || "a previous date"}`,
        },
      });
    }

    return NextResponse.json({
      isDuplicate: false,
      blocked: false,
      match: null,
    });
  } catch (error) {
    console.error("Error checking hash:", error);
    return NextResponse.json(
      { error: "Failed to check hash" },
      { status: 500 }
    );
  }
}
