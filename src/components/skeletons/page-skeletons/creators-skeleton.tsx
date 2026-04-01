"use client"

import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton, SkeletonAvatar, SkeletonBadge, SkeletonButton } from "@/components/ui/skeleton"
import { TableSkeleton } from "../table-skeleton"
import { MobileListSkeleton } from "../list-skeleton"

interface CreatorsSkeletonProps {
  /**
   * Number of items to show
   */
  items?: number
  /**
   * Custom className
   */
  className?: string
}

export function CreatorsSkeleton({
  items = 6,
  className,
}: CreatorsSkeletonProps) {
  return (
    <div className={cn("space-y-4 md:space-y-6", className)}>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton variant="title" className="w-32 h-8 md:h-9" />
          <Skeleton variant="text" className="w-64" />
        </div>
        <SkeletonButton className="w-full sm:w-auto min-h-[44px]" />
      </div>

      {/* Mobile Card View */}
      <div className="block md:hidden space-y-3">
        <Skeleton variant="text" className="w-36 px-1" />
        {Array.from({ length: items }).map((_, i) => (
          <CreatorCardSkeleton key={i} />
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block">
        <TableSkeleton
          rows={items}
          columns={6}
          showAvatar={true}
          showActions={true}
          cardTitle={true}
        />
      </div>
    </div>
  )
}

// Single creator card skeleton (for mobile)
export function CreatorCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("card-elevated", className)}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <SkeletonAvatar size="lg" />

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-1.5">
                <Skeleton variant="text" className="w-32" />
                <Skeleton variant="text" className="w-48 h-3" />
              </div>
              <Skeleton className="h-5 w-5 flex-shrink-0" />
            </div>

            {/* Stats Row */}
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton variant="text" className="w-16 h-3" />
              </div>
              <div className="flex items-center gap-1.5">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton variant="text" className="w-20 h-3" />
              </div>
            </div>

            {/* Status & Last Active */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
              <SkeletonBadge />
              <Skeleton variant="text" className="w-28 h-3" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Creator detail page skeleton
export function CreatorDetailSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start gap-6">
        <SkeletonAvatar size="xl" className="h-24 w-24" />
        <div className="flex-1 space-y-4">
          <div className="space-y-2">
            <Skeleton variant="title" className="w-48 h-8" />
            <Skeleton variant="text" className="w-64" />
          </div>
          <div className="flex flex-wrap gap-3">
            <SkeletonBadge className="w-20" />
            <Skeleton variant="text" className="w-32" />
            <Skeleton variant="text" className="w-28" />
          </div>
        </div>
        <div className="flex gap-2">
          <SkeletonButton />
          <Skeleton className="h-10 w-10 rounded-lg" />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="card-elevated">
            <CardContent className="p-4">
              <Skeleton variant="text" className="w-20 h-3 mb-2" />
              <Skeleton variant="title" className="w-12 h-7" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} variant="text" className="w-20 h-4 mb-3" />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="card-elevated">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton variant="text" className="w-48" />
                  <Skeleton variant="text" className="w-32 h-3" />
                </div>
                <SkeletonBadge />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// Creator invite form skeleton
export function CreatorInviteFormSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("max-w-2xl mx-auto space-y-6", className)}>
      <div className="space-y-2">
        <Skeleton variant="title" className="w-40 h-8" />
        <Skeleton variant="text" className="w-80" />
      </div>

      <Card className="card-elevated">
        <CardContent className="p-6 space-y-5">
          {/* Name field */}
          <div className="space-y-2">
            <Skeleton variant="text" className="w-16 h-4" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>

          {/* Email field */}
          <div className="space-y-2">
            <Skeleton variant="text" className="w-12 h-4" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>

          {/* Phone field */}
          <div className="space-y-2">
            <Skeleton variant="text" className="w-28 h-4" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>

          {/* Submit */}
          <div className="pt-4">
            <SkeletonButton className="w-full md:w-auto" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
