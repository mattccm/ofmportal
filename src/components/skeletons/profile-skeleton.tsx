"use client"

import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton, SkeletonAvatar, SkeletonBadge, SkeletonText, SkeletonButton } from "@/components/ui/skeleton"

interface ProfileSkeletonProps {
  /**
   * Show cover/banner image
   */
  showCover?: boolean
  /**
   * Show stats section
   */
  showStats?: boolean
  /**
   * Number of stats to show
   */
  statsCount?: number
  /**
   * Show action buttons
   */
  showActions?: boolean
  /**
   * Custom className
   */
  className?: string
  /**
   * Layout variant
   */
  variant?: "default" | "compact" | "card"
}

export function ProfileSkeleton({
  showCover = false,
  showStats = true,
  statsCount = 3,
  showActions = true,
  className,
  variant = "default",
}: ProfileSkeletonProps) {
  if (variant === "compact") {
    return <CompactProfileSkeleton className={className} showActions={showActions} />
  }

  if (variant === "card") {
    return <ProfileCardSkeleton className={className} showStats={showStats} />
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Cover image */}
      {showCover && (
        <Skeleton className="w-full h-32 md:h-48 rounded-xl" />
      )}

      {/* Profile header */}
      <div className={cn(
        "flex flex-col md:flex-row items-start md:items-end gap-4 md:gap-6",
        showCover && "-mt-12 md:-mt-16 px-4 md:px-6"
      )}>
        <SkeletonAvatar size="xl" className="h-20 w-20 md:h-24 md:w-24 ring-4 ring-background" />
        <div className="flex-1 space-y-2">
          <Skeleton variant="title" className="w-40 h-7" />
          <Skeleton variant="text" className="w-64" />
          <Skeleton variant="text" className="w-48 h-3" />
        </div>
        {showActions && (
          <div className="flex gap-2 w-full md:w-auto">
            <SkeletonButton className="flex-1 md:flex-none" />
            <SkeletonButton size="sm" className="w-10" />
          </div>
        )}
      </div>

      {/* Stats */}
      {showStats && (
        <div className="grid grid-cols-3 gap-4 p-4 rounded-xl border border-border bg-muted/30">
          {Array.from({ length: statsCount }).map((_, i) => (
            <div key={i} className="text-center space-y-1">
              <Skeleton variant="title" className="w-12 h-6 mx-auto" />
              <Skeleton variant="text" className="w-16 h-3 mx-auto" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Compact profile skeleton for sidebars/headers
export function CompactProfileSkeleton({
  className,
  showActions = false,
}: {
  className?: string
  showActions?: boolean
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <SkeletonAvatar size="lg" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <Skeleton variant="text" className="w-28" />
        <Skeleton variant="text" className="w-40 h-3" />
      </div>
      {showActions && (
        <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
      )}
    </div>
  )
}

// Profile card skeleton
export function ProfileCardSkeleton({
  className,
  showStats = true,
}: {
  className?: string
  showStats?: boolean
}) {
  return (
    <Card className={cn("card-elevated", className)}>
      <CardContent className="p-6">
        <div className="flex flex-col items-center text-center space-y-4">
          <SkeletonAvatar size="xl" className="h-20 w-20" />
          <div className="space-y-2">
            <Skeleton variant="title" className="w-32 h-6 mx-auto" />
            <Skeleton variant="text" className="w-48 mx-auto" />
            <SkeletonBadge className="mx-auto" />
          </div>
          {showStats && (
            <div className="flex items-center justify-center gap-6 w-full pt-4 border-t border-border">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="text-center space-y-1">
                  <Skeleton variant="text" className="w-8 h-5 mx-auto" />
                  <Skeleton variant="text" className="w-12 h-3 mx-auto" />
                </div>
              ))}
            </div>
          )}
          <SkeletonButton className="w-full" />
        </div>
      </CardContent>
    </Card>
  )
}

// User row skeleton (for team lists, etc.)
export function UserRowSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 p-2 rounded-xl", className)}>
      <div className="relative flex-shrink-0">
        <SkeletonAvatar size="sm" />
        <Skeleton className="absolute -top-1 -left-1 h-5 w-5 rounded-full" />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <Skeleton variant="text" className="w-28" />
        <div className="flex items-center gap-3">
          <Skeleton variant="text" className="w-12 h-3" />
          <Skeleton variant="text" className="w-8 h-3" />
          <Skeleton variant="text" className="w-8 h-3" />
        </div>
      </div>
    </div>
  )
}

// Creator performance skeleton
export function CreatorPerformanceSkeleton({
  items = 5,
  className,
}: {
  items?: number
  className?: string
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: items }).map((_, i) => (
        <UserRowSkeleton key={i} />
      ))}
    </div>
  )
}
