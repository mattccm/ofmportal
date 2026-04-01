"use client";

import * as React from "react";
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

interface KeyboardOnlyContextValue {
  /** Whether the user is currently navigating with keyboard */
  isKeyboardUser: boolean;
  /** Force keyboard mode on */
  enableKeyboardMode: () => void;
  /** Force keyboard mode off */
  disableKeyboardMode: () => void;
}

// ============================================
// CONTEXT
// ============================================

const KeyboardOnlyContext = createContext<KeyboardOnlyContextValue>({
  isKeyboardUser: false,
  enableKeyboardMode: () => {},
  disableKeyboardMode: () => {},
});

export function useKeyboardOnly() {
  return useContext(KeyboardOnlyContext);
}

// ============================================
// PROVIDER
// ============================================

interface KeyboardOnlyProviderProps {
  children: React.ReactNode;
}

/**
 * Provider that tracks whether the user is navigating with keyboard.
 * This allows showing focus indicators only for keyboard users.
 */
export function KeyboardOnlyProvider({ children }: KeyboardOnlyProviderProps) {
  const [isKeyboardUser, setIsKeyboardUser] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Tab key indicates keyboard navigation
      if (e.key === 'Tab') {
        setIsKeyboardUser(true);
        document.documentElement.classList.add('keyboard-user');
      }
    };

    const handleMouseDown = () => {
      setIsKeyboardUser(false);
      document.documentElement.classList.remove('keyboard-user');
    };

    // Also track touch events
    const handleTouchStart = () => {
      setIsKeyboardUser(false);
      document.documentElement.classList.remove('keyboard-user');
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('touchstart', handleTouchStart);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('touchstart', handleTouchStart);
    };
  }, []);

  const enableKeyboardMode = useCallback(() => {
    setIsKeyboardUser(true);
    document.documentElement.classList.add('keyboard-user');
  }, []);

  const disableKeyboardMode = useCallback(() => {
    setIsKeyboardUser(false);
    document.documentElement.classList.remove('keyboard-user');
  }, []);

  return (
    <KeyboardOnlyContext.Provider
      value={{ isKeyboardUser, enableKeyboardMode, disableKeyboardMode }}
    >
      {children}
    </KeyboardOnlyContext.Provider>
  );
}

// ============================================
// KEYBOARD ONLY CONTENT
// ============================================

interface KeyboardOnlyProps {
  children: React.ReactNode;
  /** Show for keyboard users only (default) or mouse users only */
  showFor?: 'keyboard' | 'mouse';
  /** Fallback content for the opposite mode */
  fallback?: React.ReactNode;
  className?: string;
}

/**
 * Conditionally renders content based on input mode.
 * Useful for showing different instructions or UI for keyboard vs mouse users.
 */
export function KeyboardOnly({
  children,
  showFor = 'keyboard',
  fallback,
  className,
}: KeyboardOnlyProps) {
  const { isKeyboardUser } = useKeyboardOnly();

  const shouldShow =
    (showFor === 'keyboard' && isKeyboardUser) ||
    (showFor === 'mouse' && !isKeyboardUser);

  if (!shouldShow) {
    return fallback ? <>{fallback}</> : null;
  }

  return <div className={className}>{children}</div>;
}

// ============================================
// KEYBOARD FOCUS RING
// ============================================

interface KeyboardFocusRingProps {
  children: React.ReactNode;
  className?: string;
  /** Ring color */
  color?: 'primary' | 'destructive' | 'ring';
  /** Ring offset */
  offset?: number;
}

/**
 * Wrapper that adds a visible focus ring only for keyboard users.
 * The ring appears when the child element receives keyboard focus.
 */
export function KeyboardFocusRing({
  children,
  className,
  color = 'ring',
  offset = 2,
}: KeyboardFocusRingProps) {
  const colorClasses = {
    primary: 'focus-within:ring-primary',
    destructive: 'focus-within:ring-destructive',
    ring: 'focus-within:ring-ring',
  };

  return (
    <div
      className={cn(
        // Only show focus ring for keyboard users
        "keyboard-user:focus-within:ring-2",
        colorClasses[color],
        `focus-within:ring-offset-${offset}`,
        "focus-within:ring-offset-background",
        "rounded-md transition-shadow duration-200",
        className
      )}
    >
      {children}
    </div>
  );
}

// ============================================
// FOCUS VISIBLE WRAPPER
// ============================================

interface FocusVisibleProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Wrapper that applies styles only when focus-visible is active.
 * Uses the native :focus-visible pseudo-class with a wrapper.
 */
export function FocusVisible({ children, className }: FocusVisibleProps) {
  return (
    <div
      className={cn(
        "[&:focus-visible]:outline-none",
        "[&:focus-visible]:ring-2",
        "[&:focus-visible]:ring-ring",
        "[&:focus-visible]:ring-offset-2",
        "[&:focus-visible]:ring-offset-background",
        className
      )}
    >
      {children}
    </div>
  );
}

// ============================================
// KEYBOARD SHORTCUTS INDICATOR
// ============================================

interface KeyboardShortcutProps {
  keys: string[];
  className?: string;
}

/**
 * Displays keyboard shortcut keys in an accessible way.
 */
export function KeyboardShortcut({ keys, className }: KeyboardShortcutProps) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center gap-0.5",
        "text-xs font-medium text-muted-foreground",
        className
      )}
    >
      {keys.map((key, index) => (
        <React.Fragment key={key}>
          <span
            className={cn(
              "inline-flex items-center justify-center",
              "min-w-[1.25rem] h-5 px-1",
              "bg-muted rounded border border-border",
              "font-mono text-[10px]"
            )}
          >
            {key}
          </span>
          {index < keys.length - 1 && (
            <span className="text-muted-foreground/50">+</span>
          )}
        </React.Fragment>
      ))}
    </kbd>
  );
}

// ============================================
// EXPORTS
// ============================================

export default KeyboardOnly;
