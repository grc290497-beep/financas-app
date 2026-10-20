"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { budgetSchema, type BudgetInput } from "@/lib/validators";

// Error values are keys under "Budget.errors" in messages/pt-BR.json.
export type BudgetActionResult = { status: "ok" } | { status: "error"; error: string };

export async function setCategoryBudget(input: BudgetInput): Promise<BudgetActionResult> {
  const parsed = budgetSchema.safeParse(input);
  if (!parsed.success) return { status: "error", error: "invalidInput" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .update({ monthly_budget_cents: parsed.data.amount })
    .eq("id", parsed.data.categoryId)
    .neq("kind", "income")
    .select("id");
  if (error || !data.length) return { status: "error", error: "saveFailed" };

  revalidatePath("/app", "layout");
  return { status: "ok" };
}
