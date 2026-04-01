"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  History,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Undo2,
  RefreshCw,
  Users,
  FileCheck,
  Bell,
  Archive,
  User,
  Calendar,
  Loader2,
  Download,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import {
  type BulkOperationType,
  type BulkOperationStatus,
  type BulkOperationHistoryEntry,
  HISTORY_STORAGE_KEY,
  MAX_HISTORY_ENTRIES,
  getOperationTypeLabel,
  isUndoWindowValid,
  getRemainingUndoTime,
} from "@/lib/bulk-operations";

interface OperationHistoryProps {
  className?: string;
}

export function OperationHistory({ className }: OperationHistoryProps) {
  const [history, setHistory] = useState<BulkOperationHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<BulkOperationType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<BulkOperationStatus | "all">("all");
  const [expandedOperations, setExpandedOperations] = useState<Set<string>>(new Set());
  const [selectedOperation, setSelectedOperation] = useState<BulkOperationHistoryEntry | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  // Fetch history on mount
  useEffect(() => {
    async function fetchHistory() {
      setIsLoading(true);
      try {
        // Try to fetch from API first
        const response = await fetch("/api/bulk-operations/history");
        if (response.ok) {
          const data = await response.json();
          setHistory(data.history || []);
        } else {
          // Fall back to local storage
          const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
          if (stored) {
            setHistory(JSON.parse(stored));
          }
        }
      } catch (error) {
        // Fall back to local storage
        try {
          const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
          if (stored) {
            setHistory(JSON.parse(stored));
          }
        } catch {
          console.error("Failed to load history:", error);
        }
      } finally {
        setIsLoading(false);
      }
    }

    fetchHistory();
  }, []);

  // Filter history
  const filteredHistory = useMemo(() => {
    return history.filter((entry) => {
      // Type filter
      if (typeFilter !== "all" && entry.type !== typeFilter) {
        return false;
      }

      // Status filter
      if (statusFilter !== "all" && entry.status !== statusFilter) {
        return false;
      }

      // Search filter
      if (searchQuery) {
        const search = searchQuery.toLowerCase();
        const typeLabel = getOperationTypeLabel(entry.type).toLowerCase();
        const executorName = entry.executedBy?.name?.toLowerCase() || "";

        if (!typeLabel.includes(search) && !executorName.includes(search)) {
          return false;
        }
      }

      return true;
    });
  }, [history, typeFilter, statusFilter, searchQuery]);

  // Toggle expanded operation
  const toggleExpanded = (operationId: string) => {
    setExpandedOperations((prev) => {
      const next = new Set(prev);
      if (next.has(operationId)) {
        next.delete(operationId);
      } else {
        next.add(operationId);
      }
      return next;
    });
  };

  // Open details dialog
  const openDetails = (operation: BulkOperationHistoryEntry) => {
    setSelectedOperation(operation);
    setShowDetailsDialog(true);
  };

  // Get status icon
  const getStatusIcon = (status: BulkOperationStatus) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "partially_completed":
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case "rolled_back":
        return <Undo2 className="h-4 w-4 text-gray-500" />;
      case "in_progress":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  // Get status badge variant
  const getStatusBadgeVariant = (status: BulkOperationStatus): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "completed":
        return "default";
      case "failed":
        return "destructive";
      case "partially_completed":
        return "secondary";
      default:
        return "outline";
    }
  };

  // Get type icon
  const getTypeIcon = (type: BulkOperationType) => {
    switch (type) {
      case "request_create":
        return <Users className="h-4 w-4" />;
      case "upload_review":
        return <FileCheck className="h-4 w-4" />;
      case "status_update":
        return <RefreshCw className="h-4 w-4" />;
      case "reminder_send":
        return <Bell className="h-4 w-4" />;
      case "archive":
        return <Archive className="h-4 w-4" />;
      default:
        return <History className="h-4 w-4" />;
    }
  };

  // Format duration
  const formatDuration = (ms?: number): string => {
    if (!ms) return "-";
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  // Export history as CSV
  const exportHistory = useCallback(() => {
    const headers = ["Date", "Type", "Status", "Total Items", "Success", "Failed", "Duration", "Executed By"];
    const rows = filteredHistory.map((entry) => [
      format(parseISO(entry.startedAt), "yyyy-MM-dd HH:mm:ss"),
      getOperationTypeLabel(entry.type),
      entry.status,
      entry.totalItems,
      entry.successCount,
      entry.failedCount,
      formatDuration(entry.durationMs),
      entry.executedBy?.name || "Unknown",
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bulk-operations-history-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success("History exported successfully");
  }, [filteredHistory]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="mt-2 text-muted-foreground">Loading history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search operations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Type filter */}
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
              <SelectTrigger className="w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="request_create">Request Creation</SelectItem>
                <SelectItem value="upload_review">Upload Review</SelectItem>
                <SelectItem value="status_update">Status Update</SelectItem>
                <SelectItem value="reminder_send">Send Reminders</SelectItem>
                <SelectItem value="archive">Archive</SelectItem>
              </SelectContent>
            </Select>

            {/* Status filter */}
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="partially_completed">Partial</SelectItem>
                <SelectItem value="rolled_back">Rolled Back</SelectItem>
              </SelectContent>
            </Select>

            {/* Export button */}
            <Button variant="outline" onClick={exportHistory} disabled={filteredHistory.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* History list */}
      {filteredHistory.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No operations found</p>
              {(typeFilter !== "all" || statusFilter !== "all" || searchQuery) && (
                <p className="text-sm mt-1">Try adjusting your filters</p>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <div className="divide-y">
                {filteredHistory.map((entry) => {
                  const isExpanded = expandedOperations.has(entry.id);
                  const canStillUndo = entry.canUndo && entry.undoExpiresAt && isUndoWindowValid(entry.undoExpiresAt);
                  const undoTimeLeft = entry.undoExpiresAt ? getRemainingUndoTime(entry.undoExpiresAt) : 0;

                  return (
                    <Collapsible
                      key={entry.id}
                      open={isExpanded}
                      onOpenChange={() => toggleExpanded(entry.id)}
                    >
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                          <Button variant="ghost" size="icon-sm" className="h-6 w-6">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>

                          {/* Status icon */}
                          {getStatusIcon(entry.status)}

                          {/* Type icon */}
                          <div className="p-2 bg-muted rounded">
                            {getTypeIcon(entry.type)}
                          </div>

                          {/* Details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">
                                {getOperationTypeLabel(entry.type)}
                              </p>
                              <Badge variant={getStatusBadgeVariant(entry.status)}>
                                {entry.status.replace("_", " ")}
                              </Badge>
                              {canStillUndo && (
                                <Badge variant="outline" className="text-amber-600 border-amber-300">
                                  <Undo2 className="mr-1 h-3 w-3" />
                                  {Math.floor(undoTimeLeft / 60)}:{(undoTimeLeft % 60).toString().padStart(2, "0")}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDistanceToNow(parseISO(entry.startedAt), { addSuffix: true })}
                              </span>
                              <span>
                                {entry.successCount}/{entry.totalItems} succeeded
                              </span>
                              {entry.failedCount > 0 && (
                                <span className="text-red-500">
                                  {entry.failedCount} failed
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {entry.executedBy?.name || "Unknown"}
                              </span>
                            </div>
                          </div>

                          {/* Duration */}
                          <div className="text-sm text-muted-foreground">
                            {formatDuration(entry.durationMs)}
                          </div>

                          {/* View details button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDetails(entry);
                            }}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className="px-4 pb-4 pl-16">
                          <Card className="bg-muted/50">
                            <CardContent className="p-4">
                              {/* Affected items summary */}
                              <div className="space-y-3">
                                <h4 className="text-sm font-medium">Affected Items</h4>

                                {entry.affectedItems.length === 0 ? (
                                  <p className="text-sm text-muted-foreground">
                                    No detailed item information available
                                  </p>
                                ) : (
                                  <div className="max-h-48 overflow-y-auto">
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>Item</TableHead>
                                          <TableHead>Change</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {entry.affectedItems.slice(0, 10).map((item) => (
                                          <TableRow key={item.id}>
                                            <TableCell className="font-medium">
                                              {item.name}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                              {typeof item.previousState === "string" && typeof item.newState === "string" ? (
                                                <span>
                                                  {item.previousState} &rarr; {item.newState}
                                                </span>
                                              ) : (
                                                <span>Modified</span>
                                              )}
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                    {entry.affectedItems.length > 10 && (
                                      <p className="text-sm text-muted-foreground mt-2 text-center">
                                        ...and {entry.affectedItems.length - 10} more items
                                      </p>
                                    )}
                                  </div>
                                )}

                                {/* Errors */}
                                {entry.errors && entry.errors.length > 0 && (
                                  <div className="mt-4">
                                    <h4 className="text-sm font-medium text-red-600 mb-2">Errors</h4>
                                    <ul className="text-sm text-red-500 space-y-1 list-disc list-inside">
                                      {entry.errors.slice(0, 5).map((error, i) => (
                                        <li key={i}>{error}</li>
                                      ))}
                                      {entry.errors.length > 5 && (
                                        <li className="text-muted-foreground">
                                          ...and {entry.errors.length - 5} more errors
                                        </li>
                                      )}
                                    </ul>
                                  </div>
                                )}

                                {/* Metadata */}
                                {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                                  <div className="mt-4">
                                    <h4 className="text-sm font-medium mb-2">Additional Details</h4>
                                    <pre className="text-xs bg-background p-2 rounded overflow-auto max-h-24">
                                      {JSON.stringify(entry.metadata, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedOperation && getTypeIcon(selectedOperation.type)}
              Operation Details
            </DialogTitle>
            <DialogDescription>
              Complete details of this bulk operation
            </DialogDescription>
          </DialogHeader>

          {selectedOperation && (
            <ScrollArea className="max-h-[50vh]">
              <div className="space-y-6">
                {/* Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold">{selectedOperation.totalItems}</p>
                      <p className="text-sm text-muted-foreground">Total Items</p>
                    </CardContent>
                  </Card>
                  <Card className="border-green-200 dark:border-green-800">
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-green-600">{selectedOperation.successCount}</p>
                      <p className="text-sm text-muted-foreground">Succeeded</p>
                    </CardContent>
                  </Card>
                  <Card className="border-red-200 dark:border-red-800">
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-red-600">{selectedOperation.failedCount}</p>
                      <p className="text-sm text-muted-foreground">Failed</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold">{formatDuration(selectedOperation.durationMs)}</p>
                      <p className="text-sm text-muted-foreground">Duration</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Details */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Operation Info</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <dl className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <dt className="text-muted-foreground">Operation ID</dt>
                        <dd className="font-mono">{selectedOperation.operationId}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Type</dt>
                        <dd>{getOperationTypeLabel(selectedOperation.type)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Status</dt>
                        <dd className="flex items-center gap-2">
                          {getStatusIcon(selectedOperation.status)}
                          {selectedOperation.status}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Started</dt>
                        <dd>{format(parseISO(selectedOperation.startedAt), "PPpp")}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Completed</dt>
                        <dd>
                          {selectedOperation.completedAt
                            ? format(parseISO(selectedOperation.completedAt), "PPpp")
                            : "-"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Executed By</dt>
                        <dd>{selectedOperation.executedBy?.name || "Unknown"}</dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>

                {/* Affected Items */}
                {selectedOperation.affectedItems.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">
                        Affected Items ({selectedOperation.affectedItems.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Previous State</TableHead>
                            <TableHead>New State</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedOperation.affectedItems.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-mono text-xs">{item.id.slice(0, 8)}...</TableCell>
                              <TableCell>{item.name}</TableCell>
                              <TableCell className="text-muted-foreground">
                                {typeof item.previousState === "string"
                                  ? item.previousState
                                  : JSON.stringify(item.previousState)}
                              </TableCell>
                              <TableCell>
                                {typeof item.newState === "string"
                                  ? item.newState
                                  : JSON.stringify(item.newState)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}

                {/* Errors */}
                {selectedOperation.errors && selectedOperation.errors.length > 0 && (
                  <Card className="border-red-200 dark:border-red-800">
                    <CardHeader>
                      <CardTitle className="text-base text-red-600">
                        Errors ({selectedOperation.errors.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2 text-sm text-red-600">
                        {selectedOperation.errors.map((error, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                            {error}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>
            </ScrollArea>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default OperationHistory;
