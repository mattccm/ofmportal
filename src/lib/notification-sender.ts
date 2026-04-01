import { db } from "./db";
import {
  createNotification,
  NotificationType,
  getNotificationCategory,
} from "./notifications";
import { sendEmail } from "./email";
import { sendSms } from "./sms";
import {
  NotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
  CategorySettings,
} from "@/types/notification-preferences";

// ============================================
// PREFERENCE-AWARE NOTIFICATION SERVICE
// ============================================

/**
 * Get user notification preferences from database
 */
export async function getUserNotificationPreferences(
  userId: string
): Promise<NotificationPreferences> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { preferences: true, timezone: true },
  });

  if (!user) {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }

  const userPrefs = (user.preferences as Record<string, unknown>) || {};
  const notificationPrefs = userPrefs.notifications as
    | NotificationPreferences
    | undefined;

  if (notificationPrefs) {
    // Merge with defaults and add user's timezone to quiet hours
    return {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...notificationPrefs,
      categories: {
        ...DEFAULT_NOTIFICATION_PREFERENCES.categories,
        ...notificationPrefs.categories,
      },
      quietHours: {
        ...DEFAULT_NOTIFICATION_PREFERENCES.quietHours,
        ...notificationPrefs.quietHours,
        timezone: user.timezone || "UTC",
      },
    };
  }

  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    quietHours: {
      ...DEFAULT_NOTIFICATION_PREFERENCES.quietHours,
      timezone: user.timezone || "UTC",
    },
  };
}

/**
 * Check if notifications should be suppressed (DND or quiet hours)
 */
export function shouldSuppressNotification(
  preferences: NotificationPreferences
): { suppress: boolean; reason?: string } {
  // Check Do Not Disturb
  if (preferences.doNotDisturb) {
    return { suppress: true, reason: "Do Not Disturb is enabled" };
  }

  // Check Quiet Hours
  if (preferences.quietHours.enabled) {
    const now = new Date();

    // Get current time in user's timezone
    const userTime = new Intl.DateTimeFormat("en-US", {
      timeZone: preferences.quietHours.timezone || "UTC",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(now);

    const currentTime = userTime;
    const startTime = preferences.quietHours.startTime;
    const endTime = preferences.quietHours.endTime;

    let isQuietHours = false;
    if (startTime <= endTime) {
      // Same day quiet hours (e.g., 09:00 - 17:00)
      isQuietHours = currentTime >= startTime && currentTime <= endTime;
    } else {
      // Overnight quiet hours (e.g., 22:00 - 08:00)
      isQuietHours = currentTime >= startTime || currentTime <= endTime;
    }

    if (isQuietHours) {
      return {
        suppress: true,
        reason: `Quiet hours active (${startTime} - ${endTime})`,
      };
    }
  }

  return { suppress: false };
}

/**
 * Check if a specific channel is enabled for a notification type
 */
export function isChannelEnabled(
  preferences: NotificationPreferences,
  notificationType: NotificationType,
  channel: "inApp" | "email" | "sms" | "push"
): boolean {
  const category = getNotificationCategory(notificationType);
  const categorySettings = preferences.categories[category];

  if (!categorySettings?.enabled) {
    return false;
  }

  return categorySettings.channels[channel] === true;
}

/**
 * Get delivery settings for a notification type
 */
export function getDeliverySettings(
  preferences: NotificationPreferences,
  notificationType: NotificationType
): CategorySettings | null {
  const category = getNotificationCategory(notificationType);
  const categorySettings = preferences.categories[category];

  if (!categorySettings?.enabled) {
    return null;
  }

  return categorySettings;
}

// ============================================
// NOTIFICATION SENDING INTERFACES
// ============================================

export interface NotificationData {
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  // For email
  emailSubject?: string;
  emailHtml?: string;
  // For SMS
  smsMessage?: string;
}

export interface SendNotificationResult {
  inApp: boolean;
  email: boolean;
  sms: boolean;
  push: boolean;
  suppressed: boolean;
  suppressReason?: string;
  errors: string[];
}

// ============================================
// MAIN NOTIFICATION SENDER
// ============================================

/**
 * Send a notification to a user, respecting their preferences
 */
export async function sendNotificationWithPreferences(
  userId: string,
  notification: NotificationData
): Promise<SendNotificationResult> {
  const result: SendNotificationResult = {
    inApp: false,
    email: false,
    sms: false,
    push: false,
    suppressed: false,
    errors: [],
  };

  // Get user data and preferences
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      preferences: true,
      timezone: true,
    },
  });

  if (!user) {
    result.errors.push("User not found");
    return result;
  }

  // Get notification preferences
  const preferences = await getUserNotificationPreferences(userId);

  // Check if notifications should be suppressed
  const suppressCheck = shouldSuppressNotification(preferences);
  if (suppressCheck.suppress) {
    result.suppressed = true;
    result.suppressReason = suppressCheck.reason;

    // For quiet hours, we still create the in-app notification
    // but mark that real-time delivery is suppressed
    const deliverySettings = getDeliverySettings(preferences, notification.type);
    if (deliverySettings?.channels.inApp) {
      try {
        await createNotification({
          userId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          link: notification.link,
        });
        result.inApp = true;
      } catch (error) {
        console.error("Failed to create in-app notification:", error);
        result.errors.push("Failed to create in-app notification");
      }
    }

    return result;
  }

  // Get delivery settings for this notification type
  const deliverySettings = getDeliverySettings(preferences, notification.type);
  if (!deliverySettings) {
    result.suppressed = true;
    result.suppressReason = "Category disabled";
    return result;
  }

  // Send in-app notification
  if (deliverySettings.channels.inApp) {
    try {
      await createNotification({
        userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        link: notification.link,
      });
      result.inApp = true;
    } catch (error) {
      console.error("Failed to send in-app notification:", error);
      result.errors.push("In-app notification failed");
    }
  }

  // Send email notification
  if (deliverySettings.channels.email && user.email) {
    try {
      await sendEmail({
        to: user.email,
        subject: notification.emailSubject || notification.title,
        html:
          notification.emailHtml ||
          generateDefaultEmailHtml(notification, user.name || "there"),
      });
      result.email = true;
    } catch (error) {
      console.error("Failed to send email notification:", error);
      result.errors.push("Email notification failed");
    }
  }

  // Send SMS notification
  if (deliverySettings.channels.sms && user.phone) {
    try {
      await sendSms({
        to: user.phone,
        message: notification.smsMessage || `${notification.title}: ${notification.message}`,
      });
      result.sms = true;
    } catch (error) {
      console.error("Failed to send SMS notification:", error);
      result.errors.push("SMS notification failed");
    }
  }

  // Push notification (placeholder - would integrate with Web Push API)
  if (deliverySettings.channels.push) {
    // In a real implementation, this would send a push notification
    // via Web Push API or a service like Firebase Cloud Messaging
    result.push = true;
  }

  return result;
}

/**
 * Send notifications to multiple users
 */
export async function sendBulkNotificationsWithPreferences(
  userIds: string[],
  notification: NotificationData
): Promise<Map<string, SendNotificationResult>> {
  const results = new Map<string, SendNotificationResult>();

  await Promise.all(
    userIds.map(async (userId) => {
      const result = await sendNotificationWithPreferences(userId, notification);
      results.set(userId, result);
    })
  );

  return results;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate default email HTML for notifications
 */
function generateDefaultEmailHtml(
  notification: NotificationData,
  userName: string
): string {
  const bgColor = getNotificationBgColor(notification.type);
  const iconColor = getNotificationIconColor(notification.type);

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, ${bgColor.from} 0%, ${bgColor.to} 100%); padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">${notification.title}</h1>
        </div>
        <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
            Hello ${userName},
          </p>
          <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
            ${notification.message}
          </p>
          ${
            notification.link
              ? `
          <div style="text-align: center; margin: 24px 0;">
            <a href="${notification.link}" style="background: ${iconColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">View Details</a>
          </div>
          `
              : ""
          }
        </div>
        <div style="text-align: center; padding: 16px; color: #9ca3af; font-size: 12px;">
          <p style="margin: 0;">Sent from Upload Portal</p>
        </div>
      </body>
    </html>
  `;
}

/**
 * Get background gradient colors for notification type
 */
function getNotificationBgColor(type: NotificationType): {
  from: string;
  to: string;
} {
  switch (type) {
    case NotificationType.UPLOAD_SUBMITTED:
    case NotificationType.MESSAGE_RECEIVED:
      return { from: "#3b82f6", to: "#1d4ed8" };
    case NotificationType.UPLOAD_APPROVED:
      return { from: "#10b981", to: "#059669" };
    case NotificationType.UPLOAD_REJECTED:
      return { from: "#ef4444", to: "#dc2626" };
    case NotificationType.REQUEST_CREATED:
    case NotificationType.MENTION:
      return { from: "#8b5cf6", to: "#7c3aed" };
    case NotificationType.REQUEST_DUE_SOON:
    case NotificationType.COMMENT_ADDED:
      return { from: "#f59e0b", to: "#d97706" };
    case NotificationType.SYSTEM:
    default:
      return { from: "#6366f1", to: "#4f46e5" };
  }
}

/**
 * Get icon color for notification type
 */
function getNotificationIconColor(type: NotificationType): string {
  switch (type) {
    case NotificationType.UPLOAD_SUBMITTED:
    case NotificationType.MESSAGE_RECEIVED:
      return "#3b82f6";
    case NotificationType.UPLOAD_APPROVED:
      return "#10b981";
    case NotificationType.UPLOAD_REJECTED:
      return "#ef4444";
    case NotificationType.REQUEST_CREATED:
    case NotificationType.MENTION:
      return "#8b5cf6";
    case NotificationType.REQUEST_DUE_SOON:
    case NotificationType.COMMENT_ADDED:
      return "#f59e0b";
    case NotificationType.SYSTEM:
    default:
      return "#6366f1";
  }
}

// ============================================
// CONVENIENCE NOTIFICATION FUNCTIONS
// ============================================

/**
 * Send upload submitted notification with preferences
 */
export async function sendUploadSubmittedNotification(
  userId: string,
  creatorName: string,
  requestTitle: string,
  requestId: string
): Promise<SendNotificationResult> {
  return sendNotificationWithPreferences(userId, {
    type: NotificationType.UPLOAD_SUBMITTED,
    title: "New Content Submitted",
    message: `${creatorName} has submitted content for "${requestTitle}"`,
    link: `/dashboard/requests/${requestId}`,
    smsMessage: `New content submitted by ${creatorName} for "${requestTitle}"`,
  });
}

/**
 * Send upload approved notification with preferences
 */
export async function sendUploadApprovedNotification(
  userId: string,
  requestTitle: string,
  requestId: string
): Promise<SendNotificationResult> {
  return sendNotificationWithPreferences(userId, {
    type: NotificationType.UPLOAD_APPROVED,
    title: "Content Approved",
    message: `Your content for "${requestTitle}" has been approved`,
    link: `/portal/requests/${requestId}`,
    smsMessage: `Great news! Your content for "${requestTitle}" was approved.`,
  });
}

/**
 * Send upload rejected notification with preferences
 */
export async function sendUploadRejectedNotification(
  userId: string,
  requestTitle: string,
  requestId: string,
  reason?: string
): Promise<SendNotificationResult> {
  const message = reason
    ? `Your content for "${requestTitle}" needs revision: ${reason}`
    : `Your content for "${requestTitle}" needs revision`;

  return sendNotificationWithPreferences(userId, {
    type: NotificationType.UPLOAD_REJECTED,
    title: "Content Needs Revision",
    message,
    link: `/portal/requests/${requestId}`,
    smsMessage: `Revision needed for "${requestTitle}". Please check the feedback.`,
  });
}

/**
 * Send request created notification with preferences
 */
export async function sendRequestCreatedNotification(
  userId: string,
  requestTitle: string,
  requestId: string,
  dueDate?: Date
): Promise<SendNotificationResult> {
  const dueDateStr = dueDate
    ? ` (due ${dueDate.toLocaleDateString()})`
    : "";

  return sendNotificationWithPreferences(userId, {
    type: NotificationType.REQUEST_CREATED,
    title: "New Content Request",
    message: `You have a new content request: "${requestTitle}"${dueDateStr}`,
    link: `/portal/requests/${requestId}`,
    smsMessage: `New request: "${requestTitle}"${dueDateStr}`,
  });
}

/**
 * Send request due soon notification with preferences
 */
export async function sendRequestDueSoonNotification(
  userId: string,
  requestTitle: string,
  requestId: string,
  daysRemaining: number
): Promise<SendNotificationResult> {
  const timeStr =
    daysRemaining === 0
      ? "today"
      : daysRemaining === 1
      ? "tomorrow"
      : `in ${daysRemaining} days`;

  return sendNotificationWithPreferences(userId, {
    type: NotificationType.REQUEST_DUE_SOON,
    title: "Request Due Soon",
    message: `"${requestTitle}" is due ${timeStr}`,
    link: `/portal/requests/${requestId}`,
    smsMessage: `Reminder: "${requestTitle}" is due ${timeStr}`,
  });
}

/**
 * Send comment notification with preferences
 */
export async function sendCommentNotification(
  userId: string,
  commenterName: string,
  requestTitle: string,
  requestId: string,
  commentPreview: string
): Promise<SendNotificationResult> {
  const preview =
    commentPreview.length > 50
      ? commentPreview.slice(0, 50) + "..."
      : commentPreview;

  return sendNotificationWithPreferences(userId, {
    type: NotificationType.COMMENT_ADDED,
    title: "New Comment",
    message: `${commenterName} commented on "${requestTitle}": ${preview}`,
    link: `/dashboard/requests/${requestId}`,
    smsMessage: `${commenterName} commented on "${requestTitle}"`,
  });
}

/**
 * Send mention notification with preferences
 */
export async function sendMentionNotification(
  userId: string,
  mentionedByName: string,
  context: string,
  link: string
): Promise<SendNotificationResult> {
  return sendNotificationWithPreferences(userId, {
    type: NotificationType.MENTION,
    title: "You were mentioned",
    message: `${mentionedByName} mentioned you: "${context}"`,
    link,
    smsMessage: `${mentionedByName} mentioned you`,
  });
}

/**
 * Send system notification with preferences
 */
export async function sendSystemNotification(
  userId: string,
  title: string,
  message: string,
  link?: string
): Promise<SendNotificationResult> {
  return sendNotificationWithPreferences(userId, {
    type: NotificationType.SYSTEM,
    title,
    message,
    link,
    smsMessage: `${title}: ${message}`,
  });
}
