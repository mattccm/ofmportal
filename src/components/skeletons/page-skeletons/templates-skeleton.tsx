"use client"

import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton, SkeletonBadge, SkeletonButton } from "@/components/ui/skeleton"

interface TemplatesSkeletonProps {
  /**
   * Number of items to show
   */
  items?: number
  /**
   * Custom className
   */
  className?: string
}

export function TemplatesSkeleton({
  items = 6,
  className,
}: TemplatesSkeletonProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton variant="title" className="w-36 h-8" />
          <Skeleton variant="text" className="w-72" />
        </div>
        <SkeletonButton className="w-full sm:w-auto" />
      </div>

      {/* Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: items }).map((_, i) => (
          <TemplateCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

export function TemplateCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("card-elevated", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton variant="text" className="w-32" />
              <Skeleton variant="text" className="w-20 h-3" />
            </div>
          </div>
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Description */}
        <div className="space-y-1.5">
          <Skeleton variant="text" className="w-full" />
          <Skeleton variant="text" className="w-3/4" />
        </div>

        {/* Fields preview */}
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonBadge key={i} className="w-16" />
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <Skeleton variant="text" className="w-24 h-3" />
          <Skeleton variant="text" className="w-20 h-3" />
        </div>
      </CardContent>
    </Card>
  )
}

export function TemplateEditorSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("max-w-4xl mx-auto space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton variant="title" className="w-40 h-8" />
        </div>
        <div className="flex gap-2">
          <SkeletonButton size="sm" className="w-24" />
          <SkeletonButton />
        </div>
      </div>

      {/* Basic Info */}
      <Card className="card-elevated">
        <CardHeader>
          <Skeleton variant="title" className="w-32" />
          <Skeleton variant="text" className="w-56" />
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Name */}
          <div className="space-y-2">
            <Skeleton variant="text" className="w-28 h-4" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
          {/* Description */}
          <div className="space-y-2">
            <Skeleton variant="text" className="w-24 h-4" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
          {/* Category */}
          <div className="space-y-2">
            <Skeleton variant="text" className="w-20 h-4" />
            <Skeleton className="h-12 w-full md:w-64 rounded-xl" />
          </div>
        </CardContent>
      </Card>

      {/* Fields */}
      <Card className="card-elevated">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-2">
            <Skeleton variant="title" className="w-32" />
            <Skeleton variant="text" className="w-64" />
          </div>
          <SkeletonButton size="sm" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex items-start gap-4 p-4 rounded-xl border border-border"
            >
              <Skeleton className="h-6 w-6 rounded mt-1 flex-shrink-0" />
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton variant="text" className="w-32" />
                  <SkeletonBadge className="w-16" />
                </div>
                <Skeleton variant="text" className="w-full h-3" />
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded" />
                    <Skeleton variant="text" className="w-16 h-3" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded" />
                    <Skeleton variant="text" className="w-20 h-3" />
                  </div>
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <Skeleton className="h-8 w-8 rounded" />
                <Skeleton className="h-8 w-8 rounded" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Settings */}
      <Card className="card-elevated">
        <CardHeader>
          <Skeleton variant="title" className="w-28" />
          <Skeleton variant="text" className="w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-4 rounded-xl border border-border"
            >
              <div className="space-y-1">
                <Skeleton variant="text" className="w-28" />
                <Skeleton variant="text" className="w-48 h-3" />
              </div>
              <Skeleton className="h-6 w-11 rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
