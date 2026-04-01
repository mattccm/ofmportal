"use client";

import * as React from "react";
import { useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

// ============================================
// TYPES
// ============================================

export interface TutorialStep {
  id: string;
  target?: string;
  title: string;
  content: string;
  position?: "top" | "bottom" | "left" | "right" | "bottom-right" | "bottom-left" | "top-right" | "top-left";
  spotlight?: boolean;
}

interface TutorialOverlayProps {
  steps: TutorialStep[];
  isActive: boolean;
  onComplete?: () => void;
  onSkip?: () => void;
  showDontShowAgain?: boolean;
  storageKey?: string;
  className?: string;
}

// ============================================
// TUTORIAL OVERLAY COMPONENT
// ============================================

export function TutorialOverlay({
  steps,
  isActive,
  onComplete,
  onSkip,
  showDontShowAgain = false,
  storageKey,
  className,
}: TutorialOverlayProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  // Check if tutorial was previously dismissed
  useEffect(() => {
    if (storageKey) {
      const dismissed = localStorage.getItem(`${storageKey}-dismissed`);
      if (dismissed === "true") {
        onSkip?.();
      }
    }
  }, [storageKey, onSkip]);

  const handleNext = useCallback(() => {
    if (currentStep === steps.length - 1) {
      if (dontShowAgain && storageKey) {
        localStorage.setItem(`${storageKey}-dismissed`, "true");
      }
      onComplete?.();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  }, [currentStep, steps.length, dontShowAgain, storageKey, onComplete]);

  const handlePrev = useCallback(() => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  }, []);

  const handleSkip = useCallback(() => {
    if (dontShowAgain && storageKey) {
      localStorage.setItem(`${storageKey}-dismissed`, "true");
    }
    onSkip?.();
  }, [dontShowAgain, storageKey, onSkip]);

  if (!isActive || steps.length === 0) {
    return null;
  }

  const step = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  return (
    <div className={cn("fixed inset-0 z-50", className)}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={handleSkip} />

      {/* Tutorial Card */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <Card className="relative w-full max-w-md animate-fade-in">
          {/* Close button */}
          <button
            onClick={handleSkip}
            className="absolute top-2 right-2 p-1 rounded-full hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          <CardContent className="pt-6 space-y-4">
            {/* Step indicator */}
            <div className="flex justify-center gap-1">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className={cn(
                    "h-1.5 w-6 rounded-full transition-all",
                    index === currentStep ? "bg-primary" : "bg-muted"
                  )}
                />
              ))}
            </div>

            {/* Step content */}
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.content}</p>
            </div>

            {/* Don't show again checkbox */}
            {showDontShowAgain && (
              <div className="flex items-center justify-center gap-2">
                <Checkbox
                  id="dontShowAgain"
                  checked={dontShowAgain}
                  onCheckedChange={(checked) =>
                    setDontShowAgain(checked as boolean)
                  }
                />
                <Label
                  htmlFor="dontShowAgain"
                  className="text-sm text-muted-foreground cursor-pointer"
                >
                  Don&apos;t show this again
                </Label>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between pt-2">
              <div>
                {!isFirstStep && (
                  <Button variant="ghost" size="sm" onClick={handlePrev}>
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Back
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={handleSkip}>
                  Skip
                </Button>
                <Button size="sm" onClick={handleNext}>
                  {isLastStep ? "Done" : "Next"}
                  {!isLastStep && <ChevronRight className="h-4 w-4 ml-1" />}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
