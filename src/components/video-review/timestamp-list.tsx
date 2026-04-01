"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageSquare,
  AlertCircle,
  ThumbsUp,
  StickyNote,
  Clock,
  Check,
  CheckCheck,
  Filter,
  SortAsc,
  SortDesc,
  ChevronDown,
  ChevronRight,
  Reply,
  Loader2,
  Send,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import {
  type VideoTimestamp,
  type VideoTimestampReply,
  type TimestampFilters,
  DEFAULT_TIMESTAMP_FILTERS,
  formatTimestamp,
  getTimestampTypeLabel,
  getSeverityLabel,
} from "@/types/video-timestamps";

// ============================================
// TYPES
// ============================================

interface TimestampListProps {
  timestamps: VideoTimestamp[];
  currentTime: number;
  onJumpTo: (time: number) => void;
  onResolve: (id: string, resolved: boolean) => void;
  onBulkResolve: (ids: string[], resolved: boolean) => void;
  onReply: (timestampId: string, comment: string) => Promise<void>;
  onDelete?: (id: string) => void;
  selectedTimestampId?: string;
  onSelectTimestamp: (timestamp: VideoTimestamp | null) => void;
  currentUserId?: string;
  isLoading?: boolean;
}

interface TimestampItemProps {
  timestamp: VideoTimestamp;
  isSelected: boolean;
  isNearCurrent: boolean;
  onJumpTo: (time: number) => void;
  onResolve: (id: string, resolved: boolean) => void;
  onReply: (comment: string) => Promise<void>;
  onSelect: () => void;
  onDelete?: () => void;
  currentUserId?: string;
}

// ============================================
// HELPERS
// ============================================

function getTypeIcon(type: VideoTimestamp["type"]) {
  switch (type) {
    case "feedback":
      return <MessageSquare className="h-4 w-4" />;
    case "issue":
      return <AlertCircle className="h-4 w-4" />;
    case "praise":
      return <ThumbsUp className="h-4 w-4" />;
    case "note":
      return <StickyNote className="h-4 w-4" />;
    default:
      return null;
  }
}

function getTypeBadgeVariant(type: VideoTimestamp["type"]) {
  switch (type) {
    case "feedback":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "issue":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    case "praise":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    case "note":
      return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
    default:
      return "";
  }
}

function getSeverityBadgeVariant(severity: VideoTimestamp["severity"]) {
  switch (severity) {
    case "minor":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "major":
      return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
    case "critical":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    default:
      return "";
  }
}

// ============================================
// TIMESTAMP ITEM
// ============================================

function TimestampItem({
  timestamp,
  isSelected,
  isNearCurrent,
  onJumpTo,
  onResolve,
  onReply,
  onSelect,
  onDelete,
  currentUserId,
}: TimestampItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);

  // Auto-expand when near current time
  useEffect(() => {
    if (isNearCurrent && !isExpanded) {
      setIsExpanded(true);
    }
  }, [isNearCurrent]);

  // Scroll into view when selected
  useEffect(() => {
    if (isSelected && itemRef.current) {
      itemRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isSelected]);

  const handleSubmitReply = async () => {
    if (!replyText.trim()) return;

    setIsSubmittingReply(true);
    try {
      await onReply(replyText.trim());
      setReplyText("");
      setIsReplying(false);
    } catch (error) {
      console.error("Failed to submit reply:", error);
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const canDelete = onDelete && timestamp.userId === currentUserId;

  return (
    <div
      ref={itemRef}
      className={cn(
        "rounded-lg border transition-all duration-200",
        isSelected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border hover:border-primary/30",
        isNearCurrent && !isSelected && "border-amber-300 dark:border-amber-700",
        timestamp.resolved && "opacity-60"
      )}
    >
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <div
            className="flex items-start gap-3 p-3 cursor-pointer"
            onClick={onSelect}
          >
            {/* Type indicator */}
            <div
              className={cn(
                "flex-shrink-0 p-2 rounded-lg mt-0.5",
                getTypeBadgeVariant(timestamp.type)
              )}
            >
              {getTypeIcon(timestamp.type)}
            </div>

            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="flex items-center gap-2 mb-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onJumpTo(timestamp.timestamp);
                  }}
                  className="font-mono text-sm font-medium text-primary hover:underline"
                >
                  {formatTimestamp(timestamp.timestamp)}
                  {timestamp.endTimestamp && (
                    <span className="text-muted-foreground">
                      {" "}-{" "}{formatTimestamp(timestamp.endTimestamp)}
                    </span>
                  )}
                </button>

                {timestamp.severity && (
                  <Badge
                    variant="outline"
                    className={cn("text-xs", getSeverityBadgeVariant(timestamp.severity))}
                  >
                    {getSeverityLabel(timestamp.severity)}
                  </Badge>
                )}

                {timestamp.resolved && (
                  <Badge variant="outline" className="text-xs bg-muted gap-1">
                    <Check className="h-3 w-3" />
                    Resolved
                  </Badge>
                )}
              </div>

              {/* Comment preview */}
              <p className={cn(
                "text-sm line-clamp-2",
                !isExpanded && "text-muted-foreground"
              )}>
                {timestamp.comment}
              </p>

              {/* Meta */}
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <Avatar user={timestamp.user} size="xs" />
                <span>{timestamp.user.name}</span>
                <span>-</span>
                <span>{formatDistanceToNow(new Date(timestamp.createdAt), { addSuffix: true })}</span>
                {timestamp.replies && timestamp.replies.length > 0 && (
                  <>
                    <span>-</span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {timestamp.replies.length}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Expand indicator */}
            <div className="flex-shrink-0">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <Separator />

          <div className="p-3 space-y-3">
            {/* Full comment */}
            <p className="text-sm whitespace-pre-wrap">{timestamp.comment}</p>

            {/* Annotation indicator */}
            {timestamp.annotation && (
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: timestamp.annotation.color }}
                />
                Has annotation ({timestamp.annotation.type})
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={(e) => {
                  e.stopPropagation();
                  onJumpTo(timestamp.timestamp);
                }}
              >
                <Clock className="h-3.5 w-3.5" />
                Jump to
              </Button>

              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "gap-1.5",
                  !timestamp.resolved &&
                    "text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onResolve(timestamp.id, !timestamp.resolved);
                }}
              >
                <Check className="h-3.5 w-3.5" />
                {timestamp.resolved ? "Unresolve" : "Resolve"}
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsReplying(!isReplying);
                }}
              >
                <Reply className="h-3.5 w-3.5" />
                Reply
              </Button>

              {canDelete && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete?.();
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {/* Replies */}
            {timestamp.replies && timestamp.replies.length > 0 && (
              <div className="space-y-2 pl-4 border-l-2 border-muted">
                {timestamp.replies.map((reply) => (
                  <div key={reply.id} className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Avatar user={reply.user} size="xs" />
                      <span className="font-medium">{reply.user.name}</span>
                      <span>-</span>
                      <span>
                        {formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm">{reply.comment}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Reply form */}
            {isReplying && (
              <div className="flex gap-2">
                <Textarea
                  placeholder="Write a reply..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={2}
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      handleSubmitReply();
                    }
                  }}
                />
                <div className="flex flex-col gap-1">
                  <Button
                    size="icon-sm"
                    onClick={handleSubmitReply}
                    disabled={!replyText.trim() || isSubmittingReply}
                  >
                    {isSubmittingReply ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ============================================
// TIMESTAMP LIST
// ============================================

export function TimestampList({
  timestamps,
  currentTime,
  onJumpTo,
  onResolve,
  onBulkResolve,
  onReply,
  onDelete,
  selectedTimestampId,
  onSelectTimestamp,
  currentUserId,
  isLoading = false,
}: TimestampListProps) {
  const [filters, setFilters] = useState<TimestampFilters>(DEFAULT_TIMESTAMP_FILTERS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Filter and sort timestamps
  const filteredTimestamps = useMemo(() => {
    let result = [...timestamps];

    // Filter by type
    result = result.filter((t) => filters.types.includes(t.type));

    // Filter by resolved status
    if (!filters.showResolved) {
      result = result.filter((t) => !t.resolved);
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (filters.sortBy) {
        case "timestamp":
          comparison = a.timestamp - b.timestamp;
          break;
        case "createdAt":
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case "type":
          comparison = a.type.localeCompare(b.type);
          break;
      }
      return filters.sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [timestamps, filters]);

  // Find timestamps near current time (within 5 seconds)
  const nearCurrentIds = useMemo(() => {
    return new Set(
      timestamps
        .filter((t) => {
          const end = t.endTimestamp || t.timestamp;
          return currentTime >= t.timestamp - 2 && currentTime <= end + 2;
        })
        .map((t) => t.id)
    );
  }, [timestamps, currentTime]);

  // Stats
  const stats = useMemo(() => {
    const total = timestamps.length;
    const resolved = timestamps.filter((t) => t.resolved).length;
    const issues = timestamps.filter((t) => t.type === "issue" && !t.resolved).length;
    return { total, resolved, unresolved: total - resolved, issues };
  }, [timestamps]);

  const toggleType = (type: VideoTimestamp["type"]) => {
    setFilters((prev) => ({
      ...prev,
      types: prev.types.includes(type)
        ? prev.types.filter((t) => t !== type)
        : [...prev.types, type],
    }));
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(filteredTimestamps.map((t) => t.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  };

  const handleBulkResolve = (resolved: boolean) => {
    onBulkResolve(Array.from(selectedIds), resolved);
    clearSelection();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header / Stats */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold">Timestamps</h3>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline" className="gap-1">
              {stats.total} total
            </Badge>
            {stats.issues > 0 && (
              <Badge variant="outline" className="gap-1 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                <AlertCircle className="h-3 w-3" />
                {stats.issues} issues
              </Badge>
            )}
            {stats.resolved > 0 && (
              <Badge variant="outline" className="gap-1 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                <Check className="h-3 w-3" />
                {stats.resolved} resolved
              </Badge>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Filter className="h-4 w-4" />
                Filter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Type</DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={filters.types.includes("feedback")}
                onCheckedChange={() => toggleType("feedback")}
              >
                <MessageSquare className="h-4 w-4 mr-2 text-blue-500" />
                Feedback
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filters.types.includes("issue")}
                onCheckedChange={() => toggleType("issue")}
              >
                <AlertCircle className="h-4 w-4 mr-2 text-red-500" />
                Issues
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filters.types.includes("praise")}
                onCheckedChange={() => toggleType("praise")}
              >
                <ThumbsUp className="h-4 w-4 mr-2 text-green-500" />
                Praise
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filters.types.includes("note")}
                onCheckedChange={() => toggleType("note")}
              >
                <StickyNote className="h-4 w-4 mr-2 text-purple-500" />
                Notes
              </DropdownMenuCheckboxItem>

              <DropdownMenuSeparator />

              <DropdownMenuCheckboxItem
                checked={filters.showResolved}
                onCheckedChange={(checked) =>
                  setFilters((prev) => ({ ...prev, showResolved: checked }))
                }
              >
                Show resolved
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                {filters.sortOrder === "asc" ? (
                  <SortAsc className="h-4 w-4" />
                ) : (
                  <SortDesc className="h-4 w-4" />
                )}
                Sort
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => setFilters((prev) => ({ ...prev, sortBy: "timestamp" }))}
              >
                <Clock className="h-4 w-4 mr-2" />
                By timestamp
                {filters.sortBy === "timestamp" && <Check className="h-4 w-4 ml-auto" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setFilters((prev) => ({ ...prev, sortBy: "createdAt" }))}
              >
                <Clock className="h-4 w-4 mr-2" />
                By date added
                {filters.sortBy === "createdAt" && <Check className="h-4 w-4 ml-auto" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setFilters((prev) => ({ ...prev, sortBy: "type" }))}
              >
                <Filter className="h-4 w-4 mr-2" />
                By type
                {filters.sortBy === "type" && <Check className="h-4 w-4 ml-auto" />}
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={() =>
                  setFilters((prev) => ({
                    ...prev,
                    sortOrder: prev.sortOrder === "asc" ? "desc" : "asc",
                  }))
                }
              >
                {filters.sortOrder === "asc" ? (
                  <>
                    <SortDesc className="h-4 w-4 mr-2" />
                    Descending
                  </>
                ) : (
                  <>
                    <SortAsc className="h-4 w-4 mr-2" />
                    Ascending
                  </>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant={isSelectionMode ? "secondary" : "outline"}
            size="sm"
            className="gap-1.5"
            onClick={() => {
              if (isSelectionMode) {
                clearSelection();
              } else {
                setIsSelectionMode(true);
              }
            }}
          >
            <CheckCheck className="h-4 w-4" />
            {isSelectionMode ? "Cancel" : "Select"}
          </Button>
        </div>
      </div>

      {/* Selection actions bar */}
      {isSelectionMode && selectedIds.size > 0 && (
        <div className="flex items-center justify-between p-3 bg-muted/50 border-b">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedIds.size === filteredTimestamps.length}
              onCheckedChange={(checked) => {
                if (checked) {
                  selectAll();
                } else {
                  setSelectedIds(new Set());
                }
              }}
            />
            <span className="text-sm font-medium">
              {selectedIds.size} selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-green-600"
              onClick={() => handleBulkResolve(true)}
            >
              <Check className="h-4 w-4" />
              Resolve all
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => handleBulkResolve(false)}
            >
              Unresolve all
            </Button>
          </div>
        </div>
      )}

      {/* Timestamps list */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {filteredTimestamps.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {timestamps.length === 0
                  ? "No timestamp comments yet"
                  : "No timestamps match your filters"}
              </p>
              <p className="text-xs mt-1">
                {timestamps.length === 0 &&
                  'Click on the video timeline or press "M" to add a marker'}
              </p>
            </div>
          ) : (
            filteredTimestamps.map((timestamp) => (
              <div key={timestamp.id} className="flex items-start gap-2">
                {isSelectionMode && (
                  <Checkbox
                    checked={selectedIds.has(timestamp.id)}
                    onCheckedChange={() => toggleSelection(timestamp.id)}
                    className="mt-3.5"
                  />
                )}
                <div className="flex-1">
                  <TimestampItem
                    timestamp={timestamp}
                    isSelected={timestamp.id === selectedTimestampId}
                    isNearCurrent={nearCurrentIds.has(timestamp.id)}
                    onJumpTo={onJumpTo}
                    onResolve={onResolve}
                    onReply={(comment) => onReply(timestamp.id, comment)}
                    onSelect={() =>
                      onSelectTimestamp(
                        timestamp.id === selectedTimestampId ? null : timestamp
                      )
                    }
                    onDelete={onDelete ? () => onDelete(timestamp.id) : undefined}
                    currentUserId={currentUserId}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export default TimestampList;
