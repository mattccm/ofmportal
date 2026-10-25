import { db } from "@/lib/db";
import { sendStaffInviteEmail } from "@/lib/email";
import { STAFF_ROLE_LABEL, hashInviteToken, staffInviteLink, staffInviteState, type StaffInviteState } from "@/lib/invites";

/** A staff invite as the Team page shows it (never the token or its hash). */
export interface StaffInviteRow {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  roleLabel: string;
  customRoleId: string | null;
  state: StaffInviteState;
  expiresAt: string;
  emailSentAt: string | null;
  createdAt: string;
  invitedBy: string | null;
}

const inviteSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  customRoleId: true,
  customRole: { select: { name: true } },
  expiresAt: true,
  acceptedAt: true,
  revokedAt: true,
  emailSentAt: true,
  createdAt: true,
  invitedBy: { select: { name: true } },
} as const;

type InviteRecord = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  customRoleId: string | null;
  customRole: { name: string } | null;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  emailSentAt: Date | null;
  createdAt: Date;
  invitedBy: { name: string } | null;
};

export function toInviteRow(i: InviteRecord, now: Date = new Date()): StaffInviteRow {
  return {
    id: i.id,
    name: i.name,
    email: i.email,
    role: i.role,
    roleLabel: i.customRole?.name ?? STAFF_ROLE_LABEL[i.role] ?? i.role,
    customRoleId: i.customRoleId,
    state: staffInviteState(i, now),
    expiresAt: i.expiresAt.toISOString(),
    emailSentAt: i.emailSentAt ? i.emailSentAt.toISOString() : null,
    createdAt: i.createdAt.toISOString(),
    invitedBy: i.invitedBy?.name ?? null,
  };
}

/** Invites still open (not accepted, not cancelled), newest first; expired ones included so they can be renewed. */
export async function listOpenStaffInvites(agencyId: string): Promise<StaffInviteRow[]> {
  const now = new Date();
  const rows = await db.staffInvite.findMany({
    where: {
      agencyId,
      acceptedAt: null,
      revokedAt: null,
      // Expired a month ago is noise: drop it from the list
      expiresAt: { gt: new Date(now.getTime() - 30 * 86_400_000) },
    },
    orderBy: { createdAt: "desc" },
    select: inviteSelect,
  });
  return rows.map((r) => toInviteRow(r, now));
}

export async function getStaffInvite(agencyId: string, id: string) {
  return db.staffInvite.findFirst({ where: { id, agencyId }, select: { ...inviteSelect, agencyId: true } });
}

export async function emailStaffInvite(opts: {
  to: string;
  name: string | null;
  roleLabel: string;
  inviterName: string | null;
  token: string;
  agencyId: string;
}) {
  return sendStaffInviteEmail({
    to: opts.to,
    name: opts.name,
    roleName: opts.roleLabel,
    inviterName: opts.inviterName,
    joinLink: staffInviteLink(opts.token),
    agencyId: opts.agencyId,
  });
}

/** Looks an invite up by the token in a /join link (hashing it first). */
export async function findStaffInviteByToken(token: string) {
  // Tokens are 43 URL-safe characters; anything else can't match
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(token)) return null;
  return db.staffInvite.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    select: {
      ...inviteSelect,
      agencyId: true,
      agency: { select: { name: true } },
    },
  });
}
