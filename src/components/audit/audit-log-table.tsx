"use client";

import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Search,
  Download,
  Filter,
  Calendar,
  User,
  Activity,
  Database,
  Globe,
  Monitor,
  Loader2,
  X,
  ArrowUpDown,
  RefreshCw,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

interface AuditUser {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
}

interface AuditLog {
  id: string;
  userId: string | null;
  user: AuditUser | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

interface Filters {
  actionTypes: string[];
  entityTypes: string[];
  users: { id: string; name: string; email: string }[];
}

interface AuditLogTableProps {
  logs: AuditLog[];
  pagination: Pagination;
  filters: Filters;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  onFilterChange: (filters: FilterState) => void;
  onSortChange: (sortBy: string, sortOrder: "asc" | "desc") => void;
  onExport: () => void;
  onRefresh: () => void;
  currentFilters: FilterState;
  currentSort: { sortBy: string; sortOrder: "asc" | "desc" };
}

export interface FilterState {
  search: string;
  userId: string;
  action: string;
  entityType: string;
  startDate: string;
  endDate: string;
}

// ============================================
// ACTION TYPE BADGES
// ============================================

const getActionBadgeStyles = (action: string): { bg: string; text: string; border: string } => {
  const actionLower = action.toLowerCase();

  // Create actions - green/emerald
  if (actionLower.includes("create") || actionLower.includes("add") || actionLower.includes("register")) {
    return {
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
      text: "text-emerald-700 dark:text-emerald-400",
      border: "border-emerald-200 dark:border-emerald-800/50",
    };
  }

  // Update actions - blue/indigo
  if (actionLower.includes("update") || actionLower.includes("edit") || actionLower.includes("modify")) {
    return {
      bg: "bg-indigo-50 dark:bg-indigo-950/30",
      text: "text-indigo-700 dark:text-indigo-400",
      border: "border-indigo-200 dark:border-indigo-800/50",
    };
  }

  // Delete actions - red
  if (actionLower.includes("delete") || actionLower.includes("remove") || actionLower.includes("cancel")) {
    return {
      bg: "bg-red-50 dark:bg-red-950/30",
      text: "text-red-700 dark:text-red-400",
      border: "border-red-200 dark:border-red-800/50",
    };
  }

  // Approve/Success actions - green
  if (actionLower.includes("approve") || actionLower.includes("accept") || actionLower.includes("complete")) {
    return {
      bg: "bg-green-50 dark:bg-green-950/30",
      text: "text-green-700 dark:text-green-400",
      border: "border-green-200 dark:border-green-800/50",
    };
  }

  // Reject/Fail actions - orange
  if (actionLower.includes("reject") || actionLower.includes("fail") || actionLower.includes("deny")) {
    return {
      bg: "bg-orange-50 dark:bg-orange-950/30",
      text: "text-orange-700 dark:text-orange-400",
      border: "border-orange-200 dark:border-orange-800/50",
    };
  }

  // Login/Auth actions - violet
  if (actionLower.includes("login") || actionLower.includes("logout") || actionLower.includes("auth")) {
    return {
      bg: "bg-violet-50 dark:bg-violet-950/30",
      text: "text-violet-700 dark:text-violet-400",
      border: "border-violet-200 dark:border-violet-800/50",
    };
  }

  // View/Read actions - gray
  if (actionLower.includes("view") || actionLower.includes("read") || actionLower.includes("access")) {
    return {
      bg: "bg-gray-50 dark:bg-gray-950/30",
      text: "text-gray-700 dark:text-gray-400",
      border: "border-gray-200 dark:border-gray-800/50",
    };
  }

  // Upload actions - cyan
  if (actionLower.includes("upload") || actionLower.includes("import")) {
    return {
      bg: "bg-cyan-50 dark:bg-cyan-950/30",
      text: "text-cyan-700 dark:text-cyan-400",
      border: "border-cyan-200 dark:border-cyan-800/50",
    };
  }

  // Download/Export actions - purple
  if (actionLower.includes("download") || actionLower.includes("export")) {
    return {
      bg: "bg-purple-50 dark:bg-purple-950/30",
      text: "text-purple-700 dark:text-purple-400",
      border: "border-purple-200 dark:border-purple-800/50",
    };
  }

  // Default - slate
  return {
    bg: "bg-slate-50 dark:bg-slate-950/30",
    text: "text-slate-700 dark:text-slate-400",
    border: "border-slate-200 dark:border-slate-800/50",
  };
};

function ActionBadge({ action }: { action: string }) {
  const styles = getActionBadgeStyles(action);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border",
        styles.bg,
        styles.text,
        styles.border
      )}
    >
      <Activity className="h-3 w-3" />
      {action}
    </span>
  );
}

function EntityTypeBadge({ entityType }: { entityType: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
      <Database className="h-3 w-3" />
      {entityType}
    </span>
  );
}

// ============================================
// EXPANDED ROW DETAILS
// ============================================

function ExpandedRowDetails({ log }: { log: AuditLog }) {
  const formatMetadata = (metadata: Record<string, unknown>) => {
    if (!metadata || Object.keys(metadata).length === 0) {
      return <span className="text-muted-foreground italic">No additional details</span>;
    }

    return (
      <div className="space-y-2">
        {Object.entries(metadata).map(([key, value]) => (
          <div key={key} className="flex items-start gap-2">
            <span className="font-medium text-muted-foreground min-w-[120px]">{key}:</span>
            <span className="text-foreground break-all">
              {typeof value === "object" ? JSON.stringify(value, null, 2) : String(value)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const formatUserAgent = (userAgent: string | null) => {
    if (!userAgent) return "Unknown";

    // Simple parsing for common browsers
    if (userAgent.includes("Chrome")) {
      const match = userAgent.match(/Chrome\/(\d+)/);
      return `Chrome ${match?.[1] || ""}`;
    }
    if (userAgent.includes("Firefox")) {
      const match = userAgent.match(/Firefox\/(\d+)/);
      return `Firefox ${match?.[1] || ""}`;
    }
    if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) {
      const match = userAgent.match(/Version\/(\d+)/);
      return `Safari ${match?.[1] || ""}`;
    }
    if (userAgent.includes("Edge")) {
      const match = userAgent.match(/Edg\/(\d+)/);
      return `Edge ${match?.[1] || ""}`;
    }

    return userAgent.slice(0, 50) + (userAgent.length > 50 ? "..." : "");
  };

  return (
    <div className="p-4 bg-muted/30 border-t">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Technical Details */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Monitor className="h-4 w-4 text-indigo-500" />
            Technical Details
          </h4>

          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <Globe className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <span className="font-medium text-muted-foreground">IP Address:</span>
                <span className="ml-2 font-mono text-foreground">
                  {log.ipAddress || "Unknown"}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Monitor className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <span className="font-medium text-muted-foreground">User Agent:</span>
                <div className="mt-1 font-mono text-xs text-foreground bg-background rounded p-2 break-all">
                  {formatUserAgent(log.userAgent)}
                </div>
                {log.userAgent && log.userAgent.length > 50 && (
                  <details className="mt-1">
                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                      Show full user agent
                    </summary>
                    <div className="mt-1 font-mono text-xs text-foreground bg-background rounded p-2 break-all">
                      {log.userAgent}
                    </div>
                  </details>
                )}
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Database className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <span className="font-medium text-muted-foreground">Entity ID:</span>
                <span className="ml-2 font-mono text-xs text-foreground">
                  {log.entityId}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Activity className="h-4 w-4 text-violet-500" />
            Action Details
          </h4>

          <div className="text-sm bg-background rounded-lg p-3 border">
            {formatMetadata(log.metadata)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function AuditLogTable({
  logs,
  pagination,
  filters,
  isLoading,
  onPageChange,
  onFilterChange,
  onSortChange,
  onExport,
  onRefresh,
  currentFilters,
  currentSort,
}: AuditLogTableProps) {
  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = React.useState(false);
  const [localFilters, setLocalFilters] = React.useState<FilterState>(currentFilters);

  const parentRef = React.useRef<HTMLDivElement>(null);

  // Virtual scrolling for large datasets
  const rowVirtualizer = useVirtualizer({
    count: logs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56, // Approximate row height
    overscan: 10,
  });

  // Sync local filters with props
  React.useEffect(() => {
    setLocalFilters(currentFilters);
  }, [currentFilters]);

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSort = (column: string) => {
    if (currentSort.sortBy === column) {
      onSortChange(column, currentSort.sortOrder === "asc" ? "desc" : "asc");
    } else {
      onSortChange(column, "desc");
    }
  };

  const handleApplyFilters = () => {
    onFilterChange(localFilters);
  };

  const handleClearFilters = () => {
    const emptyFilters: FilterState = {
      search: "",
      userId: "",
      action: "",
      entityType: "",
      startDate: "",
      endDate: "",
    };
    setLocalFilters(emptyFilters);
    onFilterChange(emptyFilters);
  };

  const hasActiveFilters = Object.values(currentFilters).some((v) => v !== "");

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (currentSort.sortBy !== column) {
      return <ArrowUpDown className="h-4 w-4 text-muted-foreground/50" />;
    }
    return currentSort.sortOrder === "asc" ? (
      <ChevronUp className="h-4 w-4 text-indigo-500" />
    ) : (
      <ChevronDown className="h-4 w-4 text-indigo-500" />
    );
  };

  return (
    <div className="space-y-4">
      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search actions, entities, IPs..."
            value={localFilters.search}
            onChange={(e) => setLocalFilters({ ...localFilters, search: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && handleApplyFilters()}
            className="pl-9"
          />
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "gap-2",
              hasActiveFilters && "border-indigo-500 text-indigo-600 dark:text-indigo-400"
            )}
          >
            <Filter className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                {Object.values(currentFilters).filter((v) => v !== "").length}
              </Badge>
            )}
          </Button>

          <Button variant="outline" onClick={onRefresh} disabled={isLoading} className="gap-2">
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          <Button variant="outline" onClick={onExport} disabled={isLoading} className="gap-2">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export CSV</span>
          </Button>
        </div>
      </div>

      {/* Expanded Filters */}
      {showFilters && (
        <div className="p-4 bg-muted/30 rounded-lg border space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* User Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                User
              </label>
              <Select
                value={localFilters.userId}
                onValueChange={(value) =>
                  setLocalFilters({ ...localFilters, userId: value === "all" ? "" : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All users</SelectItem>
                  {filters.users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Action Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                Action Type
              </label>
              <Select
                value={localFilters.action}
                onValueChange={(value) =>
                  setLocalFilters({ ...localFilters, action: value === "all" ? "" : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  {filters.actionTypes.map((action) => (
                    <SelectItem key={action} value={action}>
                      {action}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Entity Type Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Database className="h-4 w-4 text-muted-foreground" />
                Entity Type
              </label>
              <Select
                value={localFilters.entityType}
                onValueChange={(value) =>
                  setLocalFilters({ ...localFilters, entityType: value === "all" ? "" : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All entities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All entities</SelectItem>
                  {filters.entityTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Range */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                Date Range
              </label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={localFilters.startDate}
                  onChange={(e) => setLocalFilters({ ...localFilters, startDate: e.target.value })}
                  className="flex-1"
                />
                <Input
                  type="date"
                  value={localFilters.endDate}
                  onChange={(e) => setLocalFilters({ ...localFilters, endDate: e.target.value })}
                  className="flex-1"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={handleClearFilters} className="gap-2">
              <X className="h-4 w-4" />
              Clear
            </Button>
            <Button onClick={handleApplyFilters} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
              Apply Filters
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div ref={parentRef} className="overflow-auto max-h-[600px]">
          <Table>
            <TableHeader className="bg-muted/50 sticky top-0 z-10">
              <TableRow>
                <TableHead className="w-10" />
                <TableHead
                  className="cursor-pointer hover:bg-muted/80 transition-colors"
                  onClick={() => handleSort("createdAt")}
                >
                  <div className="flex items-center gap-2">
                    Timestamp
                    <SortIcon column="createdAt" />
                  </div>
                </TableHead>
                <TableHead>User</TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/80 transition-colors"
                  onClick={() => handleSort("action")}
                >
                  <div className="flex items-center gap-2">
                    Action
                    <SortIcon column="action" />
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/80 transition-colors"
                  onClick={() => handleSort("entityType")}
                >
                  <div className="flex items-center gap-2">
                    Entity
                    <SortIcon column="entityType" />
                  </div>
                </TableHead>
                <TableHead className="hidden lg:table-cell">IP Address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Loading audit logs...
                    </div>
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32">
                    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                      <Activity className="h-8 w-8" />
                      <p>No audit logs found</p>
                      {hasActiveFilters && (
                        <Button variant="link" onClick={handleClearFilters} className="text-indigo-600">
                          Clear filters
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const log = logs[virtualRow.index];
                  const isExpanded = expandedRows.has(log.id);

                  return (
                    <React.Fragment key={log.id}>
                      <TableRow
                        className={cn(
                          "cursor-pointer hover:bg-muted/50 transition-colors",
                          isExpanded && "bg-muted/30"
                        )}
                        onClick={() => toggleRow(log.id)}
                      >
                        <TableCell className="w-10">
                          <ChevronRight
                            className={cn(
                              "h-4 w-4 text-muted-foreground transition-transform",
                              isExpanded && "rotate-90"
                            )}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          {formatDate(log.createdAt)}
                        </TableCell>
                        <TableCell>
                          {log.user ? (
                            <div className="flex items-center gap-2">
                              <Avatar
                                user={{
                                  name: log.user.name,
                                  email: log.user.email,
                                  image: log.user.avatar || undefined,
                                }}
                                size="sm"
                              />
                              <div className="min-w-0">
                                <p className="font-medium truncate">{log.user.name}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {log.user.email}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic">System</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <ActionBadge action={log.action} />
                        </TableCell>
                        <TableCell>
                          <EntityTypeBadge entityType={log.entityType} />
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <code className="text-xs text-muted-foreground font-mono">
                            {log.ipAddress || "N/A"}
                          </code>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={6} className="p-0">
                            <ExpandedRowDetails log={log} />
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}{" "}
            entries
          </p>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page === 1 || isLoading}
            >
              Previous
            </Button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                let pageNum: number;
                if (pagination.totalPages <= 5) {
                  pageNum = i + 1;
                } else if (pagination.page <= 3) {
                  pageNum = i + 1;
                } else if (pagination.page >= pagination.totalPages - 2) {
                  pageNum = pagination.totalPages - 4 + i;
                } else {
                  pageNum = pagination.page - 2 + i;
                }

                return (
                  <Button
                    key={pageNum}
                    variant={pagination.page === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => onPageChange(pageNum)}
                    disabled={isLoading}
                    className={cn(
                      "w-9",
                      pagination.page === pageNum && "bg-indigo-600 hover:bg-indigo-700"
                    )}
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={!pagination.hasMore || isLoading}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AuditLogTable;
