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

    // Find the creator by email
    const creator = await db.creator.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        inviteStatus: "ACCEPTED", // Only allow reset for active accounts
      },
    });

    // Always return success to prevent email enumeration
    if (!creator) {
      return NextResponse.json({
        message: "If an account exists with this email, you will receive a password reset link.",
      });
    }

    // Generate a reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store the reset token
    await db.creator.update({
      where: { id: creator.id },
      data: {
        inviteToken: resetToken,
        inviteSentAt: resetTokenExpiry, // Using inviteSentAt to store expiry
      },
    });

    // Build the reset URL
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3001";
    const resetLink = `${baseUrl}/reset-password?token=${resetToken}`;

    // Send the email
    await sendPasswordResetEmail({
      to: creator.email,
      creatorName: creator.name,
      resetLink,
    });

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
