import { NextRequest, NextResponse } from "next/server";
import { rateLimitAsync, RATE_LIMITS, getClientIp } from "@/lib/rate-limit";
import { parseJsonBody, rateLimitResponse } from "@/lib/api";
import { getServerSession } from "next-auth";
import { authOptions, verifyTwoFactorCode } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const verifySchema = z.object({
  code: z.string().length(6, "Code must be 6 digits"),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = await rateLimitAsync(
      `2fa-verify:${session.user.id}:${getClientIp(req.headers)}`,
      RATE_LIMITS.twoFactor
    );
    if (!rl.success) {
      return rateLimitResponse(rl, "Too many verification attempts. Please try again later.");
    }

    const bodyResult = await parseJsonBody(req);
    if (!bodyResult.ok) return bodyResult.response;
    const body = bodyResult.data;
    const { code } = verifySchema.parse(body);

    // Get user's secret
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { twoFactorSecret: true },
    });

    if (!user?.twoFactorSecret) {
      return NextResponse.json(
        { error: "2FA not set up. Please start the setup process again." },
        { status: 400 }
      );
    }

    // Verify the code
    const isValid = verifyTwoFactorCode(user.twoFactorSecret, code);

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid verification code" },
        { status: 400 }
      );
    }

    // Enable 2FA
    await db.user.update({
      where: { id: session.user.id },
      data: { twoFactorEnabled: true },
    });

    // Security log (never let a logging failure break the 2FA change)
    await db.activityLog
      .create({
        data: {
          userId: session.user.id,
          action: "2fa.enabled",
          entityType: "User",
          entityId: session.user.id,
          ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || undefined,
          userAgent: req.headers.get("user-agent") || undefined,
        },
      })
      .catch(() => {});

    return NextResponse.json({
      message: "2FA enabled successfully",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("2FA verify error:", error);
    return NextResponse.json(
      { error: "Failed to verify 2FA code" },
      { status: 500 }
    );
  }
}
