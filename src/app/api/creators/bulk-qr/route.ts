import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { creatorWhere, forbidden, redactCreator, requireAccess } from "@/lib/access/server";
import QRCode from "qrcode";
import { getAppUrl } from "@/lib/app-url";

/**
 * GET /api/creators/bulk-qr
 *
 * Returns JSON with QR code data URLs for all pending creators.
 * Useful for a printable page of QR invite codes.
 */
export async function GET() {
  try {
    const gate = await requireAccess("creators.view");
    if (gate.error) return gate.error;
    const { access } = gate;
    // Every code carries an invite link
    if (!access.has("creatorInfo.invite")) return forbidden("creatorInfo.invite");

    const creators = await db.creator.findMany({
      where: {
        ...creatorWhere(access),
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

    const baseUrl = getAppUrl();

    const creatorsWithQr = await Promise.all(
      creators.map(async (creator) => {
        const inviteUrl = `${baseUrl}/portal/setup/${creator.inviteToken}`;
        const qrDataUrl = await QRCode.toDataURL(inviteUrl, {
          width: 300,
          margin: 2,
          color: { dark: "#0e0f12", light: "#ffffff" },
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

    return NextResponse.json({ creators: redactCreator(access, creatorsWithQr) });
  } catch (error) {
    console.error("Error generating bulk QR codes:", error);
    return NextResponse.json(
      { error: "Failed to generate QR codes" },
      { status: 500 }
    );
  }
}
