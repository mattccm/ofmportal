"use client";

import * as React from "react";
import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";

// ============================================
// TYPES
// ============================================

interface WidgetDataContextType {
  /** All widget data, keyed by widget type */
  data: Record<string, unknown>;
  /** Whether data is currently loading */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Manually refresh all widget data */
  refresh: () => Promise<void>;
  /** Get data for a specific widget */
  getWidgetData: <T>(widgetType: string) => T | null;
  /** Last fetch timestamp */
  lastFetch: Date | null;
}

const WidgetDataContext = createContext<WidgetDataContextType | null>(null);

// ============================================
// PROVIDER COMPONENT
// ============================================

interface WidgetDataProviderProps {
  children: React.ReactNode;
  /** Auto-refresh interval in milliseconds. Default: 0 (disabled) */
  refreshInterval?: number;
}

export function WidgetDataProvider({ children, refreshInterval = 0 }: WidgetDataProviderProps) {
  const [data, setData] = useState<Record<string, unknown>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const isMountedRef = useRef(true);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchAllWidgetData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/dashboard/widgets?widget=all", {
        // Add cache control to prevent stale data
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch widget data: ${response.status}`);
      }

      const result = await response.json();

      if (isMountedRef.current) {
        // Ensure result is a valid object with expected structure
        // This prevents "Y is not iterable" errors when API returns unexpected data
        const validatedResult = result && typeof result === "object" ? result : {};
        setData(validatedResult);
        setLastFetch(new Date());
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard data");
        console.error("Widget data fetch error:", err);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const getWidgetData = useCallback(
    <T,>(widgetType: string): T | null => {
      return (data[widgetType] as T) ?? null;
    },
    [data]
  );

  // Initial fetch
  useEffect(() => {
    isMountedRef.current = true;
    fetchAllWidgetData();

    return () => {
      isMountedRef.current = false;
    };
  }, [fetchAllWidgetData]);

  // Auto-refresh
  useEffect(() => {
    if (refreshInterval <= 0) return;

    refreshIntervalRef.current = setInterval(fetchAllWidgetData, refreshInterval);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [refreshInterval, fetchAllWidgetData]);

  const contextValue: WidgetDataContextType = {
    data,
    isLoading,
    error,
    refresh: fetchAllWidgetData,
    getWidgetData,
    lastFetch,
  };

  return (
    <WidgetDataContext.Provider value={contextValue}>
      {children}
    </WidgetDataContext.Provider>
  );
}

// ============================================
// HOOK
// ============================================

export function useWidgetData() {
  const context = useContext(WidgetDataContext);
  if (!context) {
    throw new Error("useWidgetData must be used within a WidgetDataProvider");
  }
  return context;
}

/**
 * Hook to get data for a specific widget type
 * Falls back to individual fetch if provider is not available (for backwards compatibility)
 */
export function useWidgetDataFor<T>(
  widgetType: string,
  options?: {
    /** Fallback fetch function if not using provider */
    fallbackFetch?: () => Promise<T>;
  }
): {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const context = useContext(WidgetDataContext);
  const [fallbackData, setFallbackData] = useState<T | null>(null);
  const [fallbackLoading, setFallbackLoading] = useState(false);
  const [fallbackError, setFallbackError] = useState<string | null>(null);

  // If we have context, use it
  if (context) {
    return {
      data: context.getWidgetData<T>(widgetType),
      isLoading: context.isLoading,
      error: context.error,
      refresh: context.refresh,
    };
  }

  // Fallback to individual fetch (backwards compatibility)
  const fetchFallback = useCallback(async () => {
    if (!options?.fallbackFetch) return;

    setFallbackLoading(true);
    setFallbackError(null);
    try {
      const result = await options.fallbackFetch();
      setFallbackData(result);
    } catch (err) {
      setFallbackError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setFallbackLoading(false);
    }
  }, [options?.fallbackFetch]);

  return {
    data: fallbackData,
    isLoading: fallbackLoading,
    error: fallbackError,
    refresh: fetchFallback,
  };
}
