import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import QRCode from "qrcode";

/**
 * GET /api/creators/bulk-qr
 *
 * Returns JSON with QR code data URLs for all pending creators.
 * Useful for a printable page of QR invite codes.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const creators = await db.creator.findMany({
      where: {
        agencyId: session.user.agencyId,
        inviteStatus: "PENDING",
        inviteToken: { not: null },
      },
      select: {
        id: true,
        name: true,
        email: true,
        inviteToken: true,
      },
      orderBy: { name: "asc" },
    });

    if (creators.length === 0) {
      return NextResponse.json({
        creators: [],
        message: "No pending creators with invite tokens",
      });
    }

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

    const creatorsWithQr = await Promise.all(
      creators.map(async (creator) => {
        const inviteUrl = `${baseUrl}/portal/setup?token=${creator.inviteToken}`;
        const qrDataUrl = await QRCode.toDataURL(inviteUrl, {
          width: 300,
          margin: 2,
          color: { dark: "#1a1a2e", light: "#ffffff" },
        });

        return {
          id: creator.id,
          name: creator.name,
          email: creator.email,
          qrDataUrl,
          inviteUrl,
        };
      })
    );

    return NextResponse.json({ creators: creatorsWithQr });
  } catch (error) {
    console.error("Error generating bulk QR codes:", error);
    return NextResponse.json(
      { error: "Failed to generate QR codes" },
      { status: 500 }
    );
  }
}
