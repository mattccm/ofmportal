/**
 * Absolute base URL of the app (no trailing slash) for links in emails, SMS and QR codes.
 * Prefers APP_URL, then NEXT_PUBLIC_APP_URL, NEXTAUTH_URL and Vercel's deployment URL,
 * so a link is never built as "undefined/...".
 */
export function getAppUrl(): string {
  const url =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000");
  return url.replace(/\/+$/, "");
}
