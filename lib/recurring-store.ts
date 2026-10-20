import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireProfile } from "@/lib/auth";
import { serverFxDeps } from "@/lib/fx-cache";
import { getFinancialPeriod } from "@/lib/period";
import {
  generateRecurringForPeriod,
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
 * current financial month. Runs when the app's pages open (the daily cron is
 * the backstop); cached so one request only does it once.
 */
export const ensureRecurringGenerated = cache(async (today: string) => {
  const profile = await requireProfile();
  if (!profile.onboardingDone) return;
  const supabase = await createClient();
  await generateRecurringForPeriod(
    profile.id,
    getFinancialPeriod(today, profile.monthStartDay),
    profile.primaryCurrency,
    { store: supabaseRecurringStore(supabase, profile.id), fx: await serverFxDeps() },
  );
});

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
};

/** Planned (not yet paid) transactions in a date range, soonest first. */
export async function listPlanned(from: string, to: string): Promise<PlannedRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select(
      "id, recurring_item_id, type, description, amount_cents, currency, amount_primary_cents, occurred_on",
    )
    .eq("status", "planned")
    .gte("occurred_on", from)
    .lte("occurred_on", to)
    .order("occurred_on")
    .order("description");
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
  }));
}
