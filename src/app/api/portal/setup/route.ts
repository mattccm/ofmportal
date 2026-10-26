import { NextRequest, NextResponse, after } from "next/server";
import { parseJsonBody } from "@/lib/api";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { rateLimitAsync, RATE_LIMITS, getClientIp } from "@/lib/rate-limit";
import { z } from "zod";
import { createCreatorSessionToken } from "@/lib/portal-auth";
import { dispatchWebhookEvent } from "@/lib/webhooks";
import { creatorInvite } from "@/lib/invites";
import { captureCreatorTimeZone } from "@/lib/due-server";

const setupSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  // The browser's time zone: due dates end at 23:59 in it
  timezone: z.string().max(64).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req.headers);
    const rl = await rateLimitAsync(`portal-setup:${clientIp}`, RATE_LIMITS.passwordReset);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later.", retryAfter: rl.retryAfter },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 60) } }
      );
    }

    const bodyResult = await parseJsonBody(req);
    if (!bodyResult.ok) return bodyResult.response;
    const body = bodyResult.data;
    const { token, password, timezone } = setupSchema.parse(body);

    const creator = await db.creator.findFirst({
      where: {
        inviteToken: token,
        inviteStatus: "PENDING",
      },
    });

    if (!creator) {
      return NextResponse.json(
        { error: "This invite link has already been used, was replaced or was cancelled. Ask your team for a new link." },
        { status: 404 }
      );
    }

    // Links work for 7 days from when they were issued
    if (creatorInvite(creator).state === "expired") {
      return NextResponse.json(
        { error: "This invite link has expired. Ask your team for a new link." },
        { status: 410 }
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Signed in straight away (same 30-day session the portal login issues),
    // except for archived creators, who are denied portal access and so get
    // no session. A fresh token is always issued: setting a new password should
    // not keep any older session alive.
    const canSignIn = creator.archivedAt === null;
    const session = canSignIn ? createCreatorSessionToken() : null;
    const sessionToken = session?.token ?? null;
    const sessionExpiry = session?.expiresAt ?? null;

    // Update creator. Conditional on the token still being pending so two
    // concurrent submits of the same invite can't both succeed.
    const updated = await db.creator.updateMany({
      where: { id: creator.id, inviteToken: token, inviteStatus: "PENDING" },
      data: {
        portalPassword: hashedPassword,
        inviteStatus: "ACCEPTED",
        inviteToken: null, // Clear the token
        ...(canSignIn
          ? { sessionToken, sessionExpiry, lastLoginAt: new Date() }
          : { sessionToken: null, sessionExpiry: null }),
      },
    });

    if (updated.count === 0) {
      return NextResponse.json(
        { error: "Invalid or expired invite link" },
        { status: 404 }
      );
    }

    // Their own time zone, unless the team already set one
    if (timezone) await captureCreatorTimeZone(creator.id, timezone);

    // Fire webhook for creator joining (after() keeps it alive past the response)
    after(() =>
      dispatchWebhookEvent(creator.agencyId, "creator.joined", {
        creatorId: creator.id,
        creatorName: creator.name,
        creatorEmail: creator.email,
      })
    );

    // Same session payload as POST /api/portal/login (session is null when the
    // creator can't sign in, and the client falls back to the login page)
    return NextResponse.json({
      success: true,
      message: "Account set up successfully",
      session: sessionToken
        ? {
            token: sessionToken,
            creatorId: creator.id,
            name: creator.name,
            email: creator.email,
            onboardingCompleted: !!creator.onboardingCompletedAt,
          }
        : null,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error setting up portal:", error);
    return NextResponse.json(
      { error: "Failed to set up account" },
      { status: 500 }
    );
  }
}
