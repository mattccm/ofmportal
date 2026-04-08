"use client";

import { useState, useCallback, useEffect, useRef, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  UploadReviewCard,
  type UploadWithCreator,
} from "@/components/uploads/upload-review-card";
import { BulkActionsBar } from "@/components/uploads/bulk-actions-bar";
import {
  BulkDownloadDialog,
  type UploadForDownload,
} from "@/components/uploads/bulk-download-dialog";
import { UploadsSuggestions } from "@/components/suggestions/uploads-suggestions";
import { TagFilter, BulkTagDialog } from "@/components/tags/tag-manager";
import { TagBadge } from "@/components/tags/tag-badge";
import { Tag, BulkTagAction } from "@/lib/tag-types";
import { SavedFilters } from "@/components/filters/saved-filters";
import {
  type FilterGroup,
  UPLOAD_FILTER_FIELDS,
  createEmptyFilterGroup,
} from "@/lib/filter-utils";
import { NoUploads } from "@/components/empty-states";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { BackToTop } from "@/components/ui/back-to-top";
import { LoadingIndicator, EndOfListIndicator } from "@/components/lists";
import {
  Grid3X3,
  List,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  FileStack,
  Filter,
  ArrowUpDown,
  SlidersHorizontal,
  Tags,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface Creator {
  id: string;
  name: string;
  email: string;
}

interface RequestTemplate {
  id: string;
  name: string;
}

interface Stats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

interface Pagination {
  total: number;
  pageSize: number;
  currentPage: number;
  totalPages: number;
}

interface Filters {
  status: string;
  creator: string;
  templateId: string;
  dateFrom: string;
  dateTo: string;
  sort: string;
  order: string;
  view: "grid" | "list";
}

interface UploadsPageClientProps {
  initialUploads: UploadWithCreator[];
  creators: Creator[];
  templates: RequestTemplate[];
  stats: Stats;
  pagination: Pagination;
  initialFilters: Filters;
}

export function UploadsPageClient({
  initialUploads,
  creators,
  templates,
  stats,
  pagination,
  initialFilters,
}: UploadsPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [uploads, setUploads] = useState(initialUploads);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [bulkDownloadDialogOpen, setBulkDownloadDialogOpen] = useState(false);

  // Tag-related state
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagFilterMode, setTagFilterMode] = useState<"any" | "all">("any");
  const [bulkTagDialogOpen, setBulkTagDialogOpen] = useState(false);

  // Advanced filter state
  const [advancedFilter, setAdvancedFilter] = useState<FilterGroup>(createEmptyFilterGroup());

  // Relation options for filter builder
  const relationOptions = {
    creator: creators.map(c => ({ value: c.id, label: c.name })),
  };

  // Infinite scroll state
  const [hasMore, setHasMore] = useState(pagination.currentPage < pagination.totalPages);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(pagination.currentPage);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load more uploads for infinite scroll
  const loadMoreUploads = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    const nextPage = currentPage + 1;

    try {
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", nextPage.toString());
      params.set("pageSize", pagination.pageSize.toString());

      const response = await fetch(`/api/uploads?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to load more uploads");

      const data = await response.json();
      setUploads((prev) => [...prev, ...data.uploads]);
      setCurrentPage(nextPage);
      setHasMore(nextPage < data.pagination.totalPages);
    } catch (error) {
      console.error("Failed to load more uploads:", error);
      toast.error("Failed to load more uploads");
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, currentPage, searchParams, pagination.pageSize]);

  // Set up infinite scroll
  const { sentinelRef, isEndReached } = useInfiniteScroll({
    onLoadMore: loadMoreUploads,
    hasMore,
    isLoading: isLoadingMore,
    rootMargin: "200px",
  });

  // Reset infinite scroll state when filters change
  useEffect(() => {
    setUploads(initialUploads);
    setCurrentPage(pagination.currentPage);
    setHasMore(pagination.currentPage < pagination.totalPages);
  }, [initialUploads, pagination.currentPage, pagination.totalPages]);

  // Fetch available tags
  useEffect(() => {
    async function fetchTags() {
      try {
        const response = await fetch("/api/tags");
        if (response.ok) {
          const data = await response.json();
          setAvailableTags(data.tags);
        }
      } catch {
        console.error("Failed to fetch tags");
      }
    }
    fetchTags();
  }, []);

  // Update URL with new params (wrapped in transition for loading state)
  const updateSearchParams = useCallback(
    (updates: Partial<Filters>) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (value && value !== "all" && value !== "") {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      });

      // Reset to page 1 when filters change
      if (!updates.hasOwnProperty("page")) {
        params.delete("page");
      }

      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [router, pathname, searchParams]
  );

  // Handle filter changes
  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    updateSearchParams({ [key]: value });
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", page.toString());
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  // Handle view toggle
  const handleViewChange = (view: "grid" | "list") => {
    setFilters((prev) => ({ ...prev, view }));
    updateSearchParams({ view });
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

  const handleSelectAll = () => {
    const pendingIds = uploads
      .filter((u) => u.status === "PENDING")
      .map((u) => u.id);
    setSelectedIds(new Set(pendingIds));
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  // Refresh data
  const refreshData = () => {
    router.refresh();
  };

  // Bulk approve
  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) return;

    setIsProcessing(true);
    try {
      const response = await fetch("/api/uploads/bulk-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploadIds: Array.from(selectedIds),
          action: "approve",
        }),
      });

      if (!response.ok) throw new Error("Failed to approve uploads");

      const data = await response.json();
      toast.success(`${data.approved} upload(s) approved successfully`);
      setSelectedIds(new Set());
      refreshData();
    } catch {
      toast.error("Failed to approve uploads");
    } finally {
      setIsProcessing(false);
    }
  };

  // Bulk reject
  const handleBulkReject = async (reason: string) => {
    if (selectedIds.size === 0) return;

    setIsProcessing(true);
    try {
      const response = await fetch("/api/uploads/bulk-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploadIds: Array.from(selectedIds),
          action: "reject",
          notes: reason,
        }),
      });

      if (!response.ok) throw new Error("Failed to reject uploads");

      const data = await response.json();
      toast.success(`${data.rejected} upload(s) rejected`);
      setSelectedIds(new Set());
      refreshData();
    } catch {
      toast.error("Failed to reject uploads");
    } finally {
      setIsProcessing(false);
    }
  };

  // Bulk download - opens the advanced download dialog
  const handleBulkDownload = () => {
    setBulkDownloadDialogOpen(true);
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    setIsProcessing(true);
    try {
      const response = await fetch("/api/uploads/bulk-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploadIds: Array.from(selectedIds),
          action: "delete",
        }),
      });

      if (!response.ok) throw new Error("Failed to delete uploads");

      const data = await response.json();
      toast.success(`${data.deleted} upload(s) deleted successfully`);
      setSelectedIds(new Set());
      refreshData();
    } catch {
      toast.error("Failed to delete uploads");
    } finally {
      setIsProcessing(false);
    }
  };

  // Export CSV
  const handleExportCsv = async () => {
    toast.info("Generating CSV...");
    try {
      const params = new URLSearchParams();
      if (selectedIds.size > 0) {
        params.set("ids", Array.from(selectedIds).join(","));
      } else {
        // Export current filter results
        if (filters.status !== "all") params.set("status", filters.status);
        if (filters.creator) params.set("creator", filters.creator);
        if (filters.templateId) params.set("templateId", filters.templateId);
        if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
        if (filters.dateTo) params.set("dateTo", filters.dateTo);
      }

      const response = await fetch(`/api/uploads/export?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to generate export");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `uploads-metadata-${format(new Date(), "yyyy-MM-dd")}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("CSV exported successfully");
    } catch {
      toast.error("Failed to export CSV");
    }
  };

  const safeUploads = uploads && Array.isArray(uploads) ? uploads : [];
  const pendingCount = safeUploads.filter((u) => u.status === "PENDING").length;

  // Handle bulk tag operation
  const handleBulkTagApply = async (action: BulkTagAction, tagIds: string[]) => {
    if (selectedIds.size === 0) {
      toast.error("No uploads selected");
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch("/api/tags/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          tagIds,
          targetIds: Array.from(selectedIds),
          targetType: "upload",
        }),
      });

      if (!response.ok) throw new Error("Failed to apply tags");

      const data = await response.json();
      toast.success(`Tags updated for ${data.affected} upload(s)`);
      setSelectedIds(new Set());
      setBulkTagDialogOpen(false);
      refreshData();
    } catch {
      toast.error("Failed to apply tags");
      throw new Error("Failed to apply tags");
    } finally {
      setIsProcessing(false);
    }
  };

  // Filter uploads by selected tags (client-side filtering)
  const filteredUploads = selectedTagIds.length > 0
    ? safeUploads.filter((upload) => {
        const uploadTagIds = (upload.tags || []).map((t) => t.id);
        if (tagFilterMode === "any") {
          return selectedTagIds.some((id) => uploadTagIds.includes(id));
        } else {
          return selectedTagIds.every((id) => uploadTagIds.includes(id));
        }
      })
    : safeUploads;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Uploads</h1>
          <p className="text-muted-foreground mt-1">
            Review and manage all content uploads
          </p>
        </div>
      </div>

      {/* Smart Suggestions */}
      <UploadsSuggestions
        pendingUploads={stats.pending}
        totalUploads={stats.total}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card
          className={cn(
            "cursor-pointer transition-all hover:shadow-md",
            filters.status === "all" && "ring-2 ring-primary"
          )}
          onClick={() => handleFilterChange("status", "all")}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <FileStack className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Uploads</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className={cn(
            "cursor-pointer transition-all hover:shadow-md",
            filters.status === "pending" && "ring-2 ring-amber-500",
            isPending && filters.status === "pending" && "opacity-70"
          )}
          onClick={() => handleFilterChange("status", "pending")}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-100 dark:bg-amber-900/30 p-2">
                {isPending && filters.status === "pending" ? (
                  <Loader2 className="h-5 w-5 text-amber-600 animate-spin" />
                ) : (
                  <Clock className="h-5 w-5 text-amber-600" />
                )}
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-xs text-muted-foreground">Pending Review</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className={cn(
            "cursor-pointer transition-all hover:shadow-md",
            filters.status === "approved" && "ring-2 ring-emerald-500",
            isPending && filters.status === "approved" && "opacity-70"
          )}
          onClick={() => handleFilterChange("status", "approved")}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-100 dark:bg-emerald-900/30 p-2">
                {isPending && filters.status === "approved" ? (
                  <Loader2 className="h-5 w-5 text-emerald-600 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                )}
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.approved}</p>
                <p className="text-xs text-muted-foreground">Approved</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className={cn(
            "cursor-pointer transition-all hover:shadow-md",
            filters.status === "rejected" && "ring-2 ring-red-500",
            isPending && filters.status === "rejected" && "opacity-70"
          )}
          onClick={() => handleFilterChange("status", "rejected")}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-red-100 dark:bg-red-900/30 p-2">
                {isPending && filters.status === "rejected" ? (
                  <Loader2 className="h-5 w-5 text-red-600 animate-spin" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.rejected}</p>
                <p className="text-xs text-muted-foreground">Rejected</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Advanced Saved Filters */}
      <SavedFilters
        entityType="uploads"
        fieldDefinitions={UPLOAD_FILTER_FIELDS}
        relationOptions={relationOptions}
        currentFilter={advancedFilter}
        onFilterChange={setAdvancedFilter}
        onApplyFilter={refreshData}
      />

      {/* Bulk Actions Bar */}
      <BulkActionsBar
        selectedIds={selectedIds}
        totalCount={uploads.length}
        pendingCount={pendingCount}
        onSelectAll={handleSelectAll}
        onDeselectAll={handleDeselectAll}
        onBulkApprove={handleBulkApprove}
        onBulkReject={handleBulkReject}
        onBulkDownload={handleBulkDownload}
        onBulkDelete={handleBulkDelete}
        onExportCsv={handleExportCsv}
        isProcessing={isProcessing}
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Status Filter */}
        <Select
          value={filters.status}
          onValueChange={(value) => handleFilterChange("status", value)}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>

        {/* Creator Filter */}
        <Select
          value={filters.creator || "all"}
          onValueChange={(value) =>
            handleFilterChange("creator", value === "all" ? "" : value)
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Creators" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Creators</SelectItem>
            {creators.map((creator) => (
              <SelectItem key={creator.id} value={creator.id}>
                {creator.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Request Template Filter */}
        <Select
          value={filters.templateId || "all"}
          onValueChange={(value) =>
            handleFilterChange("templateId", value === "all" ? "" : value)
          }
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Request Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Request Types</SelectItem>
            {templates.map((template) => (
              <SelectItem key={template.id} value={template.id}>
                {template.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Sort */}
        <Select
          value={`${filters.sort}-${filters.order}`}
          onValueChange={(value) => {
            const [sort, order] = value.split("-");
            setFilters((prev) => ({ ...prev, sort, order }));
            updateSearchParams({ sort, order });
          }}
        >
          <SelectTrigger className="w-[180px]">
            <ArrowUpDown className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="uploadedAt-desc">Newest First</SelectItem>
            <SelectItem value="uploadedAt-asc">Oldest First</SelectItem>
            <SelectItem value="originalName-asc">Name (A-Z)</SelectItem>
            <SelectItem value="originalName-desc">Name (Z-A)</SelectItem>
            <SelectItem value="fileSize-desc">Largest First</SelectItem>
            <SelectItem value="fileSize-asc">Smallest First</SelectItem>
          </SelectContent>
        </Select>

        {/* More Filters Toggle */}
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setShowFilters(!showFilters)}
        >
          <SlidersHorizontal className="h-4 w-4" />
          {showFilters ? "Hide Filters" : "More Filters"}
        </Button>

        {/* Bulk Tag Button */}
        {selectedIds.size > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setBulkTagDialogOpen(true)}
          >
            <Tags className="h-4 w-4" />
            Tag Selected ({selectedIds.size})
          </Button>
        )}

        <div className="flex-1" />

        {/* View Toggle */}
        <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
          <Button
            size="sm"
            variant={filters.view === "grid" ? "secondary" : "ghost"}
            className="h-8 w-8 p-0"
            onClick={() => handleViewChange("grid")}
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant={filters.view === "list" ? "secondary" : "ghost"}
            className="h-8 w-8 p-0"
            onClick={() => handleViewChange("list")}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Extended Filters */}
      {showFilters && (
        <div className="flex flex-col gap-4 p-4 bg-muted/30 rounded-xl border animate-fade-in">
          {/* Date Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">From:</span>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
                className="w-[150px] h-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">To:</span>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange("dateTo", e.target.value)}
                className="w-[150px] h-9"
              />
            </div>
            {(filters.dateFrom || filters.dateTo) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setFilters((prev) => ({ ...prev, dateFrom: "", dateTo: "" }));
                  updateSearchParams({ dateFrom: "", dateTo: "" });
                }}
              >
                Clear dates
              </Button>
            )}
          </div>

          {/* Tag Filter */}
          {availableTags.length > 0 && (
            <div className="border-t pt-4">
              <TagFilter
                tags={availableTags}
                selectedTagIds={selectedTagIds}
                onSelectionChange={setSelectedTagIds}
                filterMode={tagFilterMode}
                onFilterModeChange={setTagFilterMode}
              />
            </div>
          )}
        </div>
      )}

      {/* Active Tag Filters Display */}
      {selectedTagIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Filtering by tags:</span>
          {selectedTagIds.map((id) => {
            const tag = availableTags.find((t) => t.id === id);
            return tag ? (
              <TagBadge
                key={id}
                name={tag.name}
                color={tag.color}
                size="sm"
                removable
                onRemove={() => setSelectedTagIds((prev) => prev.filter((i) => i !== id))}
              />
            ) : null;
          })}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            onClick={() => setSelectedTagIds([])}
          >
            Clear all
          </Button>
        </div>
      )}

      {/* Uploads Grid/List */}
      <div className="relative">
        {/* Loading overlay when filters are changing */}
        {isPending && (
          <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-lg min-h-[200px]">
            <div className="flex items-center gap-3 bg-background/90 px-4 py-3 rounded-lg shadow-lg border">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm font-medium">Loading uploads...</span>
            </div>
          </div>
        )}

        {filteredUploads.length === 0 && !isPending ? (
          <NoUploads
            isFiltered={filters.status !== "all" || !!filters.creator || !!filters.templateId || selectedTagIds.length > 0}
            onClearFilters={() => {
              setFilters(prev => ({ ...prev, status: "all", creator: "", templateId: "" }));
              setSelectedTagIds([]);
              updateSearchParams({ status: "all", creator: "", templateId: "" });
            }}
            context={filters.status === "pending" ? "pending" : filters.status === "approved" ? "approved" : filters.status === "rejected" ? "rejected" : "all"}
            withCard={false}
          />
        ) : filters.view === "grid" ? (
          <div className={cn(
            "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4",
            isPending && "opacity-50 pointer-events-none"
          )}>
            {filteredUploads.map((upload) => (
              <UploadReviewCard
                key={upload.id}
                upload={upload}
                isSelected={selectedIds.has(upload.id)}
                onSelect={handleSelect}
                onReviewComplete={refreshData}
                viewMode="grid"
              />
            ))}
          </div>
        ) : (
          <div className={cn(
            "space-y-2",
            isPending && "opacity-50 pointer-events-none"
          )}>
            {filteredUploads.map((upload) => (
              <UploadReviewCard
                key={upload.id}
                upload={upload}
                isSelected={selectedIds.has(upload.id)}
                onSelect={handleSelect}
                onReviewComplete={refreshData}
                viewMode="list"
              />
            ))}
          </div>
        )}
      </div>

      {/* Infinite Scroll Sentinel */}
      <div ref={sentinelRef} className="h-1 w-full" aria-hidden="true" />

      {/* Loading More Indicator */}
      {isLoadingMore && (
        <LoadingIndicator text="Loading more uploads..." />
      )}

      {/* End of List Indicator */}
      {isEndReached && filteredUploads.length > 0 && (
        <EndOfListIndicator text={`Showing all ${pagination.total} uploads`} />
      )}

      {/* Upload Count */}
      {!isLoadingMore && !isEndReached && hasMore && (
        <p className="text-center text-sm text-muted-foreground py-4">
          Showing {filteredUploads.length} of {pagination.total} uploads
        </p>
      )}

      {/* Back to Top Button */}
      <BackToTop threshold={400} variant="gradient" />

      {/* Bulk Download Dialog */}
      <BulkDownloadDialog
        open={bulkDownloadDialogOpen}
        onOpenChange={setBulkDownloadDialogOpen}
        uploads={uploads.map((upload) => ({
          id: upload.id,
          originalName: upload.originalName,
          fileType: upload.fileType,
          fileSize: upload.fileSize,
          status: upload.status,
          uploadedAt: upload.uploadedAt,
          creator: {
            id: upload.creator.id,
            name: upload.creator.name,
          },
          request: {
            id: upload.request.id,
            title: upload.request.title,
          },
        })) as UploadForDownload[]}
        selectedIds={selectedIds}
      />

      {/* Bulk Tag Dialog */}
      <BulkTagDialog
        open={bulkTagDialogOpen}
        onOpenChange={setBulkTagDialogOpen}
        tags={availableTags}
        selectedCount={selectedIds.size}
        onApply={handleBulkTagApply}
      />
    </div>
  );
}
