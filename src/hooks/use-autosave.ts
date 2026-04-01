/**
 * useAutosave Hook
 *
 * Provides debounced autosave functionality with localStorage backup,
 * conflict detection, and recovery capabilities.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  saveFormData,
  getFormData,
  clearFormData,
  detectConflict,
  formatSavedTime,
  isStorageAvailable,
  type StoredFormData,
  type FormStorageOptions,
} from "@/lib/form-storage";

/**
 * Autosave status states
 */
export type AutosaveStatus =
  | "idle"
  | "saving"
  | "saved"
  | "error"
  | "offline"
  | "conflict";

/**
 * Options for the useAutosave hook
 */
export interface UseAutosaveOptions<T> {
  /** Unique identifier for this form */
  formId: string;
  /** Current form data */
  data: T;
  /** Debounce delay in milliseconds (default: 1000) */
  debounceMs?: number;
  /** Enable/disable autosave (default: true) */
  enabled?: boolean;
  /** User ID for conflict detection */
  userId?: string;
  /** Callback when save completes */
  onSave?: (data: T) => void;
  /** Callback when error occurs */
  onError?: (error: Error) => void;
  /** Callback when conflict is detected */
  onConflict?: (savedData: StoredFormData<T>) => void;
  /** Storage expiration in milliseconds */
  expiresIn?: number;
  /** Minimum interval between saves (default: 2000ms) */
  minSaveInterval?: number;
}

/**
 * Return value from useAutosave hook
 */
export interface UseAutosaveReturn<T> {
  /** Current autosave status */
  status: AutosaveStatus;
  /** Timestamp of last save (null if never saved) */
  lastSavedAt: number | null;
  /** Formatted last saved time string */
  lastSavedText: string;
  /** Whether there's unsaved data from a previous session */
  hasRecoverableData: boolean;
  /** Recoverable data if available */
  recoverableData: StoredFormData<T> | null;
  /** Trigger immediate save */
  saveNow: () => void;
  /** Clear saved data (call on successful submit) */
  clearSaved: () => void;
  /** Recover saved data */
  recover: () => T | null;
  /** Dismiss recovery prompt */
  dismissRecovery: () => void;
  /** Whether storage is available */
  isStorageAvailable: boolean;
  /** Whether currently online */
  isOnline: boolean;
}

/**
 * Hook for form autosave functionality
 */
export function useAutosave<T extends Record<string, unknown>>({
  formId,
  data,
  debounceMs = 1000,
  enabled = true,
  userId,
  onSave,
  onError,
  onConflict,
  expiresIn,
  minSaveInterval = 2000,
}: UseAutosaveOptions<T>): UseAutosaveReturn<T> {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [recoverableData, setRecoverableData] = useState<StoredFormData<T> | null>(null);
  const [hasRecoverableData, setHasRecoverableData] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [storageAvailable] = useState(isStorageAvailable);

  // Refs for debouncing and tracking
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveTimeRef = useRef<number>(0);
  const dataRef = useRef<T>(data);
  const initialCheckDone = useRef(false);

  // Storage options
  const storageOptions: FormStorageOptions = {
    userId,
    expiresIn,
  };

  // Update data ref when data changes
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => {
      setIsOnline(false);
      setStatus("offline");
    };

    if (typeof window !== "undefined") {
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, []);

  // Check for recoverable data on mount
  useEffect(() => {
    if (!enabled || !storageAvailable || initialCheckDone.current) {
      return;
    }

    initialCheckDone.current = true;

    const { hasConflict, savedData } = detectConflict<T>(
      formId,
      data,
      storageOptions
    );

    if (hasConflict && savedData) {
      setRecoverableData(savedData);
      setHasRecoverableData(true);
      setStatus("conflict");
      onConflict?.(savedData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId, enabled, storageAvailable]);

  // Perform the actual save
  const performSave = useCallback(() => {
    if (!enabled || !storageAvailable) {
      return;
    }

    const now = Date.now();

    // Check minimum interval
    if (now - lastSaveTimeRef.current < minSaveInterval) {
      return;
    }

    setStatus("saving");

    try {
      const currentData = dataRef.current;
      const success = saveFormData(formId, currentData, storageOptions);

      if (success) {
        lastSaveTimeRef.current = now;
        setLastSavedAt(now);
        setStatus(isOnline ? "saved" : "offline");
        onSave?.(currentData);
      } else {
        throw new Error("Failed to save to localStorage");
      }
    } catch (error) {
      setStatus("error");
      onError?.(error instanceof Error ? error : new Error("Save failed"));
    }
  }, [enabled, storageAvailable, formId, storageOptions, isOnline, minSaveInterval, onSave, onError]);

  // Debounced save on data change
  useEffect(() => {
    if (!enabled || !storageAvailable || hasRecoverableData) {
      return;
    }

    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Schedule new save
    debounceTimeoutRef.current = setTimeout(() => {
      performSave();
    }, debounceMs);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [data, enabled, storageAvailable, debounceMs, performSave, hasRecoverableData]);

  // Save immediately
  const saveNow = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    performSave();
  }, [performSave]);

  // Clear saved data
  const clearSaved = useCallback(() => {
    clearFormData(formId);
    setLastSavedAt(null);
    setStatus("idle");
    setRecoverableData(null);
    setHasRecoverableData(false);
  }, [formId]);

  // Recover saved data
  const recover = useCallback((): T | null => {
    if (recoverableData) {
      setHasRecoverableData(false);
      setStatus("idle");
      return recoverableData.data;
    }
    return null;
  }, [recoverableData]);

  // Dismiss recovery prompt without recovering
  const dismissRecovery = useCallback(() => {
    clearFormData(formId);
    setRecoverableData(null);
    setHasRecoverableData(false);
    setStatus("idle");
  }, [formId]);

  // Format last saved time
  const lastSavedText = lastSavedAt
    ? formatSavedTime(lastSavedAt)
    : "";

  return {
    status,
    lastSavedAt,
    lastSavedText,
    hasRecoverableData,
    recoverableData,
    saveNow,
    clearSaved,
    recover,
    dismissRecovery,
    isStorageAvailable: storageAvailable,
    isOnline,
  };
}

/**
 * Simplified hook for checking if there's recoverable data without full autosave
 */
export function useFormRecovery<T>(
  formId: string,
  options: FormStorageOptions = {}
): {
  hasRecoverableData: boolean;
  recoverableData: StoredFormData<T> | null;
  recover: () => T | null;
  dismiss: () => void;
} {
  const [recoverableData, setRecoverableData] = useState<StoredFormData<T> | null>(null);

  useEffect(() => {
    const saved = getFormData<T>(formId, options);
    setRecoverableData(saved);
  }, [formId, options]);

  const recover = useCallback((): T | null => {
    if (recoverableData) {
      setRecoverableData(null);
      return recoverableData.data;
    }
    return null;
  }, [recoverableData]);

  const dismiss = useCallback(() => {
    clearFormData(formId);
    setRecoverableData(null);
  }, [formId]);

  return {
    hasRecoverableData: recoverableData !== null,
    recoverableData,
    recover,
    dismiss,
  };
}

export default useAutosave;
