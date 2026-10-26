import { timeLeft } from "@/components/title-wall/time";
import type { OverviewData, OverviewField, OverviewRequest } from "@/app/(dashboard)/dashboard/_overview/types";

/**
 * Lay the Overview out from its data. Pure: the same input always gives the
 * same wall, on the server and the client.
 *
 * Every request card sits on ONE shelf only, the one for its most urgent
 * state: the billboard (the most urgent request), then "Continue reviewing"
 * (fields ready), then "Due this week" (due in the next 7 days, nothing
 * ready). "Waiting on creators" is keyed by creator, not by request: every
 * creator who still owes fields gets one card, even when one of their
 * requests is also on a shelf above. "New from creators" is keyed by field.
 */

const DAY = 86_400_000;

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export interface CreatorOwes {
  creatorId: string;
  creatorName: string;
  creatorLastSeen: string | null;
  /** Their requests that still owe fields, soonest due first */
  requests: OverviewRequest[];
  /** The soonest due moment among those requests (ISO), for the time left */
  due: string | null;
  /** That request's due day ("YYYY-MM-DD"), for the date text */
  dueOn: string | null;
  /** Fields still to come or with changes requested, across those requests */
  owed: { field: OverviewField; request: OverviewRequest }[];
  lastReminderAt: string | null;
}

export interface OverviewLayout {
  featured: OverviewRequest | null;
  reviewing: OverviewRequest[];
  dueThisWeek: OverviewRequest[];
  waiting: CreatorOwes[];
  /** The page's finding, in words */
  finding: string;
  figures: { toReview: number; overdue: number; dueSoon: number; approvedThisWeek: number; approvedLastWeek: number };
  /** Fields ready across the requests on "Continue reviewing" */
  reviewingReady: number;
}

const dueMs = (r: OverviewRequest) => (r.due ? new Date(r.due).getTime() : Number.POSITIVE_INFINITY);
const byDue = (a: OverviewRequest, b: OverviewRequest) => dueMs(a) - dueMs(b);
export const owedFields = (r: OverviewRequest) => r.fields.filter((f) => f.state === "waiting" || f.state === "overdue" || f.state === "changes");

export function arrangeOverview(data: OverviewData): OverviewLayout {
  const now = new Date(data.now);
  const week = now.getTime() + 7 * DAY;
  const all = data.requests;

  // requests arrive most urgent first; the billboard needs a due date for its countdown
  const featured = all.find((r) => r.due) ?? null;
  const placed = new Set<string>(featured ? [featured.id] : []);
  const take = (list: OverviewRequest[]) => list.filter((r) => !placed.has(r.id)).map((r) => (placed.add(r.id), r));

  const reviewing = take(all.filter((r) => r.counts.ready > 0).sort(byDue));
  const dueThisWeek = take(all.filter((r) => r.due && dueMs(r) <= week).sort(byDue));

  // keyed by creator: everyone who still owes fields, wherever their requests sit
  const byCreator = new Map<string, CreatorOwes>();
  for (const r of all.filter((x) => owedFields(x).length > 0).sort(byDue)) {
    const c =
      byCreator.get(r.creatorId) ??
      ({
        creatorId: r.creatorId,
        creatorName: r.creatorName,
        creatorLastSeen: r.creatorLastSeen,
        requests: [],
        due: null,
        dueOn: null,
        owed: [],
        lastReminderAt: null,
      } as CreatorOwes);
    c.requests.push(r);
    if (r.due && (!c.due || dueMs(r) < new Date(c.due).getTime())) {
      c.due = r.due;
      c.dueOn = r.dueOn;
    }
    c.owed.push(...owedFields(r).map((field) => ({ field, request: r })));
    if (r.lastReminderAt && (!c.lastReminderAt || r.lastReminderAt > c.lastReminderAt)) c.lastReminderAt = r.lastReminderAt;
    byCreator.set(r.creatorId, c);
  }
  // soonest due first; a creator with no due dates goes last
  const creatorDue = (c: CreatorOwes) => (c.due ? new Date(c.due).getTime() : Number.MAX_SAFE_INTEGER);
  const waiting = [...byCreator.values()].sort((a, b) => creatorDue(a) - creatorDue(b));

  // ---------- the finding ----------
  const readyFields = all.reduce((n, r) => n + r.counts.ready, 0);
  const readyRequests = all.filter((r) => r.counts.ready > 0).length;
  const overdue = all.filter((r) => r.late).sort(byDue);
  const parts: string[] = [];
  if (all.length === 0) {
    parts.push("No requests are out with creators. Send one to get uploads coming in.");
  } else {
    parts.push(
      readyFields > 0
        ? `${plural(readyFields, "field")} ${readyFields === 1 ? "is" : "are"} ready to review ${readyRequests === 1 ? "in 1 request" : `across ${readyRequests} requests`}.`
        : "Nothing is waiting for your review."
    );
    if (overdue.length) {
      const first = overdue[0];
      // keep the figure together ("1 d 14 h late") so it never breaks across lines
      parts.push(`${first.creatorName}’s ${first.title} is ${timeLeft(first.due!, now).text.replace(/ /g, String.fromCharCode(160))}.`);
      if (overdue.length > 1) parts.push(`${plural(overdue.length - 1, "more request is", "more requests are")} overdue.`);
    } else {
      parts.push("Nothing is overdue.");
    }
  }

  const dueSoon = all.filter((r) => r.due && !r.late && dueMs(r) >= now.getTime() && dueMs(r) <= week).length;

  return {
    featured,
    reviewing,
    dueThisWeek,
    waiting,
    finding: parts.join(" "),
    figures: {
      toReview: readyFields,
      overdue: overdue.length,
      dueSoon,
      approvedThisWeek: data.approvedThisWeek,
      approvedLastWeek: data.approvedLastWeek,
    },
    reviewingReady: reviewing.reduce((n, r) => n + r.counts.ready, 0),
  };
}

/** "8 min ago", "5 h ago", "yesterday", "3 days ago", "just now" */
export function ago(iso: string | null | undefined, now: Date): string {
  if (!iso) return "";
  const m = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60_000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d === 1) return "yesterday";
  return `${d} days ago`;
}

/** "3.6 MB", "2.1 GB" */
export function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(n < 10 * 1024 ** 2 ? 1 : 0)} MB`;
  return `${(n / 1024 ** 3).toFixed(1)} GB`;
}

/** "0:24", "8:41" */
export function formatDuration(s: number): string {
  const t = Math.round(s);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}
