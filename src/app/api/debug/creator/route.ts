import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Debug endpoint to check creator status - REMOVE IN PRODUCTION
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");

  if (!email) {
    return NextResponse.json({ error: "Email parameter required" }, { status: 400 });
  }

  try {
    const creator = await db.creator.findFirst({
      where: {
        email: email.toLowerCase(),
      },
      select: {
        id: true,
        email: true,
        name: true,
        inviteStatus: true,
        portalPassword: true,
        lastLoginAt: true,
      },
    });

    if (!creator) {
      return NextResponse.json({
        found: false,
        message: `No creator found with email: ${email}`,
      });
    }

    return NextResponse.json({
      found: true,
      id: creator.id,
      email: creator.email,
      name: creator.name,
      inviteStatus: creator.inviteStatus,
      hasPassword: !!creator.portalPassword,
      passwordLength: creator.portalPassword?.length || 0,
      lastLoginAt: creator.lastLoginAt,
    });
  } catch (error) {
    console.error("Debug creator check error:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
