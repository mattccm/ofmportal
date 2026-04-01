import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// User agent parser utility
function parseUserAgent(userAgent: string | null): {
  browser: string;
  os: string;
  device: string;
} {
  if (!userAgent) {
    return { browser: "Unknown", os: "Unknown", device: "desktop" };
  }

  // Detect device type
  let device = "desktop";
  if (/mobile|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase())) {
    if (/tablet|ipad/i.test(userAgent.toLowerCase())) {
      device = "tablet";
    } else {
      device = "mobile";
    }
  }

  // Detect browser
  let browser = "Unknown Browser";
  if (userAgent.includes("Firefox/")) {
    const match = userAgent.match(/Firefox\/(\d+)/);
    browser = `Firefox ${match ? match[1] : ""}`.trim();
  } else if (userAgent.includes("Edg/")) {
    const match = userAgent.match(/Edg\/(\d+)/);
    browser = `Edge ${match ? match[1] : ""}`.trim();
  } else if (userAgent.includes("Chrome/")) {
    const match = userAgent.match(/Chrome\/(\d+)/);
    browser = `Chrome ${match ? match[1] : ""}`.trim();
  } else if (userAgent.includes("Safari/") && !userAgent.includes("Chrome")) {
    const match = userAgent.match(/Version\/(\d+)/);
    browser = `Safari ${match ? match[1] : ""}`.trim();
  } else if (userAgent.includes("MSIE") || userAgent.includes("Trident/")) {
    browser = "Internet Explorer";
  }

  // Detect OS
  let os = "Unknown OS";
  if (userAgent.includes("Windows NT 10")) {
    os = "Windows 10/11";
  } else if (userAgent.includes("Windows NT 6.3")) {
    os = "Windows 8.1";
  } else if (userAgent.includes("Windows NT 6.2")) {
    os = "Windows 8";
  } else if (userAgent.includes("Windows NT 6.1")) {
    os = "Windows 7";
  } else if (userAgent.includes("Windows")) {
    os = "Windows";
  } else if (userAgent.includes("Mac OS X")) {
    const match = userAgent.match(/Mac OS X (\d+[._]\d+)/);
    os = match ? `macOS ${match[1].replace(/_/g, ".")}` : "macOS";
  } else if (userAgent.includes("Android")) {
    const match = userAgent.match(/Android (\d+)/);
    os = `Android ${match ? match[1] : ""}`.trim();
  } else if (userAgent.includes("iOS") || userAgent.includes("iPhone") || userAgent.includes("iPad")) {
    const match = userAgent.match(/OS (\d+)/);
    os = `iOS ${match ? match[1] : ""}`.trim();
  } else if (userAgent.includes("Linux")) {
    os = "Linux";
  }

  return { browser, os, device };
}

// Get client IP address
function getClientIP(request: NextRequest): string {
  // Check various headers for the real IP
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  const realIP = request.headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }

  const cfConnectingIP = request.headers.get("cf-connecting-ip");
  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  return "Unknown";
}

// Simple IP geolocation (in production, use a service like MaxMind or ipinfo.io)
async function getLocationFromIP(ip: string): Promise<string> {
  // For privacy, we only show approximate location
  // In production, integrate with a geolocation service
  if (ip === "Unknown" || ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168.") || ip.startsWith("10.")) {
    return "Local Network";
  }

  try {
    // Using a free IP geolocation API (rate limited, use with caution in production)
    const response = await fetch(`https://ipapi.co/${ip}/json/`, {
      signal: AbortSignal.timeout(3000),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.city && data.country_name) {
        return `${data.city}, ${data.country_name}`;
      } else if (data.country_name) {
        return data.country_name;
      }
    }
  } catch {
    // Silently fail - location is not critical
  }

  return "Unknown Location";
}

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

// POST /api/auth/sessions - Create or update session metadata
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userAgent = request.headers.get("user-agent");
    const ipAddress = getClientIP(request);
    const { browser, os, device } = parseUserAgent(userAgent);

    // Get location from IP (async but we'll store it)
    const location = await getLocationFromIP(ipAddress);

    // Get current session token
    const currentSessionToken = await getCurrentSessionToken();

    if (!currentSessionToken) {
      return NextResponse.json({ error: "No active session" }, { status: 400 });
    }

    // Try to update session metadata (fields may not exist if schema not migrated)
    try {
      // Use raw update to handle missing fields gracefully
      await db.$executeRaw`
        UPDATE "Session"
        SET "userAgent" = ${userAgent},
            "ipAddress" = ${ipAddress},
            "device" = ${device},
            "browser" = ${browser},
            "os" = ${os},
            "location" = ${location},
            "lastActive" = ${new Date()}
        WHERE "sessionToken" = ${currentSessionToken}
          AND "userId" = ${session.user.id}
      `;
    } catch (updateError) {
      // If update fails (likely schema not migrated), just return success
      // The session still exists, we just can't store metadata
      console.log("Session metadata update skipped - schema may not be migrated");
      return NextResponse.json({
        message: "Session active",
        metadata: { device, browser, os, location }
      });
    }

    // Log the activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "session.updated",
        entityType: "Session",
        entityId: session.user.id,
        metadata: { device, browser, os },
        ipAddress,
        userAgent,
      },
    });

    return NextResponse.json({
      message: "Session metadata updated",
      metadata: { device, browser, os, location }
    });
  } catch (error) {
    console.error("Update session error:", error);
    return NextResponse.json(
      { error: "Failed to update session" },
      { status: 500 }
    );
  }
}

// DELETE /api/auth/sessions - Terminate a specific session or all other sessions
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId, terminateAll } = await request.json();
    const currentSessionToken = await getCurrentSessionToken();
    const userAgent = request.headers.get("user-agent");
    const ipAddress = getClientIP(request);

    if (terminateAll) {
      // Terminate all sessions except current
      const deleted = await db.session.deleteMany({
        where: {
          userId: session.user.id,
          ...(currentSessionToken ? { sessionToken: { not: currentSessionToken } } : {}),
        },
      });

      // Log the security event
      await db.activityLog.create({
        data: {
          userId: session.user.id,
          action: "session.terminate_all",
          entityType: "Session",
          entityId: session.user.id,
          metadata: { deletedCount: deleted.count },
          ipAddress,
          userAgent,
        },
      });

      return NextResponse.json({
        message: "All other sessions terminated",
        deletedCount: deleted.count,
      });
    }

    if (sessionId) {
      // Get session details before deletion for logging
      const sessionToDelete = await db.session.findFirst({
        where: {
          id: sessionId,
          userId: session.user.id,
        },
      }) as SessionWithMetadata | null;

      if (!sessionToDelete) {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }

      // Check if trying to delete current session
      if (currentSessionToken && sessionToDelete.sessionToken === currentSessionToken) {
        return NextResponse.json(
          { error: "Cannot revoke current session. Use sign out instead." },
          { status: 400 }
        );
      }

      // Terminate specific session
      await db.session.delete({
        where: { id: sessionId },
      });

      // Log the security event
      await db.activityLog.create({
        data: {
          userId: session.user.id,
          action: "session.terminate",
          entityType: "Session",
          entityId: sessionId,
          metadata: {
            device: sessionToDelete.device || "unknown",
            browser: sessionToDelete.browser || "unknown",
            os: sessionToDelete.os || "unknown",
            location: sessionToDelete.location || "unknown",
          },
          ipAddress,
          userAgent,
        },
      });

      return NextResponse.json({ message: "Session terminated" });
    }

    return NextResponse.json(
      { error: "Session ID or terminateAll flag required" },
      { status: 400 }
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
