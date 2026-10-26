"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Countdown } from "./countdown";
import { FieldStrip } from "./field-strip";
import { formatDue } from "./time";
import { fieldSummary, type FieldSummary } from "./types";

export interface BillboardProps {
  /** The featured request's title: the largest type on the screen */
  title: string;
  creator: string;
  /** Template or kind, shown after the creator ("Monthly set") */
  kind?: string;
  /** When it was sent, shown after the creator ("sent Thu 15 Oct") */
  sentText?: string;
  /** The deadline instant (the countdown) */
  due: Date | string | number;
  /** The due DAY ("YYYY-MM-DD" or the stored date): the date text, the same for every viewer */
  dueOn?: Date | string | null;
  /** A quiet line under the date ("Ends 11:59 pm Jade's time (Buenos Aires)") */
  dueNote?: string;
  fields: FieldSummary[];
  /** One line under the title: the creator's latest note, what is ready ("Ready for you: Teaser clip, Full video") */
  note?: ReactNode;
  /** The primary action. Defaults to "Review" (or "Review N ready fields") */
  reviewLabel?: string;
  reviewHref?: string;
  onReview?: () => void;
  /** Secondary actions under Review (Send reminder, Message): outline buttons */
  secondary?: ReactNode;
  /** Fixed "now" for the countdown */
  now?: Date;
  /** Heading level for the title (default h2: the page h1 is the screen's name) */
  headingLevel?: "h1" | "h2";
  className?: string;
}

/**
 * The featured slot at the top of the overview: the most urgent request
 * (overdue first, else most fields ready). Its cover plate fades into the
 * ground; the title is the largest type on the screen; the countdown is the
 * largest figure; Review is the one yellow action.
 *
 * @example
 * <Billboard
 *   title="October set" creator="Jade K." kind="Monthly set" sentText="sent Thu 15 Oct"
 *   due="2026-10-22" fields={fields}
 *   note={<>Ready for you: <b>Teaser clip</b>, <b>Full video</b></>}
 *   reviewHref={`/dashboard/requests/${id}`}
 *   secondary={<><Button variant="outline">Send reminder</Button><Button variant="outline">Message</Button></>}
 * />
 */
export function Billboard({
  title,
  creator,
  kind,
  sentText,
  due,
  dueOn,
  dueNote,
  fields,
  note,
  reviewLabel,
  reviewHref,
  onReview,
  secondary,
  now,
  headingLevel = "h2",
  className,
}: BillboardProps) {
  const H = headingLevel;
  const ready = fields.filter((f) => f.state === "ready").length;
  const label = reviewLabel ?? (ready ? `Review ${ready} ready ${ready === 1 ? "field" : "fields"}` : "Review");
  const by = [kind, sentText].filter(Boolean).join(" · ");

  return (
    <section className={cn("tw-billboard", className)} aria-label={`Featured: ${creator}`}>
      <div className="tw-billboard-plate" aria-hidden="true" />
      <div className="tw-billboard-main">
        <H className="tw-billboard-title">{title}</H>
        <p className="tw-billboard-by">
          <b>{creator}</b>
          {by && <> · {by}</>}
        </p>
        {note && <p className="tw-billboard-note">{note}</p>}
        <div className="tw-billboard-strip">
          <FieldStrip fields={fields} variant="labelled" />
        </div>
      </div>
      <div className="tw-billboard-side">
        <Countdown due={due} now={now} size="lg" />
        <p className="tw-billboard-due">{formatDue(dueOn ?? due)}</p>
        {dueNote && <p className="text-[14px] leading-normal text-ink-2">{dueNote}</p>}
        <p className="tw-billboard-sum">{fieldSummary(fields)}</p>
        <div className="tw-billboard-acts">
          {reviewHref ? (
            <Button asChild size="lg" className="w-full">
              <Link href={reviewHref}>
                <Play className="size-4" aria-hidden="true" />
                {label}
              </Link>
            </Button>
          ) : (
            <Button size="lg" className="w-full" onClick={onReview}>
              <Play className="size-4" aria-hidden="true" />
              {label}
            </Button>
          )}
          {secondary && <div className="tw-row">{secondary}</div>}
        </div>
      </div>
    </section>
  );
}
