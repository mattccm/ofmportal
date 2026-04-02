"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ============================================
// TYPES
// ============================================

export interface UseInfiniteScrollOptions {
  /** Callback to fetch more items */
  onLoadMore: () => Promise<void>;
  /** Whether there are more items to load */
  hasMore: boolean;
  /** Whether currently loading */
  isLoading?: boolean;
  /** Root margin for intersection observer (pixels before element is visible) */
  rootMargin?: string;
  /** Threshold for intersection observer (0-1) */
  threshold?: number;
  /** Whether infinite scroll is enabled */
  enabled?: boolean;
  /** Delay before triggering load more (debounce) */
  debounceMs?: number;
}

export interface UseInfiniteScrollReturn {
  /** Ref to attach to the sentinel element (bottom of list) */
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  /** Whether currently loading */
  isLoading: boolean;
  /** Whether there are more items to load */
  hasMore: boolean;
  /** Whether we've reached the end of the list */
  isEndReached: boolean;
  /** Error state */
  error: Error | null;
  /** Retry loading after an error */
  retry: () => void;
  /** Reset the infinite scroll state */
  reset: () => void;
}

// ============================================
// HOOK IMPLEMENTATION
// ============================================

export function useInfiniteScroll(
  options: UseInfiniteScrollOptions
): UseInfiniteScrollReturn {
  const {
    onLoadMore,
    hasMore,
    isLoading: externalLoading = false,
    rootMargin = "100px",
    threshold = 0.1,
    enabled = true,
    debounceMs = 100,
  } = options;

  const sentinelRef = useRef<HTMLDivElement>(null);
  const [internalLoading, setInternalLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isEndReached, setIsEndReached] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const loadingRef = useRef(false);

  // Combined loading state
  const isLoading = externalLoading || internalLoading;

  // Load more function with error handling
  const loadMore = useCallback(async () => {
    // Prevent multiple simultaneous loads
    if (loadingRef.current || !hasMore || !enabled) {
      return;
    }

    loadingRef.current = true;
    setInternalLoading(true);
    setError(null);

    try {
      await onLoadMore();
      if (isMountedRef.current) {
        setError(null);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error("Failed to load more items"));
      }
    } finally {
      if (isMountedRef.current) {
        setInternalLoading(false);
        loadingRef.current = false;
      }
    }
  }, [onLoadMore, hasMore, enabled]);

  // Debounced load more
  const debouncedLoadMore = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      loadMore();
    }, debounceMs);
  }, [loadMore, debounceMs]);

  // Retry function
  const retry = useCallback(() => {
    setError(null);
    loadMore();
  }, [loadMore]);

  // Reset function
  const reset = useCallback(() => {
    setError(null);
    setIsEndReached(false);
    setInternalLoading(false);
    loadingRef.current = false;
  }, []);

  // Update end reached state
  useEffect(() => {
    setIsEndReached(!hasMore && !isLoading);
  }, [hasMore, isLoading]);

  // Set up Intersection Observer
  useEffect(() => {
    isMountedRef.current = true;

    const sentinel = sentinelRef.current;
    if (!sentinel || !enabled) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !loadingRef.current && !error) {
          debouncedLoadMore();
        }
      },
      {
        rootMargin,
        threshold,
      }
    );

    observer.observe(sentinel);

    return () => {
      isMountedRef.current = false;
      observer.disconnect();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [enabled, hasMore, error, rootMargin, threshold, debouncedLoadMore]);

  return {
    sentinelRef,
    isLoading,
    hasMore,
    isEndReached,
    error,
    retry,
    reset,
  };
}

// ============================================
// SCROLL POSITION PRESERVATION HOOK
// ============================================

export interface UseScrollPositionOptions {
  /** Unique key to identify the scroll position */
  key: string;
  /** Whether to restore position on mount */
  restoreOnMount?: boolean;
  /** Whether to save position on unmount */
  saveOnUnmount?: boolean;
}

// Cache for scroll positions with max size limit to prevent memory leaks
const MAX_SCROLL_CACHE_SIZE = 50;
const scrollPositions = new Map<string, number>();

// Clean up oldest entries when cache exceeds max size
function pruneScrollCache() {
  if (scrollPositions.size > MAX_SCROLL_CACHE_SIZE) {
    // Remove the oldest entries (first inserted)
    const keysToRemove = Array.from(scrollPositions.keys()).slice(0, scrollPositions.size - MAX_SCROLL_CACHE_SIZE);
    for (const key of keysToRemove) {
      scrollPositions.delete(key);
    }
  }
}

export function useScrollPosition(options: UseScrollPositionOptions) {
  const { key, restoreOnMount = true, saveOnUnmount = true } = options;
  const containerRef = useRef<HTMLDivElement>(null);
  const savedPositionRef = useRef<number>(0);

  // Save current scroll position
  const savePosition = useCallback(() => {
    const container = containerRef.current;
    if (container) {
      scrollPositions.set(key, container.scrollTop);
      savedPositionRef.current = container.scrollTop;
      // Prune cache if it gets too large
      pruneScrollCache();
    }
  }, [key]);

  // Restore scroll position
  const restorePosition = useCallback(() => {
    const container = containerRef.current;
    const savedPosition = scrollPositions.get(key);
    if (container && savedPosition !== undefined) {
      container.scrollTop = savedPosition;
    }
  }, [key]);

  // Restore on mount
  useEffect(() => {
    if (restoreOnMount) {
      // Use setTimeout to ensure content is rendered
      const timer = setTimeout(restorePosition, 0);
      return () => clearTimeout(timer);
    }
  }, [restoreOnMount, restorePosition]);

  // Save on unmount
  useEffect(() => {
    return () => {
      if (saveOnUnmount) {
        savePosition();
      }
    };
  }, [saveOnUnmount, savePosition]);

  // Clear saved position
  const clearPosition = useCallback(() => {
    scrollPositions.delete(key);
    savedPositionRef.current = 0;
  }, [key]);

  return {
    containerRef,
    savePosition,
    restorePosition,
    clearPosition,
    getSavedPosition: () => scrollPositions.get(key) ?? 0,
  };
}

// ============================================
// SCROLL TO TOP HOOK
// ============================================

export interface UseScrollToTopOptions {
  /** Threshold in pixels to show the button */
  threshold?: number;
  /** Whether to use smooth scrolling */
  smooth?: boolean;
}

export function useScrollToTop(options: UseScrollToTopOptions = {}) {
  const { threshold = 400, smooth = true } = options;
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Check scroll position
  const checkScrollPosition = useCallback(() => {
    const container = containerRef.current || document.documentElement;
    const scrollTop = containerRef.current
      ? container.scrollTop
      : window.scrollY;
    setIsVisible(scrollTop > threshold);
  }, [threshold]);

  // Scroll to top
  const scrollToTop = useCallback(() => {
    const container = containerRef.current;
    if (container) {
      container.scrollTo({
        top: 0,
        behavior: smooth ? "smooth" : "auto",
      });
    } else {
      window.scrollTo({
        top: 0,
        behavior: smooth ? "smooth" : "auto",
      });
    }
  }, [smooth]);

  // Set up scroll listener
  useEffect(() => {
    const container = containerRef.current;
    const target = container || window;

    target.addEventListener("scroll", checkScrollPosition, { passive: true });
    checkScrollPosition(); // Check initial position

    return () => {
      target.removeEventListener("scroll", checkScrollPosition);
    };
  }, [checkScrollPosition]);

  return {
    containerRef,
    isVisible,
    scrollToTop,
  };
}

export default useInfiniteScroll;
