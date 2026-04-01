"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export type ValidationResult = {
  valid: boolean;
  message?: string;
};

export type ValidationFn<T> = (value: T) => ValidationResult | Promise<ValidationResult>;

export interface UseInlineEditOptions<T> {
  /** Initial value */
  initialValue: T;
  /** Called when save is triggered */
  onSave: (value: T) => Promise<void> | void;
  /** Called when edit is cancelled */
  onCancel?: () => void;
  /** Validation function */
  validate?: ValidationFn<T>;
  /** Transform value before save */
  transform?: (value: T) => T;
  /** Debounce save delay in ms (0 for immediate) */
  saveDelay?: number;
}

export interface UseInlineEditReturn<T> {
  /** Whether currently in edit mode */
  isEditing: boolean;
  /** Whether currently saving */
  isSaving: boolean;
  /** Current value being edited */
  value: T;
  /** Validation error message if any */
  error: string | null;
  /** Start editing */
  startEditing: () => void;
  /** Cancel editing and revert to original value */
  cancelEditing: () => void;
  /** Set the current editing value */
  setValue: (value: T) => void;
  /** Save the current value */
  save: () => Promise<void>;
  /** Handle key down events (Enter to save, Escape to cancel) */
  handleKeyDown: (e: React.KeyboardEvent) => void;
  /** Reset to a new initial value */
  reset: (newValue: T) => void;
  /** Whether value has been modified from initial */
  isDirty: boolean;
}

/**
 * Hook for managing inline edit state with validation and save handling
 */
export function useInlineEdit<T>({
  initialValue,
  onSave,
  onCancel,
  validate,
  transform,
  saveDelay = 0,
}: UseInlineEditOptions<T>): UseInlineEditReturn<T> {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [value, setValue] = useState<T>(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [originalValue, setOriginalValue] = useState<T>(initialValue);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Track mounted state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Update when initialValue changes externally
  useEffect(() => {
    if (!isEditing) {
      setValue(initialValue);
      setOriginalValue(initialValue);
    }
  }, [initialValue, isEditing]);

  const startEditing = useCallback(() => {
    setIsEditing(true);
    setError(null);
    setOriginalValue(value);
  }, [value]);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    setValue(originalValue);
    setError(null);
    onCancel?.();
  }, [originalValue, onCancel]);

  const save = useCallback(async () => {
    // Clear any pending saves
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    // Apply transform if provided
    const finalValue = transform ? transform(value) : value;

    // Run validation
    if (validate) {
      const result = await validate(finalValue);
      if (!result.valid) {
        setError(result.message || "Invalid value");
        return;
      }
    }

    setError(null);

    const performSave = async () => {
      setIsSaving(true);
      try {
        await onSave(finalValue);
        if (isMountedRef.current) {
          setIsEditing(false);
          setOriginalValue(finalValue);
          setValue(finalValue);
        }
      } catch (err) {
        if (isMountedRef.current) {
          setError(err instanceof Error ? err.message : "Failed to save");
        }
      } finally {
        if (isMountedRef.current) {
          setIsSaving(false);
        }
      }
    };

    if (saveDelay > 0) {
      saveTimeoutRef.current = setTimeout(performSave, saveDelay);
    } else {
      await performSave();
    }
  }, [value, transform, validate, onSave, saveDelay]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        save();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelEditing();
      }
    },
    [save, cancelEditing]
  );

  const reset = useCallback((newValue: T) => {
    setValue(newValue);
    setOriginalValue(newValue);
    setIsEditing(false);
    setError(null);
  }, []);

  const isDirty = value !== originalValue;

  return {
    isEditing,
    isSaving,
    value,
    error,
    startEditing,
    cancelEditing,
    setValue,
    save,
    handleKeyDown,
    reset,
    isDirty,
  };
}

/**
 * Common validation helpers
 */
export const validators = {
  required: (message = "This field is required"): ValidationFn<string> => {
    return (value: string) => ({
      valid: value.trim().length > 0,
      message,
    });
  },

  minLength: (min: number, message?: string): ValidationFn<string> => {
    return (value: string) => ({
      valid: value.trim().length >= min,
      message: message || `Must be at least ${min} characters`,
    });
  },

  maxLength: (max: number, message?: string): ValidationFn<string> => {
    return (value: string) => ({
      valid: value.trim().length <= max,
      message: message || `Must be no more than ${max} characters`,
    });
  },

  pattern: (regex: RegExp, message: string): ValidationFn<string> => {
    return (value: string) => ({
      valid: regex.test(value),
      message,
    });
  },

  compose: <T>(...validators: ValidationFn<T>[]): ValidationFn<T> => {
    return async (value: T) => {
      for (const validate of validators) {
        const result = await validate(value);
        if (!result.valid) {
          return result;
        }
      }
      return { valid: true };
    };
  },
};

export default useInlineEdit;
