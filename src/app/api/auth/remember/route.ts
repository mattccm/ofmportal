import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimitAsync, RATE_LIMITS, getClientIp } from "@/lib/rate-limit";
import crypto from "crypto";
import bcrypt from "bcryptjs";

// Token configuration
const TOKEN_EXPIRY_DAYS = 90;
const TOKEN_ID_BYTES = 16;
const TOKEN_SECRET_BYTES = 32;
// Short-lived, single-use nonce that bridges a validated remember token to a session
const NONCE_BYTES = 32;
const NONCE_EXPIRY_MS = 2 * 60 * 1000;

interface MintedToken {
  token: string;
  tokenId: string;
  tokenHash: string;
}

/**
 * Mint a remember token as `${tokenId}.${secret}`.
 * tokenId is stored in the clear for indexed lookup; only the secret is hashed.
 */
async function mintToken(): Promise<MintedToken> {
  const tokenId = crypto.randomBytes(TOKEN_ID_BYTES).toString("base64url");
  const secret = crypto.randomBytes(TOKEN_SECRET_BYTES).toString("base64url");
  const tokenHash = await bcrypt.hash(secret, 10);
  return { token: `${tokenId}.${secret}`, tokenId, tokenHash };
}

/**
 * Split a raw token into its lookup id and secret halves.
 */
function parseToken(token: string): { tokenId: string; secret: string } | null {
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;
  return { tokenId: token.slice(0, dot), secret: token.slice(dot + 1) };
}

/**
 * SHA-256 hex digest (used for high-entropy single-use nonces).
 */
function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/**
 * Parse user agent to get device info
 */
function parseUserAgent(userAgent: string | null): {
  deviceName: string;
  deviceType: string;
} {
  if (!userAgent) {
    return { deviceName: "Unknown Device", deviceType: "unknown" };
  }

  const ua = userAgent.toLowerCase();

  // Detect device type and name
  let deviceType = "desktop";
  let deviceName = "Unknown Device";

  if (ua.includes("iphone")) {
    deviceType = "mobile";
    deviceName = "iPhone";
  } else if (ua.includes("ipad")) {
    deviceType = "tablet";
    deviceName = "iPad";
  } else if (ua.includes("android")) {
    deviceType = ua.includes("mobile") ? "mobile" : "tablet";
    deviceName = "Android Device";
  } else if (ua.includes("macintosh") || ua.includes("mac os")) {
    deviceName = "Mac";
  } else if (ua.includes("windows")) {
    deviceName = "Windows PC";
  } else if (ua.includes("linux")) {
    deviceName = "Linux";
  }

  // Add browser info
  if (ua.includes("chrome") && !ua.includes("edg")) {
    deviceName += " (Chrome)";
  } else if (ua.includes("safari") && !ua.includes("chrome")) {
    deviceName += " (Safari)";
  } else if (ua.includes("firefox")) {
    deviceName += " (Firefox)";
  } else if (ua.includes("edg")) {
    deviceName += " (Edge)";
  }

  return { deviceName, deviceType };
}

/**
 * POST /api/auth/remember
 *
 * Creates a new remember token for the authenticated user.
 * Called after successful login when "Remember me" is checked.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userAgent = request.headers.get("user-agent");
    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    const { deviceName, deviceType } = parseUserAgent(userAgent);

    // Generate new token
    const { token, tokenId, tokenHash } = await mintToken();

    // Calculate expiry
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + TOKEN_EXPIRY_DAYS);

    // Delete any existing tokens for this device (based on user agent)
    // This prevents token accumulation
    await db.rememberToken.deleteMany({
      where: {
        userId: session.user.id,
        userAgent: userAgent || undefined,
      },
    });

    // Create new remember token
    await db.rememberToken.create({
      data: {
        userId: session.user.id,
        tokenId,
        tokenHash,
        deviceName,
        deviceType,
        userAgent,
        ipAddress,
        expiresAt,
      },
    });

    // Return the raw token (only time it's sent to client)
    return NextResponse.json({
      token,
      expiresAt: expiresAt.toISOString(),
      deviceName,
    });
  } catch (error) {
    console.error("Error creating remember token:", error);
    return NextResponse.json(
      { error: "Failed to create remember token" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/auth/remember
 *
 * Validates a remember token and creates a new session.
 * Called when the app detects no active session but has a stored token.
 * Returns user data for session creation + a new rotated token.
 */
export async function PUT(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);
    const limit = await rateLimitAsync(`remember:${ip}`, RATE_LIMITS.login);
    if (!limit.success) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter ?? 60) } }
      );
    }

    const body = await request.json();
    const { token } = body;

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "Token required" },
        { status: 400 }
      );
    }

    const userAgent = request.headers.get("user-agent");
    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    const invalid = NextResponse.json(
      { error: "Invalid or expired token", clearToken: true },
      { status: 401 }
    );

    // Indexed lookup by the public token id, then verify the secret half only.
    const parsed = parseToken(token);
    if (!parsed) {
      return invalid;
    }

    const matchedToken = await db.rememberToken.findFirst({
      where: {
        tokenId: parsed.tokenId,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatar: true,
            image: true,
            role: true,
            agencyId: true,
            twoFactorEnabled: true,
            agency: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!matchedToken) {
      return invalid;
    }

    const secretValid = await bcrypt.compare(parsed.secret, matchedToken.tokenHash);
    if (!secretValid) {
      return invalid;
    }

    const user = matchedToken.user;

    // Token rotation: delete old token, create new one
    await db.rememberToken.delete({
      where: { id: matchedToken.id },
    });

    // Generate new rotated token
    const { token: newToken, tokenId: newTokenId, tokenHash: newTokenHash } = await mintToken();
    const { deviceName, deviceType } = parseUserAgent(userAgent);

    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + TOKEN_EXPIRY_DAYS);

    await db.rememberToken.create({
      data: {
        userId: user.id,
        tokenId: newTokenId,
        tokenHash: newTokenHash,
        deviceName,
        deviceType,
        userAgent,
        ipAddress,
        lastUsedAt: new Date(),
        lastUsedIp: ipAddress,
        expiresAt: newExpiresAt,
      },
    });

    // Issue a single-use nonce bound to this user for the credentials sign-in.
    // Only the hash is stored; the raw nonce is returned to the client once.
    const nonce = crypto.randomBytes(NONCE_BYTES).toString("base64url");
    await db.rememberAuthNonce.create({
      data: {
        tokenHash: sha256(nonce),
        userId: user.id,
        expiresAt: new Date(Date.now() + NONCE_EXPIRY_MS),
      },
    });

    // Return user data for session creation + new token + auth nonce
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.avatar || user.image,
        role: user.role,
        agencyId: user.agencyId,
        agencyName: user.agency?.name || "",
        twoFactorEnabled: user.twoFactorEnabled,
      },
      nonce,
      newToken,
      expiresAt: newExpiresAt.toISOString(),
    });
  } catch (error) {
    console.error("Error validating remember token:", error);
    return NextResponse.json(
      { error: "Failed to validate token" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/auth/remember
 *
 * Revokes a remember token (logout from this device) or all tokens.
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tokenId = searchParams.get("id");
    const all = searchParams.get("all") === "true";

    if (all) {
      // Revoke all tokens for this user
      const result = await db.rememberToken.deleteMany({
        where: { userId: session.user.id },
      });

      return NextResponse.json({
        message: `Revoked ${result.count} device(s)`,
        count: result.count,
      });
    }

    if (tokenId) {
      // Revoke specific token
      await db.rememberToken.deleteMany({
        where: {
          id: tokenId,
          userId: session.user.id, // Ensure user owns this token
        },
      });

      return NextResponse.json({ message: "Device removed" });
    }

    return NextResponse.json(
      { error: "Specify token id or all=true" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error revoking remember token:", error);
    return NextResponse.json(
      { error: "Failed to revoke token" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/remember
 *
 * Lists all remembered devices for the current user.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tokens = await db.rememberToken.findMany({
      where: {
        userId: session.user.id,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        deviceName: true,
        deviceType: true,
        ipAddress: true,
        lastUsedAt: true,
        lastUsedIp: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { lastUsedAt: "desc" },
    });

    return NextResponse.json({ devices: tokens });
  } catch (error) {
    console.error("Error fetching remember tokens:", error);
    return NextResponse.json(
      { error: "Failed to fetch devices" },
      { status: 500 }
    );
  }
}
