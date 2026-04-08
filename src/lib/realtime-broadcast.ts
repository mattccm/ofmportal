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

import { createClient } from "@supabase/supabase-js";

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

// ============================================
// BROADCAST FUNCTIONS
// ============================================

interface BroadcastResult {
  success: boolean;
  error?: string;
}

/**
 * Broadcast a notification to a specific user
 */
export async function broadcastNotification(
  userId: string,
  notification: {
    id: string;
    type: string;
    title: string;
    message: string;
    link?: string;
  }
): Promise<BroadcastResult> {
  const supabase = getServerSupabase();
  if (!supabase) {
    return { success: false, error: "Supabase not configured" };
  }

  try {
    const channel = supabase.channel(`user:${userId}:notifications`);
    await channel.subscribe();

    const result = await channel.send({
      type: "broadcast",
      event: "notification",
      payload: {
        type: "notification",
        data: notification,
        timestamp: new Date().toISOString(),
        userId,
      },
    });

    await channel.unsubscribe();
    return { success: result === "ok" };
  } catch (error) {
    console.error("[Broadcast] Error sending notification:", error);
    return { success: false, error: String(error) };
  }
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
  const supabase = getServerSupabase();
  if (!supabase) {
    return { success: false, error: "Supabase not configured" };
  }

  try {
    const channel = supabase.channel(`agency:${agencyId}:notifications`);
    await channel.subscribe();

    const result = await channel.send({
      type: "broadcast",
      event: "notification",
      payload: {
        type: "notification",
        data: notification,
        timestamp: new Date().toISOString(),
        agencyId,
      },
    });

    await channel.unsubscribe();
    return { success: result === "ok" };
  } catch (error) {
    console.error("[Broadcast] Error sending agency notification:", error);
    return { success: false, error: String(error) };
  }
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
  const supabase = getServerSupabase();
  if (!supabase) {
    return { success: false, error: "Supabase not configured" };
  }

  try {
    const channel = supabase.channel(`request:${requestId}`);
    await channel.subscribe();

    const result = await channel.send({
      type: "broadcast",
      event: update.type,
      payload: {
        type: update.type,
        data: update.data,
        timestamp: new Date().toISOString(),
      },
    });

    await channel.unsubscribe();
    return { success: result === "ok" };
  } catch (error) {
    console.error("[Broadcast] Error sending request update:", error);
    return { success: false, error: String(error) };
  }
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
  const supabase = getServerSupabase();
  if (!supabase) {
    return { success: false, error: "Supabase not configured" };
  }

  try {
    const channel = supabase.channel(`conversation:${conversationId}`);
    await channel.subscribe();

    const result = await channel.send({
      type: "broadcast",
      event: "message",
      payload: {
        type: "message",
        data: message,
        timestamp: new Date().toISOString(),
      },
    });

    await channel.unsubscribe();
    return { success: result === "ok" };
  } catch (error) {
    console.error("[Broadcast] Error sending conversation message:", error);
    return { success: false, error: String(error) };
  }
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
  const supabase = getServerSupabase();
  if (!supabase) {
    return { success: false, error: "Supabase not configured" };
  }

  try {
    const channel = supabase.channel(`creator:${creatorId}:portal`);
    await channel.subscribe();

    const result = await channel.send({
      type: "broadcast",
      event: update.type,
      payload: {
        type: update.type,
        data: update.data,
        timestamp: new Date().toISOString(),
        creatorId,
      },
    });

    await channel.unsubscribe();
    return { success: result === "ok" };
  } catch (error) {
    console.error("[Broadcast] Error sending creator update:", error);
    return { success: false, error: String(error) };
  }
}
