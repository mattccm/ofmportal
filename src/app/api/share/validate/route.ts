import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import {
  validateShareAccess,
  logShareAccess,
  getSharedResource,
} from "@/lib/share";
import { getDownloadPresignedUrl, getPublicFileUrl } from "@/lib/storage";

// POST - Validate share token and get shared content
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = body as {
      token: string;
      password?: string;
    };

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    // Validate access
    const validation = await validateShareAccess(token, password);

    if (!validation.valid) {
      const errorMessages: Record<string, string> = {
        NOT_FOUND: "Share link not found",
        EXPIRED: "This share link has expired",
        INACTIVE: "This share link is no longer active",
        PASSWORD_REQUIRED: "Password required",
        INVALID_PASSWORD: "Invalid password",
      };

      const statusCodes: Record<string, number> = {
        NOT_FOUND: 404,
        EXPIRED: 410,
        INACTIVE: 410,
        PASSWORD_REQUIRED: 401,
        INVALID_PASSWORD: 401,
      };

      return NextResponse.json(
        {
          error: validation.error,
          message: errorMessages[validation.error || "NOT_FOUND"],
          shareLink: validation.shareLink
            ? {
                hasPassword: validation.shareLink.hasPassword,
              }
            : null,
        },
        { status: statusCodes[validation.error || "NOT_FOUND"] || 400 }
      );
    }

    const shareLink = validation.shareLink!;

    // Get request metadata for logging
    const headersList = await headers();
    const metadata = {
      ipAddress: headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || undefined,
      userAgent: headersList.get("user-agent") || undefined,
      referer: headersList.get("referer") || undefined,
    };

    // Log the access
    await logShareAccess(shareLink.id, "VIEW", metadata);

    // Get the shared resource
    const resource = await getSharedResource(
      shareLink.resourceType as "UPLOAD" | "REQUEST" | "REPORT" | "COLLECTION",
      shareLink.resourceId,
      shareLink.agencyId
    );

    if (!resource) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Shared content not found" },
        { status: 404 }
      );
    }

    // For uploads, get preview URL (prefer public URL for zero bandwidth)
    let enrichedResource: unknown = resource;
    if (shareLink.resourceType === "UPLOAD" && "storageKey" in resource) {
      let previewUrl = getPublicFileUrl(resource.storageKey);
      if (!previewUrl) {
        previewUrl = await getDownloadPresignedUrl(resource.storageKey);
      }
      enrichedResource = { ...resource, previewUrl };
    }

    // For requests with uploads, convert fileSize to string
    if (shareLink.resourceType === "REQUEST" && "uploads" in resource) {
      enrichedResource = {
        ...resource,
        uploads: (resource.uploads as Array<{ id: string; fileName: string; originalName: string; fileType: string; fileSize: bigint; storageKey: string }>).map((u) => ({
          ...u,
          fileSize: u.fileSize.toString(),
        })),
      };
    }

    return NextResponse.json({
      shareLink: {
        id: shareLink.id,
        token: shareLink.token,
        resourceType: shareLink.resourceType,
        resourceId: shareLink.resourceId,
        permission: shareLink.permission,
        hasPassword: shareLink.hasPassword,
        expiresAt: shareLink.expiresAt?.toISOString() || null,
        viewCount: shareLink.viewCount,
      },
      resource: enrichedResource,
    });
  } catch (error) {
    console.error("Share validate error:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to validate share link" },
      { status: 500 }
    );
  }
}
