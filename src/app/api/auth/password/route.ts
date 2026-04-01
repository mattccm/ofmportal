import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, hashPassword, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    ),
  confirmPassword: z.string().min(1, "Please confirm your new password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// PUT /api/auth/password - Change password
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { currentPassword, newPassword } = changePasswordSchema.parse(body);

    // Get user with current password
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { password: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify current password
    const isValid = await verifyPassword(currentPassword, user.password);

    if (!isValid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 400 }
      );
    }

    // Hash and update new password
    const hashedPassword = await hashPassword(newPassword);

    await db.user.update({
      where: { id: session.user.id },
      data: { password: hashedPassword },
    });

    // Log the security event
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "password.changed",
        entityType: "User",
        entityId: session.user.id,
        ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || undefined,
        userAgent: req.headers.get("user-agent") || undefined,
      },
    });

    return NextResponse.json({
      message: "Password changed successfully",
      lastChanged: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Change password error:", error);
    return NextResponse.json(
      { error: "Failed to change password" },
      { status: 500 }
    );
  }
}

// GET /api/auth/password - Get password metadata (last changed, etc.)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get last password change from activity log
    const lastPasswordChange = await db.activityLog.findFirst({
      where: {
        userId: session.user.id,
        action: "password.changed",
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    // Get user creation date as fallback
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { createdAt: true },
    });

    return NextResponse.json({
      lastChanged: lastPasswordChange?.createdAt || user?.createdAt || null,
    });
  } catch (error) {
    console.error("Get password info error:", error);
    return NextResponse.json(
      { error: "Failed to get password info" },
      { status: 500 }
    );
  }
}
