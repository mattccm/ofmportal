"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Countdown } from "./countdown";
import { FieldStrip } from "./field-strip";
import { fieldSummary, type FieldSummary, type StateAudience } from "./types";

export interface TitleCardProps {
  /** The request title, set as the cover's display lettering */
  title: string;
  /** Creator display name */
  creator: string;
  /** Every field of the request, in order: drawn as the card's spine */
  fields: FieldSummary[];
  /** Due moment for the time-left figure ("YYYY-MM-DD" = end of that day) */
  due?: Date | string | number | null;
  /** Replaces the countdown with fixed text ("Uploaded 8 min ago", "Last seen today 08:40") */
  timeText?: string;
  /** Draw `timeText` in red */
  timeUrgent?: boolean;
  /** Second foot line; defaults to the field summary ("2 of 6 approved · 2 ready · 2 to come") */
  meta?: ReactNode;
  /** A finished request: dims the tile and shows the finish instead of time left */
  completedAt?: Date | string | number | null;
  /** Opens the request. The whole card becomes the link's hit area. */
  href?: string;
  /** Fixed "now" for the countdown */
  now?: Date;
  /** Heading level for the title (default h3) */
  headingLevel?: "h2" | "h3" | "h4";
  /** Small actions under the foot (Review, Remind); they sit above the card link */
  actions?: ReactNode;
  /** Extra content shown only when the tile is focused on a wall (field checklist, buttons) */
  detail?: ReactNode;
  /** Top-right affordance, e.g. an eye-off icon for an upload card */
  corner?: ReactNode;
  /** Whose words the spine's cell tooltips and the summary use (creator pages pass "creator") */
  audience?: StateAudience;
  className?: string;
}

/**
 * A request as a typeset cover: the field strip down its left edge (the one
 * coloured edge the system allows, because it encodes state), the title as
 * display lettering in a fixed-aspect cover, and a foot with the creator and
 * the time left. No line sits above the title.
 *
 * @example
 * <TitleCard
 *   title="October set"
 *   creator="Jade K."
 *   due="2026-10-22"
 *   fields={[{ name: "Cover photo", state: "approved" }, { name: "Teaser clip", state: "ready" }]}
 *   href={`/dashboard/requests/${id}`}
 * />
 */
export function TitleCard({
  title,
  creator,
  fields,
  due,
  timeText,
  timeUrgent = false,
  meta,
  completedAt,
  href,
  now,
  headingLevel = "h3",
  actions,
  detail,
  corner,
  audience = "staff",
  className,
}: TitleCardProps) {
  const H = headingLevel;
  const done = !!completedAt;
  // set by length so the lettering always fits two lines
  const len = title.length <= 14 ? "s" : title.length <= 24 ? "m" : "l";

  return (
    <article className={cn("tw-card", className)} data-done={done ? "true" : undefined}>
      <FieldStrip fields={fields} variant="spine" audience={audience} />
      <div className="tw-card-face">
        <div className="tw-card-cover">
          <H className="tw-card-title" data-len={len} title={title}>
            {href ? (
              <Link href={href} data-wall-focus>
                {title}
              </Link>
            ) : (
              title
            )}
          </H>
        </div>
        <div className="tw-card-foot">
          <p className="tw-card-line">
            <span className="tw-card-by">{creator}</span>
            {timeText ? (
              <span className={cn("tw-countdown", timeUrgent && "text-late")}>{timeText}</span>
            ) : due != null ? (
              <Countdown due={due} now={now} completedAt={completedAt} />
            ) : null}
          </p>
          <p className="tw-card-meta">{meta ?? fieldSummary(fields, audience)}</p>
          {actions && <div className="tw-card-actions">{actions}</div>}
        </div>
      </div>
      {detail && <div className="tw-tile-detail min-w-0 flex-1 flex-col gap-2 pl-1">{detail}</div>}
      {corner && <div className="absolute right-3 top-3 z-[1] text-icon">{corner}</div>}
    </article>
  );
}
