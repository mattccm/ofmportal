"use client"

import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton, SkeletonAvatar, SkeletonButton } from "@/components/ui/skeleton"
import { SettingsFormSkeleton, ToggleFormSkeleton } from "../form-skeleton"

interface SettingsSkeletonProps {
  /**
   * Custom className
   */
  className?: string
}

export function SettingsSkeleton({ className }: SettingsSkeletonProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="space-y-2">
        <Skeleton variant="title" className="w-32 h-8" />
        <Skeleton variant="text" className="w-64" />
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="text" className="w-20 h-4 mb-3" />
          ))}
        </div>
      </div>

      {/* Content */}
      <SettingsFormSkeleton sections={3} fieldsPerSection={2} />
    </div>
  )
}

export function ProfileSettingsSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="space-y-2">
        <Skeleton variant="title" className="w-48 h-8" />
        <Skeleton variant="text" className="w-80" />
      </div>

      {/* Avatar Section */}
      <Card className="card-elevated">
        <CardHeader>
          <Skeleton variant="title" className="w-32" />
          <Skeleton variant="text" className="w-64" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <SkeletonAvatar size="xl" className="h-24 w-24" />
            <div className="space-y-2">
              <SkeletonButton />
              <Skeleton variant="text" className="w-40 h-3" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile Form */}
      <Card className="card-elevated">
        <CardHeader>
          <Skeleton variant="title" className="w-40" />
          <Skeleton variant="text" className="w-56" />
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid md:grid-cols-2 gap-5">
            {/* First Name */}
            <div className="space-y-2">
              <Skeleton variant="text" className="w-20 h-4" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
            {/* Last Name */}
            <div className="space-y-2">
              <Skeleton variant="text" className="w-20 h-4" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          </div>
          {/* Email */}
          <div className="space-y-2">
            <Skeleton variant="text" className="w-12 h-4" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
          {/* Bio */}
          <div className="space-y-2">
            <Skeleton variant="text" className="w-8 h-4" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
          <div className="pt-4">
            <SkeletonButton />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function SecuritySettingsSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="space-y-2">
        <Skeleton variant="title" className="w-40 h-8" />
        <Skeleton variant="text" className="w-72" />
      </div>

      {/* Password Section */}
      <Card className="card-elevated">
        <CardHeader>
          <Skeleton variant="title" className="w-36" />
          <Skeleton variant="text" className="w-64" />
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Current Password */}
          <div className="space-y-2">
            <Skeleton variant="text" className="w-32 h-4" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
          {/* New Password */}
          <div className="space-y-2">
            <Skeleton variant="text" className="w-28 h-4" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
          {/* Confirm Password */}
          <div className="space-y-2">
            <Skeleton variant="text" className="w-36 h-4" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
          <div className="pt-4">
            <SkeletonButton />
          </div>
        </CardContent>
      </Card>

      {/* Two-Factor Section */}
      <Card className="card-elevated">
        <CardHeader>
          <Skeleton variant="title" className="w-48" />
          <Skeleton variant="text" className="w-72" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-xl border border-border">
            <div className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton variant="text" className="w-32" />
                <Skeleton variant="text" className="w-48 h-3" />
              </div>
            </div>
            <Skeleton className="h-6 w-11 rounded-full" />
          </div>
        </CardContent>
      </Card>

      {/* Sessions Section */}
      <Card className="card-elevated">
        <CardHeader>
          <Skeleton variant="title" className="w-32" />
          <Skeleton variant="text" className="w-56" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-4 rounded-xl border border-border"
            >
              <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-1.5">
                  <Skeleton variant="text" className="w-40" />
                  <Skeleton variant="text" className="w-28 h-3" />
                </div>
              </div>
              <SkeletonButton size="sm" className="w-20" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

export function NotificationSettingsSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="space-y-2">
        <Skeleton variant="title" className="w-48 h-8" />
        <Skeleton variant="text" className="w-80" />
      </div>

      {/* Email Notifications */}
      <Card className="card-elevated">
        <CardHeader>
          <Skeleton variant="title" className="w-40" />
          <Skeleton variant="text" className="w-64" />
        </CardHeader>
        <CardContent>
          <ToggleFormSkeleton items={5} />
        </CardContent>
      </Card>

      {/* Push Notifications */}
      <Card className="card-elevated">
        <CardHeader>
          <Skeleton variant="title" className="w-40" />
          <Skeleton variant="text" className="w-56" />
        </CardHeader>
        <CardContent>
          <ToggleFormSkeleton items={4} />
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <SkeletonButton />
      </div>
    </div>
  )
}
