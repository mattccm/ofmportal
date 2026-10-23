import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/api";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { z } from "zod";
import { randomBytes } from "crypto";
import { rateLimitAsync, RATE_LIMITS, getClientIp } from "@/lib/rate-limit";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Generate a secure session token
function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export async function POST(req: NextRequest) {
  try {
    // Rate limit by IP address
    const clientIp = getClientIp(req.headers);
    const rateLimitResult = await rateLimitAsync(`login:${clientIp}`, RATE_LIMITS.login);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: "Too many login attempts. Please try again later.",
          retryAfter: rateLimitResult.retryAfter,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimitResult.retryAfter),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(rateLimitResult.reset),
          },
        }
      );
    }

    const bodyResult = await parseJsonBody(req);
    if (!bodyResult.ok) return bodyResult.response;
    const body = bodyResult.data;
    const { email, password } = loginSchema.parse(body);

    // Rate limit by email too (prevents distributed brute force)
    const emailRateLimitResult = await rateLimitAsync(`login:email:${email.toLowerCase()}`, RATE_LIMITS.login);
    if (!emailRateLimitResult.success) {
      return NextResponse.json(
        {
          error: "Too many login attempts for this account. Please try again later.",
          retryAfter: emailRateLimitResult.retryAfter,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(emailRateLimitResult.retryAfter),
          },
        }
      );
    }

    // Find creator with ACCEPTED status (archived creators are denied access)
    const creator = await db.creator.findFirst({
      where: {
        email: email.toLowerCase(),
        inviteStatus: "ACCEPTED",
        archivedAt: null,
      },
    });

    if (!creator) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    if (!creator.portalPassword) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const passwordValid = await verifyPassword(password, creator.portalPassword);

    if (!passwordValid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Reuse the current token while it is still valid so logging in on another
    // device doesn't sign out the first one; otherwise generate a new one.
    // Session expires after 30 days of inactivity (extended on each API call)
    const reuse = creator.sessionToken && creator.sessionExpiry && creator.sessionExpiry > new Date();
    const sessionToken = reuse ? creator.sessionToken! : generateSessionToken();
    const sessionExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Store session token in database
    await db.creator.update({
      where: { id: creator.id },
      data: {
        lastLoginAt: new Date(),
        sessionToken: sessionToken,
        sessionExpiry: sessionExpiry,
      },
    });

    return NextResponse.json({
      token: sessionToken,
      creatorId: creator.id,
      name: creator.name,
      email: creator.email,
      onboardingCompleted: !!creator.onboardingCompletedAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error logging in:", error);
    return NextResponse.json(
      { error: "Failed to log in" },
      { status: 500 }
    );
  }
}
