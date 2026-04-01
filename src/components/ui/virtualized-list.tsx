"use client";

import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

interface VirtualizedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  estimateSize?: number;
  overscan?: number;
  className?: string;
  itemClassName?: string;
  getItemKey?: (item: T, index: number) => string | number;
  onEndReached?: () => void;
  endReachedThreshold?: number;
  emptyState?: React.ReactNode;
  loading?: boolean;
  loadingMore?: boolean;
  height?: string | number; // Custom height, defaults to 100% of parent
}

interface VirtualizedTableProps<T> {
  items: T[];
  columns: {
    key: string;
    header: React.ReactNode;
    cell: (item: T, index: number) => React.ReactNode;
    width?: string | number;
    className?: string;
  }[];
  estimateSize?: number;
  overscan?: number;
  className?: string;
  getItemKey?: (item: T, index: number) => string | number;
  onEndReached?: () => void;
  endReachedThreshold?: number;
  emptyState?: React.ReactNode;
  loading?: boolean;
  loadingMore?: boolean;
  onRowClick?: (item: T, index: number) => void;
  selectedIds?: Set<string>;
  onSelectionChange?: (id: string, selected: boolean) => void;
}

// ============================================
// VIRTUALIZED LIST COMPONENT
// ============================================

export function VirtualizedList<T>({
  items,
  renderItem,
  estimateSize = 72,
  overscan = 5,
  className,
  itemClassName,
  getItemKey,
  onEndReached,
  endReachedThreshold = 200,
  emptyState,
  loading,
  loadingMore,
  height,
}: VirtualizedListProps<T>) {
  const parentRef = React.useRef<HTMLDivElement>(null);
  const endReachedRef = React.useRef(false);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
    getItemKey: getItemKey
      ? (index) => getItemKey(items[index], index)
      : undefined,
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Handle infinite scroll
  React.useEffect(() => {
    if (!onEndReached || !parentRef.current) return;

    const handleScroll = () => {
      const element = parentRef.current;
      if (!element) return;

      const { scrollTop, scrollHeight, clientHeight } = element;
      const distanceFromEnd = scrollHeight - scrollTop - clientHeight;

      if (distanceFromEnd < endReachedThreshold && !endReachedRef.current) {
        endReachedRef.current = true;
        onEndReached();
      } else if (distanceFromEnd >= endReachedThreshold) {
        endReachedRef.current = false;
      }
    };

    const element = parentRef.current;
    element.addEventListener("scroll", handleScroll, { passive: true });
    return () => element.removeEventListener("scroll", handleScroll);
  }, [onEndReached, endReachedThreshold]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (items.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  // Default to flex-1 h-full for responsive height, fallback to 600px for fixed height
  const heightStyle = height
    ? { height: typeof height === 'number' ? `${height}px` : height }
    : {};

  return (
    <div
      ref={parentRef}
      className={cn(
        "overflow-auto",
        !height && "flex-1 min-h-[200px] max-h-[calc(100vh-200px)]",
        className
      )}
      style={heightStyle}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualItems.map((virtualItem) => (
          <div
            key={virtualItem.key}
            className={itemClassName}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {renderItem(items[virtualItem.index], virtualItem.index)}
          </div>
        ))}
      </div>
      {loadingMore && (
        <div className="flex items-center justify-center py-4">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}
    </div>
  );
}

// ============================================
// VIRTUALIZED TABLE COMPONENT
// ============================================

export function VirtualizedTable<T extends { id: string }>({
  items,
  columns,
  estimateSize = 56,
  overscan = 5,
  className,
  getItemKey,
  onEndReached,
  endReachedThreshold = 200,
  emptyState,
  loading,
  loadingMore,
  onRowClick,
  selectedIds,
  onSelectionChange,
}: VirtualizedTableProps<T>) {
  const parentRef = React.useRef<HTMLDivElement>(null);
  const endReachedRef = React.useRef(false);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
    getItemKey: getItemKey
      ? (index) => getItemKey(items[index], index)
      : (index) => items[index]?.id ?? index,
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Handle infinite scroll
  React.useEffect(() => {
    if (!onEndReached || !parentRef.current) return;

    const handleScroll = () => {
      const element = parentRef.current;
      if (!element) return;

      const { scrollTop, scrollHeight, clientHeight } = element;
      const distanceFromEnd = scrollHeight - scrollTop - clientHeight;

      if (distanceFromEnd < endReachedThreshold && !endReachedRef.current) {
        endReachedRef.current = true;
        onEndReached();
      } else if (distanceFromEnd >= endReachedThreshold) {
        endReachedRef.current = false;
      }
    };

    const element = parentRef.current;
    element.addEventListener("scroll", handleScroll, { passive: true });
    return () => element.removeEventListener("scroll", handleScroll);
  }, [onEndReached, endReachedThreshold]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (items.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <div className={cn("rounded-md border", className)}>
      {/* Table Header */}
      <div className="sticky top-0 z-10 border-b bg-muted/50">
        <div className="flex">
          {columns.map((column) => (
            <div
              key={column.key}
              className={cn(
                "flex items-center px-4 py-3 text-sm font-medium text-muted-foreground",
                column.className
              )}
              style={{ width: column.width, flexShrink: 0 }}
            >
              {column.header}
            </div>
          ))}
        </div>
      </div>

      {/* Virtualized Body */}
      <div
        ref={parentRef}
        className="flex-1 overflow-auto max-h-[calc(100vh-300px)] min-h-[200px]"
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {virtualItems.map((virtualItem) => {
            const item = items[virtualItem.index];
            const isSelected = selectedIds?.has(item.id);

            return (
              <div
                key={virtualItem.key}
                className={cn(
                  "absolute left-0 top-0 flex w-full border-b transition-colors",
                  onRowClick && "cursor-pointer hover:bg-muted/50",
                  isSelected && "bg-primary/5"
                )}
                style={{
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
                onClick={() => onRowClick?.(item, virtualItem.index)}
              >
                {columns.map((column) => (
                  <div
                    key={column.key}
                    className={cn("flex items-center px-4", column.className)}
                    style={{ width: column.width, flexShrink: 0 }}
                  >
                    {column.cell(item, virtualItem.index)}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        {loadingMore && (
          <div className="flex items-center justify-center py-4">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// HOOK FOR INFINITE SCROLL WITH PAGINATION
// ============================================

interface UseInfiniteScrollOptions {
  initialPage?: number;
  pageSize?: number;
  onLoadMore: (page: number) => Promise<{ data: unknown[]; hasMore: boolean }>;
}

export function useInfiniteScroll<T>({
  initialPage = 1,
  pageSize = 25,
  onLoadMore,
}: UseInfiniteScrollOptions) {
  const [items, setItems] = React.useState<T[]>([]);
  const [page, setPage] = React.useState(initialPage);
  const [loading, setLoading] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  const loadInitial = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await onLoadMore(1);
      setItems(result.data as T[]);
      setHasMore(result.hasMore);
      setPage(1);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to load"));
    } finally {
      setLoading(false);
    }
  }, [onLoadMore]);

  const loadMore = React.useCallback(async () => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);
    setError(null);
    try {
      const nextPage = page + 1;
      const result = await onLoadMore(nextPage);
      setItems((prev) => [...prev, ...(result.data as T[])]);
      setHasMore(result.hasMore);
      setPage(nextPage);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to load more"));
    } finally {
      setLoadingMore(false);
    }
  }, [page, loadingMore, hasMore, onLoadMore]);

  const refresh = React.useCallback(() => {
    loadInitial();
  }, [loadInitial]);

  React.useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  return {
    items,
    loading,
    loadingMore,
    hasMore,
    error,
    loadMore,
    refresh,
    setItems,
  };
}

export default VirtualizedList;
