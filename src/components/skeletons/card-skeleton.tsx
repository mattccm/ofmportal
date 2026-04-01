"use client"

import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton, SkeletonText, SkeletonBadge } from "@/components/ui/skeleton"

interface CardSkeletonProps {
  /**
   * Show header section
   */
  showHeader?: boolean
  /**
   * Show action button in header
   */
  showAction?: boolean
  /**
   * Number of content lines
   */
  contentLines?: number
  /**
   * Show footer section
   */
  showFooter?: boolean
  /**
   * Show avatar/icon in content
   */
  showAvatar?: boolean
  /**
   * Custom className
   */
  className?: string
  /**
   * Card size variant
   */
  size?: "default" | "sm"
}

export function CardSkeleton({
  showHeader = true,
  showAction = false,
  contentLines = 2,
  showFooter = false,
  showAvatar = false,
  className,
  size = "default",
}: CardSkeletonProps) {
  return (
    <Card className={cn("card-elevated", className)} size={size}>
      {showHeader && (
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-2 flex-1">
            <Skeleton variant="title" className="w-1/3" />
            <Skeleton variant="text" className="w-1/2" />
          </div>
          {showAction && (
            <Skeleton className="h-9 w-20 rounded-lg" />
          )}
        </CardHeader>
      )}
      <CardContent className={cn(!showHeader && "pt-4")}>
        <div className="flex gap-4">
          {showAvatar && (
            <Skeleton variant="circle" className="h-12 w-12 flex-shrink-0" />
          )}
          <div className="flex-1 space-y-3">
            <SkeletonText lines={contentLines} />
            {showFooter && (
              <div className="flex items-center gap-2 pt-2">
                <SkeletonBadge />
                <SkeletonBadge className="w-20" />
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Compact card skeleton for grids
export function CompactCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("card-elevated", className)} size="sm">
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton variant="circle" className="h-10 w-10 flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton variant="text" className="w-2/3" />
              <Skeleton variant="text" className="w-1/2 h-3" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <SkeletonBadge />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Action card skeleton (for quick action buttons)
export function ActionCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 p-4 md:p-5 rounded-xl border border-border",
        className
      )}
    >
      <Skeleton className="h-12 w-12 md:h-14 md:w-14 rounded-2xl" />
      <div className="space-y-1.5 text-center">
        <Skeleton variant="text" className="w-20 mx-auto" />
        <Skeleton variant="text" className="w-24 h-3 mx-auto hidden md:block" />
      </div>
    </div>
  )
}

// Alert/Banner card skeleton
export function AlertCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-xl border-2 border-muted",
        className
      )}
    >
      <Skeleton className="h-10 w-10 md:h-11 md:w-11 rounded-xl flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <Skeleton variant="text" className="w-1/3" />
        <Skeleton variant="text" className="w-1/2 h-3" />
      </div>
      <Skeleton className="h-5 w-5 flex-shrink-0" />
    </div>
  )
}
