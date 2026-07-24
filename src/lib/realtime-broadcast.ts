/**
 * Server-side Realtime Broadcasting
 *
 * This module allows server-side code to broadcast events to connected clients
 * via Supabase Realtime. Use this in API routes after mutations to notify
 * clients of changes without requiring them to poll.
 *
 * Example usage in an API route:
 * ```
 * import { broadcastNotification, broadcastRequestUpdate } from "@/lib/realtime-broadcast";
 *
 * // After creating a notification
 * await broadcastNotification(userId, notification);
 *
 * // After updating a request
 * await broadcastRequestUpdate(requestId, { type: "status_changed", newStatus: "APPROVED" });
 * ```
 */

import { createClient, RealtimeChannel } from "@supabase/supabase-js";

// Server-side Supabase client (uses service role key for broadcasting)
let serverSupabase: ReturnType<typeof createClient> | null = null;

function getServerSupabase() {
  if (serverSupabase) return serverSupabase;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    // Require service role key for server-side broadcasting - don't fall back to anon key
    return null;
  }

  serverSupabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return serverSupabase;
}

/**
 * Check if server-side broadcasting is available
 */
export function isBroadcastAvailable(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

// BROADCAST FUNCTIONS

const SUBSCRIBE_TIMEOUT_MS = 5000;

interface BroadcastResult {
  success: boolean;
  error?: string;
}

interface BroadcastMessage {
  event: string;
  payload: Record<string, unknown>;
}

/**
 * Wait until a channel is actually SUBSCRIBED before broadcasting.
 * `channel.subscribe()` resolves to the channel, not the subscription status,
 * so broadcasting immediately after it drops messages. The status callback is
 * the only reliable signal that the socket is ready.
 */
function waitForSubscribed(channel: RealtimeChannel): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Realtime subscribe timed out")),
      SUBSCRIBE_TIMEOUT_MS
    );
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        clearTimeout(timer);
        resolve();
      } else if (
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT" ||
        status === "CLOSED"
      ) {
        clearTimeout(timer);
        reject(new Error(`Realtime subscribe failed: ${status}`));
      }
    });
  });
}

/**
 * Subscribe to a channel, wait for the subscription to be confirmed, send one
 * or more broadcast messages over it, then tear the channel down. Batching lets
 * callers avoid subscribing/unsubscribing a fresh channel per message.
 */
async function sendBroadcasts(
  channelName: string,
  messages: BroadcastMessage[]
): Promise<BroadcastResult> {
  if (messages.length === 0) return { success: true };

  const supabase = getServerSupabase();
  if (!supabase) {
    return { success: false, error: "Supabase not configured" };
  }

  const channel = supabase.channel(channelName);
  try {
    await waitForSubscribed(channel);

    for (const message of messages) {
      const result = await channel.send({
        type: "broadcast",
        event: message.event,
        payload: message.payload,
      });
      if (result !== "ok") {
        return { success: false, error: `Broadcast failed: ${result}` };
      }
    }

    return { success: true };
  } catch (error) {
    console.error(`[Broadcast] Error on channel ${channelName}:`, error);
    return { success: false, error: String(error) };
  } finally {
    await channel.unsubscribe().catch(() => {});
  }
}

interface NotificationBroadcast {
  id?: string;
  type: string;
  title: string;
  message: string;
  link?: string;
}

/**
 * Broadcast a single notification to a specific user's channel. This is the
 * channel the notification bell subscribes to (`user:{id}:notifications`).
 */
export async function broadcastNotification(
  userId: string,
  notification: NotificationBroadcast
): Promise<BroadcastResult> {
  return broadcastNotificationsToUser(userId, [notification]);
}

/**
 * Broadcast multiple notifications to a single user over one channel
 * subscription (used when a bulk operation targets the same recipient).
 */
export async function broadcastNotificationsToUser(
  userId: string,
  notifications: NotificationBroadcast[]
): Promise<BroadcastResult> {
  const timestamp = new Date().toISOString();
  return sendBroadcasts(
    `user:${userId}:notifications`,
    notifications.map((data) => ({
      event: "notification",
      payload: { type: "notification", data, timestamp, userId },
    }))
  );
}

/**
 * Broadcast an agency-wide notification (e.g., new upload, status change)
 */
export async function broadcastAgencyNotification(
  agencyId: string,
  notification: {
    type: string;
    title: string;
    message: string;
    entityType?: string;
    entityId?: string;
    link?: string;
  }
): Promise<BroadcastResult> {
  return sendBroadcasts(`agency:${agencyId}:notifications`, [
    {
      event: "notification",
      payload: {
        type: "notification",
        data: notification,
        timestamp: new Date().toISOString(),
        agencyId,
      },
    },
  ]);
}

/**
 * Broadcast a request update (new comment, upload, status change)
 */
export async function broadcastRequestUpdate(
  requestId: string,
  update: {
    type: "comment" | "upload" | "status_change" | "upload_status";
    data: Record<string, unknown>;
  }
): Promise<BroadcastResult> {
  return sendBroadcasts(`request:${requestId}`, [
    {
      event: update.type,
      payload: {
        type: update.type,
        data: update.data,
        timestamp: new Date().toISOString(),
      },
    },
  ]);
}

/**
 * Broadcast a new message in a conversation
 */
export async function broadcastConversationMessage(
  conversationId: string,
  message: {
    id: string;
    content: string;
    senderId?: string;
    senderName?: string;
    createdAt: string;
  }
): Promise<BroadcastResult> {
  return sendBroadcasts(`conversation:${conversationId}`, [
    {
      event: "message",
      payload: {
        type: "message",
        data: message,
        timestamp: new Date().toISOString(),
      },
    },
  ]);
}

/**
 * Broadcast a review-session annotation event (add / update / delete / clear)
 * to every participant subscribed to the session's annotation channel. The
 * payload mirrors the client-side `AnnotationEvent` shape (`{ action, annotation }`)
 * so subscribers can apply it without caring whether it originated on the
 * server (persisted mutation) or the client (live in-progress preview).
 */
export async function broadcastSessionAnnotation(
  sessionId: string,
  event: {
    action: "add" | "update" | "delete" | "clear";
    annotation: Record<string, unknown>;
  }
): Promise<BroadcastResult> {
  return sendBroadcasts(`review-session:${sessionId}:annotations`, [
    {
      event: "annotation",
      payload: {
        type: "annotation",
        data: event,
        timestamp: new Date().toISOString(),
        sessionId,
      },
    },
  ]);
}

/**
 * Broadcast to creator portal (new request, reminder, etc.)
 */
export async function broadcastCreatorUpdate(
  creatorId: string,
  update: {
    type: "new_request" | "reminder" | "message" | "request_update";
    data: Record<string, unknown>;
  }
): Promise<BroadcastResult> {
  return sendBroadcasts(`creator:${creatorId}:portal`, [
    {
      event: update.type,
      payload: {
        type: update.type,
        data: update.data,
        timestamp: new Date().toISOString(),
        creatorId,
      },
    },
  ]);
}
