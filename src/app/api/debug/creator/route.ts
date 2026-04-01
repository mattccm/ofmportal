import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Debug endpoint to check user/creator status - REMOVE IN PRODUCTION
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");

  if (!email) {
    return NextResponse.json({ error: "Email parameter required" }, { status: 400 });
  }

  try {
    // Check User table (team members)
    const user = await db.user.findUnique({
      where: {
        email: email.toLowerCase(),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        agencyId: true,
        password: true,
        agency: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Check Creator table
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

    return NextResponse.json({
      user: user ? {
        found: true,
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        agencyId: user.agencyId,
        agencyName: user.agency?.name,
        hasPassword: !!user.password,
        passwordLength: user.password?.length || 0,
      } : { found: false },
      creator: creator ? {
        found: true,
        id: creator.id,
        email: creator.email,
        name: creator.name,
        inviteStatus: creator.inviteStatus,
        hasPassword: !!creator.portalPassword,
        passwordLength: creator.portalPassword?.length || 0,
        lastLoginAt: creator.lastLoginAt,
      } : { found: false },
    });
  } catch (error) {
    console.error("Debug check error:", error);
    return NextResponse.json({ error: "Database error", details: String(error) }, { status: 500 });
  }
}
