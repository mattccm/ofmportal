"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Upload,
  CheckCircle,
  XCircle,
  MessageSquare,
  FilePlus,
  FileEdit,
  Send,
  Bell,
  Clock,
  AlertTriangle,
  AlertCircle,
  UserPlus,
  LogIn,
  ExternalLink,
  Edit,
  Edit3,
  Trash,
  Trash2,
  StickyNote,
  Activity,
  Eye,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Filter,
  Search,
  Calendar,
  X,
  Image as ImageIcon,
  Video,
  File,
  Settings,
  Loader2,
} from "lucide-react";

// Types
export interface ActivityItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  timestamp: string | Date;
  user: {
    id: string;
    name: string;
    avatar: string | null;
    email?: string;
  } | null;
  metadata: Record<string, unknown>;
  description: string;
  icon: string;
  color: string;
  category: string;
}

export interface ActivityTimelineProps {
  // Mode: standalone (full page) or widget (embedded in other pages)
  mode?: "standalone" | "widget";
  // Initial activities (for server-side rendering)
  initialActivities?: ActivityItem[];
  // Limit items shown in widget mode
  limit?: number;
  // Show filters
  showFilters?: boolean;
  // Show search
  showSearch?: boolean;
  // Entity filter (show only activities for specific entity)
  entityType?: string;
  entityId?: string;
  // User filter (show only activities by specific user)
  userId?: string;
  // Title for widget mode
  title?: string;
  // Show view all link
  viewAllHref?: string;
  // Compact mode for smaller display
  compact?: boolean;
  // Enable infinite scroll
  infiniteScroll?: boolean;
  // Custom class name
  className?: string;
}

// Icon mapping
const ICON_MAP: Record<string, React.ReactNode> = {
  upload: <Upload className="h-4 w-4" />,
  "upload-check": <CheckCircle className="h-4 w-4" />,
  "check-circle": <CheckCircle className="h-4 w-4" />,
  "x-circle": <XCircle className="h-4 w-4" />,
  eye: <Eye className="h-4 w-4" />,
  "message-square": <MessageSquare className="h-4 w-4" />,
  edit: <Edit className="h-4 w-4" />,
  trash: <Trash className="h-4 w-4" />,
  "file-plus": <FilePlus className="h-4 w-4" />,
  "file-edit": <FileEdit className="h-4 w-4" />,
  send: <Send className="h-4 w-4" />,
  "alert-circle": <AlertCircle className="h-4 w-4" />,
  "refresh-cw": <RefreshCw className="h-4 w-4" />,
  bell: <Bell className="h-4 w-4" />,
  clock: <Clock className="h-4 w-4" />,
  "alert-triangle": <AlertTriangle className="h-4 w-4" />,
  "user-plus": <UserPlus className="h-4 w-4" />,
  "log-in": <LogIn className="h-4 w-4" />,
  "external-link": <ExternalLink className="h-4 w-4" />,
  "user-cog": <Settings className="h-4 w-4" />,
  "sticky-note": <StickyNote className="h-4 w-4" />,
  "edit-3": <Edit3 className="h-4 w-4" />,
  "trash-2": <Trash2 className="h-4 w-4" />,
  activity: <Activity className="h-4 w-4" />,
};

// Color mapping
const COLOR_MAP: Record<string, string> = {
  emerald: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400",
  red: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400",
  violet: "bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400",
  blue: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
  amber: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400",
  orange: "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400",
  indigo: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400",
  gray: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
};

// Gradient color mapping for icon backgrounds
const GRADIENT_MAP: Record<string, string> = {
  emerald: "from-emerald-500 to-teal-500",
  red: "from-red-500 to-rose-500",
  violet: "from-violet-500 to-purple-500",
  blue: "from-blue-500 to-cyan-500",
  amber: "from-amber-500 to-orange-500",
  orange: "from-orange-500 to-red-500",
  indigo: "from-indigo-500 to-violet-500",
  gray: "from-gray-500 to-slate-500",
};

// Activity type labels
const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  upload: "Uploads",
  comment: "Comments",
  status_change: "Status Changes",
  request: "Requests",
  reminder: "Reminders",
};

// Activity category badges
const CATEGORY_BADGES: Record<string, { label: string; className: string }> = {
  upload: { label: "Upload", className: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" },
  comment: { label: "Comment", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  request: { label: "Request", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  reminder: { label: "Reminder", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  creator: { label: "Creator", className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" },
  other: { label: "Other", className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
};

export function ActivityTimeline({
  mode = "widget",
  initialActivities = [],
  limit = 10,
  showFilters = true,
  showSearch = true,
  entityType,
  entityId,
  userId,
  title = "Activity Timeline",
  viewAllHref = "/dashboard/activity",
  compact = false,
  infiniteScroll = false,
  className,
}: ActivityTimelineProps) {
  const [activities, setActivities] = useState<ActivityItem[]>(initialActivities);
  const [isLoading, setIsLoading] = useState(initialActivities.length === 0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState<ActivityItem | null>(null);

  // Filters
  const [filters, setFilters] = useState({
    type: "",
    userId: userId || "",
    dateFrom: "",
    dateTo: "",
    search: "",
  });
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [users, setUsers] = useState<Array<{ id: string; name: string; avatar: string | null }>>([]);
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);

  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Count active filters
  useEffect(() => {
    let count = 0;
    if (filters.type) count++;
    if (filters.userId) count++;
    if (filters.dateFrom || filters.dateTo) count++;
    if (filters.search) count++;
    setActiveFiltersCount(count);
  }, [filters]);

  // Fetch activities
  const fetchActivities = useCallback(
    async (pageNum: number = 1, append: boolean = false) => {
      try {
        if (pageNum === 1) {
          setIsLoading(true);
        } else {
          setIsLoadingMore(true);
        }

        const params = new URLSearchParams();
        params.set("page", pageNum.toString());
        params.set("pageSize", (mode === "widget" ? limit : 20).toString());

        if (filters.type) params.set("type", filters.type);
        if (filters.userId) params.set("userId", filters.userId);
        if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
        if (filters.dateTo) params.set("dateTo", filters.dateTo);
        if (filters.search) params.set("search", filters.search);
        if (entityType) params.set("entityType", entityType);
        if (entityId) params.set("entityId", entityId);

        const response = await fetch(`/api/activity?${params.toString()}`);
        if (!response.ok) throw new Error("Failed to fetch activities");

        const data = await response.json();

        setActivities((prev) =>
          append ? [...prev, ...data.activities] : data.activities
        );
        setHasMore(data.pagination.hasMore);
        setUsers(data.filters?.users || []);
        setPage(pageNum);
      } catch (error) {
        console.error("Error fetching activities:", error);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [filters, entityType, entityId, limit, mode]
  );

  // Initial fetch
  useEffect(() => {
    if (initialActivities.length === 0) {
      fetchActivities(1);
    }
  }, [fetchActivities, initialActivities.length]);

  // Refetch when filters change
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchActivities(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [filters.type, filters.userId, filters.dateFrom, filters.dateTo, fetchActivities]);

  // Search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (filters.search !== undefined) {
        fetchActivities(1);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [filters.search, fetchActivities]);

  // Infinite scroll observer
  useEffect(() => {
    if (!infiniteScroll || !hasMore || isLoadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          fetchActivities(page + 1, true);
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [infiniteScroll, hasMore, isLoadingMore, page, fetchActivities]);

  // Clear filters
  const clearFilters = () => {
    setFilters({
      type: "",
      userId: userId || "",
      dateFrom: "",
      dateTo: "",
      search: "",
    });
  };

  // Get link for activity item
  const getActivityLink = (activity: ActivityItem): string | null => {
    const metadata = activity.metadata;

    if (activity.entityType === "Upload" && metadata.requestId) {
      return `/dashboard/requests/${metadata.requestId}`;
    }
    if (activity.entityType === "ContentRequest") {
      return `/dashboard/requests/${activity.entityId}`;
    }
    if (activity.entityType === "Creator") {
      return `/dashboard/creators/${activity.entityId}`;
    }

    return null;
  };

  // Format timestamp with relative and absolute
  const formatTimestamp = (timestamp: string | Date) => {
    const date = new Date(timestamp);
    return {
      relative: formatDistanceToNow(date, { addSuffix: true }),
      absolute: format(date, "MMM d, yyyy 'at' h:mm a"),
    };
  };

  // Get file type icon for uploads
  const getFileTypeIcon = (fileType?: string) => {
    if (!fileType) return <File className="h-4 w-4" />;
    if (fileType.startsWith("image/")) return <ImageIcon className="h-4 w-4" />;
    if (fileType.startsWith("video/")) return <Video className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  // Render activity item
  const renderActivityItem = (activity: ActivityItem, index: number) => {
    const link = getActivityLink(activity);
    const time = formatTimestamp(activity.timestamp);
    const isExpanded = expandedId === activity.id;
    const metadata = activity.metadata;
    const categoryBadge = CATEGORY_BADGES[activity.category] || CATEGORY_BADGES.other;

    const content = (
      <div
        className={cn(
          "relative flex gap-3 md:gap-4 p-3 md:p-4 rounded-xl transition-all duration-200",
          link && "cursor-pointer hover:bg-muted/50 active:bg-muted",
          isExpanded && "bg-muted/30",
          "animate-in fade-in slide-in-from-left-2",
          compact && "p-2 md:p-3"
        )}
        style={{ animationDelay: `${index * 50}ms` }}
      >
        {/* Timeline line */}
        {mode === "standalone" && index < activities.length - 1 && (
          <div className="absolute left-[26px] md:left-[30px] top-14 bottom-0 w-px bg-border -translate-x-1/2" />
        )}

        {/* Icon */}
        <div className="relative z-10 flex-shrink-0">
          {activity.user ? (
            <div className="relative">
              <Avatar
                user={{ name: activity.user.name, image: activity.user.avatar }}
                size={compact ? "sm" : "md"}
              />
              <div
                className={cn(
                  "absolute -bottom-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center ring-2 ring-background",
                  `bg-gradient-to-br ${GRADIENT_MAP[activity.color] || GRADIENT_MAP.gray}`
                )}
              >
                <span className="text-white scale-75">
                  {ICON_MAP[activity.icon] || ICON_MAP.activity}
                </span>
              </div>
            </div>
          ) : (
            <div
              className={cn(
                "h-10 w-10 rounded-full flex items-center justify-center",
                compact && "h-8 w-8",
                COLOR_MAP[activity.color] || COLOR_MAP.gray
              )}
            >
              {ICON_MAP[activity.icon] || ICON_MAP.activity}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className={cn("font-medium text-foreground", compact ? "text-sm" : "text-sm md:text-base")}>
                {activity.description}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {activity.user && (
                  <span className="text-xs text-muted-foreground">
                    by {activity.user.name}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {time.relative}
                </span>
                {mode === "standalone" && (
                  <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", categoryBadge.className)}>
                    {categoryBadge.label}
                  </Badge>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {link && (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              {mode === "standalone" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setExpandedId(isExpanded ? null : activity.id);
                  }}
                >
                  <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
                </Button>
              )}
            </div>
          </div>

          {/* Expanded details */}
          {isExpanded && (
            <div className="mt-3 pt-3 border-t border-border/50 space-y-2 animate-in fade-in slide-in-from-top-1">
              <div className="grid grid-cols-2 gap-4 text-sm">
                {typeof metadata.requestTitle === "string" && metadata.requestTitle && (
                  <div>
                    <p className="text-muted-foreground text-xs">Request</p>
                    <Link
                      href={`/dashboard/requests/${String(metadata.requestId)}`}
                      className="text-primary hover:underline font-medium"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {metadata.requestTitle}
                    </Link>
                  </div>
                )}
                {typeof metadata.creatorName === "string" && metadata.creatorName && (
                  <div>
                    <p className="text-muted-foreground text-xs">Creator</p>
                    <Link
                      href={`/dashboard/creators/${String(metadata.creatorId)}`}
                      className="text-primary hover:underline font-medium"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {metadata.creatorName}
                    </Link>
                  </div>
                )}
                {typeof metadata.uploadName === "string" && metadata.uploadName && (
                  <div>
                    <p className="text-muted-foreground text-xs">File</p>
                    <div className="flex items-center gap-1">
                      {getFileTypeIcon(String(metadata.fileType || ""))}
                      <span className="truncate">{metadata.uploadName}</span>
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground text-xs">Exact Time</p>
                  <p className="font-medium">{time.absolute}</p>
                </div>
              </div>

              {typeof metadata.thumbnailUrl === "string" && metadata.thumbnailUrl && (
                <div className="mt-2 relative h-20 w-32">
                  <Image
                    src={metadata.thumbnailUrl}
                    alt="Thumbnail"
                    fill
                    className="rounded-lg object-cover"
                    unoptimized
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );

    if (link) {
      return (
        <Link key={activity.id} href={link} className="block">
          {content}
        </Link>
      );
    }

    return <div key={activity.id}>{content}</div>;
  };

  // Render filter panel
  const renderFilters = () => {
    if (!showFilters && !showSearch) return null;

    if (mode === "widget") {
      return (
        <div className="flex items-center gap-2 mb-4">
          {showSearch && (
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search activities..."
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                className="pl-9 h-9"
              />
            </div>
          )}
          {showFilters && (
            <Select
              value={filters.type}
              onValueChange={(value) => setFilters((prev) => ({ ...prev, type: value === "all" ? "" : value }))}
            >
              <SelectTrigger className="w-[130px] h-9">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {Object.entries(ACTIVITY_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      );
    }

    // Standalone mode - full filter panel
    return (
      <div className="space-y-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          {showSearch && (
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search activities..."
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                className="pl-9"
              />
              {filters.search && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setFilters((prev) => ({ ...prev, search: "" }))}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}

          <Button
            variant={showFilterPanel ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            Filters
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 bg-primary text-primary-foreground">
                {activeFiltersCount}
              </Badge>
            )}
          </Button>

          {activeFiltersCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear all
            </Button>
          )}

          <div className="flex-1" />

          <Button variant="outline" size="sm" onClick={() => fetchActivities(1)} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {showFilterPanel && (
          <Card className="animate-in fade-in slide-in-from-top-2">
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Activity Type</Label>
                  <Select
                    value={filters.type || "all"}
                    onValueChange={(value) => setFilters((prev) => ({ ...prev, type: value === "all" ? "" : value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      {Object.entries(ACTIVITY_TYPE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">User</Label>
                  <Select
                    value={filters.userId || "all"}
                    onValueChange={(value) => setFilters((prev) => ({ ...prev, userId: value === "all" ? "" : value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All users" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All users</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Date From</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) => setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Date To</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="date"
                      value={filters.dateTo}
                      onChange={(e) => setFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  // Main render
  if (mode === "widget") {
    return (
      <Card className={cn("card-elevated", className)}>
        <CardHeader className="flex flex-row items-center justify-between pb-3 md:pb-4">
          <div>
            <CardTitle className="text-base md:text-lg font-semibold flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              {title}
            </CardTitle>
            {!compact && (
              <CardDescription className="hidden md:block">Recent activity across your team</CardDescription>
            )}
          </div>
          {viewAllHref && (
            <Button variant="ghost" size="sm" asChild className="text-primary hover:text-primary h-9 min-h-[36px]">
              <Link href={viewAllHref}>
                View all
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          {renderFilters()}

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-8">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <Activity className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">No recent activity</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Activity from your team will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {activities.slice(0, limit).map((activity, index) => renderActivityItem(activity, index))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Standalone mode
  return (
    <div className={cn("space-y-4", className)}>
      {renderFilters()}

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
        </div>
      ) : activities.length === 0 ? (
        <Card className="card-elevated">
          <CardContent className="py-16 text-center">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Activity className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">No activity found</h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
              {activeFiltersCount > 0
                ? "Try adjusting your filters to see more results."
                : "Activity will appear here as your team works."}
            </p>
            {activeFiltersCount > 0 && (
              <Button variant="outline" onClick={clearFilters} className="mt-4">
                Clear filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="card-elevated">
          <CardContent className="pt-6">
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[26px] md:left-[30px] top-0 bottom-0 w-px bg-border" />

              <div className="space-y-1">
                {activities.map((activity, index) => renderActivityItem(activity, index))}
              </div>
            </div>

            {/* Load more */}
            {infiniteScroll && hasMore && (
              <div ref={loadMoreRef} className="flex items-center justify-center py-8">
                {isLoadingMore && <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
              </div>
            )}

            {!infiniteScroll && hasMore && (
              <div className="flex justify-center mt-6">
                <Button
                  variant="outline"
                  onClick={() => fetchActivities(page + 1, true)}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Loading...
                    </>
                  ) : (
                    "Load more"
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Activity details dialog */}
      <Dialog open={!!detailsOpen} onOpenChange={(open) => !open && setDetailsOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Activity Details</DialogTitle>
            <DialogDescription>
              {detailsOpen?.description}
            </DialogDescription>
          </DialogHeader>
          {detailsOpen && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Type</p>
                  <Badge variant="outline" className={CATEGORY_BADGES[detailsOpen.category]?.className}>
                    {CATEGORY_BADGES[detailsOpen.category]?.label}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Time</p>
                  <p className="font-medium">{formatTimestamp(detailsOpen.timestamp).absolute}</p>
                </div>
                {detailsOpen.user && (
                  <div>
                    <p className="text-sm text-muted-foreground">User</p>
                    <div className="flex items-center gap-2">
                      <Avatar user={{ name: detailsOpen.user.name, image: detailsOpen.user.avatar }} size="xs" />
                      <span className="font-medium">{detailsOpen.user.name}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Export a compact widget version
export function ActivityTimelineWidget(props: Omit<ActivityTimelineProps, "mode">) {
  return <ActivityTimeline {...props} mode="widget" />;
}

// Export a full page version
export function ActivityTimelineFull(props: Omit<ActivityTimelineProps, "mode">) {
  return <ActivityTimeline {...props} mode="standalone" infiniteScroll showFilters showSearch />;
}
