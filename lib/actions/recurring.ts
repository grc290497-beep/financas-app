"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { kindsForType } from "@/lib/categories";
import { FxUnavailableError, convertToPrimary, getRate } from "@/lib/fx";
import { serverFxDeps } from "@/lib/fx-cache";
import { getFinancialPeriod } from "@/lib/period";
import { generateRecurringForPeriod } from "@/lib/recurring";
import { supabaseRecurringStore } from "@/lib/recurring-store";
import { createClient } from "@/lib/supabase/server";
import {
  markPaidSchema,
  recurringItemSchema,
  type MarkPaidInput,
  type RecurringItemData,
  type RecurringItemInput,
} from "@/lib/validators";

// Error values are keys under "Fixed.errors" in messages/pt-BR.json.
export type RecurringActionResult = { status: "ok" } | { status: "error"; error: string };

const today = () => new Date().toISOString().slice(0, 10);

export async function createRecurringItem(
  input: RecurringItemInput,
): Promise<RecurringActionResult> {
  const parsed = recurringItemSchema.safeParse(input);
  if (!parsed.success) return { status: "error", error: "invalidInput" };
  if (!(await categoryFits(parsed.data))) return { status: "error", error: "categoryInvalid" };

  const supabase = await createClient();
  const { error } = await supabase.from("recurring_items").insert(toRow(parsed.data));
  if (error) return { status: "error", error: "saveFailed" };

  await planCurrentPeriod();
  revalidateViews();
  return { status: "ok" };
}

export async function updateRecurringItem(
  id: string,
  input: RecurringItemInput,
): Promise<RecurringActionResult> {
  const parsedId = z.uuid().safeParse(id);
  const parsed = recurringItemSchema.safeParse(input);
  if (!parsedId.success || !parsed.success) return { status: "error", error: "invalidInput" };
  if (!(await categoryFits(parsed.data))) return { status: "error", error: "categoryInvalid" };

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("recurring_items")
    .update(toRow(parsed.data))
    .eq("id", parsedId.data)
    .select("id");
  if (error) return { status: "error", error: "saveFailed" };
  if (!updated.length) return { status: "error", error: "notFound" };

  // Unpaid occurrences of this period onwards follow the new settings: drop
  // and plan them again. Paid ones are history and stay as they are.
  await supabase
    .from("transactions")
    .delete()
    .eq("recurring_item_id", parsedId.data)
    .eq("status", "planned")
    .gte("occurred_on", await currentPeriodStart());

  await planCurrentPeriod();
  revalidateViews();
  return { status: "ok" };
}

export async function deleteRecurringItem(id: string): Promise<RecurringActionResult> {
  const parsedId = z.uuid().safeParse(id);
  if (!parsedId.success) return { status: "error", error: "invalidInput" };

  const supabase = await createClient();
  // Unpaid occurrences go with the item; paid ones stay (the link is cleared).
  const { error: plannedError } = await supabase
    .from("transactions")
    .delete()
    .eq("recurring_item_id", parsedId.data)
    .eq("status", "planned");
  if (plannedError) return { status: "error", error: "deleteFailed" };

  const { data: deleted, error } = await supabase
    .from("recurring_items")
    .delete()
    .eq("id", parsedId.data)
    .select("id");
  if (error) return { status: "error", error: "deleteFailed" };
  if (!deleted.length) return { status: "error", error: "notFound" };

  revalidateViews();
  return { status: "ok" };
}

/** Confirms a planned transaction, converting the amount actually paid. */
export async function markAsPaid(
  transactionId: string,
  input: MarkPaidInput,
): Promise<RecurringActionResult> {
  const parsedId = z.uuid().safeParse(transactionId);
  const parsed = markPaidSchema.safeParse(input);
  if (!parsedId.success || !parsed.success) return { status: "error", error: "invalidInput" };

  const profile = await requireProfile();
  const supabase = await createClient();
  const { data: planned } = await supabase
    .from("transactions")
    .select("currency, occurred_on")
    .eq("id", parsedId.data)
    .eq("status", "planned")
    .maybeSingle();
  if (!planned) return { status: "error", error: "notFound" };

  let rate = "1";
  if (planned.currency !== profile.primaryCurrency) {
    try {
      rate = (
        await getRate(
          { from: planned.currency, to: profile.primaryCurrency, date: planned.occurred_on },
          await serverFxDeps(),
        )
      ).rate;
    } catch (error) {
      if (error instanceof FxUnavailableError) return { status: "error", error: "fxUnavailable" };
      throw error;
    }
  }
  const { fxRate, amountPrimaryCents } = convertToPrimary(
    parsed.data.amount,
    planned.currency,
    profile.primaryCurrency,
    rate,
  );

  const { error } = await supabase
    .from("transactions")
    .update({
      status: "confirmed",
      amount_cents: parsed.data.amount,
      fx_rate: fxRate,
      amount_primary_cents: amountPrimaryCents,
    })
    .eq("id", parsedId.data);
  if (error) return { status: "error", error: "saveFailed" };

  revalidateViews();
  return { status: "ok" };
}

async function categoryFits(data: RecurringItemData) {
  const supabase = await createClient();
  const { data: category } = await supabase
    .from("categories")
    .select("kind")
    .eq("id", data.categoryId)
    .eq("archived", false)
    .maybeSingle();
  return Boolean(category && kindsForType(data.type).includes(category.kind as never));
}

function toRow(data: RecurringItemData) {
  return {
    type: data.type,
    name: data.name,
    category_id: data.categoryId,
    amount_cents: data.amount,
    currency: data.currency,
    frequency: data.frequency,
    day_of_month: data.dayOfMonth,
    start_on: data.startOn,
    end_on: data.endOn,
  };
}

async function currentPeriodStart() {
  const profile = await requireProfile();
  return getFinancialPeriod(today(), profile.monthStartDay).start;
}

async function planCurrentPeriod() {
  const profile = await requireProfile();
  const supabase = await createClient();
  await generateRecurringForPeriod(
    profile.id,
    getFinancialPeriod(today(), profile.monthStartDay),
    profile.primaryCurrency,
    { store: supabaseRecurringStore(supabase, profile.id), fx: await serverFxDeps() },
  );
}

function revalidateViews() {
  revalidatePath("/app", "layout");
}
