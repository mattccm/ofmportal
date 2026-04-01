"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Filter,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Archive,
  Loader2,
  ArrowRight,
  Calendar,
  User,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { format, subDays, isAfter, isBefore } from "date-fns";
import { ProgressTracker } from "./progress-tracker";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { OperationTemplates } from "./operation-templates";
import { SmartSelectionPresets } from "./smart-selection-presets";
import { cn } from "@/lib/utils";
import type { RequestStatus } from "@/lib/bulk-operations";
import { UNDO_STORAGE_KEY, createEnhancedUndoWindow } from "@/lib/bulk-operations";

// Types
interface Request {
  id: string;
  title: string;
  status: RequestStatus;
  urgency: string;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  creator: {
    id: string;
    name: string;
    email: string;
  };
  _count?: {
    uploads: number;
    comments: number;
  };
}

interface BulkStatusUpdaterProps {
  onComplete?: (result: StatusUpdateResult) => void;
  onCancel?: () => void;
}

interface StatusUpdateResult {
  success: boolean;
  affected: number;
  total: number;
  errors?: string[];
}

type StatusFilter = "all" | RequestStatus;

const STATUS_OPTIONS: { value: RequestStatus; label: string; color: string }[] = [
  { value: "DRAFT", label: "Draft", color: "bg-gray-500" },
  { value: "PENDING", label: "Pending", color: "bg-yellow-500" },
  { value: "IN_PROGRESS", label: "In Progress", color: "bg-blue-500" },
  { value: "SUBMITTED", label: "Submitted", color: "bg-purple-500" },
  { value: "UNDER_REVIEW", label: "Under Review", color: "bg-indigo-500" },
  { value: "NEEDS_REVISION", label: "Needs Revision", color: "bg-orange-500" },
  { value: "APPROVED", label: "Approved", color: "bg-green-500" },
  { value: "CANCELLED", label: "Cancelled", color: "bg-red-500" },
  { value: "ARCHIVED", label: "Archived", color: "bg-slate-500" },
];

const ARCHIVE_PRESETS = [
  { label: "Completed older than 30 days", days: 30, statuses: ["APPROVED", "CANCELLED"] },
  { label: "Completed older than 60 days", days: 60, statuses: ["APPROVED", "CANCELLED"] },
  { label: "Completed older than 90 days", days: 90, statuses: ["APPROVED", "CANCELLED"] },
  { label: "All archived older than 1 year", days: 365, statuses: ["ARCHIVED"] },
];

export function BulkStatusUpdater({
  onComplete,
  onCancel,
}: BulkStatusUpdaterProps) {
  // Data states
  const [requests, setRequests] = useState<Request[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter states
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [creatorFilter, setCreatorFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<"all" | "30" | "60" | "90">("all");

  // Selection states
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Action states
  const [targetStatus, setTargetStatus] = useState<RequestStatus | null>(null);
  const [updateNote, setUpdateNote] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Processing states
  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);
  const [processResult, setProcessResult] = useState<StatusUpdateResult | null>(null);

  // Fetch requests
  useEffect(() => {
    async function fetchRequests() {
      setIsLoading(true);
      try {
        const response = await fetch("/api/requests");
        if (response.ok) {
          const data = await response.json();
          // Handle both array response and object with requests property
          setRequests(Array.isArray(data) ? data : data.requests || []);
        }
      } catch (error) {
        console.error("Failed to fetch requests:", error);
        toast.error("Failed to load requests");
      } finally {
        setIsLoading(false);
      }
    }

    fetchRequests();
  }, []);

  // Get unique creators for filter
  const creators = useMemo(() => {
    const creatorMap = new Map<string, { id: string; name: string }>();
    requests.forEach((r) => {
      if (!creatorMap.has(r.creator.id)) {
        creatorMap.set(r.creator.id, r.creator);
      }
    });
    return Array.from(creatorMap.values());
  }, [requests]);

  // Filter requests
  const filteredRequests = useMemo(() => {
    return requests.filter((request) => {
      // Status filter
      if (statusFilter !== "all" && request.status !== statusFilter) {
        return false;
      }

      // Search filter
      if (searchQuery) {
        const search = searchQuery.toLowerCase();
        if (
          !request.title.toLowerCase().includes(search) &&
          !request.creator.name.toLowerCase().includes(search)
        ) {
          return false;
        }
      }

      // Creator filter
      if (creatorFilter !== "all" && request.creator.id !== creatorFilter) {
        return false;
      }

      // Date filter
      if (dateFilter !== "all") {
        const days = parseInt(dateFilter);
        const cutoff = subDays(new Date(), days);
        const updatedAt = new Date(request.updatedAt);
        if (isAfter(updatedAt, cutoff)) {
          return false;
        }
      }

      return true;
    });
  }, [requests, statusFilter, searchQuery, creatorFilter, dateFilter]);

  // Stats
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    requests.forEach((r) => {
      counts[r.status] = (counts[r.status] || 0) + 1;
    });
    return counts;
  }, [requests]);

  // Toggle selection
  const toggleSelection = useCallback((requestId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(requestId)) {
        next.delete(requestId);
      } else {
        next.add(requestId);
      }
      return next;
    });
  }, []);

  // Select all filtered
  const selectAllFiltered = useCallback(() => {
    setSelectedIds(new Set(filteredRequests.map((r) => r.id)));
  }, [filteredRequests]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Select by archive preset
  const selectByArchivePreset = useCallback((days: number, statuses: string[]) => {
    const cutoff = subDays(new Date(), days);
    const matching = requests.filter((r) => {
      const updatedAt = new Date(r.updatedAt);
      return statuses.includes(r.status) && isBefore(updatedAt, cutoff);
    });
    setSelectedIds(new Set(matching.map((r) => r.id)));
    toast.success(`Selected ${matching.length} matching request(s)`);
  }, [requests]);

  // Process status update
  const processUpdate = useCallback(async () => {
    if (selectedIds.size === 0 || !targetStatus) {
      toast.error("Please select requests and target status");
      return;
    }

    setShowConfirmDialog(false);
    setIsProcessing(true);
    setProcessProgress(0);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProcessProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch("/api/requests/bulk-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "changeStatus",
          requestIds: Array.from(selectedIds),
          status: targetStatus,
          note: updateNote || undefined,
        }),
      });

      clearInterval(progressInterval);
      setProcessProgress(100);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update status");
      }

      const result: StatusUpdateResult = {
        success: data.success,
        affected: data.affected,
        total: selectedIds.size,
        errors: data.errors,
      };

      setProcessResult(result);

      // Update local state
      setRequests((prev) =>
        prev.map((r) =>
          selectedIds.has(r.id) ? { ...r, status: targetStatus } : r
        )
      );
      setSelectedIds(new Set());

      if (data.affected > 0) {
        toast.success(`Updated ${data.affected} request(s) to ${targetStatus}`);
      }

      onComplete?.(result);
    } catch (error) {
      console.error("Failed to update status:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update status");
    } finally {
      setIsProcessing(false);
    }
  }, [selectedIds, targetStatus, updateNote, onComplete]);

  // Quick archive action
  const archiveSelected = useCallback(async () => {
    setTargetStatus("ARCHIVED");
    setShowConfirmDialog(true);
  }, []);

  // Get status badge color
  const getStatusColor = (status: string) => {
    const option = STATUS_OPTIONS.find((o) => o.value === status);
    return option?.color || "bg-gray-500";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="mt-2 text-muted-foreground">Loading requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Processing indicator */}
      {isProcessing && (
        <ProgressTracker
          title="Updating Status"
          status="in_progress"
          progress={processProgress}
          processedItems={Math.round((processProgress / 100) * selectedIds.size)}
          totalItems={selectedIds.size}
          successCount={processResult?.affected || 0}
          failedCount={0}
        />
      )}

      {/* Status overview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Status Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={statusFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("all")}
            >
              All ({requests.length})
            </Button>
            {STATUS_OPTIONS.map((status) => {
              const count = statusCounts[status.value] || 0;
              if (count === 0) return null;
              return (
                <Button
                  key={status.value}
                  variant={statusFilter === status.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(status.value)}
                  className="gap-2"
                >
                  <span className={cn("h-2 w-2 rounded-full", status.color)} />
                  {status.label} ({count})
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Quick archive presets */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Archive className="h-4 w-4" />
                Quick Archive
              </CardTitle>
              <CardDescription>
                Select completed requests by age for bulk archiving
              </CardDescription>
            </div>
            {/* Operation Templates */}
            <OperationTemplates
              operationType="status_update"
              currentConfig={{
                statusFilter,
                creatorFilter,
                dateFilter,
                targetStatus,
              }}
              onLoadTemplate={(config) => {
                if (config.statusFilter) setStatusFilter(config.statusFilter as typeof statusFilter);
                if (config.creatorFilter) setCreatorFilter(config.creatorFilter as string);
                if (config.dateFilter) setDateFilter(config.dateFilter as typeof dateFilter);
                if (config.targetStatus) setTargetStatus(config.targetStatus as RequestStatus);
              }}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {ARCHIVE_PRESETS.map((preset, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => selectByArchivePreset(preset.days, preset.statuses)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Smart selection presets */}
      <SmartSelectionPresets
        items={filteredRequests}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        getItemId={(r) => r.id}
        getItemDueDate={(r) => r.dueDate ? new Date(r.dueDate) : null}
        getItemPriority={(r) => r.urgency}
        getItemStatus={(r) => r.status}
        getItemCreatorId={(r) => r.creator.id}
        creators={creators}
      />

      {/* Filters and search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search requests..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={creatorFilter} onValueChange={setCreatorFilter}>
              <SelectTrigger className="w-[180px]">
                <User className="mr-2 h-4 w-4" />
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

            <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as typeof dateFilter)}>
              <SelectTrigger className="w-[180px]">
                <Calendar className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Any Time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any Time</SelectItem>
                <SelectItem value="30">Older than 30 days</SelectItem>
                <SelectItem value="60">Older than 60 days</SelectItem>
                <SelectItem value="90">Older than 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Selection actions */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={selectAllFiltered}>
                Select All ({filteredRequests.length})
              </Button>
              {selectedIds.size > 0 && (
                <Button variant="outline" size="sm" onClick={clearSelection}>
                  Clear Selection
                </Button>
              )}
              {selectedIds.size > 0 && (
                <span className="text-sm font-medium text-primary">
                  {selectedIds.size} selected
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Request list */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px]">
            <div className="divide-y">
              {filteredRequests.map((request) => {
                const isSelected = selectedIds.has(request.id);

                return (
                  <div
                    key={request.id}
                    onClick={() => toggleSelection(request.id)}
                    className={cn(
                      "flex items-center gap-4 p-4 cursor-pointer transition-colors",
                      isSelected ? "bg-primary/10" : "hover:bg-muted/50"
                    )}
                  >
                    <Checkbox checked={isSelected} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{request.title}</p>
                        <Badge
                          className={cn(
                            "text-white text-xs",
                            getStatusColor(request.status)
                          )}
                        >
                          {request.status.replace("_", " ")}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {request.creator.name}
                        </span>
                        {request.dueDate && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Due {format(new Date(request.dueDate), "MMM d")}
                          </span>
                        )}
                        <span>
                          Updated {format(new Date(request.updatedAt), "MMM d, yyyy")}
                        </span>
                      </div>
                    </div>

                    {request._count && (
                      <div className="text-sm text-muted-foreground">
                        {request._count.uploads} uploads
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredRequests.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  No requests match your filters
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Action panel */}
      {selectedIds.size > 0 && (
        <Card className="sticky bottom-4 shadow-lg">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-1">
                <p className="font-medium">
                  {selectedIds.size} request(s) selected
                </p>
                <p className="text-sm text-muted-foreground">
                  Select a new status to apply to all selected requests
                </p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Select
                  value={targetStatus || ""}
                  onValueChange={(v) => setTargetStatus(v as RequestStatus)}
                >
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue placeholder="Select new status..." />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        <div className="flex items-center gap-2">
                          <span className={cn("h-2 w-2 rounded-full", status.color)} />
                          {status.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  onClick={() => setShowConfirmDialog(true)}
                  disabled={!targetStatus || isProcessing}
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Apply
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Quick actions */}
            <div className="flex gap-2 mt-4 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={archiveSelected}
                className="text-slate-600"
              >
                <Archive className="mr-2 h-4 w-4" />
                Archive Selected
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirm dialog */}
      <ConfirmDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        title="Confirm Status Change"
        description={`You are about to change the status of ${selectedIds.size} request(s) to "${targetStatus}".`}
        confirmLabel="Update Status"
        variant={targetStatus === "ARCHIVED" || targetStatus === "CANCELLED" ? "warning" : "default"}
        onConfirm={processUpdate}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
            <span className="text-muted-foreground">Current selections</span>
            <ArrowRight className="h-4 w-4" />
            <Badge className={cn("text-white", getStatusColor(targetStatus || ""))}>
              {targetStatus?.replace("_", " ")}
            </Badge>
          </div>

          <div className="space-y-2">
            <Label htmlFor="updateNote">Note (optional)</Label>
            <Textarea
              id="updateNote"
              value={updateNote}
              onChange={(e) => setUpdateNote(e.target.value)}
              placeholder="Add a note about this status change..."
              rows={2}
            />
          </div>

          {(targetStatus === "ARCHIVED" || targetStatus === "CANCELLED") && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-300">
                  This action may affect creator access
                </p>
                <p className="text-amber-600 dark:text-amber-400">
                  {targetStatus === "ARCHIVED"
                    ? "Archived requests will be hidden from the main view."
                    : "Cancelled requests will notify the creators."}
                </p>
              </div>
            </div>
          )}
        </div>
      </ConfirmDialog>
    </div>
  );
}

export default BulkStatusUpdater;
