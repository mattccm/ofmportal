"use client";

import * as React from "react";
import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, Check, X } from "lucide-react";

// ============================================
// TYPES
// ============================================

export interface OnboardingStep {
  id: string;
  title: string;
  description?: string;
  content: React.ReactNode;
  isOptional?: boolean;
  optional?: boolean; // alias for isOptional
  isComplete?: boolean;
  icon?: React.ReactNode;
  validationFn?: () => boolean;
}

interface OnboardingWizardProps {
  steps: OnboardingStep[];
  title?: string;
  subtitle?: string;
  agencyName?: string;
  onComplete?: () => void;
  onSkip?: () => void;
  allowSkip?: boolean;
  showProgress?: boolean;
  onStepComplete?: (stepId: string, index: number) => void;
  className?: string;
}

// ============================================
// ONBOARDING WIZARD COMPONENT
// ============================================

export function OnboardingWizard({
  steps,
  title,
  subtitle,
  onComplete,
  onSkip,
  allowSkip = false,
  showProgress = true,
  onStepComplete,
  className,
}: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const progress = ((currentStep + 1) / steps.length) * 100;
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  const handleNext = useCallback(() => {
    const step = steps[currentStep];

    // Run validation if present
    if (step.validationFn && !step.validationFn()) {
      return;
    }

    if (onStepComplete) {
      onStepComplete(step.id, currentStep);
    }

    if (isLastStep) {
      onComplete?.();
    } else {
      setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
    }
  }, [currentStep, steps, isLastStep, onComplete, onStepComplete]);

  const handlePrev = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleSkip = useCallback(() => {
    onSkip?.();
  }, [onSkip]);

  const currentStepData = steps[currentStep];

  return (
    <Card className={cn("w-full max-w-2xl mx-auto", className)}>
      <CardHeader className="space-y-4">
        {/* Title & Subtitle */}
        {(title || subtitle) && (
          <div className="text-center space-y-2">
            {title && (
              <CardTitle className="text-2xl font-bold">{title}</CardTitle>
            )}
            {subtitle && (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
        )}

        {/* Progress */}
        {showProgress && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Step {currentStep + 1} of {steps.length}</span>
              <span>{Math.round(progress)}% complete</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={cn(
                "h-2 w-2 rounded-full transition-all duration-300",
                index < currentStep
                  ? "bg-primary"
                  : index === currentStep
                  ? "bg-primary w-6"
                  : "bg-muted"
              )}
            />
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Step Title */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            {currentStepData.icon && (
              <span className="text-primary">{currentStepData.icon}</span>
            )}
            <h3 className="text-xl font-semibold">{currentStepData.title}</h3>
          </div>
          {currentStepData.description && (
            <p className="text-sm text-muted-foreground">
              {currentStepData.description}
            </p>
          )}
        </div>

        {/* Step Content */}
        <div className="py-4">{currentStepData.content}</div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div>
            {!isFirstStep && (
              <Button variant="ghost" onClick={handlePrev}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {allowSkip && (
              <Button variant="ghost" onClick={handleSkip}>
                <X className="h-4 w-4 mr-1" />
                Skip
              </Button>
            )}
            <Button onClick={handleNext}>
              {isLastStep ? (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Complete
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
