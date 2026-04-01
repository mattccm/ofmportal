"use client";

import * as React from "react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  useGuidedTour,
  type TourConfig,
  type TourStep,
  DASHBOARD_TOUR_STEPS,
  REQUESTS_TOUR_STEPS,
  ANALYTICS_TOUR_STEPS,
  createTourConfig,
} from "@/hooks/use-guided-tour";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  Sparkles,
  HelpCircle,
  RotateCcw,
} from "lucide-react";

// ============================================
// TYPES
// ============================================

export type TooltipPosition = "top" | "bottom" | "left" | "right" | "center";

export interface GuidedTourProps {
  /** Tour configuration */
  config: TourConfig;
  /** Custom class for the overlay */
  overlayClassName?: string;
  /** Custom class for the tooltip */
  tooltipClassName?: string;
  /** Render prop for custom tooltip content */
  renderContent?: (props: {
    step: TourStep;
    stepIndex: number;
    totalSteps: number;
    onNext: () => void;
    onPrev: () => void;
    onSkip: () => void;
    onComplete: () => void;
  }) => React.ReactNode;
}

interface SpotlightOverlayProps {
  targetRect: DOMRect | null;
  padding: number;
  onClick?: () => void;
  className?: string;
}

interface TourTooltipProps {
  step: TourStep;
  stepIndex: number;
  totalSteps: number;
  targetRect: DOMRect | null;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onComplete: () => void;
  isLastStep: boolean;
  className?: string;
}

// ============================================
// SPOTLIGHT OVERLAY
// ============================================

function SpotlightOverlay({
  targetRect,
  padding,
  onClick,
  className,
}: SpotlightOverlayProps) {
  if (!targetRect) {
    return (
      <div
        className={cn(
          "fixed inset-0 z-[9998] bg-black/60 transition-opacity duration-300",
          className
        )}
        onClick={onClick}
      />
    );
  }

  const spotlightX = targetRect.left - padding;
  const spotlightY = targetRect.top - padding;
  const spotlightWidth = targetRect.width + padding * 2;
  const spotlightHeight = targetRect.height + padding * 2;
  const radius = Math.max(spotlightWidth, spotlightHeight);

  return (
    <div
      className={cn(
        "fixed inset-0 z-[9998] transition-opacity duration-300",
        className
      )}
      onClick={onClick}
      style={{
        background: `
          radial-gradient(
            ellipse ${radius}px ${radius}px at ${spotlightX + spotlightWidth / 2}px ${
          spotlightY + spotlightHeight / 2
        }px,
            transparent 0%,
            transparent ${Math.min(spotlightWidth, spotlightHeight) / 2}px,
            rgba(0, 0, 0, 0.75) ${radius}px
          )
        `,
      }}
    >
      {/* Spotlight border effect */}
      <div
        className="absolute transition-all duration-300 pointer-events-none rounded-xl"
        style={{
          left: spotlightX,
          top: spotlightY,
          width: spotlightWidth,
          height: spotlightHeight,
          boxShadow: `
            0 0 0 2px rgba(99, 102, 241, 0.6),
            0 0 0 4px rgba(99, 102, 241, 0.3),
            0 0 30px rgba(99, 102, 241, 0.4),
            inset 0 0 20px rgba(99, 102, 241, 0.1)
          `,
        }}
      />
    </div>
  );
}

// ============================================
// STEP INDICATOR
// ============================================

interface StepIndicatorProps {
  current: number;
  total: number;
  className?: string;
}

function StepIndicator({ current, total, className }: StepIndicatorProps) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {Array.from({ length: total }).map((_, index) => (
        <div
          key={index}
          className={cn(
            "h-1.5 rounded-full transition-all duration-300",
            index === current
              ? "w-6 bg-primary"
              : index < current
              ? "w-1.5 bg-primary/70"
              : "w-1.5 bg-white/30"
          )}
        />
      ))}
    </div>
  );
}

// ============================================
// TOUR TOOLTIP
// ============================================

function TourTooltip({
  step,
  stepIndex,
  totalSteps,
  targetRect,
  onNext,
  onPrev,
  onSkip,
  onComplete,
  isLastStep,
  className,
}: TourTooltipProps) {
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [arrowStyle, setArrowStyle] = useState<React.CSSProperties>({});
  const [arrowPosition, setArrowPosition] = useState<"top" | "bottom" | "left" | "right">("bottom");
  const tooltipRef = React.useRef<HTMLDivElement>(null);

  // Calculate tooltip position
  useEffect(() => {
    if (!tooltipRef.current) return;

    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const gap = 16;

    let top = 0;
    let left = 0;
    let position = step.position || "bottom";
    let finalArrowPosition: "top" | "bottom" | "left" | "right" = "top";

    if (!targetRect || position === "center") {
      // Center in viewport
      top = (viewportHeight - tooltipRect.height) / 2;
      left = (viewportWidth - tooltipRect.width) / 2;
      setArrowStyle({ display: "none" });
      setTooltipStyle({ top: `${top}px`, left: `${left}px` });
      return;
    }

    const calculatePosition = (pos: TooltipPosition) => {
      switch (pos) {
        case "top":
          top = targetRect.top - tooltipRect.height - gap;
          left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
          finalArrowPosition = "bottom";
          break;
        case "bottom":
          top = targetRect.bottom + gap;
          left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
          finalArrowPosition = "top";
          break;
        case "left":
          top = targetRect.top + targetRect.height / 2 - tooltipRect.height / 2;
          left = targetRect.left - tooltipRect.width - gap;
          finalArrowPosition = "right";
          break;
        case "right":
          top = targetRect.right + gap;
          left = targetRect.right + gap;
          finalArrowPosition = "left";
          break;
      }
      return { top, left };
    };

    calculatePosition(position);

    // Check if fits in viewport and adjust
    const fitsInViewport = (t: number, l: number) => {
      return (
        t >= 10 &&
        l >= 10 &&
        t + tooltipRect.height <= viewportHeight - 10 &&
        l + tooltipRect.width <= viewportWidth - 10
      );
    };

    if (!fitsInViewport(top, left)) {
      const alternatives: TooltipPosition[] = ["bottom", "top", "right", "left"];
      for (const alt of alternatives) {
        if (alt === position) continue;
        const altPos = calculatePosition(alt);
        if (fitsInViewport(altPos.top, altPos.left)) {
          top = altPos.top;
          left = altPos.left;
          break;
        }
      }
    }

    // Clamp to viewport bounds
    top = Math.max(10, Math.min(top, viewportHeight - tooltipRect.height - 10));
    left = Math.max(10, Math.min(left, viewportWidth - tooltipRect.width - 10));

    setArrowPosition(finalArrowPosition);
    setTooltipStyle({ top: `${top}px`, left: `${left}px` });

    // Calculate arrow position
    const arrowStyles: React.CSSProperties = {};
    if (targetRect) {
      const arrowPos = finalArrowPosition as "top" | "bottom" | "left" | "right";
      if (arrowPos === "top") {
        arrowStyles.top = "-8px";
        arrowStyles.left = "50%";
        arrowStyles.transform = "translateX(-50%) rotate(180deg)";
      } else if (arrowPos === "bottom") {
        arrowStyles.bottom = "-8px";
        arrowStyles.left = "50%";
        arrowStyles.transform = "translateX(-50%)";
      } else if (arrowPos === "left") {
        arrowStyles.left = "-8px";
        arrowStyles.top = "50%";
        arrowStyles.transform = "translateY(-50%) rotate(90deg)";
      } else if (arrowPos === "right") {
        arrowStyles.right = "-8px";
        arrowStyles.top = "50%";
        arrowStyles.transform = "translateY(-50%) rotate(-90deg)";
      }
    }
    setArrowStyle(arrowStyles);
  }, [targetRect, step.position]);

  return (
    <div
      ref={tooltipRef}
      className={cn(
        "fixed z-[9999] w-[360px] max-w-[calc(100vw-20px)]",
        "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900",
        "border border-white/10 rounded-2xl shadow-2xl",
        "animate-in fade-in-0 zoom-in-95 duration-300",
        className
      )}
      style={tooltipStyle}
    >
      {/* Arrow */}
      <div
        className="absolute text-slate-900"
        style={arrowStyle}
      >
        <svg width="16" height="8" viewBox="0 0 16 8" fill="currentColor">
          <path d="M0 8 L8 0 L16 8" />
        </svg>
      </div>

      {/* Header with step indicator */}
      <div className="px-5 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <StepIndicator current={stepIndex} total={totalSteps} />
          <button
            onClick={onSkip}
            className="text-white/50 hover:text-white/80 transition-colors p-1"
            aria-label="Close tour"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 pb-4">
        <div className="flex items-start gap-3 mb-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center shrink-0 shadow-lg shadow-primary/30">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">
              {step.title}
            </h3>
            <p className="text-sm text-white/70 leading-relaxed">
              {step.content}
            </p>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-5 pb-3">
        <Progress
          value={((stepIndex + 1) / totalSteps) * 100}
          className="h-1 bg-white/10"
        />
      </div>

      {/* Actions */}
      <div className="px-5 pb-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            {stepIndex > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onPrev}
                className="text-white/70 hover:text-white hover:bg-white/10"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {step.canSkip !== false && !isLastStep && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onSkip}
                className="text-white/50 hover:text-white hover:bg-white/10"
              >
                Skip Tour
              </Button>
            )}

            {step.action ? (
              <Button
                size="sm"
                onClick={async () => {
                  await step.action?.onClick();
                  if (isLastStep) {
                    onComplete();
                  } else {
                    onNext();
                  }
                }}
                className="bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90 text-white shadow-lg"
              >
                {step.action.label}
                {!isLastStep && <ChevronRight className="h-4 w-4 ml-1" />}
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={isLastStep ? onComplete : onNext}
                className="bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90 text-white shadow-lg"
              >
                {isLastStep ? (
                  <>
                    Got it!
                    <Check className="h-4 w-4 ml-1" />
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Step counter */}
      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2">
        <span className="text-xs text-white/50">
          Step {stepIndex + 1} of {totalSteps}
        </span>
      </div>
    </div>
  );
}

// ============================================
// MAIN GUIDED TOUR COMPONENT
// ============================================

export function GuidedTour({
  config,
  overlayClassName,
  tooltipClassName,
  renderContent,
}: GuidedTourProps) {
  const [mounted, setMounted] = useState(false);
  const tour = useGuidedTour(config);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted || !tour.isActive || !tour.currentStep) {
    return null;
  }

  const isLastStep = tour.currentStepIndex === tour.totalSteps - 1;
  const showSpotlight = tour.currentStep.spotlight !== false && tour.targetRect;

  return createPortal(
    <div className="guided-tour" data-tour-id={config.tourId}>
      {/* Overlay with spotlight */}
      <SpotlightOverlay
        targetRect={showSpotlight ? tour.targetRect : null}
        padding={config.spotlightPadding || 8}
        className={overlayClassName}
      />

      {/* Tooltip */}
      {renderContent ? (
        renderContent({
          step: tour.currentStep,
          stepIndex: tour.currentStepIndex,
          totalSteps: tour.totalSteps,
          onNext: tour.nextStep,
          onPrev: tour.prevStep,
          onSkip: tour.skipTour,
          onComplete: tour.completeTour,
        })
      ) : (
        <TourTooltip
          step={tour.currentStep}
          stepIndex={tour.currentStepIndex}
          totalSteps={tour.totalSteps}
          targetRect={tour.targetRect}
          onNext={tour.nextStep}
          onPrev={tour.prevStep}
          onSkip={tour.skipTour}
          onComplete={tour.completeTour}
          isLastStep={isLastStep}
          className={tooltipClassName}
        />
      )}
    </div>,
    document.body
  );
}

// ============================================
// TOUR TRIGGER BUTTON
// ============================================

export interface TourTriggerProps {
  tourId: string;
  label?: string;
  variant?: "default" | "outline" | "ghost" | "subtle";
  size?: "sm" | "md" | "lg";
  className?: string;
  onClick?: () => void;
}

export function TourTrigger({
  tourId,
  label = "Take a Tour",
  variant = "outline",
  size = "sm",
  className,
  onClick,
}: TourTriggerProps) {
  const sizeClasses = {
    sm: "text-xs px-3 py-1.5",
    md: "text-sm px-4 py-2",
    lg: "text-base px-5 py-2.5",
  };

  const variantClasses = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    outline: "border border-primary/20 text-primary hover:bg-primary/10",
    ghost: "text-muted-foreground hover:text-primary hover:bg-primary/10",
    subtle: "text-muted-foreground/70 hover:text-muted-foreground",
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg font-medium transition-all duration-200",
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      data-tour-trigger={tourId}
    >
      <HelpCircle className="h-4 w-4" />
      {label}
    </button>
  );
}

// ============================================
// RESTART TOUR BUTTON
// ============================================

export interface RestartTourButtonProps {
  onClick: () => void;
  label?: string;
  className?: string;
}

export function RestartTourButton({
  onClick,
  label = "Restart Tour",
  className,
}: RestartTourButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 text-sm text-muted-foreground",
        "hover:text-primary transition-colors duration-200",
        className
      )}
    >
      <RotateCcw className="h-4 w-4" />
      {label}
    </button>
  );
}

// ============================================
// TOUR PROVIDER WITH CONTEXT
// ============================================

interface TourContextValue {
  activeTourId: string | null;
  startTour: (tourId: string) => void;
  endTour: () => void;
  availableTours: string[];
}

const TourContext = React.createContext<TourContextValue | null>(null);

export function useTourContext() {
  const context = React.useContext(TourContext);
  if (!context) {
    throw new Error("useTourContext must be used within a TourProvider");
  }
  return context;
}

interface TourProviderProps {
  children: React.ReactNode;
  tours: Record<string, TourConfig>;
}

export function TourProvider({ children, tours }: TourProviderProps) {
  const [activeTourId, setActiveTourId] = useState<string | null>(null);

  const startTour = useCallback((tourId: string) => {
    if (tours[tourId]) {
      setActiveTourId(tourId);
    }
  }, [tours]);

  const endTour = useCallback(() => {
    setActiveTourId(null);
  }, []);

  const availableTours = useMemo(() => Object.keys(tours), [tours]);

  const activeConfig = activeTourId ? tours[activeTourId] : null;

  return (
    <TourContext.Provider
      value={{ activeTourId, startTour, endTour, availableTours }}
    >
      {children}
      {activeConfig && (
        <GuidedTour
          config={{
            ...activeConfig,
            onComplete: () => {
              activeConfig.onComplete?.();
              endTour();
            },
            onSkip: () => {
              activeConfig.onSkip?.();
              endTour();
            },
          }}
        />
      )}
    </TourContext.Provider>
  );
}

// ============================================
// PRE-CONFIGURED TOURS
// ============================================

export const TOURS = {
  dashboard: createTourConfig("dashboard-tour", DASHBOARD_TOUR_STEPS, {
    autoStart: false,
    persistCompletion: true,
  }),
  requests: createTourConfig("requests-tour", REQUESTS_TOUR_STEPS, {
    autoStart: false,
    persistCompletion: true,
  }),
  analytics: createTourConfig("analytics-tour", ANALYTICS_TOUR_STEPS, {
    autoStart: false,
    persistCompletion: true,
  }),
};

export default GuidedTour;
