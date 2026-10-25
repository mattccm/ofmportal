import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { creatorWhere, requireAccess } from "@/lib/access/server";
import { sendPasswordResetEmail } from "@/lib/email";
import crypto from "crypto";
import { getAppUrl } from "@/lib/app-url";

// POST - Send password reset link to creator
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAccess("creators.resetAccess");
    if (gate.error) return gate.error;
    const { session, access } = gate;
    const { id } = await params;

    // Find the creator
    const creator = await db.creator.findFirst({
      where: { AND: [creatorWhere(access), { id }] },
      include: {
        agency: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!creator) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    // Generate a reset token
    const resetToken = crypto.randomBytes(32).toString("hex");

    // Store the reset token in the creator's inviteToken field temporarily
    // In a production app, you'd have a separate password_reset_tokens table
    await db.creator.update({
      where: { id },
      data: {
        inviteToken: resetToken,
        inviteSentAt: new Date(),
      },
    });

    // In a production app, send an email here
    // For now, we'll just log it and simulate success
    const resetUrl = `${getAppUrl()}/reset-password?token=${resetToken}&type=creator`;

    // Only log reset URL in development
    if (process.env.NODE_ENV === "development") {
      console.log(`Password reset link for ${creator.email}: ${resetUrl}`);
    }

    // Log the activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "creator.password_reset_sent",
        entityType: "Creator",
        entityId: id,
        metadata: {
          creatorEmail: creator.email,
          sentBy: session.user.email,
        },
      },
    });

    await sendPasswordResetEmail({
      to: creator.email,
      creatorName: creator.name,
      resetLink: resetUrl,
      agencyId: session.user.agencyId,
    });

    return NextResponse.json({
      message: "Password reset link sent successfully",
      // Only include this in development for testing
      ...(process.env.NODE_ENV === "development" && { resetUrl }),
    });
  } catch (error) {
    console.error("Error sending password reset:", error);
    return NextResponse.json(
      { error: "Failed to send password reset link" },
      { status: 500 }
    );
  }
}
