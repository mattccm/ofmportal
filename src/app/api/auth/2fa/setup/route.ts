import { NextRequest, NextResponse } from "next/server";
import { rateLimitResponse } from "@/lib/api";
import { rateLimitAsync, RATE_LIMITS, getClientIp } from "@/lib/rate-limit";
import { getServerSession } from "next-auth";
import { authOptions, generateTwoFactorSecret, generateTwoFactorQRCodeUrl } from "@/lib/auth";
import { db } from "@/lib/db";
import QRCode from "qrcode";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = await rateLimitAsync(
      `2fa-setup:${session.user.id}:${getClientIp(req.headers)}`,
      RATE_LIMITS.twoFactor
    );
    if (!rl.success) {
      return rateLimitResponse(rl, "Too many 2FA setup attempts. Please try again later.");
    }

    // Never overwrite an active secret: login would start using the
    // unconfirmed one and lock the user out
    const existing = await db.user.findUnique({
      where: { id: session.user.id },
      select: { twoFactorEnabled: true },
    });
    if (existing?.twoFactorEnabled) {
      return NextResponse.json(
        { error: "2FA is already enabled. Disable it first to set up a new authenticator." },
        { status: 400 }
      );
    }

    // Generate new 2FA secret
    const secret = generateTwoFactorSecret();
    const qrCodeUrl = generateTwoFactorQRCodeUrl(session.user.email!, secret);

    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(qrCodeUrl);

    // Store secret temporarily (not enabled yet until verified)
    // (guarded so a concurrent enable cannot be overwritten)
    const updated = await db.user.updateMany({
      where: { id: session.user.id, twoFactorEnabled: false },
      data: { twoFactorSecret: secret },
    });
    if (updated.count === 0) {
      return NextResponse.json(
        { error: "2FA is already enabled. Disable it first to set up a new authenticator." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      secret,
      qrCode: qrCodeDataUrl,
    });
  } catch (error) {
    console.error("2FA setup error:", error);
    return NextResponse.json(
      { error: "Failed to set up 2FA" },
      { status: 500 }
    );
  }
}
