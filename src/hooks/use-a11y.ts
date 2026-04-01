"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import {
  announce,
  announceAssertive,
  prefersReducedMotion,
  prefersHighContrast,
  watchA11yPreferences,
  focusFirst,
  focusById,
  saveFocus,
  createKeyboardNavigation,
  type ArrowDirection,
} from "@/lib/a11y-utils";

// ============================================
// ANNOUNCEMENT HOOKS
// ============================================

/**
 * Hook for making screen reader announcements
 */
export function useAnnounce() {
  const announceRef = useRef<(() => void) | null>(null);

  const announceMessage = useCallback((message: string, assertive = false) => {
    // Clear previous announcement
    if (announceRef.current) {
      announceRef.current();
    }

    // Make new announcement
    if (assertive) {
      announceRef.current = announceAssertive(message);
    } else {
      announceRef.current = announce(message);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (announceRef.current) {
        announceRef.current();
      }
    };
  }, []);

  return announceMessage;
}

/**
 * Hook for announcing loading states
 */
export function useLoadingAnnounce(isLoading: boolean, loadingText = "Loading", loadedText = "Loaded") {
  const announce = useAnnounce();
  const wasLoadingRef = useRef(false);

  useEffect(() => {
    if (isLoading && !wasLoadingRef.current) {
      announce(loadingText);
    } else if (!isLoading && wasLoadingRef.current) {
      announce(loadedText);
    }
    wasLoadingRef.current = isLoading;
  }, [isLoading, loadingText, loadedText, announce]);
}

// ============================================
// FOCUS MANAGEMENT HOOKS
// ============================================

/**
 * Hook to focus an element on mount
 */
export function useFocusOnMount<T extends HTMLElement>(options?: {
  delay?: number;
  preventScroll?: boolean;
}) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const { delay = 0, preventScroll = false } = options || {};

    const focus = () => {
      if (ref.current) {
        ref.current.focus({ preventScroll });
      }
    };

    if (delay > 0) {
      const timeoutId = setTimeout(focus, delay);
      return () => clearTimeout(timeoutId);
    } else {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(focus);
    }
  }, [options]);

  return ref;
}

/**
 * Hook to restore focus when component unmounts
 */
export function useFocusRestore() {
  const restoreFocusRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    restoreFocusRef.current = saveFocus();

    return () => {
      if (restoreFocusRef.current) {
        restoreFocusRef.current();
      }
    };
  }, []);
}

/**
 * Hook to focus the first focusable element in a container
 */
export function useFocusFirst<T extends HTMLElement>() {
  const containerRef = useRef<T>(null);

  const focus = useCallback(() => {
    if (containerRef.current) {
      focusFirst(containerRef.current);
    }
  }, []);

  return { containerRef, focus };
}

/**
 * Hook to focus an element by ID
 */
export function useFocusById() {
  return useCallback((id: string, options?: { preventScroll?: boolean; delay?: number }) => {
    focusById(id, options);
  }, []);
}

// ============================================
// KEYBOARD NAVIGATION HOOKS
// ============================================

/**
 * Hook for arrow key navigation within a container
 */
export function useArrowNavigation<T extends HTMLElement>(
  options: {
    direction?: ArrowDirection;
    loop?: boolean;
    selector?: string;
    onSelect?: (element: HTMLElement, index: number) => void;
  } = {}
) {
  const containerRef = useRef<T>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const cleanup = createKeyboardNavigation(containerRef.current, options);
    return cleanup;
  }, [options]);

  return containerRef;
}

/**
 * Hook for handling escape key
 */
export function useEscapeKey(handler: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handler();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handler, enabled]);
}

/**
 * Hook for handling keyboard shortcuts
 */
export function useKeyboardShortcut(
  key: string,
  handler: () => void,
  options: {
    ctrlKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
    metaKey?: boolean;
    enabled?: boolean;
    preventDefault?: boolean;
  } = {}
) {
  const {
    ctrlKey = false,
    shiftKey = false,
    altKey = false,
    metaKey = false,
    enabled = true,
    preventDefault = true,
  } = options;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const matchesKey = event.key.toLowerCase() === key.toLowerCase();
      const matchesModifiers =
        event.ctrlKey === ctrlKey &&
        event.shiftKey === shiftKey &&
        event.altKey === altKey &&
        event.metaKey === metaKey;

      if (matchesKey && matchesModifiers) {
        if (preventDefault) {
          event.preventDefault();
        }
        handler();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [key, handler, ctrlKey, shiftKey, altKey, metaKey, enabled, preventDefault]);
}

// ============================================
// PREFERENCE HOOKS
// ============================================

/**
 * Hook to detect reduced motion preference
 */
export function useReducedMotion() {
  const [prefersReduced, setPrefersReduced] = useState(() => {
    if (typeof window === "undefined") return false;
    return prefersReducedMotion();
  });

  useEffect(() => {
    const cleanup = watchA11yPreferences({
      onReducedMotionChange: setPrefersReduced,
    });
    return cleanup;
  }, []);

  return prefersReduced;
}

/**
 * Hook to detect high contrast preference
 */
export function useHighContrast() {
  const [prefersHigh, setPrefersHigh] = useState(() => {
    if (typeof window === "undefined") return false;
    return prefersHighContrast();
  });

  useEffect(() => {
    const cleanup = watchA11yPreferences({
      onHighContrastChange: setPrefersHigh,
    });
    return cleanup;
  }, []);

  return prefersHigh;
}

/**
 * Hook to detect if user is navigating with keyboard
 */
export function useIsKeyboardUser() {
  const [isKeyboard, setIsKeyboard] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        setIsKeyboard(true);
      }
    };

    const handleMouseDown = () => {
      setIsKeyboard(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handleMouseDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleMouseDown);
    };
  }, []);

  return isKeyboard;
}

// ============================================
// ARIA HOOKS
// ============================================

/**
 * Hook for managing aria-expanded state
 */
export function useAriaExpanded(defaultExpanded = false) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const toggle = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const ariaProps = {
    "aria-expanded": isExpanded,
    onClick: toggle,
  };

  return { isExpanded, setIsExpanded, toggle, ariaProps };
}

/**
 * Hook for managing aria-selected state
 */
export function useAriaSelected<T>(
  items: T[],
  defaultSelected?: T,
  onSelect?: (item: T) => void
) {
  const [selected, setSelected] = useState<T | undefined>(defaultSelected);

  const select = useCallback(
    (item: T) => {
      setSelected(item);
      onSelect?.(item);
    },
    [onSelect]
  );

  const getItemProps = useCallback(
    (item: T) => ({
      "aria-selected": selected === item,
      onClick: () => select(item),
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          select(item);
        }
      },
    }),
    [selected, select]
  );

  return { selected, select, getItemProps };
}

/**
 * Hook for managing aria-checked state (for checkboxes/switches)
 */
export function useAriaChecked(defaultChecked = false, onChange?: (checked: boolean) => void) {
  const [isChecked, setIsChecked] = useState(defaultChecked);

  const toggle = useCallback(() => {
    setIsChecked((prev) => {
      const newValue = !prev;
      onChange?.(newValue);
      return newValue;
    });
  }, [onChange]);

  const ariaProps = {
    role: "checkbox" as const,
    "aria-checked": isChecked,
    tabIndex: 0,
    onClick: toggle,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    },
  };

  return { isChecked, setIsChecked, toggle, ariaProps };
}

// ============================================
// ID GENERATION
// ============================================

let idCounter = 0;

/**
 * Hook to generate unique IDs for accessibility attributes
 */
export function useA11yId(prefix = "a11y") {
  const idRef = useRef<string | null>(null);

  if (idRef.current === null) {
    idRef.current = `${prefix}-${++idCounter}`;
  }

  return idRef.current;
}

/**
 * Hook to generate related IDs (for aria-describedby, aria-labelledby, etc.)
 */
export function useA11yIds(prefix = "a11y") {
  const baseId = useA11yId(prefix);

  return {
    id: baseId,
    labelId: `${baseId}-label`,
    descriptionId: `${baseId}-description`,
    errorId: `${baseId}-error`,
    hintId: `${baseId}-hint`,
  };
}

// ============================================
// LIVE REGION HOOK
// ============================================

/**
 * Hook to create a local live region for announcements
 */
export function useLiveRegion(politeness: "polite" | "assertive" = "polite") {
  const [message, setMessage] = useState("");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const announceMessage = useCallback(
    (text: string, clearAfter = 5000) => {
      // Clear previous timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Clear then set to ensure announcement
      setMessage("");
      requestAnimationFrame(() => {
        setMessage(text);
      });

      // Clear after delay
      if (clearAfter > 0) {
        timeoutRef.current = setTimeout(() => {
          setMessage("");
        }, clearAfter);
      }
    },
    []
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const liveRegionProps = {
    role: "status" as const,
    "aria-live": politeness,
    "aria-atomic": true,
    className: "sr-only",
  };

  return { message, announce: announceMessage, liveRegionProps };
}

// ============================================
// EXPORTS
// ============================================

export default {
  useAnnounce,
  useLoadingAnnounce,
  useFocusOnMount,
  useFocusRestore,
  useFocusFirst,
  useFocusById,
  useArrowNavigation,
  useEscapeKey,
  useKeyboardShortcut,
  useReducedMotion,
  useHighContrast,
  useIsKeyboardUser,
  useAriaExpanded,
  useAriaSelected,
  useAriaChecked,
  useA11yId,
  useA11yIds,
  useLiveRegion,
};
