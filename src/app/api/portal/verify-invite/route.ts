import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Invite token is required" },
        { status: 400 }
      );
    }

    const creator = await db.creator.findFirst({
      where: {
        inviteToken: token,
        inviteStatus: "PENDING",
      },
      include: {
        agency: {
          select: { name: true },
        },
      },
    });

    if (!creator) {
      return NextResponse.json(
        { error: "Invalid or expired invite link" },
        { status: 404 }
      );
    }

    // Check if invite is expired (7 days)
    if (creator.inviteSentAt) {
      const daysSinceInvite =
        (Date.now() - creator.inviteSentAt.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceInvite > 7) {
        await db.creator.update({
          where: { id: creator.id },
          data: { inviteStatus: "EXPIRED" },
        });

        return NextResponse.json(
          { error: "This invite link has expired. Please request a new one." },
          { status: 410 }
        );
      }
    }

    return NextResponse.json({
      id: creator.id,
      name: creator.name,
      email: creator.email,
      agencyName: creator.agency.name,
    });
  } catch (error) {
    console.error("Error verifying invite:", error);
    return NextResponse.json(
      { error: "Failed to verify invite" },
      { status: 500 }
    );
  }
}
