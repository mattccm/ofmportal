import crypto from "crypto";
import { getAppUrl } from "@/lib/app-url";

/**
 * Invite links (creators and staff) are bearer secrets: anyone holding one can
 * set up an account. They work once, expire after INVITE_TTL_DAYS and can be
 * cancelled or replaced. Never log a raw token or a full invite URL.
 */
export const INVITE_TTL_DAYS = 7;
export const INVITE_TTL_MS = INVITE_TTL_DAYS * 24 * 60 * 60 * 1000;

/** A fresh, URL-safe token (256 bits). */
export function newInviteToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/** What is stored for a staff invite: the SHA-256 of the token, never the token. */
export function hashInviteToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

export function inviteExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + INVITE_TTL_MS);
}

// ---------- creators ----------

export function creatorInviteLink(token: string): string {
  return `${getAppUrl()}/portal/setup/${token}`;
}

export type CreatorInviteState = "accepted" | "pending" | "expired" | "cancelled";

/**
 * A creator's invite, read from the existing columns: the link was issued at
 * inviteSentAt (or createdAt for older rows that never stamped it) and works
 * for INVITE_TTL_DAYS. A pending creator with no token had their invite
 * cancelled.
 */
export function creatorInvite(c: {
  inviteStatus: string;
  inviteToken: string | null;
  inviteSentAt: Date | null;
  createdAt: Date;
}, now: Date = new Date()): { state: CreatorInviteState; expiresAt: Date | null } {
  if (c.inviteStatus === "ACCEPTED") return { state: "accepted", expiresAt: null };
  if (!c.inviteToken) return { state: c.inviteStatus === "EXPIRED" ? "expired" : "cancelled", expiresAt: null };
  const expiresAt = inviteExpiry(c.inviteSentAt ?? c.createdAt);
  if (c.inviteStatus === "EXPIRED" || expiresAt <= now) return { state: "expired", expiresAt };
  return { state: "pending", expiresAt };
}

// ---------- staff ----------

export function staffInviteLink(token: string): string {
  return `${getAppUrl()}/join/${token}`;
}

export type StaffInviteState = "pending" | "expired" | "accepted" | "cancelled";

export function staffInviteState(
  i: { expiresAt: Date; acceptedAt: Date | null; revokedAt: Date | null },
  now: Date = new Date()
): StaffInviteState {
  if (i.acceptedAt) return "accepted";
  if (i.revokedAt) return "cancelled";
  if (i.expiresAt <= now) return "expired";
  return "pending";
}

export const STAFF_ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MANAGER: "Manager",
  MEMBER: "Member",
};

/** Roles that may be handed out by invite. Nobody can invite an owner. */
export const INVITABLE_ROLES = ["ADMIN", "MANAGER", "MEMBER"] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];
