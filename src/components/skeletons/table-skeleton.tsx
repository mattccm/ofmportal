"use client"

import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton, SkeletonAvatar, SkeletonBadge, SkeletonText } from "@/components/ui/skeleton"

interface TableSkeletonProps {
  /**
   * Number of rows to show
   */
  rows?: number
  /**
   * Number of columns
   */
  columns?: number
  /**
   * Show avatar in first column
   */
  showAvatar?: boolean
  /**
   * Show header
   */
  showHeader?: boolean
  /**
   * Show actions column
   */
  showActions?: boolean
  /**
   * Custom className
   */
  className?: string
  /**
   * Wrap in card
   */
  inCard?: boolean
  /**
   * Card title
   */
  cardTitle?: boolean
}

export function TableSkeleton({
  rows = 5,
  columns = 5,
  showAvatar = true,
  showHeader = true,
  showActions = true,
  className,
  inCard = true,
  cardTitle = true,
}: TableSkeletonProps) {
  const content = (
    <Table>
      {showHeader && (
        <TableHeader>
          <TableRow>
            {Array.from({ length: columns }).map((_, i) => (
              <TableHead key={i}>
                <Skeleton variant="text" className={cn(
                  "h-4",
                  i === 0 ? "w-24" : "w-16"
                )} />
              </TableHead>
            ))}
            {showActions && <TableHead className="w-[50px]" />}
          </TableRow>
        </TableHeader>
      )}
      <TableBody>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <TableRow key={rowIndex}>
            {Array.from({ length: columns }).map((_, colIndex) => (
              <TableCell key={colIndex}>
                {colIndex === 0 && showAvatar ? (
                  <div className="flex items-center gap-3">
                    <SkeletonAvatar />
                    <div className="space-y-1.5">
                      <Skeleton variant="text" className="w-24" />
                      <Skeleton variant="text" className="w-32 h-3" />
                    </div>
                  </div>
                ) : colIndex === 2 ? (
                  <SkeletonBadge />
                ) : (
                  <Skeleton variant="text" className={cn(
                    colIndex === 1 ? "w-32" : "w-20"
                  )} />
                )}
              </TableCell>
            ))}
            {showActions && (
              <TableCell>
                <Skeleton className="h-9 w-9 rounded-lg" />
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )

  if (!inCard) {
    return <div className={className}>{content}</div>
  }

  return (
    <Card className={cn("card-elevated", className)}>
      {cardTitle && (
        <CardHeader>
          <Skeleton variant="title" className="w-32" />
          <Skeleton variant="text" className="w-48" />
        </CardHeader>
      )}
      <CardContent className={!cardTitle ? "pt-4" : undefined}>
        {content}
      </CardContent>
    </Card>
  )
}

// Simple table rows skeleton without card wrapper
export function TableRowsSkeleton({
  rows = 5,
  columns = 4,
  className,
}: {
  rows?: number
  columns?: number
  className?: string
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 p-3 rounded-lg border border-border/50"
        >
          <SkeletonAvatar size="sm" />
          <div className="flex-1 flex items-center gap-6">
            {Array.from({ length: columns - 1 }).map((_, j) => (
              <Skeleton
                key={j}
                variant="text"
                className={cn(
                  j === 0 ? "w-32 flex-shrink-0" : "w-20"
                )}
              />
            ))}
          </div>
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
      ))}
    </div>
  )
}
