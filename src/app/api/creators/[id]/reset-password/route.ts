import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import crypto from "crypto";

// POST - Send password reset link to creator
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has permission (OWNER or ADMIN only)
    if (!["OWNER", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Only Owners and Admins can send password reset links" },
        { status: 403 }
      );
    }

    // Find the creator
    const creator = await db.creator.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
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
    const resetTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

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
    const resetUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/portal/reset-password?token=${resetToken}`;

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

    // TODO: Send actual email using email service
    // await sendEmail({
    //   to: creator.email,
    //   subject: `Reset your ${creator.agency?.name} portal password`,
    //   template: "password-reset",
    //   data: {
    //     name: creator.name,
    //     resetUrl,
    //     agencyName: creator.agency?.name,
    //   },
    // });

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
