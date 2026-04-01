"use client";

import * as React from "react";
import { useState, useCallback, useEffect, useRef } from "react";
import { format, parseISO, isValid } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Calendar as CalendarIcon, Loader2, X } from "lucide-react";

export interface EditableDateProps {
  /** Current date value (ISO string or Date) */
  value: string | Date | null;
  /** Called when date changes */
  onSave: (value: string | null) => Promise<void> | void;
  /** Placeholder when no date selected */
  placeholder?: string;
  /** Whether editing is disabled */
  disabled?: boolean;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Additional class names */
  className?: string;
  /** Date format for display */
  displayFormat?: string;
  /** Whether to allow clearing the date */
  clearable?: boolean;
  /** ARIA label */
  ariaLabel?: string;
  /** Minimum selectable date */
  minDate?: Date;
  /** Maximum selectable date */
  maxDate?: Date;
  /** Whether to disable past dates */
  disablePast?: boolean;
  /** Whether to disable future dates */
  disableFuture?: boolean;
}

/**
 * Inline editable date picker component
 *
 * Click to show calendar, immediate save on selection.
 * Supports date range restrictions and loading states.
 */
export function EditableDate({
  value,
  onSave,
  placeholder = "Select date...",
  disabled = false,
  size = "md",
  className,
  displayFormat = "MMM d, yyyy",
  clearable = true,
  ariaLabel,
  minDate,
  maxDate,
  disablePast = false,
  disableFuture = false,
}: EditableDateProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isMountedRef = useRef(true);

  // Track mounted state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Parse date value
  const dateValue = React.useMemo(() => {
    if (!value) return undefined;
    if (value instanceof Date) return isValid(value) ? value : undefined;
    try {
      const parsed = parseISO(value);
      return isValid(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }, [value]);

  // Disable date check function
  const isDateDisabled = useCallback(
    (date: Date) => {
      if (disablePast && date < new Date(new Date().setHours(0, 0, 0, 0))) {
        return true;
      }
      if (disableFuture && date > new Date(new Date().setHours(23, 59, 59, 999))) {
        return true;
      }
      if (minDate && date < minDate) {
        return true;
      }
      if (maxDate && date > maxDate) {
        return true;
      }
      return false;
    },
    [disablePast, disableFuture, minDate, maxDate]
  );

  // Handle date selection
  const handleSelect = useCallback(
    async (date: Date | undefined) => {
      if (disabled) return;

      const newValue = date ? date.toISOString() : null;

      // Skip if same value
      if (
        (newValue === null && value === null) ||
        (dateValue && date && dateValue.getTime() === date.getTime())
      ) {
        setIsOpen(false);
        return;
      }

      setIsSaving(true);

      try {
        await onSave(newValue);
      } catch (error) {
        console.error("Failed to save date:", error);
      } finally {
        if (isMountedRef.current) {
          setIsSaving(false);
          setIsOpen(false);
        }
      }
    },
    [disabled, value, dateValue, onSave]
  );

  // Handle clear
  const handleClear = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (disabled || !clearable) return;

      setIsSaving(true);

      try {
        await onSave(null);
      } catch (error) {
        console.error("Failed to clear date:", error);
      } finally {
        if (isMountedRef.current) {
          setIsSaving(false);
        }
      }
    },
    [disabled, clearable, onSave]
  );

  // Size classes
  const sizeClasses = {
    sm: {
      button: "h-7 text-xs px-2 gap-1",
      icon: "h-3 w-3",
    },
    md: {
      button: "h-9 text-sm px-3 gap-1.5",
      icon: "h-4 w-4",
    },
    lg: {
      button: "h-11 text-base px-3 gap-2",
      icon: "h-5 w-5",
    },
  };

  const sizes = sizeClasses[size];

  // Format display value
  const displayValue = dateValue ? format(dateValue, displayFormat) : placeholder;
  const hasValue = !!dateValue;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          disabled={disabled || isSaving}
          className={cn(
            sizes.button,
            "justify-start font-normal",
            "border border-transparent rounded-md",
            "hover:bg-muted/60 hover:border-muted",
            "focus-visible:bg-muted/60 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20",
            isOpen && "bg-muted/60 border-primary ring-2 ring-primary/20",
            !hasValue && "text-muted-foreground",
            disabled && "opacity-50 cursor-not-allowed hover:bg-transparent",
            isSaving && "opacity-70 cursor-wait",
            className
          )}
          aria-label={ariaLabel || "Select date"}
        >
          <CalendarIcon className={cn(sizes.icon, "text-muted-foreground")} />
          <span className="flex-1 truncate text-left">{displayValue}</span>
          {isSaving ? (
            <Loader2 className={cn(sizes.icon, "animate-spin text-muted-foreground")} />
          ) : hasValue && clearable && !disabled ? (
            <X
              className={cn(
                sizes.icon,
                "text-muted-foreground hover:text-foreground transition-colors"
              )}
              onClick={handleClear}
            />
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          selected={dateValue}
          onSelect={handleSelect}
          disabled={isDateDisabled}
          initialFocus
        />
        {clearable && hasValue && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-center text-muted-foreground"
              onClick={() => handleSelect(undefined)}
            >
              <X className="h-4 w-4 mr-1" />
              Clear date
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default EditableDate;
