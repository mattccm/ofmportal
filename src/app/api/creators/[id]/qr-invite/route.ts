import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { creatorWhere, forbidden, requireAccess } from "@/lib/access/server";
import QRCode from "qrcode";
import { getAppUrl } from "@/lib/app-url";

/**
 * GET /api/creators/[id]/qr-invite
 *
 * Generate a QR code image (PNG) for a creator's invite link.
 * Great for in-person onboarding — show or print the QR code
 * and creators can scan to set up their portal account.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAccess("creators.view");
    if (gate.error) return gate.error;
    const { access } = gate;
    const { id } = await params;
    // The QR code carries the invite link
    if (!access.has("creatorInfo.invite")) return forbidden("creatorInfo.invite");

    const creator = await db.creator.findFirst({
      where: { AND: [creatorWhere(access), { id }] },
      select: {
        id: true,
        name: true,
        inviteToken: true,
        inviteStatus: true,
      },
    });

    if (!creator) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    if (creator.inviteStatus === "ACCEPTED") {
      return NextResponse.json(
        { error: "Creator has already accepted their invite" },
        { status: 400 }
      );
    }

    if (!creator.inviteToken) {
      return NextResponse.json(
        { error: "No invite token found. Send an invite first." },
        { status: 400 }
      );
    }

    const baseUrl = getAppUrl();
    const inviteUrl = `${baseUrl}/portal/setup/${creator.inviteToken}`;

    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "png";

    if (format === "svg") {
      const svg = await QRCode.toString(inviteUrl, {
        type: "svg",
        width: 300,
        margin: 2,
        color: { dark: "#0e0f12", light: "#ffffff" },
      });

      return new NextResponse(svg, {
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "private, max-age=3600",
        },
      });
    }

    // Default: PNG
    const pngBuffer = await QRCode.toBuffer(inviteUrl, {
      type: "png",
      width: 400,
      margin: 2,
      color: { dark: "#0e0f12", light: "#ffffff" },
    });

    return new NextResponse(new Uint8Array(pngBuffer), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `inline; filename="${creator.name}-invite-qr.png"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Error generating QR code:", error);
    return NextResponse.json(
      { error: "Failed to generate QR code" },
      { status: 500 }
    );
  }
}
