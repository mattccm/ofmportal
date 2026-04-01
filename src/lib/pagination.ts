/**
 * Pagination utilities for scaling to 100+ creators
 * Provides consistent pagination across all API endpoints
 */

import { z } from "zod";

// ============================================
// TYPES
// ============================================

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

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

export interface CursorPaginationParams {
  cursor?: string;
  limit: number;
}

export interface CursorPaginatedResponse<T> {
  data: T[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
    limit: number;
  };
}

// ============================================
// VALIDATION SCHEMAS
// ============================================

export const paginationQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(25),
});

export const cursorPaginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(25),
});

// ============================================
// HELPERS
// ============================================

/**
 * Parse pagination params from URL search params
 */
export function parsePaginationParams(searchParams: URLSearchParams): PaginationParams {
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25", 10)));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * Parse cursor pagination params from URL search params
 */
export function parseCursorPaginationParams(searchParams: URLSearchParams): CursorPaginationParams {
  const cursor = searchParams.get("cursor") || undefined;
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25", 10)));

  return { cursor, limit };
}

/**
 * Create a paginated response object
 */
export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  params: PaginationParams
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / params.limit);

  return {
    data,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages,
      hasNextPage: params.page < totalPages,
      hasPrevPage: params.page > 1,
    },
  };
}

/**
 * Create a cursor-paginated response object
 */
export function createCursorPaginatedResponse<T extends { id: string }>(
  data: T[],
  params: CursorPaginationParams
): CursorPaginatedResponse<T> {
  const hasMore = data.length > params.limit;
  const items = hasMore ? data.slice(0, params.limit) : data;
  const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : null;

  return {
    data: items,
    pagination: {
      nextCursor,
      hasMore,
      limit: params.limit,
    },
  };
}

/**
 * Default page sizes for different views
 */
export const PAGE_SIZES = {
  TABLE: 25,
  CARDS: 20,
  DROPDOWN: 50,
  INFINITE_SCROLL: 20,
  EXPORT: 1000,
} as const;

/**
 * Get optimized select fields for list views (reduces payload size)
 */
export function getListSelectFields<T extends Record<string, boolean>>(
  fullSelect: T,
  listSelect: Partial<T>
): Partial<T> {
  return listSelect;
}
