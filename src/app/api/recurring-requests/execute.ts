import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { addDays, format } from "date-fns";
import { sendContentRequestEmail } from "@/lib/email";
import { sendContentRequestSms } from "@/lib/sms";
import { scheduleRemindersForRequest } from "@/lib/auto-reminder-scheduler";
import { getAppUrl } from "@/lib/app-url";
import {
  calculateNextRunDate,
  formatTitleTemplate,
  type RequestSettings,
} from "@/types/recurring-requests";

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
 * Run a recurring request once: create a request per target creator, notify
 * them, record the execution and advance nextRunAt. Shared by the manual
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

  // Get template
  const template = await db.requestTemplate.findFirst({
    where: {
      id: recurringRequest.templateId,
      agencyId,
    },
  });

  if (!template) {
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
    select: { id: true, name: true, email: true, phone: true, preferredContact: true },
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
  const dueDate = addDays(now, requestSettings.dueInDays || 7);
  const createdRequestIds: string[] = [];
  let successCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  // Create requests for each creator
  for (const creator of creators) {
    try {
      // Format title with variables
      const title = formatTitleTemplate(
        requestSettings.titleTemplate,
        now,
        creator.name
      );

      // Create the request
      const request = await db.contentRequest.create({
        data: {
          agencyId,
          creatorId: creator.id,
          templateId: template.id,
          title,
          description: requestSettings.description || template.description || null,
          dueDate,
          urgency: requestSettings.urgency || "NORMAL",
          status: "PENDING",
          requirements: {},
          fields: parseTemplateFields(template.fields) as Prisma.InputJsonValue,
        },
      });

      createdRequestIds.push(request.id);
      successCount++;

      // Schedule auto-reminders like a normal new request
      try {
        await scheduleRemindersForRequest(request.id);
      } catch (error) {
        console.error("Failed to schedule auto-reminders:", error);
      }

      // Send notification if enabled
      // Creators have no User row, so notify them by email/SMS. Failures are
      // logged and never count against the created request.
      if (requestSettings.autoSendNotification) {
        const portalLink = `${getAppUrl()}/creator/requests/${request.id}`;
        try {
          await sendContentRequestEmail({
            to: creator.email,
            creatorName: creator.name,
            agencyName,
            requestTitle: title,
            dueDate: format(dueDate, "MMMM d, yyyy"),
            portalLink,
          });
        } catch (error) {
          console.error("Failed to send recurring request email:", error);
        }

        if (creator.phone && (creator.preferredContact === "SMS" || creator.preferredContact === "BOTH")) {
          try {
            await sendContentRequestSms({
              to: creator.phone,
              creatorName: creator.name,
              requestTitle: title,
              portalLink,
            });
          } catch (error) {
            console.error("Failed to send recurring request SMS:", error);
          }
        }
      }
    } catch (error) {
      failedCount++;
      errors.push(`Failed to create request for ${creator.name}: ${error}`);
      console.error(`Failed to create request for creator ${creator.id}:`, error);
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
