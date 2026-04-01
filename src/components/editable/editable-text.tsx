"use client";

import * as React from "react";
import { useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useInlineEdit, type ValidationFn } from "@/hooks/use-inline-edit";
import { Loader2, Check, X, Pencil } from "lucide-react";

export interface EditableTextProps {
  /** Current value */
  value: string;
  /** Called when value is saved */
  onSave: (value: string) => Promise<void> | void;
  /** Called when edit is cancelled */
  onCancel?: () => void;
  /** Validation function */
  validate?: ValidationFn<string>;
  /** Placeholder when empty */
  placeholder?: string;
  /** Whether editing is disabled */
  disabled?: boolean;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Additional class names for the display text */
  className?: string;
  /** Additional class names for the input */
  inputClassName?: string;
  /** Whether to show edit icon on hover */
  showEditIcon?: boolean;
  /** Transform value before display */
  displayTransform?: (value: string) => React.ReactNode;
  /** Input type */
  type?: "text" | "email" | "url" | "tel";
  /** Maximum length */
  maxLength?: number;
  /** Input name attribute */
  name?: string;
  /** ARIA label */
  ariaLabel?: string;
  /** Whether to select all text on focus */
  selectOnFocus?: boolean;
  /** Show inline save/cancel buttons */
  showButtons?: boolean;
  /** Whether field is required */
  required?: boolean;
}

/**
 * Inline editable text component
 *
 * Click to edit, Enter to save, Escape to cancel.
 * Supports validation, loading states, and smooth transitions.
 */
export function EditableText({
  value,
  onSave,
  onCancel,
  validate,
  placeholder = "Click to edit...",
  disabled = false,
  size = "md",
  className,
  inputClassName,
  showEditIcon = true,
  displayTransform,
  type = "text",
  maxLength,
  name,
  ariaLabel,
  selectOnFocus = true,
  showButtons = false,
  required = false,
}: EditableTextProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    isEditing,
    isSaving,
    value: editValue,
    error,
    startEditing,
    cancelEditing,
    setValue,
    save,
    handleKeyDown,
  } = useInlineEdit({
    initialValue: value,
    onSave,
    onCancel,
    validate: required
      ? (validate
          ? (v: string) => {
              if (!v.trim()) return { valid: false, message: "Required" };
              return validate(v);
            }
          : (v: string) => ({ valid: v.trim().length > 0, message: "Required" }))
      : validate,
    transform: (v: string) => v.trim(),
  });

  // Auto-focus and select input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (selectOnFocus) {
        inputRef.current.select();
      }
    }
  }, [isEditing, selectOnFocus]);

  // Handle blur - save on blur unless cancelled
  const handleBlur = useCallback(
    (e: React.FocusEvent) => {
      // Don't save if clicking on cancel/save buttons
      const relatedTarget = e.relatedTarget as HTMLElement;
      if (relatedTarget?.closest("[data-editable-action]")) {
        return;
      }

      // Only save if there are changes
      if (editValue !== value) {
        save();
      } else {
        cancelEditing();
      }
    },
    [editValue, value, save, cancelEditing]
  );

  // Handle click to start editing
  const handleClick = useCallback(() => {
    if (!disabled && !isEditing) {
      startEditing();
    }
  }, [disabled, isEditing, startEditing]);

  // Size classes
  const sizeClasses = {
    sm: {
      text: "text-sm min-h-[28px] py-0.5",
      input: "h-7 text-sm px-2",
      icon: "h-3 w-3",
    },
    md: {
      text: "text-base min-h-[36px] py-1",
      input: "h-9 text-base px-3",
      icon: "h-4 w-4",
    },
    lg: {
      text: "text-lg min-h-[44px] py-1.5",
      input: "h-11 text-lg px-3",
      icon: "h-5 w-5",
    },
  };

  const sizes = sizeClasses[size];

  // Display mode
  if (!isEditing) {
    const displayValue = value || placeholder;
    const isEmpty = !value;

    return (
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        className={cn(
          "group/editable inline-flex items-center gap-1.5 rounded-md px-2 -mx-2",
          "cursor-pointer select-none transition-all duration-200",
          "hover:bg-muted/60 focus:bg-muted/60",
          "focus:outline-none focus:ring-2 focus:ring-ring/40 focus:ring-offset-1",
          disabled && "cursor-not-allowed opacity-60 hover:bg-transparent",
          sizes.text,
          className
        )}
        onClick={handleClick}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !disabled) {
            e.preventDefault();
            startEditing();
          }
        }}
        aria-label={ariaLabel || `Edit ${name || "text"}: ${displayValue}`}
        aria-disabled={disabled}
      >
        <span
          className={cn(
            "flex-1 truncate",
            isEmpty && "text-muted-foreground italic"
          )}
        >
          {displayTransform ? displayTransform(value) : displayValue}
        </span>
        {showEditIcon && !disabled && (
          <Pencil
            className={cn(
              sizes.icon,
              "text-muted-foreground opacity-0 transition-opacity",
              "group-hover/editable:opacity-100 group-focus/editable:opacity-100",
              "flex-shrink-0"
            )}
          />
        )}
      </div>
    );
  }

  // Edit mode
  return (
    <div className="relative inline-flex items-center gap-1.5 w-full">
      <div className="relative flex-1">
        <Input
          ref={inputRef}
          type={type}
          value={editValue}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={!showButtons ? handleBlur : undefined}
          disabled={isSaving}
          maxLength={maxLength}
          name={name}
          aria-label={ariaLabel || `Edit ${name || "text"}`}
          aria-invalid={!!error}
          aria-describedby={error ? `${name || "editable"}-error` : undefined}
          className={cn(
            sizes.input,
            "pr-8 transition-all duration-200",
            "border-primary ring-2 ring-primary/20",
            error && "border-destructive ring-destructive/20",
            isSaving && "opacity-70",
            inputClassName
          )}
        />
        {isSaving && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <Loader2 className={cn(sizes.icon, "animate-spin text-muted-foreground")} />
          </div>
        )}
      </div>

      {/* Action buttons */}
      {showButtons && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            data-editable-action="save"
            onClick={(e) => {
              e.preventDefault();
              save();
            }}
            disabled={isSaving}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              "bg-primary text-primary-foreground hover:bg-primary/90",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
            aria-label="Save"
          >
            <Check className={sizes.icon} />
          </button>
          <button
            type="button"
            data-editable-action="cancel"
            onClick={(e) => {
              e.preventDefault();
              cancelEditing();
            }}
            disabled={isSaving}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              "bg-muted text-muted-foreground hover:bg-muted/80",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
            aria-label="Cancel"
          >
            <X className={sizes.icon} />
          </button>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div
          id={`${name || "editable"}-error`}
          className="absolute -bottom-5 left-0 text-xs text-destructive animate-in fade-in slide-in-from-top-1"
        >
          {error}
        </div>
      )}
    </div>
  );
}

export default EditableText;
