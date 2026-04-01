// Client-safe types and utilities for share functionality
// This file should NOT import db.ts or any server-only modules

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

export interface ValidateShareResult {
  valid: boolean;
  error?: "NOT_FOUND" | "EXPIRED" | "INACTIVE" | "PASSWORD_REQUIRED" | "INVALID_PASSWORD";
  shareLink?: ShareLinkWithResource & { password?: string | null };
}

export interface ShareAccessLog {
  id: string;
  shareLinkId: string;
  action: "VIEW" | "DOWNLOAD" | "PASSWORD_ATTEMPT";
  ipAddress?: string | null;
  userAgent?: string | null;
  referer?: string | null;
  createdAt: Date;
}

export interface ShareAnalytics {
  shareLink: ShareLinkWithResource;
  stats: {
    totalViews: number;
    recentViews: number;
    downloads: number;
    failedPasswordAttempts: number;
    uniqueVisitors: number;
  };
  recentAccess: ShareAccessLog[];
}

// Format expiration options - client-safe constant
export const EXPIRATION_OPTIONS = [
  { label: "1 hour", value: "1h", hours: 1 },
  { label: "24 hours", value: "24h", hours: 24 },
  { label: "7 days", value: "7d", hours: 168 },
  { label: "30 days", value: "30d", hours: 720 },
  { label: "Never", value: "never", hours: null },
] as const;

export type ExpirationOption = (typeof EXPIRATION_OPTIONS)[number];

// Client-safe utility functions
export function getExpirationDate(option: string): Date | null {
  const found = EXPIRATION_OPTIONS.find((o) => o.value === option);
  if (!found || found.hours === null) {
    return null;
  }
  return new Date(Date.now() + found.hours * 60 * 60 * 1000);
}

export function generateShareUrl(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${baseUrl}/share/${token}`;
}

export function formatShareExpiration(expiresAt: Date | null): string {
  if (!expiresAt) {
    return "Never expires";
  }

  const now = new Date();
  const diff = expiresAt.getTime() - now.getTime();

  if (diff < 0) {
    return "Expired";
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `Expires in ${days} day${days > 1 ? "s" : ""}`;
  }

  if (hours > 0) {
    return `Expires in ${hours} hour${hours > 1 ? "s" : ""}`;
  }

  const minutes = Math.floor(diff / (1000 * 60));
  return `Expires in ${minutes} minute${minutes > 1 ? "s" : ""}`;
}

export function getResourceTypeLabel(type: ShareResourceType): string {
  const labels: Record<ShareResourceType, string> = {
    UPLOAD: "Upload",
    REQUEST: "Request",
    REPORT: "Report",
    COLLECTION: "Collection",
  };
  return labels[type] || type;
}

export function getPermissionLabel(permission: SharePermission): string {
  const labels: Record<SharePermission, string> = {
    VIEW: "View only",
    DOWNLOAD: "View & Download",
  };
  return labels[permission] || permission;
}
