import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

// Debug endpoint to test login directly - REMOVE IN PRODUCTION
export async function POST(req: NextRequest) {
  try {
    const { email, password, setPassword } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find user in User table (team member)
    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        password: true,
        twoFactorEnabled: true,
        agencyId: true,
      },
    });

    // Also check Creator table
    const creator = await db.creator.findFirst({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        name: true,
        portalPassword: true,
        inviteStatus: true,
      },
    });

    // If setPassword is provided, update the password directly (debug only)
    if (setPassword && user) {
      const hashedPassword = await bcrypt.hash(setPassword, 12);
      await db.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      });

      return NextResponse.json({
        success: true,
        message: "Password has been set directly for User (team member)",
        userId: user.id,
        newHashPrefix: hashedPassword.substring(0, 7),
      });
    }

    // Return info about both tables
    const result: Record<string, unknown> = {
      emailSearched: normalizedEmail,
      userTable: user ? {
        found: true,
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        hasPassword: !!user.password,
        passwordHashPrefix: user.password?.substring(0, 10) || null,
        passwordLength: user.password?.length || 0,
        twoFactorEnabled: user.twoFactorEnabled,
        agencyId: user.agencyId,
      } : { found: false },
      creatorTable: creator ? {
        found: true,
        id: creator.id,
        email: creator.email,
        name: creator.name,
        hasPortalPassword: !!creator.portalPassword,
        portalPasswordHashPrefix: creator.portalPassword?.substring(0, 10) || null,
        inviteStatus: creator.inviteStatus,
      } : { found: false },
    };

    // If password provided, test it
    if (password) {
      if (user?.password) {
        const userPasswordValid = await bcrypt.compare(password, user.password);
        result.userPasswordTest = {
          tested: true,
          valid: userPasswordValid,
        };
      }
      if (creator?.portalPassword) {
        const creatorPasswordValid = await bcrypt.compare(password, creator.portalPassword);
        result.creatorPasswordTest = {
          tested: true,
          valid: creatorPasswordValid,
        };
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Debug login error:", error);
    return NextResponse.json(
      { error: "Test failed", details: String(error) },
      { status: 500 }
    );
  }
}
