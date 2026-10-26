"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Upload, Send, PenLine, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Shelf, TitleCard, formatDay, formatDueOn, formatStamp, timeLeft, useViewerTimeZone } from "@/components/title-wall";
import { RequestCover } from "@/components/portal/request-cover";
import { RequestRow } from "@/components/portal/request-row";
import type { CreatorFieldStateRow } from "@/lib/creator-field-states";
import {
  ACTIONABLE,
  IN_REVIEW,
  creatorSummary,
  nextStep,
  sentLine,
  toStrip,
} from "@/components/portal/creator-words";

// Approved, cancelled and archived requests never reach the creator
type RequestStatus = "PENDING" | "IN_PROGRESS" | "SUBMITTED" | "UNDER_REVIEW" | "NEEDS_REVISION";

interface CreatorRequest {
  id: string;
  title: string;
  dueDate: string | null;
  /** The due day everyone sees */
  dueOn?: string | null;
  status: RequestStatus;
  createdAt: string;
  submittedAt?: string | null;
  updatedAt?: string;
  fieldStates?: CreatorFieldStateRow[];
  fieldSubmissions?: Record<string, { status: string; feedback?: string }> | null;
  unreadFeedbackCount?: number;
}

interface InboxPeek {
  last: { content: string; createdAt: string; fromCreator: boolean; sender?: string } | null;
  unread: number;
}

/** Most urgent first: overdue (most late first), then the nearest due, then undated */
function byUrgency(a: CreatorRequest, b: CreatorRequest) {
  const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
  const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
  if (da !== db) return da - db;
  // same due (or both undated): a requested new take comes first
  return Number(b.status === "NEEDS_REVISION") - Number(a.status === "NEEDS_REVISION");
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

function formatMoment(iso: string, tz: string) {
  return formatStamp(iso, tz);
}

export default function CreatorDashboardPage() {
  const router = useRouter();
  const tz = useViewerTimeZone();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [requests, setRequests] = useState<CreatorRequest[]>([]);
  const [inbox, setInbox] = useState<InboxPeek | null>(null);

  const load = useCallback(async () => {
    const token = localStorage.getItem("creatorToken");
    if (!token || !localStorage.getItem("creatorId")) {
      router.push("/login");
      return;
    }
    setFailed(false);
    try {
      const [reqRes, inboxRes] = await Promise.all([
        fetch("/api/portal/requests", { headers: { "x-creator-token": token } }),
        // peek=1 reads the conversation without marking anything read
        fetch("/api/portal/inbox?peek=1", { headers: { "x-creator-token": token } }).catch(() => null),
      ]);
      if (!reqRes.ok) throw new Error("requests");
      setRequests(await reqRes.json());

      if (inboxRes?.ok) {
        const data = await inboxRes.json();
        const msgs: Array<{ content: string; createdAt: string; isFromCreator: boolean; sender?: { name?: string } | null }> =
          data.messages || [];
        const m = msgs[msgs.length - 1];
        setInbox({
          last: m
            ? { content: m.content, createdAt: m.createdAt, fromCreator: m.isFromCreator, sender: m.sender?.name }
            : null,
          unread: data.unreadCount ?? 0,
        });
      } else {
        setInbox({ last: null, unread: 0 });
      }
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <HomeSkeleton />;

  if (failed) {
    return (
      <div className="px-4 pt-6 lg:px-6 lg:pt-10">
        <h1 className="text-[22px] font-semibold leading-tight lg:text-[26px]">Your requests</h1>
        <div className="mt-4 max-w-[560px] rounded-[10px] bg-tile p-4">
          <p className="text-[15px]">Your requests didn&apos;t load. Check your connection, then try again.</p>
          <Button variant="outline" className="mt-3 h-11 md:h-9" onClick={() => { setLoading(true); load(); }}>
            <RefreshCw aria-hidden="true" />
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const toDo = requests.filter((r) => ACTIONABLE.has(r.status)).sort(byUrgency);
  const inReview = requests.filter((r) => IN_REVIEW.has(r.status)).sort(byUrgency);
  const featured = toDo[0];
  const others = toDo.slice(1);

  const fieldsLeft = (r: CreatorRequest) =>
    (r.fieldStates || []).filter((f) => f.state === "waiting" || f.state === "overdue" || f.state === "changes").length;

  let lede: string;
  if (featured) {
    const due = featured.dueDate ? timeLeft(featured.dueDate) : null;
    const left = fieldsLeft(featured);
    const first = toDo.length === 1 ? "1 open request" : `${toDo.length} open requests`;
    const dueText = due ? (due.late ? `, ${due.text}` : `, due ${formatDueOn(featured.dueOn ?? featured.dueDate)}`) : "";
    lede = `${first}${dueText}. ${left === 0 ? "Everything is uploaded." : `${plural(left, "field")} still to do.`}`;
  } else if (inReview.length > 0) {
    lede = `Nothing to upload. ${plural(inReview.length, "request is", "requests are")} in review.`;
  } else {
    lede = "Nothing to upload right now. New requests appear here.";
  }

  return (
    <div className="px-4 pt-5 lg:px-6 lg:pt-10">
      <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.01em] lg:text-[26px]">Your requests</h1>
      <p className="mt-1 text-[15px] leading-normal text-ink-2">{lede}</p>

      {/* From 1024px: the featured request and its next action on the left; messages and the rest on the right */}
      <div className="lg:mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] lg:items-start lg:gap-10">
        {featured ? (
          <FeaturedRequest request={featured} />
        ) : (
          <div className="mt-5 rounded-[10px] bg-tile p-4 lg:mt-0 lg:p-6">
            <p className="text-[15px] font-semibold">You&apos;re all caught up</p>
            <p className="mt-1 text-[14px] leading-normal text-ink-2">
              When your team sends you a request, it shows up here with what to upload and when it&apos;s due.
              You&apos;ll also get a notification. Once a request is approved, it leaves your list.
            </p>
            <Button asChild variant="outline" className="mt-3 h-11 md:h-9">
              <Link href="/creator/messages">Message your team</Link>
            </Button>
          </div>
        )}

        <div className="lg:space-y-9">
          {inbox && <MessagesPeek inbox={inbox} />}
          {others.length > 0 && (
            <SideList id="also-side" title="Also to do" sub={plural(others.length, "request")} requests={others} />
          )}
          {inReview.length > 0 && (
            <SideList id="review-side" title="In review" sub="Submitted, waiting for review" requests={inReview} />
          )}
        </div>
      </div>

      {/* Phone and tablet: the rest as shelves of title cards */}
      {others.length > 0 && (
        <Shelf
          title="Also to do"
          sub={plural(others.length, "request")}
          className="mt-9 sm:[&_.tw-shelf-item]:[--per:1.6] lg:hidden"
        >
          {others.map((r) => (
            <TitleCard
              audience="creator"
              key={r.id}
              title={r.title}
              creator={`Sent ${formatDay(r.createdAt, tz)}`}
              due={r.dueDate}
              fields={toStrip(r.fieldStates)}
              meta={creatorSummary(r.fieldStates)}
              href={`/creator/requests/${r.id}`}
            />
          ))}
        </Shelf>
      )}

      {inReview.length > 0 && (
        <Shelf
          title="In review"
          sub="Submitted, waiting for review"
          className="mt-9 sm:[&_.tw-shelf-item]:[--per:1.6] lg:hidden"
        >
          {inReview.map((r) => (
            <TitleCard
              audience="creator"
              key={r.id}
              title={r.title}
              creator={`Sent ${formatDay(r.createdAt, tz)}`}
              timeText={r.submittedAt ? `Submitted ${formatDay(r.submittedAt, tz)}` : "Submitted"}
              fields={toStrip(r.fieldStates)}
              meta={creatorSummary(r.fieldStates)}
              href={`/creator/requests/${r.id}`}
            />
          ))}
        </Shelf>
      )}
    </div>
  );
}

/** Desktop side column: the other requests as compact rows */
function SideList({ id, title, sub, requests }: { id: string; title: string; sub: string; requests: CreatorRequest[] }) {
  return (
    <section aria-labelledby={id} className="hidden lg:block">
      <div className="mb-2 flex min-h-8 items-baseline gap-3">
        <h2 id={id} className="text-[17px] font-semibold leading-snug">
          {title}
        </h2>
        <span className="truncate text-[14px] text-ink-2">{sub}</span>
      </div>
      <ul className="space-y-2">
        {requests.map((r) => (
          <li key={r.id}>
            <RequestRow request={r} compact />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The most urgent request, featured: its title as the cover, time left, the field strip and the next action */
function FeaturedRequest({ request: r }: { request: CreatorRequest }) {
  const tz = useViewerTimeZone();
  const rows = r.fieldStates || [];
  const strip = toStrip(rows);
  const step = nextStep(rows, r.fieldSubmissions);
  const href = `/creator/requests/${r.id}${step.fieldId ? `#field-${step.fieldId}` : ""}`;
  const Icon = step.cta === "Submit" ? Send : step.cta.startsWith("Write") ? PenLine : Upload;

  return (
    <RequestCover
      className="mt-5 lg:mt-0"
      size="lg"
      headingId="featured-title"
      title={r.title}
      href={`/creator/requests/${r.id}`}
      sentText={sentLine(r.createdAt, tz)}
      due={r.dueDate}
      dueOn={r.dueOn}
      fields={strip}
      summary={creatorSummary(rows)}
    >
      <p className="mt-4 text-[15px] leading-normal">{step.sentence}</p>
      {step.note && (
        <blockquote className="mt-2 max-w-[60ch] rounded-lg bg-well px-3 py-2.5 text-[15px] leading-normal">
          <span className="sr-only">Your team said: </span>
          &ldquo;{step.note}&rdquo;
        </blockquote>
      )}

      <div className="mt-4 lg:flex lg:items-center lg:gap-4">
        <Button asChild className="h-12 w-full text-[15px] lg:h-11 lg:w-auto lg:px-6">
          <Link href={href}>
            <Icon aria-hidden="true" />
            {step.cta}
          </Link>
        </Button>
        {rows.length > 1 && (
          <Link
            href={`/creator/requests/${r.id}`}
            className="mt-2 inline-flex min-h-11 items-center text-[14px] font-medium text-ink-2 underline underline-offset-[3px] hover:text-ink lg:mt-0"
          >
            See all {rows.length} fields
          </Link>
        )}
      </div>
    </RequestCover>
  );
}

function MessagesPeek({ inbox }: { inbox: InboxPeek }) {
  const tz = useViewerTimeZone();
  const { last, unread } = inbox;
  return (
    <section aria-labelledby="peek-h" className="mt-9 lg:mt-0">
      <div className="mb-2 flex min-h-8 items-baseline gap-3">
        <h2 id="peek-h" className="text-[17px] font-semibold leading-snug">
          Messages
        </h2>
        {unread > 0 && <span className="text-[14px] text-ink-2">{unread} unread</span>}
      </div>
      <Link
        href="/creator/messages"
        className="group block rounded-[10px] bg-tile p-4 transition-colors hover:bg-tile-hi focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {last ? (
          <>
            <p className="flex items-baseline justify-between gap-3 text-[14px]">
              <span className="truncate font-semibold">{last.fromCreator ? "You" : last.sender || "Your team"}</span>
              <span className="shrink-0 text-ink-2">{formatMoment(last.createdAt, tz)}</span>
            </p>
            <p className="mt-1 line-clamp-2 text-[15px] leading-normal">&ldquo;{last.content}&rdquo;</p>
            <p className="mt-2 flex items-center gap-1 text-[14px] text-ink-2 group-hover:text-ink">
              {unread > 0
                ? `${plural(unread, "new message")}. Open the conversation`
                : last.fromCreator
                  ? "You replied last. Open the conversation"
                  : "Open the conversation"}
              <ChevronRight className="size-4" aria-hidden="true" />
            </p>
          </>
        ) : (
          <>
            <p className="text-[15px] leading-normal">No messages yet. Ask your team anything about a request, any time.</p>
            <p className="mt-2 flex items-center gap-1 text-[14px] text-ink-2 group-hover:text-ink">
              Write to your team
              <ChevronRight className="size-4" aria-hidden="true" />
            </p>
          </>
        )}
      </Link>
    </section>
  );
}

function HomeSkeleton() {
  return (
    <div className="px-4 pt-5 lg:px-6 lg:pt-10" role="status" aria-label="Loading your requests">
      <Skeleton className="h-7 w-44" />
      <Skeleton className="mt-2 h-5 w-72 max-w-full" />
      <div className="lg:mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] lg:gap-10">
        <div className="mt-5 rounded-[10px] bg-tile p-4 lg:mt-0">
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="mt-2 h-4 w-1/2" />
          <Skeleton className="mt-5 h-10 w-40" />
          <Skeleton className="mt-5 h-3 w-full" />
          <Skeleton className="mt-6 h-12 w-full" />
        </div>
        <div>
          <Skeleton className="mt-9 h-5 w-40 lg:mt-0" />
          <Skeleton className="mt-3 h-24 w-full" />
        </div>
      </div>
    </div>
  );
}
