import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { parseJsonBody } from "@/lib/api";
import { rateLimitAsync, RATE_LIMITS, getClientIp } from "@/lib/rate-limit";
import { staffInviteState } from "@/lib/invites";
import { findStaffInviteByToken, toInviteRow } from "@/lib/staff-invites";

/**
 * POST /api/join: accept a staff invite (public). Creates the account in the
 * invite's agency with the invite's role, and marks the invite used, in one
 * transaction that only one request can win. The client then signs in with
 * the same credentials the login page uses.
 */

const joinSchema = z
  .object({
    token: z.string().min(1),
    name: z.string().trim().min(2, "Enter your name").max(120),
    email: z.string().trim().toLowerCase().email("Enter a valid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Password must contain at least one uppercase letter, one lowercase letter, and one number"
      ),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, { message: "The two passwords don't match" });

const GONE: Record<string, string> = {
  expired: "This invite link has expired. Ask your team for a new link.",
  accepted: "This invite link has already been used. If it was you, sign in.",
  cancelled: "This invite was cancelled. Ask your team for a new link.",
  invalid: "This invite link doesn't work. Ask your team for a new link.",
};

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req.headers);
    const rl = await rateLimitAsync(`join:${ip}`, RATE_LIMITS.login);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many attempts. Wait a few minutes and try again.", retryAfter: rl.retryAfter },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 60) } }
      );
    }

    const body = await parseJsonBody(req);
    if (!body.ok) return body.response;
    const parsed = joinSchema.safeParse(body.data);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check your details" }, { status: 400 });
    }
    const { token, name, password } = parsed.data;

    const invite = await findStaffInviteByToken(token);
    if (!invite) return NextResponse.json({ error: GONE.invalid, reason: "invalid" }, { status: 404 });
    const state = staffInviteState(invite);
    if (state !== "pending") {
      return NextResponse.json({ error: GONE[state], reason: state }, { status: 410 });
    }

    // An invite made for one address can only be used with that address
    const email = invite.email ?? parsed.data.email;
    if (email.endsWith(".internal")) {
      return NextResponse.json({ error: "Use a real email address" }, { status: 400 });
    }
    const taken = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (taken) {
      return NextResponse.json(
        { error: `${email} already has an account. Sign in instead.`, reason: "email_taken" },
        { status: 409 }
      );
    }

    const hashed = await hashPassword(password);
    const now = new Date();

    let userId: string;
    try {
      userId = await db.$transaction(async (tx) => {
        // Claim the invite: only one request can move it from open to accepted
        const claimed = await tx.staffInvite.updateMany({
          where: { id: invite.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
          data: { acceptedAt: now },
        });
        if (claimed.count !== 1) throw new Error("INVITE_GONE");

        const user = await tx.user.create({
          data: {
            email,
            name,
            password: hashed,
            role: invite.role,
            customRoleId: invite.customRoleId,
            agencyId: invite.agencyId,
            ...(invite.email ? { emailVerified: now } : {}),
          },
          select: { id: true },
        });

        await tx.activityLog.create({
          data: {
            userId: user.id,
            action: "team.invite_accepted",
            entityType: "StaffInvite",
            entityId: invite.id,
            metadata: {
              memberName: name,
              memberEmail: email,
              role: toInviteRow(invite).roleLabel,
              invitedBy: invite.invitedBy?.name ?? null,
            },
            ipAddress: ip,
          },
        });
        return user.id;
      });
    } catch (e) {
      if (e instanceof Error && e.message === "INVITE_GONE") {
        return NextResponse.json({ error: GONE.accepted, reason: "accepted" }, { status: 410 });
      }
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return NextResponse.json(
          { error: `${email} already has an account. Sign in instead.`, reason: "email_taken" },
          { status: 409 }
        );
      }
      throw e;
    }

    return NextResponse.json({ ok: true, userId, email });
  } catch (error) {
    console.error("Error accepting staff invite:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Your account could not be set up. Try again." }, { status: 500 });
  }
}
