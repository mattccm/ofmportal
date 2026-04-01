import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import type {
  DuplicateAttempt,
  DuplicateMatchTypeEnum,
  DuplicateActionEnum,
  CreatorDuplicatePattern,
} from "@/types/content-fingerprint";

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

/**
 * GET /api/duplicate-attempts/[creatorId]
 *
 * Get duplicate attempts for a specific creator.
 * Includes pattern analysis for detecting repeat offenders.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ creatorId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins, owners, and managers can view this
    if (!["ADMIN", "OWNER", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "You do not have permission to view this data" },
        { status: 403 }
      );
    }

    const { creatorId } = await params;
    const { searchParams } = new URL(req.url);
    const queryParams = querySchema.parse(Object.fromEntries(searchParams));

    const agencyId = session.user.agencyId;

    // Verify creator belongs to this agency
    const creator = await db.creator.findFirst({
      where: {
        id: creatorId,
        agencyId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
      },
    });

    if (!creator) {
      return NextResponse.json(
        { error: "Creator not found" },
        { status: 404 }
      );
    }

    // Get total count
    const total = await db.duplicateAttempt.count({
      where: {
        agencyId,
        creatorId,
      },
    });

    // Get paginated attempts
    const attempts = await db.duplicateAttempt.findMany({
      where: {
        agencyId,
        creatorId,
      },
      orderBy: { attemptedAt: "desc" },
      skip: (queryParams.page - 1) * queryParams.limit,
      take: queryParams.limit,
    });

    // Get stats for pattern analysis
    const [
      blockedCount,
      warnedCount,
      exactMatchCount,
      nearMatchCount,
      firstAttempt,
      lastAttempt,
      recentAttempts,
      olderAttempts,
    ] = await Promise.all([
      db.duplicateAttempt.count({
        where: { agencyId, creatorId, action: "BLOCKED" },
      }),
      db.duplicateAttempt.count({
        where: { agencyId, creatorId, action: "WARNED" },
      }),
      db.duplicateAttempt.count({
        where: { agencyId, creatorId, matchType: "EXACT" },
      }),
      db.duplicateAttempt.count({
        where: { agencyId, creatorId, matchType: "NEAR" },
      }),
      db.duplicateAttempt.findFirst({
        where: { agencyId, creatorId },
        orderBy: { attemptedAt: "asc" },
        select: { attemptedAt: true },
      }),
      db.duplicateAttempt.findFirst({
        where: { agencyId, creatorId },
        orderBy: { attemptedAt: "desc" },
        select: { attemptedAt: true },
      }),
      // Recent 30 days
      db.duplicateAttempt.count({
        where: {
          agencyId,
          creatorId,
          attemptedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      }),
      // 30-60 days ago
      db.duplicateAttempt.count({
        where: {
          agencyId,
          creatorId,
          attemptedAt: {
            gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
            lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    // Calculate severity and trend
    let severity: "low" | "medium" | "high" = "low";
    if (blockedCount >= 10 || exactMatchCount >= 5) {
      severity = "high";
    } else if (blockedCount >= 5 || exactMatchCount >= 2) {
      severity = "medium";
    }

    let trend: "increasing" | "stable" | "decreasing" = "stable";
    if (recentAttempts > olderAttempts * 1.5) {
      trend = "increasing";
    } else if (recentAttempts < olderAttempts * 0.5) {
      trend = "decreasing";
    }

    const pattern: CreatorDuplicatePattern = {
      creatorId: creator.id,
      creatorName: creator.name,
      creatorEmail: creator.email,
      totalAttempts: total,
      blockedAttempts: blockedCount,
      firstAttempt: firstAttempt?.attemptedAt || new Date(),
      lastAttempt: lastAttempt?.attemptedAt || new Date(),
      severity,
      trend,
    };

    const formattedAttempts: DuplicateAttempt[] = attempts.map((attempt) => ({
      id: attempt.id,
      agencyId: attempt.agencyId,
      creatorId: attempt.creatorId,
      requestId: attempt.requestId,
      attemptedFileName: attempt.attemptedFileName,
      attemptedFileSize: Number(attempt.attemptedFileSize),
      attemptedFileType: attempt.attemptedFileType,
      attemptedFileHash: attempt.attemptedFileHash || undefined,
      attemptedPerceptualHash: attempt.attemptedPerceptualHash || undefined,
      originalUploadId: attempt.originalUploadId,
      originalFileName: attempt.originalFileName,
      originalFileSize: Number(attempt.originalFileSize),
      originalUploadedAt: attempt.originalUploadedAt,
      matchType: attempt.matchType as DuplicateMatchTypeEnum,
      similarity: attempt.similarity,
      hashMatch: attempt.hashMatch,
      perceptualMatch: attempt.perceptualMatch,
      metadataMatch: attempt.metadataMatch,
      action: attempt.action as DuplicateActionEnum,
      overrideReason: attempt.overrideReason || undefined,
      overrideBy: attempt.overrideBy || undefined,
      overrideAt: attempt.overrideAt || undefined,
      attemptedAt: attempt.attemptedAt,
    }));

    return NextResponse.json({
      creator,
      attempts: formattedAttempts,
      pagination: {
        page: queryParams.page,
        limit: queryParams.limit,
        total,
        totalPages: Math.ceil(total / queryParams.limit),
        hasMore: queryParams.page < Math.ceil(total / queryParams.limit),
      },
      stats: {
        totalAttempts: total,
        blockedCount,
        warnedCount,
        exactMatchCount,
        nearMatchCount,
      },
      pattern,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error fetching creator duplicate attempts:", error);
    return NextResponse.json(
      { error: "Failed to fetch duplicate attempts" },
      { status: 500 }
    );
  }
}
