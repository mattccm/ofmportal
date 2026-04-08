import { createClient, SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";

/**
 * Supabase Client for Realtime Features
 *
 * This client is used ONLY for Supabase Realtime (WebSocket-based real-time updates).
 * Database queries continue to use Prisma for type safety and consistency.
 *
 * Benefits of Supabase Realtime vs Polling:
 * - Zero egress for real-time updates (WebSocket-based)
 * - Instant updates instead of 5-minute polling delays
 * - Lower server load (no repeated API calls)
 *
 * Setup:
 * 1. Get your Supabase URL from: Supabase Dashboard → Settings → API → Project URL
 * 2. Get your anon key from: Supabase Dashboard → Settings → API → anon/public key
 * 3. Add to .env: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

// Client-side singleton
let supabaseClient: SupabaseClient | null = null;

/**
 * Get or create the Supabase client
 * Safe to call on both server and client
 */
export function getSupabaseClient(): SupabaseClient | null {
  // Check if we have the required env vars
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Realtime not configured - fall back to polling
    if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
      console.warn(
        "[Supabase Realtime] Not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to enable real-time updates."
      );
    }
    return null;
  }

  // Create client if not exists
  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        params: {
          eventsPerSecond: 10, // Rate limit to prevent excessive updates
        },
      },
      // We only use this client for Realtime, not for database operations
      db: {
        schema: "public",
      },
      auth: {
        persistSession: false, // We use NextAuth for auth, not Supabase Auth
        autoRefreshToken: false,
      },
    });
  }

  return supabaseClient;
}

/**
 * Check if Supabase Realtime is available
 */
export function isRealtimeAvailable(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

// ============================================
// REALTIME CHANNEL TYPES
// ============================================

export type RealtimeEventType =
  | "notification"
  | "message"
  | "upload_status"
  | "request_status"
  | "comment"
  | "typing";

export interface RealtimePayload<T = unknown> {
  type: RealtimeEventType;
  data: T;
  timestamp: string;
  userId?: string;
  agencyId?: string;
}

// ============================================
// CHANNEL MANAGEMENT
// ============================================

const activeChannels = new Map<string, RealtimeChannel>();

/**
 * Subscribe to a realtime channel
 * Automatically handles cleanup and reconnection
 */
export function subscribeToChannel(
  channelName: string,
  onMessage: (payload: RealtimePayload) => void,
  options?: {
    filter?: string;
  }
): RealtimeChannel | null {
  const client = getSupabaseClient();
  if (!client) return null;

  // Reuse existing channel if available
  if (activeChannels.has(channelName)) {
    return activeChannels.get(channelName)!;
  }

  const channel = client
    .channel(channelName, {
      config: {
        broadcast: { self: false }, // Don't receive own broadcasts
      },
    })
    .on("broadcast", { event: "*" }, (payload) => {
      onMessage(payload.payload as RealtimePayload);
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log(`[Realtime] Subscribed to channel: ${channelName}`);
      } else if (status === "CHANNEL_ERROR") {
        console.error(`[Realtime] Error on channel: ${channelName}`);
      }
    });

  activeChannels.set(channelName, channel);
  return channel;
}

/**
 * Unsubscribe from a channel
 */
export function unsubscribeFromChannel(channelName: string): void {
  const channel = activeChannels.get(channelName);
  if (channel) {
    channel.unsubscribe();
    activeChannels.delete(channelName);
    console.log(`[Realtime] Unsubscribed from channel: ${channelName}`);
  }
}

/**
 * Broadcast a message to a channel
 */
export async function broadcastToChannel(
  channelName: string,
  payload: RealtimePayload
): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  let channel = activeChannels.get(channelName);
  if (!channel) {
    // Create a temporary channel for broadcasting
    channel = client.channel(channelName);
    await channel.subscribe();
  }

  const result = await channel.send({
    type: "broadcast",
    event: payload.type,
    payload,
  });

  return result === "ok";
}

/**
 * Cleanup all channels (call on app unmount)
 */
export function cleanupAllChannels(): void {
  for (const [name, channel] of activeChannels) {
    channel.unsubscribe();
    console.log(`[Realtime] Cleaned up channel: ${name}`);
  }
  activeChannels.clear();
}

// ============================================
// CHANNEL NAME HELPERS
// ============================================

export const channelNames = {
  /** Agency-wide notifications channel */
  agencyNotifications: (agencyId: string) => `agency:${agencyId}:notifications`,

  /** User-specific notifications */
  userNotifications: (userId: string) => `user:${userId}:notifications`,

  /** Request-specific updates (comments, uploads, status) */
  request: (requestId: string) => `request:${requestId}`,

  /** Conversation messages */
  conversation: (conversationId: string) => `conversation:${conversationId}`,

  /** Typing indicators for a conversation */
  typing: (conversationId: string) => `typing:${conversationId}`,

  /** Creator portal updates */
  creatorPortal: (creatorId: string) => `creator:${creatorId}:portal`,
};
