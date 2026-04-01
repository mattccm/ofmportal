import { NextRequest, NextResponse } from "next/server";
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

    // Generate new 2FA secret
    const secret = generateTwoFactorSecret();
    const qrCodeUrl = generateTwoFactorQRCodeUrl(session.user.email!, secret);

    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(qrCodeUrl);

    // Store secret temporarily (not enabled yet until verified)
    await db.user.update({
      where: { id: session.user.id },
      data: { twoFactorSecret: secret },
    });

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
