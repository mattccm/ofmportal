"use client";

// ============================================
// TYPES
// ============================================

export type ShortcutCategory = "navigation" | "actions" | "search" | "content" | "general";

export interface ShortcutDefinition {
  id: string;
  keys: string | string[];
  description: string;
  category: ShortcutCategory;
  contexts?: string[];
  enabled?: boolean;
}

export interface ShortcutGroup {
  category: ShortcutCategory;
  label: string;
  icon: string; // Icon name for dynamic rendering
  shortcuts: ShortcutDefinition[];
}

// ============================================
// SHORTCUT DEFINITIONS
// ============================================

export const NAVIGATION_SHORTCUTS: ShortcutDefinition[] = [
  {
    id: "go-dashboard",
    keys: "g d",
    description: "Go to Dashboard",
    category: "navigation",
  },
  {
    id: "go-creators",
    keys: "g c",
    description: "Go to Creators",
    category: "navigation",
  },
  {
    id: "go-requests",
    keys: "g r",
    description: "Go to Requests",
    category: "navigation",
  },
  {
    id: "go-uploads",
    keys: "g u",
    description: "Go to Uploads",
    category: "navigation",
  },
  {
    id: "go-messages",
    keys: "g m",
    description: "Go to Messages",
    category: "navigation",
  },
  {
    id: "go-templates",
    keys: "g t",
    description: "Go to Templates",
    category: "navigation",
  },
  {
    id: "go-analytics",
    keys: "g a",
    description: "Go to Analytics",
    category: "navigation",
  },
  {
    id: "go-settings",
    keys: "g s",
    description: "Go to Settings",
    category: "navigation",
  },
  {
    id: "go-help",
    keys: "g h",
    description: "Go to Help Center",
    category: "navigation",
  },
];

export const ACTION_SHORTCUTS: ShortcutDefinition[] = [
  {
    id: "new-request",
    keys: ["Ctrl+N", "Cmd+N"],
    description: "Create new request",
    category: "actions",
  },
  {
    id: "save",
    keys: ["Ctrl+S", "Cmd+S"],
    description: "Save changes",
    category: "actions",
  },
  {
    id: "undo",
    keys: ["Ctrl+Z", "Cmd+Z"],
    description: "Undo last action",
    category: "actions",
  },
  {
    id: "redo",
    keys: ["Ctrl+Shift+Z", "Cmd+Shift+Z"],
    description: "Redo last action",
    category: "actions",
  },
  {
    id: "duplicate",
    keys: ["Ctrl+D", "Cmd+D"],
    description: "Duplicate item",
    category: "actions",
  },
  {
    id: "delete",
    keys: ["Delete", "Backspace"],
    description: "Delete selected item",
    category: "actions",
  },
  {
    id: "refresh",
    keys: ["Ctrl+R", "Cmd+R"],
    description: "Refresh data",
    category: "actions",
  },
  {
    id: "copy",
    keys: ["Ctrl+C", "Cmd+C"],
    description: "Copy to clipboard",
    category: "actions",
  },
];

export const SEARCH_SHORTCUTS: ShortcutDefinition[] = [
  {
    id: "command-palette",
    keys: ["Ctrl+K", "Cmd+K"],
    description: "Open command palette",
    category: "search",
  },
  {
    id: "search-focus",
    keys: "/",
    description: "Focus search input",
    category: "search",
  },
  {
    id: "filter-menu",
    keys: ["Ctrl+F", "Cmd+F"],
    description: "Open filter menu",
    category: "search",
  },
];

export const CONTENT_SHORTCUTS: ShortcutDefinition[] = [
  {
    id: "approve-upload",
    keys: "a",
    description: "Approve selected upload",
    category: "content",
    contexts: ["uploads"],
  },
  {
    id: "request-revision",
    keys: "r",
    description: "Request revision",
    category: "content",
    contexts: ["uploads"],
  },
  {
    id: "reject-upload",
    keys: "x",
    description: "Reject selected upload",
    category: "content",
    contexts: ["uploads"],
  },
  {
    id: "preview-content",
    keys: "Space",
    description: "Preview content",
    category: "content",
    contexts: ["uploads", "requests"],
  },
  {
    id: "download-content",
    keys: "d",
    description: "Download selected content",
    category: "content",
    contexts: ["uploads"],
  },
  {
    id: "navigate-next",
    keys: ["j", "ArrowDown"],
    description: "Next item",
    category: "content",
    contexts: ["uploads", "requests", "creators"],
  },
  {
    id: "navigate-prev",
    keys: ["k", "ArrowUp"],
    description: "Previous item",
    category: "content",
    contexts: ["uploads", "requests", "creators"],
  },
  {
    id: "select-item",
    keys: "Enter",
    description: "Select/open item",
    category: "content",
  },
  {
    id: "select-all",
    keys: ["Ctrl+A", "Cmd+A"],
    description: "Select all items",
    category: "content",
  },
];

export const GENERAL_SHORTCUTS: ShortcutDefinition[] = [
  {
    id: "shortcuts-help",
    keys: "?",
    description: "Show keyboard shortcuts",
    category: "general",
  },
  {
    id: "shortcuts-help-alt",
    keys: ["Ctrl+/", "Cmd+/"],
    description: "Show keyboard shortcuts",
    category: "general",
  },
  {
    id: "close-modal",
    keys: "Escape",
    description: "Close dialog/modal",
    category: "general",
  },
  {
    id: "toggle-sidebar",
    keys: "[",
    description: "Toggle sidebar",
    category: "general",
  },
  {
    id: "toggle-theme",
    keys: ["Ctrl+Shift+T", "Cmd+Shift+T"],
    description: "Toggle dark/light theme",
    category: "general",
  },
  {
    id: "focus-main",
    keys: ".",
    description: "Focus main content area",
    category: "general",
  },
];

// ============================================
// GROUPED SHORTCUTS
// ============================================

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    category: "navigation",
    label: "Navigation",
    icon: "Compass",
    shortcuts: NAVIGATION_SHORTCUTS,
  },
  {
    category: "actions",
    label: "Actions",
    icon: "Zap",
    shortcuts: ACTION_SHORTCUTS,
  },
  {
    category: "search",
    label: "Search",
    icon: "Search",
    shortcuts: SEARCH_SHORTCUTS,
  },
  {
    category: "content",
    label: "Content",
    icon: "FileEdit",
    shortcuts: CONTENT_SHORTCUTS,
  },
  {
    category: "general",
    label: "General",
    icon: "Settings",
    shortcuts: GENERAL_SHORTCUTS,
  },
];

// ============================================
// ALL SHORTCUTS (flat list)
// ============================================

export const ALL_SHORTCUTS: ShortcutDefinition[] = [
  ...NAVIGATION_SHORTCUTS,
  ...ACTION_SHORTCUTS,
  ...SEARCH_SHORTCUTS,
  ...CONTENT_SHORTCUTS,
  ...GENERAL_SHORTCUTS,
];

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get platform-aware modifier key label
 */
export function getModifierKey(): "Cmd" | "Ctrl" {
  if (typeof window === "undefined") return "Ctrl";
  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0 ||
    navigator.userAgent.toUpperCase().indexOf("MAC") >= 0;
  return isMac ? "Cmd" : "Ctrl";
}

/**
 * Check if the current platform is macOS
 */
export function isMacOS(): boolean {
  if (typeof window === "undefined") return false;
  return navigator.platform.toUpperCase().indexOf("MAC") >= 0 ||
    navigator.userAgent.toUpperCase().indexOf("MAC") >= 0;
}

/**
 * Format a key string for display
 */
export function formatKey(key: string, modKey: "Cmd" | "Ctrl"): string {
  return key
    .replace(/Ctrl/gi, modKey)
    .replace(/Cmd/gi, modKey)
    .replace(/Meta/gi, modKey)
    .replace(/Shift/gi, "Shift")
    .replace(/Alt/gi, isMacOS() ? "Option" : "Alt")
    .replace(/ArrowUp/gi, "\u2191")
    .replace(/ArrowDown/gi, "\u2193")
    .replace(/ArrowLeft/gi, "\u2190")
    .replace(/ArrowRight/gi, "\u2192")
    .replace(/Backspace/gi, "\u232B")
    .replace(/Delete/gi, isMacOS() ? "\u232B" : "Del")
    .replace(/Enter/gi, "\u21B5")
    .replace(/Escape/gi, "Esc")
    .replace(/Space/gi, "Space");
}

/**
 * Parse a shortcut key string into displayable parts
 */
export function parseShortcutKeys(keys: string | string[], modKey: "Cmd" | "Ctrl"): string[][] {
  const keyList = Array.isArray(keys) ? keys : [keys];

  return keyList.map(keyStr => {
    // Handle sequences like "g d"
    if (keyStr.includes(" ") && !keyStr.includes("+")) {
      return keyStr.split(" ").map(k => formatKey(k.toUpperCase(), modKey));
    }

    // Handle combos like "Ctrl+K"
    return keyStr.split("+").map(k => formatKey(k.trim(), modKey));
  });
}

/**
 * Get shortcut display string (formatted for display)
 */
export function getShortcutDisplayString(keys: string | string[], modKey: "Cmd" | "Ctrl"): string {
  const keyList = Array.isArray(keys) ? keys : [keys];
  const firstKey = keyList[0];

  // Handle sequences like "g d"
  if (firstKey.includes(" ") && !firstKey.includes("+")) {
    const parts = firstKey.split(" ");
    return parts.map(k => formatKey(k.toUpperCase(), modKey)).join(" then ");
  }

  // Handle combos like "Ctrl+K"
  return firstKey.split("+").map(k => formatKey(k.trim(), modKey)).join(" + ");
}

/**
 * Filter shortcuts by search query
 */
export function filterShortcuts(
  shortcuts: ShortcutDefinition[],
  query: string
): ShortcutDefinition[] {
  if (!query.trim()) return shortcuts;

  const lowerQuery = query.toLowerCase().trim();

  return shortcuts.filter(shortcut => {
    // Match description
    if (shortcut.description.toLowerCase().includes(lowerQuery)) return true;

    // Match keys
    const keys = Array.isArray(shortcut.keys) ? shortcut.keys : [shortcut.keys];
    if (keys.some(k => k.toLowerCase().includes(lowerQuery))) return true;

    // Match category
    if (shortcut.category.toLowerCase().includes(lowerQuery)) return true;

    return false;
  });
}

/**
 * Get shortcuts for a specific context
 */
export function getContextShortcuts(
  shortcuts: ShortcutDefinition[],
  context?: string
): ShortcutDefinition[] {
  return shortcuts.filter(shortcut => {
    if (!shortcut.contexts) return true;
    if (!context) return !shortcut.contexts.length;
    return shortcut.contexts.includes(context);
  });
}

/**
 * Group shortcuts by category
 */
export function groupShortcutsByCategory(
  shortcuts: ShortcutDefinition[]
): Record<ShortcutCategory, ShortcutDefinition[]> {
  const grouped: Record<ShortcutCategory, ShortcutDefinition[]> = {
    navigation: [],
    actions: [],
    search: [],
    content: [],
    general: [],
  };

  shortcuts.forEach(shortcut => {
    grouped[shortcut.category].push(shortcut);
  });

  return grouped;
}

// ============================================
// ACTION HANDLERS REGISTRY
// ============================================

export type ShortcutHandler = () => void;

export interface ShortcutHandlers {
  [id: string]: ShortcutHandler;
}

/**
 * Create action handlers for shortcuts
 * This allows components to register handlers for shortcuts
 */
export function createShortcutHandlers(
  router: { push: (path: string) => void },
  callbacks: {
    openCommandPalette?: () => void;
    openShortcutsHelp?: () => void;
    closeModal?: () => void;
    toggleSidebar?: () => void;
    toggleTheme?: () => void;
    onNewRequest?: () => void;
    onSave?: () => void;
    onRefresh?: () => void;
  } = {}
): ShortcutHandlers {
  return {
    // Navigation
    "go-dashboard": () => router.push("/dashboard"),
    "go-creators": () => router.push("/dashboard/creators"),
    "go-requests": () => router.push("/dashboard/requests"),
    "go-uploads": () => router.push("/dashboard/uploads"),
    "go-messages": () => router.push("/dashboard/messages"),
    "go-templates": () => router.push("/dashboard/templates"),
    "go-analytics": () => router.push("/dashboard/analytics"),
    "go-settings": () => router.push("/dashboard/settings"),
    "go-help": () => router.push("/dashboard/help"),

    // Actions
    "new-request": callbacks.onNewRequest || (() => router.push("/dashboard/requests/new")),
    "save": callbacks.onSave || (() => {}),
    "refresh": callbacks.onRefresh || (() => window.location.reload()),

    // Search
    "command-palette": callbacks.openCommandPalette || (() => {}),

    // General
    "shortcuts-help": callbacks.openShortcutsHelp || (() => {}),
    "shortcuts-help-alt": callbacks.openShortcutsHelp || (() => {}),
    "close-modal": callbacks.closeModal || (() => {}),
    "toggle-sidebar": callbacks.toggleSidebar || (() => {}),
    "toggle-theme": callbacks.toggleTheme || (() => {}),
  };
}

// ============================================
// KEYBOARD SYMBOLS FOR DISPLAY
// ============================================

export const KEY_SYMBOLS: Record<string, string> = {
  cmd: "\u2318",
  ctrl: "Ctrl",
  alt: "\u2325",
  option: "\u2325",
  shift: "\u21E7",
  enter: "\u21B5",
  return: "\u21B5",
  backspace: "\u232B",
  delete: "\u232B",
  escape: "Esc",
  esc: "Esc",
  space: "Space",
  tab: "\u21E5",
  arrowup: "\u2191",
  arrowdown: "\u2193",
  arrowleft: "\u2190",
  arrowright: "\u2192",
  up: "\u2191",
  down: "\u2193",
  left: "\u2190",
  right: "\u2192",
};

/**
 * Get the symbol for a key
 */
export function getKeySymbol(key: string): string {
  const lower = key.toLowerCase();
  return KEY_SYMBOLS[lower] || key.toUpperCase();
}
