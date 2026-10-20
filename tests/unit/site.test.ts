import { describe, expect, it } from "vitest";
import { resolveSiteOrigin } from "@/lib/site";

const teamDomain = "https://financas-app-team.vercel.app";

describe("resolveSiteOrigin", () => {
  it("prefers NEXT_PUBLIC_SITE_URL over the request host", () => {
    expect(
      resolveSiteOrigin({ NEXT_PUBLIC_SITE_URL: "https://financas.example" }, teamDomain),
    ).toBe("https://financas.example");
  });

  it("strips trailing slashes from the configured URL", () => {
    expect(
      resolveSiteOrigin({ NEXT_PUBLIC_SITE_URL: "https://financas.example//" }, teamDomain),
    ).toBe("https://financas.example");
  });

  it("falls back to Vercel's production domain in production", () => {
    expect(
      resolveSiteOrigin(
        { VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "financas-app.vercel.app" },
        teamDomain,
      ),
    ).toBe("https://financas-app.vercel.app");
  });

  it("uses the request origin in preview and local development", () => {
    expect(
      resolveSiteOrigin(
        { VERCEL_ENV: "preview", VERCEL_PROJECT_PRODUCTION_URL: "financas-app.vercel.app" },
        teamDomain,
      ),
    ).toBe(teamDomain);
    expect(resolveSiteOrigin({}, "http://localhost:3000")).toBe("http://localhost:3000");
  });

  it("ignores a blank configured URL", () => {
    expect(resolveSiteOrigin({ NEXT_PUBLIC_SITE_URL: "  " }, "http://localhost:3000")).toBe(
      "http://localhost:3000",
    );
  });
});
