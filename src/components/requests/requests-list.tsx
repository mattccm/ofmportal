"use client";

import { useState, useMemo, useCallback, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Search,
  MessageSquare,
  Archive,
  ArchiveRestore,
  Trash2,
  Bell,
  Check,
  X,
  Save,
  Loader2,
  Copy,
  Flag,
  UserPlus,
  FileText,
  MoreHorizontal,
  RefreshCw,
  SlidersHorizontal,
  LayoutGrid,
  Rows3,
  Filter,
  Download,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { endOfDay, isToday, addDays } from "date-fns";
import { toast } from "sonner";
import { groupByPriority, getPriorityConfig, type Priority } from "@/lib/deadline-utils";
import { BulkStatusDialog, type BulkActionType } from "./bulk-status-dialog";
import { CloneRequestDialog } from "./clone-request-dialog";
import { SavedFilters } from "@/components/filters/saved-filters";
import { type FilterGroup, REQUEST_FILTER_FIELDS, createEmptyFilterGroup } from "@/lib/filter-utils";
import { BackToTop } from "@/components/ui/back-to-top";
import { useUnreadComments } from "@/hooks/use-unread-comments";
import {
  Countdown,
  FieldStrip,
  StateLegend,
  TitleCard,
  fieldSummary,
  type FieldSummary,
} from "@/components/title-wall";
import { isFinished } from "./title-wall-map";
import { approveTarget, holdAction } from "./review-actions";

interface Creator {
  id: string;
  name: string;
  email: string;
}

interface RequestTemplate {
  id: string;
  name: string;
}

interface ReadyTarget {
  fieldId: string | null;
  submitted: boolean;
  uploadIds: string[];
}

interface ContentRequest {
  id: string;
  title: string;
  description: string | null;
  status: string;
  urgency: string;
  dueDate: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  updatedAt?: string;
  creator: Creator;
  template: RequestTemplate | null;
  /** Number of completed uploads awaiting a review decision (PENDING). */
  pendingReviewCount?: number;
  /** The field strip, mapped on the server */
  strip?: FieldSummary[];
  /** What "Approve ready" acts on */
  readyTargets?: ReadyTarget[];
  _count: {
    uploads: number;
    comments: number;
  };
}

interface SavedFilter {
  id: string;
  name: string;
  filters: {
    status?: string;
    urgency?: string;
    creatorId?: string;
    quickFilter?: string;
    search?: string;
  };
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface RequestsListProps {
  initialRequests: ContentRequest[];
  creators: Creator[];
  currentUserId: string;
  teamMembers?: TeamMember[];
  /** True when the server-side fetch failed, so the client shows an error + retry. */
  initialError?: boolean;
}

// ----------------------------------------------------------------- views

type ViewId = "ready" | "overdue" | "week" | "waiting" | "finished" | "drafts" | "all";

const ACTIVE = ["PENDING", "IN_PROGRESS", "SUBMITTED", "UNDER_REVIEW", "NEEDS_REVISION"];

function readyCount(r: ContentRequest) {
  return (r.strip ?? []).filter((f) => f.state === "ready").length;
}
function isActive(r: ContentRequest) {
  return ACTIVE.includes(r.status);
}
function isOverdue(r: ContentRequest, now: Date) {
  return isActive(r) && !!r.dueDate && new Date(r.dueDate) < now;
}
function isReady(r: ContentRequest) {
  return !isFinished(r.status) && r.status !== "DRAFT" && (readyCount(r) > 0 || (r.pendingReviewCount ?? 0) > 0);
}

const VIEWS: { id: ViewId; label: string; test: (r: ContentRequest, now: Date) => boolean }[] = [
  { id: "ready", label: "Ready to review", test: (r) => isReady(r) },
  { id: "overdue", label: "Overdue", test: (r, now) => isOverdue(r, now) },
  {
    id: "week",
    label: "Due this week",
    test: (r, now) => isActive(r) && !!r.dueDate && new Date(r.dueDate) >= now && new Date(r.dueDate) <= endOfDay(addDays(now, 7)),
  },
  { id: "waiting", label: "Waiting on creator", test: (r) => isActive(r) && !isReady(r) },
  { id: "finished", label: "Finished", test: (r) => r.status === "APPROVED" || r.status === "CANCELLED" },
  { id: "drafts", label: "Drafts", test: (r) => r.status === "DRAFT" },
  { id: "all", label: "All", test: (r) => r.status !== "ARCHIVED" },
];

const VIEW_EMPTY: Record<ViewId, string> = {
  ready: "Nothing is waiting for review. Requests show here as soon as a creator uploads to a field.",
  overdue: "Nothing is overdue. Requests move here the moment their due time passes without every field approved.",
  week: "Nothing is due in the next 7 days.",
  waiting: "No request is waiting on a creator. Everything sent has uploads to review or is finished.",
  finished: "No finished requests yet. A request lands here once every field is approved.",
  drafts: "No drafts. Requests saved without sending wait here.",
  all: "No requests yet. Send a creator their first request and it shows here with its fields and time left.",
};

// URL ?filter= values from other screens (the overview links here)
const URL_FILTER_TO_VIEW: Record<string, ViewId> = {
  "needs-review": "ready",
  overdue: "overdue",
  "due-this-week": "week",
};

const STATUS_OPTIONS = [
  { value: "all", label: "Any status" },
  { value: "DRAFT", label: "Draft" },
  { value: "PENDING", label: "Pending" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "UNDER_REVIEW", label: "Under review" },
  { value: "NEEDS_REVISION", label: "Needs changes" },
  { value: "APPROVED", label: "Approved" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "ARCHIVED", label: "Archived" },
];

const PRIORITY_OPTIONS = [
  { value: "LOW", label: "Low" },
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.filter((o) => o.value !== "all").map((o) => [o.value, o.label])
);

type SortOption = "urgent" | "ready" | "priority" | "deadline" | "created" | "title";
type GroupOption = "none" | "priority" | "status";

const SORT_LABEL: Record<SortOption, string> = {
  urgent: "Most urgent first",
  ready: "Most ready first",
  priority: "Priority, then due",
  deadline: "Due soonest",
  created: "Newest first",
  title: "Title A to Z",
};

const PAGE = 50;
const PRIORITY_RANK: Record<string, number> = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };

function dueTime(r: ContentRequest) {
  return r.dueDate ? new Date(r.dueDate).getTime() : Number.POSITIVE_INFINITY;
}

function sortRequests(list: ContentRequest[], sortBy: SortOption): ContentRequest[] {
  const out = [...list];
  switch (sortBy) {
    case "urgent":
      // Active before finished; then the soonest due (the most late first)
      return out.sort((a, b) => Number(isFinished(a.status)) - Number(isFinished(b.status)) || dueTime(a) - dueTime(b));
    case "ready":
      return out.sort((a, b) => readyCount(b) - readyCount(a) || dueTime(a) - dueTime(b));
    case "priority":
      return out.sort(
        (a, b) => (PRIORITY_RANK[a.urgency] ?? 2) - (PRIORITY_RANK[b.urgency] ?? 2) || dueTime(a) - dueTime(b)
      );
    case "deadline":
      return out.sort((a, b) => dueTime(a) - dueTime(b));
    case "created":
      return out.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    case "title":
      return out.sort((a, b) => a.title.localeCompare(b.title));
  }
}

function completedAtOf(r: ContentRequest) {
  return r.status === "APPROVED" ? (r.reviewedAt ?? r.updatedAt ?? null) : null;
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

// ----------------------------------------------------------------- component

export function RequestsList({ initialRequests, creators, teamMembers = [], initialError = false }: RequestsListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isRefreshing, startRefresh] = useTransition();
  const [requests, setRequests] = useState<ContentRequest[]>(initialRequests);
  const [loadError, setLoadError] = useState(initialError);
  const [now] = useState(() => new Date());

  // Server data is the source of truth: a refresh re-renders the page with
  // fresh rows (including the field strips), which land here.
  useEffect(() => {
    setRequests(initialRequests);
    setLoadError(initialError);
  }, [initialRequests, initialError]);

  const refresh = useCallback(() => startRefresh(() => router.refresh()), [router]);

  const counts = useMemo(() => {
    const c = {} as Record<ViewId, number>;
    for (const v of VIEWS) c[v.id] = requests.filter((r) => v.test(r, now)).length;
    return c;
  }, [requests, now]);

  const [view, setViewState] = useState<ViewId>(() => {
    const v = searchParams.get("view");
    if (v && VIEWS.some((x) => x.id === v)) return v as ViewId;
    const f = searchParams.get("filter");
    if (f && URL_FILTER_TO_VIEW[f]) return URL_FILTER_TO_VIEW[f];
    return initialRequests.some(isReady) ? "ready" : "all";
  });
  // The view lives in the URL too, so a refresh after an action (or a reload,
  // or a shared link) lands on the same view
  const setView = useCallback((next: ViewId) => {
    setViewState(next);
    const url = new URL(window.location.href);
    url.searchParams.set("view", next);
    url.searchParams.delete("filter");
    window.history.replaceState(null, "", url);
  }, []);
  const [layout, setLayout] = useState<"table" | "wall">("table");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [creatorFilter, setCreatorFilter] = useState("all");
  const [templateFilter, setTemplateFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [dueToday, setDueToday] = useState(false);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("urgent");
  const [groupBy, setGroupBy] = useState<GroupOption>("none");
  const [visible, setVisible] = useState(PAGE);
  const [bulkStatusDialog, setBulkStatusDialog] = useState<{ open: boolean; actionType: BulkActionType }>({
    open: false,
    actionType: "changeStatus",
  });
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [saveFilterDialog, setSaveFilterDialog] = useState(false);
  const [newFilterName, setNewFilterName] = useState("");
  const [cloneDialog, setCloneDialog] = useState<{ open: boolean; request: ContentRequest | null }>({
    open: false,
    request: null,
  });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; ids: string[]; label: string }>({
    open: false,
    ids: [],
    label: "",
  });
  const [advancedFilter, setAdvancedFilter] = useState<FilterGroup>(createEmptyFilterGroup());

  const { getCountForRequest } = useUnreadComments();

  const relationOptions = useMemo(() => ({ creator: creators.map((c) => ({ value: c.id, label: c.name })) }), [creators]);
  const templates = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of requests) if (r.template) m.set(r.template.id, r.template.name);
    return [...m.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [requests]);

  // Per-browser conveniences: saved filters and the table/wall choice
  useEffect(() => {
    try {
      const saved = localStorage.getItem("savedRequestFilters");
      if (saved) setSavedFilters(JSON.parse(saved));
      if (localStorage.getItem("ccm-requests-layout") === "wall") setLayout("wall");
    } catch {
      // storage unavailable: defaults stand
    }
  }, []);

  const chooseLayout = (l: "table" | "wall") => {
    setLayout(l);
    try {
      localStorage.setItem("ccm-requests-layout", l);
    } catch {
      // ignore
    }
  };

  // A ?filter= link from another screen picks its view
  useEffect(() => {
    const f = searchParams.get("filter");
    if (f && URL_FILTER_TO_VIEW[f]) setView(URL_FILTER_TO_VIEW[f]);
    if (f === "due-today") setDueToday(true);
  }, [searchParams]);

  // Reset paging and selection when the view or filters change
  useEffect(() => {
    setVisible(PAGE);
  }, [view, search, statusFilter, creatorFilter, templateFilter, priorityFilter, dueToday, advancedFilter, sortBy]);

  const filteredRequests = useMemo(() => {
    const viewTest = VIEWS.find((v) => v.id === view)!.test;
    let filtered = requests.filter((r) =>
      // An explicit status filter of Archived reaches archived rows from any view
      statusFilter === "ARCHIVED" ? r.status === "ARCHIVED" : viewTest(r, now)
    );
    if (statusFilter !== "all" && statusFilter !== "ARCHIVED") filtered = filtered.filter((r) => r.status === statusFilter);
    if (creatorFilter !== "all") filtered = filtered.filter((r) => r.creator.id === creatorFilter);
    if (templateFilter !== "all") filtered = filtered.filter((r) => r.template?.id === templateFilter);
    if (priorityFilter !== "all") filtered = filtered.filter((r) => r.urgency === priorityFilter);
    if (dueToday) filtered = filtered.filter((r) => r.dueDate && isToday(new Date(r.dueDate)));
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.creator.name.toLowerCase().includes(q) ||
          r.creator.email.toLowerCase().includes(q)
      );
    }

    const conditions = advancedFilter.conditions.filter((c) => c.field && c.value !== null);
    if (conditions.length > 0) {
      filtered = filtered.filter((request) => {
        const results = conditions.map((condition) => {
          const { field, operator, value } = condition;
          let fieldValue: unknown = (request as unknown as Record<string, unknown>)[field];
          if (field === "creatorId") fieldValue = request.creator.id;
          else if (field === "templateId") fieldValue = request.template?.id || null;
          const s = String(fieldValue).toLowerCase();
          const v = String(value).toLowerCase();
          const isDate = field.includes("Date") || field.includes("At");
          switch (operator) {
            case "equals":
              return fieldValue === value;
            case "notEquals":
              return fieldValue !== value;
            case "contains":
              return s.includes(v);
            case "notContains":
              return !s.includes(v);
            case "startsWith":
              return s.startsWith(v);
            case "endsWith":
              return s.endsWith(v);
            case "in":
              return Array.isArray(value) ? value.includes(fieldValue as string) : fieldValue === value;
            case "notIn":
              return Array.isArray(value) ? !value.includes(fieldValue as string) : fieldValue !== value;
            case "isNull":
              return fieldValue === null || fieldValue === undefined;
            case "isNotNull":
              return fieldValue !== null && fieldValue !== undefined;
            case "greaterThan":
              if (isDate && value) return new Date(fieldValue as string) > new Date(value as string);
              return value !== null ? (fieldValue as number) > (value as number) : false;
            case "lessThan":
              if (isDate && value) return new Date(fieldValue as string) < new Date(value as string);
              return value !== null ? (fieldValue as number) < (value as number) : false;
            case "between": {
              const second = condition.secondValue;
              if (isDate && value && second) {
                const d = new Date(fieldValue as string);
                return d >= new Date(value as string) && d <= new Date(second as string);
              }
              return value !== null && second !== null && second !== undefined
                ? (fieldValue as number) >= (value as number) && (fieldValue as number) <= (second as number)
                : false;
            }
            default:
              return true;
          }
        });
        return advancedFilter.logic === "AND" ? results.every(Boolean) : results.some(Boolean);
      });
    }

    return sortRequests(filtered, sortBy);
  }, [requests, view, now, statusFilter, creatorFilter, templateFilter, priorityFilter, dueToday, search, sortBy, advancedFilter]);

  const shown = useMemo(() => filteredRequests.slice(0, visible), [filteredRequests, visible]);

  const groupedRequests = useMemo(() => {
    if (groupBy === "none") return null;
    if (groupBy === "priority") return groupByPriority(shown) as Record<string, ContentRequest[]>;
    const groups: Record<string, ContentRequest[]> = {};
    for (const r of shown) (groups[r.status] ??= []).push(r);
    return groups;
  }, [shown, groupBy]);

  const moreFilterCount =
    (statusFilter !== "all" ? 1 : 0) +
    (priorityFilter !== "all" ? 1 : 0) +
    (dueToday ? 1 : 0) +
    (groupBy !== "none" ? 1 : 0) +
    advancedFilter.conditions.filter((c) => c.field && c.value !== null).length;
  const hasActiveFilters =
    !!search || creatorFilter !== "all" || templateFilter !== "all" || moreFilterCount > 0;

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setCreatorFilter("all");
    setTemplateFilter("all");
    setPriorityFilter("all");
    setDueToday(false);
    setAdvancedFilter(createEmptyFilterGroup());
  };

  // ---------------------------------------------------------- selection

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const allShownSelected = shown.length > 0 && shown.every((r) => selectedIds.has(r.id));
  const toggleSelectAll = () => {
    setSelectedIds(allShownSelected ? new Set() : new Set(shown.map((r) => r.id)));
  };

  const selectedRequests = useMemo(() => requests.filter((r) => selectedIds.has(r.id)), [requests, selectedIds]);
  const selectedReadyFields = selectedRequests.reduce((n, r) => n + (r.readyTargets?.length ?? 0), 0);
  const selectedRemindable = selectedRequests.filter((r) => ["PENDING", "IN_PROGRESS", "NEEDS_REVISION"].includes(r.status)).length;

  // ---------------------------------------------------------- actions

  const postBulk = async (action: string, requestIds: string[], extra?: Record<string, unknown>) => {
    const response = await fetch("/api/requests/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, requestIds, ...extra }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "The change didn't go through. Try again.");
    return data as { affected: number; errors?: string[] };
  };

  const restoreArchived = async (ids: string[]) => {
    try {
      const response = await fetch("/api/requests/archive", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestIds: ids }),
      });
      if (!response.ok) throw new Error();
      toast.success(ids.length === 1 ? "Request restored" : `${ids.length} requests restored`);
      refresh();
    } catch {
      toast.error("Couldn't restore. Open Archived requests to restore them there.");
    }
  };

  const archive = async (ids: string[]) => {
    if (busy) return;
    setBusy("archive");
    try {
      const data = await postBulk("archive", ids);
      toast.success(data.affected === 1 ? "Request archived" : `${data.affected} requests archived`, {
        action: { label: "Undo", onClick: () => void restoreArchived(ids) },
      });
      setSelectedIds(new Set());
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't archive. Try again.");
    } finally {
      setBusy(null);
    }
  };

  // Reminders are held for a few seconds behind Undo, like approvals, then sent.
  const sendReminders = (ids: string[]) => {
    if (busy || ids.length === 0) return;
    setBusy("remind");
    holdAction({
      message: `Sending ${plural(ids.length, "reminder")}`,
      onUndo: () => {
        setBusy(null);
        toast.message("Reminder undone. Nothing was sent.");
      },
      run: async () => {
        try {
          const data = await postBulk("sendReminders", ids);
          if (data.affected > 0) toast.success(`Reminder sent for ${plural(data.affected, "request")}`);
          const skipped = data.errors?.length ?? 0;
          if (skipped > 0)
            toast.message(`${plural(skipped, "request")} skipped`, {
              description: "Reminders only go to requests that are pending, in progress or need changes.",
            });
          refresh();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Couldn't send reminders. Try again.");
        } finally {
          setBusy(null);
        }
      },
    });
  };

  // Approving is held for a few seconds behind Undo, then sent.
  const approveReady = (targets: ContentRequest[]) => {
    if (busy) return;
    const work = targets.flatMap((r) =>
      (r.readyTargets ?? []).map((t) => ({ requestId: r.id, ...t }))
    );
    if (work.length === 0) return;
    const touched = new Set(work.map((w) => w.requestId)).size;
    const label = `Approving ${plural(work.length, "field")} in ${plural(touched, "request")}`;
    setSelectedIds(new Set());
    setBusy("approve");
    holdAction({
      message: label,
      onUndo: () => {
        setBusy(null);
        toast.message("Approval undone. Nothing was sent.");
      },
      run: async (keepalive) => {
        let failed = 0;
        for (const w of work) {
          const result = await approveTarget(w, keepalive);
          if (!result.ok) failed++;
        }
        const okCount = work.length - failed;
        if (okCount > 0) toast.success(`Approved ${plural(okCount, "field")}`);
        if (failed > 0) toast.error(`${plural(failed, "field")} couldn't be approved. Open the request to review it there.`);
        setBusy(null);
        refresh();
      },
    });
  };

  const quickAction = async (requestId: string, action: string, data?: Record<string, unknown>) => {
    if (busy) return;
    setBusy("quick");
    try {
      await postBulk(action, [requestId], data);
      toast.success("Request updated");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update the request. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const deleteRequests = async (ids: string[]) => {
    if (busy) return;
    setBusy("delete");
    try {
      if (ids.length === 1) {
        const response = await fetch(`/api/requests/${ids[0]}`, { method: "DELETE" });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "Couldn't delete the request. Try again.");
        }
      } else {
        await postBulk("delete", ids);
      }
      toast.success(ids.length === 1 ? "Request deleted" : `${ids.length} requests deleted`);
      setDeleteDialog({ open: false, ids: [], label: "" });
      setRequests((prev) => prev.filter((r) => !ids.includes(r.id)));
      setSelectedIds(new Set());
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const saveFilter = () => {
    if (!newFilterName.trim()) {
      toast.error("Name the filter to save it");
      return;
    }
    const newFilter: SavedFilter = {
      id: Date.now().toString(),
      name: newFilterName.trim(),
      filters: {
        status: statusFilter !== "all" ? statusFilter : undefined,
        creatorId: creatorFilter !== "all" ? creatorFilter : undefined,
        urgency: priorityFilter !== "all" ? priorityFilter : undefined,
        quickFilter: dueToday ? "due-today" : view,
        search: search || undefined,
      },
    };
    const updated = [...savedFilters, newFilter];
    setSavedFilters(updated);
    try {
      localStorage.setItem("savedRequestFilters", JSON.stringify(updated));
    } catch {
      // ignore
    }
    setSaveFilterDialog(false);
    setNewFilterName("");
    toast.success("Filter saved");
  };

  const applySavedFilter = (filter: SavedFilter) => {
    clearFilters();
    if (filter.filters.status) setStatusFilter(filter.filters.status);
    if (filter.filters.creatorId) setCreatorFilter(filter.filters.creatorId);
    if (filter.filters.urgency) setPriorityFilter(filter.filters.urgency);
    if (filter.filters.search) setSearch(filter.filters.search);
    const q = filter.filters.quickFilter;
    if (q === "due-today") setDueToday(true);
    else if (q && VIEWS.some((v) => v.id === q)) setView(q as ViewId);
    else if (q && URL_FILTER_TO_VIEW[q]) setView(URL_FILTER_TO_VIEW[q]);
  };

  const deleteSavedFilter = (filterId: string) => {
    const updated = savedFilters.filter((f) => f.id !== filterId);
    setSavedFilters(updated);
    try {
      localStorage.setItem("savedRequestFilters", JSON.stringify(updated));
    } catch {
      // ignore
    }
    toast.success("Filter deleted");
  };

  // ---------------------------------------------------------- pieces

  const total = requests.filter((r) => r.status !== "ARCHIVED").length;
  const activeCount = requests.filter(isActive).length;
  const readyFieldsTotal = requests.filter((r) => !isFinished(r.status)).reduce((n, r) => n + readyCount(r), 0);
  const summary =
    total === 0
      ? "Nothing sent yet."
      : `${plural(total, "request")}: ${activeCount} active, ${counts.finished} finished. ${
          readyFieldsTotal === 0
            ? "No fields are waiting for review."
            : `${plural(readyFieldsTotal, "field")} ${readyFieldsTotal === 1 ? "is" : "are"} ready to review.`
        }`;

  const rowMenu = (request: ContentRequest) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${request.title}`}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem asChild>
          <Link href={`/dashboard/requests/${request.id}`}>Open review</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/dashboard/requests/${request.id}/edit`}>Edit request</Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setCloneDialog({ open: true, request })}>
          <Copy className="mr-2 size-4" />
          Clone request
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => sendReminders([request.id])}>
          <Bell className="mr-2 size-4" />
          Send reminder
        </DropdownMenuItem>
        {(request.readyTargets?.length ?? 0) > 0 && (
          <DropdownMenuItem onClick={() => approveReady([request])}>
            <Check className="mr-2 size-4" />
            Approve {plural(request.readyTargets!.length, "ready field")}
          </DropdownMenuItem>
        )}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Change status</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {STATUS_OPTIONS.filter((s) => s.value !== "all").map((status) => (
              <DropdownMenuItem
                key={status.value}
                disabled={request.status === status.value}
                onClick={() => void quickAction(request.id, "changeStatus", { status: status.value })}
              >
                {status.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Change priority</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {PRIORITY_OPTIONS.map((p) => (
              <DropdownMenuItem
                key={p.value}
                disabled={request.urgency === p.value}
                onClick={() => void quickAction(request.id, "changePriority", { priority: p.value })}
              >
                {p.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        {request.status === "SUBMITTED" && (
          <DropdownMenuItem onClick={() => void quickAction(request.id, "changeStatus", { status: "APPROVED" })}>
            Mark as complete
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {request.status === "ARCHIVED" ? (
          <DropdownMenuItem onClick={() => void restoreArchived([request.id])}>
            <ArchiveRestore className="mr-2 size-4" />
            Restore from archive
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => void archive([request.id])}>
            <Archive className="mr-2 size-4" />
            Archive
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          className="text-late focus:text-late"
          onClick={() => setDeleteDialog({ open: true, ids: [request.id], label: `"${request.title}"` })}
        >
          <Trash2 className="mr-2 size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const priorityMark = (r: ContentRequest) =>
    r.urgency === "URGENT" ? (
      <Badge variant="destructive">Urgent</Badge>
    ) : r.urgency === "HIGH" ? (
      <Badge variant="outline">High</Badge>
    ) : null;

  const timeCell = (r: ContentRequest) =>
    r.status === "DRAFT" ? (
      <span className="text-ink-2">Not sent</span>
    ) : r.status === "CANCELLED" ? (
      <span className="text-ink-2">Cancelled</span>
    ) : r.status === "ARCHIVED" ? (
      <span className="text-ink-2">Archived</span>
    ) : r.dueDate ? (
      <Countdown due={r.dueDate} completedAt={completedAtOf(r)} />
    ) : (
      <span className="text-ink-2">{r.status === "APPROVED" ? "Finished" : "No due date"}</span>
    );

  const unreadMark = (r: ContentRequest) => {
    const unread = getCountForRequest(r.id);
    if (unread <= 0) return null;
    return (
      <span className="inline-flex items-center gap-1 text-[13px] text-ink" title={`${unread} unread comments`}>
        <MessageSquare className="size-3.5 text-icon" aria-hidden="true" />
        {unread} new
      </span>
    );
  };

  const renderTable = (rows: ContentRequest[], caption: string) => (
    <>
      {/* Desktop and tablet: a real table */}
      <div className="hidden lg:block rounded-[10px] bg-tile">
        <table className="w-full table-fixed border-collapse text-[14px]">
          <caption className="sr-only">{caption}</caption>
          <colgroup>
            <col className="w-[52px]" />
            <col />
            <col className="w-[34%] lg:w-[30%]" />
            <col className="w-[136px]" />
            <col className="w-[132px]" />
          </colgroup>
          <thead>
            <tr className="border-b border-line text-left text-[13px] text-ink-2">
              <th scope="col" className="py-2.5 pl-4 font-medium">
                <Checkbox
                  checked={rows.length > 0 && rows.every((r) => selectedIds.has(r.id))}
                  onCheckedChange={() => {
                    const all = rows.every((r) => selectedIds.has(r.id));
                    setSelectedIds((prev) => {
                      const next = new Set(prev);
                      rows.forEach((r) => (all ? next.delete(r.id) : next.add(r.id)));
                      return next;
                    });
                  }}
                  aria-label="Select every request in this list"
                />
              </th>
              <th scope="col" className="py-2.5 pr-4 font-medium">Request</th>
              <th scope="col" className="py-2.5 pr-4 font-medium">Fields</th>
              <th scope="col" className="py-2.5 pr-4 font-medium">Time left</th>
              <th scope="col" className="py-2.5 pr-4 font-medium"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const selected = selectedIds.has(r.id);
              const ready = readyCount(r);
              const strip = r.strip ?? [];
              return (
                <tr
                  key={r.id}
                  data-selected={selected || undefined}
                  className="group border-b border-line last:border-b-0 transition-colors duration-150 hover:bg-tile-hi data-[selected]:bg-tile-hi"
                >
                  <td className="py-3 pl-4 align-middle">
                    <Checkbox
                      checked={selected}
                      onCheckedChange={() => toggleSelect(r.id)}
                      aria-label={`Select ${r.title}`}
                    />
                  </td>
                  <td className="py-3 pr-4 align-middle">
                    <div className="flex min-w-0 items-center gap-2">
                      <Link
                        href={`/dashboard/requests/${r.id}`}
                        className="truncate text-[15px] font-semibold text-ink hover:underline focus-visible:underline"
                      >
                        {r.title}
                      </Link>
                      {priorityMark(r)}
                    </div>
                    <div className="flex min-w-0 items-center gap-1.5 text-[13px] text-ink-2">
                      <Link href={`/dashboard/creators/${r.creator.id}`} className="inline-flex min-h-6 shrink-0 items-center text-ink hover:underline">
                        {r.creator.name}
                      </Link>
                      {r.template && <span className="truncate">· {r.template.name}</span>}
                      {r.status === "DRAFT" && <span className="shrink-0">· Draft</span>}
                      {unreadMark(r) && <span className="ml-1.5 shrink-0">{unreadMark(r)}</span>}
                    </div>
                  </td>
                  <td className="py-3 pr-4 align-middle">
                    {strip.length > 0 && (
                      <div className="flex min-w-0 flex-col gap-1">
                        <FieldStrip fields={strip} />
                        <span className="truncate text-[13px] text-ink-2">{fieldSummary(strip)}</span>
                      </div>
                    )}
                  </td>
                  <td className="py-3 pr-4 align-middle text-[14px]">{timeCell(r)}</td>
                  <td className="py-3 pr-3 align-middle">
                    <div className="flex items-center justify-end gap-1">
                      {ready > 0 && !isFinished(r.status) && (
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/dashboard/requests/${r.id}`}>Review {ready}</Link>
                        </Button>
                      )}
                      {rowMenu(r)}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Phone: one row per request, same content stacked */}
      <ul className="lg:hidden divide-y divide-line rounded-[10px] bg-tile" aria-label={caption}>
        {rows.map((r) => {
          const selected = selectedIds.has(r.id);
          const strip = r.strip ?? [];
          const ready = readyCount(r);
          return (
            <li key={r.id} data-selected={selected || undefined} className="flex gap-3 px-3 py-3 data-[selected]:bg-tile-hi">
              <div className="pt-1">
                <Checkbox checked={selected} onCheckedChange={() => toggleSelect(r.id)} aria-label={`Select ${r.title}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/dashboard/requests/${r.id}`} className="min-w-0 text-[16px] font-semibold leading-snug text-ink">
                    {r.title}
                  </Link>
                  <div className="-mr-1 -mt-1 shrink-0">{rowMenu(r)}</div>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[14px] text-ink-2">
                  <span className="text-ink">{r.creator.name}</span>
                  <span aria-hidden="true">·</span>
                  {timeCell(r)}
                  {priorityMark(r)}
                </div>
                {strip.length > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <FieldStrip fields={strip} />
                    <span className="truncate text-[13px] text-ink-2">{fieldSummary(strip)}</span>
                  </div>
                )}
                {(ready > 0 || getCountForRequest(r.id) > 0) && (
                  <div className="mt-2 flex items-center gap-3">
                    {ready > 0 && !isFinished(r.status) && (
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/dashboard/requests/${r.id}`}>Review {ready}</Link>
                      </Button>
                    )}
                    {unreadMark(r)}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );

  const renderWall = (rows: ContentRequest[]) => (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" aria-label="Requests as title cards">
      {rows.map((r) => (
        <li key={r.id} className="min-w-0">
          <TitleCard
            title={r.title}
            creator={r.creator.name}
            fields={r.strip ?? []}
            due={r.status === "DRAFT" ? null : r.dueDate}
            timeText={r.status === "DRAFT" ? "Not sent" : !r.dueDate ? "No due date" : undefined}
            completedAt={completedAtOf(r)}
            href={`/dashboard/requests/${r.id}`}
          />
        </li>
      ))}
    </ul>
  );

  const renderRows = (rows: ContentRequest[], caption: string) =>
    layout === "wall" ? renderWall(rows) : renderTable(rows, caption);

  const viewLabel = VIEWS.find((v) => v.id === view)!.label;

  // ---------------------------------------------------------- render

  const primaryFilterCount = (creatorFilter !== "all" ? 1 : 0) + (templateFilter !== "all" ? 1 : 0);

  /** Creator, template and sort: a row of selects, or labelled full-width rows on a phone. */
  const primarySelects = (mode: "row" | "stack") => {
    const trigger = mode === "row" ? undefined : "w-full";
    const wrap = (label: string, id: string, el: React.ReactNode) =>
      mode === "row" ? (
        el
      ) : (
        <div className="grid gap-1.5">
          <label htmlFor={id} className="text-[13px] font-medium text-ink-2">
            {label}
          </label>
          {el}
        </div>
      );
    return (
      <>
        {wrap(
          "Creator",
          `req-creator-${mode}`,
          <Select value={creatorFilter} onValueChange={setCreatorFilter}>
            <SelectTrigger id={`req-creator-${mode}`} className={trigger ?? "min-w-0 flex-1 sm:flex-none sm:w-[150px]"} aria-label="Creator">
              <SelectValue placeholder="All creators" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All creators</SelectItem>
              {creators.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {wrap(
          "Template",
          `req-template-${mode}`,
          <Select value={templateFilter} onValueChange={setTemplateFilter}>
            <SelectTrigger id={`req-template-${mode}`} className={trigger ?? "min-w-0 flex-1 sm:flex-none sm:w-[160px]"} aria-label="Template">
              <SelectValue placeholder="All templates" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All templates</SelectItem>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {wrap(
          "Sort",
          `req-sort-${mode}`,
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger id={`req-sort-${mode}`} className={trigger ?? "min-w-0 flex-1 sm:flex-none sm:w-[176px]"} aria-label="Sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_LABEL) as SortOption[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {SORT_LABEL[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </>
    );
  };

  return (
    <div className="space-y-5">
      {/* Title row: the page answers "what needs me" in one sentence */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[28px] font-bold leading-tight tracking-[-0.02em] text-ink">Requests</h1>
          <p className="mt-1 text-[15px] text-ink-2">{summary}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/exports">
              <Download className="size-4" />
              Export
            </Link>
          </Button>
          <Button asChild variant="light">
            <Link href="/dashboard/requests/new">
              <Plus className="size-4" />
              New request
            </Link>
          </Button>
        </div>
      </div>

      {/* Saved views */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={view} onValueChange={(v) => { setView(v as ViewId); setSelectedIds(new Set()); }}>
          <TabsList aria-label="Request views">
            {VIEWS.filter((v) => v.id !== "drafts" || counts.drafts > 0).map((v) => (
              <TabsTrigger key={v.id} value={v.id}>
                {v.label}
                <span className="tabular-nums text-ink">{counts[v.id]}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Link
          href="/dashboard/requests/archived"
          className="inline-flex items-center gap-1.5 text-[14px] text-ink-2 underline-offset-[3px] hover:text-ink hover:underline"
        >
          <Archive className="size-4" aria-hidden="true" />
          Archived requests
        </Link>
      </div>

      {/* Search, filters, sort, layout */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1 basis-full sm:basis-auto md:max-w-[360px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-icon" aria-hidden="true" />
            <Input
              placeholder="Search title or creator"
              aria-label="Search requests by title or creator"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {/* From 640px the three main selects sit in this row; on a phone
              they move into More filters, each on its own labelled row */}
          <div className="hidden sm:contents">{primarySelects("row")}</div>
          <Button
            variant={showMoreFilters ? "secondary" : "outline"}
            onClick={() => setShowMoreFilters((v) => !v)}
            aria-expanded={showMoreFilters}
            aria-controls="requests-more-filters"
          >
            <SlidersHorizontal className="size-4" />
            More filters
            {moreFilterCount > 0 && <span className="hidden tabular-nums text-ink sm:inline">{moreFilterCount}</span>}
            {moreFilterCount + primaryFilterCount > 0 && (
              <span className="tabular-nums text-ink sm:hidden">{moreFilterCount + primaryFilterCount}</span>
            )}
          </Button>
          {hasActiveFilters && (
            <Button variant="ghost" onClick={clearFilters}>
              <X className="size-4" />
              Clear
            </Button>
          )}
          <div className="ml-auto flex rounded-[10px] bg-well p-[3px]" role="group" aria-label="Layout">
            {(["table", "wall"] as const).map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={layout === l}
                onClick={() => chooseLayout(l)}
                className="inline-flex h-[30px] items-center gap-1.5 rounded-[7px] px-3 text-[14px] font-medium text-ink-2 transition-colors duration-150 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring aria-pressed:bg-tile-hi aria-pressed:text-ink"
              >
                {l === "table" ? <Rows3 className="size-4" aria-hidden="true" /> : <LayoutGrid className="size-4" aria-hidden="true" />}
                {l === "table" ? "List" : "Wall"}
              </button>
            ))}
          </div>
        </div>

        {showMoreFilters && (
          <div id="requests-more-filters" className="flex flex-wrap items-center gap-2 rounded-[10px] bg-tile p-3">
            <div className="grid basis-full gap-3 sm:hidden">{primarySelects("stack")}</div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]" aria-label="Status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[140px]" aria-label="Priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any priority</SelectItem>
                {PRIORITY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupOption)}>
              <SelectTrigger className="w-[160px]" aria-label="Group">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No grouping</SelectItem>
                <SelectItem value="priority">Group by priority</SelectItem>
                <SelectItem value="status">Group by status</SelectItem>
              </SelectContent>
            </Select>
            <Button variant={dueToday ? "secondary" : "outline"} aria-pressed={dueToday} onClick={() => setDueToday((v) => !v)}>
              Due today
            </Button>
            {savedFilters.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <Filter className="size-4" />
                    My filters
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  {savedFilters.map((filter) => (
                    <div key={filter.id} className="flex items-center gap-1">
                      <DropdownMenuItem className="flex-1" onClick={() => applySavedFilter(filter)}>
                        {filter.name}
                      </DropdownMenuItem>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Delete filter ${filter.name}`}
                        onClick={() => deleteSavedFilter(filter.id)}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {hasActiveFilters && (
              <Button variant="ghost" onClick={() => setSaveFilterDialog(true)}>
                <Save className="size-4" />
                Save these filters
              </Button>
            )}
            <div className="basis-full">
              <SavedFilters
                entityType="requests"
                fieldDefinitions={REQUEST_FILTER_FIELDS}
                relationOptions={relationOptions}
                currentFilter={advancedFilter}
                onFilterChange={setAdvancedFilter}
                onApplyFilter={() => {
                  // filtering is derived from advancedFilter in filteredRequests
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Bulk actions for the selection */}
      {selectedIds.size > 0 && (
        <div
          className="sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-[10px] bg-raised px-3 py-2 shadow-lg"
          role="region"
          aria-label="Selected requests"
        >
          <span className="mr-1 text-[14px] font-medium text-ink">{plural(selectedIds.size, "request")} selected</span>
          <Button
            size="sm"
            onClick={() => approveReady(selectedRequests)}
            disabled={!!busy || selectedReadyFields === 0}
            title={selectedReadyFields === 0 ? "No ready fields in the selection" : undefined}
          >
            {busy === "approve" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Approve all ready{selectedReadyFields > 0 ? ` (${selectedReadyFields})` : ""}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => sendReminders(Array.from(selectedIds))}
            disabled={!!busy || selectedRemindable === 0}
            title={selectedRemindable === 0 ? "None of these are waiting on the creator" : undefined}
          >
            {busy === "remind" ? <Loader2 className="size-4 animate-spin" /> : <Bell className="size-4" />}
            Send reminder
          </Button>
          <Button size="sm" variant="outline" onClick={() => void archive(Array.from(selectedIds))} disabled={!!busy}>
            <Archive className="size-4" />
            Archive
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" disabled={!!busy}>
                More
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuItem onClick={() => setBulkStatusDialog({ open: true, actionType: "changeStatus" })}>
                <FileText className="mr-2 size-4" />
                Change status
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setBulkStatusDialog({ open: true, actionType: "changePriority" })}>
                <Flag className="mr-2 size-4" />
                Change priority
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setBulkStatusDialog({ open: true, actionType: "assignTeamMember" })}>
                <UserPlus className="mr-2 size-4" />
                Assign team member
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-late focus:text-late"
                onClick={() =>
                  setDeleteDialog({ open: true, ids: Array.from(selectedIds), label: plural(selectedIds.size, "request") })
                }
              >
                <Trash2 className="mr-2 size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelectedIds(new Set())}>
            <X className="size-4" />
            Clear selection
          </Button>
        </div>
      )}

      {/* The list */}
      {loadError && requests.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-[10px] bg-tile p-6">
          <h2 className="text-[17px] font-semibold text-ink">Requests didn&apos;t load</h2>
          <p className="text-[14px] text-ink-2">The server didn&apos;t answer. Your requests are safe; try loading them again.</p>
          <Button variant="outline" onClick={refresh} disabled={isRefreshing}>
            {isRefreshing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Try again
          </Button>
        </div>
      ) : isRefreshing && requests.length === 0 ? (
        <div className="space-y-2 rounded-[10px] bg-tile p-4" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-[10px] bg-tile p-6">
          <h2 className="text-[17px] font-semibold text-ink">
            {hasActiveFilters ? `No requests in ${viewLabel} match these filters` : `${viewLabel}: nothing here`}
          </h2>
          <p className="max-w-[60ch] text-[14px] text-ink-2">
            {hasActiveFilters ? "Clear the filters to see the whole view, or try another view above." : VIEW_EMPTY[view]}
          </p>
          {hasActiveFilters ? (
            <Button variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : view === "all" || view === "drafts" ? (
            <Button asChild>
              <Link href="/dashboard/requests/new">
                <Plus className="size-4" />
                New request
              </Link>
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setView("all")}>
              Show all requests
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 text-[14px] text-ink-2">
            <p aria-live="polite">
              {filteredRequests.length > shown.length
                ? `Showing ${shown.length} of ${plural(filteredRequests.length, "request")} in ${viewLabel}`
                : `${plural(filteredRequests.length, "request")} in ${viewLabel}`}
              {isRefreshing && <Loader2 className="ml-2 inline size-3.5 animate-spin" aria-label="Refreshing" />}
            </p>
            {layout === "table" && (
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-ink-2 underline-offset-[3px] hover:text-ink hover:underline lg:hidden"
              >
                {allShownSelected ? "Clear selection" : "Select all"}
              </button>
            )}
          </div>

          {groupedRequests ? (
            <div className="space-y-6">
              {Object.entries(groupedRequests).map(([group, items]) => {
                if (items.length === 0) return null;
                const label =
                  groupBy === "priority"
                    ? `${getPriorityConfig(group as Priority).label} priority`
                    : (STATUS_LABEL[group] ?? group);
                return (
                  <section key={group} aria-label={label} className="space-y-2">
                    <h2 className="text-[17px] font-semibold text-ink">
                      {label} <span className="font-normal text-ink-2">{items.length}</span>
                    </h2>
                    {renderRows(items, label)}
                  </section>
                );
              })}
            </div>
          ) : (
            renderRows(shown, viewLabel)
          )}

          <StateLegend className="px-1 pt-1" />

          {filteredRequests.length > shown.length && (
            <div className="flex justify-center pt-1">
              <Button variant="outline" onClick={() => setVisible((v) => v + PAGE)}>
                Show {Math.min(PAGE, filteredRequests.length - shown.length)} more
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Delete confirmation */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog((d) => ({ ...d, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleteDialog.ids.length === 1 ? "this request" : deleteDialog.label}?</DialogTitle>
            <DialogDescription>
              Deleting {deleteDialog.label} also deletes every upload and comment on {deleteDialog.ids.length === 1 ? "it" : "them"}. This can&apos;t be undone. Archive instead to keep them.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, ids: [], label: "" })} disabled={!!busy}>
              Keep
            </Button>
            <Button variant="destructive" onClick={() => void deleteRequests(deleteDialog.ids)} disabled={!!busy}>
              {busy === "delete" && <Loader2 className="size-4 animate-spin" />}
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save filter */}
      <Dialog open={saveFilterDialog} onOpenChange={setSaveFilterDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save these filters</DialogTitle>
            <DialogDescription>Saved filters live in this browser under My filters.</DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Filter name"
            aria-label="Filter name"
            value={newFilterName}
            onChange={(e) => setNewFilterName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveFilter()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveFilterDialog(false)}>
              Cancel
            </Button>
            <Button onClick={saveFilter}>Save filter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {cloneDialog.request && (
        <CloneRequestDialog
          request={{
            id: cloneDialog.request.id,
            title: cloneDialog.request.title,
            description: cloneDialog.request.description,
            dueDate: cloneDialog.request.dueDate,
            urgency: cloneDialog.request.urgency,
            status: cloneDialog.request.status,
            fields: null,
            requirements: null,
            creator: cloneDialog.request.creator,
            template: cloneDialog.request.template,
          }}
          creators={creators}
          open={cloneDialog.open}
          onOpenChange={(open) => setCloneDialog((d) => ({ ...d, open }))}
          onCloneSuccess={(ids) => {
            toast.success(ids.length === 1 ? "Request cloned" : `${ids.length} requests cloned`);
            refresh();
          }}
        />
      )}

      <BulkStatusDialog
        open={bulkStatusDialog.open}
        onOpenChange={(open) => setBulkStatusDialog((d) => ({ ...d, open }))}
        actionType={bulkStatusDialog.actionType}
        selectedRequests={selectedRequests}
        teamMembers={teamMembers}
        onSuccess={() => {
          setSelectedIds(new Set());
          refresh();
        }}
      />

      <BackToTop threshold={400} />
    </div>
  );
}
