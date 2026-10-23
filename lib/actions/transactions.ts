"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { kindsForType } from "@/lib/categories";
import { FxUnavailableError, convertToPrimary, getRate, type FxRate } from "@/lib/fx";
import { serverFxDeps } from "@/lib/fx-cache";
import { createClient } from "@/lib/supabase/server";
import {
  CURRENCIES,
  transactionSchema,
  type TransactionData,
  type TransactionInput,
} from "@/lib/validators";

// Error values are keys under "Transactions.errors" in messages/pt-BR.json.
export type TransactionActionResult = { status: "ok" } | { status: "error"; error: string };

export async function createTransaction(input: TransactionInput): Promise<TransactionActionResult> {
  const parsed = transactionSchema.safeParse(input);
  if (!parsed.success) return { status: "error", error: "invalidInput" };

  const prepared = await prepareRow(parsed.data, null);
  if ("error" in prepared) return prepared;

  const supabase = await createClient();
  const { error } = await supabase.from("transactions").insert(prepared.row);
  if (error) return { status: "error", error: "saveFailed" };

  revalidateTransactionViews();
  return { status: "ok" };
}

export async function updateTransaction(
  id: string,
  input: TransactionInput,
): Promise<TransactionActionResult> {
  const parsedId = z.uuid().safeParse(id);
  const parsed = transactionSchema.safeParse(input);
  if (!parsedId.success || !parsed.success) return { status: "error", error: "invalidInput" };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("transactions")
    .select("currency, occurred_on, fx_rate, recurring_item_id")
    .eq("id", parsedId.data)
    .maybeSingle();
  if (!existing) return { status: "error", error: "notFound" };

  // A goal's contribution owns this entry; editing it here would desync the goal.
  const { count: linked } = await supabase
    .from("goal_contributions")
    .select("id", { count: "exact", head: true })
    .eq("transaction_id", parsedId.data);
  if (linked) return { status: "error", error: "goalLinked" };

  // A fixed cost's date is its due date and half of the key that stops it
  // being generated twice; moving it would bring the original date back.
  if (existing.recurring_item_id && existing.occurred_on !== parsed.data.occurredOn) {
    return { status: "error", error: "recurringDateLocked" };
  }

  // The rate stays frozen unless what it depends on (currency, date) changes.
  const keepRate =
    existing.currency === parsed.data.currency && existing.occurred_on === parsed.data.occurredOn
      ? String(existing.fx_rate)
      : null;

  const prepared = await prepareRow(parsed.data, keepRate);
  if ("error" in prepared) return prepared;

  const { error } = await supabase
    .from("transactions")
    .update(prepared.row)
    .eq("id", parsedId.data);
  if (error) return { status: "error", error: "saveFailed" };

  revalidateTransactionViews();
  return { status: "ok" };
}

export async function deleteTransaction(id: string): Promise<TransactionActionResult> {
  const parsedId = z.uuid().safeParse(id);
  if (!parsedId.success) return { status: "error", error: "invalidInput" };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("transactions")
    .select("status, recurring_item_id")
    .eq("id", parsedId.data)
    .maybeSingle();
  if (!existing) return { status: "error", error: "notFound" };

  // An occurrence of a fixed cost (planned, or confirmed on its due day) is marked
  // skipped, not deleted: the row keeps its (recurring_item_id, occurred_on)
  // slot, so generation won't recreate it and confirm it again.
  const skip = existing.recurring_item_id !== null;
  const { error, count } = skip
    ? await supabase
        .from("transactions")
        .update({ status: "skipped" }, { count: "exact" })
        .eq("id", parsedId.data)
    : await supabase.from("transactions").delete({ count: "exact" }).eq("id", parsedId.data);
  if (error) return { status: "error", error: "deleteFailed" };
  if (!count) return { status: "error", error: "notFound" };

  revalidateTransactionViews();
  return { status: "ok" };
}

export type FxPreviewResult = ({ status: "ok" } & FxRate) | { status: "error"; error: string };

/** Rate shown in the form before saving (currency -> the user's primary currency). */
export async function getFxPreview(input: {
  currency: string;
  date: string;
}): Promise<FxPreviewResult> {
  const parsed = z.object({ currency: z.enum(CURRENCIES), date: z.iso.date() }).safeParse(input);
  if (!parsed.success) return { status: "error", error: "invalidInput" };

  const profile = await requireProfile();
  try {
    const rate = await getRate(
      { from: parsed.data.currency, to: profile.primaryCurrency, date: parsed.data.date },
      await serverFxDeps(),
    );
    return { status: "ok", ...rate };
  } catch (error) {
    if (error instanceof FxUnavailableError) return { status: "error", error: "fxUnavailable" };
    throw error;
  }
}

async function prepareRow(
  data: TransactionData,
  frozenRate: string | null,
): Promise<{ row: Record<string, unknown> } | { status: "error"; error: string }> {
  const profile = await requireProfile();
  const supabase = await createClient();

  // RLS already hides other users' categories; this also checks the kind.
  const { data: category } = await supabase
    .from("categories")
    .select("kind")
    .eq("id", data.categoryId)
    .eq("archived", false)
    .maybeSingle();
  if (!category || !kindsForType(data.type).includes(category.kind as never)) {
    return { status: "error", error: "categoryInvalid" };
  }

  let rate = data.fxRate ?? frozenRate ?? "1";
  if (!data.fxRate && !frozenRate && data.currency !== profile.primaryCurrency) {
    try {
      const fx = await getRate(
        { from: data.currency, to: profile.primaryCurrency, date: data.occurredOn },
        await serverFxDeps(),
      );
      rate = fx.rate;
    } catch (error) {
      if (error instanceof FxUnavailableError) return { status: "error", error: "fxUnavailable" };
      throw error;
    }
  }

  const { fxRate, amountPrimaryCents } = convertToPrimary(
    data.amount,
    data.currency,
    profile.primaryCurrency,
    rate,
  );

  return {
    row: {
      type: data.type,
      category_id: data.categoryId,
      description: data.description,
      amount_cents: data.amount,
      currency: data.currency,
      fx_rate: fxRate,
      amount_primary_cents: amountPrimaryCents,
      occurred_on: data.occurredOn,
    },
  };
}

function revalidateTransactionViews() {
  revalidatePath("/app", "layout");
}
