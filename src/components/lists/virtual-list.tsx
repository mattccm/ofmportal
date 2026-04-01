"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { LoadingIndicator, EndOfListIndicator, ErrorIndicator } from "./infinite-list";
import { BackToTop } from "@/components/ui/back-to-top";

// ============================================
// TYPES
// ============================================

export interface VirtualListItem {
  id: string;
  height?: number;
}

export interface VirtualListProps<T extends VirtualListItem> {
  /** Array of items to render */
  items: T[];
  /** Render function for each item */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Estimated height of each item (used for initial calculations) */
  estimatedItemHeight?: number;
  /** Number of items to render above and below the visible area */
  overscan?: number;
  /** Container height (required for virtualization) */
  height: number | string;
  /** Custom class name for the container */
  className?: string;
  /** Custom class name for each item wrapper */
  itemClassName?: string;
  /** Key extractor function */
  getItemKey?: (item: T, index: number) => string;
  /** Callback when an item becomes visible */
  onItemVisible?: (item: T, index: number) => void;
  /** Whether to enable infinite scroll */
  infiniteScroll?: boolean;
  /** Infinite scroll options */
  onLoadMore?: () => Promise<void>;
  hasMore?: boolean;
  isLoading?: boolean;
  /** Whether to show back to top button */
  showBackToTop?: boolean;
  /** Gap between items */
  gap?: number;
}

// ============================================
// VIRTUAL LIST HOOK
// ============================================

interface UseVirtualListOptions<T extends VirtualListItem> {
  items: T[];
  estimatedItemHeight: number;
  containerHeight: number;
  overscan: number;
  gap: number;
}

interface VirtualItem {
  index: number;
  start: number;
  end: number;
  size: number;
}

function useVirtualList<T extends VirtualListItem>(
  options: UseVirtualListOptions<T>
) {
  const { items, estimatedItemHeight, containerHeight, overscan, gap } = options;

  const [scrollTop, setScrollTop] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const itemHeightsRef = React.useRef<Map<number, number>>(new Map());

  // Calculate total height
  const getTotalHeight = React.useCallback(() => {
    let total = 0;
    for (let i = 0; i < items.length; i++) {
      const height =
        items[i].height ||
        itemHeightsRef.current.get(i) ||
        estimatedItemHeight;
      total += height + (i < items.length - 1 ? gap : 0);
    }
    return total;
  }, [items, estimatedItemHeight, gap]);

  // Get item offset
  const getItemOffset = React.useCallback(
    (index: number) => {
      let offset = 0;
      for (let i = 0; i < index; i++) {
        const height =
          items[i].height ||
          itemHeightsRef.current.get(i) ||
          estimatedItemHeight;
        offset += height + gap;
      }
      return offset;
    },
    [items, estimatedItemHeight, gap]
  );

  // Calculate visible items
  const virtualItems = React.useMemo<VirtualItem[]>(() => {
    const result: VirtualItem[] = [];
    let currentOffset = 0;
    let startIndex = -1;
    let endIndex = -1;

    for (let i = 0; i < items.length; i++) {
      const height =
        items[i].height ||
        itemHeightsRef.current.get(i) ||
        estimatedItemHeight;
      const itemEnd = currentOffset + height;

      // Check if item is in visible range (with overscan)
      const visibleStart = Math.max(0, scrollTop - overscan * estimatedItemHeight);
      const visibleEnd = scrollTop + containerHeight + overscan * estimatedItemHeight;

      if (itemEnd >= visibleStart && currentOffset <= visibleEnd) {
        if (startIndex === -1) startIndex = i;
        endIndex = i;

        result.push({
          index: i,
          start: currentOffset,
          end: itemEnd,
          size: height,
        });
      }

      currentOffset = itemEnd + gap;
    }

    return result;
  }, [items, scrollTop, containerHeight, overscan, estimatedItemHeight, gap]);

  // Handle scroll
  const handleScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    setScrollTop(target.scrollTop);
  }, []);

  // Measure item height
  const measureItem = React.useCallback((index: number, height: number) => {
    itemHeightsRef.current.set(index, height);
  }, []);

  // Scroll to index
  const scrollToIndex = React.useCallback(
    (index: number, align: "start" | "center" | "end" = "start") => {
      const container = containerRef.current;
      if (!container) return;

      const offset = getItemOffset(index);
      const itemHeight =
        items[index]?.height ||
        itemHeightsRef.current.get(index) ||
        estimatedItemHeight;

      let scrollPosition: number;
      switch (align) {
        case "center":
          scrollPosition = offset - containerHeight / 2 + itemHeight / 2;
          break;
        case "end":
          scrollPosition = offset - containerHeight + itemHeight;
          break;
        case "start":
        default:
          scrollPosition = offset;
      }

      container.scrollTo({
        top: Math.max(0, scrollPosition),
        behavior: "smooth",
      });
    },
    [items, containerHeight, estimatedItemHeight, getItemOffset]
  );

  return {
    containerRef,
    virtualItems,
    totalHeight: getTotalHeight(),
    handleScroll,
    measureItem,
    scrollToIndex,
    scrollTop,
  };
}

// ============================================
// VIRTUAL ITEM WRAPPER
// ============================================

interface VirtualItemWrapperProps {
  index: number;
  start: number;
  children: React.ReactNode;
  className?: string;
  onMeasure?: (index: number, height: number) => void;
}

function VirtualItemWrapper({
  index,
  start,
  children,
  className,
  onMeasure,
}: VirtualItemWrapperProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (ref.current && onMeasure) {
      const height = ref.current.offsetHeight;
      onMeasure(index, height);
    }
  }, [index, onMeasure, children]);

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        transform: `translateY(${start}px)`,
      }}
      className={className}
    >
      {children}
    </div>
  );
}

// ============================================
// VIRTUAL LIST COMPONENT
// ============================================

export function VirtualList<T extends VirtualListItem>({
  items,
  renderItem,
  estimatedItemHeight = 60,
  overscan = 3,
  height,
  className,
  itemClassName,
  getItemKey,
  onItemVisible,
  infiniteScroll = false,
  onLoadMore,
  hasMore = false,
  isLoading = false,
  showBackToTop = true,
  gap = 0,
}: VirtualListProps<T>) {
  const containerHeight =
    typeof height === "number" ? height : parseInt(height, 10) || 500;

  const {
    containerRef,
    virtualItems,
    totalHeight,
    handleScroll,
    measureItem,
    scrollToIndex,
  } = useVirtualList({
    items,
    estimatedItemHeight,
    containerHeight,
    overscan,
    gap,
  });

  // Infinite scroll hook
  const infiniteScrollHook = useInfiniteScroll({
    onLoadMore: onLoadMore || (async () => {}),
    hasMore,
    isLoading,
    enabled: infiniteScroll && !!onLoadMore,
  });

  // Track visible items
  React.useEffect(() => {
    if (onItemVisible && virtualItems.length > 0) {
      virtualItems.forEach((vItem) => {
        const item = items[vItem.index];
        if (item) {
          onItemVisible(item, vItem.index);
        }
      });
    }
  }, [virtualItems, items, onItemVisible]);

  // Get item key
  const getKey = React.useCallback(
    (item: T, index: number) => {
      if (getItemKey) {
        return getItemKey(item, index);
      }
      return item.id || index.toString();
    },
    [getItemKey]
  );

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{ height }}
      className={cn("overflow-auto relative", className)}
    >
      {/* Virtual container with total height */}
      <div
        style={{
          height: totalHeight,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualItems.map((vItem) => {
          const item = items[vItem.index];
          if (!item) return null;

          return (
            <VirtualItemWrapper
              key={getKey(item, vItem.index)}
              index={vItem.index}
              start={vItem.start}
              className={itemClassName}
              onMeasure={measureItem}
            >
              {renderItem(item, vItem.index)}
            </VirtualItemWrapper>
          );
        })}
      </div>

      {/* Infinite scroll sentinel */}
      {infiniteScroll && (
        <div
          ref={infiniteScrollHook.sentinelRef}
          className="h-1 w-full"
          style={{
            position: "absolute",
            bottom: estimatedItemHeight * 2,
            left: 0,
          }}
          aria-hidden="true"
        />
      )}

      {/* Loading state */}
      {infiniteScroll && infiniteScrollHook.isLoading && !infiniteScrollHook.error && (
        <div style={{ position: "sticky", bottom: 0, left: 0, right: 0 }}>
          <LoadingIndicator />
        </div>
      )}

      {/* Error state */}
      {infiniteScroll && infiniteScrollHook.error && (
        <div style={{ position: "sticky", bottom: 0, left: 0, right: 0 }}>
          <ErrorIndicator
            error={infiniteScrollHook.error}
            onRetry={infiniteScrollHook.retry}
          />
        </div>
      )}

      {/* End of list */}
      {infiniteScroll && infiniteScrollHook.isEndReached && !infiniteScrollHook.error && (
        <div style={{ position: "sticky", bottom: 0, left: 0, right: 0 }}>
          <EndOfListIndicator />
        </div>
      )}

      {/* Back to top */}
      {showBackToTop && <BackToTop containerRef={containerRef} />}
    </div>
  );
}

// ============================================
// SIMPLE VIRTUAL LIST (FIXED HEIGHT ITEMS)
// ============================================

export interface SimpleVirtualListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  itemHeight: number;
  height: number | string;
  className?: string;
  overscan?: number;
  getItemKey?: (item: T, index: number) => string;
  showBackToTop?: boolean;
}

export function SimpleVirtualList<T>({
  items,
  renderItem,
  itemHeight,
  height,
  className,
  overscan = 3,
  getItemKey,
  showBackToTop = true,
}: SimpleVirtualListProps<T>) {
  const [scrollTop, setScrollTop] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const containerHeight =
    typeof height === "number" ? height : parseInt(height, 10) || 500;

  // Calculate visible range
  const totalHeight = items.length * itemHeight;
  const startIndex = Math.max(
    0,
    Math.floor(scrollTop / itemHeight) - overscan
  );
  const endIndex = Math.min(
    items.length - 1,
    Math.floor((scrollTop + containerHeight) / itemHeight) + overscan
  );

  // Get visible items
  const visibleItems = [];
  for (let i = startIndex; i <= endIndex; i++) {
    visibleItems.push({
      index: i,
      item: items[i],
      top: i * itemHeight,
    });
  }

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  // Get key
  const getKey = (item: T, index: number) => {
    if (getItemKey) return getItemKey(item, index);
    return index.toString();
  };

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{ height }}
      className={cn("overflow-auto relative", className)}
    >
      <div
        style={{
          height: totalHeight,
          width: "100%",
          position: "relative",
        }}
      >
        {visibleItems.map(({ index, item, top }) => (
          <div
            key={getKey(item, index)}
            style={{
              position: "absolute",
              top,
              left: 0,
              right: 0,
              height: itemHeight,
            }}
          >
            {renderItem(item, index)}
          </div>
        ))}
      </div>

      {showBackToTop && <BackToTop containerRef={containerRef} />}
    </div>
  );
}

// ============================================
// VARIABLE HEIGHT VIRTUAL LIST
// ============================================

export interface VariableHeightVirtualListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  estimatedItemHeight: number;
  height: number | string;
  className?: string;
  overscan?: number;
  getItemKey?: (item: T, index: number) => string;
  showBackToTop?: boolean;
}

export function VariableHeightVirtualList<T>({
  items,
  renderItem,
  estimatedItemHeight,
  height,
  className,
  overscan = 3,
  getItemKey,
  showBackToTop = true,
}: VariableHeightVirtualListProps<T>) {
  const [scrollTop, setScrollTop] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const heightsRef = React.useRef<number[]>([]);
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

  const containerHeight =
    typeof height === "number" ? height : parseInt(height, 10) || 500;

  // Initialize heights
  React.useEffect(() => {
    if (heightsRef.current.length !== items.length) {
      heightsRef.current = items.map(
        (_, i) => heightsRef.current[i] || estimatedItemHeight
      );
    }
  }, [items.length, estimatedItemHeight]);

  // Calculate positions
  const getItemMetadata = React.useCallback(
    (index: number) => {
      let offset = 0;
      for (let i = 0; i < index; i++) {
        offset += heightsRef.current[i] || estimatedItemHeight;
      }
      return {
        offset,
        size: heightsRef.current[index] || estimatedItemHeight,
      };
    },
    [estimatedItemHeight]
  );

  // Find start index using binary search
  const findStartIndex = React.useCallback(
    (scrollTop: number) => {
      let low = 0;
      let high = items.length - 1;

      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const { offset, size } = getItemMetadata(mid);

        if (offset + size < scrollTop) {
          low = mid + 1;
        } else if (offset > scrollTop) {
          high = mid - 1;
        } else {
          return mid;
        }
      }

      return Math.max(0, low);
    },
    [items.length, getItemMetadata]
  );

  // Calculate total height
  const totalHeight = React.useMemo(() => {
    return heightsRef.current.reduce(
      (sum, h) => sum + (h || estimatedItemHeight),
      0
    );
  }, [items.length, estimatedItemHeight]);

  // Get visible items
  const visibleItems = React.useMemo(() => {
    const result: { index: number; item: T; offset: number }[] = [];
    const startIndex = Math.max(0, findStartIndex(scrollTop) - overscan);

    let currentOffset = 0;
    for (let i = 0; i < startIndex; i++) {
      currentOffset += heightsRef.current[i] || estimatedItemHeight;
    }

    for (let i = startIndex; i < items.length; i++) {
      const itemHeight = heightsRef.current[i] || estimatedItemHeight;

      if (currentOffset > scrollTop + containerHeight + overscan * estimatedItemHeight) {
        break;
      }

      result.push({
        index: i,
        item: items[i],
        offset: currentOffset,
      });

      currentOffset += itemHeight;
    }

    return result;
  }, [items, scrollTop, containerHeight, overscan, estimatedItemHeight, findStartIndex]);

  // Measure item
  const measureItem = React.useCallback(
    (index: number, element: HTMLDivElement | null) => {
      if (!element) return;

      const height = element.offsetHeight;
      if (heightsRef.current[index] !== height) {
        heightsRef.current[index] = height;
        forceUpdate();
      }
    },
    []
  );

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  const getKey = (item: T, index: number) => {
    if (getItemKey) return getItemKey(item, index);
    return index.toString();
  };

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{ height }}
      className={cn("overflow-auto relative", className)}
    >
      <div
        style={{
          height: totalHeight,
          width: "100%",
          position: "relative",
        }}
      >
        {visibleItems.map(({ index, item, offset }) => (
          <div
            key={getKey(item, index)}
            ref={(el) => measureItem(index, el)}
            style={{
              position: "absolute",
              top: offset,
              left: 0,
              right: 0,
            }}
          >
            {renderItem(item, index)}
          </div>
        ))}
      </div>

      {showBackToTop && <BackToTop containerRef={containerRef} />}
    </div>
  );
}

export default VirtualList;
