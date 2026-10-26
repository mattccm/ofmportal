"use client";

import Link from "next/link";
import { Countdown, FieldStrip, StateWord, formatDay, formatDueOn, requestStatusState, useViewerTimeZone } from "@/components/title-wall";
import { isRequestOverdue } from "@/lib/request-status";
import type { CreatorFieldStateRow } from "@/lib/creator-field-states";
import { cn } from "@/lib/utils";
import { ACTIONABLE, IN_REVIEW, STATUS_WORD, creatorSummary, toStrip } from "./creator-words";

export interface RequestRowData {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  /** The due day ("YYYY-MM-DD" or the stored date) */
  dueOn?: string | null;
  createdAt: string;
  submittedAt?: string | null;
  unreadFeedbackCount?: number;
  fieldStates?: CreatorFieldStateRow[];
}

/**
 * One request as a list row: title and status word, time left (or when it
 * was submitted), new notes, and the field cells with their summary. Used by
 * the requests list and the desktop home's side column.
 */
export function RequestRow({ request: r, compact = false }: { request: RequestRowData; compact?: boolean }) {
  const late = ACTIONABLE.has(r.status) && isRequestOverdue(r);
  const strip = toStrip(r.fieldStates);
  const state = requestStatusState(r.status, late);
  const tz = useViewerTimeZone();
  const dueDay = formatDueOn(r.dueOn ?? r.dueDate);
  return (
    <Link
      href={`/creator/requests/${r.id}`}
      className={cn(
        "block rounded-[10px] bg-tile transition-colors hover:bg-tile-hi focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        compact ? "p-3.5" : "p-4"
      )}
    >
      <span className="flex items-baseline gap-3">
        <span className={cn("min-w-0 flex-1 truncate font-semibold", compact ? "text-[15px]" : "text-[16px]")}>
          {r.title}
        </span>
        {state ? (
          <StateWord state={state} audience="creator" className="self-center" />
        ) : (
          <span className="shrink-0 text-[13px] font-medium text-ink-2">{STATUS_WORD[r.status] ?? "Open"}</span>
        )}
      </span>
      <span className="mt-0.5 block text-[14px] text-ink-2">
        {r.dueDate && ACTIONABLE.has(r.status) ? (
          <>
            <Countdown due={r.dueDate} /> · {dueDay}
          </>
        ) : IN_REVIEW.has(r.status) && r.submittedAt ? (
          `Submitted ${formatDay(r.submittedAt, tz)}`
        ) : r.dueDate ? (
          `Due ${dueDay}`
        ) : (
          `Sent ${formatDay(r.createdAt, tz)}`
        )}
        {r.unreadFeedbackCount ? (
          <span className="text-ink">
            {" "}
            · {r.unreadFeedbackCount} new {r.unreadFeedbackCount === 1 ? "note" : "notes"}
          </span>
        ) : null}
      </span>
      {strip.length > 0 && (
        <span className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <FieldStrip fields={strip} audience="creator" className="flex-wrap" />
          <span className="min-w-0 truncate text-[13px] text-ink-2">{creatorSummary(r.fieldStates)}</span>
        </span>
      )}
    </Link>
  );
}
