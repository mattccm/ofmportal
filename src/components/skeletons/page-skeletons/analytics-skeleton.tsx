"use client"

import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton, SkeletonAvatar, SkeletonButton } from "@/components/ui/skeleton"
import { StatsGridSkeleton } from "../stat-skeleton"
import { FilterFormSkeleton } from "../form-skeleton"

interface AnalyticsSkeletonProps {
  /**
   * Custom className
   */
  className?: string
}

export function AnalyticsSkeleton({ className }: AnalyticsSkeletonProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton variant="title" className="w-32 h-8" />
          <Skeleton variant="text" className="w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32 rounded-lg" />
          <SkeletonButton />
        </div>
      </div>

      {/* Date Range Filter */}
      <FilterFormSkeleton filters={3} />

      {/* Stats Overview */}
      <StatsGridSkeleton count={4} />

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Line Chart */}
        <Card className="card-elevated">
          <CardHeader>
            <Skeleton variant="title" className="w-40" />
            <Skeleton variant="text" className="w-56" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full rounded-lg" />
          </CardContent>
        </Card>

        {/* Bar Chart */}
        <Card className="card-elevated">
          <CardHeader>
            <Skeleton variant="title" className="w-36" />
            <Skeleton variant="text" className="w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full rounded-lg" />
          </CardContent>
        </Card>
      </div>

      {/* Performance Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Top Creators */}
        <Card className="card-elevated">
          <CardHeader>
            <Skeleton variant="title" className="w-32" />
            <Skeleton variant="text" className="w-40" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton variant="text" className="w-6 h-5" />
                <SkeletonAvatar size="sm" />
                <div className="flex-1 space-y-1">
                  <Skeleton variant="text" className="w-28" />
                  <Skeleton variant="text" className="w-16 h-3" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Content Types */}
        <Card className="card-elevated">
          <CardHeader>
            <Skeleton variant="title" className="w-32" />
            <Skeleton variant="text" className="w-44" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-48 w-full rounded-lg" />
            <div className="grid grid-cols-2 gap-3 mt-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Skeleton className="h-3 w-3 rounded-full" />
                  <Skeleton variant="text" className="w-20" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="card-elevated">
          <CardHeader>
            <Skeleton variant="title" className="w-32" />
            <Skeleton variant="text" className="w-36" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
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

      {/* Data Table */}
      <Card className="card-elevated">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-2">
            <Skeleton variant="title" className="w-36" />
            <Skeleton variant="text" className="w-56" />
          </div>
          <SkeletonButton size="sm" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Table header */}
            <div className="flex items-center gap-4 p-3 border-b border-border">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton
                  key={i}
                  variant="text"
                  className={cn(
                    "h-4",
                    i === 0 ? "w-32" : "w-20"
                  )}
                />
              ))}
            </div>
            {/* Table rows */}
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-3">
                <div className="flex items-center gap-3 w-32">
                  <SkeletonAvatar size="sm" />
                  <Skeleton variant="text" className="w-20" />
                </div>
                {Array.from({ length: 4 }).map((_, j) => (
                  <Skeleton key={j} variant="text" className="w-20" />
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
