"use client";

import * as React from "react";
import { useState, useCallback, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Loader2, ChevronDown, Check } from "lucide-react";
import { FIELD_STATE_ICON, requestStatusState } from "@/components/title-wall/types";

export interface BadgeOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  description?: string;
  disabled?: boolean;
  /** CSS classes for the badge styling */
  className?: string;
  /** Background color class */
  bgColor?: string;
  /** Text color class */
  textColor?: string;
  /** Border color class */
  borderColor?: string;
}

export interface EditableBadgeProps {
  /** Current value */
  value: string;
  /** Available options */
  options: BadgeOption[];
  /** Called when value changes */
  onSave: (value: string) => Promise<void> | void;
  /** Whether editing is disabled */
  disabled?: boolean;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Additional class names for the badge */
  className?: string;
  /** ARIA label */
  ariaLabel?: string;
  /** Whether to show dropdown indicator */
  showIndicator?: boolean;
  /** Whether to show check mark for current value */
  showCurrentMark?: boolean;
  /** Badge variant */
  variant?: "default" | "secondary" | "destructive" | "outline";
  /** Align the dropdown content */
  align?: "start" | "center" | "end";
}

/**
 * Inline editable badge component for status/priority changes
 *
 * Click to show dropdown, immediate save on selection.
 * Supports custom badge styling per option.
 */
export function EditableBadge({
  value,
  options,
  onSave,
  disabled = false,
  size = "md",
  className,
  ariaLabel,
  showIndicator = true,
  showCurrentMark = true,
  variant = "outline",
  align = "start",
}: EditableBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingValue, setPendingValue] = useState<string | null>(null);

  const isMountedRef = useRef(true);

  // Track mounted state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Get current option
  const currentOption = options.find((opt) => opt.value === value);
  const pendingOption = pendingValue
    ? options.find((opt) => opt.value === pendingValue)
    : null;

  // Handle value change
  const handleValueChange = useCallback(
    async (newValue: string) => {
      if (newValue === value || disabled) return;

      setPendingValue(newValue);
      setIsSaving(true);

      try {
        await onSave(newValue);
        if (isMountedRef.current) {
          setPendingValue(null);
        }
      } catch (error) {
        // Revert on error
        if (isMountedRef.current) {
          setPendingValue(null);
        }
        console.error("Failed to save badge value:", error);
      } finally {
        if (isMountedRef.current) {
          setIsSaving(false);
          setIsOpen(false);
        }
      }
    },
    [value, disabled, onSave]
  );

  // Size classes
  const sizeClasses = {
    sm: {
      badge: "h-6 text-[12px] px-2 gap-1",
      icon: "h-2.5 w-2.5",
      dropdown: "text-xs py-1 px-2",
      check: "h-3 w-3",
    },
    md: {
      badge: "h-6 text-xs px-2 gap-1",
      icon: "h-3 w-3",
      dropdown: "text-sm py-1.5 px-2.5",
      check: "h-3.5 w-3.5",
    },
    lg: {
      badge: "h-7 text-sm px-2.5 gap-1.5",
      icon: "h-4 w-4",
      dropdown: "text-sm py-2 px-3",
      check: "h-4 w-4",
    },
  };

  const sizes = sizeClasses[size];

  // Display option
  const displayOption = pendingOption || currentOption;

  // Get badge styling
  const getBadgeClasses = (option: BadgeOption | undefined) => {
    if (!option) return "";
    return cn(
      option.className,
      option.bgColor,
      option.textColor,
      option.borderColor
    );
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger
        disabled={disabled || isSaving}
        className={cn(
          "inline-flex items-center outline-none",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md",
          disabled && "cursor-not-allowed opacity-60",
          isSaving && "cursor-wait"
        )}
        aria-label={ariaLabel || "Change status"}
      >
        <Badge
          variant={variant}
          className={cn(
            sizes.badge,
            "cursor-pointer transition-all duration-200",
            "hover:opacity-80 active:scale-95",
            getBadgeClasses(displayOption),
            isOpen && "ring-2 ring-ring ring-offset-2",
            className
          )}
        >
          {displayOption?.icon}
          <span>{displayOption?.label || value}</span>
          {isSaving ? (
            <Loader2 className={cn(sizes.icon, "animate-spin ml-0.5")} />
          ) : showIndicator ? (
            <ChevronDown
              className={cn(
                sizes.icon,
                "opacity-60 transition-transform ml-0.5",
                isOpen && "rotate-180"
              )}
            />
          ) : null}
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="min-w-[140px]">
        {options.map((option) => {
          const isSelected = option.value === value;
          const isPending = option.value === pendingValue;

          return (
            <DropdownMenuItem
              key={option.value}
              disabled={option.disabled || isSaving}
              className={cn(
                sizes.dropdown,
                "cursor-pointer transition-colors",
                isSelected && "bg-accent",
                isPending && "opacity-70"
              )}
              onClick={() => handleValueChange(option.value)}
            >
              <span className="flex items-center gap-2 flex-1">
                {option.icon}
                <span className="flex flex-col flex-1">
                  <span className="flex items-center gap-2">
                    <Badge
                      variant={variant}
                      className={cn(
                        "h-[22px] text-[12px] px-2",
                        getBadgeClasses(option)
                      )}
                    >
                      {option.label}
                    </Badge>
                  </span>
                  {option.description && (
                    <span className="text-xs text-muted-foreground mt-0.5">
                      {option.description}
                    </span>
                  )}
                </span>
                {showCurrentMark && isSelected && (
                  <Check className={cn(sizes.check, "text-primary ml-2")} />
                )}
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Request status and priority tones on the Title Wall state tokens. Status
 * follows whose turn it is, in the field-state vocabulary: to do (grey
 * outline) while the creator works, ready (blue) when staff have something to
 * review, needs changes (orange) when it went back, approved (green). Each
 * carries its state icon. Priority is neutral until it is urgent (red).
 */
export const STATUS_TONE: Record<string, string> = {
  DRAFT: "border-ctl-hi bg-transparent text-ink-2",
  PENDING: "border-waiting bg-transparent text-ink-2 [&>svg]:text-waiting",
  IN_PROGRESS: "border-waiting bg-transparent text-ink [&>svg]:text-waiting",
  SUBMITTED: "border-ready/30 bg-ready/12 text-ready",
  UNDER_REVIEW: "border-ready/30 bg-ready/12 text-ready",
  NEEDS_REVISION: "border-changes/30 bg-changes/12 text-changes",
  APPROVED: "border-success/30 bg-success/12 text-success",
  CANCELLED: "border-ctl bg-transparent text-ink-2",
  ARCHIVED: "border-ctl bg-transparent text-ink-2",
};

export const PRIORITY_TONE: Record<string, string> = {
  LOW: "border-ctl bg-transparent text-ink-2",
  NORMAL: "border-line bg-tile-hi text-ink-2",
  HIGH: "border-ctl-hi bg-tile-hi text-ink font-semibold",
  URGENT: "border-late/30 bg-late/15 text-late font-semibold",
};

/** A request status's state icon (none for draft, cancelled and archived) */
function statusIcon(status: string): React.ReactNode {
  const state = requestStatusState(status);
  if (!state) return undefined;
  const Icon = FIELD_STATE_ICON[state];
  return <Icon aria-hidden="true" className="size-3 shrink-0" />;
}

// Pre-configured status badge options: the field-state colour, icon and word
export const STATUS_BADGE_OPTIONS: BadgeOption[] = [
  { value: "DRAFT", label: "Draft", className: STATUS_TONE.DRAFT },
  { value: "PENDING", label: "Pending", icon: statusIcon("PENDING"), className: STATUS_TONE.PENDING },
  { value: "IN_PROGRESS", label: "In progress", icon: statusIcon("IN_PROGRESS"), className: STATUS_TONE.IN_PROGRESS },
  { value: "SUBMITTED", label: "Submitted", icon: statusIcon("SUBMITTED"), className: STATUS_TONE.SUBMITTED },
  { value: "UNDER_REVIEW", label: "Under review", icon: statusIcon("UNDER_REVIEW"), className: STATUS_TONE.UNDER_REVIEW },
  { value: "NEEDS_REVISION", label: "Needs changes", icon: statusIcon("NEEDS_REVISION"), className: STATUS_TONE.NEEDS_REVISION },
  { value: "APPROVED", label: "Approved", icon: statusIcon("APPROVED"), className: STATUS_TONE.APPROVED },
  { value: "CANCELLED", label: "Cancelled", className: STATUS_TONE.CANCELLED },
  { value: "ARCHIVED", label: "Archived", className: STATUS_TONE.ARCHIVED },
];

// Pre-configured priority badge options
export const PRIORITY_BADGE_OPTIONS: BadgeOption[] = [
  { value: "LOW", label: "Low", className: PRIORITY_TONE.LOW },
  { value: "NORMAL", label: "Normal", className: PRIORITY_TONE.NORMAL },
  { value: "HIGH", label: "High", className: PRIORITY_TONE.HIGH },
  { value: "URGENT", label: "Urgent", className: PRIORITY_TONE.URGENT },
];

export default EditableBadge;
