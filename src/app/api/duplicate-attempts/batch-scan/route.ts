import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import type {
  BatchScanResult,
  DuplicatePair,
  DuplicateMatchTypeEnum,
} from "@/types/content-fingerprint";

// Schema for batch scan request
const batchScanRequestSchema = z.object({
  // Optional: filter by date range
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  // Optional: filter by creator
  creatorId: z.string().optional(),
  // Optional: filter by request
  requestId: z.string().optional(),
  // Similarity threshold (default 80%)
  similarityThreshold: z.coerce.number().min(50).max(100).default(80),
  // Max files to scan
  maxFiles: z.coerce.number().min(1).max(10000).default(1000),
});

/**
 * POST /api/duplicate-attempts/batch-scan
 *
 * Initiates a batch scan of existing uploads to find duplicates.
 * This is an async operation that creates a scan job.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins and owners can run batch scans
    if (!["ADMIN", "OWNER"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "You do not have permission to run batch scans" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const params = batchScanRequestSchema.parse(body);
    const agencyId = session.user.agencyId;

    // Build query for uploads to scan - filter for uploads that have fingerprints
    const whereClause: Record<string, unknown> = {
      request: {
        agencyId,
      },
      // Only scan files that have fingerprints
      fingerprint: {
        isNot: null,
      },
    };

    if (params.startDate) {
      whereClause.createdAt = {
        ...(whereClause.createdAt as Record<string, Date> || {}),
        gte: new Date(params.startDate),
      };
    }

    if (params.endDate) {
      const endDate = new Date(params.endDate);
      endDate.setHours(23, 59, 59, 999);
      whereClause.createdAt = {
        ...(whereClause.createdAt as Record<string, Date> || {}),
        lte: endDate,
      };
    }

    if (params.creatorId) {
      whereClause.creatorId = params.creatorId;
    }

    if (params.requestId) {
      whereClause.requestId = params.requestId;
    }

    // Count total files to scan
    const totalFiles = await db.upload.count({ where: whereClause });

    if (totalFiles === 0) {
      return NextResponse.json({
        error: "No files found matching the criteria",
      }, { status: 400 });
    }

    // For now, we'll do a synchronous scan for smaller datasets
    // In production, this should be a background job
    const uploads = await db.upload.findMany({
      where: whereClause,
      select: {
        id: true,
        fileName: true,
        originalName: true,
        fileSize: true,
        fileType: true,
        creatorId: true,
        requestId: true,
        createdAt: true,
        storageKey: true,
        fingerprint: {
          select: {
            fileHash: true,
            perceptualHash: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
      take: params.maxFiles,
    });

    // Find duplicates by comparing content hashes
    const duplicatePairs: DuplicatePair[] = [];
    const hashMap = new Map<string, typeof uploads[0][]>();
    const perceptualHashMap = new Map<string, typeof uploads[0][]>();

    // Group by content hash (from fingerprint relation)
    for (const upload of uploads) {
      const contentHash = upload.fingerprint?.fileHash;
      const perceptualHash = upload.fingerprint?.perceptualHash;

      if (contentHash) {
        const existing = hashMap.get(contentHash) || [];
        existing.push(upload);
        hashMap.set(contentHash, existing);
      }

      if (perceptualHash) {
        const existing = perceptualHashMap.get(perceptualHash) || [];
        existing.push(upload);
        perceptualHashMap.set(perceptualHash, existing);
      }
    }

    // Find exact duplicates (same content hash)
    for (const [, group] of hashMap) {
      if (group.length > 1) {
        // Create pairs for all duplicates
        for (let i = 0; i < group.length - 1; i++) {
          for (let j = i + 1; j < group.length; j++) {
            duplicatePairs.push({
              file1Id: group[i].id,
              file1Name: group[i].originalName,
              file1Url: `/api/uploads/${group[i].id}/preview`,
              file2Id: group[j].id,
              file2Name: group[j].originalName,
              file2Url: `/api/uploads/${group[j].id}/preview`,
              similarity: 100,
              matchType: "EXACT" as DuplicateMatchTypeEnum,
            });
          }
        }
      }
    }

    // Find near duplicates (same perceptual hash but different content hash)
    for (const [, group] of perceptualHashMap) {
      if (group.length > 1) {
        // Filter out exact duplicates (already handled)
        const uniqueContentHashes = new Set(group.map(u => u.fingerprint?.fileHash).filter(Boolean));

        if (uniqueContentHashes.size > 1) {
          // These have the same perceptual hash but different content
          for (let i = 0; i < group.length - 1; i++) {
            for (let j = i + 1; j < group.length; j++) {
              // Skip if they have the same content hash (already added as exact)
              if (group[i].fingerprint?.fileHash === group[j].fingerprint?.fileHash) continue;

              // Check if this pair already exists
              const existingPair = duplicatePairs.find(
                p => (p.file1Id === group[i].id && p.file2Id === group[j].id) ||
                     (p.file1Id === group[j].id && p.file2Id === group[i].id)
              );

              if (!existingPair) {
                duplicatePairs.push({
                  file1Id: group[i].id,
                  file1Name: group[i].originalName,
                  file1Url: `/api/uploads/${group[i].id}/preview`,
                  file2Id: group[j].id,
                  file2Name: group[j].originalName,
                  file2Url: `/api/uploads/${group[j].id}/preview`,
                  similarity: 95, // Perceptual match
                  matchType: "NEAR" as DuplicateMatchTypeEnum,
                });
              }
            }
          }
        }
      }
    }

    // Find similar files by metadata (same size + similar name)
    const sizeMap = new Map<string, typeof uploads[0][]>();
    for (const upload of uploads) {
      // Round to nearest KB for grouping
      const sizeKey = Math.round(Number(upload.fileSize) / 1024).toString();
      const existing = sizeMap.get(sizeKey) || [];
      existing.push(upload);
      sizeMap.set(sizeKey, existing);
    }

    for (const [, group] of sizeMap) {
      if (group.length > 1) {
        for (let i = 0; i < group.length - 1; i++) {
          for (let j = i + 1; j < group.length; j++) {
            // Skip if already added
            const existingPair = duplicatePairs.find(
              p => (p.file1Id === group[i].id && p.file2Id === group[j].id) ||
                   (p.file1Id === group[j].id && p.file2Id === group[i].id)
            );

            if (existingPair) continue;

            // Check filename similarity
            const name1 = normalizeFilename(group[i].originalName);
            const name2 = normalizeFilename(group[j].originalName);
            const similarity = calculateStringSimilarity(name1, name2);

            if (similarity >= params.similarityThreshold / 100) {
              duplicatePairs.push({
                file1Id: group[i].id,
                file1Name: group[i].originalName,
                file1Url: `/api/uploads/${group[i].id}/preview`,
                file2Id: group[j].id,
                file2Name: group[j].originalName,
                file2Url: `/api/uploads/${group[j].id}/preview`,
                similarity: Math.round(similarity * 100),
                matchType: "SIMILAR" as DuplicateMatchTypeEnum,
              });
            }
          }
        }
      }
    }

    // Sort by similarity (highest first)
    duplicatePairs.sort((a, b) => b.similarity - a.similarity);

    // Create scan result
    const scanResult: BatchScanResult = {
      id: `scan_${Date.now()}`,
      agencyId,
      status: "completed",
      totalFiles: uploads.length,
      scannedFiles: uploads.length,
      duplicatesFound: duplicatePairs.length,
      duplicatePairs: duplicatePairs.slice(0, 100), // Limit to 100 pairs in response
      startedAt: new Date(),
      completedAt: new Date(),
    };

    // Optionally store the scan result for later retrieval
    // await db.batchScanResult.create({ data: scanResult });

    return NextResponse.json(scanResult);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error running batch scan:", error);
    return NextResponse.json(
      { error: "Failed to run batch scan" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/duplicate-attempts/batch-scan
 *
 * Get the status of a batch scan or list recent scans.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["ADMIN", "OWNER"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "You do not have permission to view batch scans" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const scanId = searchParams.get("scanId");

    if (scanId) {
      // Get specific scan result
      // In a real implementation, this would retrieve from database
      return NextResponse.json({
        error: "Scan result not found",
      }, { status: 404 });
    }

    // Return quick stats about potential duplicates
    const agencyId = session.user.agencyId;

    // Get counts
    const [totalUploads, uploadsWithHash, existingDuplicates] = await Promise.all([
      db.upload.count({
        where: { request: { agencyId } },
      }),
      db.upload.count({
        where: {
          request: { agencyId },
          fingerprint: { isNot: null },
        },
      }),
      db.duplicateAttempt.count({
        where: { agencyId },
      }),
    ]);

    return NextResponse.json({
      stats: {
        totalUploads,
        uploadsWithHash,
        coveragePercent: totalUploads > 0 ? Math.round((uploadsWithHash / totalUploads) * 100) : 0,
        existingDuplicates,
      },
      message: `${uploadsWithHash} of ${totalUploads} uploads can be scanned for duplicates`,
    });
  } catch (error) {
    console.error("Error fetching batch scan status:", error);
    return NextResponse.json(
      { error: "Failed to fetch batch scan status" },
      { status: 500 }
    );
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function normalizeFilename(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  const nameWithoutExt = lastDot > 0 ? filename.slice(0, lastDot) : filename;

  return nameWithoutExt
    .toLowerCase()
    .replace(/[\s_-]*(copy|copie|\(\d+\)|v\d+|version\s*\d+|final|final\s*\d+|edited|edit)[\s_-]*/gi, "")
    .replace(/[\s_-]*\d{4}[-_]\d{2}[-_]\d{2}[\s_-]*/g, "")
    .replace(/[\s_-]*\d{8,14}[\s_-]*/g, "")
    .replace(/[\s_-]*[a-f0-9]{6,}$/i, "")
    .replace(/[\s_-]+/g, "_")
    .trim();
}

function calculateStringSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1;
  if (!str1 || !str2) return 0;

  const distance = levenshteinDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);

  return 1 - distance / maxLength;
}

function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;

  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}
