import { randomBytes } from "crypto";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { hashPassword, verifyPassword, verifyTwoFactorCode } from "./auth";

/**
 * Two-step sign-in for creators: after their password, a 6-digit code from an
 * authenticator app, or one of their single-use backup codes (XXXX-XXXX).
 * Same codes and apps as staff two-step sign-in. Server only.
 */

interface StoredCode {
  code: string;
  used: boolean;
  usedAt?: string;
}

/** New backup codes: the plain ones to show once, and what's stored (hashed) */
export async function makeBackupCodes(count = 8): Promise<{ plain: string[]; stored: StoredCode[] }> {
  const plain = Array.from({ length: count }, () => {
    const hex = randomBytes(4).toString("hex").toUpperCase();
    return `${hex.slice(0, 4)}-${hex.slice(4)}`;
  });
  const stored = await Promise.all(plain.map(async (c) => ({ code: await hashPassword(c), used: false })));
  return { plain, stored };
}

export const backupCodesLeft = (stored: unknown) => (Array.isArray(stored) ? (stored as StoredCode[]).filter((c) => !c.used).length : 0);

/**
 * Is this the creator's second step? A current authenticator code, or an unused
 * backup code (which is then used up).
 */
export async function checkCreatorCode(
  creator: { id: string; twoFactorSecret: string | null; twoFactorBackupCodes: unknown },
  raw: string
): Promise<{ ok: boolean; usedBackup?: boolean }> {
  const code = raw.trim().toUpperCase();
  if (creator.twoFactorSecret && /^\d{6}$/.test(code) && verifyTwoFactorCode(creator.twoFactorSecret, code)) return { ok: true };
  if (!/^[0-9A-F]{4}-?[0-9A-F]{4}$/.test(code)) return { ok: false };
  const wanted = code.includes("-") ? code : `${code.slice(0, 4)}-${code.slice(4)}`;
  const codes = Array.isArray(creator.twoFactorBackupCodes) ? (creator.twoFactorBackupCodes as StoredCode[]) : [];
  for (let i = 0; i < codes.length; i++) {
    if (codes[i].used) continue;
    if (await verifyPassword(wanted, codes[i].code)) {
      const next = codes.map((c, j) => (j === i ? { ...c, used: true, usedAt: new Date().toISOString() } : c));
      await db.creator.update({ where: { id: creator.id }, data: { twoFactorBackupCodes: next as unknown as Prisma.InputJsonValue } });
      return { ok: true, usedBackup: true };
    }
  }
  return { ok: false };
}
