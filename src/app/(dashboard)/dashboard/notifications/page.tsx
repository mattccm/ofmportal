"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { BackToTop } from "@/components/ui/back-to-top";
import { LoadingIndicator, EndOfListIndicator } from "@/components/lists/infinite-list";
import {
  Bell,
  Settings,
  CheckCheck,
  Loader2,
  Trash2,
  Filter,
  Search,
  Upload,
  CheckCircle,
  XCircle,
  FilePlus,
  Clock,
  MessageCircle,
  AtSign,
  Mail,
  Info,
  Users,
  UserPlus,
  AlertTriangle,
  Eye,
  EyeOff,
  ChevronRight,
  Sparkles,
  MailOpen,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { NotificationType } from "@/lib/notifications";
import { NoNotifications } from "@/components/empty-states";

// ============================================
// TYPE DEFINITIONS
// ============================================

interface NotificationData {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  readAt: Date | null;
  createdAt: Date;
}

interface NotificationGroup {
  date: string;
  label: string;
  notifications: NotificationData[];
}

type FilterType = "all" | NotificationType;
type ReadFilter = "all" | "unread" | "read";

// ============================================
// CONSTANTS
// ============================================

const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  all: "All Types",
  UPLOAD_SUBMITTED: "Uploads",
  UPLOAD_APPROVED: "Approved",
  UPLOAD_REJECTED: "Rejected",
  REQUEST_CREATED: "Requests",
  REQUEST_DUE_SOON: "Due Soon",
  REQUEST_OVERDUE: "Overdue",
  COMMENT_ADDED: "Comments",
  MENTION: "Mentions",
  MESSAGE_RECEIVED: "Messages",
  SYSTEM: "System",
  TEAM_MEMBER_JOINED: "Team",
  CREATOR_INVITED: "Creator Invited",
  CREATOR_JOINED: "Creator Joined",
};

const NOTIFICATION_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  UPLOAD_SUBMITTED: Upload,
  UPLOAD_APPROVED: CheckCircle,
  UPLOAD_REJECTED: XCircle,
  REQUEST_CREATED: FilePlus,
  REQUEST_DUE_SOON: Clock,
  REQUEST_OVERDUE: AlertTriangle,
  COMMENT_ADDED: MessageCircle,
  MENTION: AtSign,
  MESSAGE_RECEIVED: Mail,
  SYSTEM: Info,
  TEAM_MEMBER_JOINED: Users,
  CREATOR_INVITED: UserPlus,
  CREATOR_JOINED: UserPlus,
};

const NOTIFICATION_TYPE_COLORS: Record<string, string> = {
  UPLOAD_SUBMITTED: "text-blue-500",
  UPLOAD_APPROVED: "text-emerald-500",
  UPLOAD_REJECTED: "text-red-500",
  REQUEST_CREATED: "text-violet-500",
  REQUEST_DUE_SOON: "text-amber-500",
  REQUEST_OVERDUE: "text-red-500",
  COMMENT_ADDED: "text-blue-500",
  MENTION: "text-violet-500",
  MESSAGE_RECEIVED: "text-indigo-500",
  SYSTEM: "text-gray-500",
  TEAM_MEMBER_JOINED: "text-emerald-500",
  CREATOR_INVITED: "text-violet-500",
  CREATOR_JOINED: "text-emerald-500",
};

const NOTIFICATION_TYPE_GRADIENTS: Record<string, string> = {
  UPLOAD_SUBMITTED: "bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30",
  UPLOAD_APPROVED: "bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-800/30",
  UPLOAD_REJECTED: "bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/30",
  REQUEST_CREATED: "bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-900/30 dark:to-violet-800/30",
  REQUEST_DUE_SOON: "bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/30",
  REQUEST_OVERDUE: "bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/30",
  COMMENT_ADDED: "bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30",
  MENTION: "bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-900/30 dark:to-violet-800/30",
  MESSAGE_RECEIVED: "bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/30 dark:to-indigo-800/30",
  SYSTEM: "bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900/30 dark:to-gray-800/30",
  TEAM_MEMBER_JOINED: "bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-800/30",
  CREATOR_INVITED: "bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-900/30 dark:to-violet-800/30",
  CREATOR_JOINED: "bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-800/30",
};

const FILTER_CATEGORIES = [
  { value: "all", label: "All Types" },
  { value: "uploads", label: "Uploads", types: ["UPLOAD_SUBMITTED", "UPLOAD_APPROVED", "UPLOAD_REJECTED"] },
  { value: "requests", label: "Requests", types: ["REQUEST_CREATED", "REQUEST_DUE_SOON", "REQUEST_OVERDUE"] },
  { value: "messages", label: "Messages", types: ["MESSAGE_RECEIVED", "COMMENT_ADDED", "MENTION"] },
  { value: "team", label: "Team", types: ["TEAM_MEMBER_JOINED", "CREATOR_INVITED", "CREATOR_JOINED"] },
  { value: "system", label: "System", types: ["SYSTEM"] },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatDate(date: Date): string {
  const now = new Date();
  const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffInDays === 0) return "Today";
  if (diffInDays === 1) return "Yesterday";
  if (diffInDays < 7) return `${diffInDays} days ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function getDateKey(date: Date): string {
  return date.toISOString().split("T")[0];
}

function groupNotificationsByDate(notifications: NotificationData[]): NotificationGroup[] {
  const groups: Map<string, NotificationData[]> = new Map();

  notifications.forEach((notification) => {
    const dateKey = getDateKey(notification.createdAt);
    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push(notification);
  });

  return Array.from(groups.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([dateKey, notifs]) => ({
      date: dateKey,
      label: formatDate(new Date(dateKey)),
      notifications: notifs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    }));
}

// ============================================
// NOTIFICATION ITEM COMPONENT
// ============================================

interface NotificationItemProps {
  notification: NotificationData;
  isSelected: boolean;
  onSelect: (id: string, selected: boolean) => void;
  onMarkAsRead: (id: string) => void;
  onMarkAsUnread: (id: string) => void;
  onDelete: (id: string) => void;
  onClick: (notification: NotificationData) => void;
}

function NotificationItemCard({
  notification,
  isSelected,
  onSelect,
  onMarkAsRead,
  onMarkAsUnread,
  onDelete,
  onClick,
}: NotificationItemProps) {
  const router = useRouter();
  const isUnread = notification.readAt === null;
  const IconComponent = NOTIFICATION_TYPE_ICONS[notification.type] || Bell;
  const iconColor = NOTIFICATION_TYPE_COLORS[notification.type] || "text-gray-500";
  const iconGradient = NOTIFICATION_TYPE_GRADIENTS[notification.type] ||
    "bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900/30 dark:to-gray-800/30";

  const handleClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on actions
    if ((e.target as HTMLElement).closest("[data-action]")) {
      return;
    }

    // Mark as read if unread
    if (isUnread) {
      onMarkAsRead(notification.id);
    }

    onClick(notification);

    // Navigate if link exists
    if (notification.link) {
      router.push(notification.link);
    }
  };

  return (
    <div
      className={cn(
        "group relative flex items-start gap-3 p-4 transition-all duration-200 cursor-pointer",
        "hover:bg-accent/50 border-b border-border/30 last:border-b-0",
        isUnread && "bg-primary/5",
        isSelected && "bg-primary/10"
      )}
      onClick={handleClick}
    >
      {/* Selection checkbox */}
      <div className="flex items-center pt-1" data-action>
        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) => onSelect(notification.id, checked as boolean)}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* Unread indicator */}
      {isUnread && (
        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-gradient-to-r from-primary to-violet-500" />
      )}

      {/* Icon */}
      <div
        className={cn(
          "flex-shrink-0 rounded-lg flex items-center justify-center w-10 h-10",
          iconGradient
        )}
      >
        <IconComponent className={cn(iconColor, "w-5 h-5")} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p
              className={cn(
                "font-medium text-sm",
                isUnread ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {notification.title}
            </p>
            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
              {notification.message}
            </p>
            <p className="text-xs text-muted-foreground mt-1.5">
              {formatTime(notification.createdAt)}
            </p>
          </div>

          {/* Actions */}
          <div
            className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
            data-action
          >
            {isUnread ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkAsRead(notification.id);
                }}
                title="Mark as read"
              >
                <Eye className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkAsUnread(notification.id);
                }}
                title="Mark as unread"
              >
                <EyeOff className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(notification.id);
              }}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Quick action button for certain types */}
        {notification.link && (
          <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity" data-action>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                if (isUnread) {
                  onMarkAsRead(notification.id);
                }
                router.push(notification.link!);
              }}
            >
              View Details
              <ChevronRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// NOTIFICATION SETTINGS PREVIEW
// ============================================

function NotificationSettingsPreview() {
  return (
    <Card className="card-elevated">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Settings className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>Notification Settings</CardTitle>
            <CardDescription>
              Customize how and when you receive notifications
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Email Digest */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Email Digest</p>
                <p className="text-xs text-muted-foreground">Daily summary</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>

          {/* Push Notifications */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Push Notifications</p>
                <p className="text-xs text-muted-foreground">Enabled</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>

          {/* Quiet Hours */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Quiet Hours</p>
                <p className="text-xs text-muted-foreground">10 PM - 8 AM</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <Separator className="my-4" />

        <Button variant="outline" className="w-full" asChild>
          <Link href="/dashboard/settings/notifications">
            <Settings className="mr-2 h-4 w-4" />
            Manage All Settings
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

// ============================================
// MAIN PAGE COMPONENT
// ============================================

export default function NotificationsPage() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [readFilter, setReadFilter] = useState<ReadFilter>("all");

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);

  const LIMIT = 50;

  // Infinite scroll hook for automatic loading
  const {
    sentinelRef,
    isLoading: isInfiniteLoading,
    isEndReached,
  } = useInfiniteScroll({
    onLoadMore: async () => {
      if (isLoadingMore || !hasMore) return;

      setIsLoadingMore(true);
      const newOffset = offset + LIMIT;
      setOffset(newOffset);

      try {
        const params = new URLSearchParams({
          limit: LIMIT.toString(),
          offset: newOffset.toString(),
        });

        if (readFilter === "unread") {
          params.set("unreadOnly", "true");
        }

        if (typeFilter !== "all") {
          const category = FILTER_CATEGORIES.find((c) => c.value === typeFilter);
          if (category?.types) {
            params.set("types", category.types.join(","));
          }
        }

        const response = await fetch(`/api/notifications?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          const parsedNotifications = data.notifications.map((n: NotificationData) => ({
            ...n,
            createdAt: new Date(n.createdAt),
            readAt: n.readAt ? new Date(n.readAt) : null,
          }));

          setNotifications((prev) => [...prev, ...parsedNotifications]);
          setHasMore(data.hasMore);
        }
      } catch (error) {
        console.error("Failed to load more notifications:", error);
        toast.error("Failed to load more");
      } finally {
        setIsLoadingMore(false);
      }
    },
    hasMore,
    isLoading: isLoadingMore,
    rootMargin: "200px",
  });

  // ============================================
  // FETCH FUNCTIONS
  // ============================================

  const fetchNotifications = useCallback(async (reset = false) => {
    if (reset) {
      setIsLoading(true);
      setOffset(0);
    } else {
      setIsRefreshing(true);
    }

    try {
      const params = new URLSearchParams({
        limit: LIMIT.toString(),
        offset: reset ? "0" : offset.toString(),
      });

      if (readFilter === "unread") {
        params.set("unreadOnly", "true");
      }

      // Handle category-based type filtering
      if (typeFilter !== "all") {
        const category = FILTER_CATEGORIES.find((c) => c.value === typeFilter);
        if (category?.types) {
          params.set("types", category.types.join(","));
        }
      }

      const response = await fetch(`/api/notifications?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        const parsedNotifications = data.notifications.map((n: NotificationData) => ({
          ...n,
          createdAt: new Date(n.createdAt),
          readAt: n.readAt ? new Date(n.readAt) : null,
        }));

        if (reset) {
          setNotifications(parsedNotifications);
        } else {
          setNotifications((prev) => [...prev, ...parsedNotifications]);
        }
        setTotal(data.total);
        setHasMore(data.hasMore);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
      toast.error("Failed to load notifications");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [offset, typeFilter, readFilter]);

  // Initial load and filter changes
  useEffect(() => {
    fetchNotifications(true);
  }, [typeFilter, readFilter]);

  // Handle refresh
  const handleRefresh = () => {
    setSelectedIds(new Set());
    fetchNotifications(true);
  };

  // ============================================
  // ACTIONS
  // ============================================

  const handleMarkAsRead = async (id: string) => {
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationIds: [id] }),
      });

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, readAt: new Date() } : n))
        );
      }
    } catch (error) {
      console.error("Failed to mark as read:", error);
      toast.error("Failed to mark as read");
    }
  };

  const handleMarkAsUnread = async (id: string) => {
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationIds: [id], markAsUnread: true }),
      });

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, readAt: null } : n))
        );
      }
    } catch (error) {
      console.error("Failed to mark as unread:", error);
      toast.error("Failed to mark as unread");
    }
  };

  const handleMarkAllAsRead = async () => {
    setIsMarkingAllRead(true);
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllAsRead: true }),
      });

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, readAt: new Date() }))
        );
        toast.success("All notifications marked as read");
      }
    } catch (error) {
      console.error("Failed to mark all as read:", error);
      toast.error("Failed to mark all as read");
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/notifications?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setTotal((prev) => prev - 1);
        toast.success("Notification deleted");
      }
    } catch (error) {
      console.error("Failed to delete notification:", error);
      toast.error("Failed to delete notification");
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;

    setIsDeletingSelected(true);
    try {
      const response = await fetch("/api/notifications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationIds: Array.from(selectedIds) }),
      });

      if (response.ok) {
        setNotifications((prev) => prev.filter((n) => !selectedIds.has(n.id)));
        setTotal((prev) => prev - selectedIds.size);
        setSelectedIds(new Set());
        toast.success(`${selectedIds.size} notifications deleted`);
      }
    } catch (error) {
      console.error("Failed to delete notifications:", error);
      toast.error("Failed to delete notifications");
    } finally {
      setIsDeletingSelected(false);
    }
  };

  const handleMarkSelectedAsRead = async () => {
    if (selectedIds.size === 0) return;

    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationIds: Array.from(selectedIds) }),
      });

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) =>
            selectedIds.has(n.id) ? { ...n, readAt: new Date() } : n
          )
        );
        setSelectedIds(new Set());
        toast.success(`${selectedIds.size} notifications marked as read`);
      }
    } catch (error) {
      console.error("Failed to mark as read:", error);
      toast.error("Failed to mark as read");
    }
  };

  // Selection handlers
  const handleSelect = (id: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedIds(new Set(filteredNotifications.map((n) => n.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleNotificationClick = (notification: NotificationData) => {
    // Custom handling if needed
  };

  // ============================================
  // FILTERED AND GROUPED DATA
  // ============================================

  const filteredNotifications = useMemo(() => {
    let filtered = notifications;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (n) =>
          n.title.toLowerCase().includes(query) ||
          n.message.toLowerCase().includes(query)
      );
    }

    // Apply read filter (client-side additional filtering)
    if (readFilter === "read") {
      filtered = filtered.filter((n) => n.readAt !== null);
    }

    return filtered;
  }, [notifications, searchQuery, readFilter]);

  const groupedNotifications = useMemo(
    () => groupNotificationsByDate(filteredNotifications),
    [filteredNotifications]
  );

  const unreadCount = useMemo(
    () => notifications.filter((n) => n.readAt === null).length,
    [notifications]
  );

  const allSelected = selectedIds.size > 0 && selectedIds.size === filteredNotifications.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < filteredNotifications.length;

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Sparkles className="h-4 w-4" />
            <span>Notification Center</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Notifications
          </h1>
          <p className="text-muted-foreground mt-1">
            View and manage all your notifications in one place
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllAsRead}
            disabled={isMarkingAllRead || unreadCount === 0}
          >
            {isMarkingAllRead ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCheck className="h-4 w-4 mr-2" />
            )}
            Mark All Read
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/settings/notifications">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Bell className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{total}</p>
              <p className="text-sm text-muted-foreground">Total</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <MailOpen className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{unreadCount}</p>
              <p className="text-sm text-muted-foreground">Unread</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{total - unreadCount}</p>
              <p className="text-sm text-muted-foreground">Read</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <Filter className="h-6 w-6 text-violet-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{filteredNotifications.length}</p>
              <p className="text-sm text-muted-foreground">Filtered</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main notifications list */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filters */}
          <Card className="card-elevated">
            <CardContent className="p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search notifications..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>

                {/* Type filter */}
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-full sm:w-40 h-9">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter type" />
                  </SelectTrigger>
                  <SelectContent>
                    {FILTER_CATEGORIES.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Read filter */}
                <Select value={readFilter} onValueChange={(v) => setReadFilter(v as ReadFilter)}>
                  <SelectTrigger className="w-full sm:w-32 h-9">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="unread">Unread</SelectItem>
                    <SelectItem value="read">Read</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Bulk actions */}
          {selectedIds.size > 0 && (
            <Card className="card-elevated border-primary/50">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={allSelected}
                      indeterminate={someSelected}
                      onCheckedChange={handleSelectAll}
                    />
                    <span className="text-sm font-medium">
                      {selectedIds.size} selected
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleMarkSelectedAsRead}
                    >
                      <CheckCheck className="h-4 w-4 mr-1" />
                      Mark Read
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDeleteSelected}
                      disabled={isDeletingSelected}
                      className="text-destructive hover:text-destructive"
                    >
                      {isDeletingSelected ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-1" />
                      )}
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notifications list */}
          <Card className="card-elevated overflow-hidden">
            {isLoading ? (
              <div className="divide-y divide-border/30">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex gap-3 p-4">
                    <div className="w-5 h-5 rounded bg-muted animate-pulse" />
                    <div className="w-10 h-10 rounded-lg bg-muted animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-1/3 bg-muted rounded animate-pulse" />
                      <div className="h-3 w-full bg-muted rounded animate-pulse" />
                      <div className="h-3 w-16 bg-muted rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredNotifications.length === 0 ? (
              <NoNotifications
                isFiltered={!!(searchQuery || typeFilter !== "all" || readFilter !== "all")}
                onClearFilters={() => {
                  setSearchQuery("");
                  setTypeFilter("all");
                  setReadFilter("all");
                }}
                allCaughtUp={!(searchQuery || typeFilter !== "all" || readFilter !== "all")}
                withCard={false}
              />
            ) : (
              <div>
                {/* Select all header */}
                <div className="flex items-center gap-3 px-4 py-2 border-b border-border/50 bg-muted/30">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onCheckedChange={handleSelectAll}
                  />
                  <span className="text-xs text-muted-foreground">
                    Select all
                  </span>
                </div>

                {/* Grouped notifications */}
                {groupedNotifications.map((group) => (
                  <div key={group.date}>
                    <div className="px-4 py-2 bg-muted/50 border-b border-border/30">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        {group.label}
                      </p>
                    </div>
                    {group.notifications.map((notification) => (
                      <NotificationItemCard
                        key={notification.id}
                        notification={notification}
                        isSelected={selectedIds.has(notification.id)}
                        onSelect={handleSelect}
                        onMarkAsRead={handleMarkAsRead}
                        onMarkAsUnread={handleMarkAsUnread}
                        onDelete={handleDelete}
                        onClick={handleNotificationClick}
                      />
                    ))}
                  </div>
                ))}

                {/* Infinite scroll sentinel */}
                <div
                  ref={sentinelRef}
                  className="h-1 w-full"
                  aria-hidden="true"
                />

                {/* Loading indicator */}
                {isLoadingMore && (
                  <LoadingIndicator text="Loading more notifications..." />
                )}

                {/* End of list indicator */}
                {isEndReached && !hasMore && filteredNotifications.length > 0 && (
                  <EndOfListIndicator text="You've seen all notifications" />
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Notification Settings Preview */}
          <NotificationSettingsPreview />

          {/* Quick Stats by Type */}
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-base">Notifications by Type</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {FILTER_CATEGORIES.filter((c) => c.value !== "all").map((category) => {
                  const count = notifications.filter((n) =>
                    category.types?.includes(n.type)
                  ).length;
                  const unread = notifications.filter(
                    (n) => category.types?.includes(n.type) && n.readAt === null
                  ).length;

                  return (
                    <button
                      key={category.value}
                      className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                      onClick={() => setTypeFilter(category.value)}
                    >
                      <span className="text-sm text-muted-foreground">
                        {category.label}
                      </span>
                      <div className="flex items-center gap-2">
                        {unread > 0 && (
                          <span className="text-xs font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                            {unread} new
                          </span>
                        )}
                        <span className="text-sm font-medium">{count}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Back to Top Button */}
      <BackToTop position="bottom-right" variant="gradient" />
    </div>
  );
}
