"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Progress,
  ProgressTrack,
  ProgressIndicator,
} from "@/components/ui/progress";
import {
  Upload,
  File,
  Image as ImageIcon,
  Video,
  Music,
  X,
  Check,
  AlertCircle,
  RefreshCw,
  Pause,
  Play,
  Trash2,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/file-utils";
import type { QueuedFile, UploadStatus } from "@/hooks/use-file-upload";
import { useState } from "react";

export interface UploadQueueProps {
  queue: QueuedFile[];
  onPause?: (fileId: string) => void;
  onResume?: (fileId: string) => void;
  onRetry?: (fileId: string) => void;
  onCancel?: (fileId: string) => void;
  onRemove?: (fileId: string) => void;
  onClearCompleted?: () => void;
  onPauseAll?: () => void;
  onResumeAll?: () => void;
  totalProgress?: number;
  totalSize?: number;
  uploadedSize?: number;
  isUploading?: boolean;
  className?: string;
  /** Show only active/pending uploads, collapsed otherwise */
  collapsible?: boolean;
  /** Maximum items to show before collapsing */
  maxVisibleItems?: number;
}

function getFileIcon(mimeType: string, className?: string) {
  const iconClass = cn("h-4 w-4", className);
  if (mimeType.startsWith("image/")) return <ImageIcon className={iconClass} />;
  if (mimeType.startsWith("video/")) return <Video className={iconClass} />;
  if (mimeType.startsWith("audio/")) return <Music className={iconClass} />;
  return <File className={iconClass} />;
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}

function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`;
  if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
}

const statusConfig: Record<
  UploadStatus,
  { label: string; icon: React.ReactNode; color: string; bgColor: string }
> = {
  pending: {
    label: "Pending",
    icon: <Clock className="h-3.5 w-3.5" />,
    color: "text-muted-foreground",
    bgColor: "bg-muted/50",
  },
  uploading: {
    label: "Uploading",
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-900/20",
  },
  paused: {
    label: "Paused",
    icon: <Pause className="h-3.5 w-3.5" />,
    color: "text-amber-600",
    bgColor: "bg-amber-50 dark:bg-amber-900/20",
  },
  completed: {
    label: "Completed",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50 dark:bg-emerald-900/20",
  },
  error: {
    label: "Failed",
    icon: <XCircle className="h-3.5 w-3.5" />,
    color: "text-red-600",
    bgColor: "bg-red-50 dark:bg-red-900/20",
  },
  cancelled: {
    label: "Cancelled",
    icon: <X className="h-3.5 w-3.5" />,
    color: "text-gray-500",
    bgColor: "bg-gray-50 dark:bg-gray-900/20",
  },
};

interface QueueItemProps {
  file: QueuedFile;
  onPause?: (fileId: string) => void;
  onResume?: (fileId: string) => void;
  onRetry?: (fileId: string) => void;
  onCancel?: (fileId: string) => void;
  onRemove?: (fileId: string) => void;
}

function QueueItem({
  file,
  onPause,
  onResume,
  onRetry,
  onCancel,
  onRemove,
}: QueueItemProps) {
  const status = statusConfig[file.status];

  return (
    <div
      className={cn(
        "group flex items-center gap-3 p-3 rounded-xl border transition-all duration-200",
        status.bgColor,
        "hover:shadow-sm"
      )}
    >
      {/* File icon */}
      <div
        className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
          file.status === "completed" && "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40",
          file.status === "error" && "bg-red-100 text-red-600 dark:bg-red-900/40",
          file.status === "uploading" && "bg-blue-100 text-blue-600 dark:bg-blue-900/40",
          file.status === "paused" && "bg-amber-100 text-amber-600 dark:bg-amber-900/40",
          (file.status === "pending" || file.status === "cancelled") &&
            "bg-muted text-muted-foreground"
        )}
      >
        {getFileIcon(file.file.type)}
      </div>

      {/* File info */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{file.file.name}</p>
          <span className={cn("flex items-center gap-1 text-xs", status.color)}>
            {status.icon}
            {file.status === "uploading" && file.progress > 0 && (
              <span className="font-medium">{file.progress}%</span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{formatFileSize(file.file.size)}</span>
          {file.status === "uploading" && file.speed && (
            <>
              <span className="text-border">|</span>
              <span>{formatSpeed(file.speed)}</span>
            </>
          )}
          {file.status === "uploading" && file.timeRemaining !== undefined && file.timeRemaining > 0 && (
            <>
              <span className="text-border">|</span>
              <span>{formatTime(file.timeRemaining)} left</span>
            </>
          )}
          {file.status === "error" && file.error && (
            <>
              <span className="text-border">|</span>
              <span className="text-red-600">{file.error}</span>
            </>
          )}
          {file.retryCount > 0 && file.status !== "completed" && (
            <>
              <span className="text-border">|</span>
              <span className="text-amber-600">Retry {file.retryCount}</span>
            </>
          )}
        </div>

        {/* Progress bar */}
        {file.status === "uploading" && (
          <div className="pt-1">
            <Progress value={file.progress}>
              <ProgressTrack className="h-1.5">
                <ProgressIndicator className="bg-gradient-to-r from-blue-500 to-violet-500 transition-all duration-300" />
              </ProgressTrack>
            </Progress>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {file.status === "uploading" && onPause && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-100"
            onClick={() => onPause(file.id)}
            title="Pause upload"
          >
            <Pause className="h-4 w-4" />
          </Button>
        )}

        {file.status === "paused" && onResume && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-100"
            onClick={() => onResume(file.id)}
            title="Resume upload"
          >
            <Play className="h-4 w-4" />
          </Button>
        )}

        {file.status === "error" && onRetry && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-100"
            onClick={() => onRetry(file.id)}
            title="Retry upload"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        )}

        {(file.status === "uploading" || file.status === "pending") && onCancel && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-100"
            onClick={() => onCancel(file.id)}
            title="Cancel upload"
          >
            <X className="h-4 w-4" />
          </Button>
        )}

        {(file.status === "completed" || file.status === "error" || file.status === "cancelled") &&
          onRemove && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
              onClick={() => onRemove(file.id)}
              title="Remove from queue"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
      </div>

      {/* Status indicator (visible when actions hidden) */}
      <div className="shrink-0 group-hover:hidden">
        {file.status === "completed" && (
          <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
            <Check className="h-4 w-4 text-emerald-600" />
          </div>
        )}
        {file.status === "error" && (
          <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
            <AlertCircle className="h-4 w-4 text-red-600" />
          </div>
        )}
        {file.status === "paused" && (
          <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
            <Pause className="h-4 w-4 text-amber-600" />
          </div>
        )}
        {file.status === "uploading" && (
          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
            <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
          </div>
        )}
        {file.status === "pending" && (
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}

export function UploadQueue({
  queue,
  onPause,
  onResume,
  onRetry,
  onCancel,
  onRemove,
  onClearCompleted,
  onPauseAll,
  onResumeAll,
  totalProgress = 0,
  totalSize = 0,
  uploadedSize = 0,
  isUploading = false,
  className,
  collapsible = true,
  maxVisibleItems = 5,
}: UploadQueueProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showAll, setShowAll] = useState(false);

  // Group files by status
  const stats = useMemo(() => {
    return {
      uploading: queue.filter((f) => f.status === "uploading").length,
      pending: queue.filter((f) => f.status === "pending").length,
      paused: queue.filter((f) => f.status === "paused").length,
      completed: queue.filter((f) => f.status === "completed").length,
      error: queue.filter((f) => f.status === "error").length,
      cancelled: queue.filter((f) => f.status === "cancelled").length,
    };
  }, [queue]);

  const hasActiveUploads = stats.uploading > 0 || stats.pending > 0 || stats.paused > 0;
  const hasCompletedOrFailed = stats.completed > 0 || stats.error > 0 || stats.cancelled > 0;

  // Sort queue: uploading first, then pending, paused, error, cancelled, completed
  const sortedQueue = useMemo(() => {
    const statusOrder: Record<UploadStatus, number> = {
      uploading: 0,
      pending: 1,
      paused: 2,
      error: 3,
      cancelled: 4,
      completed: 5,
    };
    return [...queue].sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
  }, [queue]);

  const visibleQueue = showAll ? sortedQueue : sortedQueue.slice(0, maxVisibleItems);
  const hiddenCount = sortedQueue.length - visibleQueue.length;

  if (queue.length === 0) {
    return null;
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      {/* Header */}
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="h-5 w-5 text-violet-500" />
            Upload Queue
            <span className="text-sm font-normal text-muted-foreground">
              ({queue.length} file{queue.length !== 1 ? "s" : ""})
            </span>
          </CardTitle>

          <div className="flex items-center gap-2">
            {/* Quick stats */}
            {stats.uploading > 0 && (
              <span className="flex items-center gap-1 text-xs text-blue-600 font-medium">
                <Loader2 className="h-3 w-3 animate-spin" />
                {stats.uploading}
              </span>
            )}
            {stats.completed > 0 && (
              <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                <CheckCircle2 className="h-3 w-3" />
                {stats.completed}
              </span>
            )}
            {stats.error > 0 && (
              <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                <XCircle className="h-3 w-3" />
                {stats.error}
              </span>
            )}

            {collapsible && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Total progress bar */}
        {isUploading && isExpanded && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {formatFileSize(uploadedSize)} of {formatFileSize(totalSize)}
              </span>
              <span className="font-medium text-blue-600">{totalProgress}%</span>
            </div>
            <Progress value={totalProgress}>
              <ProgressTrack className="h-2">
                <ProgressIndicator className="bg-gradient-to-r from-violet-500 to-purple-500 transition-all duration-300" />
              </ProgressTrack>
            </Progress>
          </div>
        )}
      </CardHeader>

      {/* Queue content */}
      {isExpanded && (
        <CardContent className="space-y-3">
          {/* Bulk actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {hasActiveUploads && stats.paused < stats.pending + stats.uploading && onPauseAll && (
                <Button variant="outline" size="sm" onClick={onPauseAll}>
                  <Pause className="h-3.5 w-3.5 mr-1.5" />
                  Pause All
                </Button>
              )}
              {stats.paused > 0 && onResumeAll && (
                <Button variant="outline" size="sm" onClick={onResumeAll}>
                  <Play className="h-3.5 w-3.5 mr-1.5" />
                  Resume All
                </Button>
              )}
            </div>

            {hasCompletedOrFailed && onClearCompleted && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={onClearCompleted}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Clear Completed
              </Button>
            )}
          </div>

          {/* File list */}
          <div className="space-y-2">
            {visibleQueue.map((file) => (
              <QueueItem
                key={file.id}
                file={file}
                onPause={onPause}
                onResume={onResume}
                onRetry={onRetry}
                onCancel={onCancel}
                onRemove={onRemove}
              />
            ))}
          </div>

          {/* Show more/less */}
          {sortedQueue.length > maxVisibleItems && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1.5" />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1.5" />
                  Show {hiddenCount} More
                </>
              )}
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// Compact inline version for smaller spaces
export function UploadQueueInline({
  queue,
  totalProgress,
  isUploading,
  onClearCompleted,
  className,
}: Pick<
  UploadQueueProps,
  "queue" | "totalProgress" | "isUploading" | "onClearCompleted" | "className"
>) {
  const stats = useMemo(() => {
    return {
      uploading: queue.filter((f) => f.status === "uploading").length,
      pending: queue.filter((f) => f.status === "pending").length,
      completed: queue.filter((f) => f.status === "completed").length,
      error: queue.filter((f) => f.status === "error").length,
    };
  }, [queue]);

  if (queue.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center gap-4 p-3 rounded-xl bg-muted/50 border",
        isUploading && "border-blue-200 bg-blue-50/50 dark:bg-blue-900/10",
        className
      )}
    >
      {/* Progress indicator */}
      <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center shrink-0">
        {isUploading ? (
          <div className="relative">
            <svg className="w-8 h-8 transform -rotate-90">
              <circle
                cx="16"
                cy="16"
                r="14"
                stroke="currentColor"
                strokeWidth="3"
                fill="none"
                className="text-muted"
              />
              <circle
                cx="16"
                cy="16"
                r="14"
                stroke="currentColor"
                strokeWidth="3"
                fill="none"
                strokeDasharray={88}
                strokeDashoffset={88 - (88 * (totalProgress || 0)) / 100}
                className="text-blue-500 transition-all duration-300"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium">
              {totalProgress}%
            </span>
          </div>
        ) : stats.completed === queue.length ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        ) : stats.error > 0 ? (
          <AlertCircle className="h-5 w-5 text-red-500" />
        ) : (
          <Upload className="h-5 w-5 text-muted-foreground" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">
          {isUploading
            ? `Uploading ${stats.uploading + stats.pending} file${stats.uploading + stats.pending !== 1 ? "s" : ""}...`
            : stats.completed === queue.length
              ? "All uploads complete"
              : stats.error > 0
                ? `${stats.error} upload${stats.error !== 1 ? "s" : ""} failed`
                : "Upload queue"}
        </p>
        <p className="text-xs text-muted-foreground">
          {stats.completed > 0 && `${stats.completed} completed`}
          {stats.completed > 0 && stats.error > 0 && ", "}
          {stats.error > 0 && `${stats.error} failed`}
          {!stats.completed && !stats.error && `${queue.length} in queue`}
        </p>
      </div>

      {/* Clear button */}
      {stats.completed > 0 && onClearCompleted && (
        <Button variant="ghost" size="sm" onClick={onClearCompleted}>
          Clear
        </Button>
      )}
    </div>
  );
}

export default UploadQueue;
