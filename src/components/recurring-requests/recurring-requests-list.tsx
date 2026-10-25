"use client";

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Repeat,
  Plus,
  Search,
  Play,
  Pause,
  Edit,
  Trash2,
  MoreHorizontal,
  Clock,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { formatStamp } from "@/components/title-wall/time";

type RecurringRow = RecurringRequest & {
  templateIds?: string[];
  templates?: { id: string; name: string; description?: string | null }[];
};

// TYPES

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

// STATUS BADGE

function StatusBadge({ isActive, nextRunAt }: { isActive: boolean; nextRunAt?: Date | null }) {
  if (!isActive) {
    return (
      <Badge variant="outline">
        <Pause aria-hidden="true" />
        Paused
      </Badge>
    );
  }

  if (!nextRunAt) {
    return <Badge variant="outline">Finished</Badge>;
  }

  return <Badge>Running</Badge>;
}

// FREQUENCY BADGE

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
    label += ` (day ${dayOfMonth})`;
  }

  return (
    <Badge variant="outline" className="text-xs">
      <Repeat className="h-3 w-3 mr-1" />
      {label}
    </Badge>
  );
}

// EXECUTION HISTORY DIALOG

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
            <History className="h-5 w-5 text-ink" />
            Run history
          </DialogTitle>
          <DialogDescription>
            The last ten runs of {recurringRequest.name}
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
              <p>No runs yet</p>
              <p className="text-sm">It runs for the first time on its start date.</p>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {executions.map((execution) => (
                <li
                  key={execution.id}
                  className="flex items-center justify-between gap-4 rounded-[var(--tw-r-ctl)] bg-tile px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {execution.status === "COMPLETED" && (
                      <CheckCircle2 className="size-5 shrink-0 text-icon" aria-hidden="true" />
                    )}
                    {execution.status === "PARTIAL" && (
                      <AlertCircle className="size-5 shrink-0 text-late" aria-hidden="true" />
                    )}
                    {execution.status === "FAILED" && (
                      <XCircle className="size-5 shrink-0 text-late" aria-hidden="true" />
                    )}
                    {(execution.status === "PENDING" || execution.status === "SKIPPED") && (
                      <Clock className="size-5 shrink-0 text-icon" aria-hidden="true" />
                    )}
                    {execution.status === "RUNNING" && (
                      <RefreshCw className="size-5 shrink-0 animate-spin text-icon motion-reduce:animate-none" aria-hidden="true" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium tabular-nums">
                        {formatStamp(execution.scheduledFor)}
                      </p>
                      <p className="text-[13px] text-ink-2">
                        {EXECUTION_STATUS_LABELS[execution.status]}
                        {execution.executedAt && (
                          <> · {formatDistanceToNow(new Date(execution.executedAt), { addSuffix: true })}</>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-medium tabular-nums">
                      {execution.successCount} {execution.successCount === 1 ? "request" : "requests"}
                    </p>
                    <p className="text-[13px] text-ink-2 tabular-nums">
                      {execution.creatorCount} {execution.creatorCount === 1 ? "creator" : "creators"}
                      {execution.failedCount > 0 && <span className="text-late"> · {execution.failedCount} failed</span>}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// RECURRING REQUEST CARD

function RecurringRequestCard({
  recurringRequest,
  onEdit,
  onToggle,
  onRunNow,
  onDelete,
  onViewHistory,
}: {
  recurringRequest: RecurringRow;
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
  const templates =
    recurringRequest.templates && recurringRequest.templates.length > 0
      ? recurringRequest.templates
      : recurringRequest.template
        ? [recurringRequest.template]
        : [];
  const perRun = templates.length * totalTargets;

  return (
    <article
      aria-labelledby={`rr-${recurringRequest.id}`}
      className={cn(
        "rounded-[var(--tw-r-tile)] p-4 transition-colors duration-200 sm:p-5",
        recurringRequest.isActive ? "bg-tile" : "bg-tile-dim"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 id={`rr-${recurringRequest.id}`} className="min-w-0 truncate text-[17px] font-semibold">
              {recurringRequest.name}
            </h3>
            <StatusBadge
              isActive={recurringRequest.isActive}
              nextRunAt={recurringRequest.nextRunAt ? new Date(recurringRequest.nextRunAt) : null}
            />
          </div>
          <p className="mt-1 line-clamp-1 text-sm text-ink-2">
            {recurringRequest.description || `Titles read “${settings.titleTemplate}”`}
          </p>

          <div className="mt-3">
            <p className="sr-only">Templates sent each run</p>
            {templates.length === 0 ? (
              <p className="text-sm text-late">Its template was deleted. Edit the schedule to pick another.</p>
            ) : (
              <ol className="flex flex-wrap gap-1.5" aria-label="Templates sent each run">
                {templates.map((t) => (
                  <li
                    key={t.id}
                    className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-[var(--tw-r-chip)] bg-tile-hi px-2.5 text-[13px] font-medium"
                  >
                    <FileText className="size-3.5 shrink-0 text-icon" aria-hidden="true" />
                    <span className="truncate">{t.name}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-2 tabular-nums">
            <FrequencyBadge
              frequency={recurringRequest.frequency}
              dayOfWeek={recurringRequest.dayOfWeek}
              dayOfMonth={recurringRequest.dayOfMonth}
            />
            <span>
              {[
                `${totalTargets} ${totalTargets === 1 ? "creator" : "creators"}`,
                templates.length > 0 && totalTargets > 0
                  ? `${perRun} ${perRun === 1 ? "request" : "requests"} a run`
                  : null,
                recurringRequest.lastRunAt
                  ? `last ran ${formatDistanceToNow(new Date(recurringRequest.lastRunAt), { addSuffix: true })}, ${recurringRequest.runCount} ${recurringRequest.runCount === 1 ? "run" : "runs"} so far`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </p>
        </div>

        <div className="flex shrink-0 items-start gap-3">
          <div className="hidden text-right sm:block">
            {recurringRequest.nextRunAt && recurringRequest.isActive ? (
              <>
                <p className="text-[13px] text-ink-2">Next run</p>
                <p className="text-sm font-medium tabular-nums">
                  {formatStamp(recurringRequest.nextRunAt)}
                </p>
              </>
            ) : (
              <>
                <p className="text-[13px] text-ink-2">Runs so far</p>
                <p className="text-sm font-medium tabular-nums">{recurringRequest.runCount}</p>
              </>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button aria-label={`More for ${recurringRequest.name}`} variant="ghost" size="icon-sm">
                <MoreHorizontal className="size-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="size-4" aria-hidden="true" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onViewHistory}>
                <History className="size-4" aria-hidden="true" />
                Run history
              </DropdownMenuItem>
              {recurringRequest.isActive && (
                <DropdownMenuItem onClick={onRunNow}>
                  <Play className="size-4" aria-hidden="true" />
                  Run now
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onToggle}>
                {recurringRequest.isActive ? (
                  <>
                    <Pause className="size-4" aria-hidden="true" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="size-4" aria-hidden="true" />
                    Resume
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDelete}
                className="text-late focus:text-late focus:bg-late/10"
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {recurringRequest.nextRunAt && recurringRequest.isActive && (
        <p className="mt-3 text-[13px] text-ink-2 tabular-nums sm:hidden">
          Next run {formatStamp(recurringRequest.nextRunAt)}
        </p>
      )}
    </article>
  );
}

// MAIN COMPONENT

export function RecurringRequestsList({
  templates,
  creators,
  creatorGroups,
}: RecurringRequestsListProps) {
  const [recurringRequests, setRecurringRequests] = React.useState<RecurringRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"all" | "active" | "paused">("all");
  const [frequencyFilter, setFrequencyFilter] = React.useState<RecurrenceFrequency | "all">("all");

  // Modal state
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingRequest, setEditingRequest] = React.useState<RecurringRow | null>(null);
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
        rr.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rr.templates?.some((t) => t.name.toLowerCase().includes(searchQuery.toLowerCase()));

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
  const handleEdit = (rr: RecurringRow) => {
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
          `Sent ${result.successCount} request${result.successCount !== 1 ? "s" : ""} to ${result.creatorCount} creator${result.creatorCount !== 1 ? "s" : ""}`
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

  const handleSaved = () => {
    // Refetch so the card shows its resolved templates and creators
    setEditingRequest(null);
    fetchRecurringRequests();
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
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold leading-tight tracking-[-0.01em] sm:text-[26px]">Recurring requests</h1>
          <p className="mt-1 max-w-[70ch] text-[15px]">
            {recurringRequests.length === 0
              ? "A recurring request sends one or more templates on a schedule, say a content set and a story set on the 1st, so you never have to remember."
              : `${activeCount} of ${recurringRequests.length} ${recurringRequests.length === 1 ? "schedule is" : "schedules are"} running. ${
                  upcomingThisWeek ? `${upcomingThisWeek} ${upcomingThisWeek === 1 ? "goes" : "go"} out this week` : "Nothing goes out this week"
                }; ${totalRuns} ${totalRuns === 1 ? "run" : "runs"} so far.`}
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingRequest(null);
            setIsModalOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          New schedule
        </Button>
      </header>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-icon" aria-hidden="true" />
          <Input
            aria-label="Find a schedule"
            placeholder="Find a schedule"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
        >
          <SelectTrigger className="w-full sm:w-[190px]" aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Running and paused</SelectItem>
            <SelectItem value="active">Running</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={frequencyFilter}
          onValueChange={(v) => setFrequencyFilter(v as typeof frequencyFilter)}
        >
          <SelectTrigger className="w-full sm:w-[170px]" aria-label="Frequency">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any frequency</SelectItem>
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
        <div className="rounded-[var(--tw-r-tile)] bg-tile-dim px-6 py-8">
          <h3 className="text-[17px] font-semibold">
            {searchQuery || statusFilter !== "all" || frequencyFilter !== "all"
              ? "No schedule matches"
              : "No schedules yet"}
          </h3>
          <p className="mt-1 max-w-[60ch] text-sm text-ink-2">
            {searchQuery || statusFilter !== "all" || frequencyFilter !== "all"
              ? "Clear the search or the filters to see every schedule."
              : "Pick the templates, the creators and how often. Each run sends a fresh request per template with its own due date, and you can pause it at any time."}
          </p>
          {!searchQuery && statusFilter === "all" && frequencyFilter === "all" && (
            <Button
              onClick={() => {
                setEditingRequest(null);
                setIsModalOpen(true);
              }}
              variant="outline"
              className="mt-4"
            >
              <Plus className="h-4 w-4 mr-2" />
              Make a schedule
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
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
