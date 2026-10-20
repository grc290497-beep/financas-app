import { loadEnvConfig } from "@next/env";
import { defineConfig, devices } from "@playwright/test";

// Same env as `next dev` (.env.local), so the tests can reach Supabase.
loadEnvConfig(process.cwd());

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    locale: "pt-BR",
    trace: "retain-on-failure",
  },
  projects: [{ name: "mobile", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
