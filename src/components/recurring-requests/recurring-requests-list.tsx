"use client";

import * as React from "react";
import { format, formatDistanceToNow, isPast } from "date-fns";
import {
  Repeat,
  Plus,
  Search,
  Filter,
  Play,
  Pause,
  Edit,
  Trash2,
  MoreHorizontal,
  Clock,
  Users,
  FileText,
  CalendarDays,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronRight,
  Zap,
  RefreshCw,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  RecurringRequest,
  RecurrenceFrequency,
  RecurringRequestExecution,
  FREQUENCY_LABELS,
  DAY_OF_WEEK_LABELS,
  EXECUTION_STATUS_LABELS,
  type RequestSettings,
} from "@/types/recurring-requests";
import { RecurringRequestModal } from "./recurring-request-modal";

// ============================================
// TYPES
// ============================================

interface Template {
  id: string;
  name: string;
  description?: string | null;
}

interface Creator {
  id: string;
  name: string;
  email: string;
}

interface CreatorGroup {
  id: string;
  name: string;
  memberCount: number;
}

interface RecurringRequestsListProps {
  templates: Template[];
  creators: Creator[];
  creatorGroups: CreatorGroup[];
}

// ============================================
// STATUS BADGE
// ============================================

function StatusBadge({ isActive, nextRunAt }: { isActive: boolean; nextRunAt?: Date | null }) {
  if (!isActive) {
    return (
      <Badge variant="outline" className="bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
        <Pause className="h-3 w-3 mr-1" />
        Paused
      </Badge>
    );
  }

  if (!nextRunAt) {
    return (
      <Badge variant="outline" className="bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
        Completed
      </Badge>
    );
  }

  return (
    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
      <Play className="h-3 w-3 mr-1" />
      Active
    </Badge>
  );
}

// ============================================
// FREQUENCY BADGE
// ============================================

function FrequencyBadge({ frequency, dayOfWeek, dayOfMonth }: {
  frequency: RecurrenceFrequency;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
}) {
  let label = FREQUENCY_LABELS[frequency];

  if ((frequency === "WEEKLY" || frequency === "BIWEEKLY") && dayOfWeek !== null && dayOfWeek !== undefined) {
    label += ` (${DAY_OF_WEEK_LABELS[dayOfWeek].slice(0, 3)})`;
  }

  if ((frequency === "MONTHLY" || frequency === "QUARTERLY") && dayOfMonth !== null && dayOfMonth !== undefined) {
    label += ` (Day ${dayOfMonth})`;
  }

  return (
    <Badge variant="outline" className="text-xs">
      <Repeat className="h-3 w-3 mr-1" />
      {label}
    </Badge>
  );
}

// ============================================
// EXECUTION HISTORY DIALOG
// ============================================

function ExecutionHistoryDialog({
  open,
  onOpenChange,
  recurringRequest,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recurringRequest: RecurringRequest | null;
}) {
  const [executions, setExecutions] = React.useState<RecurringRequestExecution[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (open && recurringRequest) {
      fetchExecutions();
    }
  }, [open, recurringRequest?.id]);

  async function fetchExecutions() {
    if (!recurringRequest) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/recurring-requests/${recurringRequest.id}`);
      if (response.ok) {
        const data = await response.json();
        setExecutions(data.executions || []);
      }
    } catch (error) {
      console.error("Error fetching executions:", error);
    } finally {
      setLoading(false);
    }
  }

  if (!recurringRequest) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Execution History
          </DialogTitle>
          <DialogDescription>
            Recent executions for &quot;{recurringRequest.name}&quot;
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : executions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No execution history yet</p>
              <p className="text-sm">This recurring request hasn&apos;t run yet</p>
            </div>
          ) : (
            executions.map((execution) => (
              <div
                key={execution.id}
                className={cn(
                  "flex items-center justify-between p-4 rounded-lg border",
                  execution.status === "COMPLETED" && "bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-800",
                  execution.status === "PARTIAL" && "bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800",
                  execution.status === "FAILED" && "bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-800",
                  execution.status === "PENDING" && "bg-muted/50"
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "h-10 w-10 rounded-lg flex items-center justify-center",
                      execution.status === "COMPLETED" && "bg-green-100 dark:bg-green-900/30",
                      execution.status === "PARTIAL" && "bg-amber-100 dark:bg-amber-900/30",
                      execution.status === "FAILED" && "bg-red-100 dark:bg-red-900/30",
                      execution.status === "PENDING" && "bg-muted"
                    )}
                  >
                    {execution.status === "COMPLETED" && (
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    )}
                    {execution.status === "PARTIAL" && (
                      <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    )}
                    {execution.status === "FAILED" && (
                      <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                    )}
                    {execution.status === "PENDING" && (
                      <Clock className="h-5 w-5 text-muted-foreground" />
                    )}
                    {execution.status === "RUNNING" && (
                      <RefreshCw className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {format(new Date(execution.scheduledFor), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {EXECUTION_STATUS_LABELS[execution.status]}
                      {execution.executedAt && (
                        <> - {formatDistanceToNow(new Date(execution.executedAt), { addSuffix: true })}</>
                      )}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">
                    {execution.successCount}/{execution.creatorCount} created
                  </p>
                  {execution.failedCount > 0 && (
                    <p className="text-xs text-red-600 dark:text-red-400">
                      {execution.failedCount} failed
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// RECURRING REQUEST CARD
// ============================================

function RecurringRequestCard({
  recurringRequest,
  onEdit,
  onToggle,
  onRunNow,
  onDelete,
  onViewHistory,
}: {
  recurringRequest: RecurringRequest;
  onEdit: () => void;
  onToggle: () => void;
  onRunNow: () => void;
  onDelete: () => void;
  onViewHistory: () => void;
}) {
  const settings = recurringRequest.requestSettings as RequestSettings;
  const totalCreators = recurringRequest.creators?.length || 0;
  const totalFromGroups = recurringRequest.creatorGroups?.reduce(
    (sum, g) => sum + (g.memberCount || 0),
    0
  ) || 0;
  const totalTargets = totalCreators + totalFromGroups;

  return (
    <Card className={cn(
      "transition-all hover:shadow-md",
      !recurringRequest.isActive && "opacity-70"
    )}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div
              className={cn(
                "h-12 w-12 rounded-xl flex items-center justify-center shrink-0",
                recurringRequest.isActive
                  ? "bg-gradient-to-br from-primary to-violet-600 shadow-lg shadow-primary/25"
                  : "bg-muted"
              )}
            >
              <Repeat
                className={cn(
                  "h-6 w-6",
                  recurringRequest.isActive ? "text-white" : "text-muted-foreground"
                )}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold truncate">{recurringRequest.name}</h3>
                <StatusBadge
                  isActive={recurringRequest.isActive}
                  nextRunAt={recurringRequest.nextRunAt ? new Date(recurringRequest.nextRunAt) : null}
                />
              </div>
              <p className="text-sm text-muted-foreground line-clamp-1 mb-3">
                {recurringRequest.description || `Creates "${settings.titleTemplate}" requests`}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <FrequencyBadge
                  frequency={recurringRequest.frequency}
                  dayOfWeek={recurringRequest.dayOfWeek}
                  dayOfMonth={recurringRequest.dayOfMonth}
                />
                <Badge variant="outline" className="text-xs">
                  <Users className="h-3 w-3 mr-1" />
                  {totalTargets} creator{totalTargets !== 1 ? "s" : ""}
                </Badge>
                {recurringRequest.template && (
                  <Badge variant="outline" className="text-xs">
                    <FileText className="h-3 w-3 mr-1" />
                    {recurringRequest.template.name}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-4 shrink-0">
            <div className="text-right hidden sm:block">
              {recurringRequest.nextRunAt ? (
                <>
                  <p className="text-xs text-muted-foreground">Next run</p>
                  <p className="text-sm font-medium">
                    {format(new Date(recurringRequest.nextRunAt), "MMM d")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(recurringRequest.nextRunAt), "h:mm a")}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">Runs completed</p>
                  <p className="text-sm font-medium">{recurringRequest.runCount}</p>
                </>
              )}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={onEdit}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onViewHistory}>
                  <History className="h-4 w-4 mr-2" />
                  View History
                </DropdownMenuItem>
                {recurringRequest.isActive && (
                  <DropdownMenuItem onClick={onRunNow}>
                    <Play className="h-4 w-4 mr-2" />
                    Run Now
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onToggle}>
                  {recurringRequest.isActive ? (
                    <>
                      <Pause className="h-4 w-4 mr-2" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Resume
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-red-600 focus:text-red-600 focus:bg-red-50"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Last run info */}
        {recurringRequest.lastRunAt && (
          <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Last run: {formatDistanceToNow(new Date(recurringRequest.lastRunAt), { addSuffix: true })}
            </span>
            <span className="text-muted-foreground">
              Total runs: {recurringRequest.runCount}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function RecurringRequestsList({
  templates,
  creators,
  creatorGroups,
}: RecurringRequestsListProps) {
  const [recurringRequests, setRecurringRequests] = React.useState<RecurringRequest[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"all" | "active" | "paused">("all");
  const [frequencyFilter, setFrequencyFilter] = React.useState<RecurrenceFrequency | "all">("all");

  // Modal state
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingRequest, setEditingRequest] = React.useState<RecurringRequest | null>(null);
  const [historyRequest, setHistoryRequest] = React.useState<RecurringRequest | null>(null);

  // Fetch recurring requests
  const fetchRecurringRequests = React.useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/recurring-requests");
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setRecurringRequests(data);
    } catch (error) {
      console.error("Error fetching recurring requests:", error);
      toast.error("Failed to load recurring requests");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchRecurringRequests();
  }, [fetchRecurringRequests]);

  // Filter
  const filteredRequests = React.useMemo(() => {
    return recurringRequests.filter((rr) => {
      const matchesSearch =
        !searchQuery ||
        rr.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rr.description?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && rr.isActive) ||
        (statusFilter === "paused" && !rr.isActive);

      const matchesFrequency =
        frequencyFilter === "all" || rr.frequency === frequencyFilter;

      return matchesSearch && matchesStatus && matchesFrequency;
    });
  }, [recurringRequests, searchQuery, statusFilter, frequencyFilter]);

  // Handlers
  const handleEdit = (rr: RecurringRequest) => {
    setEditingRequest(rr);
    setIsModalOpen(true);
  };

  const handleToggle = async (rr: RecurringRequest) => {
    try {
      const response = await fetch(`/api/recurring-requests/${rr.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !rr.isActive }),
      });

      if (!response.ok) throw new Error("Failed to update");

      setRecurringRequests((prev) =>
        prev.map((r) =>
          r.id === rr.id ? { ...r, isActive: !rr.isActive } : r
        )
      );

      toast.success(rr.isActive ? "Recurring request paused" : "Recurring request resumed");
    } catch (error) {
      console.error("Error toggling recurring request:", error);
      toast.error("Failed to update recurring request");
    }
  };

  const handleRunNow = async (rr: RecurringRequest) => {
    try {
      const response = await fetch(`/api/recurring-requests/${rr.id}/run`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to run");

      const result = await response.json();

      if (result.success) {
        toast.success(
          `Created ${result.successCount} request${result.successCount !== 1 ? "s" : ""}`
        );
        fetchRecurringRequests();
      } else {
        toast.error("Failed to create requests");
      }
    } catch (error) {
      console.error("Error running recurring request:", error);
      toast.error("Failed to run recurring request");
    }
  };

  const handleDelete = async (rr: RecurringRequest) => {
    if (!confirm(`Are you sure you want to delete "${rr.name}"? This cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/recurring-requests/${rr.id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete");

      setRecurringRequests((prev) => prev.filter((r) => r.id !== rr.id));
      toast.success("Recurring request deleted");
    } catch (error) {
      console.error("Error deleting recurring request:", error);
      toast.error("Failed to delete recurring request");
    }
  };

  const handleSaved = (saved: RecurringRequest) => {
    if (editingRequest) {
      setRecurringRequests((prev) =>
        prev.map((r) => (r.id === saved.id ? saved : r))
      );
    } else {
      setRecurringRequests((prev) => [saved, ...prev]);
    }
    setEditingRequest(null);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRequest(null);
  };

  // Stats
  const activeCount = recurringRequests.filter((r) => r.isActive).length;
  const totalRuns = recurringRequests.reduce((sum, r) => sum + r.runCount, 0);
  const upcomingThisWeek = recurringRequests.filter((r) => {
    if (!r.nextRunAt || !r.isActive) return false;
    const nextRun = new Date(r.nextRunAt);
    const weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    return nextRun <= weekFromNow;
  }).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Repeat className="h-4 w-4" />
            <span>Automated Scheduling</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Recurring Requests</h1>
          <p className="text-muted-foreground mt-1">
            Automatically send content requests to creators on a schedule
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingRequest(null);
            setIsModalOpen(true);
          }}
          className="bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Recurring Request
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Repeat className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{recurringRequests.length}</p>
                <p className="text-sm text-muted-foreground">Total Schedules</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                <Play className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeCount}</p>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <CalendarDays className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{upcomingThisWeek}</p>
                <p className="text-sm text-muted-foreground">This Week</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-violet-500/10 flex items-center justify-center">
                <Zap className="h-6 w-6 text-violet-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalRuns}</p>
                <p className="text-sm text-muted-foreground">Total Runs</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search recurring requests..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={frequencyFilter}
          onValueChange={(v) => setFrequencyFilter(v as typeof frequencyFilter)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Frequencies</SelectItem>
            {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : filteredRequests.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Repeat className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">No recurring requests</h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
              {searchQuery || statusFilter !== "all" || frequencyFilter !== "all"
                ? "No recurring requests match your filters"
                : "Create your first recurring request to automatically send content requests to creators on a schedule"}
            </p>
            {!searchQuery && statusFilter === "all" && frequencyFilter === "all" && (
              <Button
                onClick={() => {
                  setEditingRequest(null);
                  setIsModalOpen(true);
                }}
                className="mt-6"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Recurring Request
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((rr) => (
            <RecurringRequestCard
              key={rr.id}
              recurringRequest={rr}
              onEdit={() => handleEdit(rr)}
              onToggle={() => handleToggle(rr)}
              onRunNow={() => handleRunNow(rr)}
              onDelete={() => handleDelete(rr)}
              onViewHistory={() => setHistoryRequest(rr)}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      <RecurringRequestModal
        open={isModalOpen}
        onOpenChange={handleCloseModal}
        templates={templates}
        creators={creators}
        creatorGroups={creatorGroups}
        editingRequest={editingRequest}
        onSaved={handleSaved}
      />

      {/* Execution History Dialog */}
      <ExecutionHistoryDialog
        open={!!historyRequest}
        onOpenChange={(open) => !open && setHistoryRequest(null)}
        recurringRequest={historyRequest}
      />
    </div>
  );
}

export default RecurringRequestsList;
