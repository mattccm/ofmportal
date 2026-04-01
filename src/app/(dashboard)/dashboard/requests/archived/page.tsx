"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
      const response = await fetch("/api/creators");
      if (response.ok) {
        const data = await response.json();
        setCreators(data);
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild className="h-8 w-8">
              <Link href="/dashboard/requests">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                Archived Requests
              </h1>
              <p className="mt-1 text-sm md:text-base text-muted-foreground">
                View and manage archived content requests
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-muted-foreground">
            <Archive className="mr-1.5 h-3.5 w-3.5" />
            {pagination.total} archived
          </Badge>
        </div>
      </div>

      {/* Filters */}
      <Card className="card-elevated">
        <CardContent className="p-3 md:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search archived requests..."
                className="pl-10 h-11 md:h-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Select value={creatorFilter} onValueChange={setCreatorFilter}>
                <SelectTrigger className="flex-1 md:w-[180px] h-11 md:h-10">
                  <SelectValue placeholder="Filter by creator" />
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
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearFilters}
                  className="h-11 w-11 md:h-10 md:w-10"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <Card className="card-elevated border-primary">
          <CardContent className="p-3 md:p-4">
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
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  Delete Permanently
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && requests.length === 0 ? (
        <Card className="card-elevated">
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="mt-4 text-sm text-muted-foreground">
                Loading archived requests...
              </p>
            </div>
          </CardContent>
        </Card>
      ) : requests.length === 0 ? (
        /* Empty State */
        <Card className="card-elevated">
          <CardContent className="py-12">
            <div className="text-center">
              <div className="mx-auto h-14 w-14 md:h-16 md:w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <Archive className="h-7 w-7 md:h-8 md:w-8 text-muted-foreground" />
              </div>
              <h3 className="text-base md:text-lg font-semibold text-foreground">
                {hasActiveFilters ? "No matching archived requests" : "No archived requests"}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
                {hasActiveFilters
                  ? "Try adjusting your filters to find what you're looking for."
                  : "Archived requests will appear here. Archive completed or old requests to keep your active list clean."}
              </p>
              {hasActiveFilters ? (
                <Button onClick={clearFilters} variant="outline" className="mt-6 min-h-[44px]">
                  Clear Filters
                </Button>
              ) : (
                <Button asChild className="mt-6 min-h-[44px]">
                  <Link href="/dashboard/requests">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Requests
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
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
                  className={`card-elevated opacity-75 hover:opacity-100 transition-opacity ${
                    isSelected ? "ring-2 ring-primary opacity-100" : ""
                  }`}
                >
                  {/* Muted status bar for archived */}
                  <div className="h-1 bg-gray-400" />

                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(request.id)}
                        className="mt-1"
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-muted-foreground truncate">
                              {request.title}
                            </h3>
                            <p className="text-sm text-muted-foreground truncate">
                              {request.creator.name}
                            </p>
                          </div>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/dashboard/requests/${request.id}`}>
                                  <FileText className="mr-2 h-4 w-4" />
                                  View Details
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleSingleRestore(request)}>
                                <RotateCcw className="mr-2 h-4 w-4" />
                                Restore
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleSingleDelete(request)}
                                className="text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Permanently
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <Badge
                            variant="outline"
                            className="bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-900/30 dark:text-gray-500 dark:border-gray-800 text-[10px]"
                          >
                            Archived
                          </Badge>
                          {request.template && (
                            <Badge variant="outline" className="text-[10px] opacity-60">
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
          <Card className="card-elevated hidden md:block">
            <CardHeader>
              <CardTitle>Archived Requests</CardTitle>
              <CardDescription>
                {pagination.total} archived request{pagination.total !== 1 ? "s" : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">
                      <Checkbox
                        checked={selectedIds.size === requests.length && requests.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Request</TableHead>
                    <TableHead>Creator</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Uploads</TableHead>
                    <TableHead>Archived</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => {
                    const isSelected = selectedIds.has(request.id);

                    return (
                      <TableRow
                        key={request.id}
                        className={`group opacity-75 hover:opacity-100 transition-opacity ${
                          isSelected ? "bg-muted/50 opacity-100" : ""
                        }`}
                      >
                        <TableCell>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(request.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Link
                              href={`/dashboard/requests/${request.id}`}
                              className="font-medium text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {request.title}
                            </Link>
                            <div className="flex gap-2">
                              <Badge
                                variant="outline"
                                className="bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-900/30 dark:text-gray-500 dark:border-gray-800 text-xs"
                              >
                                Archived
                              </Badge>
                              {request.template && (
                                <Badge variant="outline" className="text-xs opacity-60">
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
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleSingleRestore(request)}
                              title="Restore"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem asChild>
                                  <Link href={`/dashboard/requests/${request.id}`}>
                                    <FileText className="mr-2 h-4 w-4" />
                                    View Details
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleSingleRestore(request)}>
                                  <RotateCcw className="mr-2 h-4 w-4" />
                                  Restore
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleSingleDelete(request)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete Permanently
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
