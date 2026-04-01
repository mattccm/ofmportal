import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import type {
  DuplicateHistoryEntry,
  DuplicatePattern,
} from "@/types/content-fingerprint";

/**
 * GET /api/uploads/duplicate-history
 * Retrieve duplicate history for a creator
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const creatorToken = req.headers.get("x-creator-token");

    if (!session?.user?.agencyId && !creatorToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const creatorId = searchParams.get("creatorId");
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const timeFilter = searchParams.get("timeFilter") || "30d";

    let targetCreatorId: string;
    let agencyId: string;

    if (session?.user?.agencyId) {
      agencyId = session.user.agencyId;

      if (creatorId) {
        // Verify creator belongs to agency
        const creator = await db.creator.findFirst({
          where: {
            id: creatorId,
            agencyId,
          },
        });

        if (!creator) {
          return NextResponse.json(
            { error: "Creator not found" },
            { status: 404 }
          );
        }

        targetCreatorId = creatorId;
      } else {
        // Return history for all creators in agency
        targetCreatorId = "";
      }
    } else if (creatorToken) {
      const creator = await db.creator.findFirst({
        where: {
          OR: [{ inviteToken: creatorToken }, { id: creatorToken }],
          inviteStatus: "ACCEPTED",
        },
      });

      if (!creator) {
        return NextResponse.json(
          { error: "Invalid creator token" },
          { status: 401 }
        );
      }

      targetCreatorId = creator.id;
      agencyId = creator.agencyId;
    } else {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Calculate date filter
    let dateFilter: Date | undefined;
    switch (timeFilter) {
      case "7d":
        dateFilter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        dateFilter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        dateFilter = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        dateFilter = undefined;
    }

    // Build query
    const whereClause: {
      request: { agencyId: string };
      creatorId?: string;
      metadata?: { path: string[]; not: null };
      createdAt?: { gte: Date };
    } = {
      request: { agencyId },
    };

    if (targetCreatorId) {
      whereClause.creatorId = targetCreatorId;
    }

    if (dateFilter) {
      whereClause.createdAt = { gte: dateFilter };
    }

    // Get uploads with duplicate check metadata
    const uploads = await db.upload.findMany({
      where: {
        ...whereClause,
        metadata: {
          path: ["duplicateCheck"],
          not: undefined,
        },
      },
      select: {
        id: true,
        creatorId: true,
        createdAt: true,
        metadata: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    // Transform to history entries
    const history: DuplicateHistoryEntry[] = uploads
      .map((upload) => {
        const metadata = upload.metadata as Record<string, unknown>;
        const duplicateCheck = metadata.duplicateCheck as Record<
          string,
          unknown
        > | null;

        if (!duplicateCheck) return null;

        return {
          id: `hist_${upload.id}`,
          creatorId: upload.creatorId,
          uploadId: upload.id,
          attemptedAt: upload.createdAt,
          matchedUploadIds: (duplicateCheck.matchedUploadIds as string[]) || [],
          action: (duplicateCheck.action as
            | "blocked"
            | "warned"
            | "allowed"
            | "overridden") || "allowed",
          overrideReason: duplicateCheck.overrideReason as string | undefined,
          matchConfidence: (duplicateCheck.matchConfidence as number) || 0,
          matchType: (duplicateCheck.matchType as
            | "exact"
            | "near"
            | "similar") || "similar",
        };
      })
      .filter((entry) => entry !== null) as DuplicateHistoryEntry[];

    // Detect patterns
    const patterns = detectPatterns(history, targetCreatorId);

    return NextResponse.json({
      history,
      patterns,
      total: history.length,
    });
  } catch (error) {
    console.error("Error fetching duplicate history:", error);
    return NextResponse.json(
      { error: "Failed to fetch duplicate history" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/uploads/duplicate-history
 * Record a duplicate check result
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const creatorToken = req.headers.get("x-creator-token");

    if (!session?.user?.agencyId && !creatorToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const schema = z.object({
      uploadId: z.string().min(1),
      matchedUploadIds: z.array(z.string()),
      action: z.enum(["blocked", "warned", "allowed", "overridden"]),
      overrideReason: z.string().optional(),
      matchConfidence: z.number(),
      matchType: z.enum(["exact", "near", "similar"]),
    });

    const validatedData = schema.parse(body);

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

    // Update upload metadata with duplicate check info
    const existingMetadata = (upload.metadata || {}) as Record<string, unknown>;

    await db.upload.update({
      where: { id: validatedData.uploadId },
      data: {
        metadata: {
          ...existingMetadata,
          duplicateCheck: {
            matchedUploadIds: validatedData.matchedUploadIds,
            action: validatedData.action,
            overrideReason: validatedData.overrideReason,
            matchConfidence: validatedData.matchConfidence,
            matchType: validatedData.matchType,
            checkedAt: new Date().toISOString(),
          },
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error recording duplicate history:", error);
    return NextResponse.json(
      { error: "Failed to record duplicate history" },
      { status: 500 }
    );
  }
}

/**
 * Detect patterns in duplicate history
 */
function detectPatterns(
  history: DuplicateHistoryEntry[],
  creatorId: string
): DuplicatePattern[] {
  const patterns: DuplicatePattern[] = [];

  if (history.length < 3) {
    return patterns;
  }

  // Check for repeated exact duplicates
  const exactDuplicates = history.filter(
    (e) => e.matchType === "exact" && (e.action === "blocked" || e.action === "warned")
  );

  if (exactDuplicates.length >= 3) {
    patterns.push({
      creatorId,
      patternType: "repeated_exact",
      occurrenceCount: exactDuplicates.length,
      firstOccurrence: exactDuplicates[exactDuplicates.length - 1].attemptedAt,
      lastOccurrence: exactDuplicates[0].attemptedAt,
      affectedUploadIds: exactDuplicates.map((e) => e.uploadId),
      severity: exactDuplicates.length >= 5 ? "high" : "medium",
    });
  }

  // Check for repeated near duplicates
  const nearDuplicates = history.filter(
    (e) => e.matchType === "near" && (e.action === "blocked" || e.action === "warned")
  );

  if (nearDuplicates.length >= 5) {
    patterns.push({
      creatorId,
      patternType: "repeated_near",
      occurrenceCount: nearDuplicates.length,
      firstOccurrence: nearDuplicates[nearDuplicates.length - 1].attemptedAt,
      lastOccurrence: nearDuplicates[0].attemptedAt,
      affectedUploadIds: nearDuplicates.map((e) => e.uploadId),
      severity: nearDuplicates.length >= 10 ? "high" : "low",
    });
  }

  // Check for bulk duplicates (many in short time)
  const recentHistory = history.filter(
    (e) =>
      new Date(e.attemptedAt).getTime() > Date.now() - 24 * 60 * 60 * 1000 &&
      (e.action === "blocked" || e.action === "warned")
  );

  if (recentHistory.length >= 10) {
    patterns.push({
      creatorId,
      patternType: "bulk_duplicates",
      occurrenceCount: recentHistory.length,
      firstOccurrence: recentHistory[recentHistory.length - 1].attemptedAt,
      lastOccurrence: recentHistory[0].attemptedAt,
      affectedUploadIds: recentHistory.map((e) => e.uploadId),
      severity: "high",
    });
  }

  return patterns;
}
