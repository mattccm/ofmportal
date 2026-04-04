import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { validateShareAccess, logShareAccess } from "@/lib/share";
import { getDownloadPresignedUrl, getPublicFileUrl } from "@/lib/storage";

// POST - Download file through share link
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, uploadId, password } = body as {
      token: string;
      uploadId: string;
      password?: string;
    };

    if (!token || !uploadId) {
      return NextResponse.json(
        { error: "Token and uploadId are required" },
        { status: 400 }
      );
    }

    // Validate access
    const validation = await validateShareAccess(token, password);

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error, message: "Access denied" },
        { status: 401 }
      );
    }

    const shareLink = validation.shareLink!;

    // Check if download is allowed
    if (shareLink.permission !== "DOWNLOAD") {
      return NextResponse.json(
        { error: "Download not allowed for this share link" },
        { status: 403 }
      );
    }

    // Verify the upload belongs to the shared resource
    let upload;

    if (shareLink.resourceType === "UPLOAD") {
      // Direct upload share
      if (shareLink.resourceId !== uploadId) {
        return NextResponse.json(
          { error: "Invalid upload" },
          { status: 400 }
        );
      }

      upload = await db.upload.findUnique({
        where: { id: uploadId },
        select: {
          id: true,
          storageKey: true,
          originalName: true,
          request: {
            select: {
              agencyId: true,
            },
          },
        },
      });
    } else if (shareLink.resourceType === "REQUEST") {
      // Request share - verify upload belongs to the request
      upload = await db.upload.findFirst({
        where: {
          id: uploadId,
          requestId: shareLink.resourceId,
          status: "APPROVED",
        },
        select: {
          id: true,
          storageKey: true,
          originalName: true,
          request: {
            select: {
              agencyId: true,
            },
          },
        },
      });
    } else if (shareLink.resourceType === "COLLECTION") {
      // Collection share - verify upload is in the collection
      const collectionItem = await db.collectionItem.findFirst({
        where: {
          collectionId: shareLink.resourceId,
          uploadId: uploadId,
        },
      });

      if (!collectionItem) {
        return NextResponse.json(
          { error: "Upload not in collection" },
          { status: 400 }
        );
      }

      upload = await db.upload.findUnique({
        where: { id: uploadId },
        select: {
          id: true,
          storageKey: true,
          originalName: true,
          request: {
            select: {
              agencyId: true,
            },
          },
        },
      });
    } else {
      return NextResponse.json(
        { error: "Download not supported for this resource type" },
        { status: 400 }
      );
    }

    if (!upload) {
      return NextResponse.json(
        { error: "Upload not found" },
        { status: 404 }
      );
    }

    // Verify agency match
    if (upload.request.agencyId !== shareLink.agencyId) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Get request metadata for logging
    const headersList = await headers();
    const metadata = {
      ipAddress: headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || undefined,
      userAgent: headersList.get("user-agent") || undefined,
      referer: headersList.get("referer") || undefined,
    };

    // Log the download
    await logShareAccess(shareLink.id, "DOWNLOAD", metadata);

    // Get download URL - prefer public URL (zero bandwidth) over presigned
    let url = getPublicFileUrl(upload.storageKey);
    if (!url) {
      url = await getDownloadPresignedUrl(upload.storageKey);
    }

    return NextResponse.json({
      url,
      fileName: upload.originalName,
    });
  } catch (error) {
    console.error("Share download error:", error);
    return NextResponse.json(
      { error: "Failed to generate download" },
      { status: 500 }
    );
  }
}
