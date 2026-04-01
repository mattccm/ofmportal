import { db } from "./db";
import { addDays, startOfDay, differenceInDays, format, setHours, setMinutes, isWithinInterval, addHours, differenceInHours } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import type { Urgency, OverdueFrequency, NotificationChannel, ReminderTone } from "@prisma/client";

// ============================================
// TYPES
// ============================================

export interface ReminderScheduleConfig {
  reminderDays: number[];
  overdueReminderFrequency: OverdueFrequency;
  maxOverdueReminders: number;
  smsEscalationDays: number | null;
  escalateToSms: boolean;
  // Custom message templates
  customEmailSubject?: string | null;
  customEmailBody?: string | null;
  customSmsBody?: string | null;
  reminderTone?: ReminderTone;
}

export interface QuietHoursConfig {
  enabled: boolean;
  start: string; // HH:mm format
  end: string;   // HH:mm format
  timezone: string;
}

export interface PauseConfig {
  isPaused: boolean;
  pausedAt?: Date | null;
  pauseResumeAt?: Date | null;
  pauseReason?: string | null;
}

export interface ScheduledReminderPreview {
  scheduledAt: Date;
  type: "UPCOMING" | "DUE_TODAY" | "OVERDUE" | "ESCALATION";
  channel: NotificationChannel;
  daysFromDue: number;
  isEscalation: boolean;
  adjustedForQuietHours?: boolean;
  originalScheduledAt?: Date;
}

export interface ReminderScheduleResult {
  requestId: string;
  creatorId: string;
  remindersCreated: number;
  reminders: ScheduledReminderPreview[];
  config: {
    source: "creator_override" | "urgency_rule" | "default";
    ruleId?: string;
    overrideId?: string;
  };
  pauseInfo?: PauseConfig;
  quietHours?: QuietHoursConfig;
}

export interface BatchedReminderGroup {
  creatorId: string;
  creatorEmail: string;
  creatorPhone?: string | null;
  creatorName: string;
  creatorTimezone: string;
  requests: Array<{
    id: string;
    title: string;
    dueDate: Date | null;
    daysFromDue: number;
    urgency: Urgency;
  }>;
  channel: NotificationChannel;
  scheduledAt: Date;
}

// Default configuration when no rules exist
const DEFAULT_REMINDER_CONFIG: ReminderScheduleConfig = {
  reminderDays: [3, 1, 0],
  overdueReminderFrequency: "DAILY",
  maxOverdueReminders: 5,
  smsEscalationDays: null,
  escalateToSms: false,
  reminderTone: "NORMAL",
};

// Default quiet hours configuration
const DEFAULT_QUIET_HOURS: QuietHoursConfig = {
  enabled: true,
  start: "22:00", // 10 PM
  end: "08:00",   // 8 AM
  timezone: "America/New_York",
};

// ============================================
// CONFIGURATION RESOLUTION
// ============================================

/**
 * Get reminder configuration for a specific creator and urgency level
 * Priority: Creator Override > Urgency Rule > Default
 */
export async function getReminderConfig(
  agencyId: string,
  creatorId: string,
  urgency: Urgency
): Promise<{
  config: ReminderScheduleConfig;
  source: "creator_override" | "urgency_rule" | "default";
  ruleId?: string;
  overrideId?: string;
  disableReminders?: boolean;
  pauseInfo?: PauseConfig;
  quietHours?: QuietHoursConfig;
}> {
  // 1. Check for creator-specific override
  const creatorOverride = await db.creatorReminderOverride.findUnique({
    where: {
      agencyId_creatorId: {
        agencyId,
        creatorId,
      },
    },
  });

  if (creatorOverride) {
    // If reminders are disabled for this creator, return early
    if (creatorOverride.disableReminders) {
      return {
        config: DEFAULT_REMINDER_CONFIG,
        source: "creator_override",
        overrideId: creatorOverride.id,
        disableReminders: true,
      };
    }

    // If custom settings are enabled, use them
    if (creatorOverride.useCustomSettings) {
      return {
        config: {
          reminderDays: creatorOverride.reminderDays,
          overdueReminderFrequency: creatorOverride.overdueReminderFrequency,
          maxOverdueReminders: creatorOverride.maxOverdueReminders,
          smsEscalationDays: creatorOverride.smsEscalationDays,
          escalateToSms: creatorOverride.escalateToSms,
        },
        source: "creator_override",
        overrideId: creatorOverride.id,
      };
    }
  }

  // 2. Check for urgency-based rule
  const urgencyRule = await db.reminderRule.findFirst({
    where: {
      agencyId,
      urgency,
      isActive: true,
    },
  });

  if (urgencyRule) {
    return {
      config: {
        reminderDays: urgencyRule.reminderDays,
        overdueReminderFrequency: urgencyRule.overdueReminderFrequency,
        maxOverdueReminders: urgencyRule.maxOverdueReminders,
        smsEscalationDays: urgencyRule.smsEscalationDays,
        escalateToSms: urgencyRule.escalateToSms,
      },
      source: "urgency_rule",
      ruleId: urgencyRule.id,
    };
  }

  // 3. Return default configuration
  return {
    config: DEFAULT_REMINDER_CONFIG,
    source: "default",
  };
}

// ============================================
// REMINDER SCHEDULE CALCULATION
// ============================================

/**
 * Calculate all reminder dates for a request based on its due date
 * Returns a preview of reminders without creating them
 */
export function calculateReminderSchedule(
  dueDate: Date,
  config: ReminderScheduleConfig,
  preferredChannel: NotificationChannel = "EMAIL"
): ScheduledReminderPreview[] {
  const reminders: ScheduledReminderPreview[] = [];
  const today = startOfDay(new Date());
  const dueDateStart = startOfDay(dueDate);

  // Sort reminder days in descending order (furthest from due date first)
  const sortedReminderDays = [...config.reminderDays].sort((a, b) => b - a);

  // Add pre-due-date reminders
  for (const daysBefore of sortedReminderDays) {
    const reminderDate = addDays(dueDateStart, -daysBefore);

    // Only add if the reminder date is in the future or today
    if (reminderDate >= today) {
      const type = daysBefore === 0 ? "DUE_TODAY" : "UPCOMING";
      reminders.push({
        scheduledAt: reminderDate,
        type,
        channel: preferredChannel,
        daysFromDue: -daysBefore,
        isEscalation: false,
      });
    }
  }

  // Add overdue reminders based on frequency
  if (config.overdueReminderFrequency !== "NONE") {
    const overdueInterval = getOverdueInterval(config.overdueReminderFrequency);

    for (let i = 1; i <= config.maxOverdueReminders; i++) {
      const daysOverdue = overdueInterval * i;
      const reminderDate = addDays(dueDateStart, daysOverdue);

      // Only add future reminders
      if (reminderDate >= today) {
        const isEscalation =
          config.escalateToSms &&
          config.smsEscalationDays !== null &&
          daysOverdue >= config.smsEscalationDays;

        reminders.push({
          scheduledAt: reminderDate,
          type: isEscalation ? "ESCALATION" : "OVERDUE",
          channel: isEscalation ? "SMS" : preferredChannel,
          daysFromDue: daysOverdue,
          isEscalation,
        });
      }
    }
  }

  // Sort by date
  return reminders.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
}

/**
 * Get the interval in days for overdue reminder frequency
 */
function getOverdueInterval(frequency: OverdueFrequency): number {
  switch (frequency) {
    case "DAILY":
      return 1;
    case "EVERY_2_DAYS":
      return 2;
    case "EVERY_3_DAYS":
      return 3;
    case "WEEKLY":
      return 7;
    case "NONE":
    default:
      return 0;
  }
}

// ============================================
// REMINDER SCHEDULING
// ============================================

/**
 * Schedule reminders for a content request
 * Creates Reminder records in the database
 */
export async function scheduleRemindersForRequest(
  requestId: string,
  options?: {
    preview?: boolean; // If true, only return preview without creating records
    cancelExisting?: boolean; // If true, cancel existing auto-generated reminders first
  }
): Promise<ReminderScheduleResult> {
  const { preview = false, cancelExisting = true } = options || {};

  // Get the request with creator info
  const request = await db.contentRequest.findUnique({
    where: { id: requestId },
    include: {
      creator: {
        select: {
          id: true,
          preferredContact: true,
        },
      },
    },
  });

  if (!request) {
    throw new Error(`Request not found: ${requestId}`);
  }

  if (!request.dueDate) {
    return {
      requestId,
      creatorId: request.creatorId,
      remindersCreated: 0,
      reminders: [],
      config: { source: "default" },
    };
  }

  // Get the reminder configuration
  const { config, source, ruleId, overrideId, disableReminders } =
    await getReminderConfig(request.agencyId, request.creatorId, request.urgency);

  // If reminders are disabled for this creator, return empty result
  if (disableReminders) {
    if (cancelExisting && !preview) {
      await cancelAutoGeneratedReminders(requestId);
    }
    return {
      requestId,
      creatorId: request.creatorId,
      remindersCreated: 0,
      reminders: [],
      config: { source, overrideId },
    };
  }

  // Determine preferred channel
  const preferredChannel: NotificationChannel =
    request.creator.preferredContact === "SMS" ? "SMS" : "EMAIL";

  // Calculate reminder schedule
  const reminderSchedule = calculateReminderSchedule(
    request.dueDate,
    config,
    preferredChannel
  );

  // If preview mode, just return the schedule
  if (preview) {
    return {
      requestId,
      creatorId: request.creatorId,
      remindersCreated: reminderSchedule.length,
      reminders: reminderSchedule,
      config: { source, ruleId, overrideId },
    };
  }

  // Cancel existing auto-generated reminders if requested
  if (cancelExisting) {
    await cancelAutoGeneratedReminders(requestId);
  }

  // Create reminder records
  const createdReminders = await db.reminder.createMany({
    data: reminderSchedule.map((reminder) => ({
      requestId,
      type: reminder.type,
      channel: reminder.channel,
      scheduledAt: reminder.scheduledAt,
      isAutoGenerated: true,
      ruleId: ruleId || null,
      overrideId: overrideId || null,
      isEscalation: reminder.isEscalation,
      escalationChannel: reminder.isEscalation ? reminder.channel : null,
    })),
  });

  // Log the scheduling activity
  await db.activityLog.create({
    data: {
      action: "reminders.auto_scheduled",
      entityType: "ContentRequest",
      entityId: requestId,
      metadata: {
        remindersCreated: createdReminders.count,
        configSource: source,
        ruleId,
        overrideId,
        schedule: reminderSchedule.map((r) => ({
          date: format(r.scheduledAt, "yyyy-MM-dd"),
          type: r.type,
          channel: r.channel,
        })),
      },
    },
  });

  return {
    requestId,
    creatorId: request.creatorId,
    remindersCreated: createdReminders.count,
    reminders: reminderSchedule,
    config: { source, ruleId, overrideId },
  };
}

/**
 * Cancel all auto-generated pending reminders for a request
 */
export async function cancelAutoGeneratedReminders(requestId: string): Promise<number> {
  const result = await db.reminder.deleteMany({
    where: {
      requestId,
      isAutoGenerated: true,
      status: "PENDING",
    },
  });

  return result.count;
}

/**
 * Reschedule reminders for a request when due date changes
 */
export async function rescheduleReminders(requestId: string): Promise<ReminderScheduleResult> {
  return scheduleRemindersForRequest(requestId, {
    preview: false,
    cancelExisting: true,
  });
}

/**
 * Preview reminder schedule for a request without creating records
 */
export async function previewReminderSchedule(requestId: string): Promise<ReminderScheduleResult> {
  return scheduleRemindersForRequest(requestId, {
    preview: true,
    cancelExisting: false,
  });
}

/**
 * Preview reminder schedule for a new request (before creation)
 */
export async function previewScheduleForNewRequest(
  agencyId: string,
  creatorId: string,
  urgency: Urgency,
  dueDate: Date
): Promise<{
  reminders: ScheduledReminderPreview[];
  config: {
    source: "creator_override" | "urgency_rule" | "default";
    ruleId?: string;
    overrideId?: string;
  };
}> {
  // Get creator's preferred contact method
  const creator = await db.creator.findUnique({
    where: { id: creatorId },
    select: { preferredContact: true },
  });

  const preferredChannel: NotificationChannel =
    creator?.preferredContact === "SMS" ? "SMS" : "EMAIL";

  // Get configuration
  const { config, source, ruleId, overrideId, disableReminders } =
    await getReminderConfig(agencyId, creatorId, urgency);

  if (disableReminders) {
    return {
      reminders: [],
      config: { source, overrideId },
    };
  }

  // Calculate schedule
  const reminders = calculateReminderSchedule(dueDate, config, preferredChannel);

  return {
    reminders,
    config: { source, ruleId, overrideId },
  };
}

// ============================================
// BULK OPERATIONS
// ============================================

/**
 * Schedule reminders for all pending requests in an agency
 * Useful when reminder rules are updated
 */
export async function scheduleRemindersForAgency(
  agencyId: string,
  options?: {
    urgency?: Urgency; // Only reschedule for specific urgency
    creatorId?: string; // Only reschedule for specific creator
  }
): Promise<{
  processed: number;
  success: number;
  failed: number;
  errors: Array<{ requestId: string; error: string }>;
}> {
  const where: Record<string, unknown> = {
    agencyId,
    status: { in: ["PENDING", "IN_PROGRESS", "NEEDS_REVISION"] },
    dueDate: { not: null },
  };

  if (options?.urgency) {
    where.urgency = options.urgency;
  }

  if (options?.creatorId) {
    where.creatorId = options.creatorId;
  }

  const requests = await db.contentRequest.findMany({
    where,
    select: { id: true },
  });

  const results = {
    processed: requests.length,
    success: 0,
    failed: 0,
    errors: [] as Array<{ requestId: string; error: string }>,
  };

  for (const request of requests) {
    try {
      await scheduleRemindersForRequest(request.id);
      results.success++;
    } catch (error) {
      results.failed++;
      results.errors.push({
        requestId: request.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return results;
}

// ============================================
// ESCALATION HANDLING
// ============================================

/**
 * Check and process escalations for overdue reminders
 * Called during reminder processing
 */
export async function processEscalations(requestId: string): Promise<void> {
  const request = await db.contentRequest.findUnique({
    where: { id: requestId },
    include: {
      creator: {
        select: {
          id: true,
          phone: true,
          preferredContact: true,
        },
      },
    },
  });

  if (!request || !request.dueDate) return;

  const daysOverdue = differenceInDays(new Date(), request.dueDate);
  if (daysOverdue <= 0) return;

  // Get configuration
  const { config, ruleId, overrideId } = await getReminderConfig(
    request.agencyId,
    request.creatorId,
    request.urgency
  );

  // Check if escalation is configured and threshold is reached
  if (
    !config.escalateToSms ||
    config.smsEscalationDays === null ||
    daysOverdue < config.smsEscalationDays
  ) {
    return;
  }

  // Check if creator has a phone number
  if (!request.creator.phone) {
    console.log(`Cannot escalate to SMS for request ${requestId}: Creator has no phone number`);
    return;
  }

  // Check if an escalation has already been sent today
  const today = startOfDay(new Date());
  const existingEscalation = await db.reminder.findFirst({
    where: {
      requestId,
      type: "ESCALATION",
      channel: "SMS",
      scheduledAt: {
        gte: today,
        lt: addDays(today, 1),
      },
    },
  });

  if (existingEscalation) return;

  // Create escalation reminder
  await db.reminder.create({
    data: {
      requestId,
      type: "ESCALATION",
      channel: "SMS",
      scheduledAt: new Date(),
      isAutoGenerated: true,
      ruleId,
      overrideId,
      isEscalation: true,
      escalationChannel: "SMS",
    },
  });

  // Log the escalation
  await db.activityLog.create({
    data: {
      action: "reminder.escalated",
      entityType: "ContentRequest",
      entityId: requestId,
      metadata: {
        daysOverdue,
        escalationChannel: "SMS",
        reason: `Request ${daysOverdue} days overdue, escalation threshold: ${config.smsEscalationDays} days`,
      },
    },
  });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Format reminder schedule for display
 */
export function formatReminderSchedule(reminders: ScheduledReminderPreview[]): string {
  if (reminders.length === 0) {
    return "No reminders scheduled";
  }

  const formatted = reminders.map((r) => {
    const date = format(r.scheduledAt, "MMM d");
    const suffix = r.isEscalation ? " (SMS escalation)" : "";
    return `${date}${suffix}`;
  });

  return `${reminders.length} reminders scheduled: ${formatted.join(", ")}`;
}

/**
 * Get summary of scheduled reminders for a request
 */
export async function getRemindersummary(requestId: string): Promise<{
  total: number;
  pending: number;
  sent: number;
  failed: number;
  nextReminder: Date | null;
  schedule: Array<{
    id: string;
    scheduledAt: Date;
    type: string;
    channel: string;
    status: string;
    isEscalation: boolean;
  }>;
}> {
  const reminders = await db.reminder.findMany({
    where: { requestId },
    orderBy: { scheduledAt: "asc" },
    select: {
      id: true,
      scheduledAt: true,
      type: true,
      channel: true,
      status: true,
      isEscalation: true,
    },
  });

  const pending = reminders.filter((r) => r.status === "PENDING");
  const sent = reminders.filter((r) => r.status === "SENT");
  const failed = reminders.filter((r) => r.status === "FAILED");

  const nextReminder = pending.find(
    (r) => r.scheduledAt >= startOfDay(new Date())
  );

  return {
    total: reminders.length,
    pending: pending.length,
    sent: sent.length,
    failed: failed.length,
    nextReminder: nextReminder?.scheduledAt || null,
    schedule: reminders,
  };
}

// ============================================
// QUIET HOURS - Timezone-aware (10pm-8am)
// ============================================

/**
 * Get quiet hours config for a creator
 */
export async function getQuietHoursConfig(
  agencyId: string,
  creatorId: string
): Promise<QuietHoursConfig> {
  const override = await db.creatorReminderOverride.findUnique({
    where: {
      agencyId_creatorId: { agencyId, creatorId },
    },
    select: {
      quietHoursEnabled: true,
      quietHoursStart: true,
      quietHoursEnd: true,
    },
  });

  const creator = await db.creator.findUnique({
    where: { id: creatorId },
    select: { timezone: true },
  });

  if (override) {
    return {
      enabled: override.quietHoursEnabled,
      start: override.quietHoursStart,
      end: override.quietHoursEnd,
      timezone: creator?.timezone || DEFAULT_QUIET_HOURS.timezone,
    };
  }

  return {
    ...DEFAULT_QUIET_HOURS,
    timezone: creator?.timezone || DEFAULT_QUIET_HOURS.timezone,
  };
}

/**
 * Parse HH:mm string to hours and minutes
 */
function parseTimeString(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return { hours, minutes };
}

/**
 * Check if a given time is within quiet hours for a specific timezone
 */
export function isWithinQuietHours(
  date: Date,
  config: QuietHoursConfig
): boolean {
  if (!config.enabled) return false;

  // Convert the date to the creator's timezone
  const zonedDate = toZonedTime(date, config.timezone);
  const hours = zonedDate.getHours();
  const minutes = zonedDate.getMinutes();
  const currentMinutes = hours * 60 + minutes;

  const start = parseTimeString(config.start);
  const end = parseTimeString(config.end);
  const startMinutes = start.hours * 60 + start.minutes;
  const endMinutes = end.hours * 60 + end.minutes;

  // Handle overnight quiet hours (e.g., 22:00 - 08:00)
  if (startMinutes > endMinutes) {
    // Quiet hours span midnight
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  } else {
    // Quiet hours within same day
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }
}

/**
 * Adjust a reminder time to respect quiet hours
 * If the time falls within quiet hours, move it to the end of quiet hours
 */
export function adjustForQuietHours(
  scheduledAt: Date,
  config: QuietHoursConfig
): { adjustedAt: Date; wasAdjusted: boolean } {
  if (!config.enabled || !isWithinQuietHours(scheduledAt, config)) {
    return { adjustedAt: scheduledAt, wasAdjusted: false };
  }

  // Convert to creator's timezone
  const zonedDate = toZonedTime(scheduledAt, config.timezone);

  // Set to end of quiet hours
  const end = parseTimeString(config.end);
  let adjustedZoned = setHours(zonedDate, end.hours);
  adjustedZoned = setMinutes(adjustedZoned, end.minutes);

  // If the current time is after midnight (before quiet hours end),
  // we're already on the right day. If it's before midnight (after quiet hours start),
  // we need to add a day
  const hours = zonedDate.getHours();
  const start = parseTimeString(config.start);

  if (hours >= start.hours) {
    // It's after quiet hours start but before midnight, move to next day
    adjustedZoned = addDays(adjustedZoned, 1);
  }

  // Convert back to UTC
  const adjustedAt = fromZonedTime(adjustedZoned, config.timezone);

  return { adjustedAt, wasAdjusted: true };
}

// ============================================
// SMART BATCHING - Combine reminders for same creator/day
// ============================================

/**
 * Get all pending reminders for a creator on a specific date
 * and group them for batching
 */
export async function getBatchedRemindersForCreator(
  creatorId: string,
  date: Date
): Promise<BatchedReminderGroup | null> {
  const dayStart = startOfDay(date);
  const dayEnd = addDays(dayStart, 1);

  // Get the creator
  const creator = await db.creator.findUnique({
    where: { id: creatorId },
    select: {
      id: true,
      email: true,
      phone: true,
      name: true,
      timezone: true,
    },
  });

  if (!creator) return null;

  // Get all pending reminders for this creator on this date
  const reminders = await db.reminder.findMany({
    where: {
      request: { creatorId },
      status: "PENDING",
      scheduledAt: { gte: dayStart, lt: dayEnd },
    },
    include: {
      request: {
        select: {
          id: true,
          title: true,
          dueDate: true,
          urgency: true,
        },
      },
    },
    orderBy: { scheduledAt: "asc" },
  });

  if (reminders.length === 0) return null;

  // Group by channel
  const emailReminders = reminders.filter((r) => r.channel === "EMAIL");
  const smsReminders = reminders.filter((r) => r.channel === "SMS");

  // Use the earliest scheduled time
  const earliestReminder = reminders[0];

  // Build request list
  const requests = reminders.map((r) => ({
    id: r.request.id,
    title: r.request.title,
    dueDate: r.request.dueDate,
    daysFromDue: r.request.dueDate
      ? differenceInDays(r.request.dueDate, date)
      : 0,
    urgency: r.request.urgency,
  }));

  // Remove duplicate requests
  const uniqueRequests = requests.filter(
    (req, index, self) => self.findIndex((r) => r.id === req.id) === index
  );

  return {
    creatorId: creator.id,
    creatorEmail: creator.email,
    creatorPhone: creator.phone,
    creatorName: creator.name,
    creatorTimezone: creator.timezone,
    requests: uniqueRequests,
    channel: emailReminders.length > 0 ? "EMAIL" : "SMS",
    scheduledAt: earliestReminder.scheduledAt,
  };
}

/**
 * Get all batched reminder groups for a specific date across all creators
 */
export async function getAllBatchedRemindersForDate(
  agencyId: string,
  date: Date
): Promise<BatchedReminderGroup[]> {
  const dayStart = startOfDay(date);
  const dayEnd = addDays(dayStart, 1);

  // Get all unique creators with pending reminders on this date
  const creatorsWithReminders = await db.reminder.findMany({
    where: {
      request: { agencyId },
      status: "PENDING",
      scheduledAt: { gte: dayStart, lt: dayEnd },
    },
    select: {
      request: {
        select: { creatorId: true },
      },
    },
    distinct: ["requestId"],
  });

  const creatorIds = [
    ...new Set(creatorsWithReminders.map((r) => r.request.creatorId)),
  ];

  const batches: BatchedReminderGroup[] = [];

  for (const creatorId of creatorIds) {
    const batch = await getBatchedRemindersForCreator(creatorId, date);
    if (batch && batch.requests.length > 1) {
      batches.push(batch);
    }
  }

  return batches;
}

/**
 * Mark reminders as batched and create a single batched reminder
 */
export async function createBatchedReminder(
  batch: BatchedReminderGroup
): Promise<string | null> {
  if (batch.requests.length < 2) return null;

  const dayStart = startOfDay(batch.scheduledAt);
  const dayEnd = addDays(dayStart, 1);

  // Get all individual reminders for this batch
  const individualReminders = await db.reminder.findMany({
    where: {
      request: { creatorId: batch.creatorId },
      status: "PENDING",
      channel: batch.channel,
      scheduledAt: { gte: dayStart, lt: dayEnd },
    },
    select: { id: true, requestId: true },
  });

  if (individualReminders.length < 2) return null;

  // Get the first request ID for the batched reminder
  const primaryRequestId = individualReminders[0].requestId;
  const otherRequestIds = individualReminders.slice(1).map((r) => r.requestId);

  // Update the first reminder to be a batched reminder
  await db.reminder.update({
    where: { id: individualReminders[0].id },
    data: {
      isBatched: true,
      batchedRequestIds: otherRequestIds,
    },
  });

  // Mark other reminders as part of the batch (skip sending individually)
  await db.reminder.updateMany({
    where: {
      id: { in: individualReminders.slice(1).map((r) => r.id) },
    },
    data: {
      status: "SENT",
      sentAt: new Date(),
      error: "Included in batched reminder",
    },
  });

  return individualReminders[0].id;
}

// ============================================
// PAUSE/RESUME PER CREATOR
// ============================================

/**
 * Pause reminders for a specific creator
 */
export async function pauseRemindersForCreator(
  agencyId: string,
  creatorId: string,
  options: {
    reason?: string;
    resumeAt?: Date;
  } = {}
): Promise<void> {
  await db.creatorReminderOverride.upsert({
    where: {
      agencyId_creatorId: { agencyId, creatorId },
    },
    create: {
      agencyId,
      creatorId,
      isPaused: true,
      pausedAt: new Date(),
      pauseResumeAt: options.resumeAt || null,
      pauseReason: options.reason || null,
    },
    update: {
      isPaused: true,
      pausedAt: new Date(),
      pauseResumeAt: options.resumeAt || null,
      pauseReason: options.reason || null,
    },
  });

  // Log activity
  await db.activityLog.create({
    data: {
      action: "reminder.paused",
      entityType: "Creator",
      entityId: creatorId,
      metadata: {
        reason: options.reason,
        resumeAt: options.resumeAt?.toISOString(),
      },
    },
  });
}

/**
 * Resume reminders for a specific creator
 */
export async function resumeRemindersForCreator(
  agencyId: string,
  creatorId: string
): Promise<void> {
  await db.creatorReminderOverride.update({
    where: {
      agencyId_creatorId: { agencyId, creatorId },
    },
    data: {
      isPaused: false,
      pausedAt: null,
      pauseResumeAt: null,
      pauseReason: null,
    },
  });

  // Log activity
  await db.activityLog.create({
    data: {
      action: "reminder.resumed",
      entityType: "Creator",
      entityId: creatorId,
      metadata: {},
    },
  });
}

/**
 * Check if reminders are paused for a creator
 */
export async function isRemindersPausedForCreator(
  agencyId: string,
  creatorId: string
): Promise<PauseConfig> {
  const override = await db.creatorReminderOverride.findUnique({
    where: {
      agencyId_creatorId: { agencyId, creatorId },
    },
    select: {
      isPaused: true,
      pausedAt: true,
      pauseResumeAt: true,
      pauseReason: true,
    },
  });

  if (!override) {
    return { isPaused: false };
  }

  // Check if auto-resume date has passed
  if (override.isPaused && override.pauseResumeAt) {
    if (new Date() >= override.pauseResumeAt) {
      // Auto-resume
      await resumeRemindersForCreator(agencyId, creatorId);
      return { isPaused: false };
    }
  }

  return {
    isPaused: override.isPaused,
    pausedAt: override.pausedAt,
    pauseResumeAt: override.pauseResumeAt,
    pauseReason: override.pauseReason,
  };
}

/**
 * Process auto-resume for all creators whose resume date has passed
 */
export async function processAutoResumeReminders(): Promise<number> {
  const now = new Date();

  const toResume = await db.creatorReminderOverride.findMany({
    where: {
      isPaused: true,
      pauseResumeAt: { lte: now },
    },
    select: {
      agencyId: true,
      creatorId: true,
    },
  });

  for (const override of toResume) {
    await resumeRemindersForCreator(override.agencyId, override.creatorId);
  }

  return toResume.length;
}

// ============================================
// RESPONSE DETECTION - Auto-stop reminders
// ============================================

/**
 * Detect creator response and stop pending reminders
 * Call this when a creator starts uploading or views a request
 */
export async function handleCreatorResponse(
  requestId: string,
  responseType: "upload_started" | "request_viewed" | "submitted"
): Promise<{
  remindersCancelled: number;
  requestId: string;
}> {
  // Get pending reminders for this request
  const pendingReminders = await db.reminder.findMany({
    where: {
      requestId,
      status: "PENDING",
      isAutoGenerated: true,
    },
    select: { id: true },
  });

  if (pendingReminders.length === 0) {
    return { remindersCancelled: 0, requestId };
  }

  // For "upload_started", mark pending reminders with response detection
  // but don't cancel them immediately - wait for completion
  if (responseType === "upload_started") {
    await db.reminder.updateMany({
      where: {
        requestId,
        status: "PENDING",
        isAutoGenerated: true,
      },
      data: {
        responseDetectedAt: new Date(),
        responseAction: responseType,
      },
    });

    return { remindersCancelled: 0, requestId };
  }

  // For "submitted", cancel all pending reminders
  if (responseType === "submitted") {
    const result = await db.reminder.updateMany({
      where: {
        requestId,
        status: "PENDING",
        isAutoGenerated: true,
      },
      data: {
        status: "SENT",
        sentAt: new Date(),
        error: "Auto-cancelled: Creator submitted content",
        responseDetectedAt: new Date(),
        responseAction: responseType,
      },
    });

    // Log activity
    await db.activityLog.create({
      data: {
        action: "reminders.auto_cancelled",
        entityType: "ContentRequest",
        entityId: requestId,
        metadata: {
          reason: "Creator submitted content",
          remindersCancelled: result.count,
        },
      },
    });

    return { remindersCancelled: result.count, requestId };
  }

  // For "request_viewed", we don't cancel but mark for tracking
  await db.reminder.updateMany({
    where: {
      requestId,
      status: "PENDING",
      isAutoGenerated: true,
      responseDetectedAt: null, // Only update if not already detected
    },
    data: {
      responseDetectedAt: new Date(),
      responseAction: responseType,
    },
  });

  return { remindersCancelled: 0, requestId };
}

/**
 * Cancel reminders when request status changes to completed states
 */
export async function cancelRemindersOnStatusChange(
  requestId: string,
  newStatus: string
): Promise<number> {
  const completedStatuses = ["SUBMITTED", "APPROVED", "CANCELLED", "ARCHIVED"];

  if (!completedStatuses.includes(newStatus)) {
    return 0;
  }

  const result = await db.reminder.updateMany({
    where: {
      requestId,
      status: "PENDING",
    },
    data: {
      status: "SENT",
      sentAt: new Date(),
      error: `Auto-cancelled: Request status changed to ${newStatus}`,
    },
  });

  if (result.count > 0) {
    await db.activityLog.create({
      data: {
        action: "reminders.auto_cancelled_status",
        entityType: "ContentRequest",
        entityId: requestId,
        metadata: {
          newStatus,
          remindersCancelled: result.count,
        },
      },
    });
  }

  return result.count;
}

/**
 * Check if a creator has recently started uploading to a request
 * Returns true if there's recent upload activity
 */
export async function hasRecentUploadActivity(
  requestId: string,
  withinHours: number = 24
): Promise<boolean> {
  const threshold = addHours(new Date(), -withinHours);

  const recentUpload = await db.upload.findFirst({
    where: {
      requestId,
      createdAt: { gte: threshold },
    },
    select: { id: true },
  });

  return !!recentUpload;
}

/**
 * Comprehensive check before sending a reminder
 * Returns true if the reminder should be sent
 */
export async function shouldSendReminder(
  requestId: string,
  creatorId: string,
  agencyId: string
): Promise<{
  shouldSend: boolean;
  reason?: string;
}> {
  // Check if request is still in an active status
  const request = await db.contentRequest.findUnique({
    where: { id: requestId },
    select: { status: true },
  });

  if (!request) {
    return { shouldSend: false, reason: "Request not found" };
  }

  const activeStatuses = ["PENDING", "IN_PROGRESS", "NEEDS_REVISION"];
  if (!activeStatuses.includes(request.status)) {
    return { shouldSend: false, reason: `Request status is ${request.status}` };
  }

  // Check if reminders are paused for this creator
  const pauseInfo = await isRemindersPausedForCreator(agencyId, creatorId);
  if (pauseInfo.isPaused) {
    return {
      shouldSend: false,
      reason: `Reminders paused until ${pauseInfo.pauseResumeAt?.toISOString() || "manually resumed"}`,
    };
  }

  // Check for recent upload activity
  const hasRecentActivity = await hasRecentUploadActivity(requestId, 24);
  if (hasRecentActivity) {
    return {
      shouldSend: false,
      reason: "Creator has recent upload activity (within 24 hours)",
    };
  }

  // Check quiet hours
  const quietHours = await getQuietHoursConfig(agencyId, creatorId);
  if (isWithinQuietHours(new Date(), quietHours)) {
    return {
      shouldSend: false,
      reason: `Within quiet hours (${quietHours.start} - ${quietHours.end} ${quietHours.timezone})`,
    };
  }

  return { shouldSend: true };
}
