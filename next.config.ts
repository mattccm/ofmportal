import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Increase body size limit for API routes (templates with rich content can be large)
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
