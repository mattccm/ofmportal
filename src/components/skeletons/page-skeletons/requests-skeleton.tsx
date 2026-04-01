"use client"

import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton, SkeletonAvatar, SkeletonBadge, SkeletonButton } from "@/components/ui/skeleton"
import { TableSkeleton } from "../table-skeleton"
import { FilterFormSkeleton, SearchFormSkeleton } from "../form-skeleton"

interface RequestsSkeletonProps {
  /**
   * Number of items to show
   */
  items?: number
  /**
   * Custom className
   */
  className?: string
}

export function RequestsSkeleton({
  items = 8,
  className,
}: RequestsSkeletonProps) {
  return (
    <div className={cn("space-y-4 md:space-y-6", className)}>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton variant="title" className="w-40 h-8 md:h-9" />
          <Skeleton variant="text" className="w-72" />
        </div>
        <SkeletonButton className="w-full sm:w-auto min-h-[44px]" />
      </div>

      {/* Filters and Search */}
      <Card className="card-elevated">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <SearchFormSkeleton />
            </div>
            <FilterFormSkeleton filters={2} />
          </div>
        </CardContent>
      </Card>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card"
          >
            <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
            <div className="space-y-1">
              <Skeleton variant="text" className="w-20 h-3" />
              <Skeleton variant="title" className="w-8 h-5" />
            </div>
          </div>
        ))}
      </div>

      {/* Mobile Card View */}
      <div className="block md:hidden space-y-3">
        {Array.from({ length: items }).map((_, i) => (
          <RequestCardSkeleton key={i} />
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block">
        <TableSkeleton
          rows={items}
          columns={6}
          showAvatar={true}
          showActions={true}
          cardTitle={false}
          inCard={true}
        />
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <Skeleton variant="text" className="w-32" />
        <div className="flex items-center gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-9 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}

// Single request card skeleton (for mobile)
export function RequestCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("card-elevated", className)}>
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0 space-y-1.5">
              <Skeleton variant="text" className="w-48" />
              <div className="flex items-center gap-2">
                <SkeletonAvatar size="sm" />
                <Skeleton variant="text" className="w-24 h-3" />
              </div>
            </div>
            <SkeletonBadge />
          </div>

          {/* Meta info */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton variant="text" className="w-20 h-3" />
            </div>
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton variant="text" className="w-16 h-3" />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-border">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton variant="text" className="w-20 h-3" />
            </div>
            <Skeleton className="h-5 w-5 rounded" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Request detail page skeleton
export function RequestDetailSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start gap-4">
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton variant="title" className="w-64 h-8" />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <SkeletonBadge />
            <Skeleton variant="text" className="w-32" />
            <Skeleton variant="text" className="w-28" />
          </div>
        </div>
        <div className="flex gap-2">
          <SkeletonButton />
          <SkeletonButton size="sm" className="w-10" />
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description Card */}
          <Card className="card-elevated">
            <CardHeader>
              <Skeleton variant="title" className="w-28" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Skeleton variant="text" className="w-full" />
                <Skeleton variant="text" className="w-full" />
                <Skeleton variant="text" className="w-3/4" />
              </div>
            </CardContent>
          </Card>

          {/* Uploads Section */}
          <Card className="card-elevated">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="space-y-2">
                <Skeleton variant="title" className="w-20" />
                <Skeleton variant="text" className="w-32" />
              </div>
              <SkeletonButton size="sm" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square rounded-xl" />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Comments Section */}
          <Card className="card-elevated">
            <CardHeader>
              <Skeleton variant="title" className="w-24" />
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <SkeletonAvatar size="sm" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton variant="text" className="w-24" />
                      <Skeleton variant="text" className="w-16 h-3" />
                    </div>
                    <Skeleton variant="text" className="w-full" />
                    <Skeleton variant="text" className="w-2/3" />
                  </div>
                </div>
              ))}
              <div className="pt-4 border-t border-border">
                <Skeleton className="h-24 w-full rounded-xl" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Request Info */}
          <Card className="card-elevated">
            <CardHeader>
              <Skeleton variant="title" className="w-28" />
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <Skeleton variant="text" className="w-20" />
                  <Skeleton variant="text" className="w-24" />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Creator Info */}
          <Card className="card-elevated">
            <CardHeader>
              <Skeleton variant="title" className="w-20" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <SkeletonAvatar size="lg" />
                <div className="space-y-1.5">
                  <Skeleton variant="text" className="w-28" />
                  <Skeleton variant="text" className="w-40 h-3" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Activity */}
          <Card className="card-elevated">
            <CardHeader>
              <Skeleton variant="title" className="w-20" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Skeleton className="h-2 w-2 rounded-full mt-2" />
                  <div className="flex-1 space-y-1">
                    <Skeleton variant="text" className="w-full" />
                    <Skeleton variant="text" className="w-24 h-3" />
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

// New request form skeleton
export function NewRequestFormSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("max-w-3xl mx-auto space-y-6", className)}>
      <div className="space-y-2">
        <Skeleton variant="title" className="w-48 h-8" />
        <Skeleton variant="text" className="w-80" />
      </div>

      <Card className="card-elevated">
        <CardContent className="p-6 space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Skeleton variant="text" className="w-12 h-4" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>

          {/* Creator */}
          <div className="space-y-2">
            <Skeleton variant="text" className="w-16 h-4" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Skeleton variant="text" className="w-24 h-4" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>

          {/* Due Date */}
          <div className="space-y-2">
            <Skeleton variant="text" className="w-20 h-4" />
            <Skeleton className="h-12 w-full md:w-48 rounded-xl" />
          </div>

          {/* Template */}
          <div className="space-y-2">
            <Skeleton variant="text" className="w-28 h-4" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <SkeletonButton className="flex-1 md:flex-none md:w-32" />
            <SkeletonButton size="sm" className="w-24" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
