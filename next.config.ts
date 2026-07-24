import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Self-contained server build for containerized (Railway) deploys
  output: "standalone",
  // Pin the tracing root to this project (a stray parent lockfile can otherwise
  // make Next misdetect the workspace root and nest the standalone output).
  outputFileTracingRoot: __dirname,
  // Increase body size limit for API routes (templates with rich content can be large)
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
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
