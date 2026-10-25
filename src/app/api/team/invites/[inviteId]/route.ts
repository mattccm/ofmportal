import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseJsonBody } from "@/lib/api";
import { hashInviteToken, inviteExpiry, newInviteToken, staffInviteLink } from "@/lib/invites";
import { emailStaffInvite, getStaffInvite, toInviteRow } from "@/lib/staff-invites";

/**
 * One staff invite.
 *   POST { action: "rotate" }  a new link (the old one stops working), 7 more days
 *   POST { action: "email" }   email the invite again; tokens are stored hashed,
 *                              so this also makes a new link
 *   DELETE                     cancel: the link stops working
 */

type Params = { params: Promise<{ inviteId: string }> };

async function load(params: Params["params"]) {
  const session = await getServerSession(authOptions);
  const { inviteId } = await params;
  if (!session?.user?.agencyId) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }
  if (!["OWNER", "ADMIN"].includes(session.user.role)) {
    return {
      error: NextResponse.json({ error: "Only owners and admins can manage invites" }, { status: 403 }),
    } as const;
  }
  const invite = await getStaffInvite(session.user.agencyId, inviteId);
  if (!invite) return { error: NextResponse.json({ error: "Invite not found" }, { status: 404 }) } as const;
  if (invite.acceptedAt) {
    return { error: NextResponse.json({ error: "This invite has already been accepted" }, { status: 400 }) } as const;
  }
  if (invite.revokedAt) {
    return { error: NextResponse.json({ error: "This invite was cancelled" }, { status: 400 }) } as const;
  }
  return { session, invite } as const;
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const r = await load(params);
    if ("error" in r) return r.error;
    const { session, invite } = r;

    const body = await parseJsonBody(req);
    if (!body.ok) return body.response;
    const action = (body.data as { action?: string })?.action;
    if (action !== "rotate" && action !== "email") {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
    if (action === "email" && !invite.email) {
      return NextResponse.json({ error: "This invite has no email address. Copy a new link instead." }, { status: 400 });
    }

    const token = newInviteToken();
    const expiresAt = inviteExpiry();
    // Only replace the link if the invite is still open (race with accept/cancel)
    const updated = await db.staffInvite.updateMany({
      where: { id: invite.id, acceptedAt: null, revokedAt: null },
      data: { tokenHash: hashInviteToken(token), expiresAt },
    });
    if (updated.count === 0) {
      return NextResponse.json({ error: "This invite was just accepted or cancelled" }, { status: 409 });
    }

    const roleLabel = toInviteRow(invite).roleLabel;
    let emailed = false;
    let emailSentAt = invite.emailSentAt;
    if (action === "email" && invite.email) {
      try {
        await emailStaffInvite({
          to: invite.email,
          name: invite.name,
          roleLabel,
          inviterName: session.user.name ?? null,
          token,
          agencyId: session.user.agencyId,
        });
        emailed = true;
        emailSentAt = new Date();
        await db.staffInvite.update({ where: { id: invite.id }, data: { emailSentAt } });
      } catch (e) {
        console.error("Failed to resend staff invite email:", e instanceof Error ? e.message : e);
        return NextResponse.json(
          { error: "The email could not be sent. Copy the new link instead.", link: staffInviteLink(token) },
          { status: 502, headers: { "Cache-Control": "no-store" } }
        );
      }
    }

    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: action === "email" ? "team.invite_resent" : "team.invite_link_replaced",
        entityType: "StaffInvite",
        entityId: invite.id,
        metadata: { invitedEmail: invite.email, invitedName: invite.name, invitedRole: roleLabel },
      },
    });

    return NextResponse.json(
      {
        invite: toInviteRow({ ...invite, expiresAt, emailSentAt }),
        link: staffInviteLink(token),
        emailed,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Error updating staff invite:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Failed to update the invite" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const r = await load(params);
    if ("error" in r) return r.error;
    const { session, invite } = r;

    await db.staffInvite.updateMany({
      where: { id: invite.id, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "team.invite_cancelled",
        entityType: "StaffInvite",
        entityId: invite.id,
        metadata: { invitedEmail: invite.email, invitedName: invite.name },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error cancelling staff invite:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Failed to cancel the invite" }, { status: 500 });
  }
}
