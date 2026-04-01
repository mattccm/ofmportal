import { db } from "./db";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

// Types
export type ShareResourceType = "UPLOAD" | "REQUEST" | "REPORT" | "COLLECTION";
export type SharePermission = "VIEW" | "DOWNLOAD";

export interface CreateShareLinkParams {
  agencyId: string;
  createdById: string;
  resourceType: ShareResourceType;
  resourceId: string;
  permission?: SharePermission;
  password?: string;
  expiresAt?: Date | null;
}

export interface ShareLinkWithResource {
  id: string;
  token: string;
  resourceType: ShareResourceType;
  resourceId: string;
  permission: SharePermission;
  hasPassword: boolean;
  expiresAt: Date | null;
  viewCount: number;
  lastViewedAt: Date | null;
  isActive: boolean;
  createdAt: Date;
}

// Generate a secure random token
export function generateShareToken(): string {
  return randomBytes(32).toString("base64url");
}

// Hash password for share link
export async function hashSharePassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// Verify share link password
export async function verifySharePassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

// Create a new share link
export async function createShareLink(
  params: CreateShareLinkParams
): Promise<ShareLinkWithResource> {
  const {
    agencyId,
    createdById,
    resourceType,
    resourceId,
    permission = "VIEW",
    password,
    expiresAt,
  } = params;

  // Hash password if provided
  const hashedPassword = password ? await hashSharePassword(password) : null;

  // Generate a unique token
  const token = generateShareToken();

  const shareLink = await db.shareLink.create({
    data: {
      agencyId,
      createdById,
      token,
      resourceType,
      resourceId,
      permission,
      password: hashedPassword,
      expiresAt,
      isActive: true,
    },
  });

  return {
    id: shareLink.id,
    token: shareLink.token,
    resourceType: shareLink.resourceType as ShareResourceType,
    resourceId: shareLink.resourceId,
    permission: shareLink.permission as SharePermission,
    hasPassword: !!shareLink.password,
    expiresAt: shareLink.expiresAt,
    viewCount: shareLink.viewCount,
    lastViewedAt: shareLink.lastViewedAt,
    isActive: shareLink.isActive,
    createdAt: shareLink.createdAt,
  };
}

// Get share link by token
export async function getShareLinkByToken(token: string) {
  const shareLink = await db.shareLink.findUnique({
    where: { token },
  });

  if (!shareLink) {
    return null;
  }

  return {
    ...shareLink,
    hasPassword: !!shareLink.password,
  };
}

// Validate share link access
export interface ValidateShareResult {
  valid: boolean;
  error?: "NOT_FOUND" | "EXPIRED" | "INACTIVE" | "PASSWORD_REQUIRED" | "INVALID_PASSWORD";
  shareLink?: Awaited<ReturnType<typeof getShareLinkByToken>>;
}

export async function validateShareAccess(
  token: string,
  password?: string
): Promise<ValidateShareResult> {
  const shareLink = await getShareLinkByToken(token);

  if (!shareLink) {
    return { valid: false, error: "NOT_FOUND" };
  }

  if (!shareLink.isActive) {
    return { valid: false, error: "INACTIVE" };
  }

  if (shareLink.expiresAt && shareLink.expiresAt < new Date()) {
    return { valid: false, error: "EXPIRED" };
  }

  if (shareLink.password) {
    if (!password) {
      return { valid: false, error: "PASSWORD_REQUIRED", shareLink };
    }

    const isValidPassword = await verifySharePassword(password, shareLink.password);
    if (!isValidPassword) {
      // Log failed password attempt
      await logShareAccess(shareLink.id, "PASSWORD_ATTEMPT");
      return { valid: false, error: "INVALID_PASSWORD", shareLink };
    }
  }

  return { valid: true, shareLink };
}

// Log share access
export async function logShareAccess(
  shareLinkId: string,
  action: "VIEW" | "DOWNLOAD" | "PASSWORD_ATTEMPT",
  metadata?: { ipAddress?: string; userAgent?: string; referer?: string }
) {
  await db.shareAccessLog.create({
    data: {
      shareLinkId,
      action,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
      referer: metadata?.referer,
    },
  });

  // Update view count and last viewed time for VIEW and DOWNLOAD actions
  if (action === "VIEW" || action === "DOWNLOAD") {
    await db.shareLink.update({
      where: { id: shareLinkId },
      data: {
        viewCount: { increment: 1 },
        lastViewedAt: new Date(),
      },
    });
  }
}

// Get shared resource
export async function getSharedResource(
  resourceType: ShareResourceType,
  resourceId: string,
  agencyId: string
) {
  switch (resourceType) {
    case "UPLOAD": {
      const upload = await db.upload.findFirst({
        where: {
          id: resourceId,
          request: { agencyId },
        },
        include: {
          creator: {
            select: {
              id: true,
              name: true,
            },
          },
          request: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });
      return upload;
    }

    case "REQUEST": {
      const request = await db.contentRequest.findFirst({
        where: {
          id: resourceId,
          agencyId,
        },
        include: {
          creator: {
            select: {
              id: true,
              name: true,
            },
          },
          uploads: {
            where: {
              status: "APPROVED",
            },
            select: {
              id: true,
              fileName: true,
              originalName: true,
              fileType: true,
              fileSize: true,
              storageKey: true,
            },
          },
        },
      });
      return request;
    }

    case "COLLECTION": {
      const collection = await db.collection.findFirst({
        where: {
          id: resourceId,
          agencyId,
        },
        include: {
          items: {
            include: {
              // CollectionItem relation to upload requires custom handling
            },
            orderBy: { sortOrder: "asc" },
          },
        },
      });
      return collection;
    }

    case "REPORT": {
      // Reports are generated dynamically, so we return metadata
      return {
        type: "REPORT",
        id: resourceId,
        agencyId,
      };
    }

    default:
      return null;
  }
}

// Deactivate share link
export async function deactivateShareLink(id: string, userId: string) {
  const shareLink = await db.shareLink.findUnique({
    where: { id },
  });

  if (!shareLink) {
    throw new Error("Share link not found");
  }

  if (shareLink.createdById !== userId) {
    throw new Error("Not authorized to deactivate this share link");
  }

  await db.shareLink.update({
    where: { id },
    data: { isActive: false },
  });
}

// Get share links for a resource
export async function getShareLinksForResource(
  resourceType: ShareResourceType,
  resourceId: string,
  agencyId: string
) {
  const shareLinks = await db.shareLink.findMany({
    where: {
      resourceType,
      resourceId,
      agencyId,
    },
    orderBy: { createdAt: "desc" },
  });

  return shareLinks.map((link) => ({
    ...link,
    hasPassword: !!link.password,
  }));
}

// Get share analytics
export async function getShareAnalytics(shareLinkId: string) {
  const [shareLink, accessLogs] = await Promise.all([
    db.shareLink.findUnique({
      where: { id: shareLinkId },
    }),
    db.shareAccessLog.findMany({
      where: { shareLinkId },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  if (!shareLink) {
    return null;
  }

  // Calculate stats
  const viewCount = accessLogs.filter((log) => log.action === "VIEW").length;
  const downloadCount = accessLogs.filter((log) => log.action === "DOWNLOAD").length;
  const failedAttempts = accessLogs.filter((log) => log.action === "PASSWORD_ATTEMPT").length;

  // Get unique viewers (by IP)
  const uniqueIps = new Set(accessLogs.filter((log) => log.ipAddress).map((log) => log.ipAddress));

  return {
    shareLink: {
      ...shareLink,
      hasPassword: !!shareLink.password,
    },
    stats: {
      totalViews: shareLink.viewCount,
      recentViews: viewCount,
      downloads: downloadCount,
      failedPasswordAttempts: failedAttempts,
      uniqueVisitors: uniqueIps.size,
    },
    recentAccess: accessLogs.slice(0, 20),
  };
}

// Generate share URL
export function generateShareUrl(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${baseUrl}/share/${token}`;
}

// Format expiration options
export const EXPIRATION_OPTIONS = [
  { label: "1 hour", value: "1h", hours: 1 },
  { label: "24 hours", value: "24h", hours: 24 },
  { label: "7 days", value: "7d", hours: 168 },
  { label: "30 days", value: "30d", hours: 720 },
  { label: "Never", value: "never", hours: null },
] as const;

export function getExpirationDate(option: string): Date | null {
  const found = EXPIRATION_OPTIONS.find((o) => o.value === option);
  if (!found || found.hours === null) {
    return null;
  }
  return new Date(Date.now() + found.hours * 60 * 60 * 1000);
}
