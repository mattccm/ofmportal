"use client"

import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton, SkeletonAvatar, SkeletonBadge, SkeletonButton } from "@/components/ui/skeleton"
import { StatsGridSkeleton } from "../stat-skeleton"
import { FilterFormSkeleton } from "../form-skeleton"

interface UploadsSkeletonProps {
  /**
   * Number of items to show
   */
  items?: number
  /**
   * View mode
   */
  view?: "grid" | "list"
  /**
   * Custom className
   */
  className?: string
}

export function UploadsSkeleton({
  items = 8,
  view = "grid",
  className,
}: UploadsSkeletonProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton variant="title" className="w-32 h-8 md:h-9" />
          <Skeleton variant="text" className="w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-10 w-10 rounded-lg" />
        </div>
      </div>

      {/* Stats */}
      <StatsGridSkeleton count={4} />

      {/* Filters */}
      <Card className="card-elevated">
        <CardContent className="p-4">
          <FilterFormSkeleton filters={4} />
        </CardContent>
      </Card>

      {/* Content */}
      {view === "grid" ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: items }).map((_, i) => (
            <UploadCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {Array.from({ length: items }).map((_, i) => (
            <UploadListItemSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <Skeleton variant="text" className="w-40" />
        <div className="flex items-center gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-9 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}

// Single upload card skeleton (grid view)
export function UploadCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("card-elevated overflow-hidden", className)}>
      {/* Thumbnail */}
      <Skeleton className="aspect-square w-full rounded-none" />

      <CardContent className="p-3 space-y-2">
        {/* File name */}
        <Skeleton variant="text" className="w-full" />

        {/* Creator & Date */}
        <div className="flex items-center gap-2">
          <SkeletonAvatar size="sm" />
          <div className="flex-1 space-y-1">
            <Skeleton variant="text" className="w-20 h-3" />
            <Skeleton variant="text" className="w-24 h-2.5" />
          </div>
        </div>

        {/* Status & Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <SkeletonBadge />
          <div className="flex gap-1">
            <Skeleton className="h-7 w-7 rounded" />
            <Skeleton className="h-7 w-7 rounded" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Single upload list item skeleton
export function UploadListItemSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("card-elevated", className)}>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Thumbnail */}
          <Skeleton className="h-16 w-16 rounded-lg flex-shrink-0" />

          {/* Info */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <Skeleton variant="text" className="w-48" />
              <SkeletonBadge />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <SkeletonAvatar size="sm" />
                <Skeleton variant="text" className="w-24 h-3" />
              </div>
              <Skeleton variant="text" className="w-20 h-3" />
              <Skeleton variant="text" className="w-16 h-3" />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 flex-shrink-0">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-9 w-9 rounded-lg" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Upload detail/preview skeleton
export function UploadDetailSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton variant="title" className="w-48 h-7" />
        </div>
        <div className="flex gap-2">
          <SkeletonButton />
          <SkeletonButton size="sm" className="w-10" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Preview */}
        <div className="lg:col-span-2">
          <Card className="card-elevated overflow-hidden">
            <Skeleton className="aspect-video w-full" />
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <Skeleton variant="text" className="w-48" />
                <SkeletonBadge />
              </div>
              <div className="flex items-center gap-4">
                <SkeletonAvatar />
                <div className="space-y-1.5">
                  <Skeleton variant="text" className="w-32" />
                  <Skeleton variant="text" className="w-24 h-3" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Details */}
          <Card className="card-elevated">
            <CardHeader>
              <Skeleton variant="title" className="w-20" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <Skeleton variant="text" className="w-16 h-3" />
                  <Skeleton variant="text" className="w-24" />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Actions */}
          <Card className="card-elevated">
            <CardHeader>
              <Skeleton variant="title" className="w-24" />
            </CardHeader>
            <CardContent className="space-y-3">
              <SkeletonButton className="w-full" />
              <SkeletonButton className="w-full" />
              <div className="pt-2 border-t border-border">
                <Skeleton className="h-24 w-full rounded-xl" />
              </div>
            </CardContent>
          </Card>

          {/* Comments */}
          <Card className="card-elevated">
            <CardHeader>
              <Skeleton variant="title" className="w-24" />
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <SkeletonAvatar size="sm" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton variant="text" className="w-20" />
                    <Skeleton variant="text" className="w-full" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// Bulk upload skeleton
export function BulkUploadSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Drop zone */}
      <Card className="card-elevated">
        <CardContent className="p-8">
          <div className="flex flex-col items-center justify-center space-y-4">
            <Skeleton className="h-16 w-16 rounded-2xl" />
            <div className="space-y-2 text-center">
              <Skeleton variant="title" className="w-48 mx-auto" />
              <Skeleton variant="text" className="w-64 mx-auto" />
            </div>
            <SkeletonButton />
          </div>
        </CardContent>
      </Card>

      {/* Upload list */}
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="card-elevated">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <Skeleton variant="text" className="w-48" />
                    <Skeleton variant="text" className="w-12" />
                  </div>
                  <Skeleton className="h-2 w-full rounded-full" />
                </div>
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
