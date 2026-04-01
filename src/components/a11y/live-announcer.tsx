"use client";

import * as React from "react";
import { createContext, useContext, useCallback, useRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

export type AnnouncementPoliteness = 'polite' | 'assertive' | 'off';

export interface Announcement {
  id: string;
  message: string;
  politeness: AnnouncementPoliteness;
  timestamp: number;
}

interface LiveAnnouncerContextValue {
  /** Announce a message to screen readers (polite) */
  announce: (message: string) => void;
  /** Announce an important message (assertive) */
  announceAssertive: (message: string) => void;
  /** Announce with custom politeness */
  announceWithPoliteness: (message: string, politeness: AnnouncementPoliteness) => void;
  /** Clear all announcements */
  clearAnnouncements: () => void;
  /** Recent announcements (for debugging/logging) */
  recentAnnouncements: Announcement[];
}

// ============================================
// CONTEXT
// ============================================

const LiveAnnouncerContext = createContext<LiveAnnouncerContextValue | null>(null);

export function useLiveAnnouncer() {
  const context = useContext(LiveAnnouncerContext);
  if (!context) {
    // Return a no-op implementation if not within provider
    // This allows components to use hooks without strict provider requirements
    return {
      announce: () => {},
      announceAssertive: () => {},
      announceWithPoliteness: () => {},
      clearAnnouncements: () => {},
      recentAnnouncements: [],
    };
  }
  return context;
}

// ============================================
// PROVIDER
// ============================================

interface LiveAnnouncerProviderProps {
  children: React.ReactNode;
  /** Maximum number of recent announcements to keep */
  maxRecentAnnouncements?: number;
  /** Time to clear announcement after (ms) */
  clearAfter?: number;
}

export function LiveAnnouncerProvider({
  children,
  maxRecentAnnouncements = 10,
  clearAfter = 5000,
}: LiveAnnouncerProviderProps) {
  const [politeMessage, setPoliteMessage] = useState('');
  const [assertiveMessage, setAssertiveMessage] = useState('');
  const [recentAnnouncements, setRecentAnnouncements] = useState<Announcement[]>([]);

  const politeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assertiveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const announcementIdRef = useRef(0);

  // Add announcement to recent list
  const addToRecent = useCallback(
    (message: string, politeness: AnnouncementPoliteness) => {
      const announcement: Announcement = {
        id: `announcement-${++announcementIdRef.current}`,
        message,
        politeness,
        timestamp: Date.now(),
      };

      setRecentAnnouncements((prev) => {
        const updated = [announcement, ...prev];
        return updated.slice(0, maxRecentAnnouncements);
      });
    },
    [maxRecentAnnouncements]
  );

  // Announce with politeness
  const announceWithPoliteness = useCallback(
    (message: string, politeness: AnnouncementPoliteness) => {
      if (politeness === 'off' || !message) return;

      addToRecent(message, politeness);

      if (politeness === 'polite') {
        // Clear existing timeout
        if (politeTimeoutRef.current) {
          clearTimeout(politeTimeoutRef.current);
        }

        // Clear then set to ensure announcement
        setPoliteMessage('');
        requestAnimationFrame(() => {
          setPoliteMessage(message);
        });

        // Clear after timeout
        politeTimeoutRef.current = setTimeout(() => {
          setPoliteMessage('');
        }, clearAfter);
      } else if (politeness === 'assertive') {
        // Clear existing timeout
        if (assertiveTimeoutRef.current) {
          clearTimeout(assertiveTimeoutRef.current);
        }

        // Clear then set to ensure announcement
        setAssertiveMessage('');
        requestAnimationFrame(() => {
          setAssertiveMessage(message);
        });

        // Clear after timeout
        assertiveTimeoutRef.current = setTimeout(() => {
          setAssertiveMessage('');
        }, clearAfter);
      }
    },
    [addToRecent, clearAfter]
  );

  // Convenience methods
  const announce = useCallback(
    (message: string) => announceWithPoliteness(message, 'polite'),
    [announceWithPoliteness]
  );

  const announceAssertive = useCallback(
    (message: string) => announceWithPoliteness(message, 'assertive'),
    [announceWithPoliteness]
  );

  const clearAnnouncements = useCallback(() => {
    setPoliteMessage('');
    setAssertiveMessage('');
    if (politeTimeoutRef.current) clearTimeout(politeTimeoutRef.current);
    if (assertiveTimeoutRef.current) clearTimeout(assertiveTimeoutRef.current);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (politeTimeoutRef.current) clearTimeout(politeTimeoutRef.current);
      if (assertiveTimeoutRef.current) clearTimeout(assertiveTimeoutRef.current);
    };
  }, []);

  return (
    <LiveAnnouncerContext.Provider
      value={{
        announce,
        announceAssertive,
        announceWithPoliteness,
        clearAnnouncements,
        recentAnnouncements,
      }}
    >
      {children}
      {/* Polite live region */}
      <LiveRegion politeness="polite" message={politeMessage} />
      {/* Assertive live region */}
      <LiveRegion politeness="assertive" message={assertiveMessage} />
    </LiveAnnouncerContext.Provider>
  );
}

// ============================================
// LIVE REGION COMPONENT
// ============================================

interface LiveRegionProps {
  politeness: 'polite' | 'assertive';
  message: string;
  className?: string;
}

function LiveRegion({ politeness, message, className }: LiveRegionProps) {
  return (
    <div
      role="status"
      aria-live={politeness}
      aria-atomic="true"
      aria-relevant="additions text"
      className={cn(
        // Visually hidden but accessible to screen readers
        "sr-only",
        className
      )}
      style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: '0',
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: '0',
      }}
    >
      {message}
    </div>
  );
}

// ============================================
// STANDALONE LIVE REGIONS
// ============================================

interface AriaLiveRegionProps {
  children: React.ReactNode;
  /** Politeness level */
  politeness?: AnnouncementPoliteness;
  /** Whether the entire region should be read */
  atomic?: boolean;
  /** What types of changes should be announced */
  relevant?: 'additions' | 'removals' | 'text' | 'all' | 'additions text';
  /** Additional class name */
  className?: string;
  /** Whether to visually hide the region */
  visuallyHidden?: boolean;
}

/**
 * A standalone aria-live region component for inline announcements
 */
export function AriaLiveRegion({
  children,
  politeness = 'polite',
  atomic = true,
  relevant = 'additions text',
  className,
  visuallyHidden = false,
}: AriaLiveRegionProps) {
  return (
    <div
      role="status"
      aria-live={politeness}
      aria-atomic={atomic}
      aria-relevant={relevant}
      className={cn(visuallyHidden && 'sr-only', className)}
    >
      {children}
    </div>
  );
}

/**
 * A visually hidden alert that announces immediately
 */
export function AriaAlert({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div role="alert" aria-live="assertive" className={cn('sr-only', className)}>
      {children}
    </div>
  );
}

/**
 * Status announcement that updates screen reader users
 */
export function AriaStatus({
  children,
  className,
  visuallyHidden = true,
}: {
  children: React.ReactNode;
  className?: string;
  visuallyHidden?: boolean;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={cn(visuallyHidden && 'sr-only', className)}
    >
      {children}
    </div>
  );
}

// ============================================
// HOOKS FOR COMMON PATTERNS
// ============================================

/**
 * Hook for announcing loading states
 */
export function useLoadingAnnouncement() {
  const { announce, announceAssertive } = useLiveAnnouncer();

  return {
    announceLoading: (item?: string) => {
      announce(item ? `Loading ${item}...` : 'Loading...');
    },
    announceLoaded: (item?: string) => {
      announce(item ? `${item} loaded` : 'Content loaded');
    },
    announceError: (message?: string) => {
      announceAssertive(message || 'An error occurred');
    },
  };
}

/**
 * Hook for announcing form validation
 */
export function useFormAnnouncement() {
  const { announce, announceAssertive } = useLiveAnnouncer();

  return {
    announceValidationError: (fieldName: string, error: string) => {
      announceAssertive(`${fieldName}: ${error}`);
    },
    announceFormErrors: (errorCount: number) => {
      if (errorCount === 0) return;
      announceAssertive(
        `Form has ${errorCount} ${errorCount === 1 ? 'error' : 'errors'}. Please correct and try again.`
      );
    },
    announceSubmitting: () => {
      announce('Submitting form...');
    },
    announceSubmitted: () => {
      announce('Form submitted successfully');
    },
    announceSubmitError: (message?: string) => {
      announceAssertive(message || 'Failed to submit form. Please try again.');
    },
  };
}

/**
 * Hook for announcing navigation
 */
export function useNavigationAnnouncement() {
  const { announce } = useLiveAnnouncer();

  return {
    announcePageChange: (pageName: string) => {
      announce(`Navigated to ${pageName}`);
    },
    announceSectionChange: (sectionName: string) => {
      announce(`Now viewing ${sectionName}`);
    },
  };
}

/**
 * Hook for announcing list/table updates
 */
export function useListAnnouncement() {
  const { announce } = useLiveAnnouncer();

  return {
    announceItemAdded: (itemName?: string) => {
      announce(itemName ? `${itemName} added` : 'Item added');
    },
    announceItemRemoved: (itemName?: string) => {
      announce(itemName ? `${itemName} removed` : 'Item removed');
    },
    announceItemUpdated: (itemName?: string) => {
      announce(itemName ? `${itemName} updated` : 'Item updated');
    },
    announceListFiltered: (count: number, filterDescription?: string) => {
      const countText = `${count} ${count === 1 ? 'item' : 'items'}`;
      const message = filterDescription
        ? `Showing ${countText} ${filterDescription}`
        : `Showing ${countText}`;
      announce(message);
    },
    announceSorted: (column: string, direction: 'ascending' | 'descending') => {
      announce(`Sorted by ${column}, ${direction}`);
    },
  };
}

// ============================================
// EXPORTS
// ============================================

export default LiveAnnouncerProvider;
