"use client";

import * as React from "react";
import { createContext, useContext, useCallback } from "react";
import { CelebrationModal, type CelebrationConfig, type CelebrationTemplate } from "./celebration-modal";
import { useCelebration, useMilestoneTracker } from "@/hooks/use-celebration";

interface CelebrationContextValue {
  /** Trigger a celebration by template name */
  celebrate: (
    template: CelebrationTemplate,
    overrides?: Partial<CelebrationConfig>
  ) => boolean;
  /** Trigger a custom celebration */
  celebrateCustom: (config: CelebrationConfig) => boolean;
  /** Check if a celebration has been shown */
  hasShown: (celebrationId: string) => boolean;
  /** Reset all shown celebrations */
  resetShownCelebrations: () => void;
  /** Clear a specific celebration from shown list */
  clearShownCelebration: (celebrationId: string) => void;
  /** Milestone tracking helpers */
  checkUploadMilestone: (uploadCount: number, onAction?: () => void) => void;
  checkFirstCreatorInvited: (creatorCount: number, onAction?: () => void) => void;
  checkFirstRequestCompleted: (completedCount: number) => void;
  checkPerfectDay: (completionRate: number) => void;
  triggerOnboardingComplete: (onAction?: () => void) => void;
}

const CelebrationContext = createContext<CelebrationContextValue | null>(null);

interface CelebrationProviderProps {
  children: React.ReactNode;
  /** Whether to persist shown celebrations to localStorage */
  persist?: boolean;
  /** Maximum number of celebrations to show per session */
  maxPerSession?: number;
  /** Cooldown between celebrations in milliseconds */
  cooldownMs?: number;
}

export function CelebrationProvider({
  children,
  persist = true,
  maxPerSession = 5,
  cooldownMs = 2000,
}: CelebrationProviderProps) {
  const milestoneTracker = useMilestoneTracker();

  const value: CelebrationContextValue = {
    celebrate: milestoneTracker.celebrate,
    celebrateCustom: milestoneTracker.celebrateCustom,
    hasShown: milestoneTracker.hasShown,
    resetShownCelebrations: milestoneTracker.resetShownCelebrations,
    clearShownCelebration: milestoneTracker.clearShownCelebration,
    checkUploadMilestone: milestoneTracker.checkUploadMilestone,
    checkFirstCreatorInvited: milestoneTracker.checkFirstCreatorInvited,
    checkFirstRequestCompleted: milestoneTracker.checkFirstRequestCompleted,
    checkPerfectDay: milestoneTracker.checkPerfectDay,
    triggerOnboardingComplete: milestoneTracker.triggerOnboardingComplete,
  };

  return (
    <CelebrationContext.Provider value={value}>
      {children}
      <CelebrationModal
        celebration={milestoneTracker.state.activeCelebration}
        open={milestoneTracker.state.isOpen}
        onClose={milestoneTracker.closeCelebration}
      />
    </CelebrationContext.Provider>
  );
}

export function useCelebrationContext(): CelebrationContextValue {
  const context = useContext(CelebrationContext);
  if (!context) {
    throw new Error(
      "useCelebrationContext must be used within a CelebrationProvider"
    );
  }
  return context;
}

// Standalone celebration trigger for use outside React components
// Note: This requires the CelebrationProvider to be mounted
let globalCelebrate: CelebrationContextValue["celebrate"] | null = null;

export function setGlobalCelebrate(
  fn: CelebrationContextValue["celebrate"]
): void {
  globalCelebrate = fn;
}

export function triggerCelebration(
  template: CelebrationTemplate,
  overrides?: Partial<CelebrationConfig>
): boolean {
  if (!globalCelebrate) {
    console.warn(
      "triggerCelebration called but CelebrationProvider is not mounted"
    );
    return false;
  }
  return globalCelebrate(template, overrides);
}
