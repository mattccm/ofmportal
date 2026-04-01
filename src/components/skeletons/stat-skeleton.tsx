"use client"

import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

interface StatSkeletonProps {
  /**
   * Show icon in header
   */
  showIcon?: boolean
  /**
   * Show trend indicator
   */
  showTrend?: boolean
  /**
   * Custom className
   */
  className?: string
  /**
   * Size variant
   */
  size?: "default" | "compact"
}

export function StatSkeleton({
  showIcon = true,
  showTrend = true,
  className,
  size = "default",
}: StatSkeletonProps) {
  const isCompact = size === "compact"

  return (
    <Card className={cn("card-elevated stat-card", className)}>
      <CardHeader className={cn(
        "flex flex-row items-center justify-between space-y-0",
        isCompact ? "pb-1" : "pb-1 md:pb-2"
      )}>
        <Skeleton
          variant="text"
          className={cn(
            isCompact ? "w-16 h-3" : "w-20 md:w-24 h-3 md:h-4"
          )}
        />
        {showIcon && (
          <Skeleton
            className={cn(
              "rounded-xl",
              isCompact ? "h-7 w-7" : "h-8 w-8 md:h-9 md:w-9"
            )}
          />
        )}
      </CardHeader>
      <CardContent className="pt-0">
        <Skeleton
          variant="title"
          className={cn(
            isCompact ? "w-12 h-6" : "w-16 md:w-20 h-7 md:h-8"
          )}
        />
        {showTrend && (
          <Skeleton
            variant="text"
            className={cn(
              "mt-1",
              isCompact ? "w-16 h-2.5" : "w-20 md:w-24 h-2.5 md:h-3"
            )}
          />
        )}
      </CardContent>
    </Card>
  )
}

// Stats grid skeleton (commonly used in dashboards)
export function StatsGridSkeleton({
  count = 5,
  className,
  size = "default",
}: {
  count?: number
  className?: string
  size?: "default" | "compact"
}) {
  return (
    <div
      className={cn(
        "grid gap-3 md:gap-4",
        count === 4 ? "grid-cols-2 lg:grid-cols-4" :
        count === 5 ? "grid-cols-2 lg:grid-cols-5" :
        count === 3 ? "grid-cols-1 md:grid-cols-3" :
        "grid-cols-2 lg:grid-cols-4",
        className
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <StatSkeleton key={i} size={size} />
      ))}
    </div>
  )
}

// Quick stat card with left accent (for widgets)
export function QuickStatSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden p-4 rounded-xl border border-border bg-card",
        className
      )}
    >
      {/* Left accent line */}
      <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-muted to-muted rounded-l-xl" />
      <div className="pl-3 space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton variant="text" className="w-20 h-3" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
        <Skeleton variant="title" className="w-12 h-7" />
        <Skeleton variant="text" className="w-24 h-2.5" />
      </div>
    </div>
  )
}

// Horizontal stat card skeleton
export function HorizontalStatSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 p-4 rounded-xl border border-border bg-card",
        className
      )}
    >
      <Skeleton className="h-12 w-12 rounded-xl flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton variant="text" className="w-20 h-3" />
        <Skeleton variant="title" className="w-16 h-6" />
      </div>
      <Skeleton className="h-4 w-16 rounded" />
    </div>
  )
}
