import { NextRequest, NextResponse } from "next/server";
import { rateLimitAsync, RATE_LIMITS, getClientIp } from "@/lib/rate-limit";
import { parseJsonBody, rateLimitResponse } from "@/lib/api";
import { db } from "@/lib/db";
import { z } from "zod";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { validateCreatorSession } from "@/lib/portal-auth";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export async function PUT(req: NextRequest) {
  try {
    const authResult = await validateCreatorSession(req);
    if (!authResult.success) {
      return authResult.error;
    }

    const rl = await rateLimitAsync(
      `portal-password-change:${authResult.creator.id}:${getClientIp(req.headers)}`,
      RATE_LIMITS.passwordChange
    );
    if (!rl.success) {
      return rateLimitResponse(rl, "Too many password change attempts. Please try again later.");
    }

    const bodyResult = await parseJsonBody(req);
    if (!bodyResult.ok) return bodyResult.response;
    const body = bodyResult.data;
    const { currentPassword, newPassword } = changePasswordSchema.parse(body);

    // Get creator with current password
    const creator = await db.creator.findUnique({
      where: { id: authResult.creator.id },
      select: {
        id: true,
        portalPassword: true,
      },
    });

    if (!creator || !creator.portalPassword) {
      return NextResponse.json(
        { error: "Unable to verify current password" },
        { status: 400 }
      );
    }

    // Verify current password
    const isValid = await verifyPassword(currentPassword, creator.portalPassword);
    if (!isValid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 400 }
      );
    }

    // Hash and save new password
    const hashedPassword = await hashPassword(newPassword);
    await db.creator.update({
      where: { id: creator.id },
      data: {
        portalPassword: hashedPassword,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error changing password:", error);
    return NextResponse.json(
      { error: "Failed to change password" },
      { status: 500 }
    );
  }
}
