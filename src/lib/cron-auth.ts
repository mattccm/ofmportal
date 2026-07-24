import crypto from "crypto";

/**
 * Verify a cron request's Authorization header against CRON_SECRET
 * using a constant-time comparison. Fails closed when CRON_SECRET is unset.
 */
export function verifyCronAuth(authHeader: string | null): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || !authHeader) return false;

  const expected = Buffer.from(`Bearer ${cronSecret}`);
  const actual = Buffer.from(authHeader);

  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}
