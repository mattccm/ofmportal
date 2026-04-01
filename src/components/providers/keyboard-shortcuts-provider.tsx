"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  useKeyboardShortcuts,
  KeyboardShortcut,
} from "@/hooks/use-keyboard-shortcuts";
import {
  CommandPalette,
  CommandItem,
  createNavigationCommands,
  createActionCommands,
} from "@/components/command-palette";
import { KeyboardShortcutsDialog } from "@/components/help/keyboard-shortcuts-dialog";

interface KeyboardShortcutsContextValue {
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  openShortcutsHelp: () => void;
  closeShortcutsHelp: () => void;
  registerContextShortcuts: (shortcuts: KeyboardShortcut[]) => void;
  unregisterContextShortcuts: (ids: string[]) => void;
  context: string | undefined;
  setContext: (context: string | undefined) => void;
}

const KeyboardShortcutsContext = React.createContext<KeyboardShortcutsContextValue | null>(
  null
);

export function useKeyboardShortcutsContext() {
  const context = React.useContext(KeyboardShortcutsContext);
  if (!context) {
    throw new Error(
      "useKeyboardShortcutsContext must be used within KeyboardShortcutsProvider"
    );
  }
  return context;
}

interface KeyboardShortcutsProviderProps {
  children: React.ReactNode;
}

const RECENT_COMMANDS_KEY = "keyboard-shortcuts-recent";
const MAX_RECENT_COMMANDS = 5;

export function KeyboardShortcutsProvider({
  children,
}: KeyboardShortcutsProviderProps) {
  const router = useRouter();
  const pathname = usePathname();

  // State
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = React.useState(false);
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = React.useState(false);
  const [contextShortcuts, setContextShortcuts] = React.useState<KeyboardShortcut[]>([]);
  const [context, setContext] = React.useState<string | undefined>();
  const [recentCommands, setRecentCommands] = React.useState<string[]>([]);

  // Load recent commands from localStorage
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(RECENT_COMMANDS_KEY);
      if (stored) {
        try {
          setRecentCommands(JSON.parse(stored));
        } catch {
          // Ignore invalid JSON
        }
      }
    }
  }, []);

  // Save recent commands to localStorage
  const addRecentCommand = React.useCallback((commandId: string) => {
    setRecentCommands((prev) => {
      const filtered = prev.filter((id) => id !== commandId);
      const updated = [commandId, ...filtered].slice(0, MAX_RECENT_COMMANDS);

      if (typeof window !== "undefined") {
        localStorage.setItem(RECENT_COMMANDS_KEY, JSON.stringify(updated));
      }

      return updated;
    });
  }, []);

  // Derive context from pathname
  React.useEffect(() => {
    if (pathname.includes("/uploads")) {
      setContext("uploads");
    } else if (pathname.includes("/requests")) {
      setContext("requests");
    } else if (pathname.includes("/messages")) {
      setContext("messages");
    } else if (pathname.includes("/dashboard")) {
      setContext("dashboard");
    } else {
      setContext(undefined);
    }
  }, [pathname]);

  // Context functions
  const openCommandPalette = React.useCallback(() => {
    setIsCommandPaletteOpen(true);
  }, []);

  const closeCommandPalette = React.useCallback(() => {
    setIsCommandPaletteOpen(false);
  }, []);

  const openShortcutsHelp = React.useCallback(() => {
    setIsShortcutsHelpOpen(true);
  }, []);

  const closeShortcutsHelp = React.useCallback(() => {
    setIsShortcutsHelpOpen(false);
  }, []);

  const registerContextShortcuts = React.useCallback((shortcuts: KeyboardShortcut[]) => {
    setContextShortcuts((prev) => [...prev, ...shortcuts]);
  }, []);

  const unregisterContextShortcuts = React.useCallback((ids: string[]) => {
    setContextShortcuts((prev) => prev.filter((s) => !ids.includes(s.id)));
  }, []);

  // Build command palette items
  const commandItems: CommandItem[] = React.useMemo(() => {
    const navigationCommands = createNavigationCommands(router);
    const actionCommands = createActionCommands({
      newRequest: () => router.push("/dashboard/requests/new"),
      openShortcutsHelp,
    });

    return [...navigationCommands, ...actionCommands];
  }, [router, openShortcutsHelp]);

  // Use refs for modal state to avoid recreating shortcuts array
  const isCommandPaletteOpenRef = React.useRef(isCommandPaletteOpen);
  const isShortcutsHelpOpenRef = React.useRef(isShortcutsHelpOpen);

  // Keep refs in sync
  React.useEffect(() => {
    isCommandPaletteOpenRef.current = isCommandPaletteOpen;
  }, [isCommandPaletteOpen]);

  React.useEffect(() => {
    isShortcutsHelpOpenRef.current = isShortcutsHelpOpen;
  }, [isShortcutsHelpOpen]);

  // Build global shortcuts - now stable since we use refs for modal state
  const globalShortcuts: KeyboardShortcut[] = React.useMemo(
    () => [
      // Command palette
      {
        id: "command-palette",
        keys: ["Ctrl+K", "Cmd+K"],
        callback: openCommandPalette,
        description: "Open command palette",
        category: "actions",
      },
      // Shortcuts help - "?" key trigger
      {
        id: "shortcuts-help-question",
        keys: "?",
        callback: openShortcutsHelp,
        description: "Show keyboard shortcuts",
        category: "settings",
      },
      // Shortcuts help - Ctrl+/ or Cmd+/
      {
        id: "shortcuts-help",
        keys: ["Ctrl+/", "Cmd+/"],
        callback: openShortcutsHelp,
        description: "Show keyboard shortcuts",
        category: "settings",
      },
      // Escape to close modals - use refs to avoid recreating this callback
      {
        id: "close-modals",
        keys: "Escape",
        callback: () => {
          if (isCommandPaletteOpenRef.current) {
            closeCommandPalette();
          } else if (isShortcutsHelpOpenRef.current) {
            closeShortcutsHelp();
          }
        },
        description: "Close modals",
        category: "actions",
        preventDefault: false,
      },
      // Navigation shortcuts
      {
        id: "go-dashboard",
        keys: "g d",
        callback: () => router.push("/dashboard"),
        description: "Go to Dashboard",
        category: "navigation",
      },
      {
        id: "go-creators",
        keys: "g c",
        callback: () => router.push("/dashboard/creators"),
        description: "Go to Creators",
        category: "navigation",
      },
      {
        id: "go-requests",
        keys: "g r",
        callback: () => router.push("/dashboard/requests"),
        description: "Go to Requests",
        category: "navigation",
      },
      {
        id: "go-uploads",
        keys: "g u",
        callback: () => router.push("/dashboard/uploads"),
        description: "Go to Uploads",
        category: "navigation",
      },
      {
        id: "go-messages",
        keys: "g m",
        callback: () => router.push("/dashboard/messages"),
        description: "Go to Messages",
        category: "navigation",
      },
      {
        id: "go-templates",
        keys: "g t",
        callback: () => router.push("/dashboard/templates"),
        description: "Go to Templates",
        category: "navigation",
      },
      {
        id: "go-analytics",
        keys: "g a",
        callback: () => router.push("/dashboard/analytics"),
        description: "Go to Analytics",
        category: "navigation",
      },
      // Actions
      {
        id: "new-request",
        keys: ["Ctrl+N", "Cmd+N"],
        callback: () => router.push("/dashboard/requests/new"),
        description: "Create new request",
        category: "actions",
      },
    ],
    [
      router,
      openCommandPalette,
      openShortcutsHelp,
      closeCommandPalette,
      closeShortcutsHelp,
    ]
  );

  // Content shortcuts (context-aware)
  const contentShortcuts: KeyboardShortcut[] = React.useMemo(
    () => [
      {
        id: "approve-upload",
        keys: "a",
        callback: () => {
          // Dispatch custom event for components to handle
          window.dispatchEvent(new CustomEvent("keyboard-shortcut:approve"));
        },
        description: "Approve upload",
        category: "content",
        context: ["uploads"],
      },
      {
        id: "request-revision",
        keys: "r",
        callback: () => {
          window.dispatchEvent(new CustomEvent("keyboard-shortcut:revision"));
        },
        description: "Request revision",
        category: "content",
        context: ["uploads"],
      },
      {
        id: "preview-content",
        keys: "Space",
        callback: () => {
          window.dispatchEvent(new CustomEvent("keyboard-shortcut:preview"));
        },
        description: "Preview content",
        category: "content",
        context: ["uploads", "requests"],
        preventDefault: true,
      },
      {
        id: "navigate-next",
        keys: "j",
        callback: () => {
          window.dispatchEvent(new CustomEvent("keyboard-shortcut:next"));
        },
        description: "Next item",
        category: "content",
        context: ["uploads", "requests", "creators"],
      },
      {
        id: "navigate-prev",
        keys: "k",
        callback: () => {
          window.dispatchEvent(new CustomEvent("keyboard-shortcut:prev"));
        },
        description: "Previous item",
        category: "content",
        context: ["uploads", "requests", "creators"],
      },
    ],
    []
  );

  // Combine all shortcuts
  const allShortcuts = React.useMemo(
    () => [...globalShortcuts, ...contentShortcuts, ...contextShortcuts],
    [globalShortcuts, contentShortcuts, contextShortcuts]
  );

  // Register shortcuts
  useKeyboardShortcuts({
    shortcuts: allShortcuts,
    enabled: true,
    context,
  });

  const contextValue: KeyboardShortcutsContextValue = {
    openCommandPalette,
    closeCommandPalette,
    openShortcutsHelp,
    closeShortcutsHelp,
    registerContextShortcuts,
    unregisterContextShortcuts,
    context,
    setContext,
  };

  return (
    <KeyboardShortcutsContext.Provider value={contextValue}>
      {children}

      {/* Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={closeCommandPalette}
        items={commandItems}
        recentItems={recentCommands}
        onSelectItem={addRecentCommand}
      />

      {/* Keyboard Shortcuts Dialog */}
      <KeyboardShortcutsDialog
        open={isShortcutsHelpOpen}
        onOpenChange={(open) => !open && closeShortcutsHelp()}
        context={context}
      />
    </KeyboardShortcutsContext.Provider>
  );
}

// Hook for using content shortcuts in components
export function useContentShortcuts(handlers: {
  onApprove?: () => void;
  onRevision?: () => void;
  onPreview?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
}) {
  React.useEffect(() => {
    const handleApprove = () => handlers.onApprove?.();
    const handleRevision = () => handlers.onRevision?.();
    const handlePreview = () => handlers.onPreview?.();
    const handleNext = () => handlers.onNext?.();
    const handlePrev = () => handlers.onPrev?.();

    window.addEventListener("keyboard-shortcut:approve", handleApprove);
    window.addEventListener("keyboard-shortcut:revision", handleRevision);
    window.addEventListener("keyboard-shortcut:preview", handlePreview);
    window.addEventListener("keyboard-shortcut:next", handleNext);
    window.addEventListener("keyboard-shortcut:prev", handlePrev);

    return () => {
      window.removeEventListener("keyboard-shortcut:approve", handleApprove);
      window.removeEventListener("keyboard-shortcut:revision", handleRevision);
      window.removeEventListener("keyboard-shortcut:preview", handlePreview);
      window.removeEventListener("keyboard-shortcut:next", handleNext);
      window.removeEventListener("keyboard-shortcut:prev", handlePrev);
    };
  }, [handlers]);
}
