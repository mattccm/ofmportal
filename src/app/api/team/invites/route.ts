import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { parseJsonBody } from "@/lib/api";
import {
  INVITABLE_ROLES,
  hashInviteToken,
  inviteExpiry,
  newInviteToken,
  staffInviteLink,
} from "@/lib/invites";
import { emailStaffInvite, listOpenStaffInvites, toInviteRow } from "@/lib/staff-invites";
import { requireAccess } from "@/lib/access/server";
import { BUILT_IN_FOR_ENUM } from "@/lib/access/catalogue";
import { assignmentData, loadRole } from "@/lib/access/roles";
import { canGrant } from "@/lib/access/assign";

/**
 * Staff invites (Team page). Needs "team.invite". Nobody can be invited as an
 * owner, and an invite can only carry a role with no more access than the
 * inviter's own unless they can manage roles (lib/access/assign.ts). The link
 * token is returned once, when it is made; only its SHA-256 is stored. Raw
 * tokens and links are never logged.
 */

const createSchema = z
  .object({
    /** "admin" | "manager" | "member" | a custom role id */
    roleId: z.string().min(1).optional(),
    /** Older clients: a built-in role or a custom role id */
    role: z.enum(INVITABLE_ROLES).optional(),
    customRoleId: z.string().min(1).optional(),
    name: z.string().trim().max(120).optional(),
    email: z.string().trim().toLowerCase().email("Enter a valid email address").optional().or(z.literal("")),
    sendEmail: z.boolean().default(false),
  })
  .refine((d) => d.roleId || d.role || d.customRoleId, { message: "Choose a role" })
  .refine((d) => !d.sendEmail || !!d.email, { message: "Add their email address to send the invite by email" });

async function staffSession() {
  const gate = await requireAccess("team.invite");
  if (gate.error) return { error: gate.error } as const;
  return { session: gate.session, access: gate.access } as const;
}

export async function GET() {
  try {
    const r = await staffSession();
    if ("error" in r) return r.error;
    const invites = await listOpenStaffInvites(r.session.user.agencyId);
    return NextResponse.json({ invites }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Error listing staff invites:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Failed to load invites" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const r = await staffSession();
    if ("error" in r) return r.error;
    const { session } = r;
    const agencyId = session.user.agencyId;

    const body = await parseJsonBody(req);
    if (!body.ok) return body.response;
    const parsed = createSchema.safeParse(body.data);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the invite details" }, { status: 400 });
    }
    const { sendEmail } = parsed.data;
    const email = parsed.data.email || null;
    const name = parsed.data.name || null;

    const roleId = parsed.data.roleId ?? parsed.data.customRoleId ?? BUILT_IN_FOR_ENUM[parsed.data.role!];
    const target = await loadRole(agencyId, roleId);
    if (!target) return NextResponse.json({ error: "That role no longer exists" }, { status: 400 });
    if (target.kind === "owner") {
      return NextResponse.json({ error: "Owners can't be invited. Make someone an owner after they join." }, { status: 400 });
    }
    if (!canGrant(r.access, target)) {
      return NextResponse.json(
        { error: `You can't invite someone as ${target.name}: it has more access than your own role` },
        { status: 403 }
      );
    }
    const { role, customRoleId } = assignmentData(target);
    const customRole = customRoleId ? { id: customRoleId, name: target.name } : null;
    const roleLabel = target.name;

    if (email) {
      if (email.endsWith(".internal")) {
        return NextResponse.json({ error: "Use a real email address" }, { status: 400 });
      }
      const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
      if (existing) {
        return NextResponse.json({ error: `${email} already has an account. They can sign in.` }, { status: 409 });
      }
      const open = await db.staffInvite.findFirst({
        where: { agencyId, email, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
        select: { id: true },
      });
      if (open) {
        return NextResponse.json(
          { error: `${email} already has an invite waiting. Use New link or Resend email on it below.` },
          { status: 409 }
        );
      }
    }

    const token = newInviteToken();
    const invite = await db.staffInvite.create({
      data: {
        agencyId,
        tokenHash: hashInviteToken(token),
        role,
        customRoleId: customRole?.id ?? null,
        email,
        name,
        invitedById: session.user.id,
        expiresAt: inviteExpiry(),
      },
      select: {
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
      },
    });

    let emailed = false;
    if (sendEmail && email) {
      try {
        await emailStaffInvite({ to: email, name, roleLabel, inviterName: session.user.name ?? null, token, agencyId });
        emailed = true;
        invite.emailSentAt = new Date();
        await db.staffInvite.update({ where: { id: invite.id }, data: { emailSentAt: invite.emailSentAt } });
      } catch (e) {
        console.error("Failed to send staff invite email:", e instanceof Error ? e.message : e);
      }
    }

    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "team.invite_created",
        entityType: "StaffInvite",
        entityId: invite.id,
        metadata: {
          invitedEmail: email,
          invitedName: name,
          invitedRole: roleLabel,
          delivery: sendEmail ? "email" : "link",
          emailed,
        },
      },
    });

    return NextResponse.json(
      { invite: toInviteRow(invite), link: staffInviteLink(token), emailed },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Error creating staff invite:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Failed to create the invite" }, { status: 500 });
  }
}
