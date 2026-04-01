"use client"

import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton, SkeletonAvatar, SkeletonBadge, SkeletonText } from "@/components/ui/skeleton"
import { StatsGridSkeleton } from "../stat-skeleton"
import { ActionCardSkeleton, AlertCardSkeleton } from "../card-skeleton"
import { ActivityFeedSkeleton, ListItemSkeleton } from "../list-skeleton"
import { CreatorPerformanceSkeleton } from "../profile-skeleton"

interface DashboardSkeletonProps {
  /**
   * Custom className
   */
  className?: string
  /**
   * Show quick actions section
   */
  showQuickActions?: boolean
  /**
   * Show alert banners
   */
  showAlerts?: boolean
}

export function DashboardSkeleton({
  className,
  showQuickActions = true,
  showAlerts = true,
}: DashboardSkeletonProps) {
  return (
    <div className={cn("space-y-6 md:space-y-8", className)}>
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton variant="text" className="w-24 h-4" />
        </div>
        <Skeleton variant="title" className="w-64 h-8 md:h-9" />
        <Skeleton variant="text" className="w-80 h-4 md:h-5" />
      </div>

      {/* Quick Stats Cards */}
      <StatsGridSkeleton count={5} />

      {/* Alert Banners */}
      {showAlerts && (
        <div className="space-y-3">
          <AlertCardSkeleton />
        </div>
      )}

      {/* Quick Actions Panel */}
      {showQuickActions && (
        <div className="space-y-3">
          <Skeleton variant="text" className="w-28 h-4 px-1" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <ActionCardSkeleton key={i} />
            ))}
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Activity Feed - Takes 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Real-time Activity Feed */}
          <Card className="card-elevated">
            <CardHeader className="flex flex-row items-center justify-between pb-3 md:pb-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-5 rounded" />
                  <Skeleton variant="title" className="w-28" />
                </div>
                <Skeleton variant="text" className="w-44 hidden md:block" />
              </div>
              <Skeleton className="h-9 w-20 rounded-lg" />
            </CardHeader>
            <CardContent className="pt-0">
              <ActivityFeedSkeleton items={5} />
            </CardContent>
          </Card>

          {/* Recent Requests */}
          <Card className="card-elevated">
            <CardHeader className="flex flex-row items-center justify-between pb-3 md:pb-4">
              <div className="space-y-2">
                <Skeleton variant="title" className="w-36" />
                <Skeleton variant="text" className="w-56 hidden md:block" />
              </div>
              <Skeleton className="h-9 w-20 rounded-lg" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2 md:space-y-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 rounded-xl min-h-[64px]"
                  >
                    <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
                      <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <Skeleton variant="text" className="w-40" />
                        <Skeleton variant="text" className="w-32 h-3" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 md:gap-3 flex-shrink-0 ml-2">
                      <SkeletonBadge />
                      <Skeleton className="h-4 w-4 rounded hidden md:block" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Widgets */}
        <div className="space-y-6">
          {/* Upcoming Deadlines Widget */}
          <Card className="card-elevated">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-5 rounded" />
                <Skeleton variant="title" className="w-40" />
              </div>
              <Skeleton variant="text" className="w-20" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border"
                  >
                    <SkeletonAvatar size="sm" />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <Skeleton variant="text" className="w-32" />
                      <div className="flex items-center gap-2">
                        <Skeleton variant="text" className="w-20 h-3" />
                        <Skeleton variant="text" className="w-16 h-3" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Skeleton className="h-9 w-full mt-3 rounded-lg" />
            </CardContent>
          </Card>

          {/* Creator Performance Widget */}
          <Card className="card-elevated">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-5 rounded" />
                <Skeleton variant="title" className="w-32" />
              </div>
              <Skeleton variant="text" className="w-20" />
            </CardHeader>
            <CardContent className="pt-0">
              <CreatorPerformanceSkeleton items={5} />
              <Skeleton className="h-9 w-full mt-3 rounded-lg" />
            </CardContent>
          </Card>

          {/* Pro Tip Card */}
          <div className="p-4 rounded-xl border border-muted">
            <div className="flex items-start gap-3">
              <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton variant="text" className="w-16" />
                <SkeletonText lines={2} />
                <Skeleton variant="text" className="w-28 h-4" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Simplified dashboard skeleton for mobile
export function MobileDashboardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="space-y-2">
        <Skeleton variant="title" className="w-48 h-7" />
        <Skeleton variant="text" className="w-64" />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="card-elevated">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <Skeleton variant="text" className="w-16 h-3" />
                <Skeleton className="h-7 w-7 rounded-lg" />
              </div>
              <Skeleton variant="title" className="w-10 h-6" />
              <Skeleton variant="text" className="w-20 h-2.5 mt-1" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alert */}
      <AlertCardSkeleton />

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <ActionCardSkeleton key={i} />
        ))}
      </div>

      {/* Activity List */}
      <Card className="card-elevated">
        <CardHeader className="pb-3">
          <Skeleton variant="title" className="w-28" />
        </CardHeader>
        <CardContent className="pt-0">
          <ActivityFeedSkeleton items={4} />
        </CardContent>
      </Card>
    </div>
  )
}
