"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { kindsForType } from "@/lib/categories";
import { FxUnavailableError, convertToPrimary, getRate } from "@/lib/fx";
import { serverFxDeps } from "@/lib/fx-cache";
import { getFinancialPeriod } from "@/lib/period";
import { generateRecurringForPeriod, splitDates } from "@/lib/recurring";
import { supabaseRecurringStore } from "@/lib/recurring-store";
import { createClient } from "@/lib/supabase/server";
import {
  effectiveFromSchema,
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
  effectiveFrom?: string,
): Promise<RecurringActionResult> {
  const parsedId = z.uuid().safeParse(id);
  const parsed = recurringItemSchema.safeParse(input);
  const parsedFrom = effectiveFromSchema.safeParse(effectiveFrom);
  if (!parsedId.success || !parsed.success || !parsedFrom.success) {
    return { status: "error", error: "invalidInput" };
  }
  if (!(await categoryFits(parsed.data))) return { status: "error", error: "categoryInvalid" };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("recurring_items")
    .select("start_on")
    .eq("id", parsedId.data)
    .maybeSingle();
  if (!existing) return { status: "error", error: "notFound" };

  const split = parsedFrom.data && splitDates(existing.start_on, parsed.data, parsedFrom.data);
  if (split) return splitRecurringItem(parsedId.data, parsed.data, parsedFrom.data!, split);

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
  // Unpaid and skipped occurrences go with the item; paid ones stay (the link is cleared).
  const { error: plannedError } = await supabase
    .from("transactions")
    .delete()
    .eq("recurring_item_id", parsedId.data)
    .in("status", ["planned", "skipped"]);
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

/**
 * Applies an edit from `effectiveFrom` on: the item ends the day before and a
 * new item with the new settings takes over. Earlier occurrences, paid or not,
 * keep the old settings.
 */
async function splitRecurringItem(
  id: string,
  data: RecurringItemData,
  effectiveFrom: string,
  split: { oldEndOn: string; newStartOn: string },
): Promise<RecurringActionResult> {
  if (data.endOn && data.endOn < split.newStartOn) {
    return { status: "error", error: "endBeforeEffective" };
  }

  const supabase = await createClient();
  // A confirmed occurrence on or after the date would be planned again by the new item.
  const { data: paid, error: paidError } = await supabase
    .from("transactions")
    .select("id")
    .eq("recurring_item_id", id)
    .eq("status", "confirmed")
    .gte("occurred_on", effectiveFrom)
    .limit(1);
  if (paidError) return { status: "error", error: "saveFailed" };
  if (paid.length) return { status: "error", error: "paidAfterEffective" };

  const { data: created, error } = await supabase
    .from("recurring_items")
    .insert({ ...toRow(data), start_on: split.newStartOn })
    .select("id")
    .single();
  if (error) return { status: "error", error: "saveFailed" };

  const { error: endError } = await supabase
    .from("recurring_items")
    .update({ end_on: split.oldEndOn })
    .eq("id", id);
  if (endError) {
    // Undo, so the old and the new item don't both run.
    await supabase.from("recurring_items").delete().eq("id", created.id);
    return { status: "error", error: "saveFailed" };
  }

  await supabase
    .from("transactions")
    .delete()
    .eq("recurring_item_id", id)
    .in("status", ["planned", "skipped"]) // the old item ends; the new one plans afresh
    .gte("occurred_on", effectiveFrom);

  await planCurrentPeriod();
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
