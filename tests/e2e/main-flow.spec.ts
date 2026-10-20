import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

// PLAN.md phase 7: sign in → onboarding → transaction → goal, on a
// throwaway user. The only database is production, so the user is created
// already confirmed (no email is sent) and deleted afterwards; every table
// cascades from auth.users.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin =
  url && serviceKey
    ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;

const email = `e2e-${randomUUID()}@example.com`;
const password = randomUUID();
let userId: string | undefined;

test.skip(!admin, "SUPABASE_SERVICE_ROLE_KEY is not set in .env.local");

test.beforeAll(async () => {
  const { data, error } = await admin!.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: "E2E" },
  });
  if (error) throw error;
  userId = data.user.id;
});

test.afterAll(async () => {
  if (userId) await admin!.auth.admin.deleteUser(userId);
});

test("sign in, set up, log an expense and create a goal", async ({ page }) => {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();

  await expect(page).toHaveURL(/\/onboarding/);
  // Clicks before hydration do nothing in the client-side wizard: wait for the network to settle.
  await page.waitForLoadState("networkidle");
  await page.getByText("Euro", { exact: true }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  // Step 2 must be shown, not skipped by an early submit (the bug this caught).
  await expect(page.getByText("Em que dia começa o seu mês?")).toBeVisible();
  await page.getByRole("button", { name: "Concluir" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: "Novo lançamento" }).first().click();
  await page.getByLabel("Valor").fill("12,50");
  await page.getByRole("radio", { name: "Mercado" }).click();
  await page.getByLabel("Descrição").fill("Pão");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Lançamento salvo.")).toBeVisible();

  await page.goto("/app/transactions");
  await expect(page.getByText("Pão", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("€ 12,50").first()).toBeVisible();

  await page.goto("/app/goals");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Nova meta" }).first().click();
  await page.getByLabel("Nome").fill("Reserva de emergência");
  await page.getByLabel("Quanto quer juntar").fill("6000");
  const nextYear = new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10);
  await page.getByLabel("Até quando").fill(nextYear);
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Meta criada.")).toBeVisible();
  await expect(page.getByText("Reserva de emergência")).toBeVisible();
});
