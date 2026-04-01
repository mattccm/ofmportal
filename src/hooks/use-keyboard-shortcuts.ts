"use client";

import * as React from "react";
import { useEffect, useCallback, useRef } from "react";

export interface KeyboardShortcut {
  id: string;
  keys: string | string[]; // Single key, combo (Ctrl+K), or sequence (G then D)
  callback: () => void;
  description: string;
  category: "navigation" | "actions" | "content" | "settings";
  context?: string[]; // Optional contexts where this shortcut is active
  preventDefault?: boolean;
  enabled?: boolean;
}

export interface UseKeyboardShortcutsOptions {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
  context?: string;
}

// Keys that should be allowed even in input fields
const ALLOWED_IN_INPUT = new Set(["escape", "?", "ctrl+/", "cmd+/"]);

// Check if the event target is an input element where we should ignore shortcuts
function isInputElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;

  const tagName = target.tagName.toLowerCase();
  const isInput = tagName === "input" || tagName === "textarea" || tagName === "select";
  const isContentEditable = target.isContentEditable;

  return isInput || isContentEditable;
}

// Check if a shortcut key should be allowed in input fields
function isAllowedInInput(key: string, event: KeyboardEvent): boolean {
  const normalizedKey = key.toLowerCase();

  // Always allow Escape
  if (normalizedKey === "escape" || normalizedKey === "esc") return true;

  // Allow Ctrl+/ or Cmd+/ for shortcuts help
  if ((event.ctrlKey || event.metaKey) && event.key === "/") return true;

  return ALLOWED_IN_INPUT.has(normalizedKey);
}

// Parse key string into normalized form
function normalizeKey(key: string): string {
  return key.toLowerCase().trim();
}

// Parse combo string like "Ctrl+K" or "Cmd+Shift+P"
function parseCombo(combo: string): { modifiers: Set<string>; key: string } {
  const parts = combo.split("+").map((p) => p.trim().toLowerCase());
  const key = parts.pop() || "";
  const modifiers = new Set(parts);

  // Normalize Cmd to Meta for cross-platform
  if (modifiers.has("cmd")) {
    modifiers.delete("cmd");
    modifiers.add("meta");
  }

  return { modifiers, key };
}

// Check if event matches a key combo
function matchesCombo(
  event: KeyboardEvent,
  combo: string
): boolean {
  const { modifiers, key } = parseCombo(combo);

  const eventKey = event.key.toLowerCase();
  const eventCode = event.code.toLowerCase();

  // Check the key
  const keyMatches =
    eventKey === key ||
    eventCode === `key${key}` ||
    eventCode === key ||
    (key === "escape" && eventKey === "escape") ||
    (key === "esc" && eventKey === "escape") ||
    (key === "space" && (eventKey === " " || eventCode === "space")) ||
    (key === "enter" && eventKey === "enter") ||
    (key === "/" && eventKey === "/") ||
    (key === "?" && (eventKey === "?" || (event.shiftKey && eventKey === "/")));

  if (!keyMatches) return false;

  // Check modifiers
  const hasCtrl = event.ctrlKey;
  const hasMeta = event.metaKey;
  const hasShift = event.shiftKey;
  const hasAlt = event.altKey;

  const needsCtrl = modifiers.has("ctrl");
  const needsMeta = modifiers.has("meta");
  const needsShift = modifiers.has("shift");
  const needsAlt = modifiers.has("alt");

  // For Ctrl/Cmd, allow either on Mac or PC
  const ctrlOrMeta = needsCtrl || needsMeta;
  const hasCtrlOrMeta = hasCtrl || hasMeta;

  if (ctrlOrMeta) {
    if (!hasCtrlOrMeta) return false;
  } else {
    if (hasCtrl || hasMeta) return false;
  }

  if (needsShift !== hasShift) return false;
  if (needsAlt !== hasAlt) return false;

  return true;
}

export function useKeyboardShortcuts({
  shortcuts,
  enabled = true,
  context,
}: UseKeyboardShortcutsOptions) {
  // Track sequence keys (for shortcuts like "G then D")
  const sequenceRef = useRef<{ key: string; timestamp: number } | null>(null);
  const sequenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Skip if user is typing in an input field (unless it's an allowed key)
      const key = event.key.toLowerCase();
      if (isInputElement(event.target) && !isAllowedInInput(key, event)) {
        return;
      }

      // Clear sequence timeout
      if (sequenceTimeoutRef.current) {
        clearTimeout(sequenceTimeoutRef.current);
      }

      for (const shortcut of shortcuts) {
        if (shortcut.enabled === false) continue;

        // Check context
        if (shortcut.context && context && !shortcut.context.includes(context)) {
          continue;
        }

        const keys = Array.isArray(shortcut.keys) ? shortcut.keys : [shortcut.keys];

        for (const keyDef of keys) {
          // Check for sequence shortcuts (e.g., "g d" for G then D)
          if (keyDef.includes(" ")) {
            const [firstKey, secondKey] = keyDef.split(" ").map(normalizeKey);

            // If we have a pending first key and this is the second key
            if (
              sequenceRef.current &&
              sequenceRef.current.key === firstKey &&
              Date.now() - sequenceRef.current.timestamp < 1000 &&
              normalizeKey(event.key) === secondKey &&
              !event.ctrlKey &&
              !event.metaKey &&
              !event.altKey
            ) {
              if (shortcut.preventDefault !== false) {
                event.preventDefault();
              }
              sequenceRef.current = null;
              shortcut.callback();
              return;
            }

            // If this is the first key of a sequence
            if (
              normalizeKey(event.key) === firstKey &&
              !event.ctrlKey &&
              !event.metaKey &&
              !event.altKey
            ) {
              sequenceRef.current = { key: firstKey, timestamp: Date.now() };
              sequenceTimeoutRef.current = setTimeout(() => {
                sequenceRef.current = null;
              }, 1000);
              return;
            }
          } else {
            // Regular shortcut or combo
            if (matchesCombo(event, keyDef)) {
              if (shortcut.preventDefault !== false) {
                event.preventDefault();
              }
              sequenceRef.current = null;
              shortcut.callback();
              return;
            }
          }
        }
      }
    },
    [shortcuts, enabled, context]
  );

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (sequenceTimeoutRef.current) {
        clearTimeout(sequenceTimeoutRef.current);
      }
    };
  }, [handleKeyDown, enabled]);
}

// Helper hook for getting platform-specific modifier key
export function useModifierKey(): "Cmd" | "Ctrl" {
  if (typeof window === "undefined") return "Ctrl";

  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  return isMac ? "Cmd" : "Ctrl";
}

// Format shortcut for display
export function formatShortcut(keys: string | string[], modKey: "Cmd" | "Ctrl"): string {
  const keyStr = Array.isArray(keys) ? keys[0] : keys;

  // Handle sequences
  if (keyStr.includes(" ") && !keyStr.includes("+")) {
    const parts = keyStr.split(" ");
    return parts.map((p) => p.toUpperCase()).join(" then ");
  }

  // Handle combos
  return keyStr
    .split("+")
    .map((part) => {
      const p = part.trim().toLowerCase();
      if (p === "ctrl" || p === "cmd" || p === "meta") return modKey;
      if (p === "shift") return "Shift";
      if (p === "alt") return "Alt";
      if (p === "escape" || p === "esc") return "Esc";
      if (p === "space") return "Space";
      if (p === "enter") return "Enter";
      if (p === "?") return "?";
      return p.toUpperCase();
    })
    .join(" + ");
}

// Hook for registering a single shortcut
export function useShortcut(
  keys: string | string[],
  callback: () => void,
  options: {
    enabled?: boolean;
    description?: string;
    category?: KeyboardShortcut["category"];
    context?: string[];
    preventDefault?: boolean;
  } = {}
) {
  const {
    enabled = true,
    description = "",
    category = "actions",
    context,
    preventDefault = true,
  } = options;

  const shortcut: KeyboardShortcut = {
    id: `shortcut-${Array.isArray(keys) ? keys[0] : keys}`,
    keys,
    callback,
    description,
    category,
    context,
    preventDefault,
    enabled,
  };

  useKeyboardShortcuts({
    shortcuts: [shortcut],
    enabled,
  });
}

// Hook for detecting if a key is currently pressed
export function useKeyPress(targetKey: string): boolean {
  const [keyPressed, setKeyPressed] = React.useState(false);

  React.useEffect(() => {
    const downHandler = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === targetKey.toLowerCase()) {
        setKeyPressed(true);
      }
    };

    const upHandler = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === targetKey.toLowerCase()) {
        setKeyPressed(false);
      }
    };

    window.addEventListener("keydown", downHandler);
    window.addEventListener("keyup", upHandler);

    return () => {
      window.removeEventListener("keydown", downHandler);
      window.removeEventListener("keyup", upHandler);
    };
  }, [targetKey]);

  return keyPressed;
}

// Check if platform is macOS
export function isMacPlatform(): boolean {
  if (typeof window === "undefined") return false;
  return navigator.platform.toUpperCase().indexOf("MAC") >= 0;
}
