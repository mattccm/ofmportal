"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type {
  DuplicateCheckResult,
  DuplicateMatch,
  DuplicateOverrideReason,
  ContentFingerprint,
} from "@/types/content-fingerprint";
import {
  generateFileHash,
  generateDifferenceHash,
  getImageDimensions,
  getVideoFingerprint,
  createFileFingerprint,
} from "@/lib/content-fingerprinting";

export interface UseDuplicateCheckOptions {
  /**
   * Request ID to check against
   */
  requestId: string;

  /**
   * Creator token for authentication
   */
  creatorToken?: string;

  /**
   * Whether to generate perceptual hashes (slower but more accurate)
   */
  enablePerceptualHash?: boolean;

  /**
   * Whether to auto-check files when added
   */
  autoCheck?: boolean;

  /**
   * Callback when duplicate is detected
   */
  onDuplicateDetected?: (result: DuplicateCheckResult, file: File) => void;

  /**
   * Callback when check completes (even if no duplicate)
   */
  onCheckComplete?: (result: DuplicateCheckResult, file: File) => void;

  /**
   * Minimum confidence to trigger duplicate callback (0-100)
   */
  minConfidenceThreshold?: number;

  /**
   * Cache results to avoid re-checking same files
   */
  enableCache?: boolean;

  /**
   * Cache TTL in milliseconds
   */
  cacheTTL?: number;
}

export interface DuplicateCheckState {
  /**
   * Currently checking file
   */
  isChecking: boolean;

  /**
   * Current progress (0-100) for fingerprint generation
   */
  progress: number;

  /**
   * Last check result
   */
  result: DuplicateCheckResult | null;

  /**
   * Last checked file
   */
  lastFile: File | null;

  /**
   * Error if check failed
   */
  error: string | null;

  /**
   * Number of checks performed
   */
  checkCount: number;

  /**
   * Map of file names to their check results (cache)
   */
  resultCache: Map<string, { result: DuplicateCheckResult; timestamp: number }>;
}

export interface DuplicateCheckActions {
  /**
   * Check a single file for duplicates
   */
  checkFile: (file: File) => Promise<DuplicateCheckResult | null>;

  /**
   * Check multiple files
   */
  checkFiles: (files: File[]) => Promise<Map<File, DuplicateCheckResult | null>>;

  /**
   * Get cached result for a file
   */
  getCachedResult: (file: File) => DuplicateCheckResult | null;

  /**
   * Clear all cached results
   */
  clearCache: () => void;

  /**
   * Reset state
   */
  reset: () => void;

  /**
   * Override a duplicate decision
   */
  overrideDuplicate: (
    uploadId: string,
    matchedUploadId: string,
    reason: DuplicateOverrideReason,
    customReason?: string
  ) => Promise<boolean>;
}

export type UseDuplicateCheckReturn = DuplicateCheckState & DuplicateCheckActions;

/**
 * Hook for checking files for duplicates before upload
 *
 * @example
 * ```tsx
 * const { checkFile, isChecking, result } = useDuplicateCheck({
 *   requestId: "req_123",
 *   onDuplicateDetected: (result, file) => {
 *     console.log(`Duplicate detected: ${file.name}`);
 *   }
 * });
 *
 * const handleFileSelect = async (file: File) => {
 *   const result = await checkFile(file);
 *   if (result?.recommendation === "block") {
 *     // Don't allow upload
 *   }
 * };
 * ```
 */
export function useDuplicateCheck(
  options: UseDuplicateCheckOptions
): UseDuplicateCheckReturn {
  const {
    requestId,
    creatorToken,
    enablePerceptualHash = true,
    autoCheck = false,
    onDuplicateDetected,
    onCheckComplete,
    minConfidenceThreshold = 50,
    enableCache = true,
    cacheTTL = 5 * 60 * 1000, // 5 minutes
  } = options;

  const [isChecking, setIsChecking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<DuplicateCheckResult | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkCount, setCheckCount] = useState(0);
  const [resultCache] = useState(
    () => new Map<string, { result: DuplicateCheckResult; timestamp: number }>()
  );

  const abortControllerRef = useRef<AbortController | null>(null);

  // Generate cache key for a file
  const getCacheKey = useCallback((file: File): string => {
    return `${file.name}:${file.size}:${file.lastModified}`;
  }, []);

  // Get cached result
  const getCachedResult = useCallback(
    (file: File): DuplicateCheckResult | null => {
      if (!enableCache) return null;

      const key = getCacheKey(file);
      const cached = resultCache.get(key);

      if (cached) {
        // Check if cache is still valid
        if (Date.now() - cached.timestamp < cacheTTL) {
          return cached.result;
        }
        // Remove stale cache entry
        resultCache.delete(key);
      }

      return null;
    },
    [enableCache, getCacheKey, resultCache, cacheTTL]
  );

  // Check a single file
  const checkFile = useCallback(
    async (file: File): Promise<DuplicateCheckResult | null> => {
      // Check cache first
      const cached = getCachedResult(file);
      if (cached) {
        setResult(cached);
        setLastFile(file);
        return cached;
      }

      // Abort any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      setIsChecking(true);
      setProgress(0);
      setError(null);
      setLastFile(file);

      try {
        // Step 1: Generate file hash (fast)
        setProgress(10);
        const fileHash = await generateFileHash(file);

        // Step 2: Generate perceptual hash if enabled (slower)
        let perceptualHash: string | null = null;
        let dimensions: { width: number; height: number } | null = null;
        let videoData: { duration: number; frameHashes: string[] } | null = null;

        if (enablePerceptualHash) {
          setProgress(30);

          if (file.type.startsWith("image/")) {
            [perceptualHash, dimensions] = await Promise.all([
              generateDifferenceHash(file),
              getImageDimensions(file),
            ]);
          } else if (file.type.startsWith("video/")) {
            setProgress(40);
            videoData = await getVideoFingerprint(file, 5);
          }
        }

        setProgress(60);

        // Step 3: Send to API for checking
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        if (creatorToken) {
          headers["x-creator-token"] = creatorToken;
        }

        const response = await fetch("/api/uploads/check-duplicate", {
          method: "POST",
          headers,
          body: JSON.stringify({
            requestId,
            fileHash,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
            perceptualHash,
            dimensions,
            duration: videoData?.duration,
            frameHashes: videoData?.frameHashes,
          }),
          signal: abortControllerRef.current.signal,
        });

        setProgress(90);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to check for duplicates");
        }

        const checkResult: DuplicateCheckResult = await response.json();

        // Cache the result
        if (enableCache) {
          const key = getCacheKey(file);
          resultCache.set(key, {
            result: checkResult,
            timestamp: Date.now(),
          });
        }

        setResult(checkResult);
        setProgress(100);
        setCheckCount((prev) => prev + 1);

        // Trigger callbacks
        if (
          checkResult.isDuplicate &&
          checkResult.matches[0]?.confidence >= minConfidenceThreshold &&
          onDuplicateDetected
        ) {
          onDuplicateDetected(checkResult, file);
        }

        if (onCheckComplete) {
          onCheckComplete(checkResult, file);
        }

        return checkResult;
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === "AbortError") {
          return null;
        }

        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
        console.error("Duplicate check error:", err);
        return null;
      } finally {
        setIsChecking(false);
        abortControllerRef.current = null;
      }
    },
    [
      requestId,
      creatorToken,
      enablePerceptualHash,
      enableCache,
      cacheTTL,
      getCacheKey,
      getCachedResult,
      resultCache,
      minConfidenceThreshold,
      onDuplicateDetected,
      onCheckComplete,
    ]
  );

  // Check multiple files
  const checkFiles = useCallback(
    async (files: File[]): Promise<Map<File, DuplicateCheckResult | null>> => {
      const results = new Map<File, DuplicateCheckResult | null>();

      for (const file of files) {
        const checkResult = await checkFile(file);
        results.set(file, checkResult);
      }

      return results;
    },
    [checkFile]
  );

  // Clear cache
  const clearCache = useCallback(() => {
    resultCache.clear();
  }, [resultCache]);

  // Reset state
  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setIsChecking(false);
    setProgress(0);
    setResult(null);
    setLastFile(null);
    setError(null);
    setCheckCount(0);
    resultCache.clear();
  }, [resultCache]);

  // Override duplicate decision
  const overrideDuplicate = useCallback(
    async (
      uploadId: string,
      matchedUploadId: string,
      reason: DuplicateOverrideReason,
      customReason?: string
    ): Promise<boolean> => {
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        if (creatorToken) {
          headers["x-creator-token"] = creatorToken;
        }

        const response = await fetch("/api/uploads/duplicate-override", {
          method: "POST",
          headers,
          body: JSON.stringify({
            uploadId,
            matchedUploadId,
            reason,
            customReason,
          }),
        });

        return response.ok;
      } catch (err) {
        console.error("Failed to override duplicate:", err);
        return false;
      }
    },
    [creatorToken]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    // State
    isChecking,
    progress,
    result,
    lastFile,
    error,
    checkCount,
    resultCache,
    // Actions
    checkFile,
    checkFiles,
    getCachedResult,
    clearCache,
    reset,
    overrideDuplicate,
  };
}

/**
 * Helper to determine if upload should be blocked
 */
export function shouldBlockUpload(
  result: DuplicateCheckResult | null
): boolean {
  if (!result) return false;
  return result.recommendation === "block";
}

/**
 * Helper to determine if upload should show warning
 */
export function shouldWarnUpload(
  result: DuplicateCheckResult | null
): boolean {
  if (!result) return false;
  return result.recommendation === "warn";
}

/**
 * Get the top match from a result
 */
export function getTopMatch(
  result: DuplicateCheckResult | null
): DuplicateMatch | null {
  if (!result || !result.isDuplicate || result.matches.length === 0) {
    return null;
  }
  return result.matches[0];
}

/**
 * Format confidence for display
 */
export function formatConfidence(confidence: number): string {
  if (confidence >= 95) return "Exact match";
  if (confidence >= 85) return "Very similar";
  if (confidence >= 70) return "Similar";
  if (confidence >= 50) return "Possibly similar";
  return "Low similarity";
}

export default useDuplicateCheck;
