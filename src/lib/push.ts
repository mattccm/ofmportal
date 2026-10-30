import webpush from "web-push";
import { db } from "./db";
import { BRAND } from "./brand";

/**
 * Phone notifications for creators (Web Push). A creator turns them on from
 * the "Set up your phone" card; each device is a PushSubscription row. On an
 * iPhone this works only in the portal added to the home screen.
 *
 * Discreet like texts: a notification shows on the lock screen, so it never
 * carries a request title. Server only. Needs VAPID_PUBLIC_KEY and
 * VAPID_PRIVATE_KEY (and optionally VAPID_SUBJECT, a mailto: or https: URL).
 */

let configured: boolean | null = null;

export function pushPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

function configure(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return (configured = false);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:noreply@portal.of-m.com", pub, priv);
  return (configured = true);
}

export interface PushMessage {
  /** Short line under the app name; never a request title */
  body: string;
  /** Where tapping it goes (a path in the portal) */
  url?: string;
  /** Notifications with the same tag replace each other */
  tag?: string;
}

/**
 * Send to every device a creator turned notifications on for. Devices the push
 * service says are gone (404/410) are removed. Never throws.
 */
export async function sendPushToCreator(creatorId: string, message: PushMessage): Promise<{ sent: number; removed: number }> {
  if (!configure()) {
    console.log("[MOCK PUSH] Would be sent:", { creatorId, ...message });
    return { sent: 0, removed: 0 };
  }
  const subs = await db.pushSubscription.findMany({ where: { creatorId } }).catch(() => []);
  let sent = 0;
  const gone: string[] = [];
  const payload = JSON.stringify({ title: BRAND.name, body: message.body, tag: message.tag, data: { url: message.url || "/creator/dashboard" } });
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 24 });
        sent++;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) gone.push(s.id);
        else console.error("[push] send failed:", status, error instanceof Error ? error.message : error);
      }
    })
  );
  if (gone.length) await db.pushSubscription.deleteMany({ where: { id: { in: gone } } }).catch(() => {});
  if (sent) await db.pushSubscription.updateMany({ where: { creatorId, id: { notIn: gone } }, data: { lastSentAt: new Date() } }).catch(() => {});
  return { sent, removed: gone.length };
}

/** The notification that goes with a creator-facing message (same discreet words as texts) */
export function pushFor(event: string, opts: { requestId?: string | null; due?: string } = {}): PushMessage | null {
  const url = opts.requestId ? `/creator/requests/${opts.requestId}` : "/creator/dashboard";
  switch (event) {
    case "request.new":
      return { body: "You have a new content request.", url, tag: `new-${opts.requestId ?? "x"}` };
    case "request.changes":
      return { body: "Changes have been requested on your content.", url, tag: `changes-${opts.requestId ?? "x"}` };
    case "request.approved":
      return { body: "Your content has been approved. Thank you!", url, tag: `approved-${opts.requestId ?? "x"}` };
    case "reminder.manual":
    case "reminder.before":
    case "reminder.dueToday":
    case "reminder.overdue":
      return { body: opts.due ? `You have content ${opts.due}.` : "A reminder about your content.", url, tag: `reminder-${opts.requestId ?? "x"}` };
    default:
      return null;
  }
}

/** A reminder on their phone, alongside a reminder email or text (an email and a text share a tag, so one shows) */
export function pushReminder(creatorId: string, requestId: string, due: string) {
  return sendPushToCreator(creatorId, { body: `You have content ${due}.`, url: `/creator/requests/${requestId}`, tag: `reminder-${requestId}` }).catch(() => ({ sent: 0, removed: 0 }));
}
