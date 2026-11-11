import webpush from "web-push";
import { db } from "./db";
import { BRAND } from "./brand";
import { configure } from "./push";
import { getUserNotificationPreferences, isChannelEnabled, shouldSuppressNotification } from "./notification-sender";
import { NotificationType } from "./notifications";

/**
 * Notifications on staff devices (Web Push), alongside the in-app ones from
 * notifyTeam: new messages, comments and mentions reach a phone or computer
 * with CCM closed. Each person turns them on per device (Settings >
 * Notifications); their notification settings (the Push switch per kind, Do
 * Not Disturb, quiet hours) still apply.
 *
 * Discreet: a notification shows on a lock screen, so it says who and what
 * ("Rachel sent you a message"), never the message or a request title.
 * Never throws. Server only.
 */

export interface StaffPush {
  body: string;
  /** Where tapping it goes */
  url?: string;
  /** Notifications with the same tag replace each other (one per conversation) */
  tag?: string;
  /** The check sent when a device turns them on: shows even with CCM open, ignores quiet hours */
  test?: boolean;
}

/** What a notification says when the caller doesn't say */
export function defaultStaffPush(type: NotificationType): string {
  switch (type) {
    case NotificationType.MESSAGE_RECEIVED:
      return "You have a new message.";
    case NotificationType.COMMENT_ADDED:
      return "There's a new comment on a request.";
    case NotificationType.MENTION:
      return "You were mentioned.";
    case NotificationType.UPLOAD_SUBMITTED:
      return "A creator sent content.";
    default:
      return "Something new in CCM.";
  }
}

export async function pushToTeam(userIds: string[], type: NotificationType, push: StaffPush): Promise<{ sent: number }> {
  try {
    if (!userIds.length || !configure()) return { sent: 0 };
    const subs = await db.staffPushSubscription.findMany({ where: { userId: { in: [...new Set(userIds)] } } });
    if (!subs.length) return { sent: 0 };

    // Each person's own settings: the Push switch for this kind, Do Not Disturb, quiet hours
    const allowed = new Set<string>();
    for (const userId of new Set(subs.map((s) => s.userId))) {
      const prefs = await getUserNotificationPreferences(userId);
      if (push.test || (!shouldSuppressNotification(prefs).suppress && isChannelEnabled(prefs, type, "push"))) allowed.add(userId);
    }

    const payload = JSON.stringify({
      title: BRAND.name,
      body: push.body,
      tag: push.tag ?? `staff-${type}`,
      // Not when CCM is open in front of them: the page's own pop-up says it (public/push-sw.js)
      quietWhenOpen: !push.test,
      data: { url: push.url || "/dashboard" },
    });
    let sent = 0;
    const gone: string[] = [];
    const delivered: string[] = [];
    await Promise.all(
      subs
        .filter((s) => allowed.has(s.userId))
        .map(async (s) => {
          try {
            await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 6 });
            sent++;
            delivered.push(s.id);
          } catch (error) {
            const status = (error as { statusCode?: number }).statusCode;
            if (status === 404 || status === 410) gone.push(s.id);
            else console.error("[staff-push] send failed:", status, error instanceof Error ? error.message : error);
          }
        })
    );
    if (gone.length) await db.staffPushSubscription.deleteMany({ where: { id: { in: gone } } }).catch(() => {});
    if (delivered.length) await db.staffPushSubscription.updateMany({ where: { id: { in: delivered } }, data: { lastSentAt: new Date() } }).catch(() => {});
    return { sent };
  } catch (error) {
    console.error("[staff-push] failed:", error instanceof Error ? error.message : error);
    return { sent: 0 };
  }
}
