"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Archive,
  ArrowLeft,
  Calendar,
  Clock,
  FileText,
  Loader2,
  MoreHorizontal,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { ArchiveDialog } from "@/components/requests/archive-dialog";

interface Creator {
  id: string;
  name: string;
  email: string;
}

interface RequestTemplate {
  id: string;
  name: string;
}

interface ArchivedRequest {
  id: string;
  title: string;
  description: string | null;
  status: string;
  urgency: string;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  creator: Creator;
  template: RequestTemplate | null;
  _count: {
    uploads: number;
    comments: number;
  };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function ArchivedRequestsPage() {
  const [requests, setRequests] = useState<ArchivedRequest[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [creatorFilter, setCreatorFilter] = useState("all");
  const [creators, setCreators] = useState<Creator[]>([]);
  const [dialogState, setDialogState] = useState<{
    open: boolean;
    mode: "archive" | "restore" | "delete";
    requests: Array<{ id: string; title: string }>;
  }>({ open: false, mode: "restore", requests: [] });

  // Fetch archived requests
  const fetchArchivedRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("page", pagination.page.toString());
      params.append("limit", pagination.limit.toString());
      if (search) params.append("search", search);
      if (creatorFilter !== "all") params.append("creatorId", creatorFilter);

      const response = await fetch(`/api/requests/archive?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch archived requests");
      }

      setRequests(data.requests);
      setPagination(data.pagination);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load archived requests"
      );
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, search, creatorFilter]);

  // Fetch creators for filter
  const fetchCreators = useCallback(async () => {
    try {
      const response = await fetch("/api/creators?limit=100&sortBy=name&sortOrder=asc");
      if (response.ok) {
        const data = await response.json();
        // /api/creators returns a paginated { data, pagination } response
        setCreators(Array.isArray(data) ? data : data.data ?? []);
      }
    } catch (error) {
      console.error("Failed to fetch creators:", error);
    }
  }, []);

  useEffect(() => {
    fetchArchivedRequests();
  }, [fetchArchivedRequests]);

  useEffect(() => {
    fetchCreators();
  }, [fetchCreators]);

  // Selection handlers
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === requests.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(requests.map((r) => r.id)));
    }
  }, [requests, selectedIds.size]);

  // Get selected requests for dialog
  const selectedRequests = useMemo(() => {
    return requests
      .filter((r) => selectedIds.has(r.id))
      .map((r) => ({ id: r.id, title: r.title }));
  }, [requests, selectedIds]);

  // Handle bulk restore
  const handleBulkRestore = () => {
    if (selectedIds.size === 0) {
      toast.error("No requests selected");
      return;
    }
    setDialogState({
      open: true,
      mode: "restore",
      requests: selectedRequests,
    });
  };

  // Handle bulk delete
  const handleBulkDelete = () => {
    if (selectedIds.size === 0) {
      toast.error("No requests selected");
      return;
    }
    setDialogState({
      open: true,
      mode: "delete",
      requests: selectedRequests,
    });
  };

  // Handle single restore
  const handleSingleRestore = (request: ArchivedRequest) => {
    setDialogState({
      open: true,
      mode: "restore",
      requests: [{ id: request.id, title: request.title }],
    });
  };

  // Handle single delete
  const handleSingleDelete = (request: ArchivedRequest) => {
    setDialogState({
      open: true,
      mode: "delete",
      requests: [{ id: request.id, title: request.title }],
    });
  };

  // Clear filters
  const clearFilters = () => {
    setSearch("");
    setCreatorFilter("all");
  };

  const hasActiveFilters = search || creatorFilter !== "all";

  // Handle dialog success
  const handleDialogSuccess = () => {
    setSelectedIds(new Set());
    fetchArchivedRequests();
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/dashboard/requests"
          className="inline-flex items-center gap-1 text-[14px] text-ink-2 underline-offset-[3px] hover:text-ink hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Requests
        </Link>
        <h1 className="mt-2 text-[28px] font-bold leading-tight tracking-[-0.02em] text-ink">Archived requests</h1>
        <p className="mt-1 text-[15px] text-ink-2">
          {pagination.total === 0
            ? "Nothing archived. Archived requests leave every view and reminder until you restore them."
            : `${pagination.total} archived. Restore one to put it back in Requests with its old status.`}
        </p>
      </div>

      {/* Filters */}
      <div>
        <div>
          <div className="flex flex-col gap-2 md:flex-row">
            <div className="relative flex-1 md:max-w-[360px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-icon" aria-hidden="true" />
              <Input
                placeholder="Search title or creator"
                aria-label="Search archived requests"
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Select value={creatorFilter} onValueChange={setCreatorFilter}>
                <SelectTrigger className="flex-1 md:w-[170px]" aria-label="Creator">
                  <SelectValue placeholder="Filter by creator" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All creators</SelectItem>
                  {creators.map((creator) => (
                    <SelectItem key={creator.id} value={creator.id}>
                      {creator.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearFilters}
                  aria-label="Clear filters"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="sticky top-2 z-20 rounded-[10px] bg-raised shadow-lg" role="region" aria-label="Selected requests">
          <div className="px-3 py-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm font-medium">
                {selectedIds.size} request{selectedIds.size !== 1 ? "s" : ""} selected
              </span>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkRestore}
                  disabled={loading}
                >
                  <RotateCcw className="mr-1.5 h-4 w-4" />
                  Restore
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={loading}
                  className="hover:text-late"
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  Delete permanently
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Clear selection
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && requests.length === 0 ? (
        <div className="flex items-center gap-2 rounded-[10px] bg-tile p-6 text-[14px] text-ink-2" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading archived requests
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-[10px] bg-tile p-6">
          <h2 className="text-[17px] font-semibold text-ink">
            {hasActiveFilters ? "No archived request matches" : "Nothing archived yet"}
          </h2>
          <p className="max-w-[60ch] text-[14px] text-ink-2">
            {hasActiveFilters
              ? "Clear the search or creator filter to see every archived request."
              : "Archive a finished or abandoned request from its menu in Requests. It stops counting in views and reminders, and you can restore it here at any time."}
          </p>
          {hasActiveFilters ? (
            <Button onClick={clearFilters} variant="outline">
              Clear filters
            </Button>
          ) : (
            <Button asChild variant="outline">
              <Link href="/dashboard/requests">Go to Requests</Link>
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="block md:hidden space-y-3">
            <p className="text-sm text-muted-foreground px-1">
              {pagination.total} archived request{pagination.total !== 1 ? "s" : ""}
            </p>
            {requests.map((request) => {
              const isSelected = selectedIds.has(request.id);

              return (
                <Card
                  key={request.id}
                  className={`${isSelected ? "bg-tile-hi" : ""}`}
                >

                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Checkbox aria-label={`Select ${request.title}`}
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(request.id)}
                        className="mt-1"
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate font-semibold text-ink">
                              {request.title}
                            </h3>
                            <p className="text-sm text-muted-foreground truncate">
                              {request.creator.name}
                            </p>
                          </div>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button aria-label={`More actions for ${request.title}`} variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/dashboard/requests/${request.id}`}>
                                  <FileText className="mr-2 h-4 w-4" />
                                  Open request
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleSingleRestore(request)}>
                                <RotateCcw className="mr-2 h-4 w-4" />
                                Restore
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleSingleDelete(request)}
                                className="text-late focus:text-late"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete permanently
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          {request.template && (
                            <Badge variant="outline" className="text-[12px]">
                              {request.template.name}
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                          <div className="flex items-center gap-4">
                            {request.dueDate && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                <span>{format(new Date(request.dueDate), "MMM d")}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Upload className="h-3 w-3" />
                              <span>{request._count.uploads}</span>
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            Archived {formatDistanceToNow(new Date(request.updatedAt), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Desktop Table View */}
          <Card className="hidden md:block">
            <CardContent className="pt-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">
                      <Checkbox aria-label="Select all"
                        checked={selectedIds.size === requests.length && requests.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Request</TableHead>
                    <TableHead>Creator</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Uploads</TableHead>
                    <TableHead>Archived</TableHead>
                    <TableHead className="w-[100px]"><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => {
                    const isSelected = selectedIds.has(request.id);

                    return (
                      <TableRow
                        key={request.id}
                        className={`group ${isSelected ? "bg-tile-hi" : ""}`}
                      >
                        <TableCell>
                          <Checkbox aria-label={`Select ${request.title}`}
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(request.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Link
                              href={`/dashboard/requests/${request.id}`}
                              className="font-medium text-ink hover:underline"
                            >
                              {request.title}
                            </Link>
                            <div className="flex gap-2">
                              {request.template && (
                                <Badge variant="outline" className="text-xs">
                                  {request.template.name}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {request.creator.name}
                        </TableCell>
                        <TableCell>
                          {request.dueDate ? (
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Calendar className="h-3.5 w-3.5" />
                              {format(new Date(request.dueDate), "MMM d, yyyy")}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Upload className="h-4 w-4" />
                            {request._count.uploads}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            {formatDistanceToNow(new Date(request.updatedAt), {
                              addSuffix: true,
                            })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleSingleRestore(request)}
                              title="Restore"
                              aria-label={`Restore ${request.title}`}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button aria-label={`More actions for ${request.title}`} variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem asChild>
                                  <Link href={`/dashboard/requests/${request.id}`}>
                                    <FileText className="mr-2 h-4 w-4" />
                                    Open request
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleSingleRestore(request)}>
                                  <RotateCcw className="mr-2 h-4 w-4" />
                                  Restore
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleSingleDelete(request)}
                                  className="text-late focus:text-late"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete permanently
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
                  }
                  disabled={pagination.page <= 1 || loading}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
                  }
                  disabled={pagination.page >= pagination.totalPages || loading}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Archive Dialog */}
      <ArchiveDialog
        open={dialogState.open}
        onOpenChange={(open) => setDialogState((prev) => ({ ...prev, open }))}
        selectedRequests={dialogState.requests}
        onSuccess={handleDialogSuccess}
        mode={dialogState.mode}
      />
    </div>
  );
}
