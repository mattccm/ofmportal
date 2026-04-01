"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Progress,
  ProgressTrack,
  ProgressIndicator,
} from "@/components/ui/progress";
import {
  Calendar,
  Upload,
  MessageCircle,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Circle,
  ArrowRight,
} from "lucide-react";
import { format, formatDistanceToNow, isPast, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";

export type RequestStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "NEEDS_REVISION"
  | "APPROVED";

interface RequestCardProps {
  id: string;
  creatorId: string;
  title: string;
  description?: string | null;
  status: RequestStatus;
  dueDate?: string | null;
  uploadCount?: number;
  totalRequired?: number;
  commentCount?: number;
  createdAt: string;
  urgency?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  className?: string;
}

const statusConfig: Record<
  RequestStatus,
  { label: string; color: string; icon: React.ReactNode; bgClass: string }
> = {
  PENDING: {
    label: "Pending",
    color: "text-amber-600",
    icon: <Circle className="h-3 w-3 fill-amber-500 text-amber-500" />,
    bgClass: "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800",
  },
  IN_PROGRESS: {
    label: "In Progress",
    color: "text-blue-600",
    icon: <Clock className="h-3 w-3 text-blue-500" />,
    bgClass: "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800",
  },
  SUBMITTED: {
    label: "Submitted",
    color: "text-violet-600",
    icon: <Upload className="h-3 w-3 text-violet-500" />,
    bgClass: "bg-violet-50 border-violet-200 dark:bg-violet-900/20 dark:border-violet-800",
  },
  UNDER_REVIEW: {
    label: "Under Review",
    color: "text-orange-600",
    icon: <Clock className="h-3 w-3 text-orange-500" />,
    bgClass: "bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800",
  },
  NEEDS_REVISION: {
    label: "Needs Revision",
    color: "text-red-600",
    icon: <AlertTriangle className="h-3 w-3 text-red-500" />,
    bgClass: "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800",
  },
  APPROVED: {
    label: "Approved",
    color: "text-emerald-600",
    icon: <CheckCircle2 className="h-3 w-3 text-emerald-500" />,
    bgClass: "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800",
  },
};

function getDueDateInfo(dueDate: string | null | undefined) {
  if (!dueDate) return null;

  const date = new Date(dueDate);
  const now = new Date();
  const daysUntil = differenceInDays(date, now);
  const isOverdue = isPast(date);

  let urgencyColor = "text-muted-foreground";
  let bgColor = "";

  if (isOverdue) {
    urgencyColor = "text-red-600";
    bgColor = "bg-red-50";
  } else if (daysUntil <= 1) {
    urgencyColor = "text-red-600";
    bgColor = "bg-red-50";
  } else if (daysUntil <= 3) {
    urgencyColor = "text-amber-600";
    bgColor = "bg-amber-50";
  } else if (daysUntil <= 7) {
    urgencyColor = "text-orange-600";
    bgColor = "bg-orange-50";
  }

  return {
    formatted: format(date, "MMM d, yyyy"),
    relative: formatDistanceToNow(date, { addSuffix: true }),
    isOverdue,
    daysUntil,
    urgencyColor,
    bgColor,
  };
}

export function RequestCard({
  id,
  creatorId,
  title,
  description,
  status,
  dueDate,
  uploadCount = 0,
  totalRequired,
  commentCount = 0,
  createdAt,
  className,
}: RequestCardProps) {
  const statusInfo = statusConfig[status];
  const dueDateInfo = getDueDateInfo(dueDate);
  const uploadProgress = totalRequired
    ? Math.min(100, (uploadCount / totalRequired) * 100)
    : null;

  const isActionable =
    status === "PENDING" ||
    status === "IN_PROGRESS" ||
    status === "NEEDS_REVISION";

  return (
    <Link href={`/creator/requests/${id}`}>
      <Card
        className={cn(
          "group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer",
          isActionable && "ring-1 ring-primary/10 hover:ring-primary/20",
          status === "NEEDS_REVISION" && "ring-1 ring-red-200 hover:ring-red-300",
          className
        )}
      >
        {/* Status indicator strip */}
        <div
          className={cn(
            "absolute top-0 left-0 w-1 h-full rounded-l-xl transition-all duration-300",
            status === "PENDING" && "bg-amber-500",
            status === "IN_PROGRESS" && "bg-blue-500",
            status === "SUBMITTED" && "bg-violet-500",
            status === "UNDER_REVIEW" && "bg-orange-500",
            status === "NEEDS_REVISION" && "bg-red-500",
            status === "APPROVED" && "bg-emerald-500"
          )}
        />

        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base leading-tight group-hover:text-primary transition-colors line-clamp-1">
                {title}
              </h3>
              {description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {description}
                </p>
              )}
            </div>
            <Badge
              variant="outline"
              className={cn(
                "shrink-0 gap-1.5 font-medium",
                statusInfo.bgClass,
                statusInfo.color
              )}
            >
              {statusInfo.icon}
              {statusInfo.label}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {/* Progress indicator for uploads */}
          {uploadProgress !== null && isActionable && (
            <div className="mb-4">
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="text-muted-foreground">Upload Progress</span>
                <span className="font-medium">
                  {uploadCount}/{totalRequired}
                </span>
              </div>
              <Progress value={uploadProgress}>
                <ProgressTrack className="h-2">
                  <ProgressIndicator
                    className={cn(
                      uploadProgress >= 100
                        ? "bg-emerald-500"
                        : "bg-gradient-to-r from-violet-500 to-purple-500"
                    )}
                  />
                </ProgressTrack>
              </Progress>
            </div>
          )}

          {/* Metadata row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            {/* Due date */}
            {dueDateInfo && (
              <div
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-md -ml-2",
                  dueDateInfo.bgColor
                )}
              >
                <Calendar className={cn("h-3.5 w-3.5", dueDateInfo.urgencyColor)} />
                <span className={cn("font-medium", dueDateInfo.urgencyColor)}>
                  {dueDateInfo.isOverdue ? (
                    <>Overdue</>
                  ) : dueDateInfo.daysUntil <= 1 ? (
                    <>Due tomorrow</>
                  ) : dueDateInfo.daysUntil <= 7 ? (
                    <>Due {dueDateInfo.relative}</>
                  ) : (
                    <>{dueDateInfo.formatted}</>
                  )}
                </span>
              </div>
            )}

            {/* Upload count */}
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Upload className="h-3.5 w-3.5" />
              <span>
                {uploadCount} file{uploadCount !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Comment count */}
            {commentCount > 0 && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <MessageCircle className="h-3.5 w-3.5" />
                <span>{commentCount}</span>
              </div>
            )}

            {/* Created time */}
            <div className="flex items-center gap-1.5 text-muted-foreground ml-auto">
              <span className="text-xs">
                {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
              </span>
            </div>
          </div>

          {/* Action hint on hover */}
          {isActionable && (
            <div className="flex items-center gap-1 text-sm font-medium text-primary mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <span>Upload content</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

// Compact version for lists
export function RequestCardCompact({
  id,
  creatorId,
  title,
  status,
  dueDate,
  uploadCount = 0,
}: Omit<
  RequestCardProps,
  "description" | "createdAt" | "commentCount" | "urgency" | "className"
> & { createdAt?: string }) {
  const statusInfo = statusConfig[status];
  const dueDateInfo = getDueDateInfo(dueDate);

  return (
    <Link href={`/creator/requests/${id}`}>
      <div className="flex items-center gap-4 p-3 rounded-lg hover:bg-accent/50 transition-colors group">
        <div
          className={cn(
            "w-2 h-2 rounded-full shrink-0",
            status === "PENDING" && "bg-amber-500",
            status === "IN_PROGRESS" && "bg-blue-500",
            status === "SUBMITTED" && "bg-violet-500",
            status === "UNDER_REVIEW" && "bg-orange-500",
            status === "NEEDS_REVISION" && "bg-red-500",
            status === "APPROVED" && "bg-emerald-500"
          )}
        />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
            {title}
          </p>
          <p className="text-xs text-muted-foreground">
            {statusInfo.label}
            {dueDateInfo && ` - Due ${dueDateInfo.relative}`}
          </p>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="flex items-center gap-1 text-xs">
            <Upload className="h-3 w-3" />
            {uploadCount}
          </div>
          <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
    </Link>
  );
}
