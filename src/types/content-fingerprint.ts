/**
 * Content Fingerprint Types
 *
 * Defines the types for content fingerprinting and duplicate detection system.
 * Supports multiple detection methods including hash-based and perceptual matching.
 */

export interface ContentFingerprint {
  id: string;
  uploadId: string;
  creatorId: string;

  // File hash
  fileHash: string; // SHA-256 of file

  // Perceptual hashes for images/videos
  perceptualHash?: string; // pHash for visual similarity

  // Metadata fingerprint
  fileName: string;
  fileSize: number;
  mimeType: string;

  // For images
  dimensions?: { width: number; height: number };

  // For videos
  duration?: number;
  frameHashes?: string[]; // Sample frame hashes

  createdAt: Date;
}

export interface DuplicateMatch {
  originalUploadId: string;
  originalRequestId: string;
  originalRequestName?: string; // IMPROVEMENT #1: Include request name for better context
  matchType: "exact" | "near" | "similar";
  confidence: number; // 0-100
  matchedAt: Date;

  // What matched
  hashMatch: boolean;
  perceptualMatch: boolean;
  metadataMatch: boolean;

  // Additional info for display
  originalFileName?: string;
  originalFileSize?: number;
  originalUploadedAt?: Date;
  originalThumbnailUrl?: string;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  matches: DuplicateMatch[];
  recommendation: "block" | "warn" | "allow";

  // Additional metadata
  checkDuration?: number; // ms
  methodsUsed?: ("hash" | "perceptual" | "metadata")[];
}

// Configuration for fingerprinting
export interface FingerprintConfig {
  // Hash settings
  enableHashCheck: boolean;
  hashAlgorithm: "sha256" | "md5";

  // Perceptual hash settings for images
  enablePerceptualHash: boolean;
  perceptualThreshold: number; // 0-100, higher = more strict

  // Video settings
  enableVideoFrameHash: boolean;
  videoSampleCount: number; // Number of frames to sample

  // Metadata settings
  enableMetadataCheck: boolean;
  fileNameSimilarityThreshold: number; // 0-1
  fileSizeTolerance: number; // percentage

  // Behavior settings
  blockExactDuplicates: boolean;
  warnNearDuplicates: boolean;
  allowSimilarWithReason: boolean;
}

export const DEFAULT_FINGERPRINT_CONFIG: FingerprintConfig = {
  enableHashCheck: true,
  hashAlgorithm: "sha256",
  enablePerceptualHash: true,
  perceptualThreshold: 90,
  enableVideoFrameHash: true,
  videoSampleCount: 5,
  enableMetadataCheck: true,
  fileNameSimilarityThreshold: 0.8,
  fileSizeTolerance: 5, // 5% tolerance
  blockExactDuplicates: true,
  warnNearDuplicates: true,
  allowSimilarWithReason: true,
};

// Duplicate override reasons
export interface DuplicateOverride {
  id: string;
  uploadId: string;
  matchedUploadId: string;
  reason: DuplicateOverrideReason;
  customReason?: string;
  createdBy: string;
  createdAt: Date;
}

export type DuplicateOverrideReason =
  | "different_angle"
  | "different_lighting"
  | "different_edit"
  | "retake"
  | "different_version"
  | "intentional_duplicate"
  | "false_positive"
  | "other";

export const OVERRIDE_REASON_LABELS: Record<DuplicateOverrideReason, string> = {
  different_angle: "Different angle or perspective",
  different_lighting: "Different lighting conditions",
  different_edit: "Different edit or color grade",
  retake: "Retake of the same shot",
  different_version: "Updated version of content",
  intentional_duplicate: "Intentionally submitting again",
  false_positive: "Not actually the same content",
  other: "Other reason",
};

// Duplicate history entry
export interface DuplicateHistoryEntry {
  id: string;
  creatorId: string;
  uploadId: string;
  attemptedAt: Date;
  matchedUploadIds: string[];
  action: "blocked" | "warned" | "allowed" | "overridden";
  overrideReason?: DuplicateOverrideReason;
  matchConfidence: number;
  matchType: "exact" | "near" | "similar";
}

// Pattern detection for repeated duplicate attempts
export interface DuplicatePattern {
  creatorId: string;
  patternType: "repeated_exact" | "repeated_near" | "bulk_duplicates";
  occurrenceCount: number;
  firstOccurrence: Date;
  lastOccurrence: Date;
  affectedUploadIds: string[];
  severity: "low" | "medium" | "high";
}

// API request/response types
export interface CheckDuplicateRequest {
  requestId: string;
  fileHash: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  perceptualHash?: string;
  dimensions?: { width: number; height: number };
  duration?: number;
  frameHashes?: string[];
}

export interface CheckDuplicateResponse {
  isDuplicate: boolean;
  matches: DuplicateMatch[];
  recommendation: "block" | "warn" | "allow";
  canOverride: boolean;
  requiresReason: boolean;
}

export interface StoreFingerprintRequest {
  uploadId: string;
  fileHash: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  perceptualHash?: string;
  dimensions?: { width: number; height: number };
  duration?: number;
  frameHashes?: string[];
}

export interface StoreFingerprintResponse {
  fingerprintId: string;
  duplicateCheckResult?: DuplicateCheckResult;
}

// ============================================
// DUPLICATE ATTEMPT TRACKING
// ============================================

export type DuplicateMatchTypeEnum = "EXACT" | "NEAR" | "SIMILAR";
export type DuplicateActionEnum = "BLOCKED" | "WARNED" | "ALLOWED" | "OVERRIDDEN";
export type DuplicateCheckScopeEnum = "CREATOR" | "AGENCY" | "REQUEST";

export interface DuplicateAttempt {
  id: string;
  agencyId: string;
  creatorId: string;
  requestId: string;

  // Attempted file info
  attemptedFileName: string;
  attemptedFileSize: number;
  attemptedFileType: string;
  attemptedFileHash?: string;
  attemptedPerceptualHash?: string;
  attemptedThumbnailUrl?: string; // IMPROVEMENT #3: For side-by-side comparison

  // Original file info
  originalUploadId: string;
  originalFileName: string;
  originalFileSize: number;
  originalUploadedAt: Date;
  originalRequestId?: string;  // IMPROVEMENT #1: Original request ID
  originalRequestName?: string; // IMPROVEMENT #1: Original request name for better error messages
  originalThumbnailUrl?: string; // IMPROVEMENT #3: For side-by-side comparison

  // Match details
  matchType: DuplicateMatchTypeEnum;
  similarity: number; // IMPROVEMENT #2: Exact percentage for display
  hashMatch: boolean;
  perceptualMatch: boolean;
  metadataMatch: boolean;

  // Action taken
  action: DuplicateActionEnum;

  // Override info
  overrideReason?: string;
  overrideBy?: string;
  overrideAt?: Date;

  attemptedAt: Date;

  // Populated relations
  creator?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
}

export interface DuplicateAttemptListResponse {
  attempts: DuplicateAttempt[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  stats: {
    totalAttempts: number;
    blockedCount: number;
    warnedCount: number;
    uniqueCreators: number;
    repeatOffenders: { creatorId: string; count: number }[];
  };
  filters: {
    creators: { id: string; name: string; email: string }[];
    matchTypes: DuplicateMatchTypeEnum[];
    actions: DuplicateActionEnum[];
  };
}

export interface DuplicateDetectionSettings {
  id: string;
  agencyId: string;
  enabled: boolean;
  similarityThreshold: number; // IMPROVEMENT #4: 80-100% configurable
  perceptualThreshold: number; // IMPROVEMENT #4: 80-100% configurable
  enableHashCheck: boolean;
  enablePerceptualHash: boolean;
  enableMetadataCheck: boolean;
  enableVideoFrameHash: boolean;
  blockExactDuplicates: boolean;
  blockNearDuplicates: boolean;
  warnSimilarContent: boolean;
  checkScope: DuplicateCheckScopeEnum;
  videoSampleFrames: number;
  // IMPROVEMENT #8: Email notification settings
  notifyAdminOnDuplicate: boolean;
  adminNotificationEmail?: string;
}

// IMPROVEMENT #5: Whitelist capability
export interface WhitelistedContent {
  id: string;
  agencyId: string;
  fileHash: string;
  perceptualHash?: string;
  name: string;
  description?: string;
  category: "branding" | "stock" | "template" | "other";
  fileName: string;
  fileSize: number;
  mimeType: string;
  thumbnailUrl?: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

// IMPROVEMENT #6: Batch scan results
export interface BatchScanResult {
  id: string;
  agencyId: string;
  status: "pending" | "running" | "completed" | "failed";
  totalFiles: number;
  scannedFiles: number;
  duplicatesFound: number;
  duplicatePairs: DuplicatePair[];
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

export interface DuplicatePair {
  file1Id: string;
  file1Name: string;
  file1Url?: string;
  file2Id: string;
  file2Name: string;
  file2Url?: string;
  similarity: number;
  matchType: DuplicateMatchTypeEnum;
}

// IMPROVEMENT #7: Creator duplicate stats
export interface CreatorDuplicateStats {
  creatorId: string;
  totalAttempts: number;
  blockedAttempts: number;
  warnedAttempts: number;
  lastAttemptAt?: Date;
  trend: "increasing" | "stable" | "decreasing";
}

export const DEFAULT_DUPLICATE_DETECTION_SETTINGS: Omit<DuplicateDetectionSettings, "id" | "agencyId"> = {
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
  notifyAdminOnDuplicate: false,
};

// Blocked duplicate response for creator portal
export interface DuplicateBlockedResponse {
  blocked: true;
  reason: string;
  originalUploadDate: Date;
  originalFileName: string;
  similarity: number;
  matchType: DuplicateMatchTypeEnum;
}

// Creator duplicate attempt pattern (for flagging repeat offenders)
export interface CreatorDuplicatePattern {
  creatorId: string;
  creatorName: string;
  creatorEmail: string;
  totalAttempts: number;
  blockedAttempts: number;
  firstAttempt: Date;
  lastAttempt: Date;
  severity: "low" | "medium" | "high";
  trend: "increasing" | "stable" | "decreasing";
}
