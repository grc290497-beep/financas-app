import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireProfile } from "@/lib/auth";
import { serverFxDeps } from "@/lib/fx-cache";
import {
  generateRecurringForPeriod,
  periodsToPlan,
  type Frequency,
  type RecurringItem,
  type RecurringStore,
} from "@/lib/recurring";
import { createClient } from "@/lib/supabase/server";
import type { Currency, TransactionType } from "@/lib/validators";

// Supabase side of recurring items: the store used by the generator and the
// queries for /app/fixed.

const ITEM_COLUMNS =
  "id, type, name, category_id, amount_cents, currency, frequency, day_of_month, start_on, end_on";

type ItemRow = {
  id: string;
  type: string;
  name: string;
  category_id: string;
  amount_cents: number | string;
  currency: string;
  frequency: string;
  day_of_month: number | null;
  start_on: string;
  end_on: string | null;
};

function toItem(row: ItemRow): RecurringItem {
  return {
    id: row.id,
    type: row.type as TransactionType,
    name: row.name,
    categoryId: row.category_id,
    amountCents: Number(row.amount_cents),
    currency: row.currency as Currency,
    frequency: row.frequency as Frequency,
    dayOfMonth: row.day_of_month,
    startOn: row.start_on,
    endOn: row.end_on,
  };
}

/** `client` is the user's (RLS) or the service role's (cron, which filters by user). */
export function supabaseRecurringStore(client: SupabaseClient, userId: string): RecurringStore {
  return {
    async activeItems() {
      const { data, error } = await client
        .from("recurring_items")
        .select(ITEM_COLUMNS)
        .eq("user_id", userId)
        .eq("active", true);
      if (error) throw error;
      return data.map(toItem);
    },
    async insertIgnoringExisting(rows) {
      const { data, error } = await client
        .from("transactions")
        .upsert(rows, { onConflict: "recurring_item_id,occurred_on", ignoreDuplicates: true })
        .select("id");
      if (error) throw error;
      return data.length;
    },
  };
}

/**
 * Makes sure the signed-in user's recurring items are planned for the
 * current financial month, and for `viewedMonth` (yyyy-MM) when it is a
 * future month being opened, then confirms what has come due. Runs when the
 * app's pages open (the daily cron is the backstop); cached so one request
 * only does it once.
 */
export const ensureRecurringGenerated = cache(async (today: string, viewedMonth?: string) => {
  const profile = await requireProfile();
  if (!profile.onboardingDone) return;
  const supabase = await createClient();
  const deps = { store: supabaseRecurringStore(supabase, profile.id), fx: await serverFxDeps() };
  for (const period of periodsToPlan(today, profile.monthStartDay, viewedMonth)) {
    await generateRecurringForPeriod(profile.id, period, profile.primaryCurrency, deps);
  }
  await confirmDue(supabase, today);
});

/**
 * Planned occurrences that have come due become confirmed, at the planned
 * amount (the user edits it if the real one differed). With the user's
 * client RLS limits it to them; the cron passes the service role for everyone.
 */
export async function confirmDue(client: SupabaseClient, today: string) {
  const { error, count } = await client
    .from("transactions")
    .update({ status: "confirmed" }, { count: "exact" })
    .eq("status", "planned")
    .lte("occurred_on", today);
  if (error) throw error;
  return count ?? 0;
}

export const listRecurringItems = cache(async (): Promise<RecurringItem[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recurring_items")
    .select(ITEM_COLUMNS)
    .eq("active", true)
    .order("type", { ascending: false })
    .order("day_of_month", { ascending: true, nullsFirst: false })
    .order("name");
  if (error) throw error;
  return data.map(toItem);
});

export type PlannedRow = {
  id: string;
  recurringItemId: string | null;
  type: TransactionType;
  description: string | null;
  amountCents: number;
  currency: Currency;
  amountPrimaryCents: number;
  occurredOn: string;
  paid: boolean;
};

/**
 * Planned (not yet paid) transactions in a date range, soonest first. With
 * `withPaid`, the fixed items' occurrences already paid or received come too.
 */
export async function listPlanned(
  from: string,
  to: string,
  { withPaid = false } = {},
): Promise<PlannedRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("transactions")
    .select(
      "id, recurring_item_id, type, description, amount_cents, currency, amount_primary_cents, occurred_on, status",
    )
    .gte("occurred_on", from)
    .lte("occurred_on", to);
  query = withPaid
    ? query.in("status", ["planned", "confirmed"]).not("recurring_item_id", "is", null)
    : query.eq("status", "planned");
  const { data, error } = await query.order("occurred_on").order("description");
  if (error) throw error;
  return data.map((t) => ({
    id: t.id,
    recurringItemId: t.recurring_item_id,
    type: t.type as TransactionType,
    description: t.description,
    amountCents: Number(t.amount_cents),
    currency: t.currency as Currency,
    amountPrimaryCents: Number(t.amount_primary_cents),
    occurredOn: t.occurred_on,
    paid: t.status === "confirmed",
  }));
}
