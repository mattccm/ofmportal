"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, ArrowUpDown, LayoutGrid, List, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { isRequestOverdue } from "@/lib/request-status";
import { TitleCard, formatDay } from "@/components/title-wall";
import type { CreatorFieldStateRow } from "@/lib/creator-field-states";
import { ACTIONABLE, IN_REVIEW, creatorSummary, toStrip } from "@/components/portal/creator-words";
import { RequestRow } from "@/components/portal/request-row";

const VIEW_MODES = [
  ["list", List, "List"],
  ["grid", LayoutGrid, "Covers"],
] as const;

// Approved, cancelled and archived requests never reach the creator
type RequestStatus = "PENDING" | "IN_PROGRESS" | "SUBMITTED" | "UNDER_REVIEW" | "NEEDS_REVISION";

interface Request {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: RequestStatus;
  urgency: string;
  createdAt: string;
  submittedAt?: string | null;
  _count: {
    uploads: number;
    comments: number;
  };
  completion?: {
    totalSlots: number;
    uploadedSlots: number;
    approvedSlots: number;
  };
  unreadFeedbackCount?: number;
  estimatedMinutes?: number | null;
  fieldStates?: CreatorFieldStateRow[];
}

type FilterTab = "all" | "active" | "review" | "overdue";
type SortOption = "due_date" | "created_date" | "title" | "status";

export default function CreatorRequestsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [requests, setRequests] = useState<Request[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>(() => {
    const f = searchParams.get("filter");
    // "completed" is the old name for what is now "In review"
    if (f === "completed") return "review";
    return f === "active" || f === "review" || f === "overdue" ? f : "all";
  });
  const [sortBy, setSortBy] = useState<SortOption>("due_date");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");

  useEffect(() => {
    const token = localStorage.getItem("creatorToken");
    const creatorId = localStorage.getItem("creatorId");

    if (!token || !creatorId) {
      router.push("/login");
      return;
    }

    fetchRequests();
  }, [router]);

  const fetchRequests = async () => {
    try {
      const token = localStorage.getItem("creatorToken");
      const response = await fetch(`/api/portal/requests`, {
        headers: {
          "x-creator-token": token || "",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch requests");
      }

      const data = await response.json();
      setRequests(data);
      setLoadError(false);
    } catch (error) {
      console.error("Error fetching requests:", error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const retryFetch = () => {
    setLoadError(false);
    setLoading(true);
    fetchRequests();
  };

  const filteredRequests = useMemo(() => {
    let filtered = [...requests];

    switch (activeTab) {
      case "active":
        filtered = filtered.filter(
          (r) =>
            r.status === "PENDING" ||
            r.status === "IN_PROGRESS" ||
            r.status === "NEEDS_REVISION"
        );
        break;
      case "review":
        filtered = filtered.filter((r) => IN_REVIEW.has(r.status));
        break;
      case "overdue":
        filtered = filtered.filter(
          (r) => isRequestOverdue(r)
        );
        break;
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.title.toLowerCase().includes(query) ||
          r.description?.toLowerCase().includes(query)
      );
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case "due_date":
          // what is still to do comes before what is already sent
          if (ACTIONABLE.has(a.status) !== ACTIONABLE.has(b.status)) return ACTIONABLE.has(a.status) ? -1 : 1;
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        case "created_date":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "title":
          return a.title.localeCompare(b.title);
        case "status":
          const statusOrder = ["NEEDS_REVISION", "PENDING", "IN_PROGRESS", "SUBMITTED", "UNDER_REVIEW"];
          return statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
        default:
          return 0;
      }
    });

    return filtered;
  }, [requests, activeTab, searchQuery, sortBy]);

  const tabCounts = useMemo(() => {
    const all = requests.length;
    const active = requests.filter(
      (r) =>
        r.status === "PENDING" ||
        r.status === "IN_PROGRESS" ||
        r.status === "NEEDS_REVISION"
    ).length;
    const review = requests.filter((r) => IN_REVIEW.has(r.status)).length;
    const overdue = requests.filter(
      (r) => isRequestOverdue(r)
    ).length;

    return { all, active, review, overdue };
  }, [requests]);

  if (loading) {
    return (
      <div className="px-4 pt-5 lg:px-6 lg:pt-10" role="status" aria-label="Loading your requests">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="mt-4 h-11 w-full" />
        <Skeleton className="mt-4 h-[88px] w-full" />
        <Skeleton className="mt-2 h-[88px] w-full" />
        <Skeleton className="mt-2 h-[88px] w-full" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="px-4 pt-5 lg:px-6 lg:pt-10">
        <h1 className="text-[22px] font-semibold leading-tight lg:text-[26px]">Requests</h1>
        <div className="mt-4 max-w-[560px] rounded-[10px] bg-tile p-4">
          <p className="text-[15px]">Your requests didn&apos;t load. Check your connection, then try again.</p>
          <Button variant="outline" className="mt-3 h-11" onClick={retryFetch}>
            <RefreshCw aria-hidden="true" />
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const tabs: Array<[FilterTab, string, number]> = [
    ["all", "All", tabCounts.all],
    ["active", "To do", tabCounts.active],
    ["review", "In review", tabCounts.review],
    ...(tabCounts.overdue > 0 ? ([["overdue", "Late", tabCounts.overdue]] as Array<[FilterTab, string, number]>) : []),
  ];

  return (
    <div className="px-4 pt-5 lg:px-6 lg:pt-10">
      <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.01em] lg:text-[26px]">Requests</h1>
      <p className="mt-1 text-[15px] leading-normal text-ink-2">
        {tabCounts.all === 0
          ? "Nothing yet. New requests appear here."
          : `${tabCounts.active} to do${tabCounts.overdue ? `, ${tabCounts.overdue} late` : ""}. ${tabCounts.all} open in all.`}
      </p>

      {/* From 1024px the filters, search, sort and display sit on one line */}
      <div className="lg:mt-5 lg:flex lg:items-center lg:gap-3">
        <div className="mt-4 flex flex-wrap rounded-[var(--tw-r-ctl)] bg-well p-1 lg:mt-0 lg:flex-none" role="group" aria-label="Show">
          {tabs.map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              aria-pressed={activeTab === key}
              onClick={() => setActiveTab(key)}
              className={cn(
                "inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 text-[14px] font-medium transition-colors md:min-h-9",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                activeTab === key ? "!bg-tile-hi text-ink" : "text-ink-2 hover:text-ink"
              )}
            >
              {label}
              <span className={cn("tabular-nums", key === "overdue" ? "text-late" : "text-ink-2")}>{count}</span>
            </button>
          ))}
        </div>

        <div className="mt-3 flex gap-2 lg:mt-0 lg:flex-1">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search requests</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-icon" aria-hidden="true" />
            <Input placeholder="Search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
          </label>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-[150px] shrink-0" aria-label="Sort requests">
              <ArrowUpDown className="size-4 text-icon" aria-hidden="true" />
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="due_date">Due first</SelectItem>
              <SelectItem value="created_date">Newest</SelectItem>
              <SelectItem value="title">Title</SelectItem>
              <SelectItem value="status">Status</SelectItem>
            </SelectContent>
          </Select>
          <div className="hidden shrink-0 rounded-[var(--tw-r-ctl)] bg-well p-1 sm:flex" role="group" aria-label="Display">
            {VIEW_MODES.map(([mode, Icon, label]) => (
              <button
                key={mode}
                type="button"
                aria-pressed={viewMode === mode}
                aria-label={label}
                title={label}
                onClick={() => setViewMode(mode)}
                className={cn(
                  "grid size-9 place-items-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                  viewMode === mode ? "!bg-tile-hi text-ink" : "text-icon hover:text-ink"
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      </div>

      <section aria-label="Requests" className="mt-4 lg:mt-5">
        {filteredRequests.length === 0 ? (
          <div className="rounded-[10px] bg-tile p-4">
            <p className="text-[15px] font-semibold">{searchQuery ? "No requests match that search" : "Nothing here"}</p>
            <p className="mt-1 text-[14px] leading-normal text-ink-2">
              {searchQuery
                ? "Try fewer words, or search for part of the title."
                : activeTab === "active"
                  ? "You have nothing to upload right now. New requests appear here."
                  : activeTab === "review"
                    ? "Requests you submit wait here until they are reviewed. Approved requests leave your list."
                    : "Nothing late. Requests past their due date show here."}
            </p>
          </div>
        ) : viewMode === "grid" ? (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredRequests.map((r) => (
              <li key={r.id}>
                <TitleCard
                  audience="creator"
                  title={r.title}
                  creator={`Sent ${formatDay(r.createdAt)}`}
                  due={IN_REVIEW.has(r.status) ? undefined : r.dueDate}
                  timeText={IN_REVIEW.has(r.status) ? (r.submittedAt ? `Submitted ${formatDay(r.submittedAt)}` : "In review") : undefined}
                  fields={toStrip(r.fieldStates)}
                  meta={creatorSummary(r.fieldStates)}
                  href={`/creator/requests/${r.id}`}
                />
              </li>
            ))}
          </ul>
        ) : (
          <ul className="space-y-2">
            {filteredRequests.map((r) => (
              <li key={r.id}>
                <RequestRow request={r} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
