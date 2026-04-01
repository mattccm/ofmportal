"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  FileText,
  Upload,
  MessageSquare,
  FileStack,
  BarChart3,
  Plus,
  Keyboard,
  Settings,
  Search,
  ArrowRight,
  History,
  Compass,
  Zap,
  Cog,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatShortcut, useModifierKey } from "@/hooks/use-keyboard-shortcuts";

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  shortcut?: string | string[];
  action: () => void;
  category: "navigation" | "actions" | "settings" | "recent";
  keywords?: string[];
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  items: CommandItem[];
  recentItems?: string[]; // IDs of recently used items
  onSelectItem?: (itemId: string) => void;
}

const categoryConfig = {
  recent: { label: "Recent", icon: History },
  navigation: { label: "Navigation", icon: Compass },
  actions: { label: "Actions", icon: Zap },
  settings: { label: "Settings", icon: Cog },
};

export function CommandPalette({
  isOpen,
  onClose,
  items,
  recentItems = [],
  onSelectItem,
}: CommandPaletteProps) {
  const [search, setSearch] = React.useState("");
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const modKey = useModifierKey();

  // Filter and group items
  const filteredItems = React.useMemo(() => {
    const searchLower = search.toLowerCase().trim();

    let filtered = items;

    if (searchLower) {
      filtered = items.filter((item) => {
        const labelMatch = item.label.toLowerCase().includes(searchLower);
        const descMatch = item.description?.toLowerCase().includes(searchLower);
        const keywordMatch = item.keywords?.some((k) =>
          k.toLowerCase().includes(searchLower)
        );
        return labelMatch || descMatch || keywordMatch;
      });
    }

    // Group by category
    const grouped: Record<string, CommandItem[]> = {
      recent: [],
      navigation: [],
      actions: [],
      settings: [],
    };

    // Add recent items first if no search
    if (!searchLower && recentItems.length > 0) {
      const recentItemObjects = recentItems
        .map((id) => items.find((item) => item.id === id))
        .filter((item): item is CommandItem => item !== undefined)
        .slice(0, 3);
      grouped.recent = recentItemObjects;
    }

    // Group remaining items
    filtered.forEach((item) => {
      // Don't duplicate recent items in their regular category
      if (!grouped.recent.find((r) => r.id === item.id)) {
        grouped[item.category]?.push(item);
      }
    });

    return grouped;
  }, [items, search, recentItems]);

  // Flatten for keyboard navigation
  const flatItems = React.useMemo(() => {
    return [
      ...filteredItems.recent,
      ...filteredItems.navigation,
      ...filteredItems.actions,
      ...filteredItems.settings,
    ];
  }, [filteredItems]);

  // Reset selection when search changes
  React.useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  // Focus input when opened
  React.useEffect(() => {
    if (isOpen) {
      setSearch("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Scroll selected item into view
  React.useEffect(() => {
    if (listRef.current && flatItems.length > 0) {
      const selectedElement = listRef.current.querySelector(
        `[data-index="${selectedIndex}"]`
      );
      selectedElement?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex, flatItems.length]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < flatItems.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : flatItems.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (flatItems[selectedIndex]) {
          executeItem(flatItems[selectedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        onClose();
        break;
    }
  };

  const executeItem = (item: CommandItem) => {
    onSelectItem?.(item.id);
    onClose();
    item.action();
  };

  if (!isOpen) return null;

  let itemIndex = 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed left-1/2 top-[20%] z-50 w-full max-w-xl -translate-x-1/2 animate-in fade-in slide-in-from-top-4 duration-200">
        <div className="overflow-hidden rounded-xl border bg-background shadow-2xl">
          {/* Search Input */}
          <div className="flex items-center border-b px-4">
            <Search className="h-5 w-5 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Type a command or search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent px-3 py-4 text-sm outline-none placeholder:text-muted-foreground"
            />
            <button
              onClick={onClose}
              className="rounded p-1.5 hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Results */}
          <div
            ref={listRef}
            className="max-h-[60vh] overflow-y-auto overscroll-contain p-2"
          >
            {flatItems.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No results found for &quot;{search}&quot;
              </div>
            ) : (
              <>
                {(Object.keys(categoryConfig) as Array<keyof typeof categoryConfig>).map(
                  (category) => {
                    const categoryItems = filteredItems[category];
                    if (!categoryItems || categoryItems.length === 0) return null;

                    const CategoryIcon = categoryConfig[category].icon;

                    return (
                      <div key={category} className="mb-2">
                        <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground">
                          <CategoryIcon className="h-3.5 w-3.5" />
                          {categoryConfig[category].label}
                        </div>
                        {categoryItems.map((item) => {
                          const currentIndex = itemIndex++;
                          const isSelected = currentIndex === selectedIndex;

                          return (
                            <button
                              key={item.id}
                              data-index={currentIndex}
                              onClick={() => executeItem(item)}
                              onMouseEnter={() => setSelectedIndex(currentIndex)}
                              className={cn(
                                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                                isSelected
                                  ? "bg-primary text-primary-foreground"
                                  : "hover:bg-muted"
                              )}
                            >
                              <div
                                className={cn(
                                  "flex h-8 w-8 items-center justify-center rounded-md",
                                  isSelected
                                    ? "bg-primary-foreground/20"
                                    : "bg-muted"
                                )}
                              >
                                {item.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm">
                                  {item.label}
                                </div>
                                {item.description && (
                                  <div
                                    className={cn(
                                      "text-xs truncate",
                                      isSelected
                                        ? "text-primary-foreground/70"
                                        : "text-muted-foreground"
                                    )}
                                  >
                                    {item.description}
                                  </div>
                                )}
                              </div>
                              {item.shortcut && (
                                <div className="flex items-center gap-1">
                                  {formatShortcut(item.shortcut, modKey)
                                    .split(" + ")
                                    .map((key, i, arr) => (
                                      <React.Fragment key={i}>
                                        <kbd
                                          className={cn(
                                            "inline-flex h-5 min-w-5 items-center justify-center rounded px-1.5 text-[10px] font-medium",
                                            isSelected
                                              ? "bg-primary-foreground/20 text-primary-foreground"
                                              : "bg-muted text-muted-foreground"
                                          )}
                                        >
                                          {key}
                                        </kbd>
                                        {i < arr.length - 1 && (
                                          <span
                                            className={cn(
                                              "text-[10px]",
                                              isSelected
                                                ? "text-primary-foreground/50"
                                                : "text-muted-foreground/50"
                                            )}
                                          >
                                            +
                                          </span>
                                        )}
                                      </React.Fragment>
                                    ))}
                                </div>
                              )}
                              <ArrowRight
                                className={cn(
                                  "h-4 w-4 transition-transform",
                                  isSelected
                                    ? "translate-x-0 opacity-100"
                                    : "-translate-x-2 opacity-0"
                                )}
                              />
                            </button>
                          );
                        })}
                      </div>
                    );
                  }
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="rounded bg-muted px-1.5 py-0.5">↑↓</kbd>
                Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded bg-muted px-1.5 py-0.5">Enter</kbd>
                Select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded bg-muted px-1.5 py-0.5">Esc</kbd>
                Close
              </span>
            </div>
            <span>Command Palette</span>
          </div>
        </div>
      </div>
    </>
  );
}

// Pre-built command items factory
export function createNavigationCommands(router: ReturnType<typeof useRouter>) {
  return [
    {
      id: "go-dashboard",
      label: "Go to Dashboard",
      description: "View overview and stats",
      icon: <LayoutDashboard className="h-4 w-4" />,
      shortcut: "g d",
      action: () => router.push("/dashboard"),
      category: "navigation" as const,
      keywords: ["home", "overview", "stats"],
    },
    {
      id: "go-creators",
      label: "Go to Creators",
      description: "Manage content creators",
      icon: <Users className="h-4 w-4" />,
      shortcut: "g c",
      action: () => router.push("/dashboard/creators"),
      category: "navigation" as const,
      keywords: ["users", "people", "team"],
    },
    {
      id: "go-requests",
      label: "Go to Requests",
      description: "View content requests",
      icon: <FileText className="h-4 w-4" />,
      shortcut: "g r",
      action: () => router.push("/dashboard/requests"),
      category: "navigation" as const,
      keywords: ["tasks", "content", "assignments"],
    },
    {
      id: "go-uploads",
      label: "Go to Uploads",
      description: "Review uploaded content",
      icon: <Upload className="h-4 w-4" />,
      shortcut: "g u",
      action: () => router.push("/dashboard/uploads"),
      category: "navigation" as const,
      keywords: ["files", "media", "content"],
    },
    {
      id: "go-messages",
      label: "Go to Messages",
      description: "View conversations",
      icon: <MessageSquare className="h-4 w-4" />,
      shortcut: "g m",
      action: () => router.push("/dashboard/messages"),
      category: "navigation" as const,
      keywords: ["chat", "conversations", "inbox"],
    },
    {
      id: "go-templates",
      label: "Go to Templates",
      description: "Manage content templates",
      icon: <FileStack className="h-4 w-4" />,
      shortcut: "g t",
      action: () => router.push("/dashboard/templates"),
      category: "navigation" as const,
      keywords: ["presets", "formats"],
    },
    {
      id: "go-analytics",
      label: "Go to Analytics",
      description: "View performance metrics",
      icon: <BarChart3 className="h-4 w-4" />,
      shortcut: "g a",
      action: () => router.push("/dashboard/analytics"),
      category: "navigation" as const,
      keywords: ["reports", "metrics", "data"],
    },
  ];
}

export function createActionCommands(callbacks: {
  newRequest?: () => void;
  openShortcutsHelp?: () => void;
}) {
  return [
    {
      id: "new-request",
      label: "Create New Request",
      description: "Start a new content request",
      icon: <Plus className="h-4 w-4" />,
      shortcut: "Ctrl+N",
      action: callbacks.newRequest || (() => {}),
      category: "actions" as const,
      keywords: ["add", "create", "new"],
    },
    {
      id: "shortcuts-help",
      label: "Keyboard Shortcuts",
      description: "View all available shortcuts",
      icon: <Keyboard className="h-4 w-4" />,
      shortcut: "Ctrl+/",
      action: callbacks.openShortcutsHelp || (() => {}),
      category: "settings" as const,
      keywords: ["help", "hotkeys", "keys"],
    },
    {
      id: "settings",
      label: "Settings",
      description: "Open application settings",
      icon: <Settings className="h-4 w-4" />,
      action: () => {},
      category: "settings" as const,
      keywords: ["preferences", "config", "options"],
    },
  ];
}
