type SiteEnv = {
  NEXT_PUBLIC_SITE_URL?: string;
  VERCEL_ENV?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
};

/**
 * Origin used in links sent by email (signup confirmation, magic link).
 * It must not follow the request host: the app can be reached through
 * team-only Vercel domains that sit behind Vercel's login, and a link to one
 * of those breaks when opened from an email client.
 */
export function resolveSiteOrigin(env: SiteEnv, requestOrigin: string): string {
  const configured = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }
  if (env.VERCEL_ENV === "production" && env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return requestOrigin;
}

/** The public origin outside a request (link previews, robots, sitemap); localhost in dev. */
export function publicSiteOrigin(): string {
  return resolveSiteOrigin(
    {
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
      VERCEL_ENV: process.env.VERCEL_ENV,
      VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
    },
    "http://localhost:3000",
  );
}
