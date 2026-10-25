import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { creatorWhere, getPageAccess, redactCreatorsIn, requestWhere } from "@/lib/access/server";
import { NoAccess } from "@/components/access/no-access";
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

// `scope`: requests whose creator is in this person's creator scope
async function getReminders(scope: Prisma.ContentRequestWhereInput) {
  return db.reminder.findMany({
    where: {
      request: scope,
    },
    include: {
      request: {
        select: {
          id: true,
          title: true,
          dueDate: true,
          status: true,
          // Name only: the page never shows a creator's contact details
          creator: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: { scheduledAt: "desc" },
    take: 100,
  });
}

async function getReminderStats(agencyId: string, scope: Prisma.ContentRequestWhereInput) {
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
        request: scope,
      },
    }),
    db.reminder.count({
      where: {
        status: "SENT",
        request: scope,
      },
    }),
    db.reminder.count({
      where: {
        status: "FAILED",
        request: scope,
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

// For the creator filter: name only, creators in scope
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
  const access = await getPageAccess();
  if (!access.has("reminders.view")) return <NoAccess what="reminders" roleName={access.role.name} />;
  const agencyId = access.agencyId;
  const scope = requestWhere(access);

  let rawTemplates: Awaited<ReturnType<typeof getReminderTemplates>>;
  let rawReminders: Awaited<ReturnType<typeof getReminders>>;
  let stats: Awaited<ReturnType<typeof getReminderStats>>;
  let creators: Awaited<ReturnType<typeof getCreators>>;
  let agencySettings: Awaited<ReturnType<typeof getAgencySettings>>;
  try {
    [rawTemplates, rawReminders, stats, creators, agencySettings] = await Promise.all([
      getReminderTemplates(agencyId),
      getReminders(scope),
      getReminderStats(agencyId, scope),
      getCreators(creatorWhere(access)),
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

  const reminders = redactCreatorsIn(access, rawReminders).map((r) => ({
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
            {stats.failedReminders ? `, ${stats.failedReminders} failed to deliver` : ", none failed"}.
            {access.has("reminders.rules") && (
              <>
                {" "}When they go out and how they read is set in{" "}
                <Link href="/dashboard/settings/reminder-rules" className="underline decoration-ctl-hi underline-offset-[3px] hover:decoration-ink">
                  Reminder rules
                </Link>
                .
              </>
            )}
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
