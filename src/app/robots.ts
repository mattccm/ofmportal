import type { MetadataRoute } from "next";

// Internal tool: keep every page out of search engines. The pages people paste
// into chats (sign in, invites) and their preview pictures stay fetchable so
// chat apps can show a link preview; every page still carries noindex.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/og/", "/login", "/join/", "/portal/setup/", "/i/"],
      disallow: "/",
    },
  };
}
