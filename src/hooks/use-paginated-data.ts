"use client";

import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys, invalidateCache } from "@/lib/cache";

// ============================================
// TYPES
// ============================================

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

interface FetchOptions {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: string;
  [key: string]: string | number | undefined;
}

// ============================================
// GENERIC FETCH FUNCTION
// ============================================

async function fetchPaginated<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<PaginatedResponse<T>> {
  const params = new URLSearchParams();

  Object.entries(options).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });

  const url = `${endpoint}${params.toString() ? `?${params}` : ""}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${endpoint}`);
  }

  return response.json();
}

// ============================================
// CREATORS HOOKS
// ============================================

export interface Creator {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  inviteStatus: string;
  lastLoginAt: Date | null;
  createdAt: Date;
  _count: {
    requests: number;
    uploads: number;
  };
  requests: { id: string }[];
}

export function useCreators(options: FetchOptions = {}) {
  return useInfiniteQuery({
    queryKey: queryKeys.creators.list(options),
    queryFn: async ({ pageParam = 1 }) => {
      return fetchPaginated<Creator>("/api/creators", {
        ...options,
        page: pageParam,
        limit: options.limit || 25,
      });
    },
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasNextPage ? lastPage.pagination.page + 1 : undefined,
    initialPageParam: 1,
    staleTime: 30000,
  });
}

export function useCreator(id: string) {
  return useQuery({
    queryKey: queryKeys.creators.detail(id),
    queryFn: async () => {
      const response = await fetch(`/api/creators/${id}`);
      if (!response.ok) throw new Error("Failed to fetch creator");
      return response.json();
    },
    staleTime: 60000,
  });
}

// ============================================
// REQUESTS HOOKS
// ============================================

export interface ContentRequest {
  id: string;
  title: string;
  description: string | null;
  status: string;
  urgency: string;
  dueDate: string | null;
  createdAt: string;
  viewedByCreator: boolean;
  creator: {
    id: string;
    name: string;
    email: string;
  };
  template: {
    id: string;
    name: string;
  } | null;
  _count: {
    uploads: number;
    comments: number;
  };
}

export function useRequests(options: FetchOptions = {}) {
  return useInfiniteQuery({
    queryKey: queryKeys.requests.list(options),
    queryFn: async ({ pageParam = 1 }) => {
      return fetchPaginated<ContentRequest>("/api/requests", {
        ...options,
        page: pageParam,
        limit: options.limit || 25,
      });
    },
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasNextPage ? lastPage.pagination.page + 1 : undefined,
    initialPageParam: 1,
    staleTime: 30000,
  });
}

export function useRequest(id: string) {
  return useQuery({
    queryKey: queryKeys.requests.detail(id),
    queryFn: async () => {
      const response = await fetch(`/api/requests/${id}`);
      if (!response.ok) throw new Error("Failed to fetch request");
      return response.json();
    },
    staleTime: 60000,
  });
}

// ============================================
// BULK OPERATIONS HOOKS
// ============================================

interface BulkActionParams {
  action: string;
  requestIds: string[];
  status?: string;
  priority?: string;
  creatorId?: string;
}

export function useBulkRequestAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: BulkActionParams) => {
      const response = await fetch("/api/requests/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to perform bulk action");
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate all request queries
      queryClient.invalidateQueries({ queryKey: queryKeys.requests.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats });
    },
  });
}

// ============================================
// DASHBOARD HOOKS
// ============================================

export function useDashboardStats() {
  return useQuery({
    queryKey: queryKeys.dashboard.stats,
    queryFn: async () => {
      const response = await fetch("/api/dashboard");
      if (!response.ok) throw new Error("Failed to fetch dashboard data");
      return response.json();
    },
    staleTime: 60000, // 1 minute
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
}

// ============================================
// TEMPLATES HOOKS
// ============================================

export function useTemplates() {
  return useQuery({
    queryKey: queryKeys.templates.list(),
    queryFn: async () => {
      const response = await fetch("/api/templates");
      if (!response.ok) throw new Error("Failed to fetch templates");
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - templates rarely change
  });
}

// ============================================
// NOTIFICATIONS HOOKS
// ============================================

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: async () => {
      const response = await fetch("/api/notifications/unread-count");
      if (!response.ok) throw new Error("Failed to fetch notification count");
      return response.json();
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
  });
}

// ============================================
// UTILITY HOOK FOR FLATTENING INFINITE QUERY DATA
// ============================================

export function flattenInfiniteData<T>(
  data: { pages: PaginatedResponse<T>[] } | undefined
): T[] {
  return data?.pages.flatMap((page) => page.data) ?? [];
}

export function getTotalFromInfiniteData<T>(
  data: { pages: PaginatedResponse<T>[] } | undefined
): number {
  return data?.pages[0]?.pagination.total ?? 0;
}
