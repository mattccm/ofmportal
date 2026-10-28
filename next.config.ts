import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Self-contained server build for containerized (Railway/Docker) deploys.
  // Skipped on Vercel, which manages its own build output, and on Windows,
  // where traced chunk names like "node:inspector" are invalid file names.
  output: process.env.VERCEL || process.platform === "win32" ? undefined : "standalone",
  // Pin the tracing root to this project (a stray parent lockfile can otherwise
  // make Next misdetect the workspace root and nest the standalone output).
  outputFileTracingRoot: __dirname,
  // Increase body size limit for API routes (templates with rich content can be large)
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // Older notifications/emails linked creators to /portal and /portal/requests/<id>,
  // which have no pages; send them to the creator area instead.
  async redirects() {
    return [
      { source: "/portal", destination: "/creator/dashboard", permanent: false },
      { source: "/portal/requests", destination: "/creator/requests", permanent: false },
      { source: "/portal/requests/:id", destination: "/creator/requests/:id", permanent: false },
      // Reminder settings moved to the Reminders page
      { source: "/dashboard/settings/reminder-rules", destination: "/dashboard/reminders?tab=timing", permanent: false },
      { source: "/dashboard/settings/creator-messages", destination: "/dashboard/reminders?tab=texts", permanent: false },
      { source: "/dashboard/settings/sms", destination: "/dashboard/reminders?tab=setup", permanent: false },
      { source: "/dashboard/settings/email-templates", destination: "/dashboard/reminders?tab=wording", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // Sentry organization and project (set via env vars)
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Only upload source maps in CI/production builds
  silent: !process.env.CI,

  // Automatically tree-shake Sentry logger in production
  disableLogger: true,

  // Hide source maps from clients
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
});
