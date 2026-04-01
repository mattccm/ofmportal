"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { toast } from "sonner";

export type ReviewAction = "approve" | "reject" | "skip";

interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  action: string;
  label: string;
  description?: string;
}

export const BULK_REVIEW_KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  { key: "a", action: "approve", label: "A", description: "Approve current item" },
  { key: "r", action: "reject", label: "R", description: "Reject current item" },
  { key: "s", action: "skip", label: "S", description: "Skip to next item" },
  { key: "ArrowRight", action: "next", label: "Right Arrow", description: "Go to next item" },
  { key: "ArrowLeft", action: "previous", label: "Left Arrow", description: "Go to previous item" },
  { key: "ArrowUp", action: "previous_row", label: "Up Arrow", description: "Go to previous row" },
  { key: "ArrowDown", action: "next_row", label: "Down Arrow", description: "Go to next row" },
  { key: "a", ctrl: true, action: "select_all", label: "Ctrl+A", description: "Select all items" },
  { key: "d", ctrl: true, action: "deselect_all", label: "Ctrl+D", description: "Deselect all items" },
  { key: "Enter", action: "confirm", label: "Enter", description: "Confirm selection/action" },
  { key: "Escape", action: "cancel", label: "Escape", description: "Cancel/clear selection" },
  { key: "Space", action: "toggle_select", label: "Space", description: "Toggle item selection" },
  { key: "1", action: "rate_1", label: "1", description: "Rate 1 star" },
  { key: "2", action: "rate_2", label: "2", description: "Rate 2 stars" },
  { key: "3", action: "rate_3", label: "3", description: "Rate 3 stars" },
  { key: "4", action: "rate_4", label: "4", description: "Rate 4 stars" },
  { key: "5", action: "rate_5", label: "5", description: "Rate 5 stars" },
  { key: "/", action: "search", label: "/", description: "Focus search" },
  { key: "?", action: "help", label: "?", description: "Show keyboard shortcuts" },
  { key: "p", action: "preview", label: "P", description: "Preview current item" },
  { key: "g", action: "grid_view", label: "G", description: "Switch to grid view" },
  { key: "l", action: "list_view", label: "L", description: "Switch to list view" },
];

interface UseBulkReviewKeyboardOptions {
  items: string[];
  currentIndex: number;
  columnsPerRow?: number;
  onApprove: (itemId: string) => void;
  onReject: (itemId: string) => void;
  onSkip: () => void;
  onNavigate: (index: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onToggleSelect: (itemId: string) => void;
  onConfirm?: () => void;
  onCancel?: () => void;
  onRate?: (itemId: string, rating: number) => void;
  onPreview?: (itemId: string) => void;
  onSearch?: () => void;
  onHelp?: () => void;
  onViewChange?: (view: "grid" | "list") => void;
  enabled?: boolean;
}

export function useBulkReviewKeyboard({
  items,
  currentIndex,
  columnsPerRow = 4,
  onApprove,
  onReject,
  onSkip,
  onNavigate,
  onSelectAll,
  onDeselectAll,
  onToggleSelect,
  onConfirm,
  onCancel,
  onRate,
  onPreview,
  onSearch,
  onHelp,
  onViewChange,
  enabled = true,
}: UseBulkReviewKeyboardOptions) {
  const [showShortcuts, setShowShortcuts] = useState(false);
  const lastActionRef = useRef<string | null>(null);
  const lastActionTimeRef = useRef<number>(0);

  // Get current item ID
  const currentItemId = items[currentIndex];

  // Show action feedback
  const showActionFeedback = useCallback((action: string, itemIndex?: number) => {
    const now = Date.now();
    // Debounce rapid actions
    if (action === lastActionRef.current && now - lastActionTimeRef.current < 200) {
      return;
    }
    lastActionRef.current = action;
    lastActionTimeRef.current = now;

    switch (action) {
      case "approve":
        toast.success("Marked for approval", { duration: 1000 });
        break;
      case "reject":
        toast("Opening reject dialog...", { duration: 1000 });
        break;
      case "skip":
        // Silent skip
        break;
      case "select_all":
        toast.success("All items selected", { duration: 1000 });
        break;
      case "deselect_all":
        toast.success("Selection cleared", { duration: 1000 });
        break;
    }
  }, []);

  // Handle key press
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    // Don't trigger shortcuts when typing in inputs
    const target = event.target as HTMLElement;
    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable
    ) {
      // Allow Escape to blur input
      if (event.key === "Escape") {
        target.blur();
      }
      return;
    }

    const isCtrl = event.ctrlKey || event.metaKey;
    const isAlt = event.altKey;
    const isShift = event.shiftKey;
    const key = event.key.toLowerCase();

    // Find matching shortcut
    const shortcut = BULK_REVIEW_KEYBOARD_SHORTCUTS.find((s) => {
      const keyMatches = s.key.toLowerCase() === key || s.key === event.key;
      const ctrlMatches = (s.ctrl || false) === isCtrl;
      const altMatches = (s.alt || false) === isAlt;
      const shiftMatches = (s.shift || false) === isShift;
      return keyMatches && ctrlMatches && altMatches && shiftMatches;
    });

    if (!shortcut) return;

    // Prevent default for most shortcuts
    if (shortcut.action !== "search") {
      event.preventDefault();
    }

    // Execute action
    switch (shortcut.action) {
      case "approve":
        if (currentItemId) {
          onApprove(currentItemId);
          showActionFeedback("approve");
          // Auto-advance to next
          if (currentIndex < items.length - 1) {
            onNavigate(currentIndex + 1);
          }
        }
        break;

      case "reject":
        if (currentItemId) {
          onReject(currentItemId);
          showActionFeedback("reject");
        }
        break;

      case "skip":
      case "next":
        if (currentIndex < items.length - 1) {
          onNavigate(currentIndex + 1);
          onSkip();
        }
        break;

      case "previous":
        if (currentIndex > 0) {
          onNavigate(currentIndex - 1);
        }
        break;

      case "next_row":
        if (currentIndex + columnsPerRow < items.length) {
          onNavigate(currentIndex + columnsPerRow);
        } else {
          onNavigate(items.length - 1);
        }
        break;

      case "previous_row":
        if (currentIndex - columnsPerRow >= 0) {
          onNavigate(currentIndex - columnsPerRow);
        } else {
          onNavigate(0);
        }
        break;

      case "select_all":
        onSelectAll();
        showActionFeedback("select_all");
        break;

      case "deselect_all":
        onDeselectAll();
        showActionFeedback("deselect_all");
        break;

      case "toggle_select":
        if (currentItemId) {
          onToggleSelect(currentItemId);
        }
        break;

      case "confirm":
        onConfirm?.();
        break;

      case "cancel":
        onCancel?.();
        break;

      case "rate_1":
      case "rate_2":
      case "rate_3":
      case "rate_4":
      case "rate_5":
        if (currentItemId && onRate) {
          const rating = parseInt(shortcut.action.split("_")[1]);
          onRate(currentItemId, rating);
          toast.success(`Rated ${rating} star${rating > 1 ? "s" : ""}`, { duration: 1000 });
        }
        break;

      case "preview":
        if (currentItemId && onPreview) {
          onPreview(currentItemId);
        }
        break;

      case "search":
        event.preventDefault();
        onSearch?.();
        break;

      case "help":
        setShowShortcuts(true);
        onHelp?.();
        break;

      case "grid_view":
        onViewChange?.("grid");
        break;

      case "list_view":
        onViewChange?.("list");
        break;
    }
  }, [
    enabled,
    currentItemId,
    currentIndex,
    items.length,
    columnsPerRow,
    onApprove,
    onReject,
    onSkip,
    onNavigate,
    onSelectAll,
    onDeselectAll,
    onToggleSelect,
    onConfirm,
    onCancel,
    onRate,
    onPreview,
    onSearch,
    onHelp,
    onViewChange,
    showActionFeedback,
  ]);

  // Attach event listener
  useEffect(() => {
    if (!enabled) return;

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, handleKeyDown]);

  return {
    shortcuts: BULK_REVIEW_KEYBOARD_SHORTCUTS,
    showShortcuts,
    setShowShortcuts,
    currentItemId,
  };
}

// Helper hook for focus management
export function useFocusNavigation(
  itemRefs: React.RefObject<(HTMLElement | null)[]>,
  currentIndex: number
) {
  useEffect(() => {
    const refs = itemRefs.current;
    if (refs && refs[currentIndex]) {
      refs[currentIndex]?.focus();
      refs[currentIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [currentIndex, itemRefs]);
}

export default useBulkReviewKeyboard;
