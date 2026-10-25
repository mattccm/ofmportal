"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { BRAND } from "@/lib/brand";

// TYPES

export interface TourStep {
  /** Unique identifier for the step */
  id: string;
  /** CSS selector for the target element */
  target: string;
  /** Title of the step */
  title: string;
  /** Description/content of the step */
  content: string;
  /** Preferred position of the tooltip */
  position?: "top" | "bottom" | "left" | "right" | "center";
  /** Whether to highlight (spotlight) the element */
  spotlight?: boolean;
  /** Additional action to perform when step is shown */
  onShow?: () => void;
  /** Additional action to perform when step is hidden */
  onHide?: () => void;
  /** Whether this step can be skipped */
  canSkip?: boolean;
  /** Custom action button text and callback */
  action?: {
    label: string;
    onClick: () => void | Promise<void>;
  };
  /** Wait for condition before showing step */
  waitFor?: () => boolean;
}

export interface TourConfig {
  /** Unique identifier for the tour */
  tourId: string;
  /** Array of tour steps */
  steps: TourStep[];
  /** Whether to persist completion to localStorage */
  persistCompletion?: boolean;
  /** Whether to auto-start if not completed */
  autoStart?: boolean;
  /** Delay before auto-starting (ms) */
  autoStartDelay?: number;
  /** Callback when tour is completed */
  onComplete?: () => void;
  /** Callback when tour is skipped */
  onSkip?: () => void;
  /** Callback when step changes */
  onStepChange?: (stepIndex: number, step: TourStep) => void;
  /** Whether to allow keyboard navigation */
  enableKeyboardNav?: boolean;
  /** Custom spotlight padding */
  spotlightPadding?: number;
}

export interface UseGuidedTourReturn {
  /** Whether the tour is currently active */
  isActive: boolean;
  /** Whether the tour has been completed */
  isCompleted: boolean;
  /** Current step index */
  currentStepIndex: number;
  /** Current step data */
  currentStep: TourStep | null;
  /** Total number of steps */
  totalSteps: number;
  /** Progress percentage (0-100) */
  progress: number;
  /** Target element's bounding rect */
  targetRect: DOMRect | null;
  /** Start the tour */
  startTour: () => void;
  /** End/close the tour */
  endTour: () => void;
  /** Go to next step */
  nextStep: () => void;
  /** Go to previous step */
  prevStep: () => void;
  /** Go to specific step */
  goToStep: (index: number) => void;
  /** Skip the tour */
  skipTour: () => void;
  /** Complete the tour */
  completeTour: () => void;
  /** Reset tour progress */
  resetTour: () => void;
  /** Check if element is visible in viewport */
  isTargetVisible: boolean;
}

// LOCAL STORAGE HELPERS

const STORAGE_PREFIX = "guided_tour_";

function getTourStorageKey(tourId: string): string {
  return `${STORAGE_PREFIX}${tourId}`;
}

function getTourCompletion(tourId: string): boolean {
  if (typeof window === "undefined") return false;

  try {
    const stored = localStorage.getItem(getTourStorageKey(tourId));
    if (stored) {
      const data = JSON.parse(stored);
      return data.completed === true;
    }
  } catch (error) {
    console.error("Error reading tour completion from localStorage:", error);
  }
  return false;
}

function setTourCompletion(tourId: string, completed: boolean): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(
      getTourStorageKey(tourId),
      JSON.stringify({
        completed,
        completedAt: completed ? new Date().toISOString() : null,
      })
    );
  } catch (error) {
    console.error("Error saving tour completion to localStorage:", error);
  }
}

function clearTourCompletion(tourId: string): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(getTourStorageKey(tourId));
  } catch (error) {
    console.error("Error clearing tour completion from localStorage:", error);
  }
}

// MAIN HOOK

export function useGuidedTour(config: TourConfig): UseGuidedTourReturn {
  const {
    tourId,
    steps,
    persistCompletion = true,
    autoStart = false,
    autoStartDelay = 1000,
    onComplete,
    onSkip,
    onStepChange,
    enableKeyboardNav = true,
  } = config;

  // State
  const [isActive, setIsActive] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isTargetVisible, setIsTargetVisible] = useState(false);

  // Refs
  const observerRef = useRef<ResizeObserver | null>(null);
  const scrollListenerRef = useRef<(() => void) | null>(null);
  const autoStartTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const waitForIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Derived values
  const currentStep = useMemo(() => {
    return steps[currentStepIndex] || null;
  }, [steps, currentStepIndex]);

  const totalSteps = steps.length;

  const progress = useMemo(() => {
    if (totalSteps === 0) return 0;
    return Math.round(((currentStepIndex + 1) / totalSteps) * 100);
  }, [currentStepIndex, totalSteps]);

  // TARGET ELEMENT TRACKING

  const updateTargetRect = useCallback(() => {
    if (!currentStep) {
      setTargetRect(null);
      setIsTargetVisible(false);
      return;
    }

    const targetElement = document.querySelector(currentStep.target);
    if (targetElement) {
      const rect = targetElement.getBoundingClientRect();
      setTargetRect(rect);

      // Check if element is in viewport
      const isInViewport =
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= window.innerHeight &&
        rect.right <= window.innerWidth;

      setIsTargetVisible(true);

      // Scroll into view if not visible
      if (!isInViewport && isActive) {
        targetElement.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "center",
        });
      }
    } else {
      setTargetRect(null);
      setIsTargetVisible(false);
    }
  }, [currentStep, isActive]);

  // Set up observers when step changes
  useEffect(() => {
    if (!isActive || !currentStep) return;

    // Clean up previous observers
    if (observerRef.current) {
      observerRef.current.disconnect();
    }
    if (scrollListenerRef.current) {
      window.removeEventListener("scroll", scrollListenerRef.current, true);
      window.removeEventListener("resize", scrollListenerRef.current);
    }

    // Check waitFor condition if present
    if (currentStep.waitFor) {
      const checkCondition = () => {
        if (currentStep.waitFor?.()) {
          updateTargetRect();
          if (waitForIntervalRef.current) {
            clearInterval(waitForIntervalRef.current);
            waitForIntervalRef.current = null;
          }
        }
      };

      waitForIntervalRef.current = setInterval(checkCondition, 100);
      checkCondition(); // Check immediately
    } else {
      queueMicrotask(updateTargetRect);
    }

    // Set up resize observer
    const targetElement = document.querySelector(currentStep.target);
    if (targetElement) {
      observerRef.current = new ResizeObserver(() => {
        updateTargetRect();
      });
      observerRef.current.observe(targetElement);
    }

    // Set up scroll/resize listeners
    const handleScrollOrResize = () => {
      updateTargetRect();
    };
    scrollListenerRef.current = handleScrollOrResize;
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    // Call step's onShow callback
    currentStep.onShow?.();

    // Notify step change
    onStepChange?.(currentStepIndex, currentStep);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      if (scrollListenerRef.current) {
        window.removeEventListener("scroll", scrollListenerRef.current, true);
        window.removeEventListener("resize", scrollListenerRef.current);
      }
      if (waitForIntervalRef.current) {
        clearInterval(waitForIntervalRef.current);
      }
      currentStep.onHide?.();
    };
  }, [isActive, currentStep, currentStepIndex, updateTargetRect, onStepChange]);

  // TOUR CONTROL FUNCTIONS

  const startTour = useCallback(() => {
    setCurrentStepIndex(0);
    setIsActive(true);
  }, []);

  const endTour = useCallback(() => {
    setIsActive(false);
    setTargetRect(null);
  }, []);

  const nextStep = useCallback(() => {
    if (currentStepIndex < totalSteps - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    }
  }, [currentStepIndex, totalSteps]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  }, [currentStepIndex]);

  const goToStep = useCallback(
    (index: number) => {
      if (index >= 0 && index < totalSteps) {
        setCurrentStepIndex(index);
      }
    },
    [totalSteps]
  );

  const skipTour = useCallback(() => {
    setIsActive(false);
    setTargetRect(null);
    onSkip?.();
  }, [onSkip]);

  const completeTour = useCallback(() => {
    setIsActive(false);
    setIsCompleted(true);
    setTargetRect(null);

    if (persistCompletion) {
      setTourCompletion(tourId, true);
    }

    onComplete?.();
  }, [tourId, persistCompletion, onComplete]);

  const resetTour = useCallback(() => {
    setIsActive(false);
    setIsCompleted(false);
    setCurrentStepIndex(0);
    setTargetRect(null);

    if (persistCompletion) {
      clearTourCompletion(tourId);
    }
  }, [tourId, persistCompletion]);

  // KEYBOARD NAVIGATION

  useEffect(() => {
    if (!isActive || !enableKeyboardNav) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          skipTour();
          break;
        case "ArrowRight":
        case "Enter":
          if (currentStepIndex < totalSteps - 1) {
            nextStep();
          } else {
            completeTour();
          }
          break;
        case "ArrowLeft":
          if (currentStepIndex > 0) {
            prevStep();
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive, enableKeyboardNav, currentStepIndex, totalSteps, skipTour, nextStep, completeTour, prevStep]);

  // INITIALIZATION

  useEffect(() => {
    // Check completion status on mount
    if (persistCompletion) {
      queueMicrotask(() => {
        const completed = getTourCompletion(tourId);
        setIsCompleted(completed);

        // Auto-start if not completed
        if (autoStart && !completed) {
          autoStartTimeoutRef.current = setTimeout(() => {
            startTour();
          }, autoStartDelay);
        }
      });
    } else if (autoStart) {
      autoStartTimeoutRef.current = setTimeout(() => {
        startTour();
      }, autoStartDelay);
    }

    return () => {
      if (autoStartTimeoutRef.current) {
        clearTimeout(autoStartTimeoutRef.current);
      }
    };
  }, [tourId, persistCompletion, autoStart, autoStartDelay, startTour]);

  return {
    isActive,
    isCompleted,
    currentStepIndex,
    currentStep,
    totalSteps,
    progress,
    targetRect,
    startTour,
    endTour,
    nextStep,
    prevStep,
    goToStep,
    skipTour,
    completeTour,
    resetTour,
    isTargetVisible,
  };
}

// PREDEFINED TOUR CONFIGURATIONS

// NOTE: Every step below targets a real element that is rendered on the
// staff dashboard (see the matching data-tour attributes in
// components/overview/overview-wall.tsx and layout/sidebar.tsx). Do not add a step here
// unless a node with the corresponding data-tour selector actually exists,
// otherwise the spotlight falls back to a centered tooltip with no target.
export const DASHBOARD_TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    target: "[data-tour='dashboard-header']",
    title: `Welcome to ${BRAND.productName}!`,
    content: "The Overview tells you what needs you today: what is ready to review and what is late. Here is a quick tour.",
    position: "bottom",
    spotlight: false,
  },
  {
    id: "widgets",
    target: "[data-tour='dashboard-widgets']",
    title: "Your requests, shelf by shelf",
    content: "Each request sits on one shelf: ready to review, due this week, or waiting on its creator. Click a title (or press Space) to open it in place, click again or press Enter to go to it. Upload previews stay hidden until you press and hold one.",
    position: "top",
    spotlight: true,
  },
  {
    id: "sidebar",
    target: "[data-tour='sidebar-nav']",
    title: "Navigation",
    content: "Access every section from the sidebar: Creators, Requests, Uploads, Templates, Messages, and more.",
    position: "right",
    spotlight: true,
  },
];

export const REQUESTS_TOUR_STEPS: TourStep[] = [
  {
    id: "request-list",
    target: "[data-tour='requests-list']",
    title: "Your Requests",
    content: "All your content requests are listed here. Filter by status, priority, or creator to find what you need.",
    position: "right",
    spotlight: true,
  },
  {
    id: "create-request",
    target: "[data-tour='create-request-btn']",
    title: "Create a Request",
    content: "Click here to create a new content request. You can use templates to save time.",
    position: "bottom",
    spotlight: true,
  },
  {
    id: "filters",
    target: "[data-tour='request-filters']",
    title: "Filter & Search",
    content: "Use filters to narrow down your view. Search by title, creator, or any keyword.",
    position: "bottom",
    spotlight: true,
  },
];

export const ANALYTICS_TOUR_STEPS: TourStep[] = [
  {
    id: "overview",
    target: "[data-tour='analytics-overview']",
    title: "Analytics Overview",
    content: "See your key performance metrics at a glance. Compare with previous periods to track growth.",
    position: "bottom",
    spotlight: true,
  },
  {
    id: "charts",
    target: "[data-tour='analytics-charts']",
    title: "Visual Insights",
    content: "Charts show trends over time. Hover for details, click for drill-down views.",
    position: "top",
    spotlight: true,
  },
  {
    id: "date-range",
    target: "[data-tour='date-range-selector']",
    title: "Date Range",
    content: "Adjust the date range to analyze different time periods.",
    position: "bottom",
    spotlight: true,
  },
];

// TOUR FACTORY

export function createTourConfig(
  tourId: string,
  steps: TourStep[],
  options?: Partial<Omit<TourConfig, "tourId" | "steps">>
): TourConfig {
  return {
    tourId,
    steps,
    persistCompletion: true,
    autoStart: false,
    autoStartDelay: 1000,
    enableKeyboardNav: true,
    spotlightPadding: 8,
    ...options,
  };
}

export default useGuidedTour;
