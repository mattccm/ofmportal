/**
 * Runtime check for environment variables production can't work without.
 *
 * Fails loudly but not closed: missing values are reported with console.error
 * (which Sentry captures) and the app keeps running, so a single missing value
 * never takes prod down. Only runs on Vercel production at runtime, never
 * during `next build` or in preview/dev.
 */

const CRITICAL_ENV_VARS = [
  "DATABASE_URL",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "APP_URL",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "RESEND_API_KEY",
  "CRON_SECRET",
] as const;

let checked = false;

export function checkCriticalEnv(): void {
  if (checked) return;
  checked = true;

  if (process.env.VERCEL_ENV !== "production") return;
  // Skip during the build step; only check the running server
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const isSet = (name: string) => Boolean(process.env[name]?.trim());
  const missing: string[] = CRITICAL_ENV_VARS.filter((name) => !isSet(name));
  // Storage needs either an account ID or an explicit endpoint (see lib/storage.ts)
  if (!isSet("R2_ACCOUNT_ID") && !isSet("R2_ENDPOINT")) {
    missing.push("R2_ACCOUNT_ID or R2_ENDPOINT");
  }

  if (missing.length > 0) {
    console.error(
      `[env] Missing critical environment variables in production: ${missing.join(", ")}. ` +
        "Features depending on them will fail until they are set in Vercel."
    );
  }
}
