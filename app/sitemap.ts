import type { MetadataRoute } from "next";
import { publicSiteOrigin } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = publicSiteOrigin();
  return ["", "/signup", "/login", "/privacy", "/terms"].map((path) => ({
    url: `${origin}${path}`,
  }));
}
