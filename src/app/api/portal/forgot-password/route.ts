import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Try to find a creator first
    const creator = await db.creator.findFirst({
      where: {
        email: normalizedEmail,
        inviteStatus: "ACCEPTED",
      },
    });

    if (creator) {
      // Generate a reset token for creator
      const resetToken = crypto.randomBytes(32).toString("hex");
      const resetTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Store the reset token
      await db.creator.update({
        where: { id: creator.id },
        data: {
          inviteToken: resetToken,
          inviteSentAt: resetTokenExpiry,
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
      });

      return NextResponse.json({
        message: "If an account exists with this email, you will receive a password reset link.",
      });
    }

    // Try to find a team member (User)
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
