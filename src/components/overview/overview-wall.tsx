"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ChevronDown, Plus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Billboard, Shelf, Wall, timeLeft, useFocusWall } from "@/components/title-wall";
import { cn } from "@/lib/utils";
import type { OverviewData, OverviewRequest } from "@/app/(dashboard)/dashboard/_overview/types";
import { ago, arrangeOverview, plural, type CreatorOwes } from "./arrange";
import {
  CALM_COUNTDOWN,
  CreatorTile,
  MessageButton,
  MessageTile,
  PreviewToggle,
  ReminderButton,
  RequestTile,
  UploadTile,
  creatorHref,
  requestHref,
  threadHref,
} from "./tiles";
import { useReminderQueue } from "./use-reminder-queue";

export interface OverviewWallProps {
  data: OverviewData;
  /** OWNER, ADMIN and MANAGER may send reminders (the reminder API's own rule) */
  canRemind: boolean;
}

/*
 * The Overview's quieter setting of the Title Wall (owner feedback, Oct 2026:
 * "a little bit too much in my face"). The shared components keep their
 * defaults; the Overview steps them down here, in one place:
 * - the billboard is a shorter plate with smaller lettering, a smaller
 *   countdown and an inline (not full-width) Review; its secondaries are ghost
 * - shelf covers set their titles at 700 and about half the size, on a
 *   shorter cover, and shelves sit further apart
 */
const QUIET_BILLBOARD = [
  "min-h-0 gap-8 px-6 py-5 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(240px,300px)] max-[899px]:gap-4 max-[899px]:p-4",
  "[&_.tw-billboard-title]:text-[clamp(30px,2.8vw,40px)] [&_.tw-billboard-title]:leading-[1.05] [&_.tw-billboard-title]:tracking-[-0.03em]",
  "max-[899px]:[&_.tw-billboard-title]:text-[clamp(26px,7vw,32px)]",
  "[&_.tw-billboard-by]:mt-2 [&_.tw-billboard-note]:mt-2 [&_.tw-billboard-note]:text-ink-2 [&_.tw-billboard-note_b]:text-ink",
  "[&_.tw-billboard-strip]:pt-5",
  "[&_.tw-billboard-side_.tw-countdown]:text-[26px] [&_.tw-billboard-side_.tw-countdown]:font-semibold [&_.tw-countdown-unit]:text-[14px] [&_.tw-countdown-unit]:font-medium",
  "[&_.tw-billboard-acts]:mt-3 [&_.tw-billboard-acts]:gap-1.5",
  "min-[900px]:[&_.tw-billboard-acts>:first-child]:w-auto min-[900px]:[&_.tw-billboard-acts>:first-child]:self-start",
  "[&_.tw-billboard-acts>:first-child]:h-10 md:[&_.tw-billboard-acts>:first-child]:h-9 [&_.tw-billboard-acts>:first-child]:px-4 [&_.tw-billboard-acts>:first-child]:text-sm",
  "min-[900px]:[&_.tw-row]:-ml-3 [&_.tw-row]:gap-1 [&_.tw-row>*]:flex-none max-[899px]:[&_.tw-row>*]:flex-1",
].join(" ");

const QUIET_SHELVES = [
  "[&_.tw-shelf]:mt-10 [&_.tw-shelf-h]:mb-2.5",
  "[&_.tw-card-cover]:aspect-[3/1]",
  "[&_.tw-card-title]:font-bold [&_.tw-card-title]:leading-[1.1] [&_.tw-card-title]:tracking-[-0.02em] [&_.tw-card-title]:text-[clamp(20px,8.5cqi,26px)]",
  "[&_.tw-card-title[data-len=m]]:text-[clamp(19px,7.5cqi,23px)]",
  "[&_.tw-card-title[data-len=l]]:text-[clamp(18px,6.8cqi,21px)] [&_.tw-card-title[data-len=l]]:tracking-[-0.015em]",
].join(" ");

/*
 * Whether "New from creators" is unfolded, remembered per browser. A tiny
 * external store so the server render (folded) and the stored choice agree
 * without a set-state-in-effect; if storage is blocked it lives in memory.
 */
const UPLOADS_OPEN_KEY = "ccm.overview.uploadsOpen";
let uploadsOpenMemo: boolean | null = null;
const uploadsListeners = new Set<() => void>();
function readUploadsOpen(): boolean {
  if (uploadsOpenMemo !== null) return uploadsOpenMemo;
  try {
    return window.localStorage.getItem(UPLOADS_OPEN_KEY) === "1";
  } catch {
    return false;
  }
}
function subscribeUploadsOpen(cb: () => void) {
  uploadsListeners.add(cb);
  return () => {
    uploadsListeners.delete(cb);
  };
}
function writeUploadsOpen(open: boolean) {
  uploadsOpenMemo = open;
  try {
    window.localStorage.setItem(UPLOADS_OPEN_KEY, open ? "1" : "0");
  } catch {
    /* storage blocked: the memo keeps it for this visit */
  }
  uploadsListeners.forEach((cb) => cb());
}

const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="max-w-[70ch] rounded-[10px] bg-tile-dim px-4 py-3.5 text-sm leading-normal text-ink-2">{children}</p>
);

/** Wall item ids are prefixed by kind so they stay unique across shelves */
function hrefForWallId(id: string): string | null {
  const [kind, ...rest] = id.split(":");
  const key = rest.join(":");
  if (kind === "req") return requestHref(key);
  if (kind === "cr") return creatorHref(key);
  if (kind === "up") return requestHref(key.split(":")[0]);
  return null;
}

/**
 * The staff Overview as a Title Wall: the finding in words, the most urgent
 * request as the billboard, then shelves where every request appears once.
 * The first click (or a hover) opens a title in place; the second opens it.
 */
export function OverviewWall({ data, canRemind }: OverviewWallProps) {
  const router = useRouter();
  const now = useMemo(() => new Date(data.now), [data.now]);
  const layout = useMemo(() => arrangeOverview(data), [data]);
  const { featured, reviewing, dueThisWeek, waiting, figures } = layout;
  const [showPreviews, setShowPreviews] = useState(false);
  const [live, setLive] = useState("");
  const { remind, stateOf } = useReminderQueue();
  const featuredLate = featured?.due ? timeLeft(featured.due, now).late : undefined;

  // "New from creators" folds away by default; the choice is remembered per browser
  const uploadsOpen = useSyncExternalStore(subscribeUploadsOpen, readUploadsOpen, () => false);
  const toggleUploads = () => writeUploadsOpen(!uploadsOpen);
  const uploadsHeadingId = useId();
  const uploadsRegionId = useId();
  const messagesHeadingId = useId();

  const wallRef = useRef<HTMLDivElement>(null);
  const onOpen = useCallback(
    (id: string) => {
      const href = hrefForWallId(id);
      if (href) router.push(href);
    },
    [router]
  );
  const announce = useCallback((id: string | null) => {
    const item = id ? wallRef.current?.querySelector(`[data-wall-item][data-id="${CSS.escape(id)}"] h3`) : null;
    setLive(id ? `${item?.textContent ?? "Title"} opened. Press Enter to go to it, Escape to close.` : "Closed");
  }, []);
  const { focusedId } = useFocusWall(wallRef, { onOpen, announce });

  const thread = (creatorId: string) => threadHref(data.conversationByCreator[creatorId], creatorId);
  const remindRequest = (r: OverviewRequest) =>
    remind({ key: r.id, requestIds: [r.id], name: r.creatorName, channel: r.creatorContact });
  const remindCreator = (c: CreatorOwes) =>
    remind({
      key: `creator:${c.creatorId}`,
      requestIds: c.requests.map((r) => r.id),
      name: c.creatorName,
      channel: c.requests[0].creatorContact,
    });

  const unreadTotal = data.messages.reduce((n, m) => n + m.unread, 0);
  const owedTotal = waiting.reduce((n, c) => n + c.owed.length, 0);
  const noRequests = data.requests.length === 0;

  const reqTile = (r: OverviewRequest, progress = false) => (
    <RequestTile
      key={r.id}
      r={r}
      now={now}
      progress={progress}
      reminder={stateOf([r.id])}
      onRemind={() => remindRequest(r)}
      canRemind={canRemind}
      messageHref={thread(r.creatorId)}
    />
  );

  return (
    <div className="pb-4">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4" data-tour="dashboard-header">
        <div className="min-w-0 max-w-[80ch]">
          <h1 className="text-[22px] font-bold leading-tight tracking-[-0.01em] sm:text-[26px]">Overview</h1>
          <p className="mt-1.5 text-[15px] leading-normal">{layout.finding}</p>
          {!noRequests && (
            <p className="mt-1 flex flex-wrap gap-x-5 gap-y-0.5 text-sm leading-normal text-ink-2">
              <span>
                <b className="font-medium text-foreground">{figures.toReview}</b> to review
              </span>
              <span>
                <b className="font-medium text-foreground">{figures.overdue}</b> overdue
              </span>
              <span>
                <b className="font-medium text-foreground">{figures.dueSoon}</b> due in the next 7 days
              </span>
              <span>
                <b className="font-medium text-foreground">{figures.approvedThisWeek}</b>{" "}
                {figures.approvedThisWeek === 1 ? "request" : "requests"} approved this week ({figures.approvedLastWeek} the week before)
              </span>
            </p>
          )}
        </div>
        <Button asChild variant="light" className="max-sm:w-full" data-tour="create-request-btn">
          <Link href="/dashboard/requests/new">
            <Plus aria-hidden="true" />
            New request
          </Link>
        </Button>
      </header>

      {/* the billboard: the most urgent request */}
      <div className="mt-6">
        {featured ? (
          <Billboard
            className={cn(QUIET_BILLBOARD, featuredLate === false && CALM_COUNTDOWN)}
            title={featured.title}
            creator={featured.creatorName}
            kind={featured.kind ?? undefined}
            sentText={`sent ${ago(featured.sentAt, now)}`}
            due={featured.due!}
            now={now}
            fields={featured.fields.map((f) => ({ id: f.id, name: f.name, state: f.state }))}
            note={<FeaturedNote r={featured} now={now} />}
            reviewHref={requestHref(featured.id)}
            reviewLabel={featured.counts.ready ? undefined : "Open request"}
            secondary={
              <>
                {canRemind && featured.counts.toCome + featured.counts.changes > 0 && (
                  <ReminderButton state={stateOf([featured.id])} onClick={() => remindRequest(featured)} size="sm" quiet />
                )}
                <MessageButton href={thread(featured.creatorId)} name={featured.creatorName} size="sm" quiet />
              </>
            }
          />
        ) : noRequests ? (
          <section className="rounded-[10px] bg-tile px-6 py-7 sm:px-8" aria-labelledby="ov-first">
            <h2 id="ov-first" className="text-[clamp(26px,2.8vw,36px)] font-extrabold leading-[1.05] tracking-[-0.03em]">
              Nothing is out with creators yet
            </h2>
            <p className="mt-3 max-w-[60ch] text-[15px] leading-normal">
              Send a creator a request built from one of your templates. They upload from their phone, and each upload lands
              here, field by field, for you to review.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link href="/dashboard/creators/invite">
                  <UserPlus aria-hidden="true" />
                  Invite a creator
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard/templates">See templates</Link>
              </Button>
            </div>
          </section>
        ) : null}
      </div>

      <div data-tour="dashboard-widgets">
      {/* on a phone the shelf's finding drops under its name, so the name stays on one line */}
      <Wall
        ref={wallRef}
        label="Requests, creators and uploads"
        className={`mt-2 ${QUIET_SHELVES} [&_.tw-shelf-h_h2]:whitespace-nowrap max-sm:[&_.tw-shelf-h]:flex-wrap max-sm:[&_.tw-shelf-h]:gap-y-0 max-sm:[&_.tw-shelf-sub]:order-3 max-sm:[&_.tw-shelf-sub]:basis-full`}
      >
        <Shelf
          title="Continue reviewing"
          sub={reviewing.length ? `${plural(layout.reviewingReady, "field")} ready in ${plural(reviewing.length, "request")}` : undefined}
          itemIds={reviewing.map((r) => `req:${r.id}`)}
          focusedId={focusedId}
          empty={
            <Empty>
              {featured?.counts.ready
                ? "Nothing else is waiting for review. When a creator sends a field in, it shows up here."
                : "Nothing is waiting for review. When a creator sends a field in, it shows up here with a Review button."}
            </Empty>
          }
        >
          {reviewing.map((r) => reqTile(r, true))}
        </Shelf>

        <Shelf
          title="Due this week"
          sub={dueThisWeek.length ? `${plural(dueThisWeek.length, "request")} with nothing to review yet` : undefined}
          itemIds={dueThisWeek.map((r) => `req:${r.id}`)}
          focusedId={focusedId}
          empty={<Empty>Nothing else is due in the next 7 days. Requests due sooner sit above.</Empty>}
        >
          {dueThisWeek.map((r) => reqTile(r))}
        </Shelf>

        <Shelf
          title="Waiting on creators"
          sub={waiting.length ? `${plural(owedTotal, "field")} still to come from ${plural(waiting.length, "creator")}` : undefined}
          itemIds={waiting.map((c) => `cr:${c.creatorId}`)}
          focusedId={focusedId}
          empty={<Empty>Every creator has uploaded what was asked.</Empty>}
        >
          {waiting.map((c) => (
            <CreatorTile
              key={c.creatorId}
              c={c}
              now={now}
              reminder={stateOf(c.requests.map((r) => r.id))}
              onRemind={() => remindCreator(c)}
              canRemind={canRemind}
              messageHref={thread(c.creatorId)}
            />
          ))}
        </Shelf>

        {/* the quieter end of the wall: uploads fold away, messages sit in one row */}
        <div className="mt-12 border-t border-line pt-2">
          {data.uploads.length > 0 && (
            <section aria-labelledby={uploadsHeadingId}>
              <div className="tw-shelf-h mt-4 flex-wrap max-sm:gap-y-0">
                <h2 id={uploadsHeadingId}>
                  <button
                    type="button"
                    aria-expanded={uploadsOpen}
                    aria-controls={uploadsRegionId}
                    onClick={toggleUploads}
                    className="-mx-2 inline-flex h-9 items-center gap-1.5 rounded-md px-2 transition-colors hover:bg-tile-hi focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring max-sm:h-10"
                  >
                    New from creators
                    <ChevronDown
                      className={cn("size-4 text-icon transition-transform duration-200 motion-reduce:transition-none", uploadsOpen && "rotate-180")}
                      aria-hidden="true"
                    />
                  </button>
                </h2>
                <span className="tw-shelf-sub max-sm:order-3 max-sm:basis-full">
                  The latest {plural(data.uploads.length, "field")} with uploads to review
                </span>
                {uploadsOpen && <PreviewToggle on={showPreviews} onToggle={() => setShowPreviews((v) => !v)} />}
              </div>
              <div id={uploadsRegionId} hidden={!uploadsOpen}>
                {uploadsOpen && (
                  <Shelf
                    title="New from creators"
                    className="!mt-0 [&>.tw-shelf-h]:hidden"
                    itemIds={data.uploads.map((u) => `up:${u.id}`)}
                    focusedId={focusedId}
                  >
                    {data.uploads.map((u) => (
                      <UploadTile key={u.id} u={u} now={now} showAll={showPreviews} />
                    ))}
                  </Shelf>
                )}
              </div>
            </section>
          )}

          {data.messages.length > 0 ? (
            <Shelf
              title="Messages"
              sub={`${plural(unreadTotal, "unread message")} from ${plural(data.messages.length, "creator")}`}
              className="!mt-6"
            >
              {data.messages.map((m) => (
                <MessageTile key={m.conversationId} m={m} now={now} />
              ))}
            </Shelf>
          ) : (
            <section aria-labelledby={messagesHeadingId} className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <h2 id={messagesHeadingId} className="text-[17px] font-semibold leading-[1.4]">
                Messages
              </h2>
              <p className="text-sm leading-normal text-ink-2">
                No unread messages from creators.{" "}
                <Link className="underline decoration-ctl-hi underline-offset-[3px] hover:text-ink hover:decoration-ink" href="/dashboard/messages">
                  Open Messages
                </Link>
              </p>
            </section>
          )}
        </div>
      </Wall>
      </div>

      <p className="mt-10 hidden flex-wrap items-center gap-x-5 gap-y-1 text-[13px] leading-normal text-ink-2 md:flex">
        <span>
          <Kbd>←</Kbd> <Kbd>→</Kbd> <Kbd>↑</Kbd> <Kbd>↓</Kbd> move across the wall
        </span>
        <span>
          <Kbd>Space</Kbd> opens a title in place
        </span>
        <span>
          <Kbd>Enter</Kbd> goes to it
        </span>
        <span>
          <Kbd>Esc</Kbd> closes
        </span>
        {uploadsOpen && <span>Press and hold a preview to peek</span>}
      </p>
      <p className="sr-only" aria-live="polite">
        {live}
      </p>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-grid h-5 min-w-5 place-items-center rounded-[4px] border border-ctl px-1 font-sans text-[12px] font-semibold text-foreground">
      {children}
    </kbd>
  );
}

/** One line under the billboard title: what is ready, or what is holding it up */
function FeaturedNote({ r, now }: { r: OverviewRequest; now: Date }) {
  const ready = r.fields.filter((f) => f.state === "ready");
  if (ready.length) {
    return (
      <>
        Ready for you:{" "}
        {ready.map((f, i) => (
          <span key={f.id}>
            {i > 0 && ", "}
            <b className="font-semibold">{f.name}</b>
          </span>
        ))}
      </>
    );
  }
  const changes = r.fields.filter((f) => f.state === "changes");
  if (changes.length) return <>Changes requested on {changes.map((f) => f.name).join(", ")}. Waiting for new takes.</>;
  const started = r.fields.filter((f) => f.inProgress);
  if (started.length) {
    return (
      <>
        {r.creatorName} has started uploading {started.map((f) => f.name).join(", ")} but has not sent it in yet.
        {r.lastReminderAt ? ` Last reminder ${ago(r.lastReminderAt, now)}.` : " No reminder sent yet."}
      </>
    );
  }
  return <>{r.lastReminderAt ? `Nothing uploaded yet. Last reminder ${ago(r.lastReminderAt, now)}.` : "Nothing uploaded yet, and no reminder sent."}</>;
}
