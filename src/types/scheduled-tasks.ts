// Scheduled Tasks Type Definitions
// Types for scheduling future request creation and other automated tasks

export type ScheduledTaskType = "create_request" | "send_reminder" | "archive_request" | "create_bundle";
export type ScheduledTaskStatus = "pending" | "processing" | "completed" | "failed" | "cancelled";
export type RecurrencePattern = "once" | "daily" | "weekly" | "biweekly" | "monthly" | "quarterly";

export interface ScheduledTask {
  id: string;
  agencyId: string;
  createdById: string;

  // Task details
  type: ScheduledTaskType;
  name: string;
  description?: string;

  // Scheduling
  scheduledFor: Date;
  recurrence: RecurrencePattern;
  recurrenceEndDate?: Date;
  nextRunAt?: Date;
  lastRunAt?: Date;
  runCount: number;

  // Target
  creatorId?: string;
  creatorIds?: string[]; // For bulk
  templateId?: string;
  bundleId?: string;

  // Configuration based on type
  config: {
    // For create_request
    requestConfig?: {
      templateId: string;
      title?: string;
      description?: string;
      dueInDays: number;
      urgency: "LOW" | "NORMAL" | "HIGH" | "URGENT";
      autoSend: boolean;
    };
    // For send_reminder
    reminderConfig?: {
      requestId: string;
      message?: string;
    };
    // For archive_request
    archiveConfig?: {
      requestId?: string;
      olderThanDays?: number;
      statusFilter?: string[];
    };
    // For create_bundle
    bundleConfig?: {
      templateIds: string[];
      name?: string;
    };
  };

  // Status
  status: ScheduledTaskStatus;
  lastError?: string;

  // Results
  results?: {
    createdRequestIds?: string[];
    sentReminderCount?: number;
    archivedCount?: number;
    bundleId?: string;
  };

  createdAt: Date;
  updatedAt: Date;
}

// API Request/Response Types
export interface CreateScheduledTaskRequest {
  type: ScheduledTaskType;
  name: string;
  description?: string;
  scheduledFor: string; // ISO date string
  recurrence: RecurrencePattern;
  recurrenceEndDate?: string;
  creatorId?: string;
  creatorIds?: string[];
  templateId?: string;
  config: ScheduledTask["config"];
}

export interface UpdateScheduledTaskRequest {
  name?: string;
  description?: string;
  scheduledFor?: string;
  recurrence?: RecurrencePattern;
  recurrenceEndDate?: string;
  status?: ScheduledTaskStatus;
  config?: ScheduledTask["config"];
}

export interface ScheduledTaskWithRelations extends ScheduledTask {
  creator?: {
    id: string;
    name: string;
    email: string;
  };
  creators?: {
    id: string;
    name: string;
    email: string;
  }[];
  template?: {
    id: string;
    name: string;
  };
  createdBy?: {
    id: string;
    name: string;
  };
}

// Calendar View Types
export interface CalendarTask {
  id: string;
  name: string;
  type: ScheduledTaskType;
  scheduledFor: Date;
  status: ScheduledTaskStatus;
  creatorName?: string;
  templateName?: string;
}

export interface CalendarDay {
  date: Date;
  tasks: CalendarTask[];
  isToday: boolean;
  isCurrentMonth: boolean;
}

// Execution Types
export interface TaskExecutionResult {
  taskId: string;
  success: boolean;
  error?: string;
  results?: ScheduledTask["results"];
  executedAt: Date;
}

// Helper functions for task types
export const TASK_TYPE_LABELS: Record<ScheduledTaskType, string> = {
  create_request: "Create Request",
  send_reminder: "Send Reminder",
  archive_request: "Archive Request",
  create_bundle: "Create Bundle",
};

export const TASK_TYPE_DESCRIPTIONS: Record<ScheduledTaskType, string> = {
  create_request: "Automatically create a content request from a template",
  send_reminder: "Send a reminder notification to creators",
  archive_request: "Archive old or completed requests",
  create_bundle: "Create a bundle of multiple requests",
};

export const TASK_TYPE_ICONS: Record<ScheduledTaskType, string> = {
  create_request: "FilePlus",
  send_reminder: "Bell",
  archive_request: "Archive",
  create_bundle: "Package",
};

export const RECURRENCE_LABELS: Record<RecurrencePattern, string> = {
  once: "One Time",
  daily: "Daily",
  weekly: "Weekly",
  biweekly: "Every 2 Weeks",
  monthly: "Monthly",
  quarterly: "Quarterly",
};

export const STATUS_LABELS: Record<ScheduledTaskStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

export const STATUS_COLORS: Record<ScheduledTaskStatus, string> = {
  pending: "yellow",
  processing: "blue",
  completed: "green",
  failed: "red",
  cancelled: "gray",
};

// Utility function to calculate next run date
export function calculateNextRunDate(
  currentDate: Date,
  recurrence: RecurrencePattern,
  recurrenceEndDate?: Date
): Date | null {
  if (recurrence === "once") {
    return null;
  }

  const nextDate = new Date(currentDate);

  switch (recurrence) {
    case "daily":
      nextDate.setDate(nextDate.getDate() + 1);
      break;
    case "weekly":
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case "biweekly":
      nextDate.setDate(nextDate.getDate() + 14);
      break;
    case "monthly":
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    case "quarterly":
      nextDate.setMonth(nextDate.getMonth() + 3);
      break;
  }

  if (recurrenceEndDate && nextDate > recurrenceEndDate) {
    return null;
  }

  return nextDate;
}

// Get upcoming occurrences for preview
export function getUpcomingOccurrences(
  startDate: Date,
  recurrence: RecurrencePattern,
  recurrenceEndDate?: Date,
  count: number = 5
): Date[] {
  const occurrences: Date[] = [new Date(startDate)];

  if (recurrence === "once") {
    return occurrences;
  }

  let currentDate = new Date(startDate);

  while (occurrences.length < count) {
    const nextDate = calculateNextRunDate(currentDate, recurrence, recurrenceEndDate);
    if (!nextDate) break;
    occurrences.push(nextDate);
    currentDate = nextDate;
  }

  return occurrences;
}
