"use client";

import * as React from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Search,
  Download,
  Filter,
  Calendar,
  User,
  ShieldAlert,
  FileWarning,
  Ban,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  ArrowUpDown,
  RefreshCw,
  Eye,
  ExternalLink,
  TrendingUp,
  Users,
  Copy,
  Shield,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
  DuplicateAttempt,
  DuplicateMatchTypeEnum,
  DuplicateActionEnum,
  DuplicateAttemptListResponse,
} from "@/types/content-fingerprint";

// ============================================
// TYPES
// ============================================

interface FilterState {
  search: string;
  creatorId: string;
  matchType: string;
  action: string;
  startDate: string;
  endDate: string;
}

interface DuplicateAttemptsLogProps {
  initialData?: DuplicateAttemptListResponse;
}

// ============================================
// HELPER COMPONENTS
// ============================================

function MatchTypeBadge({ matchType }: { matchType: DuplicateMatchTypeEnum }) {
  const styles = {
    EXACT: {
      bg: "bg-red-50 dark:bg-red-950/30",
      text: "text-red-700 dark:text-red-400",
      border: "border-red-200 dark:border-red-800/50",
      icon: Ban,
    },
    NEAR: {
      bg: "bg-orange-50 dark:bg-orange-950/30",
      text: "text-orange-700 dark:text-orange-400",
      border: "border-orange-200 dark:border-orange-800/50",
      icon: AlertTriangle,
    },
    SIMILAR: {
      bg: "bg-amber-50 dark:bg-amber-950/30",
      text: "text-amber-700 dark:text-amber-400",
      border: "border-amber-200 dark:border-amber-800/50",
      icon: FileWarning,
    },
  };

  const style = styles[matchType];
  const Icon = style.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border",
        style.bg,
        style.text,
        style.border
      )}
    >
      <Icon className="h-3 w-3" />
      {matchType === "EXACT" ? "Exact" : matchType === "NEAR" ? "Near" : "Similar"}
    </span>
  );
}

function ActionBadge({ action }: { action: DuplicateActionEnum }) {
  const styles = {
    BLOCKED: {
      bg: "bg-red-50 dark:bg-red-950/30",
      text: "text-red-700 dark:text-red-400",
      border: "border-red-200 dark:border-red-800/50",
      icon: Ban,
    },
    WARNED: {
      bg: "bg-amber-50 dark:bg-amber-950/30",
      text: "text-amber-700 dark:text-amber-400",
      border: "border-amber-200 dark:border-amber-800/50",
      icon: AlertTriangle,
    },
    ALLOWED: {
      bg: "bg-green-50 dark:bg-green-950/30",
      text: "text-green-700 dark:text-green-400",
      border: "border-green-200 dark:border-green-800/50",
      icon: CheckCircle2,
    },
    OVERRIDDEN: {
      bg: "bg-blue-50 dark:bg-blue-950/30",
      text: "text-blue-700 dark:text-blue-400",
      border: "border-blue-200 dark:border-blue-800/50",
      icon: Shield,
    },
  };

  const style = styles[action];
  const Icon = style.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border",
        style.bg,
        style.text,
        style.border
      )}
    >
      <Icon className="h-3 w-3" />
      {action.charAt(0) + action.slice(1).toLowerCase()}
    </span>
  );
}

function SimilarityBadge({ similarity }: { similarity: number }) {
  let color = "text-green-600 dark:text-green-400";
  if (similarity >= 95) {
    color = "text-red-600 dark:text-red-400";
  } else if (similarity >= 85) {
    color = "text-orange-600 dark:text-orange-400";
  } else if (similarity >= 70) {
    color = "text-amber-600 dark:text-amber-400";
  }

  return (
    <span className={cn("font-mono font-medium", color)}>
      {similarity}%
    </span>
  );
}

// ============================================
// EXPANDED ROW DETAILS
// ============================================

function ExpandedRowDetails({ attempt }: { attempt: DuplicateAttempt }) {
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="p-4 bg-muted/30 border-t">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Attempted File */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FileWarning className="h-4 w-4 text-orange-500" />
            Attempted Upload
          </h4>

          <div className="space-y-3 text-sm bg-background rounded-lg p-3 border">
            <div className="flex items-start gap-2">
              <span className="font-medium text-muted-foreground min-w-[100px]">File Name:</span>
              <span className="text-foreground break-all">{attempt.attemptedFileName}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-medium text-muted-foreground min-w-[100px]">File Size:</span>
              <span className="text-foreground">{formatFileSize(attempt.attemptedFileSize)}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-medium text-muted-foreground min-w-[100px]">File Type:</span>
              <span className="text-foreground">{attempt.attemptedFileType}</span>
            </div>
            {attempt.attemptedFileHash && (
              <div className="flex items-start gap-2">
                <span className="font-medium text-muted-foreground min-w-[100px]">Hash:</span>
                <span className="text-foreground font-mono text-xs break-all">
                  {attempt.attemptedFileHash.slice(0, 16)}...
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Original File */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Copy className="h-4 w-4 text-indigo-500" />
            Original Content
          </h4>

          <div className="space-y-3 text-sm bg-background rounded-lg p-3 border">
            <div className="flex items-start gap-2">
              <span className="font-medium text-muted-foreground min-w-[100px]">File Name:</span>
              <span className="text-foreground break-all">{attempt.originalFileName}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-medium text-muted-foreground min-w-[100px]">File Size:</span>
              <span className="text-foreground">{formatFileSize(attempt.originalFileSize)}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-medium text-muted-foreground min-w-[100px]">Uploaded:</span>
              <span className="text-foreground">
                {new Date(attempt.originalUploadedAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-medium text-muted-foreground min-w-[100px]">Upload ID:</span>
              <code className="text-foreground font-mono text-xs">{attempt.originalUploadId}</code>
            </div>
          </div>
        </div>
      </div>

      {/* Match Details */}
      <div className="mt-4 pt-4 border-t">
        <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-violet-500" />
          Match Details
        </h4>
        <div className="flex flex-wrap gap-2">
          {attempt.hashMatch && (
            <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400">
              Hash Match
            </Badge>
          )}
          {attempt.perceptualMatch && (
            <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400">
              Perceptual Match
            </Badge>
          )}
          {attempt.metadataMatch && (
            <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
              Metadata Match
            </Badge>
          )}
        </div>

        {attempt.overrideReason && (
          <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800/50">
            <p className="text-sm font-medium text-blue-700 dark:text-blue-400">Override Reason:</p>
            <p className="text-sm text-blue-600 dark:text-blue-300 mt-1">{attempt.overrideReason}</p>
            {attempt.overrideAt && (
              <p className="text-xs text-blue-500 mt-2">
                Overridden on {new Date(attempt.overrideAt).toLocaleDateString()}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// STATS COMPONENT
// ============================================

function StatsCards({
  stats,
}: {
  stats: DuplicateAttemptListResponse["stats"];
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="p-4 rounded-xl bg-gradient-to-br from-red-500/10 to-orange-500/10 border border-red-200/50 dark:border-red-800/30">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
            <Ban className="h-5 w-5 text-red-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.blockedCount.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">Blocked</p>
          </div>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-yellow-500/10 border border-amber-200/50 dark:border-amber-800/30">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.warnedCount.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">Warned</p>
          </div>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10 border border-indigo-200/50 dark:border-indigo-800/30">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-indigo-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.totalAttempts.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">Total Attempts</p>
          </div>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-gradient-to-br from-violet-500/10 to-purple-500/10 border border-violet-200/50 dark:border-violet-800/30">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
            <Users className="h-5 w-5 text-violet-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.uniqueCreators}</p>
            <p className="text-sm text-muted-foreground">Unique Creators</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function DuplicateAttemptsLog({ initialData }: DuplicateAttemptsLogProps) {
  const [data, setData] = React.useState<DuplicateAttemptListResponse | null>(initialData || null);
  const [isLoading, setIsLoading] = React.useState(!initialData);
  const [error, setError] = React.useState<string | null>(null);

  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = React.useState(false);

  const [currentPage, setCurrentPage] = React.useState(1);
  const [currentSort, setCurrentSort] = React.useState<{
    sortBy: string;
    sortOrder: "asc" | "desc";
  }>({
    sortBy: "attemptedAt",
    sortOrder: "desc",
  });

  const [localFilters, setLocalFilters] = React.useState<FilterState>({
    search: "",
    creatorId: "",
    matchType: "",
    action: "",
    startDate: "",
    endDate: "",
  });
  const [appliedFilters, setAppliedFilters] = React.useState<FilterState>(localFilters);

  // Override dialog state
  const [overrideDialogOpen, setOverrideDialogOpen] = React.useState(false);
  const [selectedAttempt, setSelectedAttempt] = React.useState<DuplicateAttempt | null>(null);
  const [overrideReason, setOverrideReason] = React.useState("");
  const [isOverriding, setIsOverriding] = React.useState(false);

  // Fetch data
  const fetchData = React.useCallback(async (page: number = 1) => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "50",
        sortBy: currentSort.sortBy,
        sortOrder: currentSort.sortOrder,
      });

      if (appliedFilters.search) params.set("search", appliedFilters.search);
      if (appliedFilters.creatorId) params.set("creatorId", appliedFilters.creatorId);
      if (appliedFilters.matchType) params.set("matchType", appliedFilters.matchType);
      if (appliedFilters.action) params.set("action", appliedFilters.action);
      if (appliedFilters.startDate) params.set("startDate", appliedFilters.startDate);
      if (appliedFilters.endDate) params.set("endDate", appliedFilters.endDate);

      const response = await fetch(`/api/duplicate-attempts?${params.toString()}`);

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("You do not have permission to view duplicate attempts");
        }
        throw new Error("Failed to fetch duplicate attempts");
      }

      const result: DuplicateAttemptListResponse = await response.json();
      setData(result);
      setCurrentPage(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [currentSort, appliedFilters]);

  // Initial load
  React.useEffect(() => {
    if (!initialData) {
      fetchData(1);
    }
  }, [fetchData, initialData]);

  // Handlers
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
    setCurrentSort((prev) => ({
      sortBy: column,
      sortOrder: prev.sortBy === column && prev.sortOrder === "desc" ? "asc" : "desc",
    }));
    fetchData(1);
  };

  const handleApplyFilters = () => {
    setAppliedFilters(localFilters);
    fetchData(1);
  };

  const handleClearFilters = () => {
    const emptyFilters: FilterState = {
      search: "",
      creatorId: "",
      matchType: "",
      action: "",
      startDate: "",
      endDate: "",
    };
    setLocalFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    fetchData(1);
  };

  const handlePageChange = (page: number) => {
    fetchData(page);
  };

  const handleRefresh = () => {
    fetchData(currentPage);
  };

  const handleExport = async () => {
    // Implement CSV export
    if (!data?.attempts) return;

    const csvContent = [
      ["Date", "Creator", "Attempted File", "Original File", "Match Type", "Similarity", "Action"].join(","),
      ...data.attempts.map((a) =>
        [
          new Date(a.attemptedAt).toISOString(),
          a.creator?.name || "Unknown",
          `"${a.attemptedFileName}"`,
          `"${a.originalFileName}"`,
          a.matchType,
          `${a.similarity}%`,
          a.action,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `duplicate-attempts-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleOverride = async () => {
    if (!selectedAttempt || !overrideReason.trim()) return;

    setIsOverriding(true);

    try {
      const response = await fetch("/api/duplicate-attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId: selectedAttempt.id,
          reason: overrideReason,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to override duplicate");
      }

      setOverrideDialogOpen(false);
      setSelectedAttempt(null);
      setOverrideReason("");
      fetchData(currentPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to override");
    } finally {
      setIsOverriding(false);
    }
  };

  const hasActiveFilters = Object.values(appliedFilters).some((v) => v !== "");

  const formatDate = (dateString: string | Date) => {
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

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertTriangle className="h-12 w-12 text-red-500" />
        <h2 className="text-xl font-semibold">Error</h2>
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={handleRefresh}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      {data?.stats && <StatsCards stats={data.stats} />}

      {/* Repeat Offenders Alert */}
      {data?.stats?.repeatOffenders && data.stats.repeatOffenders.length > 0 && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-800/30">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
              <ShieldAlert className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <h3 className="font-semibold text-red-700 dark:text-red-400">
                Repeat Offenders Detected
              </h3>
              <p className="text-sm text-red-600 dark:text-red-300 mt-0.5">
                {data.stats.repeatOffenders.length} creator(s) have attempted to upload duplicates
                multiple times. Consider reviewing their upload history.
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {data.stats.repeatOffenders.slice(0, 5).map((offender) => {
                  const creator = data.filters.creators.find((c) => c.id === offender.creatorId);
                  return (
                    <Link
                      key={offender.creatorId}
                      href={`/dashboard/settings/duplicate-detection?creatorId=${offender.creatorId}`}
                    >
                      <Badge
                        variant="secondary"
                        className="bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400 hover:bg-red-200 cursor-pointer"
                      >
                        {creator?.name || "Unknown"} ({offender.count} attempts)
                      </Badge>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by filename, creator..."
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
                {Object.values(appliedFilters).filter((v) => v !== "").length}
              </Badge>
            )}
          </Button>

          <Button variant="outline" onClick={handleRefresh} disabled={isLoading} className="gap-2">
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          <Button variant="outline" onClick={handleExport} disabled={isLoading || !data?.attempts?.length} className="gap-2">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        </div>
      </div>

      {/* Expanded Filters */}
      {showFilters && (
        <div className="p-4 bg-muted/30 rounded-lg border space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Creator Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                Creator
              </label>
              <Select
                value={localFilters.creatorId}
                onValueChange={(value) =>
                  setLocalFilters({ ...localFilters, creatorId: value === "all" ? "" : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All creators" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All creators</SelectItem>
                  {data?.filters.creators.map((creator) => (
                    <SelectItem key={creator.id} value={creator.id}>
                      {creator.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Match Type Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <FileWarning className="h-4 w-4 text-muted-foreground" />
                Match Type
              </label>
              <Select
                value={localFilters.matchType}
                onValueChange={(value) =>
                  setLocalFilters({ ...localFilters, matchType: value === "all" ? "" : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="EXACT">Exact Match</SelectItem>
                  <SelectItem value="NEAR">Near Match</SelectItem>
                  <SelectItem value="SIMILAR">Similar</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Action Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                Action
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
                  <SelectItem value="BLOCKED">Blocked</SelectItem>
                  <SelectItem value="WARNED">Warned</SelectItem>
                  <SelectItem value="ALLOWED">Allowed</SelectItem>
                  <SelectItem value="OVERRIDDEN">Overridden</SelectItem>
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
        <div className="overflow-auto max-h-[600px]">
          <Table>
            <TableHeader className="bg-muted/50 sticky top-0 z-10">
              <TableRow>
                <TableHead className="w-10" />
                <TableHead
                  className="cursor-pointer hover:bg-muted/80 transition-colors"
                  onClick={() => handleSort("attemptedAt")}
                >
                  <div className="flex items-center gap-2">
                    Date
                    <SortIcon column="attemptedAt" />
                  </div>
                </TableHead>
                <TableHead>Creator</TableHead>
                <TableHead>Attempted File</TableHead>
                <TableHead>Original File</TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/80 transition-colors"
                  onClick={() => handleSort("matchType")}
                >
                  <div className="flex items-center gap-2">
                    Match
                    <SortIcon column="matchType" />
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/80 transition-colors"
                  onClick={() => handleSort("similarity")}
                >
                  <div className="flex items-center gap-2">
                    Similarity
                    <SortIcon column="similarity" />
                  </div>
                </TableHead>
                <TableHead>Action</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-32">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Loading duplicate attempts...
                    </div>
                  </TableCell>
                </TableRow>
              ) : !data?.attempts?.length ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-32">
                    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                      <CheckCircle2 className="h-8 w-8 text-green-500" />
                      <p>No duplicate attempts found</p>
                      {hasActiveFilters && (
                        <Button variant="link" onClick={handleClearFilters} className="text-indigo-600">
                          Clear filters
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                data.attempts.map((attempt) => {
                  const isExpanded = expandedRows.has(attempt.id);

                  return (
                    <React.Fragment key={attempt.id}>
                      <TableRow
                        className={cn(
                          "cursor-pointer hover:bg-muted/50 transition-colors",
                          isExpanded && "bg-muted/30"
                        )}
                        onClick={() => toggleRow(attempt.id)}
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
                          {formatDate(attempt.attemptedAt)}
                        </TableCell>
                        <TableCell>
                          {attempt.creator ? (
                            <div className="flex items-center gap-2">
                              <Avatar
                                user={{
                                  name: attempt.creator.name,
                                  email: attempt.creator.email,
                                  image: attempt.creator.avatar,
                                }}
                                size="sm"
                              />
                              <div className="min-w-0">
                                <p className="font-medium truncate max-w-[120px]">
                                  {attempt.creator.name}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic">Unknown</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="truncate max-w-[150px] block" title={attempt.attemptedFileName}>
                            {attempt.attemptedFileName}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="truncate max-w-[150px] block" title={attempt.originalFileName}>
                            {attempt.originalFileName}
                          </span>
                        </TableCell>
                        <TableCell>
                          <MatchTypeBadge matchType={attempt.matchType} />
                        </TableCell>
                        <TableCell>
                          <SimilarityBadge similarity={attempt.similarity} />
                        </TableCell>
                        <TableCell>
                          <ActionBadge action={attempt.action} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(`/dashboard/uploads/${attempt.originalUploadId}`, "_blank");
                              }}
                              title="View original upload"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {attempt.action === "BLOCKED" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-blue-600 hover:text-blue-700"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedAttempt(attempt);
                                  setOverrideDialogOpen(true);
                                }}
                                title="Override block"
                              >
                                <Shield className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={9} className="p-0">
                            <ExpandedRowDetails attempt={attempt} />
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
      {data?.pagination && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(data.pagination.page - 1) * data.pagination.limit + 1} to{" "}
            {Math.min(data.pagination.page * data.pagination.limit, data.pagination.total)} of{" "}
            {data.pagination.total} entries
          </p>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1 || isLoading}
            >
              Previous
            </Button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, data.pagination.totalPages) }, (_, i) => {
                let pageNum: number;
                if (data.pagination.totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= data.pagination.totalPages - 2) {
                  pageNum = data.pagination.totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePageChange(pageNum)}
                    disabled={isLoading}
                    className={cn(
                      "w-9",
                      currentPage === pageNum && "bg-indigo-600 hover:bg-indigo-700"
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
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={!data.pagination.hasMore || isLoading}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Override Dialog */}
      <Dialog open={overrideDialogOpen} onOpenChange={setOverrideDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override Duplicate Block</DialogTitle>
            <DialogDescription>
              Provide a reason for allowing this content to be uploaded. This action will be logged.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Override Reason</label>
              <Textarea
                placeholder="Enter the reason for overriding this duplicate block..."
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                rows={3}
              />
            </div>

            {selectedAttempt && (
              <div className="p-3 bg-muted/50 rounded-lg text-sm">
                <p><strong>File:</strong> {selectedAttempt.attemptedFileName}</p>
                <p><strong>Creator:</strong> {selectedAttempt.creator?.name || "Unknown"}</p>
                <p><strong>Match Type:</strong> {selectedAttempt.matchType}</p>
                <p><strong>Similarity:</strong> {selectedAttempt.similarity}%</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleOverride}
              disabled={!overrideReason.trim() || isOverriding}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {isOverriding ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Overriding...
                </>
              ) : (
                "Override Block"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default DuplicateAttemptsLog;
