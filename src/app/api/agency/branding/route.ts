import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  DEFAULT_BRANDING,
  isValidHexColor,
  isValidSubdomain,
  isValidDomain,
  generateBrandingAssetKey,
  type BrandingSettings,
} from "@/lib/branding";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

// S3-compatible client for branding asset storage
const isLocal = process.env.R2_ENDPOINT?.includes("localhost");
const s3Client = new S3Client({
  region: "auto",
  endpoint: isLocal
    ? process.env.R2_ENDPOINT
    : `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
  forcePathStyle: isLocal,
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME || "upload-portal";

// GET - Fetch current branding settings
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const agency = await db.agency.findUnique({
      where: { id: session.user.agencyId },
      select: {
        id: true,
        name: true,
        logo: true,
        settings: true,
      },
    });

    if (!agency) {
      return NextResponse.json({ error: "Agency not found" }, { status: 404 });
    }

    // Parse branding from agency settings
    const settings = agency.settings as Record<string, unknown> || {};
    const branding: BrandingSettings = {
      ...DEFAULT_BRANDING,
      ...(settings.branding as Partial<BrandingSettings> || {}),
      // Use agency logo as fallback for light logo
      logoLight: (settings.branding as Partial<BrandingSettings>)?.logoLight || agency.logo || null,
    };

    return NextResponse.json({
      branding,
      agencyName: agency.name,
    });
  } catch (error) {
    console.error("Error fetching branding:", error);
    return NextResponse.json(
      { error: "Failed to fetch branding settings" },
      { status: 500 }
    );
  }
}

// PUT - Update branding settings
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only OWNER and ADMIN can update branding
    if (!["OWNER", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const updates: Partial<BrandingSettings> = {};

    // Validate and apply color updates
    if (body.primaryColor !== undefined) {
      if (!isValidHexColor(body.primaryColor)) {
        return NextResponse.json(
          { error: "Invalid primary color format" },
          { status: 400 }
        );
      }
      updates.primaryColor = body.primaryColor;
    }

    if (body.secondaryColor !== undefined) {
      if (!isValidHexColor(body.secondaryColor)) {
        return NextResponse.json(
          { error: "Invalid secondary color format" },
          { status: 400 }
        );
      }
      updates.secondaryColor = body.secondaryColor;
    }

    if (body.accentColor !== undefined) {
      if (!isValidHexColor(body.accentColor)) {
        return NextResponse.json(
          { error: "Invalid accent color format" },
          { status: 400 }
        );
      }
      updates.accentColor = body.accentColor;
    }

    // Validate subdomain
    if (body.subdomain !== undefined) {
      if (body.subdomain && !isValidSubdomain(body.subdomain)) {
        return NextResponse.json(
          { error: "Invalid subdomain format" },
          { status: 400 }
        );
      }
      updates.subdomain = body.subdomain || null;
    }

    // Validate custom domain
    if (body.customDomain !== undefined) {
      if (body.customDomain && !isValidDomain(body.customDomain)) {
        return NextResponse.json(
          { error: "Invalid custom domain format" },
          { status: 400 }
        );
      }
      updates.customDomain = body.customDomain || null;
    }

    // Apply text updates (no validation needed, just sanitize)
    if (body.emailFromName !== undefined) {
      updates.emailFromName = String(body.emailFromName).slice(0, 100);
    }

    if (body.emailReplyTo !== undefined) {
      updates.emailReplyTo = body.emailReplyTo || null;
    }

    if (body.emailSignature !== undefined) {
      updates.emailSignature = String(body.emailSignature).slice(0, 1000);
    }

    if (body.emailLogoEnabled !== undefined) {
      updates.emailLogoEnabled = Boolean(body.emailLogoEnabled);
    }

    if (body.portalTitle !== undefined) {
      updates.portalTitle = String(body.portalTitle).slice(0, 100);
    }

    if (body.welcomeMessage !== undefined) {
      updates.welcomeMessage = String(body.welcomeMessage).slice(0, 500);
    }

    if (body.supportEmail !== undefined) {
      updates.supportEmail = body.supportEmail || null;
    }

    if (body.supportUrl !== undefined) {
      updates.supportUrl = body.supportUrl || null;
    }

    // Handle logo updates (base64)
    if (body.logoLight !== undefined) {
      updates.logoLight = body.logoLight;
    }

    if (body.logoDark !== undefined) {
      updates.logoDark = body.logoDark;
    }

    if (body.logoFavicon !== undefined) {
      updates.logoFavicon = body.logoFavicon;
    }

    // Get current agency settings
    const agency = await db.agency.findUnique({
      where: { id: session.user.agencyId },
      select: { settings: true, logo: true },
    });

    if (!agency) {
      return NextResponse.json({ error: "Agency not found" }, { status: 404 });
    }

    const currentSettings = (agency.settings as Record<string, unknown>) || {};
    const currentBranding = (currentSettings.branding as Partial<BrandingSettings>) || {};

    // Merge updates with current branding
    const newBranding: BrandingSettings = {
      ...DEFAULT_BRANDING,
      ...currentBranding,
      ...updates,
    };

    // Update agency with new branding
    const settingsUpdate = {
      ...currentSettings,
      branding: newBranding,
    };

    const updatedAgency = await db.agency.update({
      where: { id: session.user.agencyId },
      data: {
        settings: JSON.parse(JSON.stringify(settingsUpdate)),
        // Also update main logo field if logoLight is provided
        ...(updates.logoLight !== undefined ? { logo: updates.logoLight } : {}),
      },
    });

    return NextResponse.json({
      message: "Branding updated successfully",
      branding: newBranding,
    });
  } catch (error) {
    console.error("Error updating branding:", error);
    return NextResponse.json(
      { error: "Failed to update branding settings" },
      { status: 500 }
    );
  }
}

// POST - Upload branding asset (logo)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only OWNER and ADMIN can upload branding assets
    if (!["OWNER", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const assetType = formData.get("assetType") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!assetType || !["logoLight", "logoDark", "logoFavicon"].includes(assetType)) {
      return NextResponse.json(
        { error: "Invalid asset type" },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/svg+xml", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: JPG, PNG, SVG, WebP" },
        { status: 400 }
      );
    }

    // Validate file size (max 2MB for logos)
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 2MB" },
        { status: 400 }
      );
    }

    // Generate storage key
    const key = generateBrandingAssetKey(
      session.user.agencyId,
      assetType,
      file.name
    );

    // Upload to S3/R2
    const buffer = Buffer.from(await file.arrayBuffer());
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: file.type,
      })
    );

    // Generate public URL (or presigned URL for private buckets)
    const url = isLocal
      ? `${process.env.R2_ENDPOINT}/${BUCKET_NAME}/${key}`
      : `https://${process.env.R2_PUBLIC_DOMAIN || `${BUCKET_NAME}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`}/${key}`;

    // Update agency branding with new logo URL
    const agency = await db.agency.findUnique({
      where: { id: session.user.agencyId },
      select: { settings: true },
    });

    const currentSettings = (agency?.settings as Record<string, unknown>) || {};
    const currentBranding = (currentSettings.branding as Partial<BrandingSettings>) || {};

    const newSettings = {
      ...currentSettings,
      branding: {
        ...DEFAULT_BRANDING,
        ...currentBranding,
        [assetType]: url,
      },
    };

    await db.agency.update({
      where: { id: session.user.agencyId },
      data: {
        settings: JSON.parse(JSON.stringify(newSettings)),
        // Also update main logo field if logoLight
        ...(assetType === "logoLight" ? { logo: url } : {}),
      },
    });

    return NextResponse.json({
      message: "Logo uploaded successfully",
      url,
      assetType,
    });
  } catch (error) {
    console.error("Error uploading branding asset:", error);
    return NextResponse.json(
      { error: "Failed to upload branding asset" },
      { status: 500 }
    );
  }
}

// DELETE - Reset branding to defaults
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only OWNER can reset branding
    if (session.user.role !== "OWNER") {
      return NextResponse.json(
        { error: "Only agency owners can reset branding" },
        { status: 403 }
      );
    }

    const agency = await db.agency.findUnique({
      where: { id: session.user.agencyId },
      select: { settings: true },
    });

    const currentSettings = (agency?.settings as Record<string, unknown>) || {};

    // Reset branding to defaults
    const resetSettings = {
      ...currentSettings,
      branding: DEFAULT_BRANDING,
    };

    await db.agency.update({
      where: { id: session.user.agencyId },
      data: {
        settings: JSON.parse(JSON.stringify(resetSettings)),
        logo: null,
      },
    });

    return NextResponse.json({
      message: "Branding reset to defaults",
      branding: DEFAULT_BRANDING,
    });
  } catch (error) {
    console.error("Error resetting branding:", error);
    return NextResponse.json(
      { error: "Failed to reset branding" },
      { status: 500 }
    );
  }
}
