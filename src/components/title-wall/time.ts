/**
 * The one rule for every time-left figure and date on the wall.
 *
 * Due dates (see src/lib/due.ts): the DATE text comes from the request's
 * `dueOn` calendar day and reads the same for every viewer ("Mon 3 Aug"), no
 * timezone conversion. The countdown comes from `dueDate`, the deadline
 * instant (23:59:59 on that day in the creator's timezone). A plain
 * "YYYY-MM-DD" given to `timeLeft` is due at the end of that day in the
 * timezone passed (the composer's preview).
 *
 * Every other moment (sent, uploaded, messages) reads in the VIEWER's
 * timezone, passed in explicitly (useViewerTimeZone()) so the server and the
 * browser print the same text.
 *
 * Under 3 days the figure keeps hours ("1 d 10 h"); from 3 days it rounds to days.
 */

export interface TimeLeft {
  /** Past due */
  late: boolean;
  /** Overdue, or under 48 hours left: the only case drawn in red */
  urgent: boolean;
  /** Whole days and remaining hours in the span */
  days: number;
  hours: number;
  /** Total whole hours (negative when late) */
  totalHours: number;
  /** "3 days", "1 d 10 h", "5 h" */
  span: string;
  /** "3 days left", "1 d 10 h late" */
  text: string;
  /** The number part and the word part, for a large countdown: ["1 d 10 h", "late"] */
  parts: [string, string];
}

import { dayKeyOf, endOfDayIn, formatDueDay, isDayKey, safeTimeZone, zonedParts } from "@/lib/due";

/** A timezone for formatting when none is passed: identical on server and browser */
export const FALLBACK_TIMEZONE = "UTC";

export { formatDueDay };

/** The deadline instant. A "YYYY-MM-DD" is the end of that day in `tz`. */
export function toDueDate(due: Date | string | number, tz: string = FALLBACK_TIMEZONE): Date {
  if (due instanceof Date) return due;
  if (isDayKey(due)) return endOfDayIn(due, safeTimeZone(tz));
  return new Date(due);
}

export function timeLeft(due: Date | string | number, now: Date = new Date(), tz?: string): TimeLeft {
  const ms = toDueDate(due, tz).getTime() - now.getTime();
  const late = ms < 0;
  const abs = Math.floor(Math.abs(ms) / 3_600_000);
  const days = Math.floor(abs / 24);
  const hours = abs % 24;
  const span =
    days >= 3 ? `${days} days` : days > 0 ? `${days} d ${hours} h` : abs > 0 ? `${hours} h` : "under 1 h";
  const word = late ? "late" : "left";
  return {
    late,
    urgent: late || abs < 48,
    days,
    hours,
    totalHours: late ? -abs : abs,
    span,
    text: `${span} ${word}`,
    parts: [span, word],
  };
}

/**
 * "Thu 22 Oct" (with the year when not this year). A "YYYY-MM-DD" calendar
 * day prints as is, for every viewer; a moment prints in `tz`.
 */
export function formatDay(d: Date | string | number, tz: string = FALLBACK_TIMEZONE): string {
  if (isDayKey(d)) return formatDueDay(d);
  const z = zonedParts(new Date(d), tz);
  return formatDueDay(`${String(z.year).padStart(4, "0")}-${String(z.month).padStart(2, "0")}-${String(z.day).padStart(2, "0")}`);
}

/** "Mon 3 Aug": a request's due day, from its dueOn (a DATE, its ISO string or "YYYY-MM-DD") */
export function formatDueOn(dueOn: Date | string | number | null | undefined): string {
  const key = dayKeyOf(dueOn);
  return key ? formatDueDay(key) : "";
}

/** "Due Mon 3 Aug": from the request's dueOn (a DATE, its ISO string or "YYYY-MM-DD") */
export function formatDue(dueOn: Date | string | number): string {
  const key = dayKeyOf(dueOn);
  return key ? `Due ${formatDueDay(key)}` : "No due date";
}

/** "Fri 30 Oct, 22:06": a moment in the viewer's timezone */
export function formatStamp(d: Date | string | number, tz: string = FALLBACK_TIMEZONE): string {
  const x = new Date(d);
  const z = zonedParts(x, tz);
  return `${formatDay(x, tz)}, ${String(z.hour).padStart(2, "0")}:${String(z.minute).padStart(2, "0")}`;
}
