import {
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
  isPast,
  isToday,
  isTomorrow,
  isWithinInterval,
  addDays,
  addWeeks,
  endOfWeek,
  startOfDay,
  format,
  formatDistanceToNow,
} from "date-fns";

export type Priority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type UrgencyLevel = "overdue" | "critical" | "warning" | "normal" | "none";

export interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  totalHours: number;
  totalMinutes: number;
  isOverdue: boolean;
}

export interface DeadlineInfo {
  timeRemaining: TimeRemaining;
  urgencyLevel: UrgencyLevel;
  displayText: string;
  relativeText: string;
  isOverdue: boolean;
  isDueSoon: boolean;
  isDueToday: boolean;
  isDueTomorrow: boolean;
}

export interface PriorityConfig {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  ringColor: string;
  sortOrder: number;
  showIndicator: boolean;
  animate: boolean;
}

/**
 * Get priority configuration for visual display
 */
export function getPriorityConfig(priority: Priority): PriorityConfig {
  const configs: Record<Priority, PriorityConfig> = {
    URGENT: {
      label: "Urgent",
      color: "red",
      bgColor: "bg-red-100 dark:bg-red-900/30",
      borderColor: "border-red-300 dark:border-red-700",
      textColor: "text-red-700 dark:text-red-400",
      ringColor: "ring-red-500/30",
      sortOrder: 0,
      showIndicator: true,
      animate: true,
    },
    HIGH: {
      label: "High",
      color: "orange",
      bgColor: "bg-orange-100 dark:bg-orange-900/30",
      borderColor: "border-orange-300 dark:border-orange-700",
      textColor: "text-orange-700 dark:text-orange-400",
      ringColor: "ring-orange-500/30",
      sortOrder: 1,
      showIndicator: true,
      animate: false,
    },
    NORMAL: {
      label: "Normal",
      color: "blue",
      bgColor: "bg-blue-100 dark:bg-blue-900/30",
      borderColor: "border-blue-300 dark:border-blue-700",
      textColor: "text-blue-700 dark:text-blue-400",
      ringColor: "ring-blue-500/30",
      sortOrder: 2,
      showIndicator: false,
      animate: false,
    },
    LOW: {
      label: "Low",
      color: "gray",
      bgColor: "bg-gray-100 dark:bg-gray-800/50",
      borderColor: "border-gray-300 dark:border-gray-700",
      textColor: "text-gray-600 dark:text-gray-400",
      ringColor: "ring-gray-500/30",
      sortOrder: 3,
      showIndicator: false,
      animate: false,
    },
  };

  return configs[priority] || configs.NORMAL;
}

/**
 * Calculate time remaining until deadline
 */
export function calculateTimeRemaining(deadline: Date | string | null): TimeRemaining | null {
  if (!deadline) return null;

  const deadlineDate = typeof deadline === "string" ? new Date(deadline) : deadline;
  const now = new Date();

  const isOverdue = isPast(deadlineDate);
  const referenceDate = isOverdue ? deadlineDate : now;
  const targetDate = isOverdue ? now : deadlineDate;

  const totalMinutes = Math.abs(differenceInMinutes(targetDate, referenceDate));
  const totalHours = Math.abs(differenceInHours(targetDate, referenceDate));
  const days = Math.abs(differenceInDays(targetDate, referenceDate));
  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;

  return {
    days,
    hours,
    minutes,
    totalHours,
    totalMinutes,
    isOverdue,
  };
}

/**
 * Determine urgency level based on deadline and priority
 */
export function determineUrgencyLevel(
  deadline: Date | string | null,
  priority: Priority = "NORMAL"
): UrgencyLevel {
  if (!deadline) return "none";

  const deadlineDate = typeof deadline === "string" ? new Date(deadline) : deadline;
  const now = new Date();

  // Overdue is always critical
  if (isPast(deadlineDate)) {
    return "overdue";
  }

  const hoursRemaining = differenceInHours(deadlineDate, now);
  const daysRemaining = differenceInDays(deadlineDate, now);

  // Urgent priority or very close deadline
  if (priority === "URGENT" || hoursRemaining <= 4) {
    return "critical";
  }

  // High priority or due within 24 hours
  if (priority === "HIGH" || hoursRemaining <= 24) {
    return "warning";
  }

  // Due within 3 days
  if (daysRemaining <= 3) {
    return "warning";
  }

  return "normal";
}

/**
 * Format deadline for display
 */
export function formatDeadlineDisplay(deadline: Date | string | null): string {
  if (!deadline) return "No deadline";

  const deadlineDate = typeof deadline === "string" ? new Date(deadline) : deadline;
  const now = new Date();

  if (isPast(deadlineDate)) {
    return `Overdue by ${formatDistanceToNow(deadlineDate)}`;
  }

  if (isToday(deadlineDate)) {
    return `Today at ${format(deadlineDate, "h:mm a")}`;
  }

  if (isTomorrow(deadlineDate)) {
    return `Tomorrow at ${format(deadlineDate, "h:mm a")}`;
  }

  const daysRemaining = differenceInDays(deadlineDate, now);

  if (daysRemaining <= 7) {
    return format(deadlineDate, "EEEE 'at' h:mm a");
  }

  return format(deadlineDate, "MMM d, yyyy 'at' h:mm a");
}

/**
 * Format time remaining as countdown text
 */
export function formatTimeRemainingText(timeRemaining: TimeRemaining | null): string {
  if (!timeRemaining) return "";

  const { days, hours, minutes, isOverdue } = timeRemaining;
  const prefix = isOverdue ? "Overdue by " : "";

  if (days > 0) {
    return `${prefix}${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${prefix}${hours}h ${minutes}m`;
  }

  return `${prefix}${minutes}m`;
}

/**
 * Get comprehensive deadline information
 */
export function getDeadlineInfo(
  deadline: Date | string | null,
  priority: Priority = "NORMAL"
): DeadlineInfo | null {
  if (!deadline) return null;

  const deadlineDate = typeof deadline === "string" ? new Date(deadline) : deadline;
  const now = new Date();

  const timeRemaining = calculateTimeRemaining(deadline);
  if (!timeRemaining) return null;

  const urgencyLevel = determineUrgencyLevel(deadline, priority);
  const isOverdue = isPast(deadlineDate);
  const isDueToday = isToday(deadlineDate);
  const isDueTomorrow = isTomorrow(deadlineDate);
  const isDueSoon = !isOverdue && differenceInHours(deadlineDate, now) <= 48;

  return {
    timeRemaining,
    urgencyLevel,
    displayText: formatDeadlineDisplay(deadline),
    relativeText: formatTimeRemainingText(timeRemaining),
    isOverdue,
    isDueSoon,
    isDueToday,
    isDueTomorrow,
  };
}

/**
 * Check if a deadline is overdue
 */
export function isDeadlineOverdue(deadline: Date | string | null): boolean {
  if (!deadline) return false;
  const deadlineDate = typeof deadline === "string" ? new Date(deadline) : deadline;
  return isPast(deadlineDate);
}

/**
 * Check if deadline is within certain hours
 */
export function isDeadlineWithinHours(deadline: Date | string | null, hours: number): boolean {
  if (!deadline) return false;
  const deadlineDate = typeof deadline === "string" ? new Date(deadline) : deadline;
  const now = new Date();

  if (isPast(deadlineDate)) return false;

  return differenceInHours(deadlineDate, now) <= hours;
}

/**
 * Get quick deadline presets
 */
export function getDeadlinePresets(): Array<{ label: string; value: Date; description: string }> {
  const now = new Date();

  return [
    {
      label: "Tomorrow",
      value: startOfDay(addDays(now, 1)),
      description: format(addDays(now, 1), "EEEE, MMM d"),
    },
    {
      label: "End of Week",
      value: endOfWeek(now, { weekStartsOn: 1 }), // Monday start
      description: format(endOfWeek(now, { weekStartsOn: 1 }), "EEEE, MMM d"),
    },
    {
      label: "Next Week",
      value: startOfDay(addWeeks(now, 1)),
      description: format(addWeeks(now, 1), "EEEE, MMM d"),
    },
    {
      label: "In 2 Weeks",
      value: startOfDay(addWeeks(now, 2)),
      description: format(addWeeks(now, 2), "EEEE, MMM d"),
    },
    {
      label: "In 1 Month",
      value: startOfDay(addDays(now, 30)),
      description: format(addDays(now, 30), "EEEE, MMM d"),
    },
  ];
}

/**
 * Sort requests by priority and deadline
 */
export function sortByPriorityAndDeadline<
  T extends { urgency?: string; dueDate?: string | null }
>(items: T[]): T[] {
  if (!items || !Array.isArray(items)) return [];
  return [...items].sort((a, b) => {
    // First sort by overdue status
    const aOverdue = isDeadlineOverdue(a.dueDate || null);
    const bOverdue = isDeadlineOverdue(b.dueDate || null);

    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;

    // Then sort by priority
    const priorityOrder: Record<string, number> = {
      URGENT: 0,
      HIGH: 1,
      NORMAL: 2,
      LOW: 3,
    };

    const aPriority = priorityOrder[a.urgency || "NORMAL"] ?? 2;
    const bPriority = priorityOrder[b.urgency || "NORMAL"] ?? 2;

    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    // Then sort by deadline (closest first, no deadline last)
    if (a.dueDate && b.dueDate) {
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }

    if (a.dueDate && !b.dueDate) return -1;
    if (!a.dueDate && b.dueDate) return 1;

    return 0;
  });
}

/**
 * Group requests by priority level
 */
export function groupByPriority<T extends { urgency?: string }>(
  items: T[]
): Record<Priority, T[]> {
  const groups: Record<Priority, T[]> = {
    URGENT: [],
    HIGH: [],
    NORMAL: [],
    LOW: [],
  };

  if (!items || !Array.isArray(items)) return groups;

  items.forEach((item) => {
    const priority = (item.urgency as Priority) || "NORMAL";
    if (groups[priority]) {
      groups[priority].push(item);
    } else {
      groups.NORMAL.push(item);
    }
  });

  return groups;
}

/**
 * Get urgency level color classes
 */
export function getUrgencyLevelClasses(level: UrgencyLevel): {
  bg: string;
  text: string;
  border: string;
  ring: string;
} {
  const classes: Record<UrgencyLevel, { bg: string; text: string; border: string; ring: string }> = {
    overdue: {
      bg: "bg-red-100 dark:bg-red-900/40",
      text: "text-red-700 dark:text-red-400",
      border: "border-red-300 dark:border-red-700",
      ring: "ring-red-500/30",
    },
    critical: {
      bg: "bg-red-50 dark:bg-red-900/20",
      text: "text-red-600 dark:text-red-400",
      border: "border-red-200 dark:border-red-800",
      ring: "ring-red-500/20",
    },
    warning: {
      bg: "bg-amber-50 dark:bg-amber-900/20",
      text: "text-amber-600 dark:text-amber-400",
      border: "border-amber-200 dark:border-amber-800",
      ring: "ring-amber-500/20",
    },
    normal: {
      bg: "bg-blue-50 dark:bg-blue-900/20",
      text: "text-blue-600 dark:text-blue-400",
      border: "border-blue-200 dark:border-blue-800",
      ring: "ring-blue-500/20",
    },
    none: {
      bg: "bg-gray-50 dark:bg-gray-800/50",
      text: "text-gray-500 dark:text-gray-400",
      border: "border-gray-200 dark:border-gray-700",
      ring: "ring-gray-500/10",
    },
  };

  return classes[level] || classes.none;
}
