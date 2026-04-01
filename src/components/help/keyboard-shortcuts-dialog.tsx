"use client";

import * as React from "react";
import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  SHORTCUT_GROUPS,
  ALL_SHORTCUTS,
  ShortcutDefinition,
  ShortcutGroup,
  ShortcutCategory,
  getModifierKey,
  isMacOS,
  filterShortcuts,
  parseShortcutKeys,
} from "@/lib/keyboard-shortcuts";
import {
  Keyboard,
  Search,
  Compass,
  Zap,
  FileEdit,
  Settings,
  X,
  Command,
  ChevronRight,
} from "lucide-react";

// ============================================
// TYPES
// ============================================

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context?: string;
}

// ============================================
// ICON MAP
// ============================================

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Compass: <Compass className="h-4 w-4" />,
  Zap: <Zap className="h-4 w-4" />,
  Search: <Search className="h-4 w-4" />,
  FileEdit: <FileEdit className="h-4 w-4" />,
  Settings: <Settings className="h-4 w-4" />,
};

const CATEGORY_COLORS: Record<ShortcutCategory, string> = {
  navigation: "text-blue-500 bg-blue-500/10",
  actions: "text-amber-500 bg-amber-500/10",
  search: "text-violet-500 bg-violet-500/10",
  content: "text-emerald-500 bg-emerald-500/10",
  general: "text-slate-500 bg-slate-500/10",
};

// ============================================
// KEY COMPONENT
// ============================================

interface KeyProps {
  children: React.ReactNode;
  isModifier?: boolean;
  size?: "sm" | "md";
}

function Key({ children, isModifier = false, size = "md" }: KeyProps) {
  const sizeClasses = {
    sm: "min-w-[1.5rem] h-6 px-1.5 text-[10px]",
    md: "min-w-[2rem] h-7 px-2 text-xs",
  };

  return (
    <kbd
      className={cn(
        "inline-flex items-center justify-center rounded-md font-mono font-medium",
        "bg-gradient-to-b from-muted to-muted/80",
        "border border-border/50 shadow-[0_1px_0_1px_rgba(0,0,0,0.1)]",
        "dark:shadow-[0_1px_0_1px_rgba(255,255,255,0.05)]",
        isModifier && "bg-gradient-to-b from-primary/10 to-primary/5 text-primary border-primary/20",
        sizeClasses[size]
      )}
    >
      {children}
    </kbd>
  );
}

// ============================================
// SHORTCUT KEYS DISPLAY
// ============================================

interface ShortcutKeysDisplayProps {
  keys: string | string[];
  size?: "sm" | "md";
}

function ShortcutKeysDisplay({ keys, size = "md" }: ShortcutKeysDisplayProps) {
  const modKey = getModifierKey();
  const parsedKeys = parseShortcutKeys(keys, modKey);

  // Use the first key combination for display
  const keyParts = parsedKeys[0];

  // Check if it's a sequence (like G then D)
  const keyStr = Array.isArray(keys) ? keys[0] : keys;
  const isSequence = keyStr.includes(" ") && !keyStr.includes("+");

  if (isSequence) {
    return (
      <div className="flex items-center gap-1">
        {keyParts.map((part, i) => (
          <React.Fragment key={i}>
            <Key size={size}>{part}</Key>
            {i < keyParts.length - 1 && (
              <span className="text-[10px] text-muted-foreground mx-0.5">then</span>
            )}
          </React.Fragment>
        ))}
      </div>
    );
  }

  // Regular combo
  const modifiers = ["Cmd", "Ctrl", "Shift", "Alt", "Option"];

  return (
    <div className="flex items-center gap-0.5">
      {keyParts.map((part, i) => (
        <React.Fragment key={i}>
          <Key size={size} isModifier={modifiers.includes(part)}>
            {part === "Cmd" && isMacOS() ? <Command className="h-3 w-3" /> : part}
          </Key>
          {i < keyParts.length - 1 && (
            <span className="text-[10px] text-muted-foreground mx-0.5">+</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ============================================
// SHORTCUT ITEM
// ============================================

interface ShortcutItemProps {
  shortcut: ShortcutDefinition;
  isHighlighted?: boolean;
}

function ShortcutItem({ shortcut, isHighlighted }: ShortcutItemProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between py-2 px-3 rounded-lg transition-colors",
        isHighlighted ? "bg-primary/5" : "hover:bg-muted/50"
      )}
    >
      <span className="text-sm">{shortcut.description}</span>
      <ShortcutKeysDisplay keys={shortcut.keys} size="sm" />
    </div>
  );
}

// ============================================
// CATEGORY SECTION
// ============================================

interface CategorySectionProps {
  group: ShortcutGroup;
  shortcuts: ShortcutDefinition[];
  searchQuery: string;
}

function CategorySection({ group, shortcuts, searchQuery }: CategorySectionProps) {
  if (shortcuts.length === 0) return null;

  const colorClass = CATEGORY_COLORS[group.category];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <div className={cn("p-1.5 rounded-md", colorClass)}>
          {CATEGORY_ICONS[group.icon]}
        </div>
        <h3 className="text-sm font-medium text-muted-foreground">
          {group.label}
        </h3>
        <Badge variant="secondary" className="text-[10px] ml-auto">
          {shortcuts.length}
        </Badge>
      </div>
      <div className="space-y-0.5">
        {shortcuts.map((shortcut) => (
          <ShortcutItem
            key={shortcut.id}
            shortcut={shortcut}
            isHighlighted={
              searchQuery.length > 0 &&
              shortcut.description.toLowerCase().includes(searchQuery.toLowerCase())
            }
          />
        ))}
      </div>
    </div>
  );
}

// ============================================
// SEARCH RESULTS
// ============================================

interface SearchResultsProps {
  shortcuts: ShortcutDefinition[];
  query: string;
}

function SearchResults({ shortcuts, query }: SearchResultsProps) {
  if (shortcuts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Search className="h-10 w-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">
          No shortcuts found for "{query}"
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Try a different search term
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground px-1 mb-2">
        {shortcuts.length} shortcut{shortcuts.length !== 1 ? "s" : ""} found
      </p>
      {shortcuts.map((shortcut) => (
        <ShortcutItem key={shortcut.id} shortcut={shortcut} isHighlighted />
      ))}
    </div>
  );
}

// ============================================
// QUICK TIPS
// ============================================

function QuickTips() {
  const modKey = getModifierKey();

  return (
    <div className="rounded-lg border border-dashed p-4 bg-muted/30">
      <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
        <Zap className="h-4 w-4 text-amber-500" />
        Pro Tips
      </h4>
      <ul className="space-y-2 text-sm text-muted-foreground">
        <li className="flex items-start gap-2">
          <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
          <span>
            Press <Key size="sm">G</Key> followed by a letter to navigate quickly
          </span>
        </li>
        <li className="flex items-start gap-2">
          <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
          <span>
            Use{" "}
            <span className="inline-flex items-center gap-0.5">
              <Key size="sm">{modKey === "Cmd" ? <Command className="h-3 w-3" /> : "Ctrl"}</Key>
              <span className="text-[10px] mx-0.5">+</span>
              <Key size="sm">K</Key>
            </span>{" "}
            to search for any action
          </span>
        </li>
        <li className="flex items-start gap-2">
          <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
          <span>
            Shortcuts are disabled when typing in text fields
          </span>
        </li>
        <li className="flex items-start gap-2">
          <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
          <span>
            Press <Key size="sm">?</Key> anytime to show this help
          </span>
        </li>
      </ul>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
  context,
}: KeyboardShortcutsDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Focus search input when dialog opens
  useEffect(() => {
    if (open) {
      setSearchQuery("");
      // Small delay to ensure dialog is rendered
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [open]);

  // Filter shortcuts based on search
  const filteredShortcuts = useMemo(() => {
    return filterShortcuts(ALL_SHORTCUTS, searchQuery);
  }, [searchQuery]);

  // Group filtered shortcuts by category
  const groupedShortcuts = useMemo(() => {
    const grouped = new Map<ShortcutCategory, ShortcutDefinition[]>();

    SHORTCUT_GROUPS.forEach((group) => {
      const categoryShortcuts = filteredShortcuts.filter(
        (s) => s.category === group.category
      );
      if (categoryShortcuts.length > 0) {
        grouped.set(group.category, categoryShortcuts);
      }
    });

    return grouped;
  }, [filteredShortcuts]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false);
      }
    },
    [onOpenChange]
  );

  const modKey = getModifierKey();
  const platformLabel = isMacOS() ? "macOS" : "Windows/Linux";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col p-0"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/20 to-violet-500/20 flex items-center justify-center">
              <Keyboard className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-xl">Keyboard Shortcuts</DialogTitle>
              <DialogDescription className="mt-0.5">
                Navigate faster with these keyboard shortcuts
              </DialogDescription>
            </div>
            <Badge variant="secondary" className="text-xs">
              {platformLabel}
            </Badge>
          </div>

          {/* Search */}
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              type="search"
              placeholder="Search shortcuts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 h-10"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted transition-colors"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {searchQuery ? (
            <SearchResults shortcuts={filteredShortcuts} query={searchQuery} />
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {SHORTCUT_GROUPS.map((group) => {
                const shortcuts = groupedShortcuts.get(group.category) || [];
                return (
                  <CategorySection
                    key={group.category}
                    group={group}
                    shortcuts={shortcuts}
                    searchQuery={searchQuery}
                  />
                );
              })}
            </div>
          )}

          {/* Quick Tips - only show when not searching */}
          {!searchQuery && (
            <div className="mt-6">
              <QuickTips />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-3 flex-shrink-0 bg-muted/30">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Press{" "}
              <Key size="sm">Esc</Key>
              {" "}to close
            </span>
            <span className="flex items-center gap-2">
              <span>
                <Key size="sm">{modKey === "Cmd" ? <Command className="h-3 w-3" /> : "Ctrl"}</Key>
                <span className="mx-0.5">+</span>
                <Key size="sm">/</Key>
              </span>
              <span>or</span>
              <Key size="sm">?</Key>
              <span>to toggle</span>
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// STANDALONE MODAL (for backward compatibility)
// ============================================

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  context?: string;
}

export function KeyboardShortcutsModal({
  isOpen,
  onClose,
  context,
}: KeyboardShortcutsModalProps) {
  return (
    <KeyboardShortcutsDialog
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      context={context}
    />
  );
}
