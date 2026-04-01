"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Search,
  Users,
  FileText,
  Upload,
  LayoutTemplate,
  MessageSquare,
  Plus,
  UserPlus,
  Clock,
  ArrowRight,
  Loader2,
  Command,
  X,
  Sparkles,
} from "lucide-react";

// Types
interface SearchResult {
  id: string;
  type: "creator" | "request" | "upload" | "template" | "message";
  title: string;
  subtitle?: string;
  highlight?: string;
  href: string;
  icon?: React.ReactNode;
  metadata?: Record<string, string>;
}

interface QuickAction {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  href?: string;
  action?: () => void;
}

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type CategoryFilter = "all" | "creators" | "requests" | "uploads" | "templates" | "messages";

const CATEGORY_CONFIG: Record<CategoryFilter, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  all: { label: "All", icon: Search },
  creators: { label: "Creators", icon: Users },
  requests: { label: "Requests", icon: FileText },
  uploads: { label: "Uploads", icon: Upload },
  templates: { label: "Templates", icon: LayoutTemplate },
  messages: { label: "Messages", icon: MessageSquare },
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "create-request",
    title: "Create New Request",
    subtitle: "Start a new content request",
    icon: <Plus className="h-4 w-4" />,
    href: "/dashboard/requests/new",
  },
  {
    id: "invite-creator",
    title: "Invite Creator",
    subtitle: "Add a new creator to your portal",
    icon: <UserPlus className="h-4 w-4" />,
    href: "/dashboard/creators?action=invite",
  },
  {
    id: "create-template",
    title: "Create Template",
    subtitle: "Create a new request template",
    icon: <LayoutTemplate className="h-4 w-4" />,
    href: "/dashboard/templates/new",
  },
];

const RECENT_SEARCHES_KEY = "uploadportal_recent_searches";
const MAX_RECENT_SEARCHES = 5;

function getRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string) {
  if (typeof window === "undefined" || !query.trim()) return;
  try {
    const recent = getRecentSearches();
    const filtered = recent.filter((q) => q.toLowerCase() !== query.toLowerCase());
    const updated = [query, ...filtered].slice(0, MAX_RECENT_SEARCHES);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  } catch {
    // Ignore localStorage errors
  }
}

function clearRecentSearches() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch {
    // Ignore localStorage errors
  }
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<CategoryFilter>("all");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [recentSearches, setRecentSearches] = React.useState<string[]>([]);

  // Load recent searches on mount
  React.useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, [open]);

  // Reset state when dialog opens
  React.useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
      setCategory("all");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Debounced search
  React.useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSelectedIndex(0);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          q: query,
          ...(category !== "all" && { type: category }),
          limit: "10",
        });

        const response = await fetch(`/api/search?${params}`);
        if (response.ok) {
          const data = await response.json();
          setResults(data.results || []);
          setSelectedIndex(0);
        }
      } catch (error) {
        console.error("Search failed:", error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, category]);

  // Get all selectable items
  const getSelectableItems = React.useCallback((): Array<{ type: "action" | "recent" | "result"; item: QuickAction | string | SearchResult }> => {
    const items: Array<{ type: "action" | "recent" | "result"; item: QuickAction | string | SearchResult }> = [];

    if (!query.trim()) {
      // Show quick actions
      QUICK_ACTIONS.forEach((action) => items.push({ type: "action", item: action }));
      // Show recent searches
      recentSearches.forEach((search) => items.push({ type: "recent", item: search }));
    } else {
      // Show results
      results.forEach((result) => items.push({ type: "result", item: result }));
    }

    return items;
  }, [query, results, recentSearches]);

  const selectableItems = getSelectableItems();

  // Handle selection
  const handleSelect = React.useCallback((item: { type: "action" | "recent" | "result"; item: QuickAction | string | SearchResult }) => {
    if (item.type === "action") {
      const action = item.item as QuickAction;
      if (action.href) {
        router.push(action.href);
        onOpenChange(false);
      } else if (action.action) {
        action.action();
        onOpenChange(false);
      }
    } else if (item.type === "recent") {
      setQuery(item.item as string);
    } else if (item.type === "result") {
      const result = item.item as SearchResult;
      saveRecentSearch(query);
      router.push(result.href);
      onOpenChange(false);
    }
  }, [query, router, onOpenChange]);

  // Keyboard navigation
  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, selectableItems.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (selectableItems[selectedIndex]) {
          handleSelect(selectableItems[selectedIndex]);
        }
        break;
      case "Escape":
        onOpenChange(false);
        break;
    }
  }, [selectableItems, selectedIndex, handleSelect, onOpenChange]);

  // Scroll selected item into view
  React.useEffect(() => {
    const listElement = listRef.current;
    if (!listElement) return;

    const selectedElement = listElement.querySelector(`[data-index="${selectedIndex}"]`);
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  const getResultIcon = (type: SearchResult["type"]) => {
    const icons = {
      creator: <Users className="h-4 w-4" />,
      request: <FileText className="h-4 w-4" />,
      upload: <Upload className="h-4 w-4" />,
      template: <LayoutTemplate className="h-4 w-4" />,
      message: <MessageSquare className="h-4 w-4" />,
    };
    return icons[type];
  };

  const handleClearRecent = (e: React.MouseEvent) => {
    e.stopPropagation();
    clearRecentSearches();
    setRecentSearches([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden bg-background/95 backdrop-blur-sm border-border/50 shadow-2xl">
        <DialogTitle className="sr-only">Global Search</DialogTitle>

        {/* Search Input */}
        <div className="flex items-center border-b border-border px-4">
          <Search className="h-5 w-5 text-muted-foreground shrink-0" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search creators, requests, uploads, templates..."
            className="h-14 border-0 bg-transparent text-base focus-visible:ring-0 focus-visible:border-0 px-3"
          />
          {isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground shrink-0" />}
          {query && !isLoading && (
            <button
              onClick={() => setQuery("")}
              className="p-1 hover:bg-accent rounded-md transition-colors"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-border bg-muted/30 overflow-x-auto">
          {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
            const Icon = config.icon;
            const isActive = category === key;
            return (
              <button
                key={key}
                onClick={() => {
                  setCategory(key as CategoryFilter);
                  setSelectedIndex(0);
                }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all",
                  isActive
                    ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {config.label}
              </button>
            );
          })}
        </div>

        {/* Results Container */}
        <div
          ref={listRef}
          className="max-h-[400px] overflow-y-auto py-2"
        >
          {/* Empty State - Quick Actions & Recent */}
          {!query.trim() && (
            <>
              {/* Quick Actions */}
              <div className="px-4 py-2">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Quick Actions
                  </span>
                </div>
                <div className="space-y-1">
                  {QUICK_ACTIONS.map((action, index) => (
                    <button
                      key={action.id}
                      data-index={index}
                      onClick={() => handleSelect({ type: "action", item: action })}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all",
                        selectedIndex === index
                          ? "bg-gradient-to-r from-indigo-500/10 to-violet-500/10 border border-indigo-500/20"
                          : "hover:bg-accent"
                      )}
                    >
                      <div className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-lg transition-all",
                        selectedIndex === index
                          ? "bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-md"
                          : "bg-muted text-muted-foreground"
                      )}>
                        {action.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{action.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{action.subtitle}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Recent Searches */}
              {recentSearches.length > 0 && (
                <div className="px-4 py-2 mt-2">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Recent Searches
                      </span>
                    </div>
                    <button
                      onClick={handleClearRecent}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="space-y-1">
                    {recentSearches.map((search, i) => {
                      const itemIndex = QUICK_ACTIONS.length + i;
                      return (
                        <button
                          key={search}
                          data-index={itemIndex}
                          onClick={() => handleSelect({ type: "recent", item: search })}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all",
                            selectedIndex === itemIndex
                              ? "bg-accent"
                              : "hover:bg-accent/50"
                          )}
                        >
                          <Search className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{search}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Search Results */}
          {query.trim() && (
            <>
              {isLoading && results.length === 0 && (
                <div className="flex items-center justify-center py-12">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm">Searching...</span>
                  </div>
                </div>
              )}

              {!isLoading && results.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 px-4">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                    <Search className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground">No results found</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Try adjusting your search or filters
                  </p>
                </div>
              )}

              {results.length > 0 && (
                <div className="px-2 space-y-1">
                  {results.map((result, index) => (
                    <button
                      key={`${result.type}-${result.id}`}
                      data-index={index}
                      onClick={() => handleSelect({ type: "result", item: result })}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all",
                        selectedIndex === index
                          ? "bg-gradient-to-r from-indigo-500/10 to-violet-500/10 border border-indigo-500/20"
                          : "hover:bg-accent"
                      )}
                    >
                      <div className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-lg shrink-0 transition-all",
                        selectedIndex === index
                          ? "bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-md"
                          : "bg-muted text-muted-foreground"
                      )}>
                        {getResultIcon(result.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p
                            className="text-sm font-medium truncate"
                            dangerouslySetInnerHTML={{
                              __html: result.highlight || result.title
                            }}
                          />
                          <span className={cn(
                            "text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded shrink-0",
                            {
                              "bg-blue-500/10 text-blue-600": result.type === "creator",
                              "bg-green-500/10 text-green-600": result.type === "request",
                              "bg-purple-500/10 text-purple-600": result.type === "upload",
                              "bg-orange-500/10 text-orange-600": result.type === "template",
                              "bg-pink-500/10 text-pink-600": result.type === "message",
                            }
                          )}>
                            {result.type}
                          </span>
                        </div>
                        {result.subtitle && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {result.subtitle}
                          </p>
                        )}
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/30">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-background border border-border font-mono text-[10px]">
                <ArrowRight className="h-2.5 w-2.5 inline -rotate-90" />
              </kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-background border border-border font-mono text-[10px]">
                <ArrowRight className="h-2.5 w-2.5 inline rotate-90" />
              </kbd>
              <span className="ml-1">Navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-background border border-border font-mono text-[10px]">
                Enter
              </kbd>
              <span className="ml-1">Select</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-background border border-border font-mono text-[10px]">
                Esc
              </kbd>
              <span className="ml-1">Close</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Command className="h-3 w-3" />
            <span>K to search anywhere</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Search Trigger Button Component
export function SearchTrigger({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-background/50 text-muted-foreground hover:bg-accent hover:text-foreground transition-all w-full",
        className
      )}
    >
      <Search className="h-4 w-4" />
      <span className="text-sm flex-1 text-left">Search...</span>
      <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-muted border border-border font-mono text-[10px]">
        <Command className="h-2.5 w-2.5" />K
      </kbd>
    </button>
  );
}
