"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { FxUnavailableError, convertToPrimary, getRate } from "@/lib/fx";
import { serverFxDeps } from "@/lib/fx-cache";
import { createClient } from "@/lib/supabase/server";
import {
  contributionSchema,
  goalSchema,
  type ContributionInput,
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
  // Contributions go with it (on delete cascade).
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

  const supabase = await createClient();
  const { data: goal } = await supabase
    .from("goals")
    .select("currency")
    .eq("id", parsedId.data)
    .maybeSingle();
  if (!goal) return { status: "error", error: "notFound" };

  const { amount, currency, contributedOn, note, kind } = parsed.data;
  let rate = "1";
  if (currency !== goal.currency) {
    try {
      rate = (
        await getRate(
          { from: currency, to: goal.currency, date: contributedOn },
          await serverFxDeps(),
        )
      ).rate;
    } catch (error) {
      if (error instanceof FxUnavailableError) return { status: "error", error: "fxUnavailable" };
      throw error;
    }
  }
  const { fxRate, amountPrimaryCents } = convertToPrimary(amount, currency, goal.currency, rate);
  const sign = kind === "withdrawal" ? -1 : 1;

  const { error } = await supabase.from("goal_contributions").insert({
    goal_id: parsedId.data,
    amount_cents: sign * amount,
    currency,
    fx_rate: fxRate,
    amount_goal_cents: sign * amountPrimaryCents,
    contributed_on: contributedOn,
    note,
  });
  if (error) return { status: "error", error: "saveFailed" };

  revalidatePath("/app", "layout");
  return { status: "ok" };
}

export async function deleteContribution(id: string): Promise<GoalActionResult> {
  const parsedId = z.uuid().safeParse(id);
  if (!parsedId.success) return { status: "error", error: "invalidInput" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goal_contributions")
    .delete()
    .eq("id", parsedId.data)
    .select("id");
  if (error) return { status: "error", error: "deleteFailed" };
  if (!data.length) return { status: "error", error: "notFound" };

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
