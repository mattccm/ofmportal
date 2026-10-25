"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Bell, Check, Eye, MessageSquare, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Countdown,
  DiscreetPreview,
  FieldCell,
  FIELD_STATE_SHORT,
  TitleCard,
  fieldSummary,
  formatDay,
  timeLeft,
  type FieldState,
} from "@/components/title-wall";
import type { OverviewField, OverviewMessage, OverviewRequest, OverviewUpload } from "@/app/(dashboard)/dashboard/_overview/types";
import { ago, formatBytes, formatDuration, plural, type CreatorOwes } from "./arrange";
import type { ReminderState } from "./use-reminder-queue";

export const requestHref = (id: string) => `/dashboard/requests/${id}`;
export const creatorHref = (id: string) => `/dashboard/creators/${id}`;
/** A known thread opens directly; otherwise ?creatorId= opens (or starts) that creator's thread */
export const threadHref = (conversationId: string | undefined, creatorId?: string) =>
  conversationId
    ? `/dashboard/messages?conversation=${conversationId}`
    : creatorId
      ? `/dashboard/messages?creatorId=${encodeURIComponent(creatorId)}`
      : "/dashboard/messages";

/**
 * On the Overview a countdown turns red only once it is actually late; under
 * 48 hours it stays ink, so the wall carries one red per late request.
 */
export const CALM_COUNTDOWN = "[&_.tw-countdown]:text-ink";
/** The Overview's shorter cover, shared by title cards (via the wall) and upload plates */
export const COVER_ASPECT = "3 / 1";

/* ------------------------------------------------------------------ */
/* Small shared parts                                                  */
/* ------------------------------------------------------------------ */

/** The field checklist an opened title shows: cell, name, state */
function Checklist({ rows, max = 5 }: { rows: { key: string; state: FieldState; name: string; note?: string }[]; max?: number }) {
  const more = rows.length - max;
  return (
    <ul className="flex min-w-0 flex-col gap-1">
      {rows.slice(0, max).map((r) => (
        <li key={r.key} className="flex min-w-0 items-center gap-2 text-[13px] leading-normal">
          <FieldCell state={r.state} name={r.name} className="!size-3" />
          <span className="min-w-0 flex-1 truncate">{r.name}</span>
          <span className="shrink-0 text-ink-2">{r.note ?? FIELD_STATE_SHORT[r.state]}</span>
        </li>
      ))}
      {more > 0 && <li className="text-[13px] leading-normal text-ink-2">and {more} more</li>}
    </ul>
  );
}

/** The opened title's detail column. Sits above the card's link overlay so its controls work. */
function Detail({ line, late, children, actions }: { line: ReactNode; late?: boolean; children?: ReactNode; actions: ReactNode }) {
  return (
    <div className="relative z-[1] flex h-full min-w-0 flex-1 flex-col gap-2">
      <p className={cn("text-[13px] font-semibold leading-normal", late && "text-late")}>{line}</p>
      {children}
      <div className="mt-auto flex flex-wrap gap-2">{actions}</div>
    </div>
  );
}

export function ReminderButton({
  state,
  onClick,
  primary = false,
  quiet = false,
  size = "sm",
  className,
}: {
  state: ReminderState | null;
  onClick: () => void;
  primary?: boolean;
  /** A secondary that stays bare until hover (the billboard's secondaries) */
  quiet?: boolean;
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  const done = state === "sent";
  const busy = state === "queued" || state === "sending";
  return (
    <Button
      type="button"
      size={size}
      variant={primary ? "default" : quiet ? "ghost" : "outline"}
      className={className}
      onClick={onClick}
      aria-disabled={done || busy || undefined}
    >
      {done ? <Check aria-hidden="true" /> : <Bell aria-hidden="true" />}
      {done ? "Reminder sent" : busy ? "Sending reminder" : state === "failed" ? "Try the reminder again" : "Send reminder"}
    </Button>
  );
}

export function MessageButton({
  href,
  name,
  size = "sm",
  quiet = false,
}: {
  /** null when the viewer's role can't see creator conversations */
  href: string | null;
  name: string;
  size?: "sm" | "default" | "lg";
  quiet?: boolean;
}) {
  if (!href) return null;
  return (
    <Button asChild size={size} variant={quiet ? "ghost" : "outline"}>
      <Link href={href} aria-label={`Message ${name}`}>
        <MessageSquare aria-hidden="true" />
        Message
      </Link>
    </Button>
  );
}

/* ------------------------------------------------------------------ */
/* Request title card                                                  */
/* ------------------------------------------------------------------ */

const toSummary = (fields: OverviewField[]) => fields.map((f) => ({ id: f.id, name: f.name, state: f.state }));

export function RequestTile({
  r,
  now,
  progress = false,
  reminder,
  onRemind,
  canRemind,
  messageHref,
}: {
  r: OverviewRequest;
  now: Date;
  progress?: boolean;
  reminder: ReminderState | null;
  onRemind: () => void;
  canRemind: boolean;
  messageHref: string | null;
}) {
  const fields = toSummary(r.fields);
  const ready = r.counts.ready;
  const t = r.due ? timeLeft(r.due, now) : null;
  const done = r.counts.approved;
  const summary = fieldSummary(fields);

  const meta = progress ? (
    <>
      <span
        className="mb-1.5 mt-1 block h-[3px] overflow-hidden rounded-full bg-ctl"
        role="img"
        aria-label={`${done} of ${r.counts.total} fields approved`}
      >
        <span className="block h-full rounded-full bg-approved" style={{ width: `${(done / Math.max(1, r.counts.total)) * 100}%` }} />
      </span>
      {summary}
    </>
  ) : (
    summary
  );

  const primary = ready ? (
    <Button asChild size="sm">
      <Link href={requestHref(r.id)}>
        <Play aria-hidden="true" />
        Review {ready}
      </Link>
    </Button>
  ) : canRemind ? (
    <ReminderButton state={reminder} onClick={onRemind} primary />
  ) : (
    <Button asChild size="sm">
      <Link href={requestHref(r.id)}>Open request</Link>
    </Button>
  );

  return (
    <TitleCard
      className={t && !t.late ? CALM_COUNTDOWN : undefined}
      title={r.title}
      creator={r.creatorName}
      fields={fields}
      due={r.due}
      now={now}
      href={requestHref(r.id)}
      meta={meta}
      detail={
        <Detail
          line={t ? `Due ${formatDay(r.due!)} · ${t.text}` : "No due date"}
          late={t?.late}
          actions={
            <>
              {primary}
              <MessageButton href={messageHref} name={r.creatorName} />
            </>
          }
        >
          <Checklist rows={r.fields.map((f) => ({ key: f.id, state: f.state, name: f.name }))} />
        </Detail>
      }
    />
  );
}

/* ------------------------------------------------------------------ */
/* Creator card: one sentence and one status, no spine                 */
/* ------------------------------------------------------------------ */

export function CreatorTile({
  c,
  now,
  reminder,
  onRemind,
  canRemind,
  messageHref,
}: {
  c: CreatorOwes;
  now: Date;
  reminder: ReminderState | null;
  onRemind: () => void;
  canRemind: boolean;
  messageHref: string | null;
}) {
  const n = c.owed.length;
  const changes = c.owed.filter(({ field }) => field.state === "changes").length;
  const on = c.requests.length === 1 ? `on ${c.requests[0].title}` : `on ${c.requests.length} requests`;
  // what they owe, in one line: one or two fields of one kind by name, else counts
  const named = n <= 2 && (changes === 0 || changes === n);
  const names = c.owed.map(({ field }) => field.name).join(" and ");
  const sentence = named
    ? `${names} to ${changes ? "redo" : "come"}`
    : n <= 2
      ? `${plural(changes, "redo")} and ${plural(n - changes, "field")} to come`
      : `${plural(n, "field")} ${on}${changes ? `, ${changes} to redo` : ""}`;
  const full = n <= 2 ? `${sentence}, ${on}` : sentence;
  const t = c.due ? timeLeft(c.due, now) : null;
  const status =
    reminder === "sent" ? "Reminder sent just now" : c.lastReminderAt ? `Last reminder ${ago(c.lastReminderAt, now)}` : "No reminder yet";
  const len = c.creatorName.length <= 14 ? "s" : c.creatorName.length <= 24 ? "m" : "l";
  const multi = c.requests.length > 1;

  return (
    <article className={cn("tw-card", t && !t.late && CALM_COUNTDOWN)}>
      <div className="tw-card-face">
        <div className="tw-card-cover">
          <h3 className="tw-card-title" data-len={len} title={c.creatorName}>
            <Link href={creatorHref(c.creatorId)} data-wall-focus aria-label={`${c.creatorName} owes ${full}`}>
              {c.creatorName}
            </Link>
          </h3>
        </div>
        <div className="tw-card-foot">
          <p className="tw-card-line">
            <span className="tw-card-by" title={full}>
              {sentence}
            </span>
          </p>
          <p className="tw-card-meta">
            {c.due ? <Countdown due={c.due} now={now} /> : "No due date"} · {status}
          </p>
          {canRemind && (
            // the opened title shows its own actions, so the card's reminder steps aside
            <div className="tw-card-actions in-data-[focused=true]:hidden">
              <ReminderButton state={reminder} onClick={onRemind} />
            </div>
          )}
        </div>
      </div>
      <div className="tw-tile-detail min-w-0 flex-1 flex-col gap-2 pl-1">
        <Detail
          line={t ? `${plural(n, "field")} to come, due ${formatDay(c.due!)}, ${t.text}` : `${plural(n, "field")} to come`}
          late={t?.late}
          actions={
            <>
              {canRemind && <ReminderButton state={reminder} onClick={onRemind} primary />}
              <MessageButton href={messageHref} name={c.creatorName} />
            </>
          }
        >
          <Checklist
            rows={c.owed.map(({ field, request }) => ({
              key: `${request.id}:${field.id}`,
              state: field.state,
              name: field.name,
              note: multi ? request.title : FIELD_STATE_SHORT[field.state],
            }))}
          />
        </Detail>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Upload card: a discreet plate, keyed by field                       */
/* ------------------------------------------------------------------ */

export function UploadTile({ u, now, showAll }: { u: OverviewUpload; now: Date; showAll: boolean }) {
  const files =
    u.photos && u.videos
      ? `${plural(u.photos, "photo")}, ${plural(u.videos, "video")}`
      : u.videos
        ? plural(u.videos, "video")
        : plural(u.photos || u.count, "photo");
  const caption = u.kind === "video" ? (u.duration ? `Video ${formatDuration(u.duration)}` : "Video") : u.count > 1 ? files : "Photo";
  const label = `${u.fieldName} from ${u.creatorName}`;

  return (
    <article className="tw-card">
      <div className="tw-card-face">
        <div className="relative z-[1]">
          {u.thumb ? (
            <DiscreetPreview
              src={u.thumb}
              label={label}
              kind={u.kind}
              caption={caption}
              aspect={COVER_ASPECT}
              revealed={showAll || undefined}
            />
          ) : (
            <span className="tw-preview" data-empty="true" style={{ aspectRatio: COVER_ASPECT }}>
              No preview for this file
            </span>
          )}
        </div>
        <div className="tw-card-foot">
          <h3 className="truncate text-[17px] font-semibold leading-[1.4] tracking-[-0.01em]">
            <Link
              href={requestHref(u.requestId)}
              data-wall-focus
              className="outline-none after:absolute after:inset-0 after:rounded-[inherit] after:content-['']"
            >
              {u.fieldName}
            </Link>
          </h3>
          <p className="tw-card-line">
            <span className="tw-card-by">
              {u.creatorName} · {u.requestTitle}
            </span>
          </p>
          <p className="tw-card-meta">
            Uploaded {ago(u.uploadedAt, now)} · {files} · {formatBytes(u.bytes)}
          </p>
        </div>
      </div>
      <div className="tw-tile-detail min-w-0 flex-1 flex-col gap-2 pl-1">
        <Detail
          line={`${plural(u.count, "file")} ready in ${u.fieldName}`}
          actions={
            <Button asChild size="sm">
              <Link href={requestHref(u.requestId)}>
                <Play aria-hidden="true" />
                Review
              </Link>
            </Button>
          }
        >
          <p className="text-[13px] leading-normal text-ink-2">
            {u.requestTitle} for {u.creatorName}. The preview stays hidden until you press and hold it, or turn on Show previews.
          </p>
        </Detail>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Messages: a compact inbox row                                       */
/* ------------------------------------------------------------------ */

export function MessageTile({ m, now }: { m: OverviewMessage; now: Date }) {
  return (
    <Link
      href={threadHref(m.conversationId)}
      className="flex h-full min-w-0 flex-col gap-1 rounded-[10px] bg-tile px-4 py-3 transition-colors duration-200 hover:bg-tile-hi focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <span className="flex min-w-0 items-baseline justify-between gap-3">
        <span className="truncate text-[15px] font-semibold">{m.creatorName}</span>
        <span className="shrink-0 text-[13px] text-ink-2">{ago(m.at, now)}</span>
      </span>
      <span className="line-clamp-2 text-sm leading-normal">{m.preview}</span>
      <span className="mt-auto pt-1 text-[13px] font-medium text-ink-2">
        <span className="text-foreground">{m.unread}</span> unread · Reply
      </span>
    </Link>
  );
}

export function PreviewToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <Button type="button" variant="ghost" size="sm" aria-pressed={on} onClick={onToggle} className="-my-1 ml-1 align-middle">
      <Eye aria-hidden="true" />
      {on ? "Hide previews" : "Show previews"}
    </Button>
  );
}
