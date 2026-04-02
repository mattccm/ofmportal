import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { Bell, Clock, Settings, History, Sparkles } from "lucide-react";
import { RemindersClient } from "./reminders-client";

// ============================================
// DATA FETCHING
// ============================================

async function getReminderTemplates(agencyId: string) {
  return db.reminderConfig.findMany({
    where: { agencyId },
    orderBy: { updatedAt: "desc" },
  });
}

async function getReminders(agencyId: string) {
  return db.reminder.findMany({
    where: {
      request: {
        agencyId,
      },
    },
    include: {
      request: {
        select: {
          id: true,
          title: true,
          dueDate: true,
          status: true,
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
    orderBy: { scheduledAt: "desc" },
    take: 100,
  });
}

async function getReminderStats(agencyId: string) {
  const [
    totalTemplates,
    activeTemplates,
    pendingReminders,
    sentReminders,
    failedReminders,
  ] = await Promise.all([
    db.reminderConfig.count({ where: { agencyId } }),
    db.reminderConfig.count({ where: { agencyId, isActive: true } }),
    db.reminder.count({
      where: {
        status: "PENDING",
        request: { agencyId },
      },
    }),
    db.reminder.count({
      where: {
        status: "SENT",
        request: { agencyId },
      },
    }),
    db.reminder.count({
      where: {
        status: "FAILED",
        request: { agencyId },
      },
    }),
  ]);

  return {
    totalTemplates,
    activeTemplates,
    pendingReminders,
    sentReminders,
    failedReminders,
  };
}

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

async function getAgencySettings(agencyId: string) {
  const agency = await db.agency.findUnique({
    where: { id: agencyId },
    select: {
      settings: true,
    },
  });
  return agency?.settings || {};
}

// ============================================
// PAGE COMPONENT
// ============================================

export default async function RemindersPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.agencyId) {
    redirect("/login");
  }

  const agencyId = session.user.agencyId;

  let rawTemplates: Awaited<ReturnType<typeof getReminderTemplates>>;
  let rawReminders: Awaited<ReturnType<typeof getReminders>>;
  let stats: Awaited<ReturnType<typeof getReminderStats>>;
  let creators: Awaited<ReturnType<typeof getCreators>>;
  let agencySettings: Awaited<ReturnType<typeof getAgencySettings>>;
  try {
    [rawTemplates, rawReminders, stats, creators, agencySettings] = await Promise.all([
      getReminderTemplates(agencyId),
      getReminders(agencyId),
      getReminderStats(agencyId),
      getCreators(agencyId),
      getAgencySettings(agencyId),
    ]);
  } catch (error) {
    console.error("Failed to fetch reminders data:", error);
    rawTemplates = [];
    rawReminders = [];
    stats = { totalTemplates: 0, activeTemplates: 0, pendingReminders: 0, sentReminders: 0, failedReminders: 0 };
    creators = [];
    agencySettings = {};
  }

  // Serialize dates for client component
  const templates = rawTemplates.map((t) => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));

  const reminders = rawReminders.map((r) => ({
    ...r,
    scheduledAt: r.scheduledAt.toISOString(),
    sentAt: r.sentAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    request: {
      ...r.request,
      dueDate: r.request.dueDate?.toISOString() ?? null,
    },
  }));

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Sparkles className="h-4 w-4" />
            <span>Notification Center</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Reminders Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure reminder templates, view scheduled reminders, and manage notification settings
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Settings className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.activeTemplates}</p>
              <p className="text-sm text-muted-foreground">Active Templates</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Clock className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.pendingReminders}</p>
              <p className="text-sm text-muted-foreground">Pending Reminders</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Bell className="h-6 w-6 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.sentReminders}</p>
              <p className="text-sm text-muted-foreground">Sent Reminders</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-red-500/10 flex items-center justify-center">
              <History className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.failedReminders}</p>
              <p className="text-sm text-muted-foreground">Failed Deliveries</p>
            </div>
          </div>
        </div>
      </div>

      {/* Client Component with Tabs */}
      <RemindersClient
        initialTemplates={templates}
        initialReminders={reminders}
        creators={creators}
        agencySettings={agencySettings as Record<string, unknown>}
      />
    </div>
  );
}
