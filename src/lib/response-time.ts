import { db } from "./db";
import {
  differenceInMinutes,
  differenceInHours,
  differenceInBusinessDays,
  isWeekend,
  setHours,
  setMinutes,
  addDays,
  isBefore,
  isAfter,
  startOfDay,
  endOfDay,
  subDays,
  format,
  eachDayOfInterval,
} from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import type { DateRangeParams, DateRange } from "./analytics";

// Re-export types from response-time-types for convenience
export {
  SLA_THRESHOLDS,
  type Priority,
  type SLAType,
  type SLAStatus,
  type ResponseTimeMetrics,
  type ResponseTimeByCreator,
  type ResponseTimeByRequestType,
  type ResponseTimeTrend,
  type SLAComplianceMetrics,
  formatResponseTime,
  getSLAStatusColor,
  getSLAThreshold,
  calculateSLAStatusFromHours,
} from "./response-time-types";

import {
  SLA_THRESHOLDS,
  type Priority,
  type SLAType,
  type SLAStatus,
  type ResponseTimeMetrics,
  type ResponseTimeByCreator,
  type ResponseTimeByRequestType,
  type ResponseTimeTrend,
  type SLAComplianceMetrics,
} from "./response-time-types";

export interface BusinessHoursConfig {
  timezone: string;
  startHour: number; // 0-23
  endHour: number; // 0-23
  workDays: number[]; // 0 = Sunday, 6 = Saturday
}

const DEFAULT_BUSINESS_HOURS: BusinessHoursConfig = {
  timezone: "America/New_York",
  startHour: 9,
  endHour: 17,
  workDays: [1, 2, 3, 4, 5], // Monday to Friday
};

/**
 * Calculate business hours between two dates
 */
export function calculateBusinessHours(
  startDate: Date,
  endDate: Date,
  config: BusinessHoursConfig = DEFAULT_BUSINESS_HOURS
): number {
  const { timezone, startHour, endHour, workDays } = config;
  const hoursPerDay = endHour - startHour;

  // Convert to timezone
  const start = toZonedTime(startDate, timezone);
  const end = toZonedTime(endDate, timezone);

  if (isBefore(end, start)) return 0;

  let totalHours = 0;
  let current = start;

  while (isBefore(current, end)) {
    const dayOfWeek = current.getDay();
    const currentHour = current.getHours();

    // Check if it's a work day
    if (workDays.includes(dayOfWeek)) {
      // Calculate hours for this day
      const dayStart = setMinutes(setHours(current, startHour), 0);
      const dayEnd = setMinutes(setHours(current, endHour), 0);

      if (isBefore(current, dayStart)) {
        // Before business hours
        if (isBefore(end, dayEnd)) {
          // End is within this day's business hours
          if (isAfter(end, dayStart)) {
            totalHours += differenceInMinutes(end, dayStart) / 60;
          }
        } else {
          // End is after this day's business hours
          totalHours += hoursPerDay;
        }
      } else if (isBefore(current, dayEnd)) {
        // Within business hours
        if (isBefore(end, dayEnd)) {
          totalHours += differenceInMinutes(end, current) / 60;
        } else {
          totalHours += differenceInMinutes(dayEnd, current) / 60;
        }
      }
      // After business hours - no hours added
    }

    // Move to next day
    current = setMinutes(setHours(addDays(current, 1), startHour), 0);
  }

  return Math.max(0, totalHours);
}

/**
 * Calculate simple hours between two dates (not business hours)
 */
export function calculateHours(startDate: Date, endDate: Date): number {
  return Math.max(0, differenceInHours(endDate, startDate));
}

/**
 * Get SLA threshold for a given priority and type (internal use)
 */
function getSLAThresholdInternal(priority: Priority, type: SLAType): number {
  return SLA_THRESHOLDS[type][priority];
}

/**
 * Calculate SLA status for a request
 */
export function calculateSLAStatus(
  createdAt: Date,
  responseDate: Date | null,
  priority: Priority,
  type: SLAType,
  useBusinessHours: boolean = false,
  businessHoursConfig?: BusinessHoursConfig
): SLAStatus {
  const now = new Date();
  const checkDate = responseDate || now;
  const slaHours = getSLAThresholdInternal(priority, type);

  const hoursElapsed = useBusinessHours
    ? calculateBusinessHours(createdAt, checkDate, businessHoursConfig)
    : calculateHours(createdAt, checkDate);

  const hoursRemaining = Math.max(0, slaHours - hoursElapsed);
  const percentageUsed = Math.min(100, (hoursElapsed / slaHours) * 100);

  let status: SLAStatus["status"];
  if (responseDate) {
    // Already responded/completed
    status = hoursElapsed <= slaHours ? "met" : "breached";
  } else {
    // Still in progress
    if (hoursElapsed >= slaHours) {
      status = "breached";
    } else if (percentageUsed >= 75) {
      status = "at_risk";
    } else {
      status = "met";
    }
  }

  return {
    status,
    hoursRemaining,
    hoursElapsed: Math.round(hoursElapsed * 10) / 10,
    slaHours,
    percentageUsed: Math.round(percentageUsed * 10) / 10,
  };
}

/**
 * Map urgency string to priority
 */
export function urgencyToPriority(urgency: string): Priority {
  const mapping: Record<string, Priority> = {
    URGENT: "urgent",
    HIGH: "high",
    NORMAL: "normal",
    LOW: "low",
  };
  return mapping[urgency.toUpperCase()] || "normal";
}

/**
 * Get date range helper (reused from analytics)
 */
function getDateRange(params: DateRangeParams): { start: Date; end: Date } {
  const now = new Date();
  const end = endOfDay(now);

  switch (params.range) {
    case "7d":
      return { start: startOfDay(subDays(now, 7)), end };
    case "30d":
      return { start: startOfDay(subDays(now, 30)), end };
    case "90d":
      return { start: startOfDay(subDays(now, 90)), end };
    case "custom":
      return {
        start: params.startDate ? startOfDay(params.startDate) : startOfDay(subDays(now, 30)),
        end: params.endDate ? endOfDay(params.endDate) : end,
      };
    default:
      return { start: startOfDay(subDays(now, 30)), end };
  }
}

/**
 * Get response time metrics for an agency
 */
export async function getResponseTimeMetrics(
  agencyId: string,
  dateRangeParams: DateRangeParams,
  creatorId?: string
): Promise<ResponseTimeMetrics> {
  const { start, end } = getDateRange(dateRangeParams);
  const creatorFilter = creatorId ? { creatorId } : {};

  // Get all requests with their uploads
  const requests = await db.contentRequest.findMany({
    where: {
      agencyId,
      createdAt: { gte: start, lte: end },
      ...creatorFilter,
    },
    select: {
      id: true,
      createdAt: true,
      reviewedAt: true,
      urgency: true,
      uploads: {
        select: {
          uploadedAt: true,
        },
        orderBy: {
          uploadedAt: "asc",
        },
        take: 1, // First upload = first response
      },
    },
  });

  const firstResponseTimes: number[] = [];
  const completionTimes: number[] = [];
  let firstResponseSLAMet = 0;
  let completionSLAMet = 0;

  requests.forEach((request) => {
    const priority = urgencyToPriority(request.urgency);

    // First response time (first upload)
    if (request.uploads.length > 0 && request.uploads[0].uploadedAt) {
      const hours = calculateHours(request.createdAt, request.uploads[0].uploadedAt);
      firstResponseTimes.push(hours);

      const slaStatus = calculateSLAStatus(
        request.createdAt,
        request.uploads[0].uploadedAt,
        priority,
        "firstResponse"
      );
      if (slaStatus.status === "met") firstResponseSLAMet++;
    }

    // Completion time (reviewed)
    if (request.reviewedAt) {
      const hours = calculateHours(request.createdAt, request.reviewedAt);
      completionTimes.push(hours);

      const slaStatus = calculateSLAStatus(
        request.createdAt,
        request.reviewedAt,
        priority,
        "completion"
      );
      if (slaStatus.status === "met") completionSLAMet++;
    }
  });

  const sortedFirstResponse = [...firstResponseTimes].sort((a, b) => a - b);
  const sortedCompletion = [...completionTimes].sort((a, b) => a - b);

  return {
    avgFirstResponseHours:
      firstResponseTimes.length > 0
        ? Math.round((firstResponseTimes.reduce((a, b) => a + b, 0) / firstResponseTimes.length) * 10) / 10
        : 0,
    avgCompletionHours:
      completionTimes.length > 0
        ? Math.round((completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length) * 10) / 10
        : 0,
    medianFirstResponseHours:
      sortedFirstResponse.length > 0
        ? sortedFirstResponse[Math.floor(sortedFirstResponse.length / 2)]
        : 0,
    medianCompletionHours:
      sortedCompletion.length > 0
        ? sortedCompletion[Math.floor(sortedCompletion.length / 2)]
        : 0,
    minFirstResponseHours:
      sortedFirstResponse.length > 0 ? Math.min(...sortedFirstResponse) : 0,
    maxFirstResponseHours:
      sortedFirstResponse.length > 0 ? Math.max(...sortedFirstResponse) : 0,
    minCompletionHours:
      sortedCompletion.length > 0 ? Math.min(...sortedCompletion) : 0,
    maxCompletionHours:
      sortedCompletion.length > 0 ? Math.max(...sortedCompletion) : 0,
    totalRequests: requests.length,
    respondedRequests: firstResponseTimes.length,
    completedRequests: completionTimes.length,
    firstResponseSLACompliance:
      firstResponseTimes.length > 0
        ? Math.round((firstResponseSLAMet / firstResponseTimes.length) * 1000) / 10
        : 0,
    completionSLACompliance:
      completionTimes.length > 0
        ? Math.round((completionSLAMet / completionTimes.length) * 1000) / 10
        : 0,
  };
}

/**
 * Get SLA compliance metrics for an agency
 */
export async function getSLAComplianceMetrics(
  agencyId: string,
  dateRangeParams: DateRangeParams,
  creatorId?: string
): Promise<SLAComplianceMetrics> {
  const { start, end } = getDateRange(dateRangeParams);
  const creatorFilter = creatorId ? { creatorId } : {};

  const requests = await db.contentRequest.findMany({
    where: {
      agencyId,
      createdAt: { gte: start, lte: end },
      ...creatorFilter,
    },
    select: {
      id: true,
      createdAt: true,
      reviewedAt: true,
      urgency: true,
      uploads: {
        select: {
          uploadedAt: true,
        },
        orderBy: {
          uploadedAt: "asc",
        },
        take: 1,
      },
    },
  });

  let metSLA = 0;
  let atRiskSLA = 0;
  let breachedSLA = 0;
  let firstResponseMet = 0;
  let completionMet = 0;
  let firstResponseTotal = 0;
  let completionTotal = 0;

  const byPriorityMap: Record<Priority, { met: number; total: number }> = {
    urgent: { met: 0, total: 0 },
    high: { met: 0, total: 0 },
    normal: { met: 0, total: 0 },
    low: { met: 0, total: 0 },
  };

  requests.forEach((request) => {
    const priority = urgencyToPriority(request.urgency);

    // First response SLA
    if (request.uploads.length > 0 && request.uploads[0].uploadedAt) {
      firstResponseTotal++;
      const slaStatus = calculateSLAStatus(
        request.createdAt,
        request.uploads[0].uploadedAt,
        priority,
        "firstResponse"
      );
      if (slaStatus.status === "met") {
        firstResponseMet++;
        metSLA++;
        byPriorityMap[priority].met++;
      } else if (slaStatus.status === "at_risk") {
        atRiskSLA++;
      } else {
        breachedSLA++;
      }
      byPriorityMap[priority].total++;
    }

    // Completion SLA
    if (request.reviewedAt) {
      completionTotal++;
      const slaStatus = calculateSLAStatus(
        request.createdAt,
        request.reviewedAt,
        priority,
        "completion"
      );
      if (slaStatus.status === "met") {
        completionMet++;
        metSLA++;
        byPriorityMap[priority].met++;
      } else if (slaStatus.status === "at_risk") {
        atRiskSLA++;
      } else {
        breachedSLA++;
      }
      byPriorityMap[priority].total++;
    }
  });

  const byPriority = (Object.entries(byPriorityMap) as [Priority, { met: number; total: number }][])
    .filter(([_, data]) => data.total > 0)
    .map(([priority, data]) => ({
      priority,
      compliance: Math.round((data.met / data.total) * 1000) / 10,
      total: data.total,
    }));

  return {
    period: `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`,
    firstResponseCompliance:
      firstResponseTotal > 0
        ? Math.round((firstResponseMet / firstResponseTotal) * 1000) / 10
        : 0,
    completionCompliance:
      completionTotal > 0
        ? Math.round((completionMet / completionTotal) * 1000) / 10
        : 0,
    totalRequests: requests.length,
    metSLA,
    atRiskSLA,
    breachedSLA,
    byPriority,
  };
}

/**
 * Get response times grouped by creator
 */
export async function getResponseTimeByCreator(
  agencyId: string,
  dateRangeParams: DateRangeParams
): Promise<ResponseTimeByCreator[]> {
  const { start, end } = getDateRange(dateRangeParams);
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const prevStart = subDays(start, daysDiff);

  const creators = await db.creator.findMany({
    where: { agencyId },
    select: {
      id: true,
      name: true,
      uploads: {
        where: {
          uploadedAt: { gte: prevStart, lte: end },
        },
        select: {
          uploadedAt: true,
          request: {
            select: {
              createdAt: true,
              reviewedAt: true,
              urgency: true,
            },
          },
        },
      },
    },
  });

  return creators
    .map((creator) => {
      const currentPeriodUploads = creator.uploads.filter(
        (u) => u.uploadedAt && u.uploadedAt >= start
      );
      const prevPeriodUploads = creator.uploads.filter(
        (u) => u.uploadedAt && u.uploadedAt < start
      );

      const firstResponseTimes: number[] = [];
      const completionTimes: number[] = [];
      let slaMet = 0;
      let slaTotal = 0;

      currentPeriodUploads.forEach((upload) => {
        if (upload.uploadedAt) {
          const firstResponseHours = calculateHours(upload.request.createdAt, upload.uploadedAt);
          firstResponseTimes.push(firstResponseHours);

          // Check SLA
          const priority = urgencyToPriority(upload.request.urgency);
          const slaStatus = calculateSLAStatus(
            upload.request.createdAt,
            upload.uploadedAt,
            priority,
            "firstResponse"
          );
          slaTotal++;
          if (slaStatus.status === "met") slaMet++;
        }

        if (upload.request.reviewedAt) {
          const completionHours = calculateHours(upload.request.createdAt, upload.request.reviewedAt);
          completionTimes.push(completionHours);
        }
      });

      // Calculate trend based on SLA compliance vs previous period
      const prevSlaMet = prevPeriodUploads.filter((u) => {
        if (!u.uploadedAt) return false;
        const priority = urgencyToPriority(u.request.urgency);
        const slaStatus = calculateSLAStatus(
          u.request.createdAt,
          u.uploadedAt,
          priority,
          "firstResponse"
        );
        return slaStatus.status === "met";
      }).length;
      const prevSlaTotal = prevPeriodUploads.length;

      const currentCompliance = slaTotal > 0 ? slaMet / slaTotal : 0;
      const prevCompliance = prevSlaTotal > 0 ? prevSlaMet / prevSlaTotal : 0;

      let trend: "improving" | "stable" | "declining" = "stable";
      if (currentCompliance > prevCompliance + 0.1) trend = "improving";
      else if (currentCompliance < prevCompliance - 0.1) trend = "declining";

      return {
        creatorId: creator.id,
        creatorName: creator.name,
        avgFirstResponseHours:
          firstResponseTimes.length > 0
            ? Math.round((firstResponseTimes.reduce((a, b) => a + b, 0) / firstResponseTimes.length) * 10) / 10
            : 0,
        avgCompletionHours:
          completionTimes.length > 0
            ? Math.round((completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length) * 10) / 10
            : 0,
        totalRequests: currentPeriodUploads.length,
        completedRequests: completionTimes.length,
        firstResponseSLACompliance:
          slaTotal > 0 ? Math.round((slaMet / slaTotal) * 1000) / 10 : 0,
        trend,
      };
    })
    .filter((c) => c.totalRequests > 0)
    .sort((a, b) => a.avgFirstResponseHours - b.avgFirstResponseHours);
}

/**
 * Get response times grouped by request type (based on template name)
 */
export async function getResponseTimeByRequestType(
  agencyId: string,
  dateRangeParams: DateRangeParams,
  creatorId?: string
): Promise<ResponseTimeByRequestType[]> {
  const { start, end } = getDateRange(dateRangeParams);
  const creatorFilter = creatorId ? { creatorId } : {};

  const requests = await db.contentRequest.findMany({
    where: {
      agencyId,
      createdAt: { gte: start, lte: end },
      ...creatorFilter,
    },
    select: {
      id: true,
      createdAt: true,
      reviewedAt: true,
      urgency: true,
      template: {
        select: {
          name: true,
        },
      },
      uploads: {
        select: {
          uploadedAt: true,
        },
        orderBy: {
          uploadedAt: "asc",
        },
        take: 1,
      },
    },
  });

  const typeGroups: Record<
    string,
    {
      firstResponseTimes: number[];
      completionTimes: number[];
      count: number;
    }
  > = {};

  requests.forEach((request) => {
    const type = request.template?.name || "Custom Request";
    if (!typeGroups[type]) {
      typeGroups[type] = {
        firstResponseTimes: [],
        completionTimes: [],
        count: 0,
      };
    }

    typeGroups[type].count++;

    if (request.uploads.length > 0 && request.uploads[0].uploadedAt) {
      const hours = calculateHours(request.createdAt, request.uploads[0].uploadedAt);
      typeGroups[type].firstResponseTimes.push(hours);
    }

    if (request.reviewedAt) {
      const hours = calculateHours(request.createdAt, request.reviewedAt);
      typeGroups[type].completionTimes.push(hours);
    }
  });

  return Object.entries(typeGroups)
    .map(([type, data]) => ({
      type,
      avgFirstResponseHours:
        data.firstResponseTimes.length > 0
          ? Math.round(
              (data.firstResponseTimes.reduce((a, b) => a + b, 0) / data.firstResponseTimes.length) * 10
            ) / 10
          : 0,
      avgCompletionHours:
        data.completionTimes.length > 0
          ? Math.round(
              (data.completionTimes.reduce((a, b) => a + b, 0) / data.completionTimes.length) * 10
            ) / 10
          : 0,
      requestCount: data.count,
    }))
    .sort((a, b) => b.requestCount - a.requestCount);
}

/**
 * Get response time trends over time
 */
export async function getResponseTimeTrends(
  agencyId: string,
  dateRangeParams: DateRangeParams,
  creatorId?: string
): Promise<ResponseTimeTrend[]> {
  const { start, end } = getDateRange(dateRangeParams);
  const creatorFilter = creatorId ? { creatorId } : {};

  const requests = await db.contentRequest.findMany({
    where: {
      agencyId,
      createdAt: { gte: start, lte: end },
      ...creatorFilter,
    },
    select: {
      id: true,
      createdAt: true,
      reviewedAt: true,
      urgency: true,
      uploads: {
        select: {
          uploadedAt: true,
        },
        orderBy: {
          uploadedAt: "asc",
        },
        take: 1,
      },
    },
  });

  // Group by date
  const dateGroups: Record<
    string,
    {
      firstResponseTimes: number[];
      completionTimes: number[];
      slaMet: number;
      slaTotal: number;
    }
  > = {};

  // Initialize all dates in range
  const allDays = eachDayOfInterval({ start, end });
  allDays.forEach((day) => {
    const dateStr = format(day, "yyyy-MM-dd");
    dateGroups[dateStr] = {
      firstResponseTimes: [],
      completionTimes: [],
      slaMet: 0,
      slaTotal: 0,
    };
  });

  requests.forEach((request) => {
    const dateStr = format(request.createdAt, "yyyy-MM-dd");
    if (!dateGroups[dateStr]) return;

    const priority = urgencyToPriority(request.urgency);

    if (request.uploads.length > 0 && request.uploads[0].uploadedAt) {
      const hours = calculateHours(request.createdAt, request.uploads[0].uploadedAt);
      dateGroups[dateStr].firstResponseTimes.push(hours);

      const slaStatus = calculateSLAStatus(
        request.createdAt,
        request.uploads[0].uploadedAt,
        priority,
        "firstResponse"
      );
      dateGroups[dateStr].slaTotal++;
      if (slaStatus.status === "met") dateGroups[dateStr].slaMet++;
    }

    if (request.reviewedAt) {
      const hours = calculateHours(request.createdAt, request.reviewedAt);
      dateGroups[dateStr].completionTimes.push(hours);
    }
  });

  return Object.entries(dateGroups)
    .map(([date, data]) => ({
      date,
      avgFirstResponseHours:
        data.firstResponseTimes.length > 0
          ? Math.round(
              (data.firstResponseTimes.reduce((a, b) => a + b, 0) / data.firstResponseTimes.length) * 10
            ) / 10
          : 0,
      avgCompletionHours:
        data.completionTimes.length > 0
          ? Math.round(
              (data.completionTimes.reduce((a, b) => a + b, 0) / data.completionTimes.length) * 10
            ) / 10
          : 0,
      requestCount: data.firstResponseTimes.length,
      slaCompliance:
        data.slaTotal > 0 ? Math.round((data.slaMet / data.slaTotal) * 1000) / 10 : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Get comprehensive response time analytics
 */
export async function getResponseTimeAnalytics(
  agencyId: string,
  dateRangeParams: DateRangeParams,
  creatorId?: string
) {
  const [metrics, slaCompliance, byCreator, byRequestType, trends] = await Promise.all([
    getResponseTimeMetrics(agencyId, dateRangeParams, creatorId),
    getSLAComplianceMetrics(agencyId, dateRangeParams, creatorId),
    // Only show by-creator breakdown when viewing all creators
    creatorId ? Promise.resolve([]) : getResponseTimeByCreator(agencyId, dateRangeParams),
    getResponseTimeByRequestType(agencyId, dateRangeParams, creatorId),
    getResponseTimeTrends(agencyId, dateRangeParams, creatorId),
  ]);

  return {
    metrics,
    slaCompliance,
    byCreator,
    byRequestType,
    trends,
  };
}

/**
 * Get urgency color
 */
export function getUrgencyColor(urgency: string): string {
  const colors: Record<string, string> = {
    URGENT: "text-red-500",
    HIGH: "text-orange-500",
    NORMAL: "text-blue-500",
    LOW: "text-gray-500",
  };
  return colors[urgency.toUpperCase()] || "text-gray-500";
}
