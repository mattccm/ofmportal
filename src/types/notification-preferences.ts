// ============================================
// NOTIFICATION PREFERENCES TYPES
// ============================================

/**
 * Notification categories that users can configure
 */
export type NotificationCategory =
  | "uploads"
  | "requests"
  | "reminders"
  | "team"
  | "system";

/**
 * Notification delivery channels
 */
export type NotificationChannel = "inApp" | "email" | "sms" | "push";

/**
 * Frequency options for notifications
 */
export type NotificationFrequency = "instant" | "daily" | "weekly";

/**
 * Available notification sound options
 */
export type NotificationSound =
  | "default"
  | "chime"
  | "bell"
  | "ping"
  | "subtle"
  | "none";

/**
 * Per-category channel settings
 */
export interface CategoryChannelSettings {
  inApp: boolean;
  email: boolean;
  sms: boolean;
  push: boolean;
}

/**
 * Category-specific notification settings
 */
export interface CategorySettings {
  enabled: boolean;
  channels: CategoryChannelSettings;
  frequency: NotificationFrequency;
}

/**
 * Quiet hours configuration
 */
export interface QuietHoursSettings {
  enabled: boolean;
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  timezone: string;
}

/**
 * Complete notification preferences structure
 */
export interface NotificationPreferences {
  // Per-category settings
  categories: {
    uploads: CategorySettings;
    requests: CategorySettings;
    reminders: CategorySettings;
    team: CategorySettings;
    system: CategorySettings;
  };

  // Global settings
  doNotDisturb: boolean;
  quietHours: QuietHoursSettings;
  notificationSound: NotificationSound;

  // Last updated timestamp
  updatedAt?: string;

  // Index signature for useAutosave compatibility
  [key: string]: unknown;
}

/**
 * Default notification preferences for new users
 */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  categories: {
    uploads: {
      enabled: true,
      channels: { inApp: true, email: true, sms: false, push: true },
      frequency: "instant",
    },
    requests: {
      enabled: true,
      channels: { inApp: true, email: true, sms: false, push: true },
      frequency: "instant",
    },
    reminders: {
      enabled: true,
      channels: { inApp: true, email: true, sms: true, push: true },
      frequency: "instant",
    },
    team: {
      enabled: true,
      channels: { inApp: true, email: true, sms: false, push: false },
      frequency: "daily",
    },
    system: {
      enabled: true,
      channels: { inApp: true, email: true, sms: false, push: false },
      frequency: "instant",
    },
  },
  doNotDisturb: false,
  quietHours: {
    enabled: false,
    startTime: "22:00",
    endTime: "08:00",
    timezone: "UTC",
  },
  notificationSound: "default",
};

/**
 * Notification category metadata for UI
 */
export interface CategoryInfo {
  key: NotificationCategory;
  title: string;
  description: string;
  icon: string;
  iconColor: string;
  iconBg: string;
}

/**
 * Category metadata configuration
 */
export const NOTIFICATION_CATEGORIES: CategoryInfo[] = [
  {
    key: "uploads",
    title: "Upload Notifications",
    description:
      "New uploads, approvals, rejections, and content submissions",
    icon: "Upload",
    iconColor: "text-blue-500",
    iconBg: "bg-blue-500/10",
  },
  {
    key: "requests",
    title: "Content Requests",
    description: "New requests, status updates, and deadline changes",
    icon: "FileText",
    iconColor: "text-violet-500",
    iconBg: "bg-violet-500/10",
  },
  {
    key: "reminders",
    title: "Reminders",
    description: "Deadline reminders, overdue alerts, and scheduled reminders",
    icon: "Clock",
    iconColor: "text-amber-500",
    iconBg: "bg-amber-500/10",
  },
  {
    key: "team",
    title: "Team Activity",
    description: "Team member actions, mentions, and collaboration updates",
    icon: "Users",
    iconColor: "text-emerald-500",
    iconBg: "bg-emerald-500/10",
  },
  {
    key: "system",
    title: "System Notifications",
    description: "Account updates, security alerts, and system announcements",
    icon: "Settings",
    iconColor: "text-gray-500",
    iconBg: "bg-gray-500/10",
  },
];

/**
 * Notification sound options for UI
 */
export const NOTIFICATION_SOUNDS: { value: NotificationSound; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "chime", label: "Chime" },
  { value: "bell", label: "Bell" },
  { value: "ping", label: "Ping" },
  { value: "subtle", label: "Subtle" },
  { value: "none", label: "None (Silent)" },
];

/**
 * Frequency options for UI
 */
export const FREQUENCY_OPTIONS: {
  value: NotificationFrequency;
  label: string;
  description: string;
}[] = [
  { value: "instant", label: "Instant", description: "As they happen" },
  { value: "daily", label: "Daily Digest", description: "Once per day" },
  { value: "weekly", label: "Weekly Digest", description: "Once per week" },
];

/**
 * Channel labels for UI
 */
export const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  inApp: "In-App",
  email: "Email",
  sms: "SMS",
  push: "Push",
};
