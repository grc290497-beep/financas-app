import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

// Phases 9–C features on one throwaway user, in order: carried-over balance,
// goals that move money, categories, search across months, undo on delete and
// the install button. Same setup as main-flow: created confirmed, deleted after.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin =
  url && serviceKey
    ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;

const email = `e2e-${randomUUID()}@example.com`;
const password = randomUUID();
let userId: string | undefined;

const today = new Date().toISOString().slice(0, 10);
const now = new Date();
const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 10))
  .toISOString()
  .slice(0, 10);

test.skip(!admin, "SUPABASE_SERVICE_ROLE_KEY is not set in .env.local");
test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const { data, error } = await admin!.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: "E2E" },
  });
  if (error) throw error;
  userId = data.user.id;
  // Skip onboarding; start from a known balance that carries over.
  const { error: profileError } = await admin!
    .from("profiles")
    .update({ onboarding_done: true, carry_over: true, opening_balance_cents: 100_000 })
    .eq("id", userId);
  if (profileError) throw profileError;
});

test.afterAll(async () => {
  if (userId) await admin!.auth.admin.deleteUser(userId);
});

async function signIn(page: Page) {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.waitForLoadState("networkidle");
}

async function addExpense(
  page: Page,
  {
    amount,
    category,
    description,
    date,
  }: Record<"amount" | "category" | "description" | "date", string>,
) {
  await page.goto("/app?novo=1");
  await page.waitForLoadState("networkidle");
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Valor").fill(amount);
  await sheet.getByRole("radio", { name: category }).click();
  await sheet.getByLabel("Descrição").fill(description);
  await sheet.getByLabel("Data").fill(date);
  await sheet.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Lançamento salvo.")).toBeVisible();
}

// Next.js keeps an earlier visit of the page in the DOM, hidden: take the visible card.
const available = (page: Page) =>
  page.locator("section[aria-labelledby=available]").filter({ visible: true });

test("what was left last month carries into Disponível agora", async ({ page }) => {
  await signIn(page);
  await addExpense(page, {
    amount: "100",
    category: "Mercado",
    description: "Feira",
    date: lastMonth,
  });

  await page.goto("/app");
  // € 1.000 opening balance − € 100 spent last month.
  await expect(available(page)).toContainText("€ 900,00");
  await expect(available(page)).toContainText("Inclui € 900,00 de saldo anterior");
});

test("a goal contribution takes money out of Disponível agora, and deleting it puts it back", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/app/goals");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Nova meta" }).first().click();
  await page.getByLabel("Nome").fill("Viagem");
  await page.getByLabel("Quanto quer juntar").fill("3000");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Meta criada.")).toBeVisible();
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: "Aportar" }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Valor").fill("200");
  await sheet.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Aporte registrado.")).toBeVisible();

  await page.goto("/app");
  await expect(available(page)).toContainText("€ 700,00");
  await expect(page.getByText("Meta · Viagem").first()).toBeVisible();

  await page.goto("/app/goals");
  await page.getByRole("link", { name: /Viagem/ }).click();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /Excluir aporte/ }).click();
  await expect(page.getByText("Aporte excluído.")).toBeVisible();

  await page.goto("/app");
  await expect(available(page)).toContainText("€ 900,00");
});

test("a new category shows in quick add and a hidden one does not", async ({ page }) => {
  await signIn(page);
  await page.goto("/app/categories");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Nova categoria" }).click();
  await page.getByLabel("Nome").fill("Pets");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Categoria criada.")).toBeVisible();
  await page.getByRole("button", { name: "Esconder Viagens" }).click();
  await expect(page.getByText("Categoria escondida.")).toBeVisible();

  await page.goto("/app?novo=1");
  await page.waitForLoadState("networkidle");
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("radio", { name: "Pets" })).toBeVisible();
  await expect(sheet.getByRole("radio", { name: "Viagens" })).toHaveCount(0);
});

test("search looks through every month", async ({ page }) => {
  await signIn(page);
  await addExpense(page, {
    amount: "13,99",
    category: "Assinaturas",
    description: "Netflix",
    date: today,
  });
  await addExpense(page, {
    amount: "13,99",
    category: "Assinaturas",
    description: "Netflix",
    date: lastMonth,
  });

  await page.goto("/app/transactions?q=netflix");
  await expect(page.getByText("Buscando em todos os meses · 2 resultados")).toBeVisible();
});

test("Desfazer brings a deleted entry back", async ({ page }) => {
  await signIn(page);
  await addExpense(page, { amount: "7", category: "Lazer", description: "Cinema", date: today });

  await page.goto("/app/transactions");
  await page.waitForLoadState("networkidle");
  await page.getByText("Cinema", { exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Excluir" }).click();
  await expect(page.getByText("Cinema", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Desfazer" }).click();
  await expect(page.getByText("Cinema", { exact: true })).toBeVisible();

  // Past the toast's 5 s: nothing was deleted.
  await page.waitForTimeout(6_000);
  await page.reload();
  await expect(page.getByText("Cinema", { exact: true })).toBeVisible();
});

test("Instalar app only shows when the browser can install", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const install = page.getByRole("button", { name: "Instalar app" });
  await expect(install).toHaveCount(0);

  // What Chrome fires when the site is installable.
  await page.evaluate(() => {
    const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt: async () => {},
      userChoice: new Promise(() => {}),
    });
    window.dispatchEvent(event);
  });
  await expect(install.first()).toBeVisible();
});
