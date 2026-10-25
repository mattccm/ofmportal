import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { invalidateCache } from "@/lib/cache";
import { creatorInvite, creatorInviteLink, inviteExpiry, newInviteToken } from "@/lib/invites";

/**
 * A pending creator's invite link.
 *   GET    the current link, to copy (only while it still works)
 *   POST   a new link: replaces the token, so the old link stops working
 *   DELETE cancel the invite: the link stops working, nothing new is made
 * The link is a bearer secret: it is returned to staff, never logged.
 */

const MANAGE_ROLES = ["OWNER", "ADMIN", "MANAGER"];

async function load(params: Promise<{ id: string }>) {
  const session = await getServerSession(authOptions);
  const { id } = await params;
  if (!session?.user?.agencyId) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }
  if (!MANAGE_ROLES.includes(session.user.role)) {
    return {
      error: NextResponse.json({ error: "You don't have permission to manage invites" }, { status: 403 }),
    } as const;
  }
  const creator = await db.creator.findFirst({
    where: { id, agencyId: session.user.agencyId },
    select: {
      id: true,
      name: true,
      email: true,
      inviteStatus: true,
      inviteToken: true,
      inviteSentAt: true,
      createdAt: true,
      archivedAt: true,
    },
  });
  if (!creator) {
    return { error: NextResponse.json({ error: "Creator not found" }, { status: 404 }) } as const;
  }
  if (creator.inviteStatus === "ACCEPTED") {
    return {
      error: NextResponse.json({ error: `${creator.name} has already set up their account` }, { status: 400 }),
    } as const;
  }
  return { session, creator } as const;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const r = await load(params);
    if ("error" in r) return r.error;
    const { creator } = r;
    const invite = creatorInvite(creator);
    if (invite.state !== "pending" || !creator.inviteToken) {
      return NextResponse.json(
        {
          error:
            invite.state === "expired"
              ? "This invite link has expired. Make a new link."
              : "This invite was cancelled. Make a new link.",
          state: invite.state,
        },
        { status: 410 }
      );
    }
    return NextResponse.json(
      {
        link: creatorInviteLink(creator.inviteToken),
        expiresAt: invite.expiresAt?.toISOString() ?? null,
        state: invite.state,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Error reading creator invite:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Failed to load the invite link" }, { status: 500 });
  }
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const r = await load(params);
    if ("error" in r) return r.error;
    const { session, creator } = r;
    if (creator.archivedAt) {
      return NextResponse.json({ error: `Restore ${creator.name} before inviting them` }, { status: 400 });
    }

    const token = newInviteToken();
    const issuedAt = new Date();
    await db.creator.update({
      where: { id: creator.id },
      data: { inviteToken: token, inviteStatus: "PENDING", inviteSentAt: issuedAt },
    });

    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "creator.invite_link_replaced",
        entityType: "Creator",
        entityId: creator.id,
        metadata: { creatorName: creator.name },
      },
    });
    invalidateCache.creator(creator.id, session.user.agencyId);

    return NextResponse.json(
      {
        link: creatorInviteLink(token),
        expiresAt: inviteExpiry(issuedAt).toISOString(),
        state: "pending",
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Error replacing creator invite:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Failed to make a new invite link" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const r = await load(params);
    if ("error" in r) return r.error;
    const { session, creator } = r;

    // Pending with no token reads as "cancelled"; setup and verify only ever
    // match on a token, so the old link stops working at once.
    await db.creator.update({
      where: { id: creator.id },
      data: { inviteToken: null, inviteStatus: "PENDING" },
    });

    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "creator.invite_cancelled",
        entityType: "Creator",
        entityId: creator.id,
        metadata: { creatorName: creator.name },
      },
    });
    invalidateCache.creator(creator.id, session.user.agencyId);

    return NextResponse.json({ state: "cancelled" });
  } catch (error) {
    console.error("Error cancelling creator invite:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Failed to cancel the invite" }, { status: 500 });
  }
}
