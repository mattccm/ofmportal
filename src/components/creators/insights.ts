/**
 * Pure helpers that turn request and creator rows into what the Creators,
 * creator profile and Messages screens say: field states for title cards,
 * how a creator usually delivers, and the creator's one status.
 *
 * No Prisma import: the inputs are structural, so the same code runs on the
 * server (page queries) and in API routes.
 */
import type { FieldState, FieldSummary } from "@/components/title-wall/types";
import { toDueDate } from "@/components/title-wall/time";
import { mapRequestFields } from "@/lib/title-wall/request-card-data";

export interface RequestFieldDef {
  id?: string;
  label?: string;
  name?: string;
  type?: string;
  value?: unknown;
}

export interface FieldSubmissionRow {
  status?: "PENDING" | "SUBMITTED" | "APPROVED" | "NEEDS_REVISION" | string;
}

export interface RequestRow {
  id: string;
  title: string;
  status: string;
  dueDate: Date | string | null;
  createdAt?: Date | string;
  submittedAt?: Date | string | null;
  reviewedAt?: Date | string | null;
  fields?: unknown;
  fieldSubmissions?: unknown;
  uploads?: { fieldId: string | null; status: string }[];
}

const FINISHED = new Set(["APPROVED", "COMPLETED"]);
export const ACTIVE_STATUSES = ["PENDING", "IN_PROGRESS", "SUBMITTED", "UNDER_REVIEW", "NEEDS_REVISION"] as const;

/** The due instant under the wall's one due rule (see title-wall/time.ts) */
export function dueMoment(due: Date | string): Date {
  return toDueDate(due);
}

/** Every field of a request with its state, by the wall's one shared rule. */
export function requestFields(r: RequestRow, now: Date = new Date()): FieldSummary[] {
  return mapRequestFields(
    {
      id: r.id,
      status: r.status,
      dueDate: r.dueDate,
      fields: r.fields,
      fieldSubmissions: r.fieldSubmissions,
      uploads: (r.uploads ?? []).map((u, i) => ({ id: String(i), fieldId: u.fieldId, status: u.status, uploadedAt: null, createdAt: new Date(0) })),
    },
    now
  ).map(({ id, name, state }) => ({ id, name, state }));
}

export function countState(fields: FieldSummary[], ...states: FieldState[]): number {
  return fields.filter((f) => states.includes(f.state)).length;
}

/** When a finished request came in: the creator's submission, else the review. */
export function deliveredAt(r: RequestRow): Date | null {
  const at = r.submittedAt ?? r.reviewedAt ?? null;
  return at ? new Date(at) : null;
}

export interface FinishedPoint {
  id: string;
  title: string;
  due: Date;
  delivered: Date;
  /** Positive: days early. Negative: days late. Rounded to whole days. */
  daysEarly: number;
  onTime: boolean;
}

/** Finished requests with a due date, oldest first, as on-time points. */
export function finishedPoints(rows: RequestRow[]): FinishedPoint[] {
  const out: FinishedPoint[] = [];
  for (const r of rows) {
    if (!FINISHED.has(r.status) || !r.dueDate) continue;
    const delivered = deliveredAt(r);
    if (!delivered) continue;
    const due = dueMoment(r.dueDate);
    const diff = (due.getTime() - delivered.getTime()) / 86_400_000;
    const daysEarly = diff >= 0 ? Math.floor(diff) : -Math.ceil(-diff);
    out.push({ id: r.id, title: r.title, due, delivered, daysEarly, onTime: diff >= 0 });
  }
  return out.sort((a, b) => a.delivered.getTime() - b.delivered.getTime());
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

export interface DeliverySummary {
  finished: number;
  onTime: number;
  /** Median days early (negative = late); null with nothing finished */
  usualDaysEarly: number | null;
}

export function deliverySummary(points: FinishedPoint[]): DeliverySummary {
  if (points.length === 0) return { finished: 0, onTime: 0, usualDaysEarly: null };
  return {
    finished: points.length,
    onTime: points.filter((p) => p.onTime).length,
    usualDaysEarly: median(points.map((p) => p.daysEarly)),
  };
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "usually 2 days early" / "usually on the day" / "usually 3 days late" */
export function usualPhrase(days: number | null): string | null {
  if (days == null) return null;
  if (days === 0) return "usually on the day";
  return days > 0 ? `usually ${plural(days, "day")} early` : `usually ${plural(-days, "day")} late`;
}

export function contactLabel(preferred: string | null | undefined): string {
  if (preferred === "BOTH") return "SMS and email";
  if (preferred === "SMS") return "SMS";
  return "Email";
}

/** "Australia/Sydney" → "Sydney" */
export function cityOf(tz: string | null | undefined): string {
  if (!tz) return "No time zone";
  const last = tz.split("/").pop() ?? tz;
  return last.replace(/_/g, " ");
}

export interface ActiveSummary {
  id: string;
  title: string;
  due: Date | null;
  fields: FieldSummary[];
}

export type CreatorStatusTone = "late" | "ready" | "neutral" | "quiet";
export interface CreatorStatus {
  label: string;
  tone: CreatorStatusTone;
}

/** The creator's one status, most pressing first. */
export function creatorStatus(input: {
  archived: boolean;
  inviteStatus: string;
  pausedUntil: Date | null;
  paused: boolean;
  active: ActiveSummary[];
  now?: Date;
}): CreatorStatus {
  const now = input.now ?? new Date();
  if (input.archived) return { label: "Archived", tone: "quiet" };
  if (input.inviteStatus === "PENDING") return { label: "Invite not accepted yet", tone: "quiet" };
  if (input.inviteStatus === "EXPIRED") return { label: "Invite expired", tone: "quiet" };
  if (input.paused) {
    return {
      label: input.pausedUntil
        ? `Reminders paused until ${input.pausedUntil.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })}`
        : "Reminders paused",
      tone: "neutral",
    };
  }
  const anyLate = input.active.some(
    (r) => r.due && dueMoment(r.due) < now && r.fields.some((f) => f.state === "overdue" || f.state === "changes")
  );
  if (anyLate) return { label: "Late", tone: "late" };
  const ready = input.active.reduce((n, r) => n + countState(r.fields, "ready"), 0);
  if (ready) return { label: `${plural(ready, "field")} to review`, tone: "ready" };
  const owed = input.active.reduce((n, r) => n + countState(r.fields, "waiting", "overdue", "changes"), 0);
  if (owed) return { label: "Waiting on uploads", tone: "neutral" };
  if (input.active.length) return { label: "Everything is in", tone: "neutral" };
  return { label: "Nothing open", tone: "quiet" };
}

/** One sentence: "2 active, on time 8 of 9, usually 2 days early." */
export function creatorSentence(activeCount: number, d: DeliverySummary): string {
  const parts: string[] = [activeCount ? `${activeCount} active` : "Nothing active"];
  if (d.finished) {
    parts.push(`on time ${d.onTime} of ${d.finished}`);
    const usual = usualPhrase(d.usualDaysEarly);
    if (usual) parts.push(usual);
  } else {
    parts.push("nothing finished yet");
  }
  return `${parts.join(", ")}.`;
}

/** Quiet hours for a creator as the reminder scheduler applies them. */
export interface QuietHours {
  enabled: boolean;
  start: string;
  end: string;
  /** true when these are the scheduler's built-in default, not the creator's own */
  isDefault: boolean;
}

/** Matches DEFAULT_QUIET_HOURS in src/lib/auto-reminder-scheduler.ts */
export const DEFAULT_QUIET: QuietHours = { enabled: true, start: "22:00", end: "08:00", isDefault: true };

export function quietOf(
  override: { quietHoursEnabled: boolean; quietHoursStart: string; quietHoursEnd: string } | null | undefined
): QuietHours {
  if (!override) return DEFAULT_QUIET;
  return {
    enabled: override.quietHoursEnabled,
    start: override.quietHoursStart,
    end: override.quietHoursEnd,
    isDefault: false,
  };
}

export function quietLabel(q: QuietHours): string {
  return q.enabled ? `${q.start}–${q.end}` : "None";
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** "5 min ago", "3 h ago", "yesterday", "4 days ago", or "Never" */
export function ago(at: Date | string | null | undefined, now: Date = new Date()): string {
  if (!at) return "never";
  const ms = now.getTime() - new Date(at).getTime();
  const min = Math.round(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d === 1) return "yesterday";
  if (d < 45) return `${d} days ago`;
  return new Date(at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}
