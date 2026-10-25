"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Countdown, FieldStrip, formatDue, type FieldSummary } from "@/components/title-wall";
import { cn } from "@/lib/utils";

export interface RequestCoverProps {
  title: string;
  /** "Sent Mon 19 Oct", set under the title (never above it) */
  sentText: string;
  due?: string | null;
  /** Finished requests show the finish instead of time left */
  completedAt?: string | null;
  /** Replaces the countdown, e.g. "Submitted for review" */
  statusText?: string;
  fields: FieldSummary[];
  /** "1 of 3 approved · 1 uploaded · 1 to do" */
  summary?: string;
  /** Makes the title a link (the creator home's featured card) */
  href?: string;
  headingLevel?: "h1" | "h2";
  headingId?: string;
  /**
   * "lg" lets the cover grow into Cover lettering on a desktop (the home's
   * featured request); "md" (default) stays at phone sizes everywhere.
   */
  size?: "md" | "lg";
  /** The next action and anything else under the strip */
  children?: ReactNode;
  className?: string;
}

/**
 * A creator request as a title card: the field strip as its spine, the title
 * set as display lettering, the meta line under it, time left as the large
 * figure, and the labelled strip (three per row so names stay readable).
 */
export function RequestCover({
  title,
  sentText,
  due,
  completedAt,
  statusText,
  fields,
  summary,
  href,
  headingLevel = "h2",
  headingId,
  size = "md",
  children,
  className,
}: RequestCoverProps) {
  const H = headingLevel;
  const len = title.length <= 18 ? "s" : title.length <= 30 ? "m" : "l";
  const big = size === "lg";

  return (
    <section
      aria-labelledby={headingId}
      className={cn("flex gap-3.5 rounded-[var(--tw-r-tile)] bg-tile p-4 pl-3", big && "lg:gap-5 lg:p-6 lg:pl-4", className)}
    >
      {fields.length > 0 && <FieldStrip fields={fields} variant="spine" audience="creator" />}
      <div className="min-w-0 flex-1">
        <H
          id={headingId}
          className={cn(
            "font-extrabold leading-[1.02] tracking-[-0.035em] text-balance [overflow-wrap:anywhere]",
            len === "s" ? "text-[clamp(34px,9vw,44px)]" : len === "m" ? "text-[30px]" : "text-[26px]",
            big && (len === "s" ? "lg:text-[44px]" : len === "m" ? "lg:text-[38px]" : "lg:text-[30px]")
          )}
        >
          {href ? (
            <Link href={href} className="rounded-sm outline-none focus-visible:underline">
              {title}
            </Link>
          ) : (
            title
          )}
        </H>
        <p className="mt-1.5 text-[14px] leading-normal text-ink-2">{sentText}</p>

        {statusText ? (
          <p className="mt-4 text-[22px] font-bold leading-tight tracking-[-0.01em]">{statusText}</p>
        ) : due ? (
          <div className="mt-4">
            <Countdown due={due} completedAt={completedAt} size={completedAt ? "sm" : "lg"} />
            <p className="mt-0.5 text-[14px] leading-normal text-ink-2">{formatDue(due)}</p>
          </div>
        ) : null}

        {fields.length > 0 && (
          <>
            <FieldStrip
              fields={fields}
              variant="labelled"
              audience="creator"
              className={cn("mt-4 grid-flow-row grid-cols-3 gap-y-3", big && "lg:grid-cols-4")}
            />
            {summary && <p className="mt-3 text-[14px] leading-normal text-ink-2">{summary}</p>}
          </>
        )}

        {children}
      </div>
    </section>
  );
}
