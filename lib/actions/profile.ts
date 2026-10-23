"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { addDays, format } from "date-fns";
import { createRecurringItem } from "@/lib/actions/recurring";
import { requireUser } from "@/lib/auth";
import { formatAmountInput } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import {
  balanceSettingsSchema,
  onboardingSchema,
  type BalanceSettingsInput,
  profileSchema,
  type OnboardingInput,
  type ProfileInput,
} from "@/lib/validators";

export type ProfileActionResult = { status: "error"; error: string };

/** Name and financial-month start, from Ajustes. Periods recompute on the next read. */
export async function updateProfile(
  input: ProfileInput,
): Promise<{ status: "ok" } | ProfileActionResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { status: "error", error: "invalidInput" };

  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      month_start_day: parsed.data.monthStartDay,
    })
    .eq("id", user.id);
  if (error) return { status: "error", error: "saveFailed" };

  revalidatePath("/app", "layout");
  return { status: "ok" };
}

/** Whether earlier months' leftover carries into "Disponível agora", and from what opening balance. */
export async function updateBalanceSettings(
  input: BalanceSettingsInput,
): Promise<{ status: "ok" } | ProfileActionResult> {
  const parsed = balanceSettingsSchema.safeParse(input);
  if (!parsed.success) return { status: "error", error: "invalidInput" };

  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      carry_over: parsed.data.carryOver,
      opening_balance_cents: parsed.data.openingBalance,
    })
    .eq("id", user.id);
  if (error) return { status: "error", error: "saveFailed" };

  revalidatePath("/app", "layout");
  return { status: "ok" };
}

export async function completeOnboarding(input: OnboardingInput): Promise<ProfileActionResult> {
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) return { status: "error", error: "invalidInput" };

  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      primary_currency: parsed.data.primaryCurrency,
      month_start_day: parsed.data.monthStartDay,
      // New accounts track a running balance from what they start with (0 if skipped).
      carry_over: true,
      opening_balance_cents: parsed.data.openingBalance,
      onboarding_done: true,
    })
    .eq("id", user.id);

  if (error) return { status: "error", error: "saveFailed" };

  // Salary and rent, if given, become fixed items (after the profile, whose
  // currency and month they are planned in). If one fails the account is
  // still set up: land on Fixos, where it can be added by hand.
  const t = await getTranslations("Onboarding.fixed");
  const { salary, salaryDay, rent, rentDay, primaryCurrency } = parsed.data;
  const items = [
    salary && {
      type: "income" as const,
      kind: "income",
      name: t("salaryName"),
      cents: salary,
      day: salaryDay,
    },
    rent && {
      type: "expense" as const,
      kind: "fixed",
      name: t("rentName"),
      cents: rent,
      day: rentDay,
    },
  ].filter((item) => !!item);
  // From tomorrow: the balance just typed ("Quanto você tem hoje?") already
  // includes this month's salary or rent if they were due, so counting them
  // again would add them twice.
  const startOn = format(addDays(new Date(), 1), "yyyy-MM-dd");
  for (const item of items) {
    const result = await createRecurringItem({
      type: item.type,
      name: item.name,
      amount: formatAmountInput(item.cents),
      currency: primaryCurrency,
      categoryId: (await defaultCategoryId(item.kind, item.name)) ?? "",
      frequency: "monthly",
      dayOfMonth: String(item.day ?? 1),
      startOn,
    });
    if (result.status === "error") redirect("/app/fixed");
  }
  redirect("/app");
}

/** The category named like the item ("Salário", "Aluguel"), else the first of its kind. */
async function defaultCategoryId(kind: string, name: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("id, name")
    .eq("kind", kind)
    .eq("archived", false)
    .order("sort_order");
  return (data?.find((c) => c.name === name) ?? data?.[0])?.id ?? null;
}
