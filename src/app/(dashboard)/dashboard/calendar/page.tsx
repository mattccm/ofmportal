import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { CalendarDays, Sparkles } from "lucide-react";
import { CalendarClient } from "./calendar-client";

// ============================================
// DATA FETCHING
// ============================================

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

// ============================================
// PAGE COMPONENT
// ============================================

export default async function CalendarPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.agencyId) {
    redirect("/login");
  }

  const agencyId = session.user.agencyId;

  let creators, stats;
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

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <CalendarDays className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.todayDeadlines}</p>
              <p className="text-sm text-muted-foreground">Due Today</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <CalendarDays className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.weekDeadlines}</p>
              <p className="text-sm text-muted-foreground">This Week</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-red-500/10 flex items-center justify-center">
              <CalendarDays className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.overdueRequests}</p>
              <p className="text-sm text-muted-foreground">Overdue</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <CalendarDays className="h-6 w-6 text-violet-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.pendingReminders}</p>
              <p className="text-sm text-muted-foreground">Reminders</p>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar Client Component */}
      <CalendarClient creators={creators} />
    </div>
  );
}
