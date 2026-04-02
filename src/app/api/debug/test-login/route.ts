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

    // Find user
    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        password: true,
        twoFactorEnabled: true,
      },
    });

    if (!user) {
      return NextResponse.json({
        success: false,
        step: "user_lookup",
        error: "No user found with this email",
        emailUsed: normalizedEmail,
      });
    }

    // If setPassword is provided, update the password directly (debug only)
    if (setPassword) {
      const hashedPassword = await bcrypt.hash(setPassword, 12);
      await db.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      });

      return NextResponse.json({
        success: true,
        message: "Password has been set directly",
        userId: user.id,
        newHashPrefix: hashedPassword.substring(0, 7),
      });
    }

    if (!password) {
      return NextResponse.json({
        success: false,
        step: "password_required",
        error: "Password required for testing",
        userId: user.id,
        hasPassword: !!user.password,
        passwordHashPrefix: user.password?.substring(0, 7) || null,
      });
    }

    if (!user.password) {
      return NextResponse.json({
        success: false,
        step: "password_check",
        error: "User has no password set",
        userId: user.id,
      });
    }

    // Test password
    const passwordValid = await bcrypt.compare(password, user.password);

    if (!passwordValid) {
      return NextResponse.json({
        success: false,
        step: "password_verify",
        error: "Password does not match",
        userId: user.id,
        passwordHashPrefix: user.password.substring(0, 7),
        passwordLength: user.password.length,
        inputPasswordLength: password.length,
      });
    }

    // Password is valid!
    return NextResponse.json({
      success: true,
      message: "Login credentials are valid!",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        twoFactorEnabled: user.twoFactorEnabled,
      },
    });
  } catch (error) {
    console.error("Debug login error:", error);
    return NextResponse.json(
      { error: "Test failed", details: String(error) },
      { status: 500 }
    );
  }
}
