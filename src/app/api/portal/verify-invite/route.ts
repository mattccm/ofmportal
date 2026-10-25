import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { creatorInvite } from "@/lib/invites";

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
        inviteStatus: { in: ["PENDING", "EXPIRED"] },
      },
      include: {
        agency: {
          select: { name: true },
        },
      },
    });

    // A used, replaced or cancelled link no longer matches any creator.
    // Answered as data (200, valid: false), not an HTTP error: a dead link is
    // an expected outcome the setup page explains calmly.
    if (!creator) {
      return NextResponse.json({
        valid: false,
        error: "It may have been used already, replaced by a newer link, or cancelled.",
        reason: "invalid",
      });
    }

    // Links work for 7 days from when they were issued
    if (creatorInvite(creator).state === "expired") {
      return NextResponse.json({
        valid: false,
        error: "Invite links work for 7 days from when they're sent.",
        reason: "expired",
      });
    }

    return NextResponse.json({
      valid: true,
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
