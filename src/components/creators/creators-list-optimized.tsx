"use client";

import * as React from "react";
import Link from "next/link";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Mail,
  Phone,
  MoreHorizontal,
  FileText,
  Clock,
  Upload,
  ChevronRight,
  Search,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useInfiniteQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/cache";

// ============================================
// TYPES
// ============================================

interface Creator {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  inviteStatus: string;
  lastLoginAt: Date | null;
  createdAt: Date;
  _count: {
    requests: number;
    uploads: number;
  };
  requests: { id: string }[];
}

interface PaginatedResponse {
  data: Creator[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

interface CreatorsListOptimizedProps {
  initialData?: PaginatedResponse;
  favoriteIds?: string[];
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getInviteStatusBadge(status: string, compact = false) {
  const configs: Record<string, { class: string; label: string; shortLabel: string }> = {
    PENDING: {
      class: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800",
      label: "Invite Pending",
      shortLabel: "Pending",
    },
    ACCEPTED: {
      class: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
      label: "Active",
      shortLabel: "Active",
    },
    EXPIRED: {
      class: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
      label: "Invite Expired",
      shortLabel: "Expired",
    },
  };

  const config = configs[status];
  if (!config) return null;

  return (
    <Badge variant="outline" className={config.class}>
      {compact ? config.shortLabel : config.label}
    </Badge>
  );
}

// ============================================
// FETCH FUNCTION
// ============================================

async function fetchCreators(params: {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: string;
}): Promise<PaginatedResponse> {
  const searchParams = new URLSearchParams({
    page: params.page.toString(),
    limit: params.limit.toString(),
  });

  if (params.search) searchParams.set("search", params.search);
  if (params.status && params.status !== "all") searchParams.set("status", params.status);
  if (params.sortBy) searchParams.set("sortBy", params.sortBy);
  if (params.sortOrder) searchParams.set("sortOrder", params.sortOrder);

  const response = await fetch(`/api/creators?${searchParams}`);
  if (!response.ok) throw new Error("Failed to fetch creators");
  return response.json();
}

// ============================================
// OPTIMIZED CREATORS LIST COMPONENT
// ============================================

export function CreatorsListOptimized({
  initialData,
  favoriteIds = [],
}: CreatorsListOptimizedProps) {
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [sortBy, setSortBy] = React.useState("createdAt");
  const [sortOrder, setSortOrder] = React.useState("desc");

  const parentRef = React.useRef<HTMLDivElement>(null);

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Infinite query for pagination
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
  } = useInfiniteQuery({
    queryKey: queryKeys.creators.list({ search: debouncedSearch, status: statusFilter, sortBy, sortOrder }),
    queryFn: ({ pageParam = 1 }) =>
      fetchCreators({
        page: pageParam,
        limit: 25,
        search: debouncedSearch,
        status: statusFilter,
        sortBy,
        sortOrder,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasNextPage ? lastPage.pagination.page + 1 : undefined,
    initialPageParam: 1,
    staleTime: 30000,
  });

  // Flatten all pages into single array
  const allCreators = React.useMemo(() => {
    return data?.pages.flatMap((page) => page.data) ?? [];
  }, [data]);

  const totalCount = data?.pages[0]?.pagination.total ?? 0;

  // Virtualizer for the table
  const rowVirtualizer = useVirtualizer({
    count: allCreators.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 5,
  });

  // Load more when scrolling near end
  React.useEffect(() => {
    const [lastItem] = [...rowVirtualizer.getVirtualItems()].reverse();

    if (!lastItem) return;

    if (
      lastItem.index >= allCreators.length - 5 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage();
    }
  }, [
    hasNextPage,
    fetchNextPage,
    allCreators.length,
    isFetchingNextPage,
    rowVirtualizer.getVirtualItems(),
  ]);


  if (isError) {
    return (
      <Card className="card-elevated">
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground mb-4">Failed to load creators</p>
          <Button onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="card-elevated">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search creators..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="ACCEPTED">Active</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="EXPIRED">Expired</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt">Date Added</SelectItem>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="lastLoginAt">Last Active</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Mobile Card View */}
      <div className="block md:hidden space-y-3">
        <p className="text-sm text-muted-foreground px-1">
          {totalCount} creator{totalCount !== 1 ? "s" : ""} in your agency
        </p>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          allCreators.map((creator) => (
            <Card key={creator.id} className="card-elevated relative overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <Link href={`/dashboard/creators/${creator.id}`}>
                    <Avatar className="h-12 w-12 flex-shrink-0">
                      <AvatarFallback className="bg-gradient-to-br from-primary to-violet-600 text-white text-lg font-semibold">
                        {creator.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Link>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          href={`/dashboard/creators/${creator.id}`}
                          className="font-semibold text-foreground truncate block hover:text-primary transition-colors"
                        >
                          {creator.name}
                        </Link>
                        <p className="text-sm text-muted-foreground truncate">
                          {creator.email}
                        </p>
                      </div>
                      <Link href={`/dashboard/creators/${creator.id}`}>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </Link>
                    </div>

                    <div className="flex items-center gap-4 mt-3">
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <FileText className="h-4 w-4" />
                        <span>{creator._count.requests} active</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Upload className="h-4 w-4" />
                        <span>{creator._count.uploads} uploads</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                      {getInviteStatusBadge(creator.inviteStatus, true)}
                      <span className="text-xs text-muted-foreground">
                        {creator.lastLoginAt
                          ? `Active ${formatDistanceToNow(new Date(creator.lastLoginAt), { addSuffix: true })}`
                          : "Never logged in"}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
        {isFetchingNextPage && (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
      </div>

      {/* Desktop Virtualized Table View */}
      <Card className="card-elevated hidden md:block">
        <CardHeader>
          <CardTitle>All Creators</CardTitle>
          <CardDescription>
            {totalCount} creator{totalCount !== 1 ? "s" : ""} in your agency
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="rounded-md border">
              {/* Table Header */}
              <div className="flex border-b bg-muted/50 font-medium text-sm text-muted-foreground">
                <div className="w-[40px] p-3"></div>
                <div className="flex-1 min-w-[200px] p-3">Creator</div>
                <div className="w-[200px] p-3">Contact</div>
                <div className="w-[120px] p-3">Status</div>
                <div className="w-[100px] p-3">Requests</div>
                <div className="w-[100px] p-3">Uploads</div>
                <div className="w-[150px] p-3">Last Active</div>
                <div className="w-[50px] p-3"></div>
              </div>

              {/* Virtualized Body */}
              <div
                ref={parentRef}
                className="h-[500px] overflow-auto"
              >
                <div
                  style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    width: "100%",
                    position: "relative",
                  }}
                >
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const creator = allCreators[virtualRow.index];
                    return (
                      <div
                        key={creator.id}
                        className="absolute top-0 left-0 w-full flex items-center border-b hover:bg-muted/30 transition-colors"
                        style={{
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <div className="flex-1 min-w-[200px] p-3">
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarFallback className="bg-gradient-to-br from-primary to-violet-600 text-white">
                                {creator.name.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <Link
                              href={`/dashboard/creators/${creator.id}`}
                              className="font-medium hover:text-primary transition-colors"
                            >
                              {creator.name}
                            </Link>
                          </div>
                        </div>
                        <div className="w-[200px] p-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Mail className="h-3.5 w-3.5" />
                              <span className="truncate">{creator.email}</span>
                            </div>
                            {creator.phone && (
                              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                <Phone className="h-3.5 w-3.5" />
                                {creator.phone}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="w-[120px] p-3">
                          {getInviteStatusBadge(creator.inviteStatus)}
                        </div>
                        <div className="w-[100px] p-3">
                          <div className="flex items-center gap-1.5">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            {creator._count.requests}
                          </div>
                        </div>
                        <div className="w-[100px] p-3">
                          <div className="flex items-center gap-1.5">
                            <Upload className="h-4 w-4 text-muted-foreground" />
                            {creator._count.uploads}
                          </div>
                        </div>
                        <div className="w-[150px] p-3">
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            {creator.lastLoginAt
                              ? formatDistanceToNow(new Date(creator.lastLoginAt), { addSuffix: true })
                              : "Never"}
                          </div>
                        </div>
                        <div className="w-[50px] p-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-9 w-9">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem asChild>
                                <Link href={`/dashboard/creators/${creator.id}`}>
                                  View Details
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/dashboard/requests/new?creatorId=${creator.id}`}>
                                  New Request
                                </Link>
                              </DropdownMenuItem>
                              {creator.inviteStatus === "PENDING" && (
                                <DropdownMenuItem>Resend Invite</DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {isFetchingNextPage && (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default CreatorsListOptimized;
