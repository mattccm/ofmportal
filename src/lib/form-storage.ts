/**
 * Form Storage Utilities
 *
 * Handles localStorage persistence for form autosave functionality.
 * Supports multiple forms with unique identifiers, versioning, and conflict detection.
 */

// Storage key prefix for all form data
const STORAGE_PREFIX = "uploadportal_form_";

// Version for storage schema (bump when changing structure)
const STORAGE_VERSION = 1;

/**
 * Metadata stored alongside form data
 */
export interface FormStorageMetadata {
  version: number;
  formId: string;
  savedAt: number;
  userId?: string;
  checksum?: string;
}

/**
 * Complete stored form entry
 */
export interface StoredFormData<T = Record<string, unknown>> {
  metadata: FormStorageMetadata;
  data: T;
}

/**
 * Form storage options
 */
export interface FormStorageOptions {
  userId?: string;
  /** Expiration time in milliseconds (default: 7 days) */
  expiresIn?: number;
}

/**
 * Generate a storage key for a specific form
 */
export function getFormStorageKey(formId: string): string {
  return `${STORAGE_PREFIX}${formId}`;
}

/**
 * Generate a simple checksum for data integrity verification
 */
function generateChecksum(data: unknown): string {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

/**
 * Check if localStorage is available
 */
export function isStorageAvailable(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const testKey = "__storage_test__";
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Save form data to localStorage
 */
export function saveFormData<T>(
  formId: string,
  data: T,
  options: FormStorageOptions = {}
): boolean {
  if (!isStorageAvailable()) {
    console.warn("localStorage is not available");
    return false;
  }

  try {
    const storedData: StoredFormData<T> = {
      metadata: {
        version: STORAGE_VERSION,
        formId,
        savedAt: Date.now(),
        userId: options.userId,
        checksum: generateChecksum(data),
      },
      data,
    };

    const key = getFormStorageKey(formId);
    window.localStorage.setItem(key, JSON.stringify(storedData));
    return true;
  } catch (error) {
    console.error("Failed to save form data:", error);
    return false;
  }
}

/**
 * Retrieve saved form data from localStorage
 */
export function getFormData<T>(
  formId: string,
  options: FormStorageOptions = {}
): StoredFormData<T> | null {
  if (!isStorageAvailable()) {
    return null;
  }

  try {
    const key = getFormStorageKey(formId);
    const stored = window.localStorage.getItem(key);

    if (!stored) {
      return null;
    }

    const parsed: StoredFormData<T> = JSON.parse(stored);

    // Version check
    if (parsed.metadata.version !== STORAGE_VERSION) {
      // Incompatible version, clear and return null
      clearFormData(formId);
      return null;
    }

    // Expiration check
    const expiresIn = options.expiresIn ?? 7 * 24 * 60 * 60 * 1000; // 7 days default
    if (Date.now() - parsed.metadata.savedAt > expiresIn) {
      clearFormData(formId);
      return null;
    }

    // User check (optional)
    if (options.userId && parsed.metadata.userId && parsed.metadata.userId !== options.userId) {
      // Different user, don't restore
      return null;
    }

    return parsed;
  } catch (error) {
    console.error("Failed to retrieve form data:", error);
    return null;
  }
}

/**
 * Check if saved form data exists
 */
export function hasFormData(formId: string): boolean {
  if (!isStorageAvailable()) {
    return false;
  }

  const key = getFormStorageKey(formId);
  return window.localStorage.getItem(key) !== null;
}

/**
 * Clear saved form data
 */
export function clearFormData(formId: string): boolean {
  if (!isStorageAvailable()) {
    return false;
  }

  try {
    const key = getFormStorageKey(formId);
    window.localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error("Failed to clear form data:", error);
    return false;
  }
}

/**
 * Clear all saved form data for the application
 */
export function clearAllFormData(): boolean {
  if (!isStorageAvailable()) {
    return false;
  }

  try {
    const keys = Object.keys(window.localStorage);
    keys.forEach((key) => {
      if (key.startsWith(STORAGE_PREFIX)) {
        window.localStorage.removeItem(key);
      }
    });
    return true;
  } catch (error) {
    console.error("Failed to clear all form data:", error);
    return false;
  }
}

/**
 * Get all stored form IDs
 */
export function getAllStoredFormIds(): string[] {
  if (!isStorageAvailable()) {
    return [];
  }

  try {
    const keys = Object.keys(window.localStorage);
    return keys
      .filter((key) => key.startsWith(STORAGE_PREFIX))
      .map((key) => key.replace(STORAGE_PREFIX, ""));
  } catch {
    return [];
  }
}

/**
 * Check for conflicts between current data and saved data
 */
export function detectConflict<T>(
  formId: string,
  currentData: T,
  options: FormStorageOptions = {}
): { hasConflict: boolean; savedData: StoredFormData<T> | null } {
  const savedData = getFormData<T>(formId, options);

  if (!savedData) {
    return { hasConflict: false, savedData: null };
  }

  const currentChecksum = generateChecksum(currentData);
  const savedChecksum = savedData.metadata.checksum;

  // If checksums match, no conflict
  if (currentChecksum === savedChecksum) {
    return { hasConflict: false, savedData };
  }

  // Check if current data is "empty" (all defaults or initial state)
  const isCurrentEmpty = isEmptyFormData(currentData);

  // If current data is empty and we have saved data, offer to restore
  if (isCurrentEmpty) {
    return { hasConflict: true, savedData };
  }

  // Both have data but different - true conflict
  return { hasConflict: true, savedData };
}

/**
 * Check if form data appears to be empty/default
 */
function isEmptyFormData<T>(data: T): boolean {
  if (!data || typeof data !== "object") {
    return true;
  }

  const checkEmpty = (value: unknown): boolean => {
    if (value === null || value === undefined) return true;
    if (value === "") return true;
    if (Array.isArray(value) && value.length === 0) return true;
    if (typeof value === "object" && Object.keys(value).length === 0) return true;
    return false;
  };

  const values = Object.values(data as Record<string, unknown>);
  return values.every(checkEmpty);
}

/**
 * Generate a formatted timestamp string
 */
export function formatSavedTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  // Less than a minute
  if (diff < 60 * 1000) {
    return "Just now";
  }

  // Less than an hour
  if (diff < 60 * 60 * 1000) {
    const minutes = Math.floor(diff / (60 * 1000));
    return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
  }

  // Less than a day
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  }

  // Format as date
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Estimate storage usage
 */
export function getStorageUsage(): { used: number; available: number } {
  if (!isStorageAvailable()) {
    return { used: 0, available: 0 };
  }

  let used = 0;
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith(STORAGE_PREFIX)) {
        const value = window.localStorage.getItem(key);
        if (value) {
          used += key.length + value.length;
        }
      }
    }
  } catch {
    // Ignore errors
  }

  // Estimate available (most browsers allow ~5MB)
  const available = 5 * 1024 * 1024;

  return { used: used * 2, available }; // *2 for UTF-16 encoding
}
