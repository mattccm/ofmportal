"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Confetti, CONFETTI_PRESETS, type ConfettiPreset } from "./confetti";
import { SuccessCheckmark, CHECKMARK_COLORS, type CheckmarkColorVariant } from "./success-checkmark";
import { cn } from "@/lib/utils";

export interface CelebrationConfig {
  /** Unique identifier for the celebration */
  id: string;
  /** Main title (e.g., "Congratulations!") */
  title: string;
  /** Achievement description */
  description: string;
  /** Optional secondary message */
  message?: string;
  /** Action button text */
  actionText?: string;
  /** Action button callback */
  onAction?: () => void;
  /** Dismiss button text */
  dismissText?: string;
  /** Confetti intensity */
  confettiPreset?: ConfettiPreset;
  /** Checkmark color variant */
  colorVariant?: CheckmarkColorVariant;
  /** Optional icon to show instead of checkmark */
  icon?: React.ReactNode;
  /** Auto-dismiss after duration (ms), 0 to disable */
  autoDismissDelay?: number;
}

interface CelebrationModalProps {
  /** Celebration configuration */
  celebration: CelebrationConfig | null;
  /** Whether modal is open */
  open: boolean;
  /** Callback when modal closes */
  onClose: () => void;
  /** Additional CSS class for the modal */
  className?: string;
}

export function CelebrationModal({
  celebration,
  open,
  onClose,
  className,
}: CelebrationModalProps) {
  const [showConfetti, setShowConfetti] = useState(false);
  const [showCheckmark, setShowCheckmark] = useState(false);

  useEffect(() => {
    if (open && celebration) {
      // Stagger animations
      const confettiTimer = setTimeout(() => setShowConfetti(true), 100);
      const checkmarkTimer = setTimeout(() => setShowCheckmark(true), 200);

      // Auto-dismiss if configured
      let autoDismissTimer: NodeJS.Timeout | undefined;
      if (celebration.autoDismissDelay && celebration.autoDismissDelay > 0) {
        autoDismissTimer = setTimeout(() => {
          handleClose();
        }, celebration.autoDismissDelay);
      }

      return () => {
        clearTimeout(confettiTimer);
        clearTimeout(checkmarkTimer);
        if (autoDismissTimer) clearTimeout(autoDismissTimer);
      };
    } else {
      setShowConfetti(false);
      setShowCheckmark(false);
    }
  }, [open, celebration]);

  const handleClose = () => {
    setShowConfetti(false);
    setShowCheckmark(false);
    onClose();
  };

  const handleAction = () => {
    celebration?.onAction?.();
    handleClose();
  };

  if (!celebration) return null;

  const confettiConfig = celebration.confettiPreset
    ? CONFETTI_PRESETS[celebration.confettiPreset]
    : CONFETTI_PRESETS.normal;

  const colorConfig = celebration.colorVariant
    ? CHECKMARK_COLORS[celebration.colorVariant]
    : CHECKMARK_COLORS.success;

  return (
    <>
      {/* Confetti layer */}
      <Confetti
        active={showConfetti}
        {...confettiConfig}
        onComplete={() => {
          // Confetti can complete independently
        }}
      />

      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
        <DialogContent
          className={cn(
            "sm:max-w-md text-center overflow-hidden",
            className
          )}
        >
          <div className="flex flex-col items-center py-4">
            {/* Icon or Checkmark */}
            <div className="mb-6">
              {celebration.icon ? (
                <div className="animate-in zoom-in-50 duration-300">
                  {celebration.icon}
                </div>
              ) : (
                <SuccessCheckmark
                  active={showCheckmark}
                  size={100}
                  {...colorConfig}
                  duration={800}
                />
              )}
            </div>

            <DialogHeader className="space-y-3">
              <DialogTitle
                className={cn(
                  "text-2xl font-bold animate-in fade-in-0 slide-in-from-bottom-4 duration-500",
                  "bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent"
                )}
                style={{ animationDelay: "300ms" }}
              >
                {celebration.title}
              </DialogTitle>

              <DialogDescription
                className="text-base animate-in fade-in-0 slide-in-from-bottom-4 duration-500"
                style={{ animationDelay: "400ms" }}
              >
                {celebration.description}
              </DialogDescription>

              {celebration.message && (
                <p
                  className="text-sm text-muted-foreground animate-in fade-in-0 slide-in-from-bottom-4 duration-500"
                  style={{ animationDelay: "500ms" }}
                >
                  {celebration.message}
                </p>
              )}
            </DialogHeader>
          </div>

          <DialogFooter
            className="sm:justify-center gap-2 animate-in fade-in-0 slide-in-from-bottom-4 duration-500"
            style={{ animationDelay: "600ms" }}
          >
            {celebration.onAction && (
              <Button onClick={handleAction} className="min-w-[120px]">
                {celebration.actionText || "Continue"}
              </Button>
            )}
            <Button
              variant={celebration.onAction ? "outline" : "default"}
              onClick={handleClose}
              className="min-w-[120px]"
            >
              {celebration.dismissText || "Got it!"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Pre-built celebration configurations
export const CELEBRATION_TEMPLATES = {
  firstCreatorInvited: {
    id: "first-creator-invited",
    title: "Congratulations!",
    description: "You've invited your first creator!",
    message: "Your collaboration journey begins. Creators will receive an email invitation to join your portal.",
    confettiPreset: "normal" as ConfettiPreset,
    colorVariant: "success" as CheckmarkColorVariant,
    actionText: "Invite More",
    dismissText: "Got it!",
  },
  firstRequestCompleted: {
    id: "first-request-completed",
    title: "First Request Complete!",
    description: "You've received your first completed upload request.",
    message: "Keep the momentum going by creating more requests for your creators.",
    confettiPreset: "normal" as ConfettiPreset,
    colorVariant: "primary" as CheckmarkColorVariant,
    dismissText: "Awesome!",
  },
  perfectDay: {
    id: "perfect-day",
    title: "Perfect Day!",
    description: "100% completion rate today!",
    message: "All your requests were completed on time. Your creators are crushing it!",
    confettiPreset: "intense" as ConfettiPreset,
    colorVariant: "success" as CheckmarkColorVariant,
    dismissText: "Amazing!",
  },
  milestone10Uploads: {
    id: "milestone-10-uploads",
    title: "Milestone Reached!",
    description: "You've received 10 uploads!",
    message: "Your portal is off to a great start. Keep building those creator relationships.",
    confettiPreset: "subtle" as ConfettiPreset,
    colorVariant: "purple" as CheckmarkColorVariant,
    dismissText: "Nice!",
  },
  milestone50Uploads: {
    id: "milestone-50-uploads",
    title: "50 Uploads!",
    description: "Your portal has received 50 uploads!",
    message: "You're building something great. Your creators are engaged and delivering.",
    confettiPreset: "normal" as ConfettiPreset,
    colorVariant: "primary" as CheckmarkColorVariant,
    dismissText: "Fantastic!",
  },
  milestone100Uploads: {
    id: "milestone-100-uploads",
    title: "100 Uploads!",
    description: "You've hit the century mark!",
    message: "100 uploads is a major milestone. You've created a thriving creator ecosystem.",
    confettiPreset: "intense" as ConfettiPreset,
    colorVariant: "success" as CheckmarkColorVariant,
    dismissText: "Incredible!",
  },
  onboardingComplete: {
    id: "onboarding-complete",
    title: "You're All Set!",
    description: "Agency onboarding complete!",
    message: "Your portal is ready to go. Start inviting creators and managing content.",
    confettiPreset: "epic" as ConfettiPreset,
    colorVariant: "success" as CheckmarkColorVariant,
    actionText: "Get Started",
    dismissText: "Explore",
  },
} as const;

export type CelebrationTemplate = keyof typeof CELEBRATION_TEMPLATES;
