"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Plus,
  X,
  FileText,
  UserPlus,
  Upload,
  Bell,
  Keyboard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  useKeyboardShortcuts,
  formatShortcut,
  useModifierKey,
  type KeyboardShortcut,
} from "@/hooks/use-keyboard-shortcuts";

export interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  shortcut: string;
  onClick: () => void;
  contexts?: string[]; // Pages where this action is available
}

interface QuickActionsFABProps {
  onCreateRequest?: () => void;
  onInviteCreator?: () => void;
  onUploadFile?: () => void;
  onSendReminder?: () => void;
  className?: string;
}

// Get page context from pathname
function getPageContext(pathname: string): string {
  if (pathname.includes("/requests")) return "requests";
  if (pathname.includes("/creators")) return "creators";
  if (pathname.includes("/uploads")) return "uploads";
  if (pathname.includes("/reminders")) return "reminders";
  if (pathname.includes("/analytics")) return "analytics";
  if (pathname.includes("/settings")) return "settings";
  return "dashboard";
}

export function QuickActionsFAB({
  onCreateRequest,
  onInviteCreator,
  onUploadFile,
  onSendReminder,
  className,
}: QuickActionsFABProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [showShortcuts, setShowShortcuts] = React.useState(false);
  const fabRef = React.useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const modKey = useModifierKey();
  const pageContext = getPageContext(pathname);

  // Close menu when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (fabRef.current && !fabRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Close on escape
  React.useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  // Define all quick actions
  const allActions: QuickAction[] = React.useMemo(
    () => [
      {
        id: "create-request",
        label: "Create Request",
        description: "Create a new content request",
        icon: <FileText className="h-5 w-5" />,
        shortcut: "Alt+N",
        onClick: () => {
          setIsOpen(false);
          if (onCreateRequest) {
            onCreateRequest();
          } else {
            router.push("/requests/new");
          }
        },
        contexts: ["dashboard", "requests", "creators"],
      },
      {
        id: "invite-creator",
        label: "Invite Creator",
        description: "Send an invitation to a creator",
        icon: <UserPlus className="h-5 w-5" />,
        shortcut: "Alt+I",
        onClick: () => {
          setIsOpen(false);
          if (onInviteCreator) {
            onInviteCreator();
          } else {
            router.push("/creators?invite=true");
          }
        },
        contexts: ["dashboard", "creators", "requests"],
      },
      {
        id: "upload-file",
        label: "Upload File",
        description: "Upload files directly",
        icon: <Upload className="h-5 w-5" />,
        shortcut: "Alt+U",
        onClick: () => {
          setIsOpen(false);
          if (onUploadFile) {
            onUploadFile();
          } else {
            router.push("/uploads?action=upload");
          }
        },
        contexts: ["dashboard", "uploads", "requests"],
      },
      {
        id: "send-reminder",
        label: "Send Reminder",
        description: "Send a reminder to creators",
        icon: <Bell className="h-5 w-5" />,
        shortcut: "Alt+R",
        onClick: () => {
          setIsOpen(false);
          if (onSendReminder) {
            onSendReminder();
          } else {
            router.push("/reminders?compose=true");
          }
        },
        contexts: ["dashboard", "requests", "reminders", "creators"],
      },
    ],
    [onCreateRequest, onInviteCreator, onUploadFile, onSendReminder, router]
  );

  // Filter actions based on current page context
  const contextActions = React.useMemo(() => {
    return allActions.filter(
      (action) => !action.contexts || action.contexts.includes(pageContext)
    );
  }, [allActions, pageContext]);

  // Setup keyboard shortcuts
  const shortcuts: KeyboardShortcut[] = React.useMemo(
    () => [
      ...contextActions.map((action) => ({
        id: action.id,
        keys: action.shortcut,
        callback: action.onClick,
        description: action.description,
        category: "actions" as const,
        preventDefault: true,
      })),
      {
        id: "toggle-fab",
        keys: "Alt+Q",
        callback: () => setIsOpen((prev) => !prev),
        description: "Toggle quick actions menu",
        category: "actions" as const,
        preventDefault: true,
      },
      {
        id: "show-shortcuts",
        keys: ["?", "Shift+/"],
        callback: () => setShowShortcuts((prev) => !prev),
        description: "Show keyboard shortcuts",
        category: "settings" as const,
        preventDefault: true,
      },
    ],
    [contextActions]
  );

  useKeyboardShortcuts({ shortcuts, enabled: true });

  return (
    <>
      {/* FAB Container */}
      <div
        ref={fabRef}
        className={cn(
          "fixed z-50",
          // Position for desktop (bottom-right with more margin)
          "bottom-6 right-6",
          // Position for mobile (account for bottom nav)
          "md:bottom-8 md:right-8",
          className
        )}
      >
        {/* Backdrop when open */}
        {isOpen && (
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-[2px] -z-10 animate-in fade-in duration-200"
            onClick={() => setIsOpen(false)}
          />
        )}

        {/* Quick Action Items */}
        <div
          className={cn(
            "absolute bottom-16 right-0",
            "flex flex-col-reverse gap-3",
            "transition-all duration-300 ease-out",
            isOpen
              ? "opacity-100 translate-y-0 pointer-events-auto"
              : "opacity-0 translate-y-4 pointer-events-none"
          )}
        >
          {contextActions.map((action, index) => (
            <QuickActionItem
              key={action.id}
              action={action}
              index={index}
              isOpen={isOpen}
              modKey={modKey}
            />
          ))}
        </div>

        {/* Main FAB Button */}
        <Button
          size="icon"
          className={cn(
            "h-14 w-14 rounded-2xl shadow-lg",
            "bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600",
            "hover:from-indigo-600 hover:via-violet-600 hover:to-purple-700",
            "text-white border-0",
            "transition-all duration-300 ease-out",
            "hover:shadow-xl hover:shadow-violet-500/30",
            "hover:scale-105",
            "active:scale-95",
            "touch-manipulation",
            isOpen && "rotate-45 shadow-xl shadow-violet-500/40"
          )}
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? "Close quick actions" : "Open quick actions"}
          aria-expanded={isOpen}
        >
          {isOpen ? (
            <X className="h-6 w-6 transition-transform duration-300" />
          ) : (
            <Plus className="h-6 w-6 transition-transform duration-300" />
          )}
        </Button>

        {/* Keyboard shortcut hint */}
        <div
          className={cn(
            "absolute -top-8 right-0",
            "text-xs text-muted-foreground/70",
            "opacity-0 transition-opacity duration-200",
            "md:group-hover:opacity-100",
            "pointer-events-none select-none",
            "hidden md:block"
          )}
        >
          <kbd className="px-1.5 py-0.5 bg-muted/80 rounded text-[10px]">
            {formatShortcut("Alt+Q", modKey)}
          </kbd>
        </div>
      </div>

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <KeyboardShortcutsModal
          actions={contextActions}
          modKey={modKey}
          onClose={() => setShowShortcuts(false)}
        />
      )}
    </>
  );
}

// Individual Quick Action Item
interface QuickActionItemProps {
  action: QuickAction;
  index: number;
  isOpen: boolean;
  modKey: "Cmd" | "Ctrl";
}

function QuickActionItem({
  action,
  index,
  isOpen,
  modKey,
}: QuickActionItemProps) {
  return (
    <button
      onClick={action.onClick}
      className={cn(
        "group flex items-center gap-3",
        "transition-all duration-300 ease-out",
        "origin-bottom-right",
        isOpen
          ? "opacity-100 translate-x-0 scale-100"
          : "opacity-0 translate-x-4 scale-90"
      )}
      style={{
        transitionDelay: isOpen ? `${index * 50}ms` : `${(3 - index) * 30}ms`,
      }}
      aria-label={action.label}
    >
      {/* Label */}
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-2.5",
          "bg-card/95 backdrop-blur-sm rounded-xl",
          "border border-border/50 shadow-lg",
          "text-sm font-medium text-foreground",
          "transition-all duration-200",
          "group-hover:bg-card group-hover:shadow-xl group-hover:-translate-x-1",
          "group-active:scale-95",
          "whitespace-nowrap"
        )}
      >
        <span>{action.label}</span>
        <kbd
          className={cn(
            "hidden md:inline-flex items-center gap-0.5",
            "px-1.5 py-0.5 rounded",
            "bg-muted/80 text-[10px] text-muted-foreground",
            "font-mono"
          )}
        >
          {formatShortcut(action.shortcut, modKey)}
        </kbd>
      </div>

      {/* Icon Button */}
      <div
        className={cn(
          "flex items-center justify-center",
          "h-12 w-12 rounded-xl",
          "bg-gradient-to-br from-indigo-500/90 via-violet-500/90 to-purple-600/90",
          "text-white shadow-lg",
          "transition-all duration-200",
          "group-hover:shadow-xl group-hover:shadow-violet-500/30",
          "group-hover:scale-110",
          "group-active:scale-95"
        )}
      >
        {action.icon}
      </div>
    </button>
  );
}

// Keyboard Shortcuts Modal
interface KeyboardShortcutsModalProps {
  actions: QuickAction[];
  modKey: "Cmd" | "Ctrl";
  onClose: () => void;
}

function KeyboardShortcutsModal({
  actions,
  modKey,
  onClose,
}: KeyboardShortcutsModalProps) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" />
      <div
        className={cn(
          "relative bg-card rounded-2xl border shadow-2xl",
          "w-full max-w-md p-6",
          "animate-in zoom-in-95 fade-in duration-300"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10">
              <Keyboard className="h-5 w-5 text-violet-600" />
            </div>
            <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4">
          {/* Quick Actions */}
          <div>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Quick Actions
            </h3>
            <div className="space-y-2">
              {actions.map((action) => (
                <div
                  key={action.id}
                  className="flex items-center justify-between py-2"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">{action.icon}</span>
                    <span className="text-sm">{action.label}</span>
                  </div>
                  <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">
                    {formatShortcut(action.shortcut, modKey)}
                  </kbd>
                </div>
              ))}
            </div>
          </div>

          {/* General Shortcuts */}
          <div className="pt-4 border-t">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              General
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between py-2">
                <span className="text-sm">Toggle quick actions</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">
                  {formatShortcut("Alt+Q", modKey)}
                </kbd>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm">Show shortcuts</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">
                  ?
                </kbd>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm">Close menu / modal</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">
                  Esc
                </kbd>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-6 text-xs text-muted-foreground text-center">
          Press <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">?</kbd> anytime to see shortcuts
        </p>
      </div>
    </div>
  );
}

export default QuickActionsFAB;
