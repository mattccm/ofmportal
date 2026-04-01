"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ============================================
// TYPES
// ============================================

export interface OnboardingProgress {
  /** Unique identifier for the onboarding type */
  type: "agency" | "creator" | "feature_tour";
  /** Completed step keys */
  completedSteps: string[];
  /** Whether onboarding is fully complete */
  isComplete: boolean;
  /** Timestamp of last update */
  updatedAt: Date;
}

export interface UseOnboardingOptions {
  /** User ID (optional, uses session if not provided) */
  userId?: string;
  /** Whether to auto-fetch progress on mount */
  autoFetch?: boolean;
  /** Enable local storage fallback */
  useLocalStorage?: boolean;
}

export interface UseOnboardingReturn {
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** All completed steps */
  completedSteps: Set<string>;
  /** Check if a specific step is complete */
  isStepComplete: (stepKey: string) => boolean;
  /** Mark a step as complete */
  markStepComplete: (stepKey: string, data?: Record<string, unknown>) => Promise<boolean>;
  /** Mark multiple steps as complete */
  markStepsComplete: (stepKeys: string[]) => Promise<boolean>;
  /** Reset onboarding progress */
  resetOnboarding: () => Promise<boolean>;
  /** Get the next incomplete step from a list */
  getNextIncompleteStep: (stepKeys: string[]) => string | null;
  /** Get completion percentage */
  getCompletionPercentage: (totalSteps: string[]) => number;
  /** Refresh progress from server */
  refresh: () => Promise<void>;
  /** Whether onboarding is complete */
  isOnboardingComplete: boolean;
}

// ============================================
// LOCAL STORAGE HELPERS
// ============================================

const STORAGE_KEY = "onboarding_progress";

function getLocalProgress(): Set<string> {
  if (typeof window === "undefined") return new Set();

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return new Set(parsed.completedSteps || []);
    }
  } catch (error) {
    console.error("Error reading onboarding progress from localStorage:", error);
  }
  return new Set();
}

function setLocalProgress(completedSteps: Set<string>): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        completedSteps: Array.from(completedSteps),
        updatedAt: new Date().toISOString(),
      })
    );
  } catch (error) {
    console.error("Error saving onboarding progress to localStorage:", error);
  }
}

function clearLocalProgress(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Error clearing onboarding progress from localStorage:", error);
  }
}

// ============================================
// HOOK IMPLEMENTATION
// ============================================

export function useOnboarding(
  options: UseOnboardingOptions = {}
): UseOnboardingReturn {
  const { autoFetch = true, useLocalStorage = true } = options;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);

  const isMountedRef = useRef(true);

  // ============================================
  // FETCH PROGRESS
  // ============================================

  const fetchProgress = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/onboarding");

      if (!response.ok) {
        // Fall back to local storage if API fails
        if (useLocalStorage) {
          const localSteps = getLocalProgress();
          if (isMountedRef.current) {
            setCompletedSteps(localSteps);
          }
        }
        throw new Error("Failed to fetch onboarding progress");
      }

      const data = await response.json();

      if (isMountedRef.current) {
        const steps = new Set<string>(data.completedSteps || []);
        setCompletedSteps(steps);
        setIsOnboardingComplete(data.isComplete || false);

        // Sync to local storage
        if (useLocalStorage) {
          setLocalProgress(steps);
        }
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : "Unknown error");

        // Try local storage fallback
        if (useLocalStorage) {
          const localSteps = getLocalProgress();
          setCompletedSteps(localSteps);
        }
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [useLocalStorage]);

  // ============================================
  // MARK STEP COMPLETE
  // ============================================

  const markStepComplete = useCallback(
    async (stepKey: string, data?: Record<string, unknown>): Promise<boolean> => {
      try {
        // Optimistic update
        setCompletedSteps((prev) => {
          const newSet = new Set(prev);
          newSet.add(stepKey);
          if (useLocalStorage) {
            setLocalProgress(newSet);
          }
          return newSet;
        });

        const response = await fetch("/api/onboarding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stepKey, data }),
        });

        if (!response.ok) {
          throw new Error("Failed to mark step complete");
        }

        const result = await response.json();

        if (result.isComplete) {
          setIsOnboardingComplete(true);
        }

        return true;
      } catch (err) {
        console.error("Error marking step complete:", err);
        // Keep the optimistic update even if API fails
        // The next refresh will sync the state
        return false;
      }
    },
    [useLocalStorage]
  );

  // ============================================
  // MARK MULTIPLE STEPS COMPLETE
  // ============================================

  const markStepsComplete = useCallback(
    async (stepKeys: string[]): Promise<boolean> => {
      try {
        // Optimistic update
        setCompletedSteps((prev) => {
          const newSet = new Set(prev);
          stepKeys.forEach((key) => newSet.add(key));
          if (useLocalStorage) {
            setLocalProgress(newSet);
          }
          return newSet;
        });

        // Mark each step individually (could be optimized with batch API)
        const results = await Promise.all(
          stepKeys.map((key) =>
            fetch("/api/onboarding", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ stepKey: key }),
            })
          )
        );

        return results.every((r) => r.ok);
      } catch (err) {
        console.error("Error marking steps complete:", err);
        return false;
      }
    },
    [useLocalStorage]
  );

  // ============================================
  // RESET ONBOARDING
  // ============================================

  const resetOnboarding = useCallback(async (): Promise<boolean> => {
    try {
      setCompletedSteps(new Set());
      setIsOnboardingComplete(false);

      if (useLocalStorage) {
        clearLocalProgress();
      }

      const response = await fetch("/api/onboarding", {
        method: "DELETE",
      });

      return response.ok;
    } catch (err) {
      console.error("Error resetting onboarding:", err);
      return false;
    }
  }, [useLocalStorage]);

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  const isStepComplete = useCallback(
    (stepKey: string): boolean => {
      return completedSteps.has(stepKey);
    },
    [completedSteps]
  );

  const getNextIncompleteStep = useCallback(
    (stepKeys: string[]): string | null => {
      for (const key of stepKeys) {
        if (!completedSteps.has(key)) {
          return key;
        }
      }
      return null;
    },
    [completedSteps]
  );

  const getCompletionPercentage = useCallback(
    (totalSteps: string[]): number => {
      if (totalSteps.length === 0) return 100;
      const completed = totalSteps.filter((key) => completedSteps.has(key)).length;
      return Math.round((completed / totalSteps.length) * 100);
    },
    [completedSteps]
  );

  const refresh = useCallback(async () => {
    await fetchProgress();
  }, [fetchProgress]);

  // ============================================
  // EFFECTS
  // ============================================

  // Initial fetch
  useEffect(() => {
    isMountedRef.current = true;

    // Load from local storage immediately for faster UX
    if (useLocalStorage) {
      const localSteps = getLocalProgress();
      setCompletedSteps(localSteps);
    }

    // Then fetch from server
    if (autoFetch) {
      fetchProgress();
    } else {
      setIsLoading(false);
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [autoFetch, fetchProgress, useLocalStorage]);

  return {
    isLoading,
    error,
    completedSteps,
    isStepComplete,
    markStepComplete,
    markStepsComplete,
    resetOnboarding,
    getNextIncompleteStep,
    getCompletionPercentage,
    refresh,
    isOnboardingComplete,
  };
}

// ============================================
// PREDEFINED STEP KEYS
// ============================================

export const AGENCY_ONBOARDING_STEPS = [
  "agency_setup",
  "invite_team",
  "create_creator",
  "create_request",
  "dashboard_tour",
  "agency_onboarding_complete",
] as const;

export const CREATOR_ONBOARDING_STEPS = [
  "creator_profile",
  "upload_preferences",
  "notification_preferences",
  "portal_tour",
  "creator_onboarding_complete",
] as const;

export const FEATURE_TOUR_STEPS = {
  dashboard: [
    "tour_sidebar",
    "tour_stats",
    "tour_requests",
    "tour_uploads",
    "tour_settings",
  ],
  requests: [
    "tour_create_request",
    "tour_request_list",
    "tour_request_filters",
    "tour_request_detail",
  ],
  creators: [
    "tour_add_creator",
    "tour_creator_list",
    "tour_invite_creator",
    "tour_creator_detail",
  ],
  uploads: [
    "tour_upload_list",
    "tour_upload_review",
    "tour_bulk_actions",
    "tour_download",
  ],
} as const;

export default useOnboarding;
