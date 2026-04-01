import { useState, useCallback, useRef } from "react";
import type { DuplicateCheckResult, DuplicateMatch } from "@/lib/duplicate-detection";

export interface DuplicateDetectionOptions {
  /**
   * The request ID to check duplicates against
   */
  requestId: string;
  /**
   * Creator token for authentication (for creator portal)
   */
  creatorToken?: string;
  /**
   * Scope of duplicate checking
   * - "request": Only check within the same request
   * - "creator": Check all uploads from this creator (default)
   * - "agency": Check all uploads in the agency
   */
  checkScope?: "request" | "creator" | "agency";
  /**
   * Similarity threshold (0-1) for filename matching
   */
  similarityThreshold?: number;
  /**
   * Timeframe in hours for same-creator detection
   */
  timeframeHours?: number;
  /**
   * Callback when a duplicate is detected
   */
  onDuplicateDetected?: (result: DuplicateCheckResult, file: File) => void;
  /**
   * Confidence threshold above which to trigger the onDuplicateDetected callback
   */
  confidenceThreshold?: number;
}

export interface DuplicateDetectionState {
  /**
   * Whether a duplicate check is currently in progress
   */
  isChecking: boolean;
  /**
   * The last check result (null if no check has been performed)
   */
  lastResult: DuplicateCheckResult | null;
  /**
   * The file that was last checked
   */
  lastCheckedFile: File | null;
  /**
   * Error message if the check failed
   */
  error: string | null;
  /**
   * Number of checks performed in this session
   */
  checkCount: number;
}

export interface DuplicateDetectionActions {
  /**
   * Check a file for duplicates
   */
  checkFile: (file: File) => Promise<DuplicateCheckResult | null>;
  /**
   * Check multiple files for duplicates
   * Returns an array of results in the same order as input files
   */
  checkFiles: (files: File[]) => Promise<(DuplicateCheckResult | null)[]>;
  /**
   * Clear the last result
   */
  clearResult: () => void;
  /**
   * Reset all state
   */
  reset: () => void;
}

export type UseDuplicateDetectionReturn = DuplicateDetectionState & DuplicateDetectionActions;

/**
 * Hook for detecting duplicate uploads
 *
 * @example
 * ```tsx
 * const { checkFile, isChecking, lastResult } = useDuplicateDetection({
 *   requestId: "req_123",
 *   onDuplicateDetected: (result, file) => {
 *     console.log(`Duplicate detected for ${file.name}:`, result);
 *   }
 * });
 *
 * const handleFileSelect = async (file: File) => {
 *   const result = await checkFile(file);
 *   if (result?.isDuplicate) {
 *     // Show warning to user
 *   } else {
 *     // Proceed with upload
 *   }
 * };
 * ```
 */
export function useDuplicateDetection(
  options: DuplicateDetectionOptions
): UseDuplicateDetectionReturn {
  const {
    requestId,
    creatorToken,
    checkScope = "creator",
    similarityThreshold,
    timeframeHours,
    onDuplicateDetected,
    confidenceThreshold = 0.5,
  } = options;

  const [isChecking, setIsChecking] = useState(false);
  const [lastResult, setLastResult] = useState<DuplicateCheckResult | null>(null);
  const [lastCheckedFile, setLastCheckedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkCount, setCheckCount] = useState(0);

  // Use ref to track abort controllers for cleanup
  const abortControllerRef = useRef<AbortController | null>(null);

  const checkFile = useCallback(
    async (file: File): Promise<DuplicateCheckResult | null> => {
      // Abort any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      setIsChecking(true);
      setError(null);
      setLastCheckedFile(file);

      try {
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
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            checkScope,
            ...(similarityThreshold && { similarityThreshold }),
            ...(timeframeHours && { timeframeHours }),
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to check for duplicates");
        }

        const result: DuplicateCheckResult = await response.json();
        setLastResult(result);
        setCheckCount((prev) => prev + 1);

        // Trigger callback if duplicate detected above threshold
        if (
          result.isDuplicate &&
          result.highestConfidence >= confidenceThreshold &&
          onDuplicateDetected
        ) {
          onDuplicateDetected(result, file);
        }

        return result;
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === "AbortError") {
          return null;
        }

        const errorMessage = err instanceof Error ? err.message : "Unknown error";
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
      checkScope,
      similarityThreshold,
      timeframeHours,
      onDuplicateDetected,
      confidenceThreshold,
    ]
  );

  const checkFiles = useCallback(
    async (files: File[]): Promise<(DuplicateCheckResult | null)[]> => {
      const results: (DuplicateCheckResult | null)[] = [];

      for (const file of files) {
        const result = await checkFile(file);
        results.push(result);
      }

      return results;
    },
    [checkFile]
  );

  const clearResult = useCallback(() => {
    setLastResult(null);
    setLastCheckedFile(null);
    setError(null);
  }, []);

  const reset = useCallback(() => {
    // Abort any in-progress request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setIsChecking(false);
    setLastResult(null);
    setLastCheckedFile(null);
    setError(null);
    setCheckCount(0);
  }, []);

  return {
    // State
    isChecking,
    lastResult,
    lastCheckedFile,
    error,
    checkCount,
    // Actions
    checkFile,
    checkFiles,
    clearResult,
    reset,
  };
}

/**
 * Utility function to get the most relevant match from a duplicate check result
 */
export function getTopMatch(result: DuplicateCheckResult | null): DuplicateMatch | null {
  if (!result || !result.isDuplicate || result.matches.length === 0) {
    return null;
  }
  return result.matches[0];
}

/**
 * Utility function to determine if a duplicate is high confidence
 */
export function isHighConfidenceDuplicate(
  result: DuplicateCheckResult | null,
  threshold: number = 0.8
): boolean {
  if (!result || !result.isDuplicate) {
    return false;
  }
  return result.highestConfidence >= threshold;
}

/**
 * Utility function to format duplicate match type for display
 */
export function formatMatchType(type: DuplicateMatch["type"]): string {
  switch (type) {
    case "exact_hash":
      return "Exact duplicate";
    case "similar_filename":
      return "Similar filename";
    case "same_size":
      return "Same file size";
    case "creator_timeframe":
      return "Recently uploaded by you";
    case "possible_version":
      return "Possible new version";
    default:
      return "Potential match";
  }
}
