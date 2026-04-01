import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import type {
  DuplicateAttemptListResponse,
  DuplicateMatchTypeEnum,
  DuplicateActionEnum,
} from "@/types/content-fingerprint";

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  sortBy: z.enum(["attemptedAt", "similarity", "matchType"]).default("attemptedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  creatorId: z.string().optional(),
  matchType: z.enum(["EXACT", "NEAR", "SIMILAR"]).optional(),
  action: z.enum(["BLOCKED", "WARNED", "ALLOWED", "OVERRIDDEN"]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
});

/**
 * GET /api/duplicate-attempts
 *
 * List all duplicate attempts for the agency.
 * Admin/Owner only.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins and owners can view duplicate attempts
    if (!["ADMIN", "OWNER"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "You do not have permission to view duplicate attempts" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const params = querySchema.parse(Object.fromEntries(searchParams));

    const agencyId = session.user.agencyId;

    // Build where clause
    const whereClause: Record<string, unknown> = {
      agencyId,
    };

    if (params.creatorId) {
      whereClause.creatorId = params.creatorId;
    }

    if (params.matchType) {
      whereClause.matchType = params.matchType;
    }

    if (params.action) {
      whereClause.action = params.action;
    }

    if (params.startDate || params.endDate) {
      whereClause.attemptedAt = {};
      if (params.startDate) {
        (whereClause.attemptedAt as Record<string, Date>).gte = new Date(params.startDate);
      }
      if (params.endDate) {
        const endDate = new Date(params.endDate);
        endDate.setHours(23, 59, 59, 999);
        (whereClause.attemptedAt as Record<string, Date>).lte = endDate;
      }
    }

    if (params.search) {
      whereClause.OR = [
        { attemptedFileName: { contains: params.search, mode: "insensitive" } },
        { originalFileName: { contains: params.search, mode: "insensitive" } },
        { creator: { name: { contains: params.search, mode: "insensitive" } } },
        { creator: { email: { contains: params.search, mode: "insensitive" } } },
      ];
    }

    // Get total count
    const total = await db.duplicateAttempt.count({ where: whereClause });

    // Get paginated results
    const attempts = await db.duplicateAttempt.findMany({
      where: whereClause,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
      orderBy: {
        [params.sortBy]: params.sortOrder,
      },
      skip: (params.page - 1) * params.limit,
      take: params.limit,
    });

    // Get stats
    const [
      blockedCount,
      warnedCount,
      uniqueCreatorCount,
      repeatOffenders,
    ] = await Promise.all([
      db.duplicateAttempt.count({
        where: { agencyId, action: "BLOCKED" },
      }),
      db.duplicateAttempt.count({
        where: { agencyId, action: "WARNED" },
      }),
      db.duplicateAttempt.groupBy({
        by: ["creatorId"],
        where: { agencyId },
      }).then((results) => results.length),
      db.duplicateAttempt.groupBy({
        by: ["creatorId"],
        where: { agencyId },
        _count: { creatorId: true },
        orderBy: { _count: { creatorId: "desc" } },
        having: { creatorId: { _count: { gt: 2 } } },
        take: 10,
      }),
    ]);

    // Get filter options
    const [creators, matchTypes, actions] = await Promise.all([
      db.creator.findMany({
        where: {
          agencyId,
          duplicateAttempts: { some: {} },
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
        orderBy: { name: "asc" },
      }),
      db.duplicateAttempt.groupBy({
        by: ["matchType"],
        where: { agencyId },
      }).then((results) => results.map((r) => r.matchType as DuplicateMatchTypeEnum)),
      db.duplicateAttempt.groupBy({
        by: ["action"],
        where: { agencyId },
      }).then((results) => results.map((r) => r.action as DuplicateActionEnum)),
    ]);

    const response: DuplicateAttemptListResponse = {
      attempts: attempts.map((attempt) => ({
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
        creator: attempt.creator ? {
          id: attempt.creator.id,
          name: attempt.creator.name,
          email: attempt.creator.email,
          avatar: attempt.creator.avatar || undefined,
        } : undefined,
      })),
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit),
        hasMore: params.page < Math.ceil(total / params.limit),
      },
      stats: {
        totalAttempts: total,
        blockedCount,
        warnedCount,
        uniqueCreators: uniqueCreatorCount,
        repeatOffenders: repeatOffenders.map((r) => ({
          creatorId: r.creatorId,
          count: r._count.creatorId,
        })),
      },
      filters: {
        creators,
        matchTypes,
        actions,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error fetching duplicate attempts:", error);
    return NextResponse.json(
      { error: "Failed to fetch duplicate attempts" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/duplicate-attempts
 *
 * Override a duplicate attempt (allow it to proceed)
 * Admin/Owner only.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["ADMIN", "OWNER"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "You do not have permission to override duplicates" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { attemptId, reason } = z.object({
      attemptId: z.string().min(1),
      reason: z.string().min(1, "Override reason is required"),
    }).parse(body);

    const agencyId = session.user.agencyId;

    // Find and update the attempt
    const attempt = await db.duplicateAttempt.findFirst({
      where: {
        id: attemptId,
        agencyId,
      },
    });

    if (!attempt) {
      return NextResponse.json(
        { error: "Duplicate attempt not found" },
        { status: 404 }
      );
    }

    const updated = await db.duplicateAttempt.update({
      where: { id: attemptId },
      data: {
        action: "OVERRIDDEN",
        overrideReason: reason,
        overrideBy: session.user.id,
        overrideAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      attempt: updated,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error overriding duplicate:", error);
    return NextResponse.json(
      { error: "Failed to override duplicate" },
      { status: 500 }
    );
  }
}
