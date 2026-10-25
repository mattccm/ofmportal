"use client";

import { Clock, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RequestCompletion {
  totalSlots: number;
  uploadedSlots: number;
  approvedSlots: number;
}

export function formatEstimate(minutes?: number | null): string | null {
  if (!minutes || minutes <= 0) return null;
  if (minutes < 60) return `~${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins === 0 ? `~${hours} hr` : `~${hours}h ${mins}m`;
}

/**
 * Creator-facing progress for a single request: a two-tone bar (approved solid,
 * uploaded-not-yet-approved translucent, remaining as track) plus a done/left
 * count and the agency's time estimate.
 */
export function RequestProgress({
  completion,
  estimatedMinutes,
  className,
}: {
  completion?: RequestCompletion;
  estimatedMinutes?: number | null;
  className?: string;
}) {

  const uploaded = Math.max(completion?.uploadedSlots ?? 0, 0);
  const approved = Math.max(completion?.approvedSlots ?? 0, 0);
  // Every request represents at least one deliverable, so the total never reads
  // as a bare 0 for a request that hasn't been started yet.
  const total = Math.max(completion?.totalSlots ?? 0, uploaded, 1);

  const uploadedPct = Math.min(100, (uploaded / total) * 100);
  const approvedPct = Math.min(100, (approved / total) * 100);
  const remaining = Math.max(total - uploaded, 0);
  const allApproved = approved >= total;
  const estLabel = formatEstimate(estimatedMinutes);

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-foreground/80 tabular-nums">
          {uploaded}/{total} uploaded
          {approved > 0 && ` · ${approved} approved`}
        </span>
        <div className="flex items-center gap-3 text-muted-foreground shrink-0">
          {estLabel && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {estLabel}
            </span>
          )}
          {allApproved ? (
            <span className="inline-flex items-center gap-1 font-medium text-approved">
              <CheckCircle2 className="h-3 w-3" />
              Done
            </span>
          ) : (
            <span className="tabular-nums">{remaining} left</span>
          )}
        </div>
      </div>
      <div
        className="flex h-1.5 w-full overflow-hidden rounded-full bg-ctl"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={uploaded}
        aria-label="Upload progress"
      >
        <div
          className="h-full bg-approved"
          style={{ width: `${approvedPct}%` }}
        />
        <div
          className="h-full bg-ready"
          style={{ width: `${Math.max(uploadedPct - approvedPct, 0)}%` }}
        />
      </div>
    </div>
  );
}
