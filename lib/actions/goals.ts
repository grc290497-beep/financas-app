"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { FxUnavailableError, convertToPrimary, getRate } from "@/lib/fx";
import { serverFxDeps } from "@/lib/fx-cache";
import { createClient } from "@/lib/supabase/server";
import {
  contributionSchema,
  goalSchema,
  type ContributionInput,
  type Currency,
  type GoalInput,
} from "@/lib/validators";

// Error values are keys under "Goals.errors" in messages/pt-BR.json.
export type GoalActionResult = { status: "ok"; id?: string } | { status: "error"; error: string };

export async function createGoal(input: GoalInput): Promise<GoalActionResult> {
  const parsed = goalSchema.safeParse(input);
  if (!parsed.success) return { status: "error", error: "invalidInput" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goals")
    .insert({ ...toRow(parsed.data), currency: parsed.data.currency })
    .select("id")
    .single();
  if (error) return { status: "error", error: "saveFailed" };

  revalidatePath("/app", "layout");
  return { status: "ok", id: data.id };
}

export async function updateGoal(id: string, input: GoalInput): Promise<GoalActionResult> {
  const parsedId = z.uuid().safeParse(id);
  const parsed = goalSchema.safeParse(input);
  if (!parsedId.success || !parsed.success) return { status: "error", error: "invalidInput" };

  const supabase = await createClient();
  // toRow leaves the currency out: it is fixed once created, since
  // contributions are stored converted into it.
  const { data, error } = await supabase
    .from("goals")
    .update(toRow(parsed.data))
    .eq("id", parsedId.data)
    .select("id");
  if (error) return { status: "error", error: "saveFailed" };
  if (!data.length) return { status: "error", error: "notFound" };

  revalidatePath("/app", "layout");
  return { status: "ok" };
}

export async function setGoalStatus(
  id: string,
  status: "active" | "done" | "archived",
): Promise<GoalActionResult> {
  const parsed = z
    .object({ id: z.uuid(), status: z.enum(["active", "done", "archived"]) })
    .safeParse({ id, status });
  if (!parsed.success) return { status: "error", error: "invalidInput" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goals")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id)
    .select("id");
  if (error) return { status: "error", error: "saveFailed" };
  if (!data.length) return { status: "error", error: "notFound" };

  revalidatePath("/app", "layout");
  return { status: "ok" };
}

export async function deleteGoal(id: string): Promise<GoalActionResult> {
  const parsedId = z.uuid().safeParse(id);
  if (!parsedId.success) return { status: "error", error: "invalidInput" };

  const supabase = await createClient();
  // Its contributions' transactions go first, so "Disponível agora" gets the money back.
  const { data: linked } = await supabase
    .from("goal_contributions")
    .select("transaction_id")
    .eq("goal_id", parsedId.data)
    .not("transaction_id", "is", null);
  const transactionIds = (linked ?? []).map((c) => c.transaction_id as string);
  if (transactionIds.length) {
    const { error: entriesError } = await supabase
      .from("transactions")
      .delete()
      .in("id", transactionIds);
    if (entriesError) return { status: "error", error: "deleteFailed" };
  }
  // The remaining contributions go with the goal (on delete cascade).
  const { data, error } = await supabase
    .from("goals")
    .delete()
    .eq("id", parsedId.data)
    .select("id");
  if (error) return { status: "error", error: "deleteFailed" };
  if (!data.length) return { status: "error", error: "notFound" };

  revalidatePath("/app", "layout");
  redirect("/app/goals");
}

/** A deposit or a withdrawal, converted into the goal's currency at that date's rate. */
export async function addContribution(
  goalId: string,
  input: ContributionInput,
): Promise<GoalActionResult> {
  const parsedId = z.uuid().safeParse(goalId);
  const parsed = contributionSchema.safeParse(input);
  if (!parsedId.success || !parsed.success) return { status: "error", error: "invalidInput" };

  const [supabase, profile] = await Promise.all([createClient(), requireProfile()]);
  const { data: goal } = await supabase
    .from("goals")
    .select("currency, name")
    .eq("id", parsedId.data)
    .maybeSingle();
  if (!goal) return { status: "error", error: "notFound" };

  const { amount, currency, contributedOn, note, kind } = parsed.data;
  // Two conversions: into the goal's currency (its progress) and into the
  // primary currency (the transaction that moves the money).
  let toGoal: string;
  let toPrimary: string;
  try {
    [toGoal, toPrimary] = await Promise.all([
      rateOn(currency, goal.currency as Currency, contributedOn),
      rateOn(currency, profile.primaryCurrency, contributedOn),
    ]);
  } catch (error) {
    if (error instanceof FxUnavailableError) return { status: "error", error: "fxUnavailable" };
    throw error;
  }
  const inGoal = convertToPrimary(amount, currency, goal.currency as Currency, toGoal);
  const inPrimary = convertToPrimary(amount, currency, profile.primaryCurrency, toPrimary);
  const sign = kind === "withdrawal" ? -1 : 1;

  const categoryId = await savingsCategoryId();
  if (!categoryId) return { status: "error", error: "saveFailed" };
  const t = await getTranslations("Goals");

  // Saving into a goal is money leaving "Disponível agora"; withdrawing brings it back.
  const { data: entry, error: entryError } = await supabase
    .from("transactions")
    .insert({
      type: kind === "withdrawal" ? "income" : "expense",
      category_id: categoryId,
      description: t("entryDescription", { name: goal.name }).slice(0, 140),
      amount_cents: amount,
      currency,
      fx_rate: inPrimary.fxRate,
      amount_primary_cents: inPrimary.amountPrimaryCents,
      occurred_on: contributedOn,
    })
    .select("id")
    .single();
  if (entryError) return { status: "error", error: "saveFailed" };

  const { error } = await supabase.from("goal_contributions").insert({
    goal_id: parsedId.data,
    amount_cents: sign * amount,
    currency,
    fx_rate: inGoal.fxRate,
    amount_goal_cents: sign * inGoal.amountPrimaryCents,
    contributed_on: contributedOn,
    note,
    transaction_id: entry.id,
  });
  if (error) {
    // No transactions across the two inserts: undo the entry by hand.
    await supabase.from("transactions").delete().eq("id", entry.id);
    return { status: "error", error: "saveFailed" };
  }

  revalidatePath("/app", "layout");
  return { status: "ok" };
}

async function rateOn(from: Currency, to: Currency, date: string): Promise<string> {
  if (from === to) return "1";
  return (await getRate({ from, to, date }, await serverFxDeps())).rate;
}

/** The first savings category (Reserva by default), recreated if the user removed them all. */
async function savingsCategoryId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("id")
    .eq("kind", "savings")
    .order("archived")
    .order("sort_order")
    .limit(1)
    .maybeSingle();
  if (data) return data.id;
  const { data: created } = await supabase
    .from("categories")
    .insert({
      name: "Reserva",
      kind: "savings",
      icon: "piggy-bank",
      color: "#10b981",
      sort_order: 1,
    })
    .select("id")
    .single();
  return created?.id ?? null;
}

export async function deleteContribution(id: string): Promise<GoalActionResult> {
  const parsedId = z.uuid().safeParse(id);
  if (!parsedId.success) return { status: "error", error: "invalidInput" };

  const supabase = await createClient();
  const { data: contribution } = await supabase
    .from("goal_contributions")
    .select("transaction_id")
    .eq("id", parsedId.data)
    .maybeSingle();
  if (!contribution) return { status: "error", error: "notFound" };

  // Deleting the transaction takes the contribution with it (on delete cascade).
  const { error } = contribution.transaction_id
    ? await supabase.from("transactions").delete().eq("id", contribution.transaction_id)
    : await supabase.from("goal_contributions").delete().eq("id", parsedId.data);
  if (error) return { status: "error", error: "deleteFailed" };

  revalidatePath("/app", "layout");
  return { status: "ok" };
}

function toRow(data: z.output<typeof goalSchema>) {
  return {
    name: data.name,
    target_cents: data.target,
    initial_cents: data.initial,
    deadline: data.deadline,
    icon: data.icon,
    color: data.color,
  };
}
