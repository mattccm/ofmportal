import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { rateLimitAsync, RATE_LIMITS, getClientIp } from "@/lib/rate-limit";
import { z } from "zod";
import { dispatchWebhookEvent } from "@/lib/webhooks";

const setupSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
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

    const body = await req.json();
    const { token, password } = setupSchema.parse(body);

    const creator = await db.creator.findFirst({
      where: {
        inviteToken: token,
        inviteStatus: "PENDING",
      },
    });

    if (!creator) {
      return NextResponse.json(
        { error: "Invalid or expired invite link" },
        { status: 404 }
      );
    }

    // Verify invite hasn't expired (7 day window)
    if (creator.inviteSentAt) {
      const daysSinceInvite = (Date.now() - creator.inviteSentAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceInvite > 7) {
        return NextResponse.json(
          { error: "Invite link has expired. Please ask your agency to resend the invitation." },
          { status: 410 }
        );
      }
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Update creator
    await db.creator.update({
      where: { id: creator.id },
      data: {
        portalPassword: hashedPassword,
        inviteStatus: "ACCEPTED",
        inviteToken: null, // Clear the token
      },
    });

    // Fire webhook for creator joining
    dispatchWebhookEvent(creator.agencyId, "creator.joined", {
      creatorId: creator.id,
      creatorName: creator.name,
      creatorEmail: creator.email,
    });

    return NextResponse.json({
      success: true,
      message: "Account set up successfully",
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
