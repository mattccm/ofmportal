"use client"

import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton, SkeletonAvatar, SkeletonBadge, SkeletonText } from "@/components/ui/skeleton"

interface ListSkeletonProps {
  /**
   * Number of items to show
   */
  items?: number
  /**
   * Show avatar for each item
   */
  showAvatar?: boolean
  /**
   * Show badge for each item
   */
  showBadge?: boolean
  /**
   * Show chevron arrow
   */
  showChevron?: boolean
  /**
   * Avatar size
   */
  avatarSize?: "sm" | "default" | "lg"
  /**
   * Custom className
   */
  className?: string
  /**
   * Wrap in card
   */
  inCard?: boolean
  /**
   * Show card header
   */
  cardTitle?: boolean
  /**
   * Show card action button
   */
  cardAction?: boolean
  /**
   * Spacing between items
   */
  spacing?: "tight" | "default" | "loose"
}

export function ListSkeleton({
  items = 5,
  showAvatar = true,
  showBadge = true,
  showChevron = true,
  avatarSize = "default",
  className,
  inCard = true,
  cardTitle = true,
  cardAction = true,
  spacing = "default",
}: ListSkeletonProps) {
  const spacingStyles = {
    tight: "gap-1",
    default: "gap-2",
    loose: "gap-3",
  }

  const content = (
    <div className={cn("space-y-1", spacingStyles[spacing])}>
      {Array.from({ length: items }).map((_, i) => (
        <ListItemSkeleton
          key={i}
          showAvatar={showAvatar}
          showBadge={showBadge}
          showChevron={showChevron}
          avatarSize={avatarSize}
        />
      ))}
    </div>
  )

  if (!inCard) {
    return <div className={className}>{content}</div>
  }

  return (
    <Card className={cn("card-elevated", className)}>
      {cardTitle && (
        <CardHeader className="flex flex-row items-center justify-between pb-3 md:pb-4">
          <div className="space-y-2">
            <Skeleton variant="title" className="w-32" />
            <Skeleton variant="text" className="w-48 hidden md:block" />
          </div>
          {cardAction && (
            <Skeleton className="h-9 w-20 rounded-lg" />
          )}
        </CardHeader>
      )}
      <CardContent className={!cardTitle ? "pt-4" : "pt-0"}>
        {content}
      </CardContent>
    </Card>
  )
}

// Single list item skeleton
export function ListItemSkeleton({
  showAvatar = true,
  showBadge = true,
  showChevron = true,
  avatarSize = "default",
  showSecondary = true,
  showTimestamp = true,
  className,
}: {
  showAvatar?: boolean
  showBadge?: boolean
  showChevron?: boolean
  avatarSize?: "sm" | "default" | "lg"
  showSecondary?: boolean
  showTimestamp?: boolean
  className?: string
}) {
  const avatarSizes = {
    sm: "h-8 w-8",
    default: "h-10 w-10",
    lg: "h-12 w-12",
  }

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-xl",
        className
      )}
    >
      {showAvatar && (
        <Skeleton variant="circle" className={cn(avatarSizes[avatarSize], "flex-shrink-0")} />
      )}
      <div className="flex-1 min-w-0 space-y-1.5">
        <Skeleton variant="text" className="w-2/3" />
        {showSecondary && (
          <Skeleton variant="text" className="w-full h-3" />
        )}
        {showTimestamp && (
          <Skeleton variant="text" className="w-24 h-2.5" />
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {showBadge && <SkeletonBadge />}
        {showChevron && <Skeleton className="h-4 w-4 rounded" />}
      </div>
    </div>
  )
}

// Mobile card list skeleton
export function MobileListSkeleton({
  items = 5,
  className,
}: {
  items?: number
  className?: string
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: items }).map((_, i) => (
        <Card key={i} className="card-elevated">
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <SkeletonAvatar size="lg" />
              <div className="flex-1 min-w-0 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1.5">
                    <Skeleton variant="text" className="w-32" />
                    <Skeleton variant="text" className="w-48 h-3" />
                  </div>
                  <Skeleton className="h-5 w-5 flex-shrink-0" />
                </div>
                <div className="flex items-center gap-4">
                  <Skeleton variant="text" className="w-20 h-3" />
                  <Skeleton variant="text" className="w-24 h-3" />
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <SkeletonBadge />
                  <Skeleton variant="text" className="w-24 h-3" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// Activity feed skeleton
export function ActivityFeedSkeleton({
  items = 5,
  className,
}: {
  items?: number
  className?: string
}) {
  return (
    <div className={cn("space-y-1", className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div
          key={i}
          className="flex items-start gap-3 p-3 rounded-xl"
        >
          <div className="relative flex-shrink-0">
            <SkeletonAvatar size="sm" />
            <Skeleton className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full" />
          </div>
          <div className="flex-1 min-w-0 space-y-1.5">
            <Skeleton variant="text" className="w-24" />
            <Skeleton variant="text" className="w-full h-3" />
            <Skeleton variant="text" className="w-20 h-2.5" />
          </div>
        </div>
      ))}
    </div>
  )
}
