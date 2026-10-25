import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
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
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const creator = await db.creator.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
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
