"use client";

import * as React from "react";
import { X, Keyboard, Compass, Zap, FileEdit } from "lucide-react";
import { formatShortcut, useModifierKey } from "@/hooks/use-keyboard-shortcuts";

interface ShortcutSection {
  title: string;
  icon: React.ReactNode;
  shortcuts: {
    keys: string | string[];
    description: string;
  }[];
}

interface ShortcutsHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShortcutsHelpModal({ isOpen, onClose }: ShortcutsHelpModalProps) {
  const modKey = useModifierKey();

  // Close on Escape
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sections: ShortcutSection[] = [
    {
      title: "Navigation",
      icon: <Compass className="h-4 w-4" />,
      shortcuts: [
        { keys: "g d", description: "Go to Dashboard" },
        { keys: "g c", description: "Go to Creators" },
        { keys: "g r", description: "Go to Requests" },
        { keys: "g u", description: "Go to Uploads" },
        { keys: "g m", description: "Go to Messages" },
        { keys: "g t", description: "Go to Templates" },
        { keys: "g a", description: "Go to Analytics" },
      ],
    },
    {
      title: "Actions",
      icon: <Zap className="h-4 w-4" />,
      shortcuts: [
        { keys: "Ctrl+N", description: "Create new request" },
        { keys: "Ctrl+K", description: "Open command palette" },
        { keys: "Ctrl+/", description: "Show this help" },
        { keys: "Escape", description: "Close modals" },
      ],
    },
    {
      title: "Content Review",
      icon: <FileEdit className="h-4 w-4" />,
      shortcuts: [
        { keys: "a", description: "Approve upload" },
        { keys: "r", description: "Request revision" },
        { keys: "Space", description: "Preview content" },
        { keys: "j", description: "Next item in list" },
        { keys: "k", description: "Previous item in list" },
      ],
    },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 animate-in fade-in slide-in-from-bottom-4 duration-200">
        <div className="overflow-hidden rounded-xl border bg-background shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Keyboard className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
                <p className="text-sm text-muted-foreground">
                  Navigate faster with these shortcuts
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          {/* Content */}
          <div className="max-h-[60vh] overflow-y-auto p-6">
            <div className="grid gap-8 md:grid-cols-2">
              {sections.map((section) => (
                <div key={section.title}>
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    {section.icon}
                    {section.title}
                  </div>
                  <div className="space-y-2">
                    {section.shortcuts.map((shortcut, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2"
                      >
                        <span className="text-sm">{shortcut.description}</span>
                        <ShortcutKeys keys={shortcut.keys} modKey={modKey} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Tips */}
            <div className="mt-8 rounded-lg border border-dashed p-4">
              <h3 className="mb-2 text-sm font-medium">Pro Tips</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>
                  Press <kbd className="rounded bg-muted px-1.5 py-0.5 text-xs">G</kbd> and
                  then quickly press a letter to navigate
                </li>
                <li>
                  Use <kbd className="rounded bg-muted px-1.5 py-0.5 text-xs">{modKey}+K</kbd> to
                  search for any action
                </li>
                <li>
                  Shortcuts are disabled when typing in text fields
                </li>
              </ul>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t px-6 py-3 text-center text-xs text-muted-foreground">
            Press <kbd className="rounded bg-muted px-1.5 py-0.5">Esc</kbd> to close
          </div>
        </div>
      </div>
    </>
  );
}

function ShortcutKeys({ keys, modKey }: { keys: string | string[]; modKey: "Cmd" | "Ctrl" }) {
  const formatted = formatShortcut(keys, modKey);

  // Check if it's a sequence (contains "then")
  if (formatted.includes(" then ")) {
    const parts = formatted.split(" then ");
    return (
      <div className="flex items-center gap-1">
        {parts.map((part, i) => (
          <React.Fragment key={i}>
            <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded bg-muted px-2 text-xs font-medium">
              {part}
            </kbd>
            {i < parts.length - 1 && (
              <span className="text-xs text-muted-foreground">then</span>
            )}
          </React.Fragment>
        ))}
      </div>
    );
  }

  // Regular combo
  const parts = formatted.split(" + ");
  return (
    <div className="flex items-center gap-1">
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded bg-muted px-2 text-xs font-medium">
            {part}
          </kbd>
          {i < parts.length - 1 && (
            <span className="text-xs text-muted-foreground">+</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
