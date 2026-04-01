"use client";

import * as React from "react";
import { useCallback, useEffect, useRef } from "react";

// ============================================
// TYPES
// ============================================

interface FocusTrapProps {
  children: React.ReactNode;
  /** Whether the focus trap is active */
  active?: boolean;
  /** Element to return focus to when trap is deactivated */
  returnFocusRef?: React.RefObject<HTMLElement>;
  /** Called when escape key is pressed */
  onEscape?: () => void;
  /** Whether to auto-focus the first focusable element */
  autoFocus?: boolean;
  /** Whether to restore focus when trap is deactivated */
  restoreFocus?: boolean;
  /** Initial element to focus (selector or ref) */
  initialFocus?: string | React.RefObject<HTMLElement>;
  /** Element to focus when shift+tab from first element */
  finalFocus?: string | React.RefObject<HTMLElement>;
  /** Additional class name */
  className?: string;
}

// ============================================
// FOCUSABLE ELEMENTS SELECTOR
// ============================================

const FOCUSABLE_ELEMENTS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
  'audio[controls]',
  'video[controls]',
  'details > summary',
].join(', ');

// ============================================
// HOOKS
// ============================================

/**
 * Hook to manage focus within a container
 */
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  options: {
    active?: boolean;
    onEscape?: () => void;
    autoFocus?: boolean;
    restoreFocus?: boolean;
    initialFocus?: string | React.RefObject<HTMLElement>;
  } = {}
) {
  const {
    active = true,
    onEscape,
    autoFocus = true,
    restoreFocus = true,
    initialFocus,
  } = options;

  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Get all focusable elements within the container
  const getFocusableElements = useCallback((): HTMLElement[] => {
    if (!containerRef.current) return [];

    const elements = containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_ELEMENTS);
    return Array.from(elements).filter(
      (el) => el.offsetParent !== null && !el.hasAttribute('inert')
    );
  }, [containerRef]);

  // Get initial element to focus
  const getInitialFocusElement = useCallback((): HTMLElement | null => {
    if (!containerRef.current) return null;

    // If initialFocus is a ref
    if (initialFocus && typeof initialFocus !== 'string') {
      return initialFocus.current;
    }

    // If initialFocus is a selector
    if (initialFocus && typeof initialFocus === 'string') {
      return containerRef.current.querySelector<HTMLElement>(initialFocus);
    }

    // Default to first focusable element
    const focusable = getFocusableElements();
    return focusable[0] || null;
  }, [containerRef, initialFocus, getFocusableElements]);

  // Handle keydown events
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!active || !containerRef.current) return;

      // Handle Escape key
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onEscape?.();
        return;
      }

      // Handle Tab key
      if (event.key === 'Tab') {
        const focusable = getFocusableElements();
        if (focusable.length === 0) {
          event.preventDefault();
          return;
        }

        const firstElement = focusable[0];
        const lastElement = focusable[focusable.length - 1];
        const activeElement = document.activeElement as HTMLElement;

        // Shift + Tab from first element -> go to last element
        if (event.shiftKey && activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
          return;
        }

        // Tab from last element -> go to first element
        if (!event.shiftKey && activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
          return;
        }

        // If focus is outside the container, trap it
        if (!containerRef.current.contains(activeElement)) {
          event.preventDefault();
          if (event.shiftKey) {
            lastElement.focus();
          } else {
            firstElement.focus();
          }
        }
      }
    },
    [active, containerRef, getFocusableElements, onEscape]
  );

  // Store previous active element and focus initial element
  useEffect(() => {
    if (!active) return;

    // Store the currently focused element
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Auto-focus the initial element
    if (autoFocus) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        const initialElement = getInitialFocusElement();
        if (initialElement) {
          initialElement.focus();
        }
      });
    }

    // Add keydown listener
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);

      // Restore focus when trap is deactivated
      if (restoreFocus && previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [active, autoFocus, restoreFocus, handleKeyDown, getInitialFocusElement]);

  return {
    getFocusableElements,
    focusFirst: () => {
      const elements = getFocusableElements();
      elements[0]?.focus();
    },
    focusLast: () => {
      const elements = getFocusableElements();
      elements[elements.length - 1]?.focus();
    },
  };
}

// ============================================
// FOCUS TRAP COMPONENT
// ============================================

/**
 * Focus trap component that keeps focus within its children.
 * Useful for modals, dialogs, and other overlay components.
 */
export function FocusTrap({
  children,
  active = true,
  returnFocusRef,
  onEscape,
  autoFocus = true,
  restoreFocus = true,
  initialFocus,
  className,
}: FocusTrapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useFocusTrap(containerRef, {
    active,
    onEscape,
    autoFocus,
    restoreFocus: restoreFocus && !returnFocusRef,
    initialFocus,
  });

  // Handle custom return focus
  useEffect(() => {
    if (!active) return;

    return () => {
      if (returnFocusRef?.current) {
        returnFocusRef.current.focus();
      }
    };
  }, [active, returnFocusRef]);

  // Focus guard elements at start and end for seamless tabbing
  const handleStartGuardFocus = useCallback(() => {
    if (!containerRef.current) return;
    const focusable = containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_ELEMENTS);
    const elements = Array.from(focusable).filter((el) => el.offsetParent !== null);
    elements[elements.length - 1]?.focus();
  }, []);

  const handleEndGuardFocus = useCallback(() => {
    if (!containerRef.current) return;
    const focusable = containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_ELEMENTS);
    const elements = Array.from(focusable).filter((el) => el.offsetParent !== null);
    elements[0]?.focus();
  }, []);

  if (!active) {
    return <>{children}</>;
  }

  return (
    <>
      {/* Start focus guard */}
      <div
        tabIndex={0}
        onFocus={handleStartGuardFocus}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: 1,
          height: 0,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
        aria-hidden="true"
      />

      <div ref={containerRef} className={className}>
        {children}
      </div>

      {/* End focus guard */}
      <div
        tabIndex={0}
        onFocus={handleEndGuardFocus}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: 1,
          height: 0,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
        aria-hidden="true"
      />
    </>
  );
}

// ============================================
// FOCUS SCOPE - More flexible alternative
// ============================================

interface FocusScopeProps {
  children: React.ReactNode;
  /** Whether focus should loop within the scope */
  loop?: boolean;
  /** Whether to trap focus (prevent tabbing outside) */
  trapped?: boolean;
  /** Called when trying to tab outside scope */
  onMountAutoFocus?: (event: Event) => void;
  onUnmountAutoFocus?: (event: Event) => void;
}

/**
 * Focus scope provides more flexible focus management.
 * Can be used for both looping focus and trapping focus.
 */
export function FocusScope({
  children,
  loop = false,
  trapped = false,
  onMountAutoFocus,
  onUnmountAutoFocus,
}: FocusScopeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<HTMLSpanElement>(null);
  const endRef = useRef<HTMLSpanElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Store previous focus
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Auto focus on mount
    const mountEvent = new CustomEvent('focusscope.mount');
    if (onMountAutoFocus) {
      container.addEventListener('focusscope.mount', onMountAutoFocus as EventListener, { once: true });
      container.dispatchEvent(mountEvent);
    }

    // Focus first focusable element
    if (trapped) {
      const focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE_ELEMENTS);
      const elements = Array.from(focusable).filter((el) => el.offsetParent !== null);
      elements[0]?.focus();
    }

    return () => {
      // Auto focus on unmount
      const unmountEvent = new CustomEvent('focusscope.unmount');
      if (onUnmountAutoFocus) {
        container.addEventListener('focusscope.unmount', onUnmountAutoFocus as EventListener, { once: true });
        container.dispatchEvent(unmountEvent);
      }

      // Restore focus
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [trapped, onMountAutoFocus, onUnmountAutoFocus]);

  const handleBoundaryFocus = useCallback(
    (boundary: 'start' | 'end') => {
      if (!containerRef.current) return;

      const focusable = containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_ELEMENTS);
      const elements = Array.from(focusable).filter((el) => el.offsetParent !== null);

      if (elements.length === 0) return;

      if (loop || trapped) {
        if (boundary === 'start') {
          elements[elements.length - 1].focus();
        } else {
          elements[0].focus();
        }
      }
    },
    [loop, trapped]
  );

  return (
    <div ref={containerRef}>
      {(loop || trapped) && (
        <span
          ref={startRef}
          tabIndex={0}
          onFocus={() => handleBoundaryFocus('start')}
          style={{ outline: 'none' }}
          aria-hidden="true"
        />
      )}
      {children}
      {(loop || trapped) && (
        <span
          ref={endRef}
          tabIndex={0}
          onFocus={() => handleBoundaryFocus('end')}
          style={{ outline: 'none' }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

// ============================================
// EXPORTS
// ============================================

export default FocusTrap;
