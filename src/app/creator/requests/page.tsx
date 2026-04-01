"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Search,
  FileText,
  ArrowUpDown,
  Grid3X3,
  List,
  ArrowRight,
  Upload,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isPast, format } from "date-fns";
import { useBranding } from "@/components/providers/branding-provider";

type RequestStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "NEEDS_REVISION"
  | "APPROVED";

interface Request {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: RequestStatus;
  urgency: string;
  createdAt: string;
  _count: {
    uploads: number;
    comments: number;
  };
}

type FilterTab = "all" | "active" | "completed" | "overdue";
type SortOption = "due_date" | "created_date" | "title" | "status";

export default function CreatorRequestsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { branding } = useBranding();

  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<Request[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>(
    (searchParams.get("filter") as FilterTab) || "all"
  );
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
    } catch (error) {
      console.error("Error fetching requests:", error);
    } finally {
      setLoading(false);
    }
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
      case "completed":
        filtered = filtered.filter(
          (r) =>
            r.status === "SUBMITTED" ||
            r.status === "UNDER_REVIEW" ||
            r.status === "APPROVED"
        );
        break;
      case "overdue":
        filtered = filtered.filter(
          (r) =>
            r.dueDate &&
            isPast(new Date(r.dueDate)) &&
            r.status !== "APPROVED" &&
            r.status !== "SUBMITTED"
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
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        case "created_date":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "title":
          return a.title.localeCompare(b.title);
        case "status":
          const statusOrder = [
            "NEEDS_REVISION",
            "PENDING",
            "IN_PROGRESS",
            "SUBMITTED",
            "UNDER_REVIEW",
            "APPROVED",
          ];
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
    const completed = requests.filter(
      (r) =>
        r.status === "SUBMITTED" ||
        r.status === "UNDER_REVIEW" ||
        r.status === "APPROVED"
    ).length;
    const overdue = requests.filter(
      (r) =>
        r.dueDate &&
        isPast(new Date(r.dueDate)) &&
        r.status !== "APPROVED" &&
        r.status !== "SUBMITTED"
    ).length;

    return { all, active, completed, overdue };
  }, [requests]);

  const getStatusColor = (status: RequestStatus) => {
    switch (status) {
      case "PENDING":
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
      case "IN_PROGRESS":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "SUBMITTED":
        return "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400";
      case "UNDER_REVIEW":
        return "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400";
      case "NEEDS_REVISION":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      case "APPROVED":
        return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2
            className="h-10 w-10 animate-spin mx-auto"
            style={{ color: branding.primaryColor }}
          />
          <p className="text-muted-foreground">Loading requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold">All Requests</h1>
        <p className="text-muted-foreground">
          View and manage all your content requests
        </p>
      </div>

      {/* Filters and Search */}
      <div className="space-y-4">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as FilterTab)}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <TabsList className="w-full sm:w-auto overflow-x-auto">
              <TabsTrigger value="all" className="gap-2 flex-1 sm:flex-none">
                All
                <span className="text-xs bg-muted px-1.5 py-0.5 rounded-md hidden sm:inline">
                  {tabCounts.all}
                </span>
              </TabsTrigger>
              <TabsTrigger value="active" className="gap-2 flex-1 sm:flex-none">
                Active
                <span className="text-xs bg-muted px-1.5 py-0.5 rounded-md hidden sm:inline">
                  {tabCounts.active}
                </span>
              </TabsTrigger>
              <TabsTrigger value="completed" className="gap-2 flex-1 sm:flex-none">
                Done
                <span className="text-xs bg-muted px-1.5 py-0.5 rounded-md hidden sm:inline">
                  {tabCounts.completed}
                </span>
              </TabsTrigger>
              {tabCounts.overdue > 0 && (
                <TabsTrigger value="overdue" className="gap-2 text-red-600 flex-1 sm:flex-none">
                  Late
                  <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-md">
                    {tabCounts.overdue}
                  </span>
                </TabsTrigger>
              )}
            </TabsList>

            {/* View mode toggle - desktop only */}
            <div className="hidden sm:flex items-center gap-1 bg-muted rounded-lg p-1">
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode("grid")}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Search and Sort */}
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search requests..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10"
              />
            </div>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-full sm:w-[180px] h-10">
                <ArrowUpDown className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="due_date">Due Date</SelectItem>
                <SelectItem value="created_date">Created Date</SelectItem>
                <SelectItem value="title">Title</SelectItem>
                <SelectItem value="status">Status</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Results */}
          <TabsContent value={activeTab} className="mt-6">
            {filteredRequests.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-lg mb-1">No requests found</h3>
                  <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                    {searchQuery
                      ? "Try adjusting your search or filters."
                      : "There are no requests in this category."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div
                className={cn(
                  viewMode === "grid"
                    ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                    : "space-y-3"
                )}
              >
                {filteredRequests.map((request) => (
                  <Link key={request.id} href={`/creator/requests/${request.id}`}>
                    <Card className="group hover:shadow-md transition-all cursor-pointer h-full">
                      <CardContent className={cn(
                        "py-4",
                        viewMode === "grid" && "h-full flex flex-col"
                      )}>
                        <div className={cn(
                          "flex gap-4",
                          viewMode === "grid" ? "flex-col h-full" : "items-center"
                        )}>
                          <div className={cn(
                            "flex-1 min-w-0",
                            viewMode === "grid" && "flex flex-col flex-1"
                          )}>
                            <div className={cn(
                              "flex items-center gap-2 mb-1",
                              viewMode === "grid" && "flex-wrap"
                            )}>
                              <h3 className="font-medium truncate group-hover:text-primary transition-colors">
                                {request.title}
                              </h3>
                              <Badge
                                variant="secondary"
                                className={cn("shrink-0 text-xs", getStatusColor(request.status))}
                              >
                                {request.status.replace("_", " ")}
                              </Badge>
                            </div>
                            {request.description && (
                              <p className={cn(
                                "text-sm text-muted-foreground",
                                viewMode === "grid" ? "line-clamp-2 flex-1" : "line-clamp-1"
                              )}>
                                {request.description}
                              </p>
                            )}
                            <div className={cn(
                              "flex items-center gap-4 text-xs text-muted-foreground",
                              viewMode === "grid" ? "mt-auto pt-3" : "mt-2"
                            )}>
                              {request.dueDate && (
                                <span className={cn(
                                  "flex items-center gap-1",
                                  isPast(new Date(request.dueDate)) &&
                                  request.status !== "APPROVED" &&
                                  request.status !== "SUBMITTED" &&
                                  "text-red-500 font-medium"
                                )}>
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(request.dueDate), "MMM d")}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Upload className="h-3 w-3" />
                                {request._count?.uploads || 0}
                              </span>
                            </div>
                          </div>
                          {viewMode === "list" && (
                            <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
