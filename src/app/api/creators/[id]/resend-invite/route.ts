import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import crypto from "crypto";

// POST - Resend invite to creator
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

    // Check if user has permission
    if (!["OWNER", "ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions to resend invites" },
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

    // Check if creator already accepted
    if (creator.inviteStatus === "ACCEPTED") {
      return NextResponse.json(
        { error: "Creator has already accepted their invite" },
        { status: 400 }
      );
    }

    // Generate a new invite token
    const inviteToken = crypto.randomBytes(32).toString("hex");

    // Update the creator with new invite token
    await db.creator.update({
      where: { id },
      data: {
        inviteToken,
        inviteStatus: "PENDING",
        inviteSentAt: new Date(),
      },
    });

    // Build the invite URL
    const inviteUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/portal/setup?token=${inviteToken}`;

    // Only log invite URL in development
    if (process.env.NODE_ENV === "development") {
      console.log(`Invite link for ${creator.email}: ${inviteUrl}`);
    }

    // Log the activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "creator.invite_resent",
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
    //   subject: `You're invited to ${creator.agency?.name}'s creator portal`,
    //   template: "creator-invite",
    //   data: {
    //     name: creator.name,
    //     inviteUrl,
    //     agencyName: creator.agency?.name,
    //   },
    // });

    return NextResponse.json({
      message: "Invitation resent successfully",
      // Only include this in development for testing
      ...(process.env.NODE_ENV === "development" && { inviteUrl }),
    });
  } catch (error) {
    console.error("Error resending invite:", error);
    return NextResponse.json(
      { error: "Failed to resend invitation" },
      { status: 500 }
    );
  }
}
