"use client";

import * as React from "react";
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  TimezonePreferences,
  DEFAULT_TIMEZONE_PREFERENCES,
  BusinessHours,
  DEFAULT_BUSINESS_HOURS,
} from "@/types/timezone";
import {
  detectLocalTimezone,
  isValidTimezone,
  formatDateTime,
  formatDate,
  formatTime,
  getRelativeTime,
  isWithinBusinessHours,
} from "@/lib/timezone-utils";

// ============================================
// CONTEXT TYPES
// ============================================

interface TimezoneContextType {
  /** Current active timezone */
  timezone: string;
  /** User's timezone preferences */
  preferences: TimezonePreferences;
  /** Business hours configuration */
  businessHours: BusinessHours;
  /** Whether preferences are loading */
  isLoading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Update the active timezone */
  setTimezone: (timezone: string) => void;
  /** Update timezone preferences */
  updatePreferences: (updates: Partial<TimezonePreferences>) => Promise<void>;
  /** Update business hours */
  updateBusinessHours: (updates: Partial<BusinessHours>) => Promise<void>;
  /** Auto-detect and set timezone from browser */
  autoDetectTimezone: () => void;
  /** Check if current time is within business hours */
  isBusinessHours: () => boolean;
  /** Reload preferences from server */
  refreshPreferences: () => Promise<void>;
}

// ============================================
// CONTEXT & HOOKS
// ============================================

const TimezoneContext = createContext<TimezoneContextType | null>(null);

export function useTimezone() {
  const context = useContext(TimezoneContext);
  if (!context) {
    // Return a default context if not within provider (for SSR compatibility)
    return {
      timezone: "UTC",
      preferences: DEFAULT_TIMEZONE_PREFERENCES,
      businessHours: DEFAULT_BUSINESS_HOURS,
      isLoading: false,
      error: null,
      setTimezone: () => {},
      updatePreferences: async () => {},
      updateBusinessHours: async () => {},
      autoDetectTimezone: () => {},
      isBusinessHours: () => false,
      refreshPreferences: async () => {},
    };
  }
  return context;
}

// ============================================
// LOCAL STORAGE KEYS
// ============================================

const TIMEZONE_STORAGE_KEY = "uploadportal_timezone";
const PREFERENCES_STORAGE_KEY = "uploadportal_timezone_preferences";
const BUSINESS_HOURS_STORAGE_KEY = "uploadportal_business_hours";

// ============================================
// PROVIDER COMPONENT
// ============================================

interface TimezoneProviderProps {
  children: React.ReactNode;
  /** Initial timezone (e.g., from user session) */
  initialTimezone?: string;
  /** Initial preferences (e.g., from user session) */
  initialPreferences?: Partial<TimezonePreferences>;
  /** API endpoint for saving preferences */
  saveEndpoint?: string;
}

export function TimezoneProvider({
  children,
  initialTimezone,
  initialPreferences,
  saveEndpoint = "/api/user/timezone",
}: TimezoneProviderProps) {
  const [timezone, setTimezoneState] = useState<string>(
    initialTimezone || DEFAULT_TIMEZONE_PREFERENCES.timezone
  );
  const [preferences, setPreferences] = useState<TimezonePreferences>({
    ...DEFAULT_TIMEZONE_PREFERENCES,
    ...initialPreferences,
  });
  const [businessHours, setBusinessHours] = useState<BusinessHours>(DEFAULT_BUSINESS_HOURS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ============================================
  // INITIALIZATION
  // ============================================

  useEffect(() => {
    const initializeTimezone = () => {
      try {
        // Try to load from localStorage first
        const storedTimezone = localStorage.getItem(TIMEZONE_STORAGE_KEY);
        const storedPreferences = localStorage.getItem(PREFERENCES_STORAGE_KEY);
        const storedBusinessHours = localStorage.getItem(BUSINESS_HOURS_STORAGE_KEY);

        if (storedPreferences) {
          const parsed = JSON.parse(storedPreferences) as TimezonePreferences;
          setPreferences(parsed);

          // Use stored timezone if available, otherwise check auto-detect
          if (storedTimezone && isValidTimezone(storedTimezone)) {
            setTimezoneState(storedTimezone);
          } else if (parsed.autoDetect) {
            const detected = detectLocalTimezone();
            setTimezoneState(detected);
          }
        } else if (preferences.autoDetect) {
          // Auto-detect on first load if enabled
          const detected = detectLocalTimezone();
          setTimezoneState(detected);
        }

        if (storedBusinessHours) {
          setBusinessHours(JSON.parse(storedBusinessHours));
        }
      } catch (err) {
        console.error("Error initializing timezone:", err);
        // Fall back to auto-detection
        const detected = detectLocalTimezone();
        setTimezoneState(detected);
      } finally {
        setIsLoading(false);
      }
    };

    initializeTimezone();
  }, []);

  // ============================================
  // TIMEZONE MANAGEMENT
  // ============================================

  const setTimezone = useCallback((newTimezone: string) => {
    if (!isValidTimezone(newTimezone)) {
      console.warn(`Invalid timezone: ${newTimezone}`);
      return;
    }

    setTimezoneState(newTimezone);
    localStorage.setItem(TIMEZONE_STORAGE_KEY, newTimezone);

    // Update preferences if autoDetect was on
    setPreferences((prev) => ({
      ...prev,
      timezone: newTimezone,
      autoDetect: false, // Disable auto-detect when manually setting timezone
    }));
  }, []);

  const autoDetectTimezone = useCallback(() => {
    const detected = detectLocalTimezone();
    setTimezoneState(detected);
    localStorage.setItem(TIMEZONE_STORAGE_KEY, detected);

    setPreferences((prev) => ({
      ...prev,
      timezone: detected,
      autoDetect: true,
    }));
  }, []);

  // ============================================
  // PREFERENCES MANAGEMENT
  // ============================================

  const updatePreferences = useCallback(
    async (updates: Partial<TimezonePreferences>) => {
      try {
        setError(null);

        const newPreferences = { ...preferences, ...updates };
        setPreferences(newPreferences);

        // Update timezone if changed in preferences
        if (updates.timezone && isValidTimezone(updates.timezone)) {
          setTimezoneState(updates.timezone);
          localStorage.setItem(TIMEZONE_STORAGE_KEY, updates.timezone);
        }

        // Handle auto-detect toggle
        if (updates.autoDetect === true) {
          const detected = detectLocalTimezone();
          setTimezoneState(detected);
          newPreferences.timezone = detected;
          localStorage.setItem(TIMEZONE_STORAGE_KEY, detected);
        }

        // Save to localStorage
        localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(newPreferences));

        // Save to server if endpoint provided
        if (saveEndpoint) {
          const response = await fetch(saveEndpoint, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ timezonePreferences: newPreferences }),
          });

          if (!response.ok) {
            throw new Error("Failed to save timezone preferences");
          }
        }
      } catch (err) {
        console.error("Error updating timezone preferences:", err);
        setError(err instanceof Error ? err.message : "Failed to update preferences");
      }
    },
    [preferences, saveEndpoint]
  );

  // ============================================
  // BUSINESS HOURS MANAGEMENT
  // ============================================

  const updateBusinessHours = useCallback(
    async (updates: Partial<BusinessHours>) => {
      try {
        setError(null);

        const newBusinessHours = { ...businessHours, ...updates };
        setBusinessHours(newBusinessHours);

        // Save to localStorage
        localStorage.setItem(BUSINESS_HOURS_STORAGE_KEY, JSON.stringify(newBusinessHours));

        // Save to server if endpoint provided
        if (saveEndpoint) {
          const response = await fetch(saveEndpoint, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ businessHours: newBusinessHours }),
          });

          if (!response.ok) {
            throw new Error("Failed to save business hours");
          }
        }
      } catch (err) {
        console.error("Error updating business hours:", err);
        setError(err instanceof Error ? err.message : "Failed to update business hours");
      }
    },
    [businessHours, saveEndpoint]
  );

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  const isBusinessHoursNow = useCallback(() => {
    return isWithinBusinessHours(new Date(), businessHours);
  }, [businessHours]);

  const refreshPreferences = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (saveEndpoint) {
        const response = await fetch(saveEndpoint);
        if (response.ok) {
          const data = await response.json();
          if (data.timezonePreferences) {
            setPreferences(data.timezonePreferences);
            if (data.timezonePreferences.timezone) {
              setTimezoneState(data.timezonePreferences.timezone);
            }
          }
          if (data.businessHours) {
            setBusinessHours(data.businessHours);
          }
        }
      }
    } catch (err) {
      console.error("Error refreshing timezone preferences:", err);
      setError(err instanceof Error ? err.message : "Failed to refresh preferences");
    } finally {
      setIsLoading(false);
    }
  }, [saveEndpoint]);

  // ============================================
  // CONTEXT VALUE
  // ============================================

  const contextValue: TimezoneContextType = {
    timezone,
    preferences,
    businessHours,
    isLoading,
    error,
    setTimezone,
    updatePreferences,
    updateBusinessHours,
    autoDetectTimezone,
    isBusinessHours: isBusinessHoursNow,
    refreshPreferences,
  };

  return (
    <TimezoneContext.Provider value={contextValue}>
      {children}
    </TimezoneContext.Provider>
  );
}

// ============================================
// UTILITY HOOKS
// ============================================

/**
 * Hook to get formatted dates in user's timezone
 */
export function useFormattedDate(
  date: Date | string | number | null | undefined,
  options?: {
    format?: "date" | "time" | "datetime";
    relative?: boolean;
  }
) {
  const { timezone, preferences } = useTimezone();
  const [formatted, setFormatted] = useState<string>("");

  useEffect(() => {
    if (!date) {
      setFormatted("");
      return;
    }

    const inputDate = new Date(date);
    const { format = "datetime", relative = false } = options || {};

    if (relative) {
      setFormatted(getRelativeTime(inputDate));
    } else {
      switch (format) {
        case "date":
          setFormatted(formatDate(inputDate, timezone, preferences.dateFormat));
          break;
        case "time":
          setFormatted(formatTime(inputDate, timezone, { hour12: !preferences.use24HourFormat }));
          break;
        default:
          setFormatted(
            formatDateTime(inputDate, timezone, {
              dateStyle: "medium",
              timeStyle: "short",
              hour12: !preferences.use24HourFormat,
            })
          );
      }
    }
  }, [date, timezone, preferences.dateFormat, preferences.use24HourFormat, options]);

  return formatted;
}

/**
 * Hook to get live-updating current time in user's timezone
 */
export function useCurrentTime(updateIntervalMs: number = 1000) {
  const { timezone, preferences } = useTimezone();
  const [currentTime, setCurrentTime] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(
        formatTime(new Date(), timezone, {
          hour12: !preferences.use24HourFormat,
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, updateIntervalMs);
    return () => clearInterval(interval);
  }, [timezone, preferences.use24HourFormat, updateIntervalMs]);

  return currentTime;
}

/**
 * Hook to check if it's currently within business hours
 */
export function useIsBusinessHours() {
  const { businessHours } = useTimezone();
  const [isWithinHours, setIsWithinHours] = useState(false);

  useEffect(() => {
    const checkHours = () => {
      setIsWithinHours(isWithinBusinessHours(new Date(), businessHours));
    };

    checkHours();
    const interval = setInterval(checkHours, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [businessHours]);

  return isWithinHours;
}

export default TimezoneProvider;
