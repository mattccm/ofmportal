import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/api";
import { db } from "@/lib/db";
import { rateLimitAsync, RATE_LIMITS, getClientIp } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req.headers);
    const rl = await rateLimitAsync(`reset-password:${clientIp}`, RATE_LIMITS.passwordReset);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later.", retryAfter: rl.retryAfter },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 60) } }
      );
    }

    const bodyResult = await parseJsonBody(req);
    if (!bodyResult.ok) return bodyResult.response;
    const { token, password, type } = bodyResult.data;

    if (typeof token !== "string" || typeof password !== "string" || !token || !password) {
      return NextResponse.json(
        { error: "Token and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Check if this is a user (team member) reset
    if (type === "user") {
      // Find the verification token
      const verificationToken = await db.verificationToken.findFirst({
        where: {
          token: token,
          identifier: { startsWith: "password-reset:" },
        },
      });

      if (!verificationToken) {
        return NextResponse.json(
          { error: "Invalid or expired reset link" },
          { status: 400 }
        );
      }

      // Check if token has expired
      if (new Date() > verificationToken.expires) {
        // Clean up expired token
        await db.verificationToken.delete({
          where: {
            identifier_token: {
              identifier: verificationToken.identifier,
              token: verificationToken.token,
            },
          },
        });
        return NextResponse.json(
          { error: "Reset link has expired. Please request a new one." },
          { status: 400 }
        );
      }

      // Extract user ID from identifier
      const userId = verificationToken.identifier.replace("password-reset:", "");

      await db.$transaction([
        // Update the user's password
        db.user.update({
          where: { id: userId },
          data: {
            password: hashedPassword,
          },
        }),
        // Invalidate all remember tokens on password reset
        db.rememberToken.deleteMany({
          where: { userId },
        }),
        // Delete the used token
        db.verificationToken.delete({
          where: {
            identifier_token: {
              identifier: verificationToken.identifier,
              token: verificationToken.token,
            },
          },
        }),
        // Log the security event
        db.activityLog.create({
          data: {
            userId,
            action: "password.changed",
            entityType: "User",
            entityId: userId,
            ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || undefined,
            userAgent: req.headers.get("user-agent") || undefined,
          },
        }),
      ]);

      return NextResponse.json({
        message: "Password has been reset successfully. You can now sign in.",
      });
    }

    // Default: Creator reset
    const creator = await db.creator.findFirst({
      where: {
        inviteToken: token,
        inviteStatus: "ACCEPTED",
      },
    });

    if (!creator) {
      return NextResponse.json(
        { error: "Invalid or expired reset link" },
        { status: 400 }
      );
    }

    // Check if token has expired (24 hour window from when it was sent)
    if (creator.inviteSentAt) {
      const expiryTime = new Date(creator.inviteSentAt.getTime() + 24 * 60 * 60 * 1000);
      if (new Date() > expiryTime) {
        return NextResponse.json(
          { error: "Reset link has expired. Please request a new one." },
          { status: 400 }
        );
      }
    }

    // Update the creator's password and clear the reset token
    await db.creator.update({
      where: { id: creator.id },
      data: {
        portalPassword: hashedPassword,
        inviteToken: null,
        inviteSentAt: null,
        // Revoke any existing portal session
        sessionToken: null,
        sessionExpiry: null,
      },
    });

    return NextResponse.json({
      message: "Password has been reset successfully. You can now sign in.",
    });
  } catch (error) {
    console.error("Error in reset password:", error);
    return NextResponse.json(
      { error: "Failed to reset password" },
      { status: 500 }
    );
  }
}

// GET - Validate token (for checking if link is valid before showing form)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    const type = searchParams.get("type");

    if (!token) {
      return NextResponse.json(
        { valid: false, error: "Token is required" },
        { status: 400 }
      );
    }

    // Check if this is a user (team member) reset
    if (type === "user") {
      const verificationToken = await db.verificationToken.findFirst({
        where: {
          token: token,
          identifier: { startsWith: "password-reset:" },
        },
      });

      if (!verificationToken) {
        return NextResponse.json(
          { valid: false, error: "Invalid reset link" },
          { status: 400 }
        );
      }

      // Check expiry
      if (new Date() > verificationToken.expires) {
        return NextResponse.json(
          { valid: false, error: "Reset link has expired" },
          { status: 400 }
        );
      }

      // Get user name
      const userId = verificationToken.identifier.replace("password-reset:", "");
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });

      return NextResponse.json({
        valid: true,
        name: user?.name || "User",
        type: "user",
      });
    }

    // Default: Creator reset
    const creator = await db.creator.findFirst({
      where: {
        inviteToken: token,
        inviteStatus: "ACCEPTED",
      },
      select: {
        id: true,
        name: true,
        inviteSentAt: true,
      },
    });

    if (!creator) {
      return NextResponse.json(
        { valid: false, error: "Invalid reset link" },
        { status: 400 }
      );
    }

    // Check expiry (24 hour window from when it was sent, same as POST)
    if (creator.inviteSentAt && Date.now() > creator.inviteSentAt.getTime() + 24 * 60 * 60 * 1000) {
      return NextResponse.json(
        { valid: false, error: "Reset link has expired" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      name: creator.name,
      type: "creator",
    });
  } catch (error) {
    console.error("Error validating reset token:", error);
    return NextResponse.json(
      { valid: false, error: "Failed to validate token" },
      { status: 500 }
    );
  }
}
