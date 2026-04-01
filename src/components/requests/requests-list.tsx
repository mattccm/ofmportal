"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RequestsSuggestions } from "@/components/suggestions/requests-suggestions";
import {
  Plus,
  Upload,
  Clock,
  Calendar,
  MoreHorizontal,
  ChevronRight,
  FileText,
  Search,
  MessageSquare,
  AlertTriangle,
  Archive,
  Trash2,
  Bell,
  CheckCircle,
  Filter,
  X,
  Save,
  User,
  Loader2,
  ArrowUpDown,
  Layers,
  Flame,
  Copy,
  Eye,
  Flag,
  UserPlus,
  ChevronDown,
  ListChecks,
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
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, formatDistanceToNow, isPast, isWithinInterval, addDays, isToday, endOfWeek } from "date-fns";
import { toast } from "sonner";
import {
  PriorityIndicator,
  PriorityBadge,
  DeadlineCountdown,
  PriorityDot,
  OverdueWarning,
} from "@/components/requests/priority-indicator";
import {
  type Priority,
  sortByPriorityAndDeadline,
  groupByPriority,
  isDeadlineOverdue,
  getPriorityConfig,
  getDeadlineInfo,
} from "@/lib/deadline-utils";
import { BulkStatusDialog, type BulkActionType } from "./bulk-status-dialog";
import { NoRequests } from "@/components/empty-states";
import { RequestViewedIndicator } from "@/components/messages/read-receipt";
import { CloneRequestDialog } from "./clone-request-dialog";
import { TagList, TagBadge } from "@/components/tags/tag-badge";
import { TagFilter, BulkTagDialog } from "@/components/tags/tag-manager";
import { Tag, BulkTagAction } from "@/lib/tag-types";
import { SavedFilters } from "@/components/filters/saved-filters";
import {
  type FilterGroup,
  REQUEST_FILTER_FIELDS,
  createEmptyFilterGroup,
} from "@/lib/filter-utils";
import { BackToTop } from "@/components/ui/back-to-top";

interface Creator {
  id: string;
  name: string;
  email: string;
}

interface RequestTemplate {
  id: string;
  name: string;
}

interface RequestTag {
  id: string;
  name: string;
  color: string;
}

interface ContentRequest {
  id: string;
  title: string;
  description: string | null;
  status: string;
  urgency: string;
  dueDate: string | null;
  createdAt: string;
  creator: Creator;
  template: RequestTemplate | null;
  tags?: RequestTag[];
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
}

const QUICK_FILTERS = [
  { id: "my-requests", label: "My Requests", icon: User },
  { id: "overdue", label: "Overdue", icon: AlertTriangle },
  { id: "due-today", label: "Due Today", icon: Calendar },
  { id: "due-this-week", label: "Due This Week", icon: Clock },
] as const;

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "DRAFT", label: "Drafts" },
  { value: "PENDING", label: "Pending" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "UNDER_REVIEW", label: "Under Review" },
  { value: "NEEDS_REVISION", label: "Needs Revision" },
  { value: "APPROVED", label: "Approved" },
  { value: "ARCHIVED", label: "Archived" },
];

const PRIORITY_OPTIONS = [
  { value: "LOW", label: "Low" },
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

function getStatusConfig(status: string) {
  const configs: Record<string, { class: string; label: string; bgClass: string }> = {
    DRAFT: {
      class: "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900/30 dark:text-slate-400 dark:border-slate-800",
      bgClass: "bg-slate-500",
      label: "Draft",
    },
    PENDING: {
      class: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800",
      bgClass: "bg-yellow-500",
      label: "Pending",
    },
    IN_PROGRESS: {
      class: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
      bgClass: "bg-blue-500",
      label: "In Progress",
    },
    SUBMITTED: {
      class: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800",
      bgClass: "bg-purple-500",
      label: "Submitted",
    },
    UNDER_REVIEW: {
      class: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800",
      bgClass: "bg-orange-500",
      label: "Under Review",
    },
    NEEDS_REVISION: {
      class: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
      bgClass: "bg-red-500",
      label: "Needs Revision",
    },
    APPROVED: {
      class: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
      bgClass: "bg-green-500",
      label: "Approved",
    },
    CANCELLED: {
      class: "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/30 dark:text-gray-400 dark:border-gray-800",
      bgClass: "bg-gray-500",
      label: "Cancelled",
    },
    ARCHIVED: {
      class: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-900/30 dark:text-gray-500 dark:border-gray-800",
      bgClass: "bg-gray-400",
      label: "Archived",
    },
  };
  return configs[status] || configs.PENDING;
}

function getUrgencyConfig(urgency: string) {
  const configs: Record<string, { class: string; label: string; show: boolean }> = {
    LOW: { class: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400", label: "Low", show: false },
    NORMAL: { class: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400", label: "Normal", show: false },
    HIGH: { class: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400", label: "High", show: true },
    URGENT: { class: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400", label: "Urgent", show: true },
  };
  return configs[urgency] || configs.NORMAL;
}

function getDueDateStatus(dueDate: string | null) {
  if (!dueDate) return null;

  const date = new Date(dueDate);
  const now = new Date();
  if (isPast(date)) {
    return { status: "overdue", label: "Overdue", class: "text-red-600 dark:text-red-400" };
  }
  if (isWithinInterval(date, { start: now, end: addDays(now, 2) })) {
    return { status: "soon", label: "Due soon", class: "text-amber-600 dark:text-amber-400" };
  }
  return { status: "normal", label: format(date, "MMM d"), class: "text-muted-foreground" };
}

type SortOption = "priority" | "deadline" | "created" | "title";
type GroupOption = "none" | "priority" | "status";

export function RequestsList({ initialRequests, creators, currentUserId, teamMembers = [] }: RequestsListProps) {
  const [requests, setRequests] = useState<ContentRequest[]>(initialRequests);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [creatorFilter, setCreatorFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [quickFilter, setQuickFilter] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("priority");
  const [groupBy, setGroupBy] = useState<GroupOption>("none");
  const [bulkActionDialog, setBulkActionDialog] = useState<{
    open: boolean;
    action: string | null;
    title: string;
    description: string;
  }>({ open: false, action: null, title: "", description: "" });
  const [bulkStatusDialog, setBulkStatusDialog] = useState<{
    open: boolean;
    actionType: BulkActionType;
  }>({ open: false, actionType: "changeStatus" });
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [saveFilterDialog, setSaveFilterDialog] = useState(false);
  const [newFilterName, setNewFilterName] = useState("");
  const [cloneDialog, setCloneDialog] = useState<{
    open: boolean;
    request: ContentRequest | null;
  }>({ open: false, request: null });

  // Advanced filter state
  const [advancedFilter, setAdvancedFilter] = useState<FilterGroup>(createEmptyFilterGroup());
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [bulkTagDialogOpen, setBulkTagDialogOpen] = useState(false);

  // Relation options for filter builder (creators and templates)
  const relationOptions = useMemo(() => ({
    creator: creators.map(c => ({ value: c.id, label: c.name })),
  }), [creators]);

  // Load saved filters from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("savedRequestFilters");
    if (saved) {
      setSavedFilters(JSON.parse(saved));
    }
  }, []);

  // Filter requests
  const filteredRequests = useMemo(() => {
    let filtered = [...requests];

    // Tab filter
    if (activeTab === "drafts") {
      filtered = filtered.filter((r) => r.status === "DRAFT");
    } else if (activeTab === "active") {
      filtered = filtered.filter((r) =>
        ["PENDING", "IN_PROGRESS", "SUBMITTED", "UNDER_REVIEW", "NEEDS_REVISION"].includes(r.status)
      );
    } else if (activeTab === "completed") {
      filtered = filtered.filter((r) => r.status === "APPROVED");
    } else if (activeTab === "archived") {
      filtered = filtered.filter((r) => r.status === "ARCHIVED");
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((r) => r.status === statusFilter);
    }

    // Creator filter
    if (creatorFilter !== "all") {
      filtered = filtered.filter((r) => r.creator.id === creatorFilter);
    }

    // Quick filters
    if (quickFilter === "overdue") {
      filtered = filtered.filter((r) => r.dueDate && isPast(new Date(r.dueDate)));
    } else if (quickFilter === "due-today") {
      filtered = filtered.filter((r) => r.dueDate && isToday(new Date(r.dueDate)));
    } else if (quickFilter === "due-this-week") {
      const weekEnd = endOfWeek(new Date());
      filtered = filtered.filter(
        (r) => r.dueDate && isWithinInterval(new Date(r.dueDate), { start: new Date(), end: weekEnd })
      );
    }

    // Priority filter
    if (priorityFilter !== "all") {
      filtered = filtered.filter((r) => r.urgency === priorityFilter);
    }

    // Search
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.title.toLowerCase().includes(searchLower) ||
          r.creator.name.toLowerCase().includes(searchLower) ||
          r.creator.email.toLowerCase().includes(searchLower)
      );
    }

    // Apply advanced filter conditions (from filter builder)
    const hasAdvancedConditions = advancedFilter.conditions.some(
      (c) => c.field && c.value !== null
    );
    if (hasAdvancedConditions) {
      filtered = filtered.filter((request) => {
        const results = advancedFilter.conditions
          .filter((c) => c.field && c.value !== null)
          .map((condition) => {
            const { field, operator, value } = condition;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let fieldValue: any = (request as any)[field];

            // Handle nested fields (e.g., creator.id)
            if (field === "creatorId") {
              fieldValue = request.creator.id;
            } else if (field === "templateId") {
              fieldValue = request.template?.id || null;
            }

            switch (operator) {
              case "equals":
                return fieldValue === value;
              case "notEquals":
                return fieldValue !== value;
              case "contains":
                return String(fieldValue).toLowerCase().includes(String(value).toLowerCase());
              case "notContains":
                return !String(fieldValue).toLowerCase().includes(String(value).toLowerCase());
              case "startsWith":
                return String(fieldValue).toLowerCase().startsWith(String(value).toLowerCase());
              case "endsWith":
                return String(fieldValue).toLowerCase().endsWith(String(value).toLowerCase());
              case "in":
                return Array.isArray(value) ? value.includes(fieldValue) : fieldValue === value;
              case "notIn":
                return Array.isArray(value) ? !value.includes(fieldValue) : fieldValue !== value;
              case "isNull":
                return fieldValue === null || fieldValue === undefined;
              case "isNotNull":
                return fieldValue !== null && fieldValue !== undefined;
              case "greaterThan":
                if ((field.includes("Date") || field.includes("At")) && value) {
                  return new Date(fieldValue) > new Date(value as string);
                }
                return value !== null ? fieldValue > value : false;
              case "lessThan":
                if ((field.includes("Date") || field.includes("At")) && value) {
                  return new Date(fieldValue) < new Date(value as string);
                }
                return value !== null ? fieldValue < value : false;
              case "between":
                const secondValue = condition.secondValue;
                if ((field.includes("Date") || field.includes("At")) && value && secondValue) {
                  const date = new Date(fieldValue);
                  return date >= new Date(value as string) && date <= new Date(secondValue as string);
                }
                return value !== null && secondValue !== null && secondValue !== undefined
                  ? fieldValue >= value && fieldValue <= secondValue
                  : false;
              default:
                return true;
            }
          });

        // Apply logic (AND/OR)
        return advancedFilter.logic === "AND"
          ? results.every(Boolean)
          : results.some(Boolean);
      });
    }

    // Apply sorting
    if (sortBy === "priority") {
      filtered = sortByPriorityAndDeadline(filtered);
    } else if (sortBy === "deadline") {
      filtered = [...filtered].sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
    } else if (sortBy === "created") {
      filtered = [...filtered].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } else if (sortBy === "title") {
      filtered = [...filtered].sort((a, b) => a.title.localeCompare(b.title));
    }

    return filtered;
  }, [requests, activeTab, statusFilter, creatorFilter, priorityFilter, quickFilter, search, sortBy, advancedFilter]);

  // Separate overdue requests for special display
  const overdueRequests = useMemo(() => {
    return filteredRequests.filter((r) => r.dueDate && isDeadlineOverdue(r.dueDate));
  }, [filteredRequests]);

  const nonOverdueRequests = useMemo(() => {
    return filteredRequests.filter((r) => !r.dueDate || !isDeadlineOverdue(r.dueDate));
  }, [filteredRequests]);

  // Group requests by priority if grouping is enabled
  const groupedRequests = useMemo(() => {
    if (groupBy === "none") return null;

    if (groupBy === "priority") {
      return groupByPriority(filteredRequests);
    }

    if (groupBy === "status") {
      const groups: Record<string, ContentRequest[]> = {};
      filteredRequests.forEach((r) => {
        if (!groups[r.status]) groups[r.status] = [];
        groups[r.status].push(r);
      });
      return groups;
    }

    return null;
  }, [filteredRequests, groupBy]);

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
    if (selectedIds.size === filteredRequests.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRequests.map((r) => r.id)));
    }
  }, [filteredRequests, selectedIds.size]);

  const performBulkAction = async (
    action: string,
    additionalData?: Record<string, unknown>
  ) => {
    if (selectedIds.size === 0) {
      toast.error("No requests selected");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/requests/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          requestIds: Array.from(selectedIds),
          ...additionalData,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to perform action");
      }

      toast.success(`Successfully updated ${data.affected} request(s)`);

      if (data.errors && data.errors.length > 0) {
        data.errors.forEach((error: string) => toast.error(error));
      }

      // Refresh requests
      const refreshResponse = await fetch("/api/requests");
      if (refreshResponse.ok) {
        setRequests(await refreshResponse.json());
      }

      setSelectedIds(new Set());
      setBulkActionDialog({ open: false, action: null, title: "", description: "" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to perform action");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = async (requestId: string, action: string, data?: Record<string, unknown>) => {
    setLoading(true);
    try {
      const response = await fetch("/api/requests/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          requestIds: [requestId],
          ...data,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to perform action");
      }

      toast.success("Request updated successfully");

      // Refresh requests
      const refreshResponse = await fetch("/api/requests");
      if (refreshResponse.ok) {
        setRequests(await refreshResponse.json());
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to perform action");
    } finally {
      setLoading(false);
    }
  };

  const saveFilter = () => {
    if (!newFilterName.trim()) {
      toast.error("Please enter a filter name");
      return;
    }

    const newFilter: SavedFilter = {
      id: Date.now().toString(),
      name: newFilterName,
      filters: {
        status: statusFilter !== "all" ? statusFilter : undefined,
        creatorId: creatorFilter !== "all" ? creatorFilter : undefined,
        quickFilter: quickFilter || undefined,
        search: search || undefined,
      },
    };

    const updatedFilters = [...savedFilters, newFilter];
    setSavedFilters(updatedFilters);
    localStorage.setItem("savedRequestFilters", JSON.stringify(updatedFilters));
    setSaveFilterDialog(false);
    setNewFilterName("");
    toast.success("Filter saved successfully");
  };

  const applySavedFilter = (filter: SavedFilter) => {
    if (filter.filters.status) setStatusFilter(filter.filters.status);
    if (filter.filters.creatorId) setCreatorFilter(filter.filters.creatorId);
    if (filter.filters.quickFilter) setQuickFilter(filter.filters.quickFilter);
    if (filter.filters.search) setSearch(filter.filters.search);
  };

  const deleteSavedFilter = (filterId: string) => {
    const updatedFilters = savedFilters.filter((f) => f.id !== filterId);
    setSavedFilters(updatedFilters);
    localStorage.setItem("savedRequestFilters", JSON.stringify(updatedFilters));
    toast.success("Filter deleted");
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setCreatorFilter("all");
    setPriorityFilter("all");
    setQuickFilter(null);
  };

  const hasActiveFilters = !!(search || statusFilter !== "all" || creatorFilter !== "all" || priorityFilter !== "all" || quickFilter || advancedFilter.conditions.some(c => c.field && c.value !== null));

  // Get selected requests for bulk operations
  const selectedRequests = useMemo(() => {
    return filteredRequests.filter((r) => selectedIds.has(r.id));
  }, [filteredRequests, selectedIds]);

  // Open bulk status dialog with specific action
  const openBulkDialog = useCallback((actionType: BulkActionType) => {
    setBulkStatusDialog({ open: true, actionType });
  }, []);

  // Refresh requests after bulk action
  const refreshRequests = useCallback(async () => {
    try {
      const refreshResponse = await fetch("/api/requests");
      if (refreshResponse.ok) {
        setRequests(await refreshResponse.json());
      }
      setSelectedIds(new Set());
    } catch (error) {
      console.error("Failed to refresh requests:", error);
    }
  }, []);

  // Select all visible requests
  const selectAllVisible = useCallback(() => {
    setSelectedIds(new Set(filteredRequests.map((r) => r.id)));
  }, [filteredRequests]);

  // Select all matching filter (same as selectAllVisible for now)
  const selectAllMatching = useCallback(() => {
    setSelectedIds(new Set(filteredRequests.map((r) => r.id)));
  }, [filteredRequests]);

  // Calculate counts for suggestions
  const pendingCount = useMemo(() =>
    requests.filter((r) => ["PENDING", "IN_PROGRESS"].includes(r.status)).length,
    [requests]
  );
  const overdueCount = useMemo(() =>
    requests.filter((r) => r.dueDate && isPast(new Date(r.dueDate)) && !["APPROVED", "ARCHIVED"].includes(r.status)).length,
    [requests]
  );

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Content Requests</h1>
          <p className="mt-1 text-sm md:text-base text-muted-foreground">
            Track and manage content requests from your creators
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto min-h-[44px]">
          <Link href="/dashboard/requests/new">
            <Plus className="mr-2 h-4 w-4" />
            New Request
          </Link>
        </Button>
      </div>

      {/* Smart Suggestions */}
      <RequestsSuggestions
        pendingRequests={pendingCount}
        overdueRequests={overdueCount}
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="drafts">Drafts</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Advanced Saved Filters */}
      <SavedFilters
        entityType="requests"
        fieldDefinitions={REQUEST_FILTER_FIELDS}
        relationOptions={relationOptions}
        currentFilter={advancedFilter}
        onFilterChange={setAdvancedFilter}
        onApplyFilter={() => {
          // When advanced filter is applied, we can trigger a refresh or re-filter
          // The actual filtering will be handled by the filteredRequests useMemo
        }}
      />

      {/* Filters */}
      <Card className="card-elevated">
        <CardContent className="p-3 md:p-6">
          <div className="space-y-4">
            {/* Search and main filters */}
            <div className="flex flex-col gap-3 md:flex-row md:gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search requests..."
                  className="pl-10 h-11 md:h-10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="flex-1 md:w-[140px] h-11 md:h-10">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="flex-1 md:w-[130px] h-11 md:h-10">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    {PRIORITY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <PriorityDot priority={option.value as Priority} size="sm" />
                          {option.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={creatorFilter} onValueChange={setCreatorFilter}>
                  <SelectTrigger className="flex-1 md:w-[140px] h-11 md:h-10">
                    <SelectValue placeholder="Creator" />
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
              </div>
            </div>

            {/* Sort and Group Options */}
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border">
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Sort:</span>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                  <SelectTrigger className="w-[140px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="priority">Priority & Deadline</SelectItem>
                    <SelectItem value="deadline">Deadline</SelectItem>
                    <SelectItem value="created">Created Date</SelectItem>
                    <SelectItem value="title">Title</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Group:</span>
                <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupOption)}>
                  <SelectTrigger className="w-[120px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Grouping</SelectItem>
                    <SelectItem value="priority">By Priority</SelectItem>
                    <SelectItem value="status">By Status</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Quick filters */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Quick filters:</span>
              {QUICK_FILTERS.map((filter) => {
                const Icon = filter.icon;
                const isActive = quickFilter === filter.id;
                return (
                  <Button
                    key={filter.id}
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    onClick={() => setQuickFilter(isActive ? null : filter.id)}
                    className="h-8"
                  >
                    <Icon className="mr-1.5 h-3.5 w-3.5" />
                    {filter.label}
                  </Button>
                );
              })}

              {/* Saved filters dropdown */}
              {savedFilters.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8">
                      <Filter className="mr-1.5 h-3.5 w-3.5" />
                      Saved Filters
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {savedFilters.map((filter) => (
                      <DropdownMenuItem
                        key={filter.id}
                        className="flex items-center justify-between"
                      >
                        <span onClick={() => applySavedFilter(filter)}>{filter.name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 ml-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSavedFilter(filter.id);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Save current filter */}
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  onClick={() => setSaveFilterDialog(true)}
                >
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                  Save Filter
                </Button>
              )}

              {/* Clear filters */}
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" className="h-8" onClick={clearFilters}>
                  <X className="mr-1.5 h-3.5 w-3.5" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <Card className="card-elevated border-primary bg-primary/5">
          <CardContent className="p-3 md:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <ListChecks className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium">
                    {selectedIds.size} request{selectedIds.size !== 1 ? "s" : ""} selected
                  </span>
                </div>
                <div className="hidden sm:flex items-center gap-2 border-l pl-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={selectAllVisible}
                  >
                    Select all visible ({filteredRequests.length})
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {/* Bulk Actions Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="default" size="sm" disabled={loading}>
                      <ChevronDown className="mr-1.5 h-4 w-4" />
                      Bulk Actions
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Update Selected</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => openBulkDialog("changeStatus")}>
                      <FileText className="mr-2 h-4 w-4" />
                      Change Status
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openBulkDialog("changePriority")}>
                      <Flag className="mr-2 h-4 w-4" />
                      Change Priority
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openBulkDialog("assignTeamMember")}>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Assign Team Member
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => openBulkDialog("sendReminder")}>
                      <Bell className="mr-2 h-4 w-4" />
                      Send Reminders
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => openBulkDialog("archive")}>
                      <Archive className="mr-2 h-4 w-4" />
                      Archive
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() =>
                        setBulkActionDialog({
                          open: true,
                          action: "delete",
                          title: "Delete Requests",
                          description: `Are you sure you want to delete ${selectedIds.size} request(s)? This action cannot be undone.`,
                        })
                      }
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Quick Actions */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openBulkDialog("changeStatus")}
                  disabled={loading}
                  className="hidden sm:flex"
                >
                  <FileText className="mr-1.5 h-4 w-4" />
                  Status
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openBulkDialog("changePriority")}
                  disabled={loading}
                  className="hidden md:flex"
                >
                  <Flag className="mr-1.5 h-4 w-4" />
                  Priority
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openBulkDialog("sendReminder")}
                  disabled={loading}
                  className="hidden lg:flex"
                >
                  <Bell className="mr-1.5 h-4 w-4" />
                  Remind
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedIds(new Set())}
                >
                  <X className="mr-1.5 h-4 w-4" />
                  Clear
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {filteredRequests.length === 0 ? (
        <NoRequests
          isFiltered={hasActiveFilters}
          onClearFilters={clearFilters}
          tabContext={activeTab as "all" | "drafts" | "active" | "completed" | "archived"}
        />
      ) : (
        <>

          {/* Overdue Requests Section */}
          {overdueRequests.length > 0 && groupBy === "none" && (
            <Card className="card-elevated border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 animate-pulse" />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-red-700 dark:text-red-400">
                      Overdue Requests
                    </CardTitle>
                    <CardDescription className="text-red-600/70 dark:text-red-400/70">
                      {overdueRequests.length} request{overdueRequests.length !== 1 ? "s" : ""} past deadline
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {overdueRequests.map((request) => (
                    <Link
                      key={request.id}
                      href={`/dashboard/requests/${request.id}`}
                      className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-gray-900 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <PriorityDot priority={request.urgency as Priority} animate />
                        <div className="min-w-0">
                          <p className="font-medium truncate">{request.title}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {request.creator.name}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <DeadlineCountdown deadline={request.dueDate} priority={request.urgency as Priority} size="sm" />
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Grouped View */}
          {groupBy !== "none" && groupedRequests && (
            <div className="space-y-4">
              {Object.entries(groupedRequests).map(([group, groupItems]) => {
                if ((groupItems as ContentRequest[]).length === 0) return null;
                const priorityConfig = groupBy === "priority" ? getPriorityConfig(group as Priority) : null;
                const groupStatusConfig = groupBy === "status" ? getStatusConfig(group) : null;

                return (
                  <Card key={group} className="card-elevated">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        {priorityConfig && (
                          <>
                            <PriorityDot priority={group as Priority} size="md" />
                            <CardTitle className="text-lg">{priorityConfig.label} Priority</CardTitle>
                          </>
                        )}
                        {groupStatusConfig && (
                          <>
                            <div className={`h-2 w-2 rounded-full ${groupStatusConfig.bgClass}`} />
                            <CardTitle className="text-lg">{groupStatusConfig.label}</CardTitle>
                          </>
                        )}
                        <Badge variant="secondary" className="ml-2">
                          {(groupItems as ContentRequest[]).length}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        {(groupItems as ContentRequest[]).map((request) => (
                          <Link
                            key={request.id}
                            href={`/dashboard/requests/${request.id}`}
                            className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <Checkbox
                                checked={selectedIds.has(request.id)}
                                onCheckedChange={() => toggleSelect(request.id)}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <div className="min-w-0">
                                <p className="font-medium truncate">{request.title}</p>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <span>{request.creator.name}</span>
                                  {request.dueDate && (
                                    <>
                                      <span>-</span>
                                      <DeadlineCountdown deadline={request.dueDate} priority={request.urgency as Priority} size="sm" />
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Badge variant="outline" className={getStatusConfig(request.status).class}>
                                {getStatusConfig(request.status).label}
                              </Badge>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </Link>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Standard List View (when not grouping) */}
          {groupBy === "none" && (
          <>
          {/* Mobile Card View */}
          <div className="block md:hidden space-y-3">
            <p className="text-sm text-muted-foreground px-1">
              {filteredRequests.length} request{filteredRequests.length !== 1 ? "s" : ""}
            </p>
            {filteredRequests.map((request) => {
              const statusConfig = getStatusConfig(request.status);
              const urgencyConfig = getUrgencyConfig(request.urgency);
              const dueDateStatus = getDueDateStatus(request.dueDate);
              const isSelected = selectedIds.has(request.id);

              return (
                <div key={request.id} className="group relative">
                  <Card
                    className={`card-elevated overflow-hidden transition-all ${
                      isSelected ? "ring-2 ring-primary" : ""
                    }`}
                  >
                    {/* Status indicator bar */}
                    <div className={`h-1 ${statusConfig.bgClass}`} />

                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        {/* Checkbox */}
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(request.id)}
                          className="mt-1"
                        />

                        {/* Creator Avatar */}
                        <Avatar className="h-10 w-10 flex-shrink-0">
                          <AvatarFallback className="bg-gradient-to-br from-primary to-violet-600 text-white text-sm font-semibold">
                            {request.creator.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>

                        {/* Request Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <Link
                              href={`/dashboard/requests/${request.id}`}
                              className="min-w-0 flex-1"
                            >
                              <h3 className="font-semibold text-foreground truncate pr-2 hover:text-primary transition-colors">
                                {request.title}
                              </h3>
                              <p className="text-sm text-muted-foreground truncate">
                                {request.creator.name}
                              </p>
                            </Link>

                            {/* Quick actions menu */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <Link href={`/dashboard/requests/${request.id}`}>
                                    View Details
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link href={`/dashboard/requests/${request.id}/edit`}>
                                    Edit Request
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setCloneDialog({ open: true, request })}
                                  className="text-indigo-600 dark:text-indigo-400"
                                >
                                  <Copy className="mr-2 h-4 w-4" />
                                  Clone Request
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleQuickAction(request.id, "sendReminders")}
                                >
                                  <Bell className="mr-2 h-4 w-4" />
                                  Send Reminder
                                </DropdownMenuItem>
                                <DropdownMenuSub>
                                  <DropdownMenuSubTrigger>Change Status</DropdownMenuSubTrigger>
                                  <DropdownMenuSubContent>
                                    {STATUS_OPTIONS.filter((s) => s.value !== "all").map((status) => (
                                      <DropdownMenuItem
                                        key={status.value}
                                        onClick={() =>
                                          handleQuickAction(request.id, "changeStatus", {
                                            status: status.value,
                                          })
                                        }
                                      >
                                        {status.label}
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuSubContent>
                                </DropdownMenuSub>
                                <DropdownMenuSub>
                                  <DropdownMenuSubTrigger>Change Priority</DropdownMenuSubTrigger>
                                  <DropdownMenuSubContent>
                                    {PRIORITY_OPTIONS.map((priority) => (
                                      <DropdownMenuItem
                                        key={priority.value}
                                        onClick={() =>
                                          handleQuickAction(request.id, "changePriority", {
                                            priority: priority.value,
                                          })
                                        }
                                      >
                                        {priority.label}
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuSubContent>
                                </DropdownMenuSub>
                                <DropdownMenuSeparator />
                                {request.status === "SUBMITTED" && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleQuickAction(request.id, "changeStatus", {
                                        status: "APPROVED",
                                      })
                                    }
                                    className="text-green-600"
                                  >
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Mark as Complete
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={() => handleQuickAction(request.id, "archive")}
                                >
                                  <Archive className="mr-2 h-4 w-4" />
                                  Archive
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          {/* Tags row */}
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <Badge variant="outline" className={`${statusConfig.class} text-[10px]`}>
                              {statusConfig.label}
                            </Badge>
                            {urgencyConfig.show && (
                              <Badge variant="secondary" className={`${urgencyConfig.class} text-[10px]`}>
                                {urgencyConfig.label}
                              </Badge>
                            )}
                            {request.template && (
                              <Badge variant="outline" className="text-[10px]">
                                {request.template.name}
                              </Badge>
                            )}
                          </div>

                          {/* Meta row */}
                          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                            <div className="flex items-center gap-4">
                              {request.dueDate && dueDateStatus && (
                                <div className={`flex items-center gap-1 text-xs ${dueDateStatus.class}`}>
                                  {dueDateStatus.status === "overdue" && (
                                    <AlertTriangle className="h-3 w-3" />
                                  )}
                                  <Calendar className="h-3 w-3" />
                                  <span>{dueDateStatus.label}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Upload className="h-3 w-3" />
                                <span>{request._count.uploads}</span>
                              </div>
                              {request._count.comments > 0 && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <MessageSquare className="h-3 w-3" />
                                  <span>{request._count.comments}</span>
                                </div>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View */}
          <Card className="card-elevated hidden md:block">
            <CardHeader>
              <CardTitle>All Requests</CardTitle>
              <CardDescription>
                {filteredRequests.length} request{filteredRequests.length !== 1 ? "s" : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">
                      <Checkbox
                        checked={
                          selectedIds.size === filteredRequests.length && filteredRequests.length > 0
                        }
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Request</TableHead>
                    <TableHead>Creator</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Uploads</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.map((request) => {
                    const statusConfig = getStatusConfig(request.status);
                    const urgencyConfig = getUrgencyConfig(request.urgency);
                    const isSelected = selectedIds.has(request.id);

                    return (
                      <TableRow
                        key={request.id}
                        className={`group ${isSelected ? "bg-muted/50" : ""}`}
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
                              className="font-medium hover:text-primary transition-colors"
                            >
                              {request.title}
                            </Link>
                            <div className="flex gap-2">
                              {request.template && (
                                <Badge variant="outline" className="text-xs">
                                  {request.template.name}
                                </Badge>
                              )}
                              {urgencyConfig.show && (
                                <Badge variant="secondary" className={urgencyConfig.class}>
                                  {urgencyConfig.label}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/dashboard/creators/${request.creator.id}`}
                            className="hover:text-primary transition-colors"
                          >
                            {request.creator.name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-auto p-0">
                                <Badge variant="outline" className={`${statusConfig.class} cursor-pointer`}>
                                  {statusConfig.label}
                                </Badge>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              {STATUS_OPTIONS.filter((s) => s.value !== "all").map((status) => (
                                <DropdownMenuItem
                                  key={status.value}
                                  onClick={() =>
                                    handleQuickAction(request.id, "changeStatus", {
                                      status: status.value,
                                    })
                                  }
                                >
                                  {status.label}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                        <TableCell>
                          {request.dueDate ? (
                            <div className="flex items-center gap-1.5 text-sm">
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                              {format(new Date(request.dueDate), "MMM d, yyyy")}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">No due date</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Upload className="h-4 w-4 text-muted-foreground" />
                            {request._count.uploads}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleQuickAction(request.id, "sendReminders")}
                              title="Send Reminder"
                            >
                              <Bell className="h-4 w-4" />
                            </Button>
                            {request.status === "SUBMITTED" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-green-600"
                                onClick={() =>
                                  handleQuickAction(request.id, "changeStatus", {
                                    status: "APPROVED",
                                  })
                                }
                                title="Mark as Complete"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem asChild>
                                  <Link href={`/dashboard/requests/${request.id}`}>
                                    View Details
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link href={`/dashboard/requests/${request.id}/edit`}>
                                    Edit Request
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setCloneDialog({ open: true, request })}
                                  className="text-indigo-600 dark:text-indigo-400"
                                >
                                  <Copy className="mr-2 h-4 w-4" />
                                  Clone Request
                                </DropdownMenuItem>
                                {request.status === "SUBMITTED" && (
                                  <DropdownMenuItem asChild>
                                    <Link href={`/dashboard/requests/${request.id}/review`}>
                                      Review Uploads
                                    </Link>
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuSub>
                                  <DropdownMenuSubTrigger>Change Priority</DropdownMenuSubTrigger>
                                  <DropdownMenuSubContent>
                                    {PRIORITY_OPTIONS.map((priority) => (
                                      <DropdownMenuItem
                                        key={priority.value}
                                        onClick={() =>
                                          handleQuickAction(request.id, "changePriority", {
                                            priority: priority.value,
                                          })
                                        }
                                      >
                                        {priority.label}
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuSubContent>
                                </DropdownMenuSub>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleQuickAction(request.id, "archive")}
                                >
                                  <Archive className="mr-2 h-4 w-4" />
                                  Archive
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
          </>
          )}
        </>
      )}

      {/* Floating Action Button for Mobile */}
      {filteredRequests.length > 0 && (
        <Link
          href="/dashboard/requests/new"
          className="fixed z-40 flex md:hidden items-center justify-center h-14 w-14 rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 active:scale-95 transition-transform touch-manipulation"
          style={{
            bottom: "calc(80px + env(safe-area-inset-bottom, 0px))",
            right: "16px",
          }}
        >
          <Plus className="h-6 w-6" />
        </Link>
      )}

      {/* Bulk Action Confirmation Dialog */}
      <Dialog
        open={bulkActionDialog.open}
        onOpenChange={(open) =>
          setBulkActionDialog({ ...bulkActionDialog, open })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{bulkActionDialog.title}</DialogTitle>
            <DialogDescription>{bulkActionDialog.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setBulkActionDialog({ open: false, action: null, title: "", description: "" })
              }
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant={bulkActionDialog.action === "delete" ? "destructive" : "default"}
              onClick={() => bulkActionDialog.action && performBulkAction(bulkActionDialog.action)}
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Filter Dialog */}
      <Dialog open={saveFilterDialog} onOpenChange={setSaveFilterDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Filter</DialogTitle>
            <DialogDescription>
              Save your current filter settings for quick access later.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Filter name"
              value={newFilterName}
              onChange={(e) => setNewFilterName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveFilterDialog(false)}>
              Cancel
            </Button>
            <Button onClick={saveFilter}>Save Filter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clone Request Dialog */}
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
          onOpenChange={(open) => setCloneDialog({ ...cloneDialog, open })}
          onCloneSuccess={(clonedRequestIds) => {
            toast.success(`Successfully created ${clonedRequestIds.length} cloned request(s)`);
            // Refresh requests
            fetch("/api/requests")
              .then((res) => res.json())
              .then((data) => setRequests(data))
              .catch(console.error);
          }}
        />
      )}

      {/* Bulk Status Dialog */}
      <BulkStatusDialog
        open={bulkStatusDialog.open}
        onOpenChange={(open) => setBulkStatusDialog({ ...bulkStatusDialog, open })}
        actionType={bulkStatusDialog.actionType}
        selectedRequests={selectedRequests}
        teamMembers={teamMembers}
        onSuccess={refreshRequests}
      />

      {/* Back to Top Button */}
      <BackToTop threshold={400} variant="gradient" />
    </div>
  );
}
