import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// Security-related actions to filter
const SECURITY_ACTIONS = [
  "auth.login",
  "auth.login.failed",
  "auth.logout",
  "password.changed",
  "2fa.enabled",
  "2fa.disabled",
  "session.terminate",
  "session.terminate_all",
  "api_key.created",
  "api_key.revoked",
  "email.changed",
  "account.updated",
];

// GET /api/auth/security-logs - Get security activity logs
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");
    const action = searchParams.get("action"); // Filter by specific action

    const whereClause: Record<string, unknown> = {
      userId: session.user.id,
      action: action
        ? action
        : { in: SECURITY_ACTIONS },
    };

    // Get total count
    const totalCount = await db.activityLog.count({ where: whereClause });

    // Get logs
    const logs = await db.activityLog.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        metadata: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
      },
    });

    // Format logs for the frontend
    const formattedLogs = logs.map((log) => ({
      id: log.id,
      action: log.action,
      description: getActionDescription(log.action),
      entityType: log.entityType,
      entityId: log.entityId,
      metadata: log.metadata,
      ipAddress: log.ipAddress || "Unknown",
      userAgent: log.userAgent || "Unknown",
      device: parseUserAgent(log.userAgent || ""),
      timestamp: log.createdAt,
      success: !log.action.includes("failed"),
    }));

    return NextResponse.json({
      logs: formattedLogs,
      total: totalCount,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Get security logs error:", error);
    return NextResponse.json(
      { error: "Failed to get security logs" },
      { status: 500 }
    );
  }
}

function getActionDescription(action: string): string {
  const descriptions: Record<string, string> = {
    "auth.login": "Successful login",
    "auth.login.failed": "Failed login attempt",
    "auth.logout": "Logged out",
    "password.changed": "Password changed",
    "2fa.enabled": "Two-factor authentication enabled",
    "2fa.disabled": "Two-factor authentication disabled",
    "session.terminate": "Session terminated",
    "session.terminate_all": "All sessions terminated",
    "api_key.created": "API key created",
    "api_key.revoked": "API key revoked",
    "email.changed": "Email address changed",
    "account.updated": "Account settings updated",
  };
  return descriptions[action] || action;
}

function parseUserAgent(userAgent: string): { browser: string; os: string } {
  // Simple user agent parsing
  let browser = "Unknown Browser";
  let os = "Unknown OS";

  // Detect browser
  if (userAgent.includes("Chrome")) {
    browser = "Chrome";
  } else if (userAgent.includes("Firefox")) {
    browser = "Firefox";
  } else if (userAgent.includes("Safari")) {
    browser = "Safari";
  } else if (userAgent.includes("Edge")) {
    browser = "Edge";
  } else if (userAgent.includes("Opera")) {
    browser = "Opera";
  }

  // Detect OS
  if (userAgent.includes("Windows")) {
    os = "Windows";
  } else if (userAgent.includes("Mac OS")) {
    os = "macOS";
  } else if (userAgent.includes("Linux")) {
    os = "Linux";
  } else if (userAgent.includes("Android")) {
    os = "Android";
  } else if (userAgent.includes("iOS") || userAgent.includes("iPhone")) {
    os = "iOS";
  }

  return { browser, os };
}
