"use client"

import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton, SkeletonButton } from "@/components/ui/skeleton"

interface FormSkeletonProps {
  /**
   * Number of fields to show
   */
  fields?: number
  /**
   * Show form header/title
   */
  showHeader?: boolean
  /**
   * Show submit button
   */
  showSubmit?: boolean
  /**
   * Show cancel button
   */
  showCancel?: boolean
  /**
   * Wrap in card
   */
  inCard?: boolean
  /**
   * Custom className
   */
  className?: string
  /**
   * Field types to render (cycles through these)
   */
  fieldTypes?: Array<"input" | "textarea" | "select" | "checkbox" | "radio">
}

export function FormSkeleton({
  fields = 4,
  showHeader = true,
  showSubmit = true,
  showCancel = false,
  inCard = true,
  className,
  fieldTypes = ["input", "input", "select", "textarea"],
}: FormSkeletonProps) {
  const content = (
    <div className="space-y-6">
      {showHeader && (
        <div className="space-y-2">
          <Skeleton variant="title" className="w-40 h-7" />
          <Skeleton variant="text" className="w-64" />
        </div>
      )}

      <div className="space-y-5">
        {Array.from({ length: fields }).map((_, i) => {
          const fieldType = fieldTypes[i % fieldTypes.length]
          return <FormFieldSkeleton key={i} type={fieldType} />
        })}
      </div>

      {(showSubmit || showCancel) && (
        <div className="flex items-center gap-3 pt-4">
          {showSubmit && (
            <SkeletonButton className="flex-1 md:flex-none md:w-32" />
          )}
          {showCancel && (
            <SkeletonButton size="sm" className="w-24" />
          )}
        </div>
      )}
    </div>
  )

  if (!inCard) {
    return <div className={className}>{content}</div>
  }

  return (
    <Card className={cn("card-elevated", className)}>
      <CardContent className="p-6">{content}</CardContent>
    </Card>
  )
}

// Individual form field skeleton
export function FormFieldSkeleton({
  type = "input",
  showHint = false,
  className,
}: {
  type?: "input" | "textarea" | "select" | "checkbox" | "radio"
  showHint?: boolean
  className?: string
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {/* Label */}
      <Skeleton variant="text" className="w-24 h-4" />

      {/* Field */}
      {type === "input" && (
        <Skeleton className="h-10 md:h-12 w-full rounded-xl" />
      )}

      {type === "textarea" && (
        <Skeleton className="h-24 md:h-32 w-full rounded-xl" />
      )}

      {type === "select" && (
        <Skeleton className="h-10 md:h-12 w-full rounded-xl" />
      )}

      {type === "checkbox" && (
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton variant="text" className="w-40" />
        </div>
      )}

      {type === "radio" && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton variant="text" className="w-32" />
            </div>
          ))}
        </div>
      )}

      {/* Hint text */}
      {showHint && (
        <Skeleton variant="text" className="w-48 h-3" />
      )}
    </div>
  )
}

// Settings form skeleton
export function SettingsFormSkeleton({
  sections = 3,
  fieldsPerSection = 2,
  className,
}: {
  sections?: number
  fieldsPerSection?: number
  className?: string
}) {
  return (
    <div className={cn("space-y-8", className)}>
      {Array.from({ length: sections }).map((_, sectionIndex) => (
        <Card key={sectionIndex} className="card-elevated">
          <CardHeader className="pb-4">
            <Skeleton variant="title" className="w-32" />
            <Skeleton variant="text" className="w-64" />
          </CardHeader>
          <CardContent className="space-y-5">
            {Array.from({ length: fieldsPerSection }).map((_, fieldIndex) => (
              <FormFieldSkeleton
                key={fieldIndex}
                type={fieldIndex % 2 === 0 ? "input" : "select"}
              />
            ))}
            <div className="pt-4">
              <SkeletonButton />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// Toggle/Switch form skeleton
export function ToggleFormSkeleton({
  items = 4,
  className,
}: {
  items?: number
  className?: string
}) {
  return (
    <div className={cn("space-y-4", className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between p-4 rounded-xl border border-border"
        >
          <div className="space-y-1 flex-1">
            <Skeleton variant="text" className="w-32" />
            <Skeleton variant="text" className="w-48 h-3" />
          </div>
          <Skeleton className="h-6 w-11 rounded-full flex-shrink-0" />
        </div>
      ))}
    </div>
  )
}

// Search form skeleton
export function SearchFormSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Skeleton className="flex-1 h-10 md:h-12 rounded-xl" />
      <SkeletonButton />
    </div>
  )
}

// Filter form skeleton
export function FilterFormSkeleton({
  filters = 3,
  className,
}: {
  filters?: number
  className?: string
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <Skeleton className="h-10 w-40 rounded-xl" />
      {Array.from({ length: filters }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-32 rounded-xl" />
      ))}
      <SkeletonButton size="sm" className="w-20" />
    </div>
  )
}
