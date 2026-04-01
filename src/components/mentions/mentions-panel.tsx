"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AtSign,
  CheckCheck,
  ExternalLink,
  Filter,
  Loader2,
  MoreVertical,
  RefreshCw,
  FileText,
  Upload,
  MessageSquare,
  Inbox,
  Eye,
  Trash2,
} from "lucide-react";
import { useMentionsPanel } from "@/hooks/use-mentions";
import type { MentionWithDetails, MentionFilters } from "@/types/mentions";
import { toast } from "sonner";

// ============================================
// TYPES
// ============================================

interface MentionsPanelProps {
  className?: string;
  compact?: boolean;
  maxItems?: number;
}

// ============================================
// RESOURCE TYPE ICONS
// ============================================

const resourceTypeIcons = {
  request: FileText,
  upload: Upload,
  message: MessageSquare,
};

const resourceTypeLabels = {
  request: "Request",
  upload: "Upload",
  message: "Message",
};

// ============================================
// MENTIONS PANEL COMPONENT
// ============================================

export function MentionsPanel({
  className,
  compact = false,
  maxItems,
}: MentionsPanelProps) {
  // Filters state
  const [filters, setFilters] = useState<MentionFilters>({
    read: undefined,
    resourceType: "all",
  });

  // Selected items for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Hook for fetching mentions
  const {
    mentions,
    isLoading,
    error,
    unreadCount,
    hasMore,
    refresh,
    loadMore,
    markAsRead,
    markAllAsRead,
  } = useMentionsPanel({ filters, limit: maxItems });

  // Toggle selection
  const toggleSelection = useCallback((mentionId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(mentionId)) {
        next.delete(mentionId);
      } else {
        next.add(mentionId);
      }
      return next;
    });
  }, []);

  // Select all
  const selectAll = useCallback(() => {
    setSelectedIds(new Set(mentions.map((m) => m.id)));
  }, [mentions]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Handle bulk mark as read
  const handleBulkMarkAsRead = useCallback(async () => {
    try {
      await Promise.all(Array.from(selectedIds).map((id) => markAsRead(id)));
      toast.success(`Marked ${selectedIds.size} mentions as read`);
      clearSelection();
    } catch (error) {
      toast.error("Failed to mark mentions as read");
    }
  }, [selectedIds, markAsRead, clearSelection]);

  // Handle filter change
  const handleFilterChange = useCallback(
    (key: keyof MentionFilters, value: unknown) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
      clearSelection();
    },
    [clearSelection]
  );

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between border-b",
          compact ? "px-4 py-3" : "px-6 py-4"
        )}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-violet-600 text-white shadow-sm">
            <AtSign className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Mentions</h2>
            {unreadCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {unreadCount} unread
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Refresh button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refresh()}
            disabled={isLoading}
            className="h-8 w-8"
          >
            <RefreshCw
              className={cn("h-4 w-4", isLoading && "animate-spin")}
            />
            <span className="sr-only">Refresh</span>
          </Button>

          {/* Mark all as read */}
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="h-8 text-xs"
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div
        className={cn(
          "flex items-center gap-3 border-b bg-muted/30",
          compact ? "px-4 py-2" : "px-6 py-3"
        )}
      >
        <Filter className="h-4 w-4 text-muted-foreground" />

        {/* Read/Unread filter */}
        <Select
          value={filters.read === undefined ? "all" : filters.read.toString()}
          onValueChange={(value) =>
            handleFilterChange(
              "read",
              value === "all" ? undefined : value === "true"
            )
          }
        >
          <SelectTrigger className="w-[120px] h-8 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="false">Unread</SelectItem>
            <SelectItem value="true">Read</SelectItem>
          </SelectContent>
        </Select>

        {/* Resource type filter */}
        <Select
          value={filters.resourceType || "all"}
          onValueChange={(value) =>
            handleFilterChange(
              "resourceType",
              value as MentionFilters["resourceType"]
            )
          }
        >
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="request">Requests</SelectItem>
            <SelectItem value="upload">Uploads</SelectItem>
            <SelectItem value="message">Messages</SelectItem>
          </SelectContent>
        </Select>

        {/* Bulk actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-muted-foreground">
              {selectedIds.size} selected
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBulkMarkAsRead}
              className="h-7 text-xs"
            >
              <Eye className="h-3 w-3 mr-1" />
              Mark read
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSelection}
              className="h-7 text-xs"
            >
              Clear
            </Button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Loading state */}
        {isLoading && mentions.length === 0 && (
          <div className="divide-y">
            {[...Array(5)].map((_, i) => (
              <MentionItemSkeleton key={i} compact={compact} />
            ))}
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-destructive mb-2">
              Failed to load mentions
            </p>
            <Button variant="ghost" size="sm" onClick={() => refresh()}>
              Try again
            </Button>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && mentions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Inbox className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-medium text-foreground">No mentions yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              When someone mentions you, it will appear here
            </p>
          </div>
        )}

        {/* Mentions list */}
        {mentions.length > 0 && (
          <div className="divide-y">
            {mentions.map((mention) => (
              <MentionItem
                key={mention.id}
                mention={mention}
                compact={compact}
                isSelected={selectedIds.has(mention.id)}
                onToggleSelect={() => toggleSelection(mention.id)}
                onMarkAsRead={() => markAsRead(mention.id)}
              />
            ))}
          </div>
        )}

        {/* Load more */}
        {hasMore && !isLoading && (
          <div className="p-4 text-center">
            <Button variant="ghost" size="sm" onClick={loadMore}>
              Load more
            </Button>
          </div>
        )}

        {/* Loading more indicator */}
        {isLoading && mentions.length > 0 && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// MENTION ITEM COMPONENT
// ============================================

interface MentionItemProps {
  mention: MentionWithDetails;
  compact?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  onMarkAsRead?: () => void;
}

function MentionItem({
  mention,
  compact = false,
  isSelected = false,
  onToggleSelect,
  onMarkAsRead,
}: MentionItemProps) {
  const ResourceIcon = resourceTypeIcons[mention.resourceType];
  const resourceLabel = resourceTypeLabels[mention.resourceType];

  return (
    <div
      className={cn(
        "group flex items-start gap-3 transition-colors hover:bg-muted/50",
        compact ? "px-4 py-3" : "px-6 py-4",
        !mention.read && "bg-primary/5"
      )}
    >
      {/* Selection checkbox */}
      <div className="pt-1">
        <Checkbox
          checked={isSelected}
          onCheckedChange={onToggleSelect}
          className="opacity-0 group-hover:opacity-100 data-[state=checked]:opacity-100"
        />
      </div>

      {/* Avatar */}
      <Avatar
        user={{
          name: mention.mentionedBy.name,
          email: mention.mentionedBy.email,
          image: mention.mentionedBy.avatar,
        }}
        size={compact ? "sm" : "md"}
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm truncate">
            {mention.mentionedBy.name}
          </span>
          <span className="text-muted-foreground text-sm">mentioned you</span>
          {!mention.read && (
            <span className="h-2 w-2 rounded-full bg-primary" />
          )}
        </div>

        {/* Comment preview */}
        <p
          className={cn(
            "text-sm text-muted-foreground line-clamp-2 mb-2",
            compact && "line-clamp-1"
          )}
        >
          {mention.comment.message}
        </p>

        {/* Meta info */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <ResourceIcon className="h-3 w-3" />
            {resourceLabel}
          </span>
          <span>{mention.resource.title}</span>
          <span>
            {formatDistanceToNow(new Date(mention.createdAt), {
              addSuffix: true,
            })}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
          <Link href={mention.resource.url}>
            <ExternalLink className="h-4 w-4" />
            <span className="sr-only">View</span>
          </Link>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">More options</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!mention.read && (
              <DropdownMenuItem onClick={onMarkAsRead}>
                <Eye className="h-4 w-4 mr-2" />
                Mark as read
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <Link href={mention.resource.url}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Go to {resourceLabel.toLowerCase()}
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ============================================
// SKELETON
// ============================================

function MentionItemSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-start gap-3",
        compact ? "px-4 py-3" : "px-6 py-4"
      )}
    >
      <Skeleton className="h-4 w-4 mt-1 rounded" />
      <Skeleton className={cn("rounded-full", compact ? "h-8 w-8" : "h-10 w-10")} />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-full max-w-md" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  );
}

// ============================================
// COMPACT MENTIONS DROPDOWN
// ============================================

interface MentionsDropdownProps {
  maxItems?: number;
  className?: string;
}

export function MentionsDropdown({
  maxItems = 5,
  className,
}: MentionsDropdownProps) {
  const { mentions, isLoading, unreadCount, markAsRead, markAllAsRead } =
    useMentionsPanel({ limit: maxItems });

  return (
    <div className={cn("w-[380px]", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <AtSign className="h-4 w-4 text-primary" />
          <span className="font-semibold">Mentions</span>
          {unreadCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {unreadCount}
            </Badge>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={markAllAsRead}
            className="h-7 text-xs"
          >
            Mark all read
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="max-h-[400px] overflow-y-auto">
        {isLoading && mentions.length === 0 ? (
          <div className="divide-y">
            {[...Array(3)].map((_, i) => (
              <MentionItemSkeleton key={i} compact />
            ))}
          </div>
        ) : mentions.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <AtSign className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No mentions yet</p>
          </div>
        ) : (
          <div className="divide-y">
            {mentions.map((mention) => (
              <MentionItem
                key={mention.id}
                mention={mention}
                compact
                onMarkAsRead={() => markAsRead(mention.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {mentions.length > 0 && (
        <div className="border-t p-2">
          <Button variant="ghost" className="w-full h-9 text-sm" asChild>
            <Link href="/dashboard/mentions">View all mentions</Link>
          </Button>
        </div>
      )}
    </div>
  );
}

export default MentionsPanel;
