// ============================================
// COMMUNICATION PREFERENCES TYPES
// For Creator Communication Preferences System
// ============================================

/**
 * Available contact methods for creators
 */
export type ContactMethod = "email" | "sms" | "whatsapp" | "telegram" | "discord" | "in_app" | "phone";

/**
 * Response time expectations
 */
export type ResponseExpectation = "immediate" | "same_day" | "next_day" | "within_week" | "flexible";

/**
 * Day of week abbreviations
 */
export type DayOfWeek = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

/**
 * Quiet period configuration (vacations, breaks, etc.)
 */
export interface QuietPeriod {
  id: string;
  startDate: Date;
  endDate: Date;
  reason?: string;
  autoReply?: string;
}

/**
 * Working hours configuration
 */
export interface WorkingHours {
  start: string; // "09:00"
  end: string; // "18:00"
}

/**
 * Contact details per method
 */
export interface ContactDetails {
  email?: string;
  phone?: string;
  whatsapp?: string;
  telegram?: string;
  discord?: string;
}

/**
 * Complete communication preferences for a creator
 */
export interface CommunicationPreferences {
  // Primary contact
  primaryMethod: ContactMethod;
  secondaryMethod?: ContactMethod;

  // Contact details per method
  contactDetails: ContactDetails;

  // Availability
  timezone: string;
  preferredHours: WorkingHours;
  availableDays: DayOfWeek[];

  // Response expectations
  expectedResponseTime: ResponseExpectation;

  // Language
  primaryLanguage: string;
  secondaryLanguages?: string[];

  // Notification preferences
  notifyOnNewRequest: boolean;
  notifyOnDeadlineReminder: boolean;
  notifyOnFeedback: boolean;
  notifyOnApproval: boolean;

  // Quiet periods (vacations, breaks)
  quietPeriods: QuietPeriod[];

  // Notes
  communicationNotes?: string; // "Prefers voice messages", "Responds faster on weekends"
}

/**
 * Default communication preferences for new creators
 */
export const DEFAULT_COMMUNICATION_PREFERENCES: CommunicationPreferences = {
  primaryMethod: "email",
  secondaryMethod: undefined,
  contactDetails: {},
  timezone: "UTC",
  preferredHours: {
    start: "09:00",
    end: "18:00",
  },
  availableDays: ["mon", "tue", "wed", "thu", "fri"],
  expectedResponseTime: "same_day",
  primaryLanguage: "English",
  secondaryLanguages: [],
  notifyOnNewRequest: true,
  notifyOnDeadlineReminder: true,
  notifyOnFeedback: true,
  notifyOnApproval: true,
  quietPeriods: [],
  communicationNotes: "",
};

/**
 * Contact method metadata for UI display
 */
export interface ContactMethodInfo {
  key: ContactMethod;
  label: string;
  icon: string;
  color: string;
  bgColor: string;
  placeholder?: string;
  helpText?: string;
}

/**
 * Contact method configurations for UI
 */
export const CONTACT_METHODS: ContactMethodInfo[] = [
  {
    key: "email",
    label: "Email",
    icon: "Mail",
    color: "text-blue-600",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    placeholder: "creator@example.com",
    helpText: "Standard email communication",
  },
  {
    key: "sms",
    label: "SMS",
    icon: "MessageSquare",
    color: "text-green-600",
    bgColor: "bg-green-100 dark:bg-green-900/30",
    placeholder: "+1 (555) 123-4567",
    helpText: "Text message to mobile phone",
  },
  {
    key: "whatsapp",
    label: "WhatsApp",
    icon: "MessageCircle",
    color: "text-emerald-600",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
    placeholder: "+1 (555) 123-4567",
    helpText: "WhatsApp messaging",
  },
  {
    key: "telegram",
    label: "Telegram",
    icon: "Send",
    color: "text-sky-600",
    bgColor: "bg-sky-100 dark:bg-sky-900/30",
    placeholder: "@username",
    helpText: "Telegram username or phone number",
  },
  {
    key: "discord",
    label: "Discord",
    icon: "Hash",
    color: "text-indigo-600",
    bgColor: "bg-indigo-100 dark:bg-indigo-900/30",
    placeholder: "username#1234",
    helpText: "Discord username",
  },
  {
    key: "in_app",
    label: "In-App",
    icon: "Bell",
    color: "text-violet-600",
    bgColor: "bg-violet-100 dark:bg-violet-900/30",
    helpText: "Notifications within the portal",
  },
  {
    key: "phone",
    label: "Phone Call",
    icon: "Phone",
    color: "text-amber-600",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
    placeholder: "+1 (555) 123-4567",
    helpText: "Voice calls",
  },
];

/**
 * Response expectation metadata for UI
 */
export interface ResponseExpectationInfo {
  key: ResponseExpectation;
  label: string;
  description: string;
  color: string;
}

/**
 * Response expectation configurations for UI
 */
export const RESPONSE_EXPECTATIONS: ResponseExpectationInfo[] = [
  {
    key: "immediate",
    label: "Immediate",
    description: "Within a few hours",
    color: "text-red-600",
  },
  {
    key: "same_day",
    label: "Same Day",
    description: "Within the same business day",
    color: "text-orange-600",
  },
  {
    key: "next_day",
    label: "Next Day",
    description: "Within 24 hours",
    color: "text-amber-600",
  },
  {
    key: "within_week",
    label: "Within a Week",
    description: "Up to 7 days",
    color: "text-blue-600",
  },
  {
    key: "flexible",
    label: "Flexible",
    description: "No specific timeframe",
    color: "text-green-600",
  },
];

/**
 * Days of week metadata for UI
 */
export const DAYS_OF_WEEK: { key: DayOfWeek; label: string; shortLabel: string }[] = [
  { key: "mon", label: "Monday", shortLabel: "Mon" },
  { key: "tue", label: "Tuesday", shortLabel: "Tue" },
  { key: "wed", label: "Wednesday", shortLabel: "Wed" },
  { key: "thu", label: "Thursday", shortLabel: "Thu" },
  { key: "fri", label: "Friday", shortLabel: "Fri" },
  { key: "sat", label: "Saturday", shortLabel: "Sat" },
  { key: "sun", label: "Sunday", shortLabel: "Sun" },
];

/**
 * Common languages for selection
 */
export const COMMON_LANGUAGES: string[] = [
  "English",
  "Spanish",
  "French",
  "German",
  "Italian",
  "Portuguese",
  "Russian",
  "Chinese (Mandarin)",
  "Chinese (Cantonese)",
  "Japanese",
  "Korean",
  "Arabic",
  "Hindi",
  "Dutch",
  "Polish",
  "Swedish",
  "Turkish",
  "Vietnamese",
  "Thai",
  "Indonesian",
];

/**
 * Get contact method info by key
 */
export function getContactMethodInfo(method: ContactMethod): ContactMethodInfo | undefined {
  return CONTACT_METHODS.find((m) => m.key === method);
}

/**
 * Get response expectation info by key
 */
export function getResponseExpectationInfo(expectation: ResponseExpectation): ResponseExpectationInfo | undefined {
  return RESPONSE_EXPECTATIONS.find((e) => e.key === expectation);
}

/**
 * Check if a creator is currently available based on their preferences
 */
export function isCreatorAvailable(
  preferences: CommunicationPreferences,
  checkTime?: Date
): { available: boolean; reason?: string } {
  const now = checkTime || new Date();

  // Check for active quiet periods
  for (const period of preferences.quietPeriods) {
    const startDate = new Date(period.startDate);
    const endDate = new Date(period.endDate);
    if (now >= startDate && now <= endDate) {
      return {
        available: false,
        reason: period.reason || "Currently on a break",
      };
    }
  }

  // Get current time in creator's timezone
  try {
    const creatorTime = new Date(now.toLocaleString("en-US", { timeZone: preferences.timezone }));
    const dayOfWeek = creatorTime.getDay();
    const dayMap: Record<number, DayOfWeek> = {
      0: "sun",
      1: "mon",
      2: "tue",
      3: "wed",
      4: "thu",
      5: "fri",
      6: "sat",
    };

    const currentDay = dayMap[dayOfWeek];

    // Check if today is an available day
    if (!preferences.availableDays.includes(currentDay)) {
      return {
        available: false,
        reason: "Outside working days",
      };
    }

    // Check if current time is within working hours
    const currentHour = creatorTime.getHours();
    const currentMinute = creatorTime.getMinutes();
    const currentMinutes = currentHour * 60 + currentMinute;

    const [startHour, startMinute] = preferences.preferredHours.start.split(":").map(Number);
    const [endHour, endMinute] = preferences.preferredHours.end.split(":").map(Number);

    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
      return {
        available: false,
        reason: "Outside working hours",
      };
    }

    return { available: true };
  } catch {
    // If timezone conversion fails, assume available
    return { available: true };
  }
}

/**
 * Get the next available time for a creator
 */
export function getNextAvailableTime(preferences: CommunicationPreferences): Date | null {
  const now = new Date();

  // Check for active quiet periods first
  for (const period of preferences.quietPeriods) {
    const endDate = new Date(period.endDate);
    if (now < endDate && now >= new Date(period.startDate)) {
      // Currently in a quiet period, return when it ends
      return endDate;
    }
  }

  // Find next available day and time
  try {
    const creatorTime = new Date(now.toLocaleString("en-US", { timeZone: preferences.timezone }));
    const [startHour, startMinute] = preferences.preferredHours.start.split(":").map(Number);

    const dayOrder: DayOfWeek[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

    // Check up to 7 days ahead
    for (let i = 0; i < 7; i++) {
      const checkDate = new Date(creatorTime);
      checkDate.setDate(checkDate.getDate() + i);
      const dayOfWeek = checkDate.getDay();
      const day = dayOrder[dayOfWeek];

      if (preferences.availableDays.includes(day)) {
        checkDate.setHours(startHour, startMinute, 0, 0);

        // If it's today and we're past the start time, move to tomorrow
        if (i === 0 && checkDate <= creatorTime) {
          continue;
        }

        return checkDate;
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Calculate timezone difference between user and creator
 */
export function getTimezoneDifference(userTimezone: string, creatorTimezone: string): number {
  try {
    const now = new Date();
    const userTime = new Date(now.toLocaleString("en-US", { timeZone: userTimezone }));
    const creatorTime = new Date(now.toLocaleString("en-US", { timeZone: creatorTimezone }));

    return (creatorTime.getTime() - userTime.getTime()) / (1000 * 60 * 60); // in hours
  } catch {
    return 0;
  }
}

/**
 * Format timezone difference for display
 */
export function formatTimezoneDifference(hours: number): string {
  if (hours === 0) {
    return "Same timezone";
  }

  const absHours = Math.abs(hours);
  const direction = hours > 0 ? "ahead" : "behind";

  if (absHours === 1) {
    return `1 hour ${direction}`;
  }

  return `${absHours} hours ${direction}`;
}
