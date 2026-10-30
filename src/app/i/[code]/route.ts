import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAppUrl } from "@/lib/app-url";
import { rateLimitAsync, RATE_LIMITS, getClientIp } from "@/lib/rate-limit";
import { INVITE_CODE_LENGTH } from "@/lib/invites";

/**
 * Short invite links for texts: /i/<first 12 characters of the invite token>
 * sends the creator on to /portal/setup/<full token>. 12 base64url characters
 * are 72 random bits, and lookups are rate limited per IP. Emails keep the
 * full link. A code that matches nothing (or used, cancelled) goes to the
 * setup page, which explains the link no longer works.
 */

const CODE = new RegExp(`^[A-Za-z0-9_-]{${INVITE_CODE_LENGTH}}$`);

function go(path: string) {
  const res = NextResponse.redirect(`${getAppUrl()}${path}`, 307);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("X-Robots-Tag", "noindex");
  return res;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!CODE.test(code)) return go("/portal/setup/invalid");

  const rl = await rateLimitAsync(`invite-short:${getClientIp(req.headers)}`, RATE_LIMITS.twoFactor);
  if (!rl.success) {
    return new NextResponse("Too many tries. Wait a few minutes and open the link again.", {
      status: 429,
      headers: { "Retry-After": String(rl.retryAfter ?? 60), "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const matches = await db.creator.findMany({
    where: { inviteToken: { startsWith: code }, inviteStatus: "PENDING", archivedAt: null },
    select: { inviteToken: true },
    take: 2,
  });
  // startsWith is a LIKE, where "_" matches any character: check the prefix exactly
  const exact = matches.filter((m) => m.inviteToken?.startsWith(code));
  if (exact.length !== 1 || !exact[0].inviteToken) return go("/portal/setup/invalid");
  return go(`/portal/setup/${exact[0].inviteToken}`);
}
