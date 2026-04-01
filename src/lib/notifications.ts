import { db } from "./db";

// ============================================
// NOTIFICATION TYPES ENUM
// ============================================

export enum NotificationType {
  UPLOAD_SUBMITTED = "UPLOAD_SUBMITTED",
  UPLOAD_APPROVED = "UPLOAD_APPROVED",
  UPLOAD_REJECTED = "UPLOAD_REJECTED",
  REQUEST_CREATED = "REQUEST_CREATED",
  REQUEST_DUE_SOON = "REQUEST_DUE_SOON",
  REQUEST_STATUS_CHANGED = "REQUEST_STATUS_CHANGED",
  COMMENT_ADDED = "COMMENT_ADDED",
  MENTION = "MENTION",
  MESSAGE_RECEIVED = "MESSAGE_RECEIVED",
  WATCHER_ADDED = "WATCHER_ADDED",
  SYSTEM = "SYSTEM",
}

// ============================================
// NOTIFICATION INTERFACES
// ============================================

export interface NotificationMetadata {
  requestId?: string;
  uploadId?: string;
  creatorId?: string;
  creatorName?: string;
  commentId?: string;
  mentionedBy?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  metadata?: NotificationMetadata;
}

export interface GetNotificationsOptions {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
  types?: NotificationType[];
}

export interface NotificationResult {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  metadata?: NotificationMetadata;
  readAt: Date | null;
  createdAt: Date;
}

// ============================================
// NOTIFICATION SERVICE
// ============================================

/**
 * Create a new notification for a user
 */
export async function createNotification({
  userId,
  type,
  title,
  message,
  link,
  metadata,
}: CreateNotificationParams): Promise<NotificationResult> {
  const notification = await db.notification.create({
    data: {
      userId,
      type,
      title,
      message,
      link: link || null,
      // Store metadata as JSON in a separate field if needed
      // For now, we'll encode it in the message or use a workaround
    },
  });

  return {
    ...notification,
    metadata,
  };
}

/**
 * Create multiple notifications for several users (bulk operation)
 */
export async function createBulkNotifications(
  notifications: CreateNotificationParams[]
): Promise<number> {
  const result = await db.notification.createMany({
    data: notifications.map((n) => ({
      userId: n.userId,
      type: n.type,
      title: n.title,
      message: n.message,
      link: n.link || null,
    })),
  });

  return result.count;
}

/**
 * Mark a single notification as read
 */
export async function markAsRead(notificationId: string): Promise<boolean> {
  try {
    await db.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Mark a single notification as unread
 */
export async function markAsUnread(notificationId: string): Promise<boolean> {
  try {
    await db.notification.update({
      where: { id: notificationId },
      data: { readAt: null },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Mark multiple notifications as read
 */
export async function markMultipleAsRead(
  notificationIds: string[]
): Promise<number> {
  const result = await db.notification.updateMany({
    where: {
      id: { in: notificationIds },
    },
    data: { readAt: new Date() },
  });

  return result.count;
}

/**
 * Mark multiple notifications as unread
 */
export async function markMultipleAsUnread(
  notificationIds: string[]
): Promise<number> {
  const result = await db.notification.updateMany({
    where: {
      id: { in: notificationIds },
    },
    data: { readAt: null },
  });

  return result.count;
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId: string): Promise<number> {
  const result = await db.notification.updateMany({
    where: {
      userId,
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  return result.count;
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadCount(userId: string): Promise<number> {
  return db.notification.count({
    where: {
      userId,
      readAt: null,
    },
  });
}

/**
 * Get notifications for a user with pagination and filtering
 */
export async function getUserNotifications(
  userId: string,
  options: GetNotificationsOptions = {}
): Promise<{
  notifications: NotificationResult[];
  total: number;
  hasMore: boolean;
}> {
  const { limit = 20, offset = 0, unreadOnly = false, types } = options;

  const whereClause = {
    userId,
    ...(unreadOnly && { readAt: null }),
    ...(types && types.length > 0 && { type: { in: types } }),
  };

  const [notifications, total] = await Promise.all([
    db.notification.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    db.notification.count({ where: whereClause }),
  ]);

  return {
    notifications: notifications.map((n) => ({
      ...n,
      metadata: undefined, // Metadata would need to be stored/retrieved separately
    })),
    total,
    hasMore: offset + notifications.length < total,
  };
}

/**
 * Delete a specific notification
 */
export async function deleteNotification(
  notificationId: string,
  userId: string
): Promise<boolean> {
  try {
    await db.notification.delete({
      where: {
        id: notificationId,
        userId, // Ensure user owns the notification
      },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete multiple notifications
 */
export async function deleteMultipleNotifications(
  notificationIds: string[],
  userId: string
): Promise<number> {
  const result = await db.notification.deleteMany({
    where: {
      id: { in: notificationIds },
      userId, // Ensure user owns the notifications
    },
  });

  return result.count;
}

/**
 * Delete all read notifications older than a certain date for cleanup
 */
export async function deleteOldNotifications(
  userId: string,
  olderThanDays: number = 30
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const result = await db.notification.deleteMany({
    where: {
      userId,
      readAt: { not: null },
      createdAt: { lt: cutoffDate },
    },
  });

  return result.count;
}

// ============================================
// NOTIFICATION HELPER FUNCTIONS
// ============================================

/**
 * Get notification icon name based on type
 */
export function getNotificationIcon(type: NotificationType): string {
  const icons: Record<NotificationType, string> = {
    [NotificationType.UPLOAD_SUBMITTED]: "upload",
    [NotificationType.UPLOAD_APPROVED]: "check-circle",
    [NotificationType.UPLOAD_REJECTED]: "x-circle",
    [NotificationType.REQUEST_CREATED]: "file-plus",
    [NotificationType.REQUEST_DUE_SOON]: "clock",
    [NotificationType.REQUEST_STATUS_CHANGED]: "refresh-cw",
    [NotificationType.COMMENT_ADDED]: "message-circle",
    [NotificationType.MENTION]: "at-sign",
    [NotificationType.MESSAGE_RECEIVED]: "mail",
    [NotificationType.WATCHER_ADDED]: "eye",
    [NotificationType.SYSTEM]: "info",
  };

  return icons[type] || "bell";
}

/**
 * Get notification color class based on type
 */
export function getNotificationColor(type: NotificationType): string {
  const colors: Record<NotificationType, string> = {
    [NotificationType.UPLOAD_SUBMITTED]: "text-blue-500",
    [NotificationType.UPLOAD_APPROVED]: "text-emerald-500",
    [NotificationType.UPLOAD_REJECTED]: "text-red-500",
    [NotificationType.REQUEST_CREATED]: "text-violet-500",
    [NotificationType.REQUEST_DUE_SOON]: "text-amber-500",
    [NotificationType.REQUEST_STATUS_CHANGED]: "text-cyan-500",
    [NotificationType.COMMENT_ADDED]: "text-blue-500",
    [NotificationType.MENTION]: "text-violet-500",
    [NotificationType.MESSAGE_RECEIVED]: "text-indigo-500",
    [NotificationType.WATCHER_ADDED]: "text-sky-500",
    [NotificationType.SYSTEM]: "text-gray-500",
  };

  return colors[type] || "text-gray-500";
}

/**
 * Get gradient background class for notification icon container
 */
export function getNotificationGradient(type: NotificationType): string {
  const gradients: Record<NotificationType, string> = {
    [NotificationType.UPLOAD_SUBMITTED]:
      "bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30",
    [NotificationType.UPLOAD_APPROVED]:
      "bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-800/30",
    [NotificationType.UPLOAD_REJECTED]:
      "bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/30",
    [NotificationType.REQUEST_CREATED]:
      "bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-900/30 dark:to-violet-800/30",
    [NotificationType.REQUEST_DUE_SOON]:
      "bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/30",
    [NotificationType.REQUEST_STATUS_CHANGED]:
      "bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-900/30 dark:to-cyan-800/30",
    [NotificationType.COMMENT_ADDED]:
      "bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30",
    [NotificationType.MENTION]:
      "bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-900/30 dark:to-violet-800/30",
    [NotificationType.MESSAGE_RECEIVED]:
      "bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/30 dark:to-indigo-800/30",
    [NotificationType.WATCHER_ADDED]:
      "bg-gradient-to-br from-sky-50 to-sky-100 dark:from-sky-900/30 dark:to-sky-800/30",
    [NotificationType.SYSTEM]:
      "bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900/30 dark:to-gray-800/30",
  };

  return (
    gradients[type] ||
    "bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900/30 dark:to-gray-800/30"
  );
}

// ============================================
// NOTIFICATION CREATION HELPERS
// ============================================

/**
 * Notify user when content is submitted for review
 */
export async function notifyUploadSubmitted(
  userId: string,
  creatorName: string,
  requestTitle: string,
  requestId: string
): Promise<NotificationResult> {
  return createNotification({
    userId,
    type: NotificationType.UPLOAD_SUBMITTED,
    title: "New Content Submitted",
    message: `${creatorName} has submitted content for "${requestTitle}"`,
    link: `/dashboard/requests/${requestId}`,
    metadata: { requestId, creatorName },
  });
}

/**
 * Notify creator when their upload is approved
 */
export async function notifyUploadApproved(
  userId: string,
  requestTitle: string,
  requestId: string
): Promise<NotificationResult> {
  return createNotification({
    userId,
    type: NotificationType.UPLOAD_APPROVED,
    title: "Content Approved",
    message: `Your content for "${requestTitle}" has been approved`,
    link: `/portal/requests/${requestId}`,
    metadata: { requestId },
  });
}

/**
 * Notify creator when their upload is rejected
 */
export async function notifyUploadRejected(
  userId: string,
  requestTitle: string,
  requestId: string,
  reason?: string
): Promise<NotificationResult> {
  return createNotification({
    userId,
    type: NotificationType.UPLOAD_REJECTED,
    title: "Content Needs Revision",
    message: reason
      ? `Your content for "${requestTitle}" needs revision: ${reason}`
      : `Your content for "${requestTitle}" needs revision`,
    link: `/portal/requests/${requestId}`,
    metadata: { requestId },
  });
}

/**
 * Notify creator when a new request is created for them
 */
export async function notifyRequestCreated(
  userId: string,
  requestTitle: string,
  requestId: string,
  dueDate?: Date
): Promise<NotificationResult> {
  const dueDateStr = dueDate
    ? ` (due ${dueDate.toLocaleDateString()})`
    : "";
  return createNotification({
    userId,
    type: NotificationType.REQUEST_CREATED,
    title: "New Content Request",
    message: `You have a new content request: "${requestTitle}"${dueDateStr}`,
    link: `/portal/requests/${requestId}`,
    metadata: { requestId },
  });
}

/**
 * Notify creator when a request is due soon
 */
export async function notifyRequestDueSoon(
  userId: string,
  requestTitle: string,
  requestId: string,
  daysRemaining: number
): Promise<NotificationResult> {
  const timeStr =
    daysRemaining === 0
      ? "today"
      : daysRemaining === 1
      ? "tomorrow"
      : `in ${daysRemaining} days`;

  return createNotification({
    userId,
    type: NotificationType.REQUEST_DUE_SOON,
    title: "Request Due Soon",
    message: `"${requestTitle}" is due ${timeStr}`,
    link: `/portal/requests/${requestId}`,
    metadata: { requestId, daysRemaining },
  });
}

/**
 * Notify user when a comment is added
 */
export async function notifyCommentAdded(
  userId: string,
  commenterName: string,
  requestTitle: string,
  requestId: string,
  commentPreview: string
): Promise<NotificationResult> {
  const preview =
    commentPreview.length > 50
      ? commentPreview.slice(0, 50) + "..."
      : commentPreview;

  return createNotification({
    userId,
    type: NotificationType.COMMENT_ADDED,
    title: "New Comment",
    message: `${commenterName} commented on "${requestTitle}": ${preview}`,
    link: `/dashboard/requests/${requestId}`,
    metadata: { requestId, commenterName },
  });
}

/**
 * Notify user when they are mentioned
 */
export async function notifyMention(
  userId: string,
  mentionedByName: string,
  context: string,
  link: string
): Promise<NotificationResult> {
  return createNotification({
    userId,
    type: NotificationType.MENTION,
    title: "You were mentioned",
    message: `${mentionedByName} mentioned you: "${context}"`,
    link,
    metadata: { mentionedBy: mentionedByName },
  });
}

/**
 * Send a system notification
 */
export async function notifySystem(
  userId: string,
  title: string,
  message: string,
  link?: string
): Promise<NotificationResult> {
  return createNotification({
    userId,
    type: NotificationType.SYSTEM,
    title,
    message,
    link,
  });
}

/**
 * Notify multiple team members about an event
 */
export async function notifyTeam(
  userIds: string[],
  type: NotificationType,
  title: string,
  message: string,
  link?: string
): Promise<number> {
  return createBulkNotifications(
    userIds.map((userId) => ({
      userId,
      type,
      title,
      message,
      link,
    }))
  );
}

// ============================================
// PREFERENCE-AWARE NOTIFICATION HELPERS
// ============================================

/**
 * Maps notification types to preference categories
 */
export function getNotificationCategory(
  type: NotificationType
): "uploads" | "requests" | "reminders" | "team" | "system" {
  switch (type) {
    case NotificationType.UPLOAD_SUBMITTED:
    case NotificationType.UPLOAD_APPROVED:
    case NotificationType.UPLOAD_REJECTED:
      return "uploads";

    case NotificationType.REQUEST_CREATED:
    case NotificationType.REQUEST_DUE_SOON:
    case NotificationType.REQUEST_STATUS_CHANGED:
      return "requests";

    case NotificationType.COMMENT_ADDED:
    case NotificationType.MENTION:
    case NotificationType.MESSAGE_RECEIVED:
    case NotificationType.WATCHER_ADDED:
      return "team";

    case NotificationType.SYSTEM:
    default:
      return "system";
  }
}

// ============================================
// WATCHER NOTIFICATION HELPERS
// ============================================

/**
 * Watcher notification preference types
 */
export type WatcherNotifyType = "upload" | "comment" | "status" | "dueDate";

/**
 * Interface for watcher with notification preferences
 */
export interface WatcherWithPreferences {
  userId: string;
  notifyOnUpload: boolean;
  notifyOnComment: boolean;
  notifyOnStatus: boolean;
  notifyOnDueDate: boolean;
}

/**
 * Get request watchers with their notification preferences
 */
export async function getRequestWatchers(
  requestId: string
): Promise<WatcherWithPreferences[]> {
  const watchers = await db.requestWatcher.findMany({
    where: { requestId },
    select: {
      userId: true,
      notifyOnUpload: true,
      notifyOnComment: true,
      notifyOnStatus: true,
      notifyOnDueDate: true,
    },
  });

  return watchers;
}

/**
 * Get watchers who should be notified for a specific event type
 */
export async function getWatchersToNotify(
  requestId: string,
  notifyType: WatcherNotifyType,
  excludeUserId?: string
): Promise<string[]> {
  const watchers = await getRequestWatchers(requestId);

  const preferenceMap: Record<WatcherNotifyType, keyof WatcherWithPreferences> = {
    upload: "notifyOnUpload",
    comment: "notifyOnComment",
    status: "notifyOnStatus",
    dueDate: "notifyOnDueDate",
  };

  const preferenceKey = preferenceMap[notifyType];

  return watchers
    .filter((w) => w[preferenceKey] && w.userId !== excludeUserId)
    .map((w) => w.userId);
}

/**
 * Notify watchers when a new upload is submitted
 */
export async function notifyWatchersOnUpload(
  requestId: string,
  requestTitle: string,
  uploaderName: string,
  excludeUserId?: string
): Promise<number> {
  const watcherIds = await getWatchersToNotify(requestId, "upload", excludeUserId);

  if (watcherIds.length === 0) return 0;

  return createBulkNotifications(
    watcherIds.map((userId) => ({
      userId,
      type: NotificationType.UPLOAD_SUBMITTED,
      title: "New Upload on Watched Request",
      message: `${uploaderName} submitted new content for "${requestTitle}"`,
      link: `/dashboard/requests/${requestId}`,
      metadata: { requestId },
    }))
  );
}

/**
 * Notify watchers when a comment is added
 */
export async function notifyWatchersOnComment(
  requestId: string,
  requestTitle: string,
  commenterName: string,
  commentPreview: string,
  excludeUserId?: string
): Promise<number> {
  const watcherIds = await getWatchersToNotify(requestId, "comment", excludeUserId);

  if (watcherIds.length === 0) return 0;

  const preview =
    commentPreview.length > 50 ? commentPreview.slice(0, 50) + "..." : commentPreview;

  return createBulkNotifications(
    watcherIds.map((userId) => ({
      userId,
      type: NotificationType.COMMENT_ADDED,
      title: "New Comment on Watched Request",
      message: `${commenterName} commented on "${requestTitle}": ${preview}`,
      link: `/dashboard/requests/${requestId}`,
      metadata: { requestId, commenterName },
    }))
  );
}

/**
 * Notify watchers when request status changes
 */
export async function notifyWatchersOnStatusChange(
  requestId: string,
  requestTitle: string,
  newStatus: string,
  changedByName: string,
  excludeUserId?: string
): Promise<number> {
  const watcherIds = await getWatchersToNotify(requestId, "status", excludeUserId);

  if (watcherIds.length === 0) return 0;

  const statusLabels: Record<string, string> = {
    DRAFT: "Draft",
    PENDING: "Pending",
    IN_PROGRESS: "In Progress",
    SUBMITTED: "Submitted",
    UNDER_REVIEW: "Under Review",
    NEEDS_REVISION: "Needs Revision",
    APPROVED: "Approved",
    CANCELLED: "Cancelled",
    ARCHIVED: "Archived",
  };

  const statusLabel = statusLabels[newStatus] || newStatus;

  return createBulkNotifications(
    watcherIds.map((userId) => ({
      userId,
      type: NotificationType.REQUEST_STATUS_CHANGED,
      title: "Status Change on Watched Request",
      message: `"${requestTitle}" status changed to ${statusLabel} by ${changedByName}`,
      link: `/dashboard/requests/${requestId}`,
      metadata: { requestId, newStatus },
    }))
  );
}

/**
 * Notify watchers when request is due soon
 */
export async function notifyWatchersOnDueDate(
  requestId: string,
  requestTitle: string,
  daysRemaining: number
): Promise<number> {
  const watcherIds = await getWatchersToNotify(requestId, "dueDate");

  if (watcherIds.length === 0) return 0;

  const timeStr =
    daysRemaining === 0
      ? "today"
      : daysRemaining === 1
      ? "tomorrow"
      : `in ${daysRemaining} days`;

  return createBulkNotifications(
    watcherIds.map((userId) => ({
      userId,
      type: NotificationType.REQUEST_DUE_SOON,
      title: "Watched Request Due Soon",
      message: `"${requestTitle}" is due ${timeStr}`,
      link: `/dashboard/requests/${requestId}`,
      metadata: { requestId, daysRemaining },
    }))
  );
}

/**
 * Notify all watchers about a general request update
 */
export async function notifyAllWatchers(
  requestId: string,
  title: string,
  message: string,
  type: NotificationType = NotificationType.SYSTEM,
  excludeUserId?: string
): Promise<number> {
  const watchers = await getRequestWatchers(requestId);
  const watcherIds = watchers
    .filter((w) => w.userId !== excludeUserId)
    .map((w) => w.userId);

  if (watcherIds.length === 0) return 0;

  return createBulkNotifications(
    watcherIds.map((userId) => ({
      userId,
      type,
      title,
      message,
      link: `/dashboard/requests/${requestId}`,
      metadata: { requestId },
    }))
  );
}
