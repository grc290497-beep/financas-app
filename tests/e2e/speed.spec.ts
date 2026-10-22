import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

// Speed check: time from navigation until the page's loading skeletons are
// gone, three rounds per page, on a throwaway user that is deleted afterwards.
// Run against the deployed site:
//   $env:E2E_BASE_URL = "https://financas-app-tau-bice.vercel.app"; npx playwright test speed

const PAGES = [
  "/app",
  "/app/transactions",
  "/app/fixed",
  "/app/goals",
  "/app/reports",
  "/app/budget",
];
const ROUNDS = 3;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin =
  url && serviceKey
    ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;

const email = `e2e-${randomUUID()}@example.com`;
const password = randomUUID();
let userId: string | undefined;

test.skip(!admin || !process.env.E2E_BASE_URL, "needs E2E_BASE_URL and the service role key");
test.setTimeout(240_000);

test.beforeAll(async () => {
  const { data, error } = await admin!.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: "Speed" },
  });
  if (error) throw error;
  userId = data.user.id;
  // Skip the onboarding wizard; it is not what is being measured.
  await admin!.from("profiles").update({ onboarding_done: true }).eq("id", userId);
});

test.afterAll(async () => {
  if (userId) await admin!.auth.admin.deleteUser(userId);
});

test("page load times", async ({ page }) => {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/app/);

  const times: Record<string, number[]> = {};
  for (let round = 0; round < ROUNDS; round++) {
    for (const path of PAGES) {
      const start = Date.now();
      await page.goto(path);
      await page.waitForFunction(() => !document.querySelector('[data-slot="skeleton"]'), null, {
        timeout: 60_000,
      });
      (times[path] ??= []).push(Date.now() - start);
    }
  }

  const rows = PAGES.map((path) => {
    const t = times[path];
    return `${path.padEnd(18)} ${t.map((ms) => `${ms}ms`.padStart(7)).join(" ")}   média ${Math.round(t.reduce((a, b) => a + b, 0) / t.length)}ms`;
  });
  console.log(`\nSPEED ${process.env.E2E_BASE_URL}\n${rows.join("\n")}`);
});
