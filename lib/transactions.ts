import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { endOfMonth, format, parse, subDays } from "date-fns";
import type { Category, CategoryKind } from "@/lib/categories";
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
  category: Pick<Category, "name" | "icon" | "color">;
};

/** Calendar month for now; the financial month (month_start_day) arrives with lib/period.ts in phase 4. */
/** The current calendar month (yyyy-MM). Request time only. */
export async function currentMonth(): Promise<string> {
  await connection();
  return format(new Date(), "yyyy-MM");
}

export function monthRange(month: string): { from: string; to: string } {
  const start = parse(`${month}-01`, "yyyy-MM-dd", new Date());
  return { from: format(start, "yyyy-MM-dd"), to: format(endOfMonth(start), "yyyy-MM-dd") };
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

/** How often each category was used in the last 90 days. */
export const getCategoryUsage = cache(async (): Promise<Record<string, number>> => {
  await connection(); // reads the clock: request time only
  const supabase = await createClient();
  const since = format(subDays(new Date(), 90), "yyyy-MM-dd");
  const { data, error } = await supabase
    .from("transactions")
    .select("category_id")
    .gte("occurred_on", since)
    .limit(1000);
  if (error) throw error;
  const usage: Record<string, number> = {};
  for (const { category_id } of data) usage[category_id] = (usage[category_id] ?? 0) + 1;
  return usage;
});

export async function listTransactions(
  filters: TransactionFilters & { month: string },
): Promise<TransactionRow[]> {
  const supabase = await createClient();
  const { from, to } = monthRange(filters.month);

  let query = supabase
    .from("transactions")
    .select(
      "id, type, category_id, description, amount_cents, currency, fx_rate, amount_primary_cents, occurred_on, categories (name, icon, color)",
    )
    .gte("occurred_on", from)
    .lte("occurred_on", to)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);

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
    category: t.categories as unknown as TransactionRow["category"],
  }));
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}
