// Recurring Requests Type Definitions
// Types for automated recurring content request creation

export type RecurrenceFrequency = "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "QUARTERLY";
export type RecurringExecutionStatus = "PENDING" | "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED" | "SKIPPED";

export interface RequestSettings {
  titleTemplate: string;        // Can include {date}, {week}, {month}, {creator_name}
  description?: string;
  dueInDays: number;
  urgency: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  autoSendNotification: boolean;
  customFields?: Record<string, string>;
}

export interface RecurringRequest {
  id: string;
  agencyId: string;

  // Configuration
  name: string;
  description?: string;

  // Template
  templateId: string;
  template?: {
    id: string;
    name: string;
    description?: string;
  };

  // Target creators
  creatorIds: string[];
  creatorGroupIds: string[];

  // Resolved creators (for display)
  creators?: {
    id: string;
    name: string;
    email: string;
  }[];
  creatorGroups?: {
    id: string;
    name: string;
    memberCount: number;
  }[];

  // Schedule settings
  frequency: RecurrenceFrequency;
  dayOfWeek?: number;      // 0-6 (Sunday-Saturday)
  dayOfMonth?: number;     // 1-31
  timeOfDay: string;       // HH:mm format
  timezone: string;

  // Recurrence limits
  startDate: Date;
  endDate?: Date;
  maxOccurrences?: number;

  // Request settings
  requestSettings: RequestSettings;

  // Tracking
  isActive: boolean;
  lastRunAt?: Date;
  nextRunAt?: Date;
  runCount: number;
  lastError?: string;

  // Audit
  createdById: string;
  createdBy?: {
    id: string;
    name: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface RecurringRequestExecution {
  id: string;
  recurringRequestId: string;
  scheduledFor: Date;
  executedAt?: Date;
  status: RecurringExecutionStatus;
  createdRequestIds: string[];
  creatorCount: number;
  successCount: number;
  failedCount: number;
  error?: string;
  createdAt: Date;
}

export interface RecurringRequestWithExecutions extends RecurringRequest {
  executions: RecurringRequestExecution[];
}

// API Types
export interface CreateRecurringRequestInput {
  name: string;
  description?: string;
  templateId: string;
  creatorIds?: string[];
  creatorGroupIds?: string[];
  frequency: RecurrenceFrequency;
  dayOfWeek?: number;
  dayOfMonth?: number;
  timeOfDay: string;
  timezone: string;
  startDate: string;  // ISO date
  endDate?: string;   // ISO date
  maxOccurrences?: number;
  requestSettings: RequestSettings;
}

export interface UpdateRecurringRequestInput {
  name?: string;
  description?: string;
  templateId?: string;
  creatorIds?: string[];
  creatorGroupIds?: string[];
  frequency?: RecurrenceFrequency;
  dayOfWeek?: number;
  dayOfMonth?: number;
  timeOfDay?: string;
  timezone?: string;
  startDate?: string;
  endDate?: string;
  maxOccurrences?: number;
  requestSettings?: Partial<RequestSettings>;
  isActive?: boolean;
}

// Helper constants
export const FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  BIWEEKLY: "Every 2 Weeks",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
};

export const FREQUENCY_DESCRIPTIONS: Record<RecurrenceFrequency, string> = {
  DAILY: "Creates requests every day",
  WEEKLY: "Creates requests once per week",
  BIWEEKLY: "Creates requests every two weeks",
  MONTHLY: "Creates requests once per month",
  QUARTERLY: "Creates requests every 3 months",
};

export const DAY_OF_WEEK_LABELS: Record<number, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

export const EXECUTION_STATUS_LABELS: Record<RecurringExecutionStatus, string> = {
  PENDING: "Pending",
  RUNNING: "Running",
  COMPLETED: "Completed",
  PARTIAL: "Partial Success",
  FAILED: "Failed",
  SKIPPED: "Skipped",
};

export const EXECUTION_STATUS_COLORS: Record<RecurringExecutionStatus, string> = {
  PENDING: "yellow",
  RUNNING: "blue",
  COMPLETED: "green",
  PARTIAL: "orange",
  FAILED: "red",
  SKIPPED: "gray",
};

// Utility functions
export function calculateNextRunDate(
  frequency: RecurrenceFrequency,
  currentDate: Date,
  dayOfWeek?: number,
  dayOfMonth?: number,
  endDate?: Date,
  maxOccurrences?: number,
  currentRunCount?: number
): Date | null {
  // Check if we've exceeded max occurrences
  if (maxOccurrences && currentRunCount && currentRunCount >= maxOccurrences) {
    return null;
  }

  const next = new Date(currentDate);

  switch (frequency) {
    case "DAILY":
      next.setDate(next.getDate() + 1);
      break;

    case "WEEKLY":
      next.setDate(next.getDate() + 7);
      // Adjust to specific day of week if set
      if (dayOfWeek !== undefined) {
        const currentDay = next.getDay();
        const diff = (dayOfWeek - currentDay + 7) % 7;
        next.setDate(next.getDate() + (diff === 0 ? 7 : diff));
      }
      break;

    case "BIWEEKLY":
      next.setDate(next.getDate() + 14);
      if (dayOfWeek !== undefined) {
        const currentDay = next.getDay();
        const diff = (dayOfWeek - currentDay + 7) % 7;
        if (diff !== 0) {
          next.setDate(next.getDate() + diff);
        }
      }
      break;

    case "MONTHLY":
      next.setMonth(next.getMonth() + 1);
      if (dayOfMonth !== undefined) {
        // Handle months with fewer days
        const targetDay = Math.min(dayOfMonth, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate());
        next.setDate(targetDay);
      }
      break;

    case "QUARTERLY":
      next.setMonth(next.getMonth() + 3);
      if (dayOfMonth !== undefined) {
        const targetDay = Math.min(dayOfMonth, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate());
        next.setDate(targetDay);
      }
      break;
  }

  // Check if next date is past end date
  if (endDate && next > endDate) {
    return null;
  }

  return next;
}

export function getUpcomingScheduleDates(
  frequency: RecurrenceFrequency,
  startDate: Date,
  timeOfDay: string,
  dayOfWeek?: number,
  dayOfMonth?: number,
  endDate?: Date,
  maxOccurrences?: number,
  count: number = 5
): Date[] {
  const dates: Date[] = [];
  let current = new Date(startDate);

  // Set the time
  const [hours, minutes] = timeOfDay.split(":").map(Number);
  current.setHours(hours, minutes, 0, 0);

  // First occurrence
  if (current >= new Date()) {
    dates.push(new Date(current));
  }

  // Calculate subsequent occurrences
  while (dates.length < count) {
    const next = calculateNextRunDate(
      frequency,
      current,
      dayOfWeek,
      dayOfMonth,
      endDate,
      maxOccurrences,
      dates.length
    );

    if (!next) break;

    next.setHours(hours, minutes, 0, 0);
    dates.push(next);
    current = next;
  }

  return dates;
}

export function formatTitleTemplate(
  template: string,
  date: Date,
  creatorName?: string
): string {
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return template
    .replace(/{date}/g, date.toLocaleDateString())
    .replace(/{week}/g, `Week ${getWeekNumber(date)}`)
    .replace(/{month}/g, monthNames[date.getMonth()])
    .replace(/{year}/g, String(date.getFullYear()))
    .replace(/{creator_name}/g, creatorName || "Creator");
}

function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}
