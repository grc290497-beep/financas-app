import type { MetadataRoute } from "next";
import { publicSiteOrigin } from "@/lib/site";

// The public pages may be indexed; the app itself is private and behind login.
export default function robots(): MetadataRoute.Robots {
  const origin = publicSiteOrigin();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/app", "/onboarding", "/auth", "/reset-password"],
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
