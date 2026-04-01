// ============================================
// TIMEZONE TYPES AND CONSTANTS
// ============================================

/**
 * Timezone region for grouping
 */
export type TimezoneRegion =
  | "Americas"
  | "Europe"
  | "Asia"
  | "Pacific"
  | "Africa"
  | "Atlantic"
  | "Indian"
  | "Australia"
  | "Other";

/**
 * Timezone entry with metadata
 */
export interface TimezoneEntry {
  id: string; // IANA timezone identifier
  name: string; // Display name
  region: TimezoneRegion;
  offset: string; // e.g., "+05:30", "-08:00"
  offsetMinutes: number; // Offset in minutes for sorting
  abbreviation?: string; // e.g., "PST", "EST"
  city?: string; // Main city
}

/**
 * User timezone preferences
 */
export interface TimezonePreferences {
  timezone: string; // IANA timezone identifier
  autoDetect: boolean;
  use24HourFormat: boolean;
  showTimezoneAbbreviation: boolean;
  dateFormat: DateFormatOption;
}

/**
 * Date format options
 */
export type DateFormatOption =
  | "MM/DD/YYYY"
  | "DD/MM/YYYY"
  | "YYYY-MM-DD"
  | "MMM D, YYYY"
  | "D MMM YYYY";

/**
 * Default timezone preferences
 */
export const DEFAULT_TIMEZONE_PREFERENCES: TimezonePreferences = {
  timezone: "UTC",
  autoDetect: true,
  use24HourFormat: false,
  showTimezoneAbbreviation: true,
  dateFormat: "MMM D, YYYY",
};

/**
 * Date format display options
 */
export const DATE_FORMAT_OPTIONS: { value: DateFormatOption; label: string; example: string }[] = [
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY", example: "03/27/2026" },
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY", example: "27/03/2026" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD", example: "2026-03-27" },
  { value: "MMM D, YYYY", label: "MMM D, YYYY", example: "Mar 27, 2026" },
  { value: "D MMM YYYY", label: "D MMM YYYY", example: "27 Mar 2026" },
];

/**
 * Business hours configuration
 */
export interface BusinessHours {
  start: string; // HH:mm format
  end: string; // HH:mm format
  timezone: string;
  workDays: number[]; // 0 = Sunday, 6 = Saturday
}

/**
 * Default business hours
 */
export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  start: "09:00",
  end: "17:00",
  timezone: "America/New_York",
  workDays: [1, 2, 3, 4, 5], // Monday - Friday
};

/**
 * Common timezones for quick selection
 */
export const COMMON_TIMEZONES: string[] = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Vancouver",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
  "UTC",
];

/**
 * Timezone region labels and colors
 */
export const TIMEZONE_REGIONS: Record<TimezoneRegion, { label: string; color: string }> = {
  Americas: { label: "Americas", color: "bg-blue-500" },
  Europe: { label: "Europe", color: "bg-emerald-500" },
  Asia: { label: "Asia", color: "bg-amber-500" },
  Pacific: { label: "Pacific", color: "bg-violet-500" },
  Africa: { label: "Africa", color: "bg-orange-500" },
  Atlantic: { label: "Atlantic", color: "bg-cyan-500" },
  Indian: { label: "Indian", color: "bg-pink-500" },
  Australia: { label: "Australia", color: "bg-red-500" },
  Other: { label: "Other", color: "bg-gray-500" },
};

/**
 * Relative time units for display
 */
export type RelativeTimeUnit =
  | "seconds"
  | "minutes"
  | "hours"
  | "days"
  | "weeks"
  | "months"
  | "years";

/**
 * Options for localized date display
 */
export interface LocalizedDateOptions {
  showRelative?: boolean;
  showTime?: boolean;
  showTimezone?: boolean;
  showDate?: boolean;
  format?: "short" | "medium" | "long" | "full";
}
