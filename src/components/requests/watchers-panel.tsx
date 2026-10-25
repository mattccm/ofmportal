"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
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

// TYPES

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

// WATCHERS PANEL COMPONENT

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
            <TooltipTrigger asChild>
              <Button aria-label={isWatching ? "Unwatch request" : "Watch request"}
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
              <TooltipTrigger asChild>
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

  // Full panel view (for request detail page): a plain row group that sits
  // inside the request rail's secondary tile, with no card of its own
  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[14px] font-semibold text-ink">
            Watchers <span className="font-normal text-ink-2">{watchers.length}</span>
          </h3>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={toggleSelfWatch} disabled={loading}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />}
              {isWatching ? "Stop watching" : "Watch"}
            </Button>
            {canManageWatchers && (
              <Button variant="ghost" size="sm" onClick={() => setAddDialogOpen(true)}>
                <UserPlus className="h-3.5 w-3.5" />
                Add
              </Button>
            )}
          </div>
        </div>
        {watchers.length === 0 ? (
          <p className="text-[14px] text-ink-2">
            No one is watching. Watchers hear about new uploads, comments and status changes.
          </p>
        ) : (
          <div className="max-h-[200px] space-y-0.5 overflow-y-auto">
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
        )}
      </div>

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

// WATCHER LIST ITEM COMPONENT

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
    <div className="flex items-center justify-between py-1.5 px-2 -mx-2 rounded-[8px] hover:bg-tile-hi group transition-colors">
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
            <Button aria-label={`Watcher options for ${watcher.user.name}`}
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
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

// WATCH BUTTON COMPONENT (for request cards)

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
        <TooltipTrigger asChild>
          <Button aria-label={isWatching ? "Unwatch request" : "Watch request"}
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
