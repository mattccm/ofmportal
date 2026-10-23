import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// Get current session token from cookies
async function getCurrentSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();

  // NextAuth session token cookie names
  const sessionToken = cookieStore.get("next-auth.session-token")?.value
    || cookieStore.get("__Secure-next-auth.session-token")?.value;

  return sessionToken || null;
}

// Session type with extended metadata
interface SessionWithMetadata {
  id: string;
  sessionToken: string;
  userId: string;
  expires: Date;
  // Extended fields (may not exist if schema not migrated)
  userAgent?: string | null;
  ipAddress?: string | null;
  device?: string | null;
  browser?: string | null;
  os?: string | null;
  location?: string | null;
  lastActive?: Date | null;
  createdAt?: Date | null;
}

// GET /api/auth/sessions - Get all active sessions for the current user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current session token to mark as current
    const currentSessionToken = await getCurrentSessionToken();

    // Get sessions from database
    const sessions = await db.session.findMany({
      where: {
        userId: session.user.id,
        expires: { gt: new Date() },
      },
      orderBy: { expires: "desc" },
    }) as SessionWithMetadata[];

    // Format sessions with device info
    const formattedSessions = sessions.map((s) => {
      const isCurrent = currentSessionToken ? s.sessionToken === currentSessionToken : false;

      return {
        id: s.id,
        sessionToken: s.sessionToken.slice(0, 8) + "...",
        current: isCurrent,
        device: s.device || "desktop",
        browser: s.browser || "Unknown Browser",
        os: s.os || "Unknown OS",
        ip: s.ipAddress ? maskIP(s.ipAddress) : "Unknown",
        location: s.location || "Unknown Location",
        lastActive: s.lastActive?.toISOString() || s.expires.toISOString(),
        createdAt: s.createdAt?.toISOString() || s.expires.toISOString(),
      };
    });

    return NextResponse.json({ sessions: formattedSessions });
  } catch (error) {
    console.error("Get sessions error:", error);
    return NextResponse.json(
      { error: "Failed to get sessions" },
      { status: 500 }
    );
  }
}

// POST /api/auth/sessions - Session heartbeat
// Auth uses JWT sessions with no adapter, so there is no Session row to update.
// This used to geolocate the IP via a third-party service and write an activity
// log entry on every call; it now just confirms the session is active.
export async function POST() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ message: "Session active" });
  } catch (error) {
    console.error("Update session error:", error);
    return NextResponse.json(
      { error: "Failed to update session" },
      { status: 500 }
    );
  }
}

// DELETE /api/auth/sessions - Terminate a specific session or all other sessions
// JWT sessions can't be revoked server-side (the Session table is never
// populated), so report that honestly instead of claiming success.
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Session revocation is not supported with JWT sessions" },
      { status: 501 }
    );
  } catch (error) {
    console.error("Delete session error:", error);
    return NextResponse.json(
      { error: "Failed to terminate session" },
      { status: 500 }
    );
  }
}

// Mask IP address for privacy (show only first 2 octets)
function maskIP(ip: string): string {
  if (!ip || ip === "Unknown") return ip;

  // IPv4
  if (ip.includes(".")) {
    const parts = ip.split(".");
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.*.*`;
    }
  }

  // IPv6
  if (ip.includes(":")) {
    const parts = ip.split(":");
    if (parts.length >= 2) {
      return `${parts[0]}:${parts[1]}:****`;
    }
  }

  return ip;
}
