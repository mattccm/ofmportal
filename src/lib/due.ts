/**
 * Due dates: one rule for the whole app.
 *
 * A due date is a calendar day ("3 Aug"), the same for everyone who reads it.
 * The deadline is the END of that day in the CREATOR's timezone, so a creator
 * in Los Angeles gets her whole Friday and a manager in Brisbane picking
 * "3 Aug" at 2am still sets 3 Aug.
 *
 *   dueOn   (DATE)     the picked calendar day, what every screen shows
 *   dueDate (instant)  23:59:59 on dueOn in the creator's timezone, used for
 *                      overdue, countdowns, sorting, reminders and crons
 *
 * Every write of a due date goes through `dueFromDay` / `dueInDays` /
 * `parseDueInput`; a creator timezone change re-anchors with `reanchorDue`.
 * Client-safe: Intl only, no database.
 */

/** A calendar day, "YYYY-MM-DD" */
export type DayKey = string;

export interface Due {
  /** The calendar day as a DATE value (UTC midnight of that day) */
  dueOn: Date;
  /** 23:59:59 on that day in the creator's timezone */
  dueDate: Date;
}

const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
const MIDNIGHT_UTC = /^(\d{4}-\d{2}-\d{2})(?:T00:00(?::00(?:\.000)?)?(?:Z|\+00:00))?$/;

export function isDayKey(v: unknown): v is DayKey {
  return typeof v === "string" && DAY_KEY.test(v);
}

/** A usable IANA timezone, or "UTC" */
export function safeTimeZone(tz: string | null | undefined): string {
  if (!tz) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(tz: string): Intl.DateTimeFormat {
  let f = partsFormatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hourCycle: "h23",
    });
    partsFormatters.set(tz, f);
  }
  return f;
}

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** The wall-clock reading of an instant in a timezone */
export function zonedParts(at: Date | number, tz: string): ZonedParts {
  const p: Record<string, string> = {};
  for (const x of partsFormatter(safeTimeZone(tz)).formatToParts(new Date(at))) p[x.type] = x.value;
  return { year: +p.year, month: +p.month, day: +p.day, hour: +p.hour % 24, minute: +p.minute, second: +p.second };
}

function pad(n: number, w = 2): string {
  return String(n).padStart(w, "0");
}

function keyOf(year: number, month: number, day: number): DayKey {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

/** The calendar day an instant falls on in a timezone */
export function localDay(at: Date | string | number, tz: string): DayKey {
  const z = zonedParts(new Date(at), tz);
  return keyOf(z.year, z.month, z.day);
}

/** Today's calendar day in a timezone */
export function todayIn(tz: string, now: Date = new Date()): DayKey {
  return localDay(now, tz);
}

/** Calendar arithmetic on day keys (no timezone involved) */
export function addDaysToKey(day: DayKey, n: number): DayKey {
  const [y, m, d] = day.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return keyOf(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier) */
export function daysBetweenKeys(from: DayKey, to: DayKey): number {
  const a = dayKeyToDate(from).getTime();
  const b = dayKeyToDate(to).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** "YYYY-MM-DD" → the DATE value Prisma stores (UTC midnight) */
export function dayKeyToDate(day: DayKey): Date {
  const m = DAY_KEY.exec(day);
  if (!m) throw new Error(`Not a calendar day: ${day}`);
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
}

/**
 * A stored dueOn (Date at UTC midnight, its ISO string, or a day key) as a
 * day key. Never converts through a timezone: the day is the day.
 */
export function dayKeyOf(v: Date | string | number | null | undefined): DayKey | null {
  if (v == null || v === "") return null;
  if (typeof v === "string") {
    if (DAY_KEY.test(v)) return v;
    const m = MIDNIGHT_UTC.exec(v);
    if (m) return m[1];
  }
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return keyOf(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** The instant a wall-clock time in a timezone happens (two passes for DST) */
export function zonedTimeToInstant(
  day: DayKey,
  hour: number,
  minute: number,
  second: number,
  tz: string
): Date {
  const [y, m, d] = day.split("-").map(Number);
  const want = Date.UTC(y, m - 1, d, hour, minute, second);
  let guess = want;
  for (let i = 0; i < 3; i++) {
    const z = zonedParts(guess, tz);
    const seen = Date.UTC(z.year, z.month - 1, z.day, z.hour, z.minute, z.second);
    const diff = want - seen;
    if (diff === 0) break;
    guess += diff;
  }
  return new Date(guess);
}

/** 23:59:59 on a calendar day in a timezone */
export function endOfDayIn(day: DayKey, tz: string): Date {
  return zonedTimeToInstant(day, 23, 59, 59, safeTimeZone(tz));
}

/** The picked calendar day → { dueOn, dueDate } for one creator */
export function dueFromDay(day: DayKey, creatorTz: string | null | undefined): Due {
  if (!isDayKey(day)) throw new Error(`Not a calendar day: ${day}`);
  return { dueOn: dayKeyToDate(day), dueDate: endOfDayIn(day, safeTimeZone(creatorTz)) };
}

/** The deadline instant for a stored dueOn in a (new) creator timezone */
export function reanchorDue(dueOn: Date | string, tz: string | null | undefined): Date {
  const key = dayKeyOf(dueOn);
  if (!key) throw new Error("reanchorDue: no dueOn");
  return endOfDayIn(key, safeTimeZone(tz));
}

/** "Due in N days": N calendar days after today in the creator's timezone */
export function dueInDays(n: number, creatorTz: string | null | undefined, now: Date = new Date()): Due {
  const tz = safeTimeZone(creatorTz);
  return dueFromDay(addDaysToKey(todayIn(tz, now), Math.round(n)), tz);
}

/** Shift an existing due day by N calendar days (clone offsets, staggers) */
export function shiftDue(dueOn: Date | string | DayKey, n: number, creatorTz: string | null | undefined): Due {
  const key = dayKeyOf(dueOn);
  if (!key) throw new Error("shiftDue: no dueOn");
  return dueFromDay(addDaysToKey(key, Math.round(n)), creatorTz);
}

/**
 * The calendar day a client meant. "YYYY-MM-DD" is taken as is. An ISO
 * timestamp from an older client is read as a day: exactly UTC midnight is
 * that UTC day (what `new Date("2026-08-03").toISOString()` produces);
 * anything else is the day it falls on in the picker's timezone.
 */
export function dayFromInput(value: string | Date, pickerTz?: string | null): DayKey | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return localDay(value, safeTimeZone(pickerTz));
  }
  const v = value.trim();
  if (!v) return null;
  if (DAY_KEY.test(v)) return v;
  const m = MIDNIGHT_UTC.exec(v);
  if (m) return m[1];
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return localDay(d, safeTimeZone(pickerTz));
}

/** A client's due value → { dueOn, dueDate } for one creator, or null for "no due date" */
export function parseDueInput(
  value: string | Date | null | undefined,
  creatorTz: string | null | undefined,
  pickerTz?: string | null
): Due | null {
  if (value == null || value === "") return null;
  const day = dayFromInput(value, pickerTz);
  return day ? dueFromDay(day, creatorTz) : null;
}

/** No due date */
export const NO_DUE = { dueOn: null, dueDate: null } as const;

/**
 * Calendar days from the creator's today to the due day: 1 = due tomorrow,
 * 0 = due today, -1 = one day overdue. For reminder copy.
 */
export function calendarDaysUntilDue(
  due: { dueOn?: Date | string | null; dueDate?: Date | string | null },
  creatorTz: string | null | undefined,
  now: Date = new Date()
): number | null {
  const tz = safeTimeZone(creatorTz);
  const key = dayKeyOf(due.dueOn ?? null) ?? (due.dueDate ? localDay(due.dueDate, tz) : null);
  if (!key) return null;
  return daysBetweenKeys(todayIn(tz, now), key);
}

const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The due day for display: dueOn, or (older rows) dueDate's day in the creator's timezone */
export function dueDayOf(
  r: { dueOn?: Date | string | null; dueDate?: Date | string | null },
  creatorTz?: string | null
): DayKey | null {
  return dayKeyOf(r.dueOn ?? null) ?? (r.dueDate ? localDay(r.dueDate, safeTimeZone(creatorTz)) : null);
}

/** "Mon 3 Aug", with the year when it is not this year ("Mon 3 Aug 2027") */
export function formatDueDay(day: DayKey, now: Date = new Date()): string {
  const [y, m, d] = day.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const base = `${WEEKDAYS[wd]} ${d} ${MONTHS[m - 1]}`;
  return y === now.getUTCFullYear() ? base : `${base} ${y}`;
}

/** "August 3, 2026": emails and SMS */
export function formatDueLong(day: DayKey | null | undefined, fallback = "No due date"): string {
  if (!day) return fallback;
  const [y, m, d] = day.split("-").map(Number);
  return `${MONTHS_LONG[m - 1]} ${d}, ${y}`;
}

/** "Buenos Aires" from "America/Argentina/Buenos_Aires" */
export function timeZoneCity(tz: string | null | undefined): string {
  const t = safeTimeZone(tz);
  if (t === "UTC") return "UTC";
  return (t.split("/").pop() || t).replace(/_/g, " ");
}

/** "Ends 11:59 pm Jade's time (Buenos Aires)" */
export function dueEndsLine(creatorName: string | null | undefined, creatorTz: string | null | undefined): string {
  const first = (creatorName || "").trim().split(/\s+/)[0];
  const who = first ? `${first}’s time` : "the creator’s time";
  return `Ends 11:59 pm ${who} (${timeZoneCity(creatorTz)})`;
}

/** Creator timezone captured from a browser: valid IANA name, or null */
export function cleanBrowserTimeZone(tz: unknown): string | null {
  if (typeof tz !== "string" || !tz || tz.length > 64) return null;
  const safe = safeTimeZone(tz);
  return safe === tz ? tz : null;
}

/** A request's due day in the long form ("August 3, 2026"), for emails and SMS */
export function dueLong(
  r: { dueOn?: Date | string | null; dueDate?: Date | string | null },
  fallback = "No due date",
  creatorTz?: string | null
): string {
  return formatDueLong(dueDayOf(r, creatorTz), fallback);
}

/**
 * For screens that format a Date with date-fns: the due DAY as local midnight
 * in this browser, so `format(d, "MMM d")` prints the picked day anywhere.
 * Falls back to the deadline instant for rows without dueOn.
 */
export function dueDayDate(r: { dueOn?: Date | string | null; dueDate?: Date | string | null }): Date | null {
  const key = dayKeyOf(r.dueOn ?? null);
  if (key) {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return r.dueDate ? new Date(r.dueDate) : null;
}
