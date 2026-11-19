import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { validateCreatorSession } from "@/lib/portal-auth";
import { generateTwoFactorQRCodeUrl, generateTwoFactorSecret, verifyTwoFactorCode } from "@/lib/auth";
import { backupCodesLeft, checkCreatorCode, makeBackupCodes } from "@/lib/creator-two-factor";
import { rateLimitAsync, RATE_LIMITS, getClientIp } from "@/lib/rate-limit";

/**
 * A creator's two-step sign-in (Settings > Two-step sign-in).
 * GET: { enabled, backupCodesLeft }
 * POST { action: "start" }: a new authenticator key + QR code (not on yet)
 * POST { action: "confirm", code }: a code from the app turns it on -> { backupCodes } (shown once)
 * POST { action: "disable", code }: an app or backup code turns it off
 * POST { action: "new-codes", code }: fresh backup codes (the old ones stop working)
 */

export async function GET(req: NextRequest) {
  const auth = await validateCreatorSession(req);
  if (!auth.success) return auth.error;
  const c = await db.creator.findUnique({ where: { id: auth.creator.id }, select: { twoFactorEnabled: true, twoFactorBackupCodes: true } });
  return NextResponse.json({ enabled: !!c?.twoFactorEnabled, backupCodesLeft: c?.twoFactorEnabled ? backupCodesLeft(c.twoFactorBackupCodes) : 0 });
}

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start") }),
  z.object({ action: z.literal("confirm"), code: z.string().max(20) }),
  z.object({ action: z.literal("disable"), code: z.string().max(20) }),
  z.object({ action: z.literal("new-codes"), code: z.string().max(20) }),
]);

export async function POST(req: NextRequest) {
  const auth = await validateCreatorSession(req);
  if (!auth.success) return auth.error;
  const rl = await rateLimitAsync(`creator-2fa:${auth.creator.id}:${getClientIp(req.headers)}`, RATE_LIMITS.twoFactor);
  if (!rl.success) return NextResponse.json({ error: "Too many tries. Wait a few minutes and try again." }, { status: 429 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Something was missing. Try again." }, { status: 400 });

  const creator = await db.creator.findUnique({
    where: { id: auth.creator.id },
    select: { id: true, email: true, twoFactorEnabled: true, twoFactorSecret: true, twoFactorBackupCodes: true },
  });
  if (!creator) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const data = parsed.data;

  if (data.action === "start") {
    if (creator.twoFactorEnabled) return NextResponse.json({ error: "Two-step sign-in is already on." }, { status: 400 });
    const secret = generateTwoFactorSecret();
    // Guarded so it never replaces a key that's already in use
    const set = await db.creator.updateMany({ where: { id: creator.id, twoFactorEnabled: false }, data: { twoFactorSecret: secret } });
    if (!set.count) return NextResponse.json({ error: "Two-step sign-in is already on." }, { status: 400 });
    const uri = generateTwoFactorQRCodeUrl(creator.email, secret);
    const qr = await QRCode.toDataURL(uri, { margin: 1, width: 220 });
    // uri: one tap adds it to an authenticator app (or iPhone Passwords) on this phone
    return NextResponse.json({ secret, qr, uri });
  }

  if (data.action === "confirm") {
    if (creator.twoFactorEnabled) return NextResponse.json({ error: "Two-step sign-in is already on." }, { status: 400 });
    const code = data.code.replace(/\s/g, "");
    if (!creator.twoFactorSecret || !/^\d{6}$/.test(code) || !verifyTwoFactorCode(creator.twoFactorSecret, code)) {
      return NextResponse.json({ error: "That code didn't match. Type the 6 digits your app shows now." }, { status: 400 });
    }
    const { plain, stored } = await makeBackupCodes();
    await db.creator.update({
      where: { id: creator.id },
      data: { twoFactorEnabled: true, twoFactorBackupCodes: stored as unknown as Prisma.InputJsonValue },
    });
    return NextResponse.json({ enabled: true, backupCodes: plain });
  }

  // Turning it off or new backup codes: prove it's them with a current code
  if (!creator.twoFactorEnabled) return NextResponse.json({ error: "Two-step sign-in is off." }, { status: 400 });
  const check = await checkCreatorCode(creator, data.code);
  if (!check.ok) return NextResponse.json({ error: "That code didn't work. Use the 6 digits from your app, or a backup code." }, { status: 400 });

  if (data.action === "disable") {
    await db.creator.update({
      where: { id: creator.id },
      data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: [] },
    });
    return NextResponse.json({ enabled: false });
  }

  const { plain, stored } = await makeBackupCodes();
  await db.creator.update({ where: { id: creator.id }, data: { twoFactorBackupCodes: stored as unknown as Prisma.InputJsonValue } });
  return NextResponse.json({ enabled: true, backupCodes: plain });
}
