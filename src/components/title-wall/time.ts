/**
 * The one rule for every time-left figure on the wall.
 *
 * A due value given as a plain date ("2026-10-26") is due at the END of that
 * day (23:59 local). A full timestamp is used as is. Under 3 days the figure
 * keeps hours ("1 d 10 h"); from 3 days it rounds to days.
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

const DAY_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Every date on the wall reads in the agency's timezone, never the machine's:
 * the server (UTC on Vercel) and the browser must print the same day, or React
 * hydration breaks and a midnight deadline shows on the wrong date.
 */
export const DISPLAY_TIMEZONE = process.env.NEXT_PUBLIC_DISPLAY_TIMEZONE || "Australia/Brisbane";

interface ZonedParts { year: number; month: number; day: number; weekday: number; hour: number; minute: number }

const zonedFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: DISPLAY_TIMEZONE,
  year: "numeric", month: "numeric", day: "numeric", weekday: "short",
  hour: "numeric", minute: "numeric", hourCycle: "h23",
});
const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function zoned(d: Date): ZonedParts {
  const p = Object.fromEntries(zonedFormat.formatToParts(d).map((x) => [x.type, x.value]));
  return { year: +p.year, month: +p.month, day: +p.day, weekday: WEEKDAY_INDEX[p.weekday], hour: +p.hour % 24, minute: +p.minute };
}

/** 23:59 on a calendar day in the display timezone, as an instant */
function endOfZonedDay(year: number, month: number, day: number): Date {
  const guess = Date.UTC(year, month - 1, day, 23, 59);
  const z = zoned(new Date(guess));
  const offset = Date.UTC(z.year, z.month - 1, z.day, z.hour, z.minute) - guess;
  return new Date(guess - offset);
}

export function toDueDate(due: Date | string | number): Date {
  if (due instanceof Date) return due;
  if (typeof due === "string" && DAY_ONLY.test(due)) {
    const [y, m, d] = due.split("-").map(Number);
    return endOfZonedDay(y, m, d);
  }
  return new Date(due);
}

export function timeLeft(due: Date | string | number, now: Date = new Date()): TimeLeft {
  const ms = toDueDate(due).getTime() - now.getTime();
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

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Thu 22 Oct" */
export function formatDay(d: Date | string | number): string {
  const z = zoned(toDueDate(d));
  return `${DOW[z.weekday]} ${z.day} ${MON[z.month - 1]}`;
}

/** "Due Thu 22 Oct, 23:59" */
export function formatDue(d: Date | string | number): string {
  const x = toDueDate(d);
  const z = zoned(x);
  const hh = String(z.hour).padStart(2, "0");
  const mm = String(z.minute).padStart(2, "0");
  return `Due ${formatDay(x)}, ${hh}:${mm}`;
}

/** "Fri 30 Oct, 22:06": a moment in the agency's timezone */
export function formatStamp(d: Date | string | number): string {
  const x = toDueDate(d);
  const z = zoned(x);
  return `${formatDay(x)}, ${String(z.hour).padStart(2, "0")}:${String(z.minute).padStart(2, "0")}`;
}
