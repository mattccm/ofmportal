import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { snapshotFromTemplate } from "@/lib/messaging";
import { deliver } from "@/lib/messaging-server";
import { dueInDays, dayKeyOf, formatDueLong } from "@/lib/due";
import { sendContentRequestEmail } from "@/lib/email";
import { sendContentRequestSms } from "@/lib/sms";
import { scheduleRemindersForRequest } from "@/lib/auto-reminder-scheduler";
import { getAppUrl } from "@/lib/app-url";
import {
  calculateNextRunDate,
  formatTitleTemplate,
  type RequestSettings,
} from "@/types/recurring-requests";
import { resolveTemplateIds } from "./template-ids";

// Template fields may be stored as a JSON string; always return an array
function parseTemplateFields(raw: unknown): unknown[] {
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return Array.isArray(raw) ? raw : [];
}

export interface ExecuteRecurringRequestResult {
  status: number;
  body: Record<string, unknown>;
}

/**
 * Title for one request of a run. `{template}` is replaced with the template's
 * name; when a run sends several templates and the title pattern doesn't say
 * which, the template name is appended so each request reads differently.
 */
export function recurringRequestTitle(
  titleTemplate: string,
  templateName: string,
  templateCount: number,
  date: Date,
  creatorName: string
): string {
  const pattern = titleTemplate?.trim() ? titleTemplate : "{template}";
  const hasToken = pattern.includes("{template}");
  const base = formatTitleTemplate(pattern.replace(/{template}/g, templateName), date, creatorName);
  return !hasToken && templateCount > 1 ? `${base} · ${templateName}` : base;
}

/**
 * Run a recurring request once: create one request per template per target
 * creator, notify each creator once for the run, record the execution and
 * advance nextRunAt. Shared by the manual
 * "Run now" route and the recurring-requests cron.
 *
 * `actorUserId` is the user to attribute the activity log to (the session user
 * for a manual run; the cron passes null).
 */
export async function executeRecurringRequest(
  recurringRequestId: string,
  agencyId: string,
  options: { actorUserId?: string | null; agencyName?: string } = {}
): Promise<ExecuteRecurringRequestResult> {
  const id = recurringRequestId;

  // Get the recurring request
  const recurringRequest = await db.recurringRequest.findFirst({
    where: {
      id,
      agencyId,
    },
  });

  if (!recurringRequest) {
    return { status: 404, body: { error: "Recurring request not found" } };
  }

  // Get templates, in the schedule's order. A template deleted since the
  // schedule was saved is skipped; the run fails only when none is left.
  const templateIds = resolveTemplateIds(recurringRequest);
  const templateRows = await db.requestTemplate.findMany({
    where: {
      id: { in: templateIds },
      agencyId,
    },
  });
  const templateById = new Map(templateRows.map((t) => [t.id, t]));
  const templates = templateIds
    .map((tid) => templateById.get(tid))
    .filter((t): t is NonNullable<typeof t> => !!t);

  if (templates.length === 0) {
    return { status: 404, body: { error: "Template not found" } };
  }

  // Resolve all creator IDs (direct + from groups)
  const directCreatorIds = recurringRequest.creatorIds as string[];
  const groupIds = recurringRequest.creatorGroupIds as string[];

  let allCreatorIds: string[] = [...directCreatorIds];

  if (groupIds.length > 0) {
    const groupMembers = await db.creatorGroupMember.findMany({
      where: { groupId: { in: groupIds } },
      select: { creatorId: true },
    });
    const groupCreatorIds = groupMembers.map((m) => m.creatorId);
    allCreatorIds = [...new Set([...allCreatorIds, ...groupCreatorIds])];
  }

  if (allCreatorIds.length === 0) {
    return {
      status: 400,
      body: { error: "No creators found for this recurring request" },
    };
  }

  let agencyName = options.agencyName;
  if (agencyName === undefined) {
    const agency = await db.agency.findUnique({
      where: { id: agencyId },
      select: { name: true },
    });
    agencyName = agency?.name || "";
  }

  // Get creators. Archived creators are skipped so an archived creator never
  // receives auto-generated requests, even if still listed on the schedule.
  const creators = await db.creator.findMany({
    where: {
      id: { in: allCreatorIds },
      agencyId,
      archivedAt: null,
    },
    select: { id: true, name: true, email: true, phone: true, preferredContact: true, timezone: true },
  });

  // Create execution record
  const execution = await db.recurringRequestExecution.create({
    data: {
      recurringRequestId: id,
      scheduledFor: new Date(),
      status: "RUNNING",
      creatorCount: creators.length,
    },
  });

  const requestSettings = recurringRequest.requestSettings as unknown as RequestSettings;
  const now = new Date();
  const createdRequestIds: string[] = [];
  let successCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  // One request per template per creator. Every request of a run shares the
  // schedule's due date (dueInDays), falling back to each template's own
  // default when the schedule has none.
  for (const creator of creators) {
    const created: { id: string; title: string; dueDate: Date; dueDay: string; messaging: unknown }[] = [];

    for (const template of templates) {
      try {
        const title = recurringRequestTitle(
          requestSettings.titleTemplate,
          template.name,
          templates.length,
          now,
          creator.name
        );
        // N calendar days from today in the creator's timezone, due at the end of that day
        const due = dueInDays(requestSettings.dueInDays || template.defaultDueDays || 7, creator.timezone, now);
        const dueDate = due.dueDate;

        // Snapshot of the template's messaging plan
        const messaging = snapshotFromTemplate(template);
        const request = await db.contentRequest.create({
          data: {
            agencyId,
            creatorId: creator.id,
            templateId: template.id,
            title,
            description: requestSettings.description || template.description || null,
            dueOn: due.dueOn,
            dueDate,
            urgency: requestSettings.urgency || template.defaultUrgency || "NORMAL",
            status: "PENDING",
            messaging: (messaging as Prisma.InputJsonValue | null) ?? Prisma.DbNull,
            requirements: {},
            fields: parseTemplateFields(template.fields) as Prisma.InputJsonValue,
          },
        });

        createdRequestIds.push(request.id);
        created.push({ id: request.id, title, dueDate, dueDay: dayKeyOf(due.dueOn)!, messaging });
        successCount++;

        // Schedule auto-reminders like a normal new request
        try {
          await scheduleRemindersForRequest(request.id);
        } catch (error) {
          console.error("Failed to schedule auto-reminders:", error);
        }
      } catch (error) {
        failedCount++;
        errors.push(`Failed to create ${template.name} for ${creator.name}: ${error}`);
        console.error(`Failed to create request for creator ${creator.id} (template ${template.id}):`, error);
      }
    }

    // Notify once per creator for the whole run, if enabled. Creators have no
    // User row, so this is email/SMS. Failures are logged and never count
    // against the created requests. With several requests the link opens the
    // creator's request list rather than one request.
    if (requestSettings.autoSendNotification && created.length > 0) {
      const portalLink =
        created.length === 1
          ? `${getAppUrl()}/creator/requests/${created[0].id}`
          : `${getAppUrl()}/creator/requests`;
      const firstDue = created.reduce((d, r) => (r.dueDate < d.dueDate ? r : d), created[0]).dueDay;
      const requestTitle =
        created.length === 1
          ? created[0].title
          : `${created.length} requests: ${created.map((r) => r.title).join(", ")}`;
      // One message for the run, planned from the first request's plan
      await deliver(
        "request.new",
        { agencyId, creator, request: { messaging: created[0].messaging } },
        {
          email: () =>
            sendContentRequestEmail({
              to: creator.email,
              creatorName: creator.name,
              agencyName,
              requestTitle,
              dueDate: formatDueLong(firstDue),
              portalLink,
              agencyId,
              requestCount: created.length,
            }),
          sms: (to) =>
            sendContentRequestSms({
              to,
              creatorName: creator.name,
              portalLink,
            }),
        }
      );
    }
  }

  // Update execution status
  const executionStatus =
    failedCount === 0
      ? "COMPLETED"
      : successCount === 0
      ? "FAILED"
      : "PARTIAL";

  await db.recurringRequestExecution.update({
    where: { id: execution.id },
    data: {
      executedAt: new Date(),
      status: executionStatus,
      createdRequestIds,
      successCount,
      failedCount,
      error: errors.length > 0 ? errors.join("; ") : null,
    },
  });

  // Calculate next run date
  const nextRunAt = computeNextRunAt(recurringRequest, now, recurringRequest.runCount + 1);

  // Update recurring request
  await db.recurringRequest.update({
    where: { id },
    data: {
      lastRunAt: now,
      nextRunAt: nextRunAt,
      runCount: { increment: 1 },
      lastError: errors.length > 0 ? errors[0] : null,
      // Deactivate if no more runs scheduled
      isActive: nextRunAt !== null,
    },
  });

  // Log activity
  await db.activityLog.create({
    data: {
      userId: options.actorUserId ?? null,
      action: "recurring_request.executed",
      entityType: "RecurringRequest",
      entityId: id,
      metadata: {
        name: recurringRequest.name,
        creatorCount: creators.length,
        templateIds: templates.map((t) => t.id),
        successCount,
        failedCount,
        requestIds: createdRequestIds,
      },
    },
  });

  return {
    status: 200,
    body: {
      success: executionStatus !== "FAILED",
      executionId: execution.id,
      status: executionStatus,
      createdRequestIds,
      creatorCount: creators.length,
      successCount,
      failedCount,
      errors: errors.length > 0 ? errors : undefined,
      nextRunAt,
    },
  };
}

/**
 * Next run after `from`, at the schedule's time of day. Null when the schedule
 * has ended (endDate or maxOccurrences reached).
 */
export function computeNextRunAt(
  recurringRequest: {
    frequency: string;
    timeOfDay: string;
    dayOfWeek: number | null;
    dayOfMonth: number | null;
    endDate: Date | null;
    maxOccurrences: number | null;
  },
  from: Date,
  runCountAfterThisRun: number
): Date | null {
  const [hours, minutes] = recurringRequest.timeOfDay.split(":").map(Number);
  const nextRunAt = calculateNextRunDate(
    recurringRequest.frequency as "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "QUARTERLY",
    from,
    recurringRequest.dayOfWeek ?? undefined,
    recurringRequest.dayOfMonth || undefined,
    recurringRequest.endDate || undefined,
    recurringRequest.maxOccurrences || undefined,
    runCountAfterThisRun
  );

  if (nextRunAt) {
    nextRunAt.setHours(hours, minutes, 0, 0);
  }

  return nextRunAt;
}
