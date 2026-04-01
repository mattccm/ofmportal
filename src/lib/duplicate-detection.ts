/**
 * Duplicate Content Detection System
 *
 * Provides utilities for detecting duplicate uploads including:
 * - Hash-based detection for exact duplicates
 * - Similar filename detection
 * - Same creator + same timeframe detection
 * - Configurable similarity thresholds
 */

// Configuration for duplicate detection
export interface DuplicateDetectionConfig {
  // Similarity threshold for filename matching (0-1, where 1 is exact match)
  filenameSimilarityThreshold: number;
  // Time window in hours for same-creator detection
  timeframeHours: number;
  // Whether to check for exact hash duplicates
  checkHashDuplicates: boolean;
  // Whether to check for similar filenames
  checkSimilarFilenames: boolean;
  // Whether to check for same creator + timeframe
  checkCreatorTimeframe: boolean;
  // Minimum file size difference (in bytes) to consider as different files
  minSizeDifferenceBytes: number;
}

// Default configuration
export const DEFAULT_DUPLICATE_CONFIG: DuplicateDetectionConfig = {
  filenameSimilarityThreshold: 0.8,
  timeframeHours: 24,
  checkHashDuplicates: true,
  checkSimilarFilenames: true,
  checkCreatorTimeframe: true,
  minSizeDifferenceBytes: 1024, // 1KB
};

// Duplicate match type
export type DuplicateMatchType =
  | "exact_hash"       // Exact content match via hash
  | "similar_filename" // Similar filename
  | "same_size"        // Same file size (potential duplicate)
  | "creator_timeframe" // Same creator uploaded similar file recently
  | "possible_version"; // Appears to be a version of existing file

// Duplicate detection result
export interface DuplicateMatch {
  type: DuplicateMatchType;
  confidence: number; // 0-1, where 1 is highest confidence
  existingUploadId: string;
  existingFileName: string;
  existingFileSize: bigint;
  existingCreatorId: string;
  existingRequestId: string;
  existingUploadedAt: Date | null;
  matchDetails: string;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  matches: DuplicateMatch[];
  highestConfidence: number;
  recommendedAction: "replace" | "keep_both" | "review" | "proceed";
}

/**
 * Generate a hash from file content using Web Crypto API (browser-compatible)
 * For server-side, use the crypto module
 */
export async function generateFileHash(file: File | ArrayBuffer): Promise<string> {
  let buffer: ArrayBuffer;

  if (file instanceof File) {
    buffer = await file.arrayBuffer();
  } else {
    buffer = file;
  }

  // Use SHA-256 for content hashing
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

  return hashHex;
}

/**
 * Generate a quick hash from file metadata for fast comparison
 * Uses file size + first/last bytes for quick similarity check
 */
export function generateQuickHash(
  fileName: string,
  fileSize: number,
  fileType: string
): string {
  const normalizedName = normalizeFilename(fileName);
  const data = `${normalizedName}:${fileSize}:${fileType}`;

  // Simple hash for quick comparison
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return Math.abs(hash).toString(16);
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;

  // Create distance matrix
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  // Initialize base cases
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  // Fill the matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],     // deletion
          dp[i][j - 1],     // insertion
          dp[i - 1][j - 1]  // substitution
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculate similarity between two strings (0-1)
 */
export function calculateStringSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1;
  if (!str1 || !str2) return 0;

  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  const maxLength = Math.max(str1.length, str2.length);

  return 1 - (distance / maxLength);
}

/**
 * Normalize filename for comparison
 * Removes common variations like timestamps, copy indicators, etc.
 */
export function normalizeFilename(filename: string): string {
  // Remove file extension
  const lastDot = filename.lastIndexOf(".");
  const nameWithoutExt = lastDot > 0 ? filename.slice(0, lastDot) : filename;

  return nameWithoutExt
    // Convert to lowercase
    .toLowerCase()
    // Remove common copy indicators
    .replace(/[\s_-]*(copy|copie|\(\d+\)|v\d+|version\s*\d+|final|final\s*\d+|edited|edit)[\s_-]*/gi, "")
    // Remove timestamps (various formats)
    .replace(/[\s_-]*\d{4}[-_]\d{2}[-_]\d{2}[\s_-]*/g, "")
    .replace(/[\s_-]*\d{8,14}[\s_-]*/g, "")
    // Remove random-looking suffixes (e.g., from downloads)
    .replace(/[\s_-]*[a-f0-9]{6,}$/i, "")
    // Normalize separators
    .replace(/[\s_-]+/g, "_")
    // Trim
    .trim();
}

/**
 * Extract the base name from a filename (for version detection)
 */
export function extractBaseName(filename: string): string {
  const normalized = normalizeFilename(filename);

  // Remove version indicators
  return normalized
    .replace(/_v?\d+$/i, "")
    .replace(/_final$/i, "")
    .replace(/_edit$/i, "");
}

/**
 * Check if two filenames are similar enough to be potential duplicates
 */
export function areFilenamesSimilar(
  filename1: string,
  filename2: string,
  threshold: number = DEFAULT_DUPLICATE_CONFIG.filenameSimilarityThreshold
): { isSimilar: boolean; similarity: number } {
  const norm1 = normalizeFilename(filename1);
  const norm2 = normalizeFilename(filename2);

  // Check exact normalized match
  if (norm1 === norm2) {
    return { isSimilar: true, similarity: 1 };
  }

  // Check base name match (for versioned files)
  const base1 = extractBaseName(filename1);
  const base2 = extractBaseName(filename2);

  if (base1 === base2 && base1.length > 3) {
    return { isSimilar: true, similarity: 0.95 };
  }

  // Calculate string similarity
  const similarity = calculateStringSimilarity(norm1, norm2);

  return {
    isSimilar: similarity >= threshold,
    similarity,
  };
}

/**
 * Check if two file sizes are similar (potential duplicate with minor edits)
 */
export function areFileSizesSimilar(
  size1: number | bigint,
  size2: number | bigint,
  tolerancePercent: number = 5
): boolean {
  const s1 = Number(size1);
  const s2 = Number(size2);

  if (s1 === s2) return true;

  const diff = Math.abs(s1 - s2);
  const avg = (s1 + s2) / 2;
  const diffPercent = (diff / avg) * 100;

  return diffPercent <= tolerancePercent;
}

/**
 * Check if upload is within timeframe of another upload from same creator
 */
export function isWithinTimeframe(
  uploadDate: Date,
  existingDate: Date,
  timeframeHours: number = DEFAULT_DUPLICATE_CONFIG.timeframeHours
): boolean {
  const diffMs = Math.abs(uploadDate.getTime() - existingDate.getTime());
  const diffHours = diffMs / (1000 * 60 * 60);

  return diffHours <= timeframeHours;
}

/**
 * Determine the type of duplicate match based on evidence
 */
export function determineDuplicateType(
  hashMatch: boolean,
  filenameSimilarity: number,
  sizeMatch: boolean,
  sameCreator: boolean,
  withinTimeframe: boolean
): { type: DuplicateMatchType; confidence: number } {
  // Exact hash match - highest confidence
  if (hashMatch) {
    return { type: "exact_hash", confidence: 1.0 };
  }

  // Same size + very similar filename
  if (sizeMatch && filenameSimilarity >= 0.9) {
    return { type: "exact_hash", confidence: 0.95 };
  }

  // Same creator, same timeframe, similar filename - likely a version
  if (sameCreator && withinTimeframe && filenameSimilarity >= 0.7) {
    return { type: "possible_version", confidence: 0.85 };
  }

  // Same size (might be duplicate)
  if (sizeMatch && filenameSimilarity >= 0.5) {
    return { type: "same_size", confidence: 0.7 };
  }

  // Similar filename
  if (filenameSimilarity >= 0.8) {
    return { type: "similar_filename", confidence: 0.6 };
  }

  // Same creator + timeframe
  if (sameCreator && withinTimeframe) {
    return { type: "creator_timeframe", confidence: 0.5 };
  }

  // Fallback for any match
  return { type: "similar_filename", confidence: filenameSimilarity };
}

/**
 * Get recommended action based on duplicate analysis
 */
export function getRecommendedAction(
  matches: DuplicateMatch[]
): "replace" | "keep_both" | "review" | "proceed" {
  if (matches.length === 0) {
    return "proceed";
  }

  const highestConfidence = Math.max(...matches.map(m => m.confidence));
  const hasExactMatch = matches.some(m => m.type === "exact_hash");
  const hasVersionMatch = matches.some(m => m.type === "possible_version");

  if (hasExactMatch) {
    return "replace"; // Exact duplicate - suggest replacement
  }

  if (hasVersionMatch) {
    return "review"; // Possible new version - needs review
  }

  if (highestConfidence >= 0.8) {
    return "review"; // High confidence match - needs review
  }

  if (highestConfidence >= 0.5) {
    return "keep_both"; // Medium confidence - likely just similar
  }

  return "proceed"; // Low confidence - probably different files
}

/**
 * Format duplicate match for display
 */
export function formatDuplicateMatch(match: DuplicateMatch): string {
  const confidencePercent = Math.round(match.confidence * 100);

  switch (match.type) {
    case "exact_hash":
      return `Exact duplicate of "${match.existingFileName}" (${confidencePercent}% match)`;
    case "similar_filename":
      return `Similar to "${match.existingFileName}" (${confidencePercent}% filename match)`;
    case "same_size":
      return `Same size as "${match.existingFileName}" - possible duplicate`;
    case "creator_timeframe":
      return `Similar file uploaded recently by the same creator`;
    case "possible_version":
      return `Appears to be a version of "${match.existingFileName}"`;
    default:
      return `Potential match with "${match.existingFileName}"`;
  }
}

/**
 * Server-side hash generation using Node.js crypto
 */
export async function generateServerHash(buffer: Buffer): Promise<string> {
  // Dynamic import for server-side only
  const crypto = await import("crypto");
  const hash = crypto.createHash("sha256");
  hash.update(buffer);
  return hash.digest("hex");
}

/**
 * Interface for existing upload data (from database)
 */
export interface ExistingUploadData {
  id: string;
  fileName: string;
  originalName: string;
  fileType: string;
  fileSize: bigint;
  storageKey: string;
  creatorId: string;
  requestId: string;
  uploadedAt: Date | null;
  createdAt: Date;
  contentHash?: string | null;
}

/**
 * Main duplicate detection function
 * Compares a new file against existing uploads
 */
export async function detectDuplicates(
  newFile: {
    fileName: string;
    fileSize: number;
    fileType: string;
    creatorId: string;
    contentHash?: string;
  },
  existingUploads: ExistingUploadData[],
  config: Partial<DuplicateDetectionConfig> = {}
): Promise<DuplicateCheckResult> {
  const fullConfig = { ...DEFAULT_DUPLICATE_CONFIG, ...config };
  const matches: DuplicateMatch[] = [];
  const now = new Date();

  for (const existing of existingUploads) {
    // Skip if different file type category
    const newCategory = newFile.fileType.split("/")[0];
    const existingCategory = existing.fileType.split("/")[0];
    if (newCategory !== existingCategory) {
      continue;
    }

    // Check hash match (if available)
    let hashMatch = false;
    if (fullConfig.checkHashDuplicates && newFile.contentHash && existing.contentHash) {
      hashMatch = newFile.contentHash === existing.contentHash;
    }

    // Check filename similarity
    let filenameSimilarity = 0;
    if (fullConfig.checkSimilarFilenames) {
      const result = areFilenamesSimilar(
        newFile.fileName,
        existing.originalName,
        fullConfig.filenameSimilarityThreshold
      );
      filenameSimilarity = result.similarity;
    }

    // Check file size match
    const sizeMatch = areFileSizesSimilar(
      newFile.fileSize,
      existing.fileSize,
      5 // 5% tolerance
    );

    // Check creator + timeframe
    const sameCreator = newFile.creatorId === existing.creatorId;
    const uploadDate = existing.uploadedAt || existing.createdAt;
    const withinTimeframe = isWithinTimeframe(
      now,
      uploadDate,
      fullConfig.timeframeHours
    );

    // Determine if this is a match
    const { type, confidence } = determineDuplicateType(
      hashMatch,
      filenameSimilarity,
      sizeMatch,
      sameCreator,
      withinTimeframe
    );

    // Add to matches if confidence meets threshold
    if (
      hashMatch ||
      (fullConfig.checkSimilarFilenames && filenameSimilarity >= fullConfig.filenameSimilarityThreshold) ||
      (fullConfig.checkCreatorTimeframe && sameCreator && withinTimeframe && filenameSimilarity >= 0.5) ||
      (sizeMatch && filenameSimilarity >= 0.5)
    ) {
      matches.push({
        type,
        confidence,
        existingUploadId: existing.id,
        existingFileName: existing.originalName,
        existingFileSize: existing.fileSize,
        existingCreatorId: existing.creatorId,
        existingRequestId: existing.requestId,
        existingUploadedAt: existing.uploadedAt,
        matchDetails: formatDuplicateMatch({
          type,
          confidence,
          existingUploadId: existing.id,
          existingFileName: existing.originalName,
          existingFileSize: existing.fileSize,
          existingCreatorId: existing.creatorId,
          existingRequestId: existing.requestId,
          existingUploadedAt: existing.uploadedAt,
          matchDetails: "",
        }),
      });
    }
  }

  // Sort by confidence (highest first)
  matches.sort((a, b) => b.confidence - a.confidence);

  // Limit to top 5 matches
  const topMatches = matches.slice(0, 5);

  const highestConfidence = topMatches.length > 0 ? topMatches[0].confidence : 0;

  return {
    isDuplicate: topMatches.length > 0 && highestConfidence >= 0.5,
    matches: topMatches,
    highestConfidence,
    recommendedAction: getRecommendedAction(topMatches),
  };
}

/**
 * Quick check for potential duplicates (fast, non-blocking)
 * Uses only filename and size comparison
 */
export function quickDuplicateCheck(
  newFile: { fileName: string; fileSize: number; fileType: string },
  existingUploads: Array<{ originalName: string; fileSize: bigint; fileType: string }>
): { hasPotentialDuplicates: boolean; count: number } {
  let count = 0;

  for (const existing of existingUploads) {
    // Quick check: same file type category
    const newCategory = newFile.fileType.split("/")[0];
    const existingCategory = existing.fileType.split("/")[0];
    if (newCategory !== existingCategory) continue;

    // Quick filename check
    const { isSimilar } = areFilenamesSimilar(newFile.fileName, existing.originalName, 0.7);
    const sizeMatch = areFileSizesSimilar(newFile.fileSize, existing.fileSize, 10);

    if (isSimilar || sizeMatch) {
      count++;
    }
  }

  return {
    hasPotentialDuplicates: count > 0,
    count,
  };
}
