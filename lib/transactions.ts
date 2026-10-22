import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { format, subDays } from "date-fns";
import type { Category, CategoryKind } from "@/lib/categories";
import type { MonthSummary } from "@/lib/dashboard";
import type { Period } from "@/lib/period";
import { createClient } from "@/lib/supabase/server";
import type { Currency, TransactionFilters, TransactionType } from "@/lib/validators";

// Data Access Layer for transactions. RLS limits every query to the user's rows.

export type TransactionRow = {
  id: string;
  type: TransactionType;
  categoryId: string;
  description: string | null;
  amountCents: number;
  currency: Currency;
  fxRate: string;
  amountPrimaryCents: number;
  occurredOn: string;
  status: "planned" | "confirmed";
  recurringItemId: string | null;
  category: Pick<Category, "name" | "icon" | "color">;
};

/** Today (yyyy-MM-dd, UTC). Request time only. */
export async function currentDate(): Promise<string> {
  await connection();
  return new Date().toISOString().slice(0, 10);
}

/** Totals for the dashboard (month_summary in SQL), in the primary currency. */
export async function getMonthSummary(period: Period): Promise<MonthSummary> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("month_summary", { p_start: period.start, p_end: period.end })
    .single<Record<string, number>>();
  if (error) throw error;
  return {
    incomeCents: Number(data.income_cents),
    expenseCents: Number(data.expense_cents),
    fixedPlannedCents: Number(data.fixed_planned_cents),
    variableSpentCents: Number(data.variable_spent_cents),
  };
}

/** Confirmed income minus expenses before `date` (balance_before in SQL), in the primary currency. */
export async function getBalanceBefore(date: string): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("balance_before", { p_before: date });
  if (error) throw error;
  return Number(data);
}

export type CategorySpend = Category & {
  budgetCents: number | null;
  spentCents: number;
  plannedCents: number;
};

/** Every active expense category with what was paid and planned in the period. */
export async function getCategorySpend(period: Period): Promise<CategorySpend[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("category_spend", {
    p_start: period.start,
    p_end: period.end,
  });
  if (error) throw error;
  return (data as Record<string, string | number | null>[]).map((row) => ({
    id: String(row.category_id),
    name: String(row.name),
    kind: row.kind as CategoryKind,
    icon: row.icon as string | null,
    color: row.color as string | null,
    budgetCents: row.budget_cents === null ? null : Number(row.budget_cents),
    spentCents: Number(row.spent_cents),
    plannedCents: Number(row.planned_cents),
  }));
}

export const getCategories = cache(async (): Promise<Category[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, kind, icon, color")
    .eq("archived", false)
    .order("kind")
    .order("sort_order");
  if (error) throw error;
  return data.map((c) => ({ ...c, kind: c.kind as CategoryKind }));
});

/** Every category, hidden ones included, for the Categorias page. */
export async function listAllCategories(): Promise<(Category & { archived: boolean })[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, kind, icon, color, archived")
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return data.map((c) => ({ ...c, kind: c.kind as CategoryKind }));
}

/** How often each category was used in the last 90 days. */
export const getCategoryUsage = cache(async (): Promise<Record<string, number>> => {
  await connection(); // reads the clock: request time only
  const supabase = await createClient();
  const since = format(subDays(new Date(), 90), "yyyy-MM-dd");
  const { data, error } = await supabase
    .from("transactions")
    .select("category_id")
    .neq("status", "skipped")
    .gte("occurred_on", since)
    .limit(1000);
  if (error) throw error;
  const usage: Record<string, number> = {};
  for (const { category_id } of data) usage[category_id] = (usage[category_id] ?? 0) + 1;
  return usage;
});

export async function listTransactions(
  filters: TransactionFilters,
  { start: from, end: to }: Period,
  limit = 500,
): Promise<TransactionRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("transactions")
    .select(
      "id, type, category_id, description, amount_cents, currency, fx_rate, amount_primary_cents, occurred_on, status, recurring_item_id, categories (name, icon, color)",
    )
    .neq("status", "skipped") // removed fixed-cost occurrences (see deleteTransaction)
    .gte("occurred_on", from)
    .lte("occurred_on", to)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filters.type) query = query.eq("type", filters.type);
  if (filters.currency) query = query.eq("currency", filters.currency);
  if (filters.category) query = query.eq("category_id", filters.category);
  if (filters.q) query = query.ilike("description", `%${escapeLike(filters.q)}%`);

  const { data, error } = await query;
  if (error) throw error;

  return data.map((t) => ({
    id: t.id,
    type: t.type as TransactionType,
    categoryId: t.category_id,
    description: t.description,
    amountCents: Number(t.amount_cents),
    currency: t.currency as Currency,
    fxRate: String(t.fx_rate),
    amountPrimaryCents: Number(t.amount_primary_cents),
    occurredOn: t.occurred_on,
    status: t.status as TransactionRow["status"],
    recurringItemId: t.recurring_item_id,
    category: t.categories as unknown as TransactionRow["category"],
  }));
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}
