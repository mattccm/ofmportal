import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { creatorWhere, getPageAccess, requestWhere } from "@/lib/access/server";
import { NoAccess } from "@/components/access/no-access";
import { Bell, CalendarDays, Flag, Sparkles, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { CalendarClient } from "./calendar-client";
import { addDaysToKey, dayKeyToDate, todayIn } from "@/lib/due";
import { staffTimeZone } from "@/lib/due-server";

// DATA FETCHING

// Creators in this person's scope, for the filter: name only
async function getCreators(where: Prisma.CreatorWhereInput) {
  return db.creator.findMany({
    where,
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: "asc" },
  });
}

// Counts cover only requests whose creator is in this person's scope.
// "Today" and "this week" are due DAYS in the viewer's own calendar.
async function getCalendarStats(scope: Prisma.ContentRequestWhereInput, withReminders: boolean, tz: string) {
  const now = new Date();
  const today = todayIn(tz, now);
  const [y, m, d] = today.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const startOfWeek = addDaysToKey(today, -weekday);
  const endOfWeek = addDaysToKey(startOfWeek, 6);

  const [
    todayDeadlines,
    weekDeadlines,
    overdueRequests,
    pendingReminders,
  ] = await Promise.all([
    // Deadlines due today
    db.contentRequest.count({
      where: {
        ...scope,
        dueOn: dayKeyToDate(today),
        status: {
          notIn: ["APPROVED", "CANCELLED", "ARCHIVED"],
        },
      },
    }),
    // Deadlines this week
    db.contentRequest.count({
      where: {
        ...scope,
        dueOn: {
          gte: dayKeyToDate(startOfWeek),
          lte: dayKeyToDate(endOfWeek),
        },
        status: {
          notIn: ["APPROVED", "CANCELLED", "ARCHIVED"],
        },
      },
    }),
    // Overdue requests
    db.contentRequest.count({
      where: {
        ...scope,
        // Past the creator's end of the due day
        dueDate: {
          lt: now,
        },
        status: {
          notIn: ["APPROVED", "CANCELLED", "ARCHIVED"],
        },
      },
    }),
    // Pending reminders
    withReminders
      ? db.reminder.count({
          where: {
            status: "PENDING",
            request: scope,
          },
        })
      : Promise.resolve(0),
  ]);

  return {
    todayDeadlines,
    weekDeadlines,
    overdueRequests,
    pendingReminders,
  };
}

// PAGE COMPONENT

export default async function CalendarPage() {
  const access = await getPageAccess();
  if (!access.has("calendar.view")) return <NoAccess what="the calendar" roleName={access.role.name} />;
  const seesReminders = access.has("reminders.view");

  let creators: Awaited<ReturnType<typeof getCreators>>;
  let stats: Awaited<ReturnType<typeof getCalendarStats>>;
  try {
    [creators, stats] = await Promise.all([
      getCreators(creatorWhere(access)),
      getCalendarStats(requestWhere(access), seesReminders, (await staffTimeZone(access.userId)) ?? "UTC"),
    ]);
  } catch (error) {
    console.error("Failed to fetch calendar data:", error);
    creators = [];
    stats = { todayDeadlines: 0, weekDeadlines: 0, overdueRequests: 0, pendingReminders: 0 };
  }

  return (
    <div className="h-full flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Sparkles className="h-4 w-4" />
            <span>Content Planning</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Calendar
          </h1>
          <p className="text-muted-foreground mt-1">
            View and manage requests, deadlines, and reminders in one place
          </p>
        </div>
      </div>

      {/* Counts: neutral tiles with the calendar's own icons; only overdue takes its state colour */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4 mb-6">
        {[
          { n: stats.todayDeadlines, label: "Due today", Icon: Flag, late: false },
          { n: stats.weekDeadlines, label: "Due this week", Icon: CalendarDays, late: false },
          { n: stats.overdueRequests, label: "Overdue", Icon: TriangleAlert, late: stats.overdueRequests > 0 },
          ...(seesReminders ? [{ n: stats.pendingReminders, label: "Reminders scheduled", Icon: Bell, late: false }] : []),
        ].map(({ n, label, Icon, late }) => (
          <div key={label} className="rounded-xl bg-tile p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-tile-hi">
                <Icon aria-hidden="true" className={cn("h-5 w-5", late ? "text-late" : "text-ink-2")} />
              </div>
              <div className="min-w-0">
                <p className={cn("text-[22px] font-bold leading-tight tabular-nums", late && "text-late")}>{n}</p>
                <p className="text-[14px] text-ink-2">{label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Calendar Client Component */}
      <CalendarClient creators={creators} />
    </div>
  );
}
