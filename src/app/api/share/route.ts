import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  createShareLink,
  getShareLinksForResource,
  getExpirationDate,
  generateShareUrl,
  type ShareResourceType,
  type SharePermission,
} from "@/lib/share";

// GET - List share links for a resource
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const agencyId = session.user.agencyId;
    const searchParams = request.nextUrl.searchParams;

    const resourceType = searchParams.get("resourceType") as ShareResourceType;
    const resourceId = searchParams.get("resourceId");

    if (!resourceType || !resourceId) {
      return NextResponse.json(
        { error: "resourceType and resourceId are required" },
        { status: 400 }
      );
    }

    const links = await getShareLinksForResource(resourceType, resourceId, agencyId);

    return NextResponse.json({
      links: links.map((link) => ({
        id: link.id,
        token: link.token,
        permission: link.permission,
        hasPassword: link.hasPassword,
        expiresAt: link.expiresAt?.toISOString() || null,
        viewCount: link.viewCount,
        isActive: link.isActive,
        createdAt: link.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Share API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch share links" },
      { status: 500 }
    );
  }
}

// POST - Create a new share link
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId || !session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const agencyId = session.user.agencyId;
    const userId = session.user.id;

    const body = await request.json();
    const {
      resourceType,
      resourceId,
      permission = "VIEW",
      password,
      expiration = "7d",
    } = body as {
      resourceType: ShareResourceType;
      resourceId: string;
      permission?: SharePermission;
      password?: string;
      expiration?: string;
    };

    if (!resourceType || !resourceId) {
      return NextResponse.json(
        { error: "resourceType and resourceId are required" },
        { status: 400 }
      );
    }

    // Validate that the resource exists and belongs to the agency
    const resourceValid = await validateResourceOwnership(
      resourceType,
      resourceId,
      agencyId
    );

    if (!resourceValid) {
      return NextResponse.json(
        { error: "Resource not found or access denied" },
        { status: 404 }
      );
    }

    // Check for completed requests only
    if (resourceType === "REQUEST") {
      const request = await db.contentRequest.findFirst({
        where: { id: resourceId, agencyId },
      });

      if (request && request.status !== "APPROVED") {
        return NextResponse.json(
          { error: "Only completed requests can be shared" },
          { status: 400 }
        );
      }
    }

    // Calculate expiration date
    const expiresAt = getExpirationDate(expiration);

    // Create share link
    const shareLink = await createShareLink({
      agencyId,
      createdById: userId,
      resourceType,
      resourceId,
      permission,
      password,
      expiresAt,
    });

    // Generate the full URL
    const url = generateShareUrl(shareLink.token);

    return NextResponse.json({
      id: shareLink.id,
      token: shareLink.token,
      url,
      permission: shareLink.permission,
      hasPassword: shareLink.hasPassword,
      expiresAt: shareLink.expiresAt?.toISOString() || null,
    });
  } catch (error) {
    console.error("Share API error:", error);
    return NextResponse.json(
      { error: "Failed to create share link" },
      { status: 500 }
    );
  }
}

// Helper to validate resource ownership
async function validateResourceOwnership(
  resourceType: ShareResourceType,
  resourceId: string,
  agencyId: string
): Promise<boolean> {
  switch (resourceType) {
    case "UPLOAD": {
      const upload = await db.upload.findFirst({
        where: {
          id: resourceId,
          request: { agencyId },
        },
      });
      return !!upload;
    }

    case "REQUEST": {
      const request = await db.contentRequest.findFirst({
        where: {
          id: resourceId,
          agencyId,
        },
      });
      return !!request;
    }

    case "COLLECTION": {
      const collection = await db.collection.findFirst({
        where: {
          id: resourceId,
          agencyId,
        },
      });
      return !!collection;
    }

    case "REPORT": {
      // Reports are virtual, we just verify the agency
      return true;
    }

    default:
      return false;
  }
}
