import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { Bell, CalendarDays, Flag, Sparkles, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { CalendarClient } from "./calendar-client";

// DATA FETCHING

async function getCreators(agencyId: string) {
  return db.creator.findMany({
    where: { agencyId },
    select: {
      id: true,
      name: true,
      email: true,
    },
    orderBy: { name: "asc" },
  });
}

async function getCalendarStats(agencyId: string) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday);
  endOfToday.setHours(23, 59, 59, 999);

  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  const [
    todayDeadlines,
    weekDeadlines,
    overdueRequests,
    pendingReminders,
  ] = await Promise.all([
    // Deadlines due today
    db.contentRequest.count({
      where: {
        agencyId,
        dueDate: {
          gte: startOfToday,
          lte: endOfToday,
        },
        status: {
          notIn: ["APPROVED", "CANCELLED", "ARCHIVED"],
        },
      },
    }),
    // Deadlines this week
    db.contentRequest.count({
      where: {
        agencyId,
        dueDate: {
          gte: startOfWeek,
          lte: endOfWeek,
        },
        status: {
          notIn: ["APPROVED", "CANCELLED", "ARCHIVED"],
        },
      },
    }),
    // Overdue requests
    db.contentRequest.count({
      where: {
        agencyId,
        dueDate: {
          lt: startOfToday,
        },
        status: {
          notIn: ["APPROVED", "CANCELLED", "ARCHIVED"],
        },
      },
    }),
    // Pending reminders
    db.reminder.count({
      where: {
        status: "PENDING",
        request: {
          agencyId,
        },
      },
    }),
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
  const session = await getServerSession(authOptions);

  if (!session?.user?.agencyId) {
    redirect("/login");
  }

  const agencyId = session.user.agencyId;

  let creators: Awaited<ReturnType<typeof getCreators>>;
  let stats: Awaited<ReturnType<typeof getCalendarStats>>;
  try {
    [creators, stats] = await Promise.all([
      getCreators(agencyId),
      getCalendarStats(agencyId),
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
          { n: stats.pendingReminders, label: "Reminders scheduled", Icon: Bell, late: false },
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
