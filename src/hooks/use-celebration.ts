"use client";

import { useState, useCallback, useEffect } from "react";
import {
  type CelebrationConfig,
  type CelebrationTemplate,
  CELEBRATION_TEMPLATES,
} from "@/components/celebrations/celebration-modal";

const STORAGE_KEY = "uploadportal-celebrations-shown";

interface CelebrationState {
  /** Currently active celebration */
  activeCelebration: CelebrationConfig | null;
  /** Whether the celebration modal is open */
  isOpen: boolean;
  /** Set of celebration IDs that have been shown */
  shownCelebrations: Set<string>;
}

interface UseCelebrationOptions {
  /** Whether to persist shown celebrations to localStorage */
  persist?: boolean;
  /** Maximum number of celebrations to show per session */
  maxPerSession?: number;
  /** Cooldown between celebrations in milliseconds */
  cooldownMs?: number;
}

interface UseCelebrationReturn {
  /** Current celebration state */
  state: CelebrationState;
  /** Trigger a celebration by template name */
  celebrate: (
    template: CelebrationTemplate,
    overrides?: Partial<CelebrationConfig>
  ) => boolean;
  /** Trigger a custom celebration */
  celebrateCustom: (config: CelebrationConfig) => boolean;
  /** Close the current celebration */
  closeCelebration: () => void;
  /** Check if a celebration has been shown */
  hasShown: (celebrationId: string) => boolean;
  /** Reset all shown celebrations */
  resetShownCelebrations: () => void;
  /** Clear a specific celebration from shown list */
  clearShownCelebration: (celebrationId: string) => void;
}

export function useCelebration(
  options: UseCelebrationOptions = {}
): UseCelebrationReturn {
  const { persist = true, maxPerSession = 5, cooldownMs = 2000 } = options;

  const [state, setState] = useState<CelebrationState>(() => ({
    activeCelebration: null,
    isOpen: false,
    shownCelebrations: new Set(),
  }));

  const [sessionCount, setSessionCount] = useState(0);
  const [lastCelebrationTime, setLastCelebrationTime] = useState(0);

  // Load persisted shown celebrations on mount
  useEffect(() => {
    if (!persist) return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as string[];
        setState((prev) => ({
          ...prev,
          shownCelebrations: new Set(parsed),
        }));
      }
    } catch (error) {
      console.warn("Failed to load celebration history:", error);
    }
  }, [persist]);

  // Persist shown celebrations when they change
  useEffect(() => {
    if (!persist) return;

    try {
      const toStore = Array.from(state.shownCelebrations);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
    } catch (error) {
      console.warn("Failed to save celebration history:", error);
    }
  }, [state.shownCelebrations, persist]);

  const hasShown = useCallback(
    (celebrationId: string): boolean => {
      return state.shownCelebrations.has(celebrationId);
    },
    [state.shownCelebrations]
  );

  const canShowCelebration = useCallback((): boolean => {
    // Check session limit
    if (sessionCount >= maxPerSession) {
      return false;
    }

    // Check cooldown
    const now = Date.now();
    if (now - lastCelebrationTime < cooldownMs) {
      return false;
    }

    // Check if another celebration is active
    if (state.isOpen) {
      return false;
    }

    return true;
  }, [sessionCount, maxPerSession, lastCelebrationTime, cooldownMs, state.isOpen]);

  const triggerCelebration = useCallback(
    (config: CelebrationConfig, force = false): boolean => {
      // Don't show if already shown (unless forced)
      if (!force && hasShown(config.id)) {
        return false;
      }

      // Check if we can show a celebration
      if (!force && !canShowCelebration()) {
        return false;
      }

      // Mark as shown
      setState((prev) => {
        const newShown = new Set(Array.from(prev.shownCelebrations));
        newShown.add(config.id);
        return {
          ...prev,
          activeCelebration: config,
          isOpen: true,
          shownCelebrations: newShown,
        };
      });

      setSessionCount((prev) => prev + 1);
      setLastCelebrationTime(Date.now());

      return true;
    },
    [hasShown, canShowCelebration]
  );

  const celebrate = useCallback(
    (
      template: CelebrationTemplate,
      overrides?: Partial<CelebrationConfig>
    ): boolean => {
      const templateConfig = CELEBRATION_TEMPLATES[template];
      if (!templateConfig) {
        console.warn(`Unknown celebration template: ${template}`);
        return false;
      }

      const config: CelebrationConfig = {
        ...templateConfig,
        ...overrides,
      };

      return triggerCelebration(config);
    },
    [triggerCelebration]
  );

  const celebrateCustom = useCallback(
    (config: CelebrationConfig): boolean => {
      return triggerCelebration(config);
    },
    [triggerCelebration]
  );

  const closeCelebration = useCallback(() => {
    setState((prev) => ({
      ...prev,
      activeCelebration: null,
      isOpen: false,
    }));
  }, []);

  const resetShownCelebrations = useCallback(() => {
    setState((prev) => ({
      ...prev,
      shownCelebrations: new Set(),
    }));
    setSessionCount(0);

    if (persist) {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        console.warn("Failed to clear celebration history:", error);
      }
    }
  }, [persist]);

  const clearShownCelebration = useCallback(
    (celebrationId: string) => {
      setState((prev) => {
        const newShown = new Set(prev.shownCelebrations);
        newShown.delete(celebrationId);
        return {
          ...prev,
          shownCelebrations: newShown,
        };
      });
    },
    []
  );

  return {
    state,
    celebrate,
    celebrateCustom,
    closeCelebration,
    hasShown,
    resetShownCelebrations,
    clearShownCelebration,
  };
}

// Helper hook for tracking milestone achievements
export function useMilestoneTracker() {
  const celebration = useCelebration();

  const checkUploadMilestone = useCallback(
    (uploadCount: number, onActionCallback?: () => void): void => {
      if (uploadCount === 10) {
        celebration.celebrate("milestone10Uploads", {
          onAction: onActionCallback,
        });
      } else if (uploadCount === 50) {
        celebration.celebrate("milestone50Uploads", {
          onAction: onActionCallback,
        });
      } else if (uploadCount === 100) {
        celebration.celebrate("milestone100Uploads", {
          onAction: onActionCallback,
        });
      }
    },
    [celebration]
  );

  const checkFirstCreatorInvited = useCallback(
    (creatorCount: number, onActionCallback?: () => void): void => {
      if (creatorCount === 1) {
        celebration.celebrate("firstCreatorInvited", {
          onAction: onActionCallback,
        });
      }
    },
    [celebration]
  );

  const checkFirstRequestCompleted = useCallback(
    (completedCount: number): void => {
      if (completedCount === 1) {
        celebration.celebrate("firstRequestCompleted");
      }
    },
    [celebration]
  );

  const checkPerfectDay = useCallback(
    (completionRate: number): void => {
      if (completionRate === 100) {
        celebration.celebrate("perfectDay");
      }
    },
    [celebration]
  );

  const triggerOnboardingComplete = useCallback(
    (onActionCallback?: () => void): void => {
      celebration.celebrate("onboardingComplete", {
        onAction: onActionCallback,
      });
    },
    [celebration]
  );

  return {
    ...celebration,
    checkUploadMilestone,
    checkFirstCreatorInvited,
    checkFirstRequestCompleted,
    checkPerfectDay,
    triggerOnboardingComplete,
  };
}

// Context for app-wide celebration state
export type { CelebrationConfig, CelebrationTemplate };
