// Client-safe types and utility functions for response time
// This file should NOT import db.ts or any server-only modules

// SLA Thresholds (in hours)
export const SLA_THRESHOLDS = {
  // First response time SLAs
  firstResponse: {
    urgent: 4, // 4 hours for urgent requests
    high: 8, // 8 hours for high priority
    normal: 24, // 24 hours for normal priority
    low: 48, // 48 hours for low priority
  },
  // Full completion time SLAs
  completion: {
    urgent: 24, // 1 day for urgent
    high: 48, // 2 days for high priority
    normal: 72, // 3 days for normal priority
    low: 120, // 5 days for low priority
  },
} as const;

export type Priority = keyof typeof SLA_THRESHOLDS.firstResponse;
export type SLAType = "firstResponse" | "completion";

export interface SLAStatus {
  status: "met" | "at_risk" | "breached";
  hoursRemaining: number;
  hoursElapsed: number;
  slaHours: number;
  percentageUsed: number;
}

export interface ResponseTimeMetrics {
  avgFirstResponseHours: number;
  avgCompletionHours: number;
  medianFirstResponseHours: number;
  medianCompletionHours: number;
  minFirstResponseHours: number;
  maxFirstResponseHours: number;
  minCompletionHours: number;
  maxCompletionHours: number;
  totalRequests: number;
  respondedRequests: number;
  completedRequests: number;
  firstResponseSLACompliance: number;
  completionSLACompliance: number;
}

export interface ResponseTimeByCreator {
  creatorId: string;
  creatorName: string;
  avgFirstResponseHours: number;
  avgCompletionHours: number;
  totalRequests: number;
  completedRequests: number;
  firstResponseSLACompliance: number;
  trend: "improving" | "stable" | "declining";
}

export interface ResponseTimeByRequestType {
  type: string;
  avgFirstResponseHours: number;
  avgCompletionHours: number;
  requestCount: number;
}

export interface ResponseTimeTrend {
  date: string;
  avgFirstResponseHours: number;
  avgCompletionHours: number;
  slaCompliance: number;
  requestCount: number;
}

export interface SLAComplianceMetrics {
  period: string;
  firstResponseCompliance: number;
  completionCompliance: number;
  totalRequests: number;
  metSLA: number;
  atRiskSLA: number;
  breachedSLA: number;
  byPriority: {
    priority: Priority;
    compliance: number;
    total: number;
  }[];
}

// Utility function that's safe for client-side use
export function formatResponseTime(hours: number): string {
  if (hours < 1) {
    return `${Math.round(hours * 60)}m`;
  } else if (hours < 24) {
    return `${Math.round(hours * 10) / 10}h`;
  } else {
    const days = Math.floor(hours / 24);
    const remainingHours = Math.round(hours % 24);
    if (remainingHours === 0) {
      return `${days}d`;
    }
    return `${days}d ${remainingHours}h`;
  }
}

// SLA status calculation that's safe for client-side use
export function calculateSLAStatusFromHours(
  hoursElapsed: number,
  slaHours: number
): SLAStatus {
  const hoursRemaining = Math.max(0, slaHours - hoursElapsed);
  const percentageUsed = (hoursElapsed / slaHours) * 100;

  let status: SLAStatus["status"];
  if (hoursElapsed > slaHours) {
    status = "breached";
  } else if (percentageUsed > 75) {
    status = "at_risk";
  } else {
    status = "met";
  }

  return {
    status,
    hoursRemaining,
    hoursElapsed,
    slaHours,
    percentageUsed,
  };
}

// Get SLA threshold hours for a priority
export function getSLAThreshold(priority: Priority, type: SLAType): number {
  return SLA_THRESHOLDS[type][priority];
}

// Format SLA status for display
export function formatSLAStatus(status: SLAStatus): string {
  switch (status.status) {
    case "met":
      return `On track (${formatResponseTime(status.hoursRemaining)} remaining)`;
    case "at_risk":
      return `At risk (${formatResponseTime(status.hoursRemaining)} remaining)`;
    case "breached":
      return `SLA breached by ${formatResponseTime(Math.abs(status.hoursRemaining))}`;
    default:
      return "Unknown";
  }
}

// Get SLA status color
export function getSLAStatusColor(status: SLAStatus["status"]): string {
  switch (status) {
    case "met":
      return "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400";
    case "at_risk":
      return "text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400";
    case "breached":
      return "text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400";
    default:
      return "text-gray-600 bg-gray-50 dark:bg-gray-900/20 dark:text-gray-400";
  }
}
