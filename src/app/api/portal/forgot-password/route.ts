import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";
import { rateLimitAsync, RATE_LIMITS, getClientIp } from "@/lib/rate-limit";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req.headers);
    const ipLimit = await rateLimitAsync(`forgot-password:${clientIp}`, RATE_LIMITS.passwordReset);
    if (!ipLimit.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later.", retryAfter: ipLimit.retryAfter },
        { status: 429, headers: { "Retry-After": String(ipLimit.retryAfter ?? 60) } }
      );
    }

    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    const emailLimit = await rateLimitAsync(`forgot-password:email:${normalizedEmail}`, RATE_LIMITS.passwordReset);
    if (!emailLimit.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later.", retryAfter: emailLimit.retryAfter },
        { status: 429, headers: { "Retry-After": String(emailLimit.retryAfter ?? 60) } }
      );
    }

    // Try to find a team member (User) FIRST - they take priority
    const user = await db.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (user) {
      // Generate a reset token for user
      // We'll store it in the VerificationToken table
      const resetToken = crypto.randomBytes(32).toString("hex");
      const resetTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Delete any existing reset tokens for this user
      await db.verificationToken.deleteMany({
        where: {
          identifier: `password-reset:${user.id}`,
        },
      });

      // Create new reset token
      await db.verificationToken.create({
        data: {
          identifier: `password-reset:${user.id}`,
          token: resetToken,
          expires: resetTokenExpiry,
        },
      });

      // Build the reset URL
      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3001";
      const resetLink = `${baseUrl}/reset-password?token=${resetToken}&type=user`;

      // Send the email
      await sendPasswordResetEmail({
        to: user.email,
        creatorName: user.name,
        resetLink,
        agencyId: user.agencyId ?? undefined,
      });

      return NextResponse.json({
        message: "If an account exists with this email, you will receive a password reset link.",
      });
    }

    // Try to find a creator (only if not a team member)
    const creator = await db.creator.findFirst({
      where: {
        email: normalizedEmail,
        inviteStatus: "ACCEPTED",
      },
    });

    if (creator) {
      // Generate a reset token for creator
      const resetToken = crypto.randomBytes(32).toString("hex");

      // Store the reset token
      await db.creator.update({
        where: { id: creator.id },
        data: {
          inviteToken: resetToken,
          inviteSentAt: new Date(), // send time; reset-password allows 24h from this
        },
      });

      // Build the reset URL
      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3001";
      const resetLink = `${baseUrl}/reset-password?token=${resetToken}&type=creator`;

      // Send the email
      await sendPasswordResetEmail({
        to: creator.email,
        creatorName: creator.name,
        resetLink,
        agencyId: creator.agencyId,
      });

      return NextResponse.json({
        message: "If an account exists with this email, you will receive a password reset link.",
      });
    }

    // No account found - still return success to prevent email enumeration
    return NextResponse.json({
      message: "If an account exists with this email, you will receive a password reset link.",
    });
  } catch (error) {
    console.error("Error in forgot password:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
