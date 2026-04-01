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
      badge: "h-5 text-[10px] px-1.5 gap-0.5",
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
                        "h-5 text-[10px] px-1.5",
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

// Pre-configured status badge options
export const STATUS_BADGE_OPTIONS: BadgeOption[] = [
  {
    value: "DRAFT",
    label: "Draft",
    className: "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900/30 dark:text-slate-400 dark:border-slate-800",
  },
  {
    value: "PENDING",
    label: "Pending",
    className: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800",
  },
  {
    value: "IN_PROGRESS",
    label: "In Progress",
    className: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
  },
  {
    value: "SUBMITTED",
    label: "Submitted",
    className: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800",
  },
  {
    value: "UNDER_REVIEW",
    label: "Under Review",
    className: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800",
  },
  {
    value: "NEEDS_REVISION",
    label: "Needs Revision",
    className: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
  },
  {
    value: "APPROVED",
    label: "Approved",
    className: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
  },
  {
    value: "CANCELLED",
    label: "Cancelled",
    className: "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/30 dark:text-gray-400 dark:border-gray-800",
  },
  {
    value: "ARCHIVED",
    label: "Archived",
    className: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-900/30 dark:text-gray-500 dark:border-gray-800",
  },
];

// Pre-configured priority badge options
export const PRIORITY_BADGE_OPTIONS: BadgeOption[] = [
  {
    value: "LOW",
    label: "Low",
    className: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700",
  },
  {
    value: "NORMAL",
    label: "Normal",
    className: "bg-blue-100 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
  },
  {
    value: "HIGH",
    label: "High",
    className: "bg-orange-100 text-orange-600 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800",
  },
  {
    value: "URGENT",
    label: "Urgent",
    className: "bg-red-100 text-red-600 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
  },
];

export default EditableBadge;
