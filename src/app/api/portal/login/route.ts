import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { z } from "zod";
import { randomBytes } from "crypto";
import { rateLimit, RATE_LIMITS, getClientIp } from "@/lib/rate-limit";

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
    const rateLimitResult = rateLimit(`login:${clientIp}`, RATE_LIMITS.login);

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

    const body = await req.json();
    const { email, password } = loginSchema.parse(body);

    // Find creator with ACCEPTED status
    const creator = await db.creator.findFirst({
      where: {
        email: email.toLowerCase(),
        inviteStatus: "ACCEPTED",
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

    // Generate a secure session token
    // Session expires after 30 days of inactivity (extended on each API call)
    const sessionToken = generateSessionToken();
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
