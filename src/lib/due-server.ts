/**
 * Server side of the due-date rule (see src/lib/due.ts): look up creator
 * timezones for writes, and re-anchor deadlines when a creator's timezone
 * changes so their due DAY stays the same.
 */
import { db } from "@/lib/db";
import { reanchorDue, localDay, dayKeyToDate, safeTimeZone, cleanBrowserTimeZone } from "@/lib/due";

/** Requests that are still open: their deadline follows the creator's timezone */
export const OPEN_REQUEST_STATUSES = [
  "DRAFT",
  "PENDING",
  "IN_PROGRESS",
  "SUBMITTED",
  "UNDER_REVIEW",
  "NEEDS_REVISION",
] as const;

const REMINDABLE = new Set<string>(["PENDING", "IN_PROGRESS", "NEEDS_REVISION"]);

/** creatorId → timezone (valid IANA name, "UTC" when unknown) */
export async function creatorTimeZones(creatorIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(creatorIds)].filter(Boolean);
  if (ids.length === 0) return new Map();
  const rows = await db.creator.findMany({ where: { id: { in: ids } }, select: { id: true, timezone: true } });
  return new Map(rows.map((r) => [r.id, safeTimeZone(r.timezone)]));
}

/** The picker's (staff member's) timezone, for reading legacy ISO due values */
export async function staffTimeZone(userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  const u = await db.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  return u?.timezone ? safeTimeZone(u.timezone) : null;
}

/**
 * A creator's timezone changed: move every open request's deadline to 23:59:59
 * on the same due day in the new timezone, then reschedule its reminders.
 * Rows from before dueOn existed get their day from the old timezone first.
 */
export async function reanchorCreatorDueDates(
  creatorId: string,
  newTz: string,
  oldTz?: string | null
): Promise<number> {
  const tz = safeTimeZone(newTz);
  const open = await db.contentRequest.findMany({
    where: {
      creatorId,
      status: { in: [...OPEN_REQUEST_STATUSES] },
      OR: [{ dueOn: { not: null } }, { dueDate: { not: null } }],
    },
    select: { id: true, status: true, dueOn: true, dueDate: true },
  });
  const moved: string[] = [];
  let updated = 0;
  for (const r of open) {
    const dueOn = r.dueOn ?? (r.dueDate ? dayKeyToDate(localDay(r.dueDate, safeTimeZone(oldTz))) : null);
    if (!dueOn) continue;
    const dueDate = reanchorDue(dueOn, tz);
    if (r.dueOn && r.dueDate && r.dueDate.getTime() === dueDate.getTime()) continue;
    await db.contentRequest.update({ where: { id: r.id }, data: { dueOn, dueDate } });
    updated++;
    if (REMINDABLE.has(r.status)) moved.push(r.id);
  }
  if (moved.length > 0) {
    // Reminders are scheduled from the deadline: move them with it
    const { rescheduleReminders } = await import("@/lib/auto-reminder-scheduler");
    for (const id of moved) {
      try {
        await rescheduleReminders(id);
      } catch (e) {
        console.error(`Failed to reschedule reminders for ${id}:`, e);
      }
    }
  }
  return updated;
}

/** The schema default: a creator still on it has never had a time zone set */
export const DEFAULT_CREATOR_TIMEZONE = "America/New_York";

/**
 * A creator's browser reported its time zone. Saved only while the creator is
 * still on the schema default (never over one the team or the creator chose),
 * and their open deadlines move to the end of the same days there.
 * Returns the creator's time zone after the call.
 */
export async function captureCreatorTimeZone(creatorId: string, browserTz: unknown): Promise<string | null> {
  const creator = await db.creator.findUnique({ where: { id: creatorId }, select: { timezone: true } });
  if (!creator) return null;
  const tz = cleanBrowserTimeZone(browserTz);
  if (!tz || creator.timezone !== DEFAULT_CREATOR_TIMEZONE || tz === creator.timezone) return creator.timezone;
  const updated = await db.creator.updateMany({
    where: { id: creatorId, timezone: DEFAULT_CREATOR_TIMEZONE },
    data: { timezone: tz },
  });
  if (updated.count === 1) await reanchorCreatorDueDates(creatorId, tz, DEFAULT_CREATOR_TIMEZONE);
  return tz;
}
