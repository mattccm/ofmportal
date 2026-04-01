"use client"

import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton, SkeletonButton, SkeletonText } from "@/components/ui/skeleton"
import { ListSkeleton } from "../list-skeleton"

interface GenericPageSkeletonProps {
  /**
   * Show page header
   */
  showHeader?: boolean
  /**
   * Show action button in header
   */
  showAction?: boolean
  /**
   * Content type
   */
  contentType?: "list" | "grid" | "cards" | "form"
  /**
   * Number of items
   */
  items?: number
  /**
   * Custom className
   */
  className?: string
}

export function GenericPageSkeleton({
  showHeader = true,
  showAction = true,
  contentType = "list",
  items = 5,
  className,
}: GenericPageSkeletonProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      {showHeader && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Skeleton variant="title" className="w-40 h-8" />
            <Skeleton variant="text" className="w-72" />
          </div>
          {showAction && (
            <SkeletonButton className="w-full sm:w-auto" />
          )}
        </div>
      )}

      {/* Content based on type */}
      {contentType === "list" && (
        <ListSkeleton items={items} />
      )}

      {contentType === "grid" && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: items }).map((_, i) => (
            <Card key={i} className="card-elevated">
              <CardHeader>
                <Skeleton variant="title" className="w-32" />
                <Skeleton variant="text" className="w-48" />
              </CardHeader>
              <CardContent>
                <SkeletonText lines={3} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {contentType === "cards" && (
        <div className="space-y-4">
          {Array.from({ length: items }).map((_, i) => (
            <Card key={i} className="card-elevated">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton variant="text" className="w-48" />
                    <Skeleton variant="text" className="w-32 h-3" />
                  </div>
                  <Skeleton className="h-5 w-5 rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {contentType === "form" && (
        <Card className="card-elevated">
          <CardContent className="p-6 space-y-5">
            {Array.from({ length: items }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton variant="text" className="w-24 h-4" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
            ))}
            <div className="pt-4">
              <SkeletonButton />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Messages page skeleton
export function MessagesPageSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="space-y-2">
        <Skeleton variant="title" className="w-32 h-8" />
        <Skeleton variant="text" className="w-64" />
      </div>

      {/* Search */}
      <Skeleton className="h-12 w-full md:w-96 rounded-xl" />

      {/* Messages list */}
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="card-elevated">
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Skeleton variant="text" className="w-32" />
                    <Skeleton variant="text" className="w-16 h-3" />
                  </div>
                  <Skeleton variant="text" className="w-full h-3" />
                  <Skeleton variant="text" className="w-2/3 h-3" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// Reminders page skeleton
export function RemindersPageSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton variant="title" className="w-36 h-8" />
          <Skeleton variant="text" className="w-80" />
        </div>
        <SkeletonButton className="w-full sm:w-auto" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-32 rounded-xl" />
        ))}
      </div>

      {/* Reminders list */}
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="card-elevated">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-lg flex-shrink-0" />
                <div className="flex-1 min-w-0 space-y-1.5">
                  <Skeleton variant="text" className="w-48" />
                  <Skeleton variant="text" className="w-32 h-3" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-8 w-8 rounded-lg" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// Help page skeleton
export function HelpPageSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-8", className)}>
      {/* Header */}
      <div className="text-center space-y-4">
        <Skeleton variant="title" className="w-48 h-10 mx-auto" />
        <Skeleton variant="text" className="w-96 mx-auto" />
        <Skeleton className="h-12 w-full md:w-96 mx-auto rounded-xl" />
      </div>

      {/* Categories */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="card-elevated">
            <CardContent className="p-6 text-center space-y-3">
              <Skeleton className="h-12 w-12 rounded-xl mx-auto" />
              <Skeleton variant="title" className="w-24 mx-auto" />
              <Skeleton variant="text" className="w-full" />
              <Skeleton variant="text" className="w-20 mx-auto" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* FAQ Section */}
      <div className="space-y-4">
        <Skeleton variant="title" className="w-48" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="card-elevated">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Skeleton variant="text" className="w-64" />
                <Skeleton className="h-5 w-5 rounded" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// Team page skeleton
export function TeamPageSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton variant="title" className="w-24 h-8" />
          <Skeleton variant="text" className="w-64" />
        </div>
        <SkeletonButton className="w-full sm:w-auto" />
      </div>

      {/* Team members grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="card-elevated">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <Skeleton className="h-14 w-14 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton variant="text" className="w-32" />
                  <Skeleton variant="text" className="w-24 h-3" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// Notifications page skeleton
export function NotificationsPageSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton variant="title" className="w-40 h-8" />
          <Skeleton variant="text" className="w-64" />
        </div>
        <SkeletonButton size="sm" className="w-28" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-lg" />
        ))}
      </div>

      {/* Notifications list */}
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="card-elevated">
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Skeleton variant="text" className="w-48" />
                    <Skeleton variant="text" className="w-20 h-3" />
                  </div>
                  <Skeleton variant="text" className="w-full h-3" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
