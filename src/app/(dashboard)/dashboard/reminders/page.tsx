import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { creatorWhere, getPageAccess, redactCreatorsIn, requestWhere } from "@/lib/access/server";
import { loadAgencyMessaging } from "@/lib/messaging-server";
import { NoAccess } from "@/components/access/no-access";
import { PageHead } from "@/components/creators/people-ui";
import { RemindersClient, type ReminderTab } from "./reminders-client";

// One place for everything creators receive: what is scheduled, what went
// out, when reminders go, which messages are texted, and the text setup.

// `scope`: requests whose creator is in this person's creator scope
async function getReminders(scope: Prisma.ContentRequestWhereInput) {
  return db.reminder.findMany({
    where: { request: scope },
    select: {
      id: true,
      requestId: true,
      type: true,
      channel: true,
      scheduledAt: true,
      sentAt: true,
      status: true,
      error: true,
      request: {
        select: {
          id: true,
          title: true,
          // Name only: the page never shows a creator's contact details
          creator: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { scheduledAt: "desc" },
    take: 100,
  });
}

async function getStats(scope: Prisma.ContentRequestWhereInput) {
  const [pending, sent, failed] = await Promise.all([
    db.reminder.count({ where: { status: "PENDING", request: scope } }),
    db.reminder.count({ where: { status: "SENT", request: scope } }),
    db.reminder.count({ where: { status: "FAILED", request: scope } }),
  ]);
  return { pending, sent, failed };
}

export default async function RemindersPage() {
  const access = await getPageAccess();
  if (!access.has("reminders.view")) return <NoAccess what="reminders" roleName={access.role.name} />;
  const agencyId = access.agencyId;
  const scope = requestWhere(access);

  const tabs: ReminderTab[] = ["scheduled", "sent"];
  if (access.has("reminders.rules")) tabs.push("timing", "texts");
  if (access.has("settings.sms")) tabs.push("setup");

  const [rawReminders, stats, creators, messaging, templates] = await Promise.all([
    getReminders(scope).catch(() => []),
    getStats(scope).catch(() => ({ pending: 0, sent: 0, failed: 0 })),
    db.creator.findMany({ where: creatorWhere(access), select: { id: true, name: true }, orderBy: { name: "asc" } }).catch(() => []),
    loadAgencyMessaging(agencyId, { fresh: true }),
    tabs.includes("texts")
      ? db.requestTemplate
          .findMany({ where: { agencyId, isActive: true }, select: { id: true, name: true, messaging: true }, orderBy: { name: "asc" } })
          .catch(() => [])
      : Promise.resolve([]),
  ]);

  const reminders = redactCreatorsIn(access, rawReminders).map((r) => ({
    ...r,
    scheduledAt: r.scheduledAt.toISOString(),
    sentAt: r.sentAt?.toISOString() ?? null,
  }));

  return (
    <div className="space-y-6">
      <PageHead
        title="Reminders"
        lede={
          <>
            {stats.pending
              ? `${stats.pending} ${stats.pending === 1 ? "reminder is" : "reminders are"} scheduled`
              : "Nothing is scheduled"}
            , {stats.sent} sent
            {stats.failed ? `, ${stats.failed} failed to deliver` : ", none failed"}.
            {tabs.includes("texts") && " Timing, emails and texts are all set here."}
          </>
        }
      />
      <RemindersClient initialReminders={reminders} creators={creators} tabs={tabs} messaging={messaging} templates={templates} />
    </div>
  );
}
