import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendCreatorInviteEmail } from "@/lib/email";
import { creatorInvite, creatorInviteLink, newInviteToken } from "@/lib/invites";

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

    if (creator.archivedAt) {
      return NextResponse.json(
        { error: `Restore ${creator.name} before inviting them` },
        { status: 400 }
      );
    }

    // Email the link that is out there now if it still works (so a link staff
    // already shared keeps working), otherwise make a new one. Either way the
    // 7 days start again from now.
    const current = creatorInvite(creator);
    const inviteToken =
      current.state === "pending" && creator.inviteToken ? creator.inviteToken : newInviteToken();

    await db.creator.update({
      where: { id },
      data: {
        inviteToken,
        inviteStatus: "PENDING",
        inviteSentAt: new Date(),
      },
    });

    // The link is a bearer secret: never logged
    const inviteUrl = creatorInviteLink(inviteToken);

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

    await sendCreatorInviteEmail({
      to: creator.email,
      creatorName: creator.name,
      agencyName: creator.agency?.name || "Your Agency",
      inviteLink: inviteUrl,
      agencyId: session.user.agencyId,
    });

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
