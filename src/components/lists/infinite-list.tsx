"use client";

import * as React from "react";
import { Loader2, AlertTriangle, RefreshCw, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BackToTop } from "@/components/ui/back-to-top";
import {
  useInfiniteScroll,
  useScrollPosition,
  type UseInfiniteScrollOptions,
} from "@/hooks/use-infinite-scroll";

// ============================================
// TYPES
// ============================================

export interface InfiniteListProps {
  /** List items to render */
  children: React.ReactNode;
  /** Callback to load more items */
  onLoadMore: () => Promise<void>;
  /** Whether there are more items to load */
  hasMore: boolean;
  /** Whether currently loading */
  isLoading?: boolean;
  /** Whether to show the back to top button */
  showBackToTop?: boolean;
  /** Custom loading component */
  loadingComponent?: React.ReactNode;
  /** Custom end of list component */
  endComponent?: React.ReactNode;
  /** Custom error component */
  errorComponent?: React.ReactNode;
  /** Custom empty state component */
  emptyComponent?: React.ReactNode;
  /** Whether the list is empty */
  isEmpty?: boolean;
  /** Unique key for scroll position preservation */
  scrollKey?: string;
  /** Custom class name for the container */
  className?: string;
  /** Custom class name for the list wrapper */
  listClassName?: string;
  /** Root margin for intersection observer */
  rootMargin?: string;
  /** Threshold for intersection observer */
  threshold?: number;
  /** Loading text */
  loadingText?: string;
  /** End of list text */
  endText?: string;
  /** Back to top button props */
  backToTopProps?: {
    threshold?: number;
    position?: "bottom-right" | "bottom-left" | "bottom-center";
    bottomOffset?: number;
    variant?: "default" | "gradient" | "ghost";
  };
}

// ============================================
// LOADING INDICATOR COMPONENT
// ============================================

export interface LoadingIndicatorProps {
  text?: string;
  className?: string;
}

export function LoadingIndicator({
  text = "Loading more...",
  className,
}: LoadingIndicatorProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 py-8 text-muted-foreground",
        className
      )}
    >
      <Loader2 className="h-5 w-5 animate-spin" />
      <span className="text-sm">{text}</span>
    </div>
  );
}

// ============================================
// END OF LIST INDICATOR COMPONENT
// ============================================

export interface EndOfListIndicatorProps {
  text?: string;
  className?: string;
  showIcon?: boolean;
}

export function EndOfListIndicator({
  text = "You've reached the end",
  className,
  showIcon = true,
}: EndOfListIndicatorProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground",
        className
      )}
    >
      {showIcon && (
        <CheckCircle className="h-5 w-5 text-emerald-500/70" />
      )}
      <span className="text-sm">{text}</span>
    </div>
  );
}

// ============================================
// ERROR INDICATOR COMPONENT
// ============================================

export interface ErrorIndicatorProps {
  error?: Error | null;
  onRetry?: () => void;
  className?: string;
}

export function ErrorIndicator({
  error,
  onRetry,
  className,
}: ErrorIndicatorProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-8 text-center",
        className
      )}
    >
      <div className="flex items-center gap-2 text-destructive">
        <AlertTriangle className="h-5 w-5" />
        <span className="text-sm font-medium">Failed to load more items</span>
      </div>
      {error?.message && (
        <p className="text-xs text-muted-foreground max-w-xs">
          {error.message}
        </p>
      )}
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="mt-2"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
      )}
    </div>
  );
}

// ============================================
// INFINITE LIST COMPONENT
// ============================================

export function InfiniteList({
  children,
  onLoadMore,
  hasMore,
  isLoading = false,
  showBackToTop = true,
  loadingComponent,
  endComponent,
  errorComponent,
  emptyComponent,
  isEmpty = false,
  scrollKey,
  className,
  listClassName,
  rootMargin = "200px",
  threshold = 0.1,
  loadingText = "Loading more...",
  endText = "You've reached the end",
  backToTopProps,
}: InfiniteListProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Infinite scroll hook
  const {
    sentinelRef,
    isLoading: isLoadingMore,
    isEndReached,
    error,
    retry,
  } = useInfiniteScroll({
    onLoadMore,
    hasMore,
    isLoading,
    rootMargin,
    threshold,
  });

  // Scroll position preservation (optional)
  const { containerRef: scrollContainerRef } = useScrollPosition({
    key: scrollKey || "infinite-list",
    restoreOnMount: !!scrollKey,
    saveOnUnmount: !!scrollKey,
  });

  // Use the provided ref or the scroll position ref
  const effectiveContainerRef = scrollKey ? scrollContainerRef : containerRef;

  // Render loading indicator
  const renderLoadingIndicator = () => {
    if (loadingComponent) {
      return loadingComponent;
    }
    return <LoadingIndicator text={loadingText} />;
  };

  // Render end of list indicator
  const renderEndIndicator = () => {
    if (endComponent) {
      return endComponent;
    }
    return <EndOfListIndicator text={endText} />;
  };

  // Render error indicator
  const renderErrorIndicator = () => {
    if (errorComponent) {
      return errorComponent;
    }
    return <ErrorIndicator error={error} onRetry={retry} />;
  };

  // If list is empty, show empty component
  if (isEmpty && !isLoading) {
    return emptyComponent || null;
  }

  return (
    <div
      ref={effectiveContainerRef}
      className={cn("relative", className)}
    >
      {/* List content */}
      <div className={cn(listClassName)}>{children}</div>

      {/* Sentinel element for intersection observer */}
      <div
        ref={sentinelRef}
        className="h-1 w-full"
        aria-hidden="true"
      />

      {/* Loading state */}
      {(isLoading || isLoadingMore) && !error && renderLoadingIndicator()}

      {/* Error state */}
      {error && renderErrorIndicator()}

      {/* End of list state */}
      {isEndReached && !error && !isEmpty && renderEndIndicator()}

      {/* Back to top button */}
      {showBackToTop && (
        <BackToTop
          containerRef={effectiveContainerRef}
          {...backToTopProps}
        />
      )}
    </div>
  );
}

// ============================================
// INFINITE SCROLL CONTAINER
// ============================================

export interface InfiniteScrollContainerProps {
  children: React.ReactNode;
  className?: string;
  onLoadMore: () => Promise<void>;
  hasMore: boolean;
  isLoading?: boolean;
  loadingComponent?: React.ReactNode;
  endComponent?: React.ReactNode;
  showBackToTop?: boolean;
  height?: string | number;
}

export function InfiniteScrollContainer({
  children,
  className,
  onLoadMore,
  hasMore,
  isLoading = false,
  loadingComponent,
  endComponent,
  showBackToTop = true,
  height,
}: InfiniteScrollContainerProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  const { sentinelRef, isLoading: isLoadingMore, isEndReached, error, retry } =
    useInfiniteScroll({
      onLoadMore,
      hasMore,
      isLoading,
    });

  return (
    <div
      ref={containerRef}
      className={cn("overflow-auto", className)}
      style={{ height }}
    >
      {children}

      {/* Sentinel */}
      <div ref={sentinelRef} className="h-1 w-full" aria-hidden="true" />

      {/* States */}
      {(isLoading || isLoadingMore) && !error && (
        loadingComponent || <LoadingIndicator />
      )}
      {error && <ErrorIndicator error={error} onRetry={retry} />}
      {isEndReached && !error && (endComponent || <EndOfListIndicator />)}

      {/* Back to top */}
      {showBackToTop && <BackToTop containerRef={containerRef} />}
    </div>
  );
}

// ============================================
// LOAD MORE BUTTON COMPONENT
// ============================================

export interface LoadMoreButtonProps {
  onLoadMore: () => Promise<void>;
  hasMore: boolean;
  isLoading?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function LoadMoreButton({
  onLoadMore,
  hasMore,
  isLoading = false,
  className,
  children,
}: LoadMoreButtonProps) {
  const [internalLoading, setInternalLoading] = React.useState(false);

  const handleClick = async () => {
    setInternalLoading(true);
    try {
      await onLoadMore();
    } finally {
      setInternalLoading(false);
    }
  };

  if (!hasMore) {
    return null;
  }

  const loading = isLoading || internalLoading;

  return (
    <div className={cn("flex justify-center py-4", className)}>
      <Button
        variant="outline"
        onClick={handleClick}
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Loading...
          </>
        ) : (
          children || "Load More"
        )}
      </Button>
    </div>
  );
}

export default InfiniteList;
