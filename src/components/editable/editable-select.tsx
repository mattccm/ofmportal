"use client";

import * as React from "react";
import { useState, useCallback, useEffect, useRef } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Loader2, ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  description?: string;
  disabled?: boolean;
}

export interface EditableSelectProps {
  /** Current value */
  value: string;
  /** Available options */
  options: SelectOption[];
  /** Called when value changes */
  onSave: (value: string) => Promise<void> | void;
  /** Placeholder when no value selected */
  placeholder?: string;
  /** Whether editing is disabled */
  disabled?: boolean;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Additional class names */
  className?: string;
  /** Additional class names for the trigger */
  triggerClassName?: string;
  /** Whether to show loading indicator */
  showLoading?: boolean;
  /** Custom display render function */
  renderDisplay?: (option: SelectOption | undefined) => React.ReactNode;
  /** ARIA label */
  ariaLabel?: string;
  /** Input name attribute */
  name?: string;
  /** Whether to show dropdown indicator */
  showIndicator?: boolean;
  /** Align the dropdown content */
  align?: "start" | "center" | "end";
  /** Side of the trigger to render content */
  side?: "top" | "right" | "bottom" | "left";
}

/**
 * Inline editable select component
 *
 * Click to show dropdown, immediate save on selection.
 * Supports loading states and custom option rendering.
 */
export function EditableSelect({
  value,
  options,
  onSave,
  placeholder = "Select...",
  disabled = false,
  size = "md",
  className,
  triggerClassName,
  showLoading = true,
  renderDisplay,
  ariaLabel,
  name,
  showIndicator = true,
  align = "start",
  side = "bottom",
}: EditableSelectProps) {
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
        console.error("Failed to save selection:", error);
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
      trigger: "h-7 text-xs px-2 gap-1",
      icon: "h-3 w-3",
      item: "text-xs py-1",
    },
    md: {
      trigger: "h-9 text-sm px-3 gap-1.5",
      icon: "h-4 w-4",
      item: "text-sm py-1.5",
    },
    lg: {
      trigger: "h-11 text-base px-3 gap-2",
      icon: "h-5 w-5",
      item: "text-base py-2",
    },
  };

  const sizes = sizeClasses[size];

  // Display value
  const displayOption = pendingOption || currentOption;
  const displayContent = renderDisplay
    ? renderDisplay(displayOption)
    : displayOption?.label || placeholder;

  return (
    <div className={cn("relative inline-flex", className)}>
      <Select
        value={pendingValue || value}
        onValueChange={handleValueChange}
        disabled={disabled || isSaving}
        open={isOpen}
        onOpenChange={setIsOpen}
        name={name}
      >
        <SelectTrigger
          className={cn(
            sizes.trigger,
            "transition-all duration-200",
            "border border-transparent rounded-md",
            "hover:bg-muted/60 hover:border-muted",
            "focus:bg-muted/60 focus:border-primary focus:ring-2 focus:ring-primary/20",
            isOpen && "bg-muted/60 border-primary ring-2 ring-primary/20",
            disabled && "opacity-50 cursor-not-allowed hover:bg-transparent",
            isSaving && "opacity-70",
            triggerClassName
          )}
          aria-label={ariaLabel || name}
        >
          <span className="flex items-center gap-1.5 flex-1 min-w-0">
            {displayOption?.icon}
            <span className="truncate">{displayContent}</span>
          </span>
          <span className="flex items-center gap-1">
            {isSaving && showLoading && (
              <Loader2 className={cn(sizes.icon, "animate-spin text-muted-foreground")} />
            )}
            {showIndicator && !isSaving && (
              <ChevronDown
                className={cn(
                  sizes.icon,
                  "text-muted-foreground transition-transform",
                  isOpen && "rotate-180"
                )}
              />
            )}
          </span>
        </SelectTrigger>
        <SelectContent align={align} side={side}>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={option.disabled}
              className={cn(sizes.item, "cursor-pointer")}
            >
              <span className="flex items-center gap-2">
                {option.icon}
                <span className="flex flex-col">
                  <span>{option.label}</span>
                  {option.description && (
                    <span className="text-xs text-muted-foreground">
                      {option.description}
                    </span>
                  )}
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default EditableSelect;
