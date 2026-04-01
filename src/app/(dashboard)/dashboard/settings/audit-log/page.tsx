"use client";

import * as React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Shield,
  ChevronLeft,
  FileText,
  AlertTriangle,
  Clock,
  Users,
  Activity,
  TrendingUp,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AuditLogTable, FilterState } from "@/components/audit/audit-log-table";
import { BackToTop } from "@/components/ui/back-to-top";

// ============================================
// TYPES
// ============================================

interface AuditUser {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
}

interface AuditLog {
  id: string;
  userId: string | null;
  user: AuditUser | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

interface Filters {
  actionTypes: string[];
  entityTypes: string[];
  users: { id: string; name: string; email: string }[];
}

interface AuditLogResponse {
  logs: AuditLog[];
  pagination: Pagination;
  filters: Filters;
}

// ============================================
// STATS COMPONENT
// ============================================

function AuditStats({
  total,
  todayCount,
  uniqueUsers,
}: {
  total: number;
  todayCount: number;
  uniqueUsers: number;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Card className="card-elevated">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
              <Activity className="h-5 w-5 text-indigo-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{total.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Total Events</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="card-elevated">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-violet-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{todayCount.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Today&apos;s Events</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="card-elevated">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{uniqueUsers}</p>
              <p className="text-sm text-muted-foreground">Active Users</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// MAIN PAGE COMPONENT
// ============================================

export default function AuditLogPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [logs, setLogs] = React.useState<AuditLog[]>([]);
  const [pagination, setPagination] = React.useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
    hasMore: false,
  });
  const [filters, setFilters] = React.useState<Filters>({
    actionTypes: [],
    entityTypes: [],
    users: [],
  });
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Filter and sort state
  const [currentFilters, setCurrentFilters] = React.useState<FilterState>({
    search: "",
    userId: "",
    action: "",
    entityType: "",
    startDate: "",
    endDate: "",
  });
  const [currentSort, setCurrentSort] = React.useState<{
    sortBy: string;
    sortOrder: "asc" | "desc";
  }>({
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  // Check authorization
  React.useEffect(() => {
    if (status === "loading") return;

    if (!session) {
      router.push("/login");
      return;
    }

    if (!["ADMIN", "OWNER"].includes(session.user.role)) {
      router.push("/dashboard");
      return;
    }
  }, [session, status, router]);

  // Fetch audit logs
  const fetchLogs = React.useCallback(
    async (page: number = 1) => {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: pagination.limit.toString(),
          sortBy: currentSort.sortBy,
          sortOrder: currentSort.sortOrder,
        });

        if (currentFilters.search) params.set("search", currentFilters.search);
        if (currentFilters.userId) params.set("userId", currentFilters.userId);
        if (currentFilters.action) params.set("action", currentFilters.action);
        if (currentFilters.entityType) params.set("entityType", currentFilters.entityType);
        if (currentFilters.startDate) params.set("startDate", currentFilters.startDate);
        if (currentFilters.endDate) params.set("endDate", currentFilters.endDate);

        const response = await fetch(`/api/audit-log?${params.toString()}`);

        if (!response.ok) {
          if (response.status === 403) {
            throw new Error("You do not have permission to view audit logs");
          }
          throw new Error("Failed to fetch audit logs");
        }

        const data: AuditLogResponse = await response.json();

        setLogs(data.logs);
        setPagination(data.pagination);
        setFilters(data.filters);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    },
    [pagination.limit, currentSort, currentFilters]
  );

  // Initial load
  React.useEffect(() => {
    if (session && ["ADMIN", "OWNER"].includes(session.user.role)) {
      fetchLogs(1);
    }
  }, [session, fetchLogs]);

  // Handler functions
  const handlePageChange = (page: number) => {
    fetchLogs(page);
  };

  const handleFilterChange = (newFilters: FilterState) => {
    setCurrentFilters(newFilters);
    // Reset to page 1 when filters change
    fetchLogs(1);
  };

  const handleSortChange = (sortBy: string, sortOrder: "asc" | "desc") => {
    setCurrentSort({ sortBy, sortOrder });
    // Reset to page 1 when sort changes
    fetchLogs(1);
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        export: "csv",
        sortBy: currentSort.sortBy,
        sortOrder: currentSort.sortOrder,
      });

      if (currentFilters.search) params.set("search", currentFilters.search);
      if (currentFilters.userId) params.set("userId", currentFilters.userId);
      if (currentFilters.action) params.set("action", currentFilters.action);
      if (currentFilters.entityType) params.set("entityType", currentFilters.entityType);
      if (currentFilters.startDate) params.set("startDate", currentFilters.startDate);
      if (currentFilters.endDate) params.set("endDate", currentFilters.endDate);

      const response = await fetch(`/api/audit-log?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Failed to export audit logs");
      }

      // Get the filename from the Content-Disposition header
      const contentDisposition = response.headers.get("Content-Disposition");
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] || `audit-log-${new Date().toISOString().split("T")[0]}.csv`;

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export");
    }
  };

  const handleRefresh = () => {
    fetchLogs(pagination.page);
  };

  // Calculate stats
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayCount = logs.filter((log) => new Date(log.createdAt) >= todayStart).length;

  // Loading state
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="h-5 w-5 animate-spin" />
          Loading...
        </div>
      </div>
    );
  }

  // Authorization check
  if (!session || !["ADMIN", "OWNER"].includes(session.user.role)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertTriangle className="h-12 w-12 text-amber-500" />
        <h2 className="text-xl font-semibold">Access Denied</h2>
        <p className="text-muted-foreground">
          You do not have permission to view this page.
        </p>
        <Button asChild>
          <Link href="/dashboard">Return to Dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href="/dashboard/settings">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex items-center gap-4 flex-1">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 via-violet-500/20 to-purple-500/20 flex items-center justify-center">
            <Shield className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Audit Log</h1>
            <p className="text-muted-foreground">
              Track all system activities and user actions
            </p>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <Card className="card-elevated border-indigo-200/50 bg-gradient-to-r from-indigo-50/50 to-violet-50/50 dark:from-indigo-950/20 dark:to-violet-950/20 dark:border-indigo-800/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5 text-indigo-500" />
            </div>
            <div>
              <h3 className="font-semibold text-indigo-700 dark:text-indigo-400">
                System Activity Monitor
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                This log records all significant actions performed in the system, including user
                authentication, content changes, and administrative operations. Use the filters to
                narrow down specific events or export the data for compliance reporting.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <AuditStats
        total={pagination.total}
        todayCount={todayCount}
        uniqueUsers={filters.users.length}
      />

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 text-red-700 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
              <p>{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                className="ml-auto"
              >
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Audit Log Table */}
      <Card className="card-elevated">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-indigo-500" />
            Activity Log
          </CardTitle>
          <CardDescription>
            View and filter all recorded system activities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuditLogTable
            logs={logs}
            pagination={pagination}
            filters={filters}
            isLoading={isLoading}
            onPageChange={handlePageChange}
            onFilterChange={handleFilterChange}
            onSortChange={handleSortChange}
            onExport={handleExport}
            onRefresh={handleRefresh}
            currentFilters={currentFilters}
            currentSort={currentSort}
          />
        </CardContent>
      </Card>

      {/* Back to Top Button */}
      <BackToTop position="bottom-right" variant="gradient" />
    </div>
  );
}
