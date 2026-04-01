/**
 * Content Fingerprinting System
 *
 * Provides utilities for generating and comparing content fingerprints
 * to detect duplicate uploads. Supports multiple detection methods:
 * - SHA-256 hash for exact duplicates
 * - Perceptual hashing for visual similarity (images)
 * - Video frame sampling and comparison
 * - Metadata-based similarity detection
 */

import type {
  ContentFingerprint,
  DuplicateMatch,
  DuplicateCheckResult,
  FingerprintConfig,
  DEFAULT_FINGERPRINT_CONFIG,
} from "@/types/content-fingerprint";

// Re-export types for convenience
export type {
  ContentFingerprint,
  DuplicateMatch,
  DuplicateCheckResult,
  FingerprintConfig,
};

/**
 * Generate SHA-256 hash of file content
 * Works in browser using Web Crypto API
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
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  return hashHex;
}

/**
 * Generate a quick hash for fast initial comparison
 * Uses file metadata rather than full content
 */
export function generateQuickFingerprint(
  fileName: string,
  fileSize: number,
  mimeType: string
): string {
  const normalized = normalizeFileName(fileName);
  const data = `${normalized}:${fileSize}:${mimeType}`;

  // Simple hash for quick comparison
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return Math.abs(hash).toString(16).padStart(8, "0");
}

/**
 * Normalize filename for comparison
 * Removes common variations like timestamps, copy indicators, etc.
 */
export function normalizeFileName(filename: string): string {
  // Remove extension
  const lastDot = filename.lastIndexOf(".");
  const nameWithoutExt = lastDot > 0 ? filename.slice(0, lastDot) : filename;

  return (
    nameWithoutExt
      .toLowerCase()
      // Remove common copy indicators
      .replace(
        /[\s_-]*(copy|copie|\(\d+\)|v\d+|version\s*\d+|final|final\s*\d+|edited|edit)[\s_-]*/gi,
        ""
      )
      // Remove timestamps
      .replace(/[\s_-]*\d{4}[-_]\d{2}[-_]\d{2}[\s_-]*/g, "")
      .replace(/[\s_-]*\d{8,14}[\s_-]*/g, "")
      // Remove random suffixes
      .replace(/[\s_-]*[a-f0-9]{6,}$/i, "")
      // Normalize separators
      .replace(/[\s_-]+/g, "_")
      .trim()
  );
}

/**
 * Calculate Levenshtein distance between two strings
 */
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

/**
 * Calculate string similarity (0-1)
 */
export function calculateStringSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1;
  if (!str1 || !str2) return 0;

  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  const maxLength = Math.max(str1.length, str2.length);

  return 1 - distance / maxLength;
}

/**
 * Generate perceptual hash for an image
 * Uses average hash algorithm (aHash) - simple but effective
 */
export async function generatePerceptualHash(file: File): Promise<string | null> {
  if (!file.type.startsWith("image/")) {
    return null;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      resolve(null);
      return;
    }

    img.onload = () => {
      // Resize to 8x8 for hash generation
      const size = 8;
      canvas.width = size;
      canvas.height = size;

      // Draw scaled image
      ctx.drawImage(img, 0, 0, size, size);

      // Get image data
      const imageData = ctx.getImageData(0, 0, size, size);
      const pixels = imageData.data;

      // Convert to grayscale and calculate average
      const grayPixels: number[] = [];
      for (let i = 0; i < pixels.length; i += 4) {
        const gray = Math.round(
          pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114
        );
        grayPixels.push(gray);
      }

      const average =
        grayPixels.reduce((sum, val) => sum + val, 0) / grayPixels.length;

      // Generate hash bits
      let hash = "";
      for (const pixel of grayPixels) {
        hash += pixel >= average ? "1" : "0";
      }

      // Convert binary to hex
      const hexHash = parseInt(hash, 2).toString(16).padStart(16, "0");
      resolve(hexHash);

      // Cleanup
      URL.revokeObjectURL(img.src);
    };

    img.onerror = () => {
      resolve(null);
    };

    img.src = URL.createObjectURL(file);
  });
}

/**
 * Generate difference hash (dHash) for an image
 * More robust than aHash for detecting similar images
 */
export async function generateDifferenceHash(file: File): Promise<string | null> {
  if (!file.type.startsWith("image/")) {
    return null;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      resolve(null);
      return;
    }

    img.onload = () => {
      // Resize to 9x8 (need one extra column for difference)
      const width = 9;
      const height = 8;
      canvas.width = width;
      canvas.height = height;

      ctx.drawImage(img, 0, 0, width, height);

      const imageData = ctx.getImageData(0, 0, width, height);
      const pixels = imageData.data;

      // Convert to grayscale
      const grayPixels: number[][] = [];
      for (let y = 0; y < height; y++) {
        grayPixels[y] = [];
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          const gray = Math.round(
            pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114
          );
          grayPixels[y][x] = gray;
        }
      }

      // Generate hash by comparing adjacent pixels
      let hash = "";
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width - 1; x++) {
          hash += grayPixels[y][x] < grayPixels[y][x + 1] ? "1" : "0";
        }
      }

      const hexHash = BigInt("0b" + hash).toString(16).padStart(16, "0");
      resolve(hexHash);

      URL.revokeObjectURL(img.src);
    };

    img.onerror = () => {
      resolve(null);
    };

    img.src = URL.createObjectURL(file);
  });
}

/**
 * Calculate Hamming distance between two hashes
 */
export function hammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) {
    return Math.max(hash1.length, hash2.length);
  }

  // Convert hex to binary and compare
  const bin1 = BigInt("0x" + hash1)
    .toString(2)
    .padStart(hash1.length * 4, "0");
  const bin2 = BigInt("0x" + hash2)
    .toString(2)
    .padStart(hash2.length * 4, "0");

  let distance = 0;
  for (let i = 0; i < bin1.length; i++) {
    if (bin1[i] !== bin2[i]) {
      distance++;
    }
  }

  return distance;
}

/**
 * Calculate perceptual similarity score (0-100)
 */
export function calculatePerceptualSimilarity(
  hash1: string,
  hash2: string
): number {
  if (!hash1 || !hash2) return 0;

  const distance = hammingDistance(hash1, hash2);
  const maxDistance = hash1.length * 4; // 4 bits per hex character

  return Math.round(((maxDistance - distance) / maxDistance) * 100);
}

/**
 * Get image dimensions from file
 */
export function getImageDimensions(
  file: File
): Promise<{ width: number; height: number } | null> {
  if (!file.type.startsWith("image/")) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const img = new Image();

    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(img.src);
    };

    img.onerror = () => {
      resolve(null);
    };

    img.src = URL.createObjectURL(file);
  });
}

/**
 * Get video duration and generate frame samples
 */
export async function getVideoFingerprint(
  file: File,
  sampleCount: number = 5
): Promise<{
  duration: number;
  frameHashes: string[];
} | null> {
  if (!file.type.startsWith("video/")) {
    return null;
  }

  return new Promise((resolve) => {
    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      resolve(null);
      return;
    }

    video.preload = "metadata";

    video.onloadedmetadata = async () => {
      const duration = video.duration;
      const frameHashes: string[] = [];

      // Set canvas size
      canvas.width = 8;
      canvas.height = 8;

      // Sample frames at even intervals
      const interval = duration / (sampleCount + 1);

      for (let i = 1; i <= sampleCount; i++) {
        const time = interval * i;

        try {
          const hash = await captureFrameHash(video, canvas, ctx, time);
          if (hash) {
            frameHashes.push(hash);
          }
        } catch {
          // Continue with other frames
        }
      }

      URL.revokeObjectURL(video.src);
      resolve({ duration, frameHashes });
    };

    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      resolve(null);
    };

    video.src = URL.createObjectURL(file);
  });
}

/**
 * Capture a single video frame and generate its hash
 */
function captureFrameHash(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  time: number
): Promise<string | null> {
  return new Promise((resolve) => {
    video.currentTime = time;

    video.onseeked = () => {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imageData.data;

      // Calculate average hash
      const grayPixels: number[] = [];
      for (let i = 0; i < pixels.length; i += 4) {
        const gray = Math.round(
          pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114
        );
        grayPixels.push(gray);
      }

      const average =
        grayPixels.reduce((sum, val) => sum + val, 0) / grayPixels.length;

      let hash = "";
      for (const pixel of grayPixels) {
        hash += pixel >= average ? "1" : "0";
      }

      const hexHash = parseInt(hash, 2).toString(16).padStart(16, "0");
      resolve(hexHash);
    };

    // Timeout for seeking
    setTimeout(() => resolve(null), 5000);
  });
}

/**
 * Compare two fingerprints and calculate match score
 */
export function compareFingerprints(
  fp1: ContentFingerprint,
  fp2: ContentFingerprint
): DuplicateMatch | null {
  let hashMatch = false;
  let perceptualMatch = false;
  let metadataMatch = false;
  let confidence = 0;
  let matchType: "exact" | "near" | "similar" = "similar";

  // Check exact hash match
  if (fp1.fileHash === fp2.fileHash) {
    hashMatch = true;
    confidence = 100;
    matchType = "exact";
  }

  // Check perceptual hash match for images
  if (fp1.perceptualHash && fp2.perceptualHash) {
    const similarity = calculatePerceptualSimilarity(
      fp1.perceptualHash,
      fp2.perceptualHash
    );

    if (similarity >= 90) {
      perceptualMatch = true;
      confidence = Math.max(confidence, similarity);
      if (similarity >= 95) {
        matchType = "near";
      }
    }
  }

  // Check video frame hashes
  if (fp1.frameHashes?.length && fp2.frameHashes?.length) {
    const minFrames = Math.min(fp1.frameHashes.length, fp2.frameHashes.length);
    let matchingFrames = 0;

    for (let i = 0; i < minFrames; i++) {
      const similarity = calculatePerceptualSimilarity(
        fp1.frameHashes[i],
        fp2.frameHashes[i]
      );
      if (similarity >= 85) {
        matchingFrames++;
      }
    }

    const frameMatchRate = (matchingFrames / minFrames) * 100;
    if (frameMatchRate >= 60) {
      perceptualMatch = true;
      confidence = Math.max(confidence, frameMatchRate);
      if (frameMatchRate >= 80) {
        matchType = "near";
      }
    }
  }

  // Check metadata similarity
  const fileNameSimilarity = calculateStringSimilarity(
    normalizeFileName(fp1.fileName),
    normalizeFileName(fp2.fileName)
  );

  const sizeDiff = Math.abs(fp1.fileSize - fp2.fileSize);
  const sizeToleranceBytes = Math.max(fp1.fileSize, fp2.fileSize) * 0.05;
  const sizeMatch = sizeDiff <= sizeToleranceBytes;

  if (fileNameSimilarity >= 0.8 && sizeMatch) {
    metadataMatch = true;
    confidence = Math.max(confidence, fileNameSimilarity * 80);
  }

  // Determine if it's a match
  if (!hashMatch && !perceptualMatch && !metadataMatch) {
    return null;
  }

  return {
    originalUploadId: fp2.uploadId,
    originalRequestId: "", // Will be filled by API
    matchType,
    confidence,
    matchedAt: new Date(),
    hashMatch,
    perceptualMatch,
    metadataMatch,
    originalFileName: fp2.fileName,
    originalFileSize: fp2.fileSize,
  };
}

/**
 * Check for duplicates against a list of existing fingerprints
 */
export function checkForDuplicates(
  newFingerprint: Omit<ContentFingerprint, "id" | "uploadId" | "createdAt">,
  existingFingerprints: ContentFingerprint[],
  config?: Partial<FingerprintConfig>
): DuplicateCheckResult {
  const startTime = Date.now();
  const matches: DuplicateMatch[] = [];
  const methodsUsed: Set<"hash" | "perceptual" | "metadata"> = new Set();

  const fullConfig = {
    enableHashCheck: true,
    enablePerceptualHash: true,
    enableMetadataCheck: true,
    blockExactDuplicates: true,
    warnNearDuplicates: true,
    perceptualThreshold: 90,
    fileNameSimilarityThreshold: 0.8,
    fileSizeTolerance: 5,
    ...config,
  };

  for (const existing of existingFingerprints) {
    // Skip if different mime type category
    const newCategory = newFingerprint.mimeType.split("/")[0];
    const existingCategory = existing.mimeType.split("/")[0];
    if (newCategory !== existingCategory) {
      continue;
    }

    let hashMatch = false;
    let perceptualMatch = false;
    let metadataMatch = false;
    let confidence = 0;
    let matchType: "exact" | "near" | "similar" = "similar";

    // Hash check
    if (fullConfig.enableHashCheck) {
      methodsUsed.add("hash");
      if (newFingerprint.fileHash === existing.fileHash) {
        hashMatch = true;
        confidence = 100;
        matchType = "exact";
      }
    }

    // Perceptual hash check for images
    if (
      fullConfig.enablePerceptualHash &&
      newFingerprint.perceptualHash &&
      existing.perceptualHash
    ) {
      methodsUsed.add("perceptual");
      const similarity = calculatePerceptualSimilarity(
        newFingerprint.perceptualHash,
        existing.perceptualHash
      );

      if (similarity >= fullConfig.perceptualThreshold) {
        perceptualMatch = true;
        confidence = Math.max(confidence, similarity);
        if (!hashMatch) {
          matchType = similarity >= 95 ? "near" : "similar";
        }
      }
    }

    // Video frame comparison
    if (
      fullConfig.enablePerceptualHash &&
      newFingerprint.frameHashes?.length &&
      existing.frameHashes?.length
    ) {
      methodsUsed.add("perceptual");
      const minFrames = Math.min(
        newFingerprint.frameHashes.length,
        existing.frameHashes.length
      );
      let matchingFrames = 0;

      for (let i = 0; i < minFrames; i++) {
        const frameSimilarity = calculatePerceptualSimilarity(
          newFingerprint.frameHashes[i],
          existing.frameHashes[i]
        );
        if (frameSimilarity >= 85) {
          matchingFrames++;
        }
      }

      const frameMatchRate = (matchingFrames / minFrames) * 100;
      if (frameMatchRate >= 60) {
        perceptualMatch = true;
        confidence = Math.max(confidence, frameMatchRate);
        if (!hashMatch && frameMatchRate >= 80) {
          matchType = "near";
        }
      }
    }

    // Metadata check
    if (fullConfig.enableMetadataCheck) {
      methodsUsed.add("metadata");

      const fileNameSimilarity = calculateStringSimilarity(
        normalizeFileName(newFingerprint.fileName),
        normalizeFileName(existing.fileName)
      );

      const sizeDiff = Math.abs(newFingerprint.fileSize - existing.fileSize);
      const maxSize = Math.max(newFingerprint.fileSize, existing.fileSize);
      const sizeDiffPercent = (sizeDiff / maxSize) * 100;
      const sizeMatch = sizeDiffPercent <= fullConfig.fileSizeTolerance;

      if (
        fileNameSimilarity >= fullConfig.fileNameSimilarityThreshold &&
        sizeMatch
      ) {
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
        originalRequestId: "",
        matchType,
        confidence,
        matchedAt: new Date(),
        hashMatch,
        perceptualMatch,
        metadataMatch,
        originalFileName: existing.fileName,
        originalFileSize: existing.fileSize,
        originalUploadedAt: existing.createdAt,
      });
    }
  }

  // Sort by confidence
  matches.sort((a, b) => b.confidence - a.confidence);

  // Determine recommendation
  let recommendation: "block" | "warn" | "allow" = "allow";

  if (matches.length > 0) {
    const topMatch = matches[0];

    if (topMatch.matchType === "exact" && fullConfig.blockExactDuplicates) {
      recommendation = "block";
    } else if (
      topMatch.matchType === "near" &&
      fullConfig.warnNearDuplicates
    ) {
      recommendation = "warn";
    } else if (topMatch.confidence >= 70) {
      recommendation = "warn";
    }
  }

  return {
    isDuplicate: matches.length > 0,
    matches: matches.slice(0, 5), // Top 5 matches
    recommendation,
    checkDuration: Date.now() - startTime,
    methodsUsed: Array.from(methodsUsed),
  };
}

/**
 * Create a full fingerprint for a file
 */
export async function createFileFingerprint(
  file: File,
  creatorId: string
): Promise<Omit<ContentFingerprint, "id" | "uploadId" | "createdAt">> {
  const [fileHash, perceptualHash, dimensions, videoData] = await Promise.all([
    generateFileHash(file),
    file.type.startsWith("image/") ? generateDifferenceHash(file) : null,
    getImageDimensions(file),
    file.type.startsWith("video/") ? getVideoFingerprint(file) : null,
  ]);

  return {
    creatorId,
    fileHash,
    perceptualHash: perceptualHash || undefined,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
    dimensions: dimensions || undefined,
    duration: videoData?.duration,
    frameHashes: videoData?.frameHashes,
  };
}

/**
 * Format match type for display
 */
export function formatMatchType(
  matchType: "exact" | "near" | "similar"
): string {
  switch (matchType) {
    case "exact":
      return "Exact duplicate";
    case "near":
      return "Near duplicate";
    case "similar":
      return "Similar content";
  }
}

/**
 * Get match type severity color
 */
export function getMatchTypeSeverity(
  matchType: "exact" | "near" | "similar"
): "high" | "medium" | "low" {
  switch (matchType) {
    case "exact":
      return "high";
    case "near":
      return "medium";
    case "similar":
      return "low";
  }
}

/**
 * Get recommendation label
 */
export function getRecommendationLabel(
  recommendation: "block" | "warn" | "allow"
): string {
  switch (recommendation) {
    case "block":
      return "Upload blocked - exact duplicate";
    case "warn":
      return "Possible duplicate detected";
    case "allow":
      return "No duplicates found";
  }
}
