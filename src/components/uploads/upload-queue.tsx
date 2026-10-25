"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  File,
  Image as ImageIcon,
  Video,
  Music,
  X,
  RefreshCw,
  Pause,
  Play,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/file-utils";
import type { QueuedFile, UploadStatus } from "@/hooks/use-file-upload";

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
  /** Lets the list fold away under its heading */
  collapsible?: boolean;
  /** Maximum items to show before "Show N more" */
  maxVisibleItems?: number;
}

function getFileIcon(mimeType: string, className?: string) {
  const iconClass = cn("size-4", className);
  if (mimeType.startsWith("image/")) return <ImageIcon className={iconClass} aria-hidden="true" />;
  if (mimeType.startsWith("video/")) return <Video className={iconClass} aria-hidden="true" />;
  if (mimeType.startsWith("audio/")) return <Music className={iconClass} aria-hidden="true" />;
  return <File className={iconClass} aria-hidden="true" />;
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  return `${Math.round(seconds / 3600)} h`;
}

function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`;
  if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
}

/** The creator's own words for each upload state */
const STATUS_WORD: Record<UploadStatus, string> = {
  pending: "Waiting",
  uploading: "Uploading",
  paused: "Paused",
  completed: "Uploaded",
  error: "Didn't upload",
  cancelled: "Cancelled",
};

/** A thin bar that fills by transform only, so it never reflows the row */
function Bar({ value, tone }: { value: number; tone: "ready" | "ink" | "late" }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <span
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v)}
      className="relative block h-1.5 w-full overflow-hidden rounded-full bg-ctl"
    >
      <span
        className={cn(
          "absolute inset-0 origin-left rounded-full transition-transform duration-200 ease-out motion-reduce:transition-none",
          tone === "ready" ? "bg-ready" : tone === "late" ? "bg-late" : "bg-ink"
        )}
        style={{ transform: `scaleX(${v / 100})` }}
      />
    </span>
  );
}

interface QueueItemProps {
  file: QueuedFile;
  onPause?: (fileId: string) => void;
  onResume?: (fileId: string) => void;
  onRetry?: (fileId: string) => void;
  onCancel?: (fileId: string) => void;
  onRemove?: (fileId: string) => void;
}

/** 44px icon actions that are always visible: a phone has no hover */
function RowAction({
  label,
  onClick,
  children,
  tone,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  tone?: "late";
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("size-11 md:size-9", tone === "late" ? "text-late hover:text-late" : "text-icon hover:text-ink")}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      {children}
    </Button>
  );
}

function QueueItem({ file, onPause, onResume, onRetry, onCancel, onRemove }: QueueItemProps) {
  const name = file.file.name;
  const meta: string[] = [formatFileSize(file.file.size)];
  if (file.status === "uploading") {
    meta.push(`${file.progress}%`);
    if (file.speed) meta.push(formatSpeed(file.speed));
    if (file.timeRemaining !== undefined && file.timeRemaining > 0) meta.push(`${formatTime(file.timeRemaining)} left`);
  } else {
    meta.push(STATUS_WORD[file.status]);
  }
  if (file.retryCount > 0 && file.status !== "completed") meta.push(`try ${file.retryCount + 1}`);

  const showBar = file.status === "uploading" || file.status === "paused" || file.status === "completed";

  return (
    <li className="flex items-center gap-3 py-2">
      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-well text-icon">
        {getFileIcon(file.file.type)}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{name}</p>
        <p className={cn("text-[13px] text-ink-2 tabular-nums", file.status === "error" && "text-late")}>
          {meta.join(" · ")}
        </p>
        {file.status === "error" && file.error && (
          <p className="text-[13px] text-late">{file.error}. Tap retry to try again.</p>
        )}
        {showBar && (
          <span className="mt-1.5 block">
            <Bar value={file.status === "completed" ? 100 : file.progress} tone={file.status === "paused" ? "ink" : "ready"} />
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center">
        {file.status === "uploading" && onPause && (
          <RowAction label={`Pause ${name}`} onClick={() => onPause(file.id)}>
            <Pause className="size-4" />
          </RowAction>
        )}
        {file.status === "paused" && onResume && (
          <RowAction label={`Resume ${name}`} onClick={() => onResume(file.id)}>
            <Play className="size-4" />
          </RowAction>
        )}
        {file.status === "error" && onRetry && (
          <RowAction label={`Retry ${name}`} onClick={() => onRetry(file.id)}>
            <RefreshCw className="size-4" />
          </RowAction>
        )}
        {(file.status === "uploading" || file.status === "pending" || file.status === "paused") && onCancel && (
          <RowAction label={`Cancel ${name}`} onClick={() => onCancel(file.id)} tone="late">
            <X className="size-4" />
          </RowAction>
        )}
        {(file.status === "completed" || file.status === "error" || file.status === "cancelled") && onRemove && (
          <RowAction label={`Remove ${name} from this list`} onClick={() => onRemove(file.id)}>
            <X className="size-4" />
          </RowAction>
        )}
      </div>
    </li>
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

  const stats = useMemo(
    () => ({
      uploading: queue.filter((f) => f.status === "uploading").length,
      pending: queue.filter((f) => f.status === "pending").length,
      paused: queue.filter((f) => f.status === "paused").length,
      completed: queue.filter((f) => f.status === "completed").length,
      error: queue.filter((f) => f.status === "error").length,
      cancelled: queue.filter((f) => f.status === "cancelled").length,
    }),
    [queue]
  );

  const hasActiveUploads = stats.uploading > 0 || stats.pending > 0 || stats.paused > 0;
  const hasCompletedOrFailed = stats.completed > 0 || stats.error > 0 || stats.cancelled > 0;

  // Uploading first, then waiting, paused, failed, cancelled, uploaded
  const sortedQueue = useMemo(() => {
    const order: Record<UploadStatus, number> = { uploading: 0, pending: 1, paused: 2, error: 3, cancelled: 4, completed: 5 };
    return [...queue].sort((a, b) => order[a.status] - order[b.status]);
  }, [queue]);

  const visibleQueue = showAll ? sortedQueue : sortedQueue.slice(0, maxVisibleItems);
  const hiddenCount = sortedQueue.length - visibleQueue.length;

  if (queue.length === 0) return null;

  const active = stats.uploading + stats.pending + stats.paused;
  const heading = active > 0
    ? `Uploading ${active} file${active !== 1 ? "s" : ""}`
    : stats.error > 0
      ? `${stats.error} file${stats.error !== 1 ? "s" : ""} didn't upload`
      : `${stats.completed} file${stats.completed !== 1 ? "s" : ""} uploaded`;

  return (
    <section className={cn("rounded-[var(--tw-r-ctl)] bg-well px-3 py-2", className)} aria-label="Uploads in progress">
      <div className="flex min-h-11 items-center gap-2">
        <p className="flex-1 text-sm font-semibold text-ink" aria-live="polite">
          {heading}
          {isUploading && totalSize > 0 && (
            <span className="ml-2 font-normal text-ink-2 tabular-nums">
              {formatFileSize(uploadedSize)} of {formatFileSize(totalSize)} · {totalProgress}%
            </span>
          )}
        </p>
        {collapsible && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 md:size-9"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? "Hide the upload list" : "Show the upload list"}
          >
            {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </Button>
        )}
      </div>

      {isUploading && totalSize > 0 && <Bar value={totalProgress} tone="ready" />}

      {isExpanded && (
        <>
          <ul className="divide-y divide-line">
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
          </ul>

          {(hiddenCount > 0 || showAll || hasActiveUploads || hasCompletedOrFailed) && (
            <div className="flex flex-wrap items-center gap-1 pt-1">
              {hasActiveUploads && stats.paused < stats.pending + stats.uploading && onPauseAll && (
                <Button type="button" variant="ghost" size="sm" className="h-11 md:h-9" onClick={onPauseAll}>
                  <Pause className="size-4" />
                  Pause all
                </Button>
              )}
              {stats.paused > 0 && onResumeAll && (
                <Button type="button" variant="ghost" size="sm" className="h-11 md:h-9" onClick={onResumeAll}>
                  <Play className="size-4" />
                  Resume all
                </Button>
              )}
              {sortedQueue.length > maxVisibleItems && (
                <Button type="button" variant="ghost" size="sm" className="h-11 md:h-9" onClick={() => setShowAll(!showAll)}>
                  {showAll ? "Show fewer" : `Show ${hiddenCount} more`}
                </Button>
              )}
              <span className="flex-1" />
              {hasCompletedOrFailed && onClearCompleted && (
                <Button type="button" variant="ghost" size="sm" className="h-11 text-ink-2 md:h-9" onClick={onClearCompleted}>
                  Clear finished
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

/** One line for small spaces: what is uploading and how far along */
export function UploadQueueInline({
  queue,
  totalProgress,
  isUploading,
  onClearCompleted,
  className,
}: Pick<UploadQueueProps, "queue" | "totalProgress" | "isUploading" | "onClearCompleted" | "className">) {
  const stats = useMemo(
    () => ({
      uploading: queue.filter((f) => f.status === "uploading").length,
      pending: queue.filter((f) => f.status === "pending").length,
      completed: queue.filter((f) => f.status === "completed").length,
      error: queue.filter((f) => f.status === "error").length,
    }),
    [queue]
  );

  if (queue.length === 0) return null;

  const line = isUploading
    ? `Uploading ${stats.uploading + stats.pending} file${stats.uploading + stats.pending !== 1 ? "s" : ""}`
    : stats.completed === queue.length
      ? "Everything uploaded"
      : stats.error > 0
        ? `${stats.error} file${stats.error !== 1 ? "s" : ""} didn't upload`
        : `${queue.length} in the list`;

  return (
    <div className={cn("flex items-center gap-3 rounded-[var(--tw-r-ctl)] bg-well p-3", className)}>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-medium", stats.error > 0 && !isUploading ? "text-late" : "text-ink")} aria-live="polite">
          {line}
          {isUploading && <span className="ml-2 font-normal text-ink-2 tabular-nums">{totalProgress ?? 0}%</span>}
        </p>
        {isUploading && (
          <span className="mt-1.5 block">
            <Bar value={totalProgress ?? 0} tone="ready" />
          </span>
        )}
      </div>
      {stats.completed > 0 && onClearCompleted && (
        <Button type="button" variant="ghost" size="sm" className="h-11 md:h-9" onClick={onClearCompleted}>
          Clear
        </Button>
      )}
    </div>
  );
}

export default UploadQueue;
