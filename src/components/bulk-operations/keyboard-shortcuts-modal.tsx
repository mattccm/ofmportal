"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Keyboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { BULK_REVIEW_KEYBOARD_SHORTCUTS } from "@/hooks/use-bulk-review-keyboard";

interface KeyboardShortcutsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsModal({
  open,
  onOpenChange,
}: KeyboardShortcutsModalProps) {
  // Group shortcuts by category
  const categories = {
    "Review Actions": ["approve", "reject", "skip", "preview"],
    "Navigation": ["next", "previous", "next_row", "previous_row"],
    "Selection": ["select_all", "deselect_all", "toggle_select"],
    "Rating": ["rate_1", "rate_2", "rate_3", "rate_4", "rate_5"],
    "View": ["grid_view", "list_view", "search", "help"],
    "Other": ["confirm", "cancel"],
  };

  const getShortcutsByCategory = (category: string) => {
    const actions = categories[category as keyof typeof categories] || [];
    return BULK_REVIEW_KEYBOARD_SHORTCUTS.filter((s) => actions.includes(s.action));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Use these keyboard shortcuts for faster bulk review operations.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6">
          {Object.keys(categories).map((category) => {
            const shortcuts = getShortcutsByCategory(category);
            if (shortcuts.length === 0) return null;

            return (
              <div key={category}>
                <h3 className="font-medium text-sm text-muted-foreground mb-3">
                  {category}
                </h3>
                <div className="space-y-2">
                  {shortcuts.map((shortcut) => (
                    <div
                      key={shortcut.action}
                      className="flex items-center justify-between py-1.5"
                    >
                      <span className="text-sm">{shortcut.description}</span>
                      <KeyboardKey label={shortcut.label} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 p-4 bg-muted rounded-lg">
          <h4 className="font-medium text-sm mb-2">Pro Tips</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>Press A to approve and automatically move to the next item</li>
            <li>Use arrow keys to navigate through items quickly</li>
            <li>Press numbers 1-5 to rate items while reviewing</li>
            <li>Press / to quickly focus the search box</li>
          </ul>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Keyboard key component
interface KeyboardKeyProps {
  label: string;
  className?: string;
}

export function KeyboardKey({ label, className }: KeyboardKeyProps) {
  // Split combo keys
  const keys = label.includes("+") ? label.split("+") : [label];

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {keys.map((key, i) => (
        <span key={i}>
          {i > 0 && <span className="text-muted-foreground mx-0.5">+</span>}
          <kbd
            className={cn(
              "inline-flex items-center justify-center",
              "px-2 py-1 min-w-[24px]",
              "bg-muted border border-border rounded",
              "text-xs font-mono font-medium",
              "shadow-sm"
            )}
          >
            {key.trim()}
          </kbd>
        </span>
      ))}
    </div>
  );
}

// Inline keyboard hint component
interface KeyboardHintProps {
  shortcut: string;
  label?: string;
  className?: string;
}

export function KeyboardHint({ shortcut, label, className }: KeyboardHintProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {label && <span className="text-sm text-muted-foreground">{label}</span>}
      <KeyboardKey label={shortcut} />
    </span>
  );
}

// Floating keyboard shortcuts indicator
interface FloatingShortcutsIndicatorProps {
  onShowHelp: () => void;
  className?: string;
}

export function FloatingShortcutsIndicator({
  onShowHelp,
  className,
}: FloatingShortcutsIndicatorProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onShowHelp}
      className={cn(
        "fixed bottom-4 left-4 z-40",
        "flex items-center gap-2",
        "bg-background/95 backdrop-blur",
        className
      )}
    >
      <Keyboard className="h-4 w-4" />
      <span className="hidden sm:inline">Press</span>
      <KeyboardKey label="?" />
      <span className="hidden sm:inline">for shortcuts</span>
    </Button>
  );
}

export default KeyboardShortcutsModal;
