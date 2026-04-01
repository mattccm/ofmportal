"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Avatar,
  AvatarGroup,
  AvatarGroupCount,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Eye,
  EyeOff,
  UserPlus,
  MoreHorizontal,
  X,
  Bell,
  BellOff,
  Settings,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { AddWatcherDialog } from "./add-watcher-dialog";

// ============================================
// TYPES
// ============================================

export interface Watcher {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
  };
  notifyOnUpload: boolean;
  notifyOnComment: boolean;
  notifyOnStatus: boolean;
  notifyOnDueDate: boolean;
  createdAt: string;
}

export interface WatchersPanelProps {
  requestId: string;
  watchers: Watcher[];
  currentUserId: string;
  canManageWatchers?: boolean;
  onWatchersChange?: (watchers: Watcher[]) => void;
  compact?: boolean;
}

// ============================================
// WATCHERS PANEL COMPONENT
// ============================================

export function WatchersPanel({
  requestId,
  watchers: initialWatchers,
  currentUserId,
  canManageWatchers = true,
  onWatchersChange,
  compact = false,
}: WatchersPanelProps) {
  const [watchers, setWatchers] = useState<Watcher[]>(initialWatchers);
  const [loading, setLoading] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const isWatching = watchers.some((w) => w.userId === currentUserId);
  const currentUserWatcher = watchers.find((w) => w.userId === currentUserId);

  // Toggle self watching
  const toggleSelfWatch = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/requests/${requestId}/watchers`, {
        method: isWatching ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update watch status");
      }

      const data = await response.json();

      if (isWatching) {
        // Remove from watchers
        const newWatchers = watchers.filter((w) => w.userId !== currentUserId);
        setWatchers(newWatchers);
        onWatchersChange?.(newWatchers);
        toast.success("You are no longer watching this request");
      } else {
        // Add to watchers
        const newWatchers = [...watchers, data.watcher];
        setWatchers(newWatchers);
        onWatchersChange?.(newWatchers);
        toast.success("You are now watching this request");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update watch status");
    } finally {
      setLoading(false);
    }
  }, [requestId, currentUserId, isWatching, watchers, onWatchersChange]);

  // Remove a watcher
  const removeWatcher = useCallback(async (watcherId: string, userName: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/requests/${requestId}/watchers`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ watcherId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to remove watcher");
      }

      const newWatchers = watchers.filter((w) => w.id !== watcherId);
      setWatchers(newWatchers);
      onWatchersChange?.(newWatchers);
      toast.success(`${userName} is no longer watching this request`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove watcher");
    } finally {
      setLoading(false);
    }
  }, [requestId, watchers, onWatchersChange]);

  // Handle watcher added from dialog
  const handleWatcherAdded = useCallback((newWatcher: Watcher) => {
    const newWatchers = [...watchers, newWatcher];
    setWatchers(newWatchers);
    onWatchersChange?.(newWatchers);
  }, [watchers, onWatchersChange]);

  // Compact view (for request cards)
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Button
                variant={isWatching ? "default" : "outline"}
                size="icon-sm"
                onClick={toggleSelfWatch}
                disabled={loading}
                className={isWatching ? "bg-primary/10 text-primary hover:bg-primary/20" : ""}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isWatching ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <EyeOff className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isWatching ? "Unwatch request" : "Watch request"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {watchers.length > 0 && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <div className="flex items-center">
                  <AvatarGroup className="cursor-default">
                    {watchers.slice(0, 3).map((watcher) => (
                      <Avatar
                        key={watcher.id}
                        user={watcher.user}
                        size="xs"
                        ring="white"
                      />
                    ))}
                    {watchers.length > 3 && (
                      <AvatarGroupCount count={watchers.length - 3} size="xs" />
                    )}
                  </AvatarGroup>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-medium mb-1">{watchers.length} watcher{watchers.length !== 1 ? "s" : ""}</p>
                <ul className="text-xs space-y-0.5">
                  {watchers.slice(0, 5).map((watcher) => (
                    <li key={watcher.id}>{watcher.user.name}</li>
                  ))}
                  {watchers.length > 5 && (
                    <li className="text-muted-foreground">
                      +{watchers.length - 5} more
                    </li>
                  )}
                </ul>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    );
  }

  // Full panel view (for request detail page)
  return (
    <>
      <Card className="card-elevated">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              Watchers
              {watchers.length > 0 && (
                <span className="ml-1 text-sm text-muted-foreground font-normal">
                  ({watchers.length})
                </span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant={isWatching ? "secondary" : "outline"}
                size="sm"
                onClick={toggleSelfWatch}
                disabled={loading}
                className="h-8"
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : isWatching ? (
                  <EyeOff className="h-3.5 w-3.5 mr-1.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5 mr-1.5" />
                )}
                {isWatching ? "Unwatch" : "Watch"}
              </Button>
              {canManageWatchers && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAddDialogOpen(true)}
                  className="h-8"
                >
                  <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                  Add
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {watchers.length === 0 ? (
            <div className="text-center py-6">
              <div className="mx-auto h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                <EyeOff className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                No one is watching this request yet
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleSelfWatch}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5 mr-1.5" />
                )}
                Start watching
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Avatar stack preview */}
              <div className="flex items-center justify-between pb-2 border-b border-border/50">
                <AvatarGroup>
                  {watchers.slice(0, 5).map((watcher) => (
                    <Avatar
                      key={watcher.id}
                      user={watcher.user}
                      size="sm"
                      ring="white"
                    />
                  ))}
                  {watchers.length > 5 && (
                    <AvatarGroupCount count={watchers.length - 5} size="sm" />
                  )}
                </AvatarGroup>
                <span className="text-xs text-muted-foreground">
                  {watchers.length} watching
                </span>
              </div>

              {/* Watcher list */}
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {watchers.map((watcher) => (
                  <WatcherListItem
                    key={watcher.id}
                    watcher={watcher}
                    isCurrentUser={watcher.userId === currentUserId}
                    canRemove={canManageWatchers || watcher.userId === currentUserId}
                    onRemove={() => removeWatcher(watcher.id, watcher.user.name)}
                    loading={loading}
                  />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AddWatcherDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        requestId={requestId}
        existingWatcherIds={watchers.map((w) => w.userId)}
        onWatcherAdded={handleWatcherAdded}
      />
    </>
  );
}

// ============================================
// WATCHER LIST ITEM COMPONENT
// ============================================

interface WatcherListItemProps {
  watcher: Watcher;
  isCurrentUser: boolean;
  canRemove: boolean;
  onRemove: () => void;
  loading: boolean;
}

function WatcherListItem({
  watcher,
  isCurrentUser,
  canRemove,
  onRemove,
  loading,
}: WatcherListItemProps) {
  const notificationStatus = [
    watcher.notifyOnUpload && "uploads",
    watcher.notifyOnComment && "comments",
    watcher.notifyOnStatus && "status",
    watcher.notifyOnDueDate && "due dates",
  ].filter(Boolean);

  return (
    <div className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-muted/50 group transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <Avatar user={watcher.user} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">
            {watcher.user.name}
            {isCurrentUser && (
              <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>
            )}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {notificationStatus.length === 4 ? (
              <>
                <Bell className="h-3 w-3" />
                <span>All notifications</span>
              </>
            ) : notificationStatus.length > 0 ? (
              <>
                <Bell className="h-3 w-3" />
                <span className="truncate">{notificationStatus.join(", ")}</span>
              </>
            ) : (
              <>
                <BellOff className="h-3 w-3" />
                <span>Notifications off</span>
              </>
            )}
          </div>
        </div>
      </div>

      {canRemove && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
              disabled={loading}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled>
              <Settings className="h-4 w-4 mr-2" />
              Notification settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onRemove}
              className="text-destructive focus:text-destructive"
            >
              <X className="h-4 w-4 mr-2" />
              {isCurrentUser ? "Stop watching" : "Remove watcher"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

// ============================================
// WATCH BUTTON COMPONENT (for request cards)
// ============================================

export interface WatchButtonProps {
  requestId: string;
  isWatching: boolean;
  watcherCount?: number;
  currentUserId: string;
  onWatchChange?: (isWatching: boolean) => void;
  size?: "sm" | "default";
}

export function WatchButton({
  requestId,
  isWatching: initialIsWatching,
  watcherCount = 0,
  currentUserId,
  onWatchChange,
  size = "sm",
}: WatchButtonProps) {
  const [isWatching, setIsWatching] = useState(initialIsWatching);
  const [loading, setLoading] = useState(false);

  const toggleWatch = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/requests/${requestId}/watchers`, {
        method: isWatching ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update watch status");
      }

      const newStatus = !isWatching;
      setIsWatching(newStatus);
      onWatchChange?.(newStatus);
      toast.success(
        newStatus
          ? "You are now watching this request"
          : "You are no longer watching this request"
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update watch status");
    } finally {
      setLoading(false);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Button
            variant={isWatching ? "secondary" : "outline"}
            size={size === "sm" ? "icon-sm" : "icon"}
            onClick={toggleWatch}
            disabled={loading}
            className={isWatching ? "text-primary" : ""}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isWatching ? (
              <Eye className="h-4 w-4" />
            ) : (
              <EyeOff className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{isWatching ? "Unwatch" : "Watch"} request</p>
          {watcherCount > 0 && (
            <p className="text-xs text-muted-foreground">
              {watcherCount} watcher{watcherCount !== 1 ? "s" : ""}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
