// ============================================
// TIMEZONE UTILITIES
// Using Intl.DateTimeFormat API
// ============================================

import {
  TimezoneEntry,
  TimezoneRegion,
  BusinessHours,
  DateFormatOption,
  RelativeTimeUnit,
  COMMON_TIMEZONES,
} from "@/types/timezone";

// ============================================
// TIMEZONE DETECTION & INFORMATION
// ============================================

/**
 * Detect user's local timezone from browser
 */
export function detectLocalTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

/**
 * Check if a timezone ID is valid
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the current offset in minutes for a timezone
 */
export function getTimezoneOffsetMinutes(timezone: string, date: Date = new Date()): number {
  try {
    const utcDate = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
    const tzDate = new Date(date.toLocaleString("en-US", { timeZone: timezone }));
    return (tzDate.getTime() - utcDate.getTime()) / (1000 * 60);
  } catch {
    return 0;
  }
}

/**
 * Get formatted offset string (e.g., "+05:30", "-08:00")
 */
export function getTimezoneOffsetString(timezone: string, date: Date = new Date()): string {
  const offsetMinutes = getTimezoneOffsetMinutes(timezone, date);
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absMinutes = Math.abs(offsetMinutes);
  const hours = Math.floor(absMinutes / 60);
  const minutes = absMinutes % 60;
  return `${sign}${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

/**
 * Get timezone abbreviation (e.g., "PST", "EST")
 */
export function getTimezoneAbbreviation(timezone: string, date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "short",
    });
    const parts = formatter.formatToParts(date);
    const tzPart = parts.find((part) => part.type === "timeZoneName");
    return tzPart?.value || "";
  } catch {
    return "";
  }
}

/**
 * Get timezone long name
 */
export function getTimezoneLongName(timezone: string, date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "long",
    });
    const parts = formatter.formatToParts(date);
    const tzPart = parts.find((part) => part.type === "timeZoneName");
    return tzPart?.value || timezone;
  } catch {
    return timezone;
  }
}

/**
 * Extract region from IANA timezone ID
 */
export function getTimezoneRegion(timezone: string): TimezoneRegion {
  const parts = timezone.split("/");
  const region = parts[0];

  switch (region) {
    case "America":
      return "Americas";
    case "Europe":
      return "Europe";
    case "Asia":
      return "Asia";
    case "Pacific":
      return "Pacific";
    case "Africa":
      return "Africa";
    case "Atlantic":
      return "Atlantic";
    case "Indian":
      return "Indian";
    case "Australia":
      return "Australia";
    default:
      return "Other";
  }
}

/**
 * Extract city name from IANA timezone ID
 */
export function getTimezoneCity(timezone: string): string {
  const parts = timezone.split("/");
  const city = parts[parts.length - 1];
  return city.replace(/_/g, " ");
}

/**
 * Get full timezone entry with metadata
 */
export function getTimezoneEntry(timezone: string, date: Date = new Date()): TimezoneEntry {
  return {
    id: timezone,
    name: getTimezoneLongName(timezone, date),
    region: getTimezoneRegion(timezone),
    offset: getTimezoneOffsetString(timezone, date),
    offsetMinutes: getTimezoneOffsetMinutes(timezone, date),
    abbreviation: getTimezoneAbbreviation(timezone, date),
    city: getTimezoneCity(timezone),
  };
}

/**
 * Get all available IANA timezones grouped by region
 */
export function getAllTimezones(): TimezoneEntry[] {
  // Get all supported timezones (modern browsers)
  const timezones = Intl.supportedValuesOf
    ? Intl.supportedValuesOf("timeZone")
    : COMMON_TIMEZONES;

  const now = new Date();
  return timezones
    .map((tz) => getTimezoneEntry(tz, now))
    .sort((a, b) => a.offsetMinutes - b.offsetMinutes || a.name.localeCompare(b.name));
}

/**
 * Get timezones grouped by region
 */
export function getTimezonesByRegion(): Map<TimezoneRegion, TimezoneEntry[]> {
  const timezones = getAllTimezones();
  const grouped = new Map<TimezoneRegion, TimezoneEntry[]>();

  for (const tz of timezones) {
    const existing = grouped.get(tz.region) || [];
    existing.push(tz);
    grouped.set(tz.region, existing);
  }

  return grouped;
}

/**
 * Search timezones by query
 */
export function searchTimezones(query: string): TimezoneEntry[] {
  const normalizedQuery = query.toLowerCase().trim();
  if (!normalizedQuery) {
    return getAllTimezones();
  }

  return getAllTimezones().filter(
    (tz) =>
      tz.id.toLowerCase().includes(normalizedQuery) ||
      tz.name.toLowerCase().includes(normalizedQuery) ||
      tz.city?.toLowerCase().includes(normalizedQuery) ||
      tz.abbreviation?.toLowerCase().includes(normalizedQuery) ||
      tz.offset.includes(normalizedQuery)
  );
}

// ============================================
// DATE CONVERSION
// ============================================

/**
 * Convert a date from one timezone to another
 */
export function convertTimezone(
  date: Date | string | number,
  fromTimezone: string,
  toTimezone: string
): Date {
  const inputDate = new Date(date);

  // Get the time in the source timezone
  const sourceString = inputDate.toLocaleString("en-US", { timeZone: fromTimezone });
  const sourceDate = new Date(sourceString);

  // Get the UTC equivalent
  const utcDate = new Date(
    inputDate.getTime() + (inputDate.getTime() - sourceDate.getTime())
  );

  // Convert to target timezone
  const targetString = utcDate.toLocaleString("en-US", { timeZone: toTimezone });
  return new Date(targetString);
}

/**
 * Convert a UTC date to a specific timezone
 */
export function utcToTimezone(date: Date | string | number, timezone: string): Date {
  return convertTimezone(date, "UTC", timezone);
}

/**
 * Convert a date from a specific timezone to UTC
 */
export function timezoneToUtc(date: Date | string | number, timezone: string): Date {
  return convertTimezone(date, timezone, "UTC");
}

/**
 * Get current time in a specific timezone
 */
export function getCurrentTimeInTimezone(timezone: string): Date {
  const now = new Date();
  const tzString = now.toLocaleString("en-US", { timeZone: timezone });
  return new Date(tzString);
}

// ============================================
// DATE FORMATTING
// ============================================

/**
 * Format a date for display in a specific timezone
 */
export function formatDateInTimezone(
  date: Date | string | number,
  timezone: string,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const inputDate = new Date(date);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    ...options,
  }).format(inputDate);
}

/**
 * Format date with time in a specific timezone
 */
export function formatDateTime(
  date: Date | string | number,
  timezone: string,
  options: {
    dateStyle?: "full" | "long" | "medium" | "short";
    timeStyle?: "full" | "long" | "medium" | "short";
    hour12?: boolean;
    showTimezone?: boolean;
  } = {}
): string {
  const {
    dateStyle = "medium",
    timeStyle = "short",
    hour12 = true,
    showTimezone = false,
  } = options;

  const inputDate = new Date(date);
  const formatOptions: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    dateStyle,
    timeStyle,
    hour12,
  };

  if (showTimezone) {
    // Can't use dateStyle/timeStyle with timeZoneName, so format separately
    const datePart = formatDateInTimezone(inputDate, timezone, { dateStyle });
    const timePart = formatDateInTimezone(inputDate, timezone, { timeStyle, hour12 });
    const tzAbbr = getTimezoneAbbreviation(timezone, inputDate);
    return `${datePart} ${timePart} ${tzAbbr}`;
  }

  return new Intl.DateTimeFormat("en-US", formatOptions).format(inputDate);
}

/**
 * Format date only (no time)
 */
export function formatDate(
  date: Date | string | number,
  timezone: string,
  format: DateFormatOption = "MMM D, YYYY"
): string {
  const inputDate = new Date(date);
  const tzDate = new Date(inputDate.toLocaleString("en-US", { timeZone: timezone }));

  const day = tzDate.getDate();
  const month = tzDate.getMonth();
  const year = tzDate.getFullYear();

  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

  switch (format) {
    case "MM/DD/YYYY":
      return `${(month + 1).toString().padStart(2, "0")}/${day.toString().padStart(2, "0")}/${year}`;
    case "DD/MM/YYYY":
      return `${day.toString().padStart(2, "0")}/${(month + 1).toString().padStart(2, "0")}/${year}`;
    case "YYYY-MM-DD":
      return `${year}-${(month + 1).toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
    case "MMM D, YYYY":
      return `${monthNames[month]} ${day}, ${year}`;
    case "D MMM YYYY":
      return `${day} ${monthNames[month]} ${year}`;
    default:
      return `${monthNames[month]} ${day}, ${year}`;
  }
}

/**
 * Format time only (no date)
 */
export function formatTime(
  date: Date | string | number,
  timezone: string,
  options: { hour12?: boolean; showTimezone?: boolean } = {}
): string {
  const { hour12 = true, showTimezone = false } = options;
  const inputDate = new Date(date);

  let formatted = formatDateInTimezone(inputDate, timezone, {
    hour: "numeric",
    minute: "2-digit",
    hour12,
  });

  if (showTimezone) {
    formatted += ` ${getTimezoneAbbreviation(timezone, inputDate)}`;
  }

  return formatted;
}

/**
 * Get ISO 8601 string in a specific timezone
 */
export function toISOStringInTimezone(date: Date | string | number, timezone: string): string {
  const inputDate = new Date(date);
  const tzDate = new Date(inputDate.toLocaleString("en-US", { timeZone: timezone }));

  const year = tzDate.getFullYear();
  const month = (tzDate.getMonth() + 1).toString().padStart(2, "0");
  const day = tzDate.getDate().toString().padStart(2, "0");
  const hours = tzDate.getHours().toString().padStart(2, "0");
  const minutes = tzDate.getMinutes().toString().padStart(2, "0");
  const seconds = tzDate.getSeconds().toString().padStart(2, "0");
  const offset = getTimezoneOffsetString(timezone, inputDate);

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${offset}`;
}

// ============================================
// RELATIVE TIME
// ============================================

/**
 * Get relative time string (e.g., "2 hours ago", "in 3 days")
 */
export function getRelativeTime(
  date: Date | string | number,
  baseDate: Date = new Date(),
  options: { timezone?: string; style?: "long" | "short" | "narrow" } = {}
): string {
  const { style = "long" } = options;
  const inputDate = new Date(date);
  const diff = inputDate.getTime() - baseDate.getTime();
  const absDiff = Math.abs(diff);

  // Determine the appropriate unit
  let value: number;
  let unit: RelativeTimeUnit;

  if (absDiff < 60 * 1000) {
    value = Math.round(diff / 1000);
    unit = "seconds";
  } else if (absDiff < 60 * 60 * 1000) {
    value = Math.round(diff / (60 * 1000));
    unit = "minutes";
  } else if (absDiff < 24 * 60 * 60 * 1000) {
    value = Math.round(diff / (60 * 60 * 1000));
    unit = "hours";
  } else if (absDiff < 7 * 24 * 60 * 60 * 1000) {
    value = Math.round(diff / (24 * 60 * 60 * 1000));
    unit = "days";
  } else if (absDiff < 30 * 24 * 60 * 60 * 1000) {
    value = Math.round(diff / (7 * 24 * 60 * 60 * 1000));
    unit = "weeks";
  } else if (absDiff < 365 * 24 * 60 * 60 * 1000) {
    value = Math.round(diff / (30 * 24 * 60 * 60 * 1000));
    unit = "months";
  } else {
    value = Math.round(diff / (365 * 24 * 60 * 60 * 1000));
    unit = "years";
  }

  try {
    const rtf = new Intl.RelativeTimeFormat("en", { style });
    return rtf.format(value, unit);
  } catch {
    // Fallback for browsers without RelativeTimeFormat
    const absValue = Math.abs(value);
    const unitLabel = absValue === 1 ? unit.slice(0, -1) : unit;
    return diff < 0
      ? `${absValue} ${unitLabel} ago`
      : `in ${absValue} ${unitLabel}`;
  }
}

/**
 * Check if a date is today in a given timezone
 */
export function isToday(date: Date | string | number, timezone: string): boolean {
  const inputDate = new Date(date);
  const now = new Date();

  const inputDayStart = formatDate(inputDate, timezone, "YYYY-MM-DD");
  const todayStart = formatDate(now, timezone, "YYYY-MM-DD");

  return inputDayStart === todayStart;
}

/**
 * Check if a date is yesterday in a given timezone
 */
export function isYesterday(date: Date | string | number, timezone: string): boolean {
  const inputDate = new Date(date);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const inputDayStart = formatDate(inputDate, timezone, "YYYY-MM-DD");
  const yesterdayStart = formatDate(yesterday, timezone, "YYYY-MM-DD");

  return inputDayStart === yesterdayStart;
}

/**
 * Check if a date is tomorrow in a given timezone
 */
export function isTomorrow(date: Date | string | number, timezone: string): boolean {
  const inputDate = new Date(date);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const inputDayStart = formatDate(inputDate, timezone, "YYYY-MM-DD");
  const tomorrowStart = formatDate(tomorrow, timezone, "YYYY-MM-DD");

  return inputDayStart === tomorrowStart;
}

/**
 * Get smart relative date (e.g., "Today", "Yesterday", "Tomorrow", or date)
 */
export function getSmartRelativeDate(
  date: Date | string | number,
  timezone: string,
  options: { showTime?: boolean; hour12?: boolean } = {}
): string {
  const { showTime = false, hour12 = true } = options;

  let dateStr: string;
  if (isToday(date, timezone)) {
    dateStr = "Today";
  } else if (isYesterday(date, timezone)) {
    dateStr = "Yesterday";
  } else if (isTomorrow(date, timezone)) {
    dateStr = "Tomorrow";
  } else {
    dateStr = formatDate(date, timezone);
  }

  if (showTime) {
    dateStr += ` at ${formatTime(date, timezone, { hour12 })}`;
  }

  return dateStr;
}

// ============================================
// BUSINESS HOURS
// ============================================

/**
 * Check if current time is within business hours
 */
export function isWithinBusinessHours(
  date: Date | string | number,
  businessHours: BusinessHours
): boolean {
  const inputDate = new Date(date);
  const tzDate = getCurrentTimeInTimezone(businessHours.timezone);

  // Check if it's a work day
  const dayOfWeek = tzDate.getDay();
  if (!businessHours.workDays.includes(dayOfWeek)) {
    return false;
  }

  // Parse business hours
  const [startHour, startMinute] = businessHours.start.split(":").map(Number);
  const [endHour, endMinute] = businessHours.end.split(":").map(Number);

  const currentMinutes = tzDate.getHours() * 60 + tzDate.getMinutes();
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;

  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

/**
 * Get next business hours start time
 */
export function getNextBusinessHoursStart(businessHours: BusinessHours): Date {
  const now = getCurrentTimeInTimezone(businessHours.timezone);
  const [startHour, startMinute] = businessHours.start.split(":").map(Number);

  let checkDate = new Date(now);
  checkDate.setHours(startHour, startMinute, 0, 0);

  // If we're past today's start time, move to next day
  if (now > checkDate) {
    checkDate.setDate(checkDate.getDate() + 1);
  }

  // Find the next work day
  let maxIterations = 7;
  while (!businessHours.workDays.includes(checkDate.getDay()) && maxIterations > 0) {
    checkDate.setDate(checkDate.getDate() + 1);
    maxIterations--;
  }

  return checkDate;
}

/**
 * Get next business hours end time
 */
export function getNextBusinessHoursEnd(businessHours: BusinessHours): Date {
  const now = getCurrentTimeInTimezone(businessHours.timezone);
  const [endHour, endMinute] = businessHours.end.split(":").map(Number);

  let checkDate = new Date(now);
  checkDate.setHours(endHour, endMinute, 0, 0);

  // If we're past today's end time or not a work day, find next work day
  if (now > checkDate || !businessHours.workDays.includes(checkDate.getDay())) {
    checkDate.setDate(checkDate.getDate() + 1);
    while (!businessHours.workDays.includes(checkDate.getDay())) {
      checkDate.setDate(checkDate.getDate() + 1);
    }
  }

  return checkDate;
}

/**
 * Calculate deadline considering business hours only
 */
export function addBusinessHours(
  startDate: Date | string | number,
  hoursToAdd: number,
  businessHours: BusinessHours
): Date {
  const start = new Date(startDate);
  let remainingHours = hoursToAdd;
  let currentDate = new Date(start);

  const [startHour, startMinute] = businessHours.start.split(":").map(Number);
  const [endHour, endMinute] = businessHours.end.split(":").map(Number);
  const dailyBusinessHours = (endHour * 60 + endMinute - (startHour * 60 + startMinute)) / 60;

  while (remainingHours > 0) {
    // Skip non-work days
    if (!businessHours.workDays.includes(currentDate.getDay())) {
      currentDate.setDate(currentDate.getDate() + 1);
      currentDate.setHours(startHour, startMinute, 0, 0);
      continue;
    }

    const currentMinutes = currentDate.getHours() * 60 + currentDate.getMinutes();
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    // If before business hours, move to start
    if (currentMinutes < startMinutes) {
      currentDate.setHours(startHour, startMinute, 0, 0);
    }

    // If after business hours, move to next day
    if (currentMinutes >= endMinutes) {
      currentDate.setDate(currentDate.getDate() + 1);
      currentDate.setHours(startHour, startMinute, 0, 0);
      continue;
    }

    // Calculate remaining hours in current day
    const minutesUntilEnd = endMinutes - (currentDate.getHours() * 60 + currentDate.getMinutes());
    const hoursUntilEnd = minutesUntilEnd / 60;

    if (remainingHours <= hoursUntilEnd) {
      // Finish within today
      currentDate.setMinutes(currentDate.getMinutes() + remainingHours * 60);
      remainingHours = 0;
    } else {
      // Move to next day and continue
      remainingHours -= hoursUntilEnd;
      currentDate.setDate(currentDate.getDate() + 1);
      currentDate.setHours(startHour, startMinute, 0, 0);
    }
  }

  return currentDate;
}

/**
 * Calculate business days between two dates
 */
export function getBusinessDaysBetween(
  startDate: Date | string | number,
  endDate: Date | string | number,
  businessHours: BusinessHours
): number {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (start > end) return 0;

  let count = 0;
  const current = new Date(start);

  while (current <= end) {
    if (businessHours.workDays.includes(current.getDay())) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

// ============================================
// DUE DATE HELPERS
// ============================================

/**
 * Check if a due date is overdue
 */
export function isDueDateOverdue(dueDate: Date | string | number, timezone: string): boolean {
  const due = new Date(dueDate);
  const now = new Date();
  return due < now;
}

/**
 * Check if a due date is due soon (within specified hours)
 */
export function isDueDateSoon(
  dueDate: Date | string | number,
  timezone: string,
  withinHours: number = 24
): boolean {
  const due = new Date(dueDate);
  const now = new Date();
  const threshold = new Date(now.getTime() + withinHours * 60 * 60 * 1000);
  return due > now && due <= threshold;
}

/**
 * Get due date status
 */
export function getDueDateStatus(
  dueDate: Date | string | number,
  timezone: string
): "overdue" | "due-today" | "due-soon" | "upcoming" | "no-date" {
  if (!dueDate) return "no-date";

  const due = new Date(dueDate);
  const now = new Date();

  if (isDueDateOverdue(due, timezone)) {
    return "overdue";
  }

  if (isToday(due, timezone)) {
    return "due-today";
  }

  if (isDueDateSoon(due, timezone, 48)) {
    return "due-soon";
  }

  return "upcoming";
}

/**
 * Format due date with status-aware formatting
 */
export function formatDueDate(
  dueDate: Date | string | number,
  timezone: string,
  options: { showTime?: boolean; showRelative?: boolean } = {}
): { text: string; status: ReturnType<typeof getDueDateStatus> } {
  const { showTime = true, showRelative = true } = options;
  const status = getDueDateStatus(dueDate, timezone);

  let text: string;
  switch (status) {
    case "overdue":
      text = showRelative
        ? `Overdue (${getRelativeTime(dueDate)})`
        : `Overdue - ${getSmartRelativeDate(dueDate, timezone, { showTime })}`;
      break;
    case "due-today":
      text = showTime
        ? `Today at ${formatTime(dueDate, timezone)}`
        : "Today";
      break;
    case "due-soon":
      text = showRelative
        ? getRelativeTime(dueDate)
        : getSmartRelativeDate(dueDate, timezone, { showTime });
      break;
    default:
      text = getSmartRelativeDate(dueDate, timezone, { showTime });
  }

  return { text, status };
}
