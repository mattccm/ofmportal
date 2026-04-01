import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DEFAULT_BRANDING, type BrandingSettings } from "@/lib/branding";

// GET - Fetch branding for portal (authenticated with session token)
export async function GET(request: NextRequest) {
  try {
    // Get session token from header
    const sessionToken = request.headers.get("x-creator-token");

    if (!sessionToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify session token and check expiry
    const creator = await db.creator.findFirst({
      where: {
        sessionToken: sessionToken,
        inviteStatus: "ACCEPTED",
        sessionExpiry: {
          gt: new Date(),
        },
      },
      select: {
        id: true,
        agencyId: true,
        agency: {
          select: {
            id: true,
            name: true,
            logo: true,
            settings: true,
          },
        },
      },
    });

    if (!creator || !creator.agency) {
      return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 });
    }

    // Parse branding from agency settings
    const settings = (creator.agency.settings as Record<string, unknown>) || {};
    const savedBranding = (settings.branding as Partial<BrandingSettings>) || {};

    const branding: BrandingSettings = {
      ...DEFAULT_BRANDING,
      ...savedBranding,
      // Use agency logo as fallback
      logoLight: savedBranding.logoLight || creator.agency.logo || null,
    };

    return NextResponse.json({
      branding,
      agencyName: creator.agency.name,
    });
  } catch (error) {
    console.error("Error fetching portal branding:", error);
    return NextResponse.json(
      { error: "Failed to fetch branding" },
      { status: 500 }
    );
  }
}

// Alternative: GET branding by agencyId (for public portal pages)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agencyId, creatorId } = body;

    if (!agencyId && !creatorId) {
      return NextResponse.json(
        { error: "Agency ID or Creator ID required" },
        { status: 400 }
      );
    }

    let agency;

    if (creatorId) {
      // Get agency through creator
      const creator = await db.creator.findUnique({
        where: { id: creatorId },
        select: {
          agency: {
            select: {
              id: true,
              name: true,
              logo: true,
              settings: true,
            },
          },
        },
      });
      agency = creator?.agency;
    } else {
      // Get agency directly
      agency = await db.agency.findUnique({
        where: { id: agencyId },
        select: {
          id: true,
          name: true,
          logo: true,
          settings: true,
        },
      });
    }

    if (!agency) {
      return NextResponse.json({ error: "Agency not found" }, { status: 404 });
    }

    // Parse branding from agency settings
    const settings = (agency.settings as Record<string, unknown>) || {};
    const savedBranding = (settings.branding as Partial<BrandingSettings>) || {};

    const branding: BrandingSettings = {
      ...DEFAULT_BRANDING,
      ...savedBranding,
      // Use agency logo as fallback
      logoLight: savedBranding.logoLight || agency.logo || null,
    };

    return NextResponse.json({
      branding,
      agencyName: agency.name,
    });
  } catch (error) {
    console.error("Error fetching portal branding:", error);
    return NextResponse.json(
      { error: "Failed to fetch branding" },
      { status: 500 }
    );
  }
}
