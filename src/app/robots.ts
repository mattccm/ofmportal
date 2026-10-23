import type { MetadataRoute } from "next";

// Internal tool: keep every page out of search engines
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
