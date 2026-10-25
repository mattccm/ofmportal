import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import { PageHead } from "@/components/creators/people-ui";
import { RemindersClient } from "./reminders-client";

// DATA FETCHING

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

// PAGE COMPONENT

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
    <div className="space-y-6">
      <PageHead
        title="Reminders"
        lede={
          <>
            {stats.pendingReminders
              ? `${stats.pendingReminders} ${stats.pendingReminders === 1 ? "reminder is" : "reminders are"} scheduled`
              : "Nothing is scheduled"}
            , {stats.sentReminders} sent
            {stats.failedReminders ? `, ${stats.failedReminders} failed to deliver` : ", none failed"}. When they go out and how they read is set in{" "}
            <Link href="/dashboard/settings/reminder-rules" className="underline decoration-ctl-hi underline-offset-[3px] hover:decoration-ink">
              Reminder rules
            </Link>
            .
          </>
        }
      />

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
