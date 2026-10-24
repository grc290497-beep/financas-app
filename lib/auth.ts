import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Currency } from "@/lib/validators";

// Data Access Layer: the only place pages read the session and profile.

export type Profile = {
  id: string;
  displayName: string | null;
  primaryCurrency: Currency;
  monthStartDay: number;
  onboardingDone: boolean;
  /** Earlier months' leftover counts in "Disponível agora", from the opening balance. */
  carryOver: boolean;
  openingBalanceCents: number;
  notifyBudget: boolean;
  notifyGoals: boolean;
};

/** The signed-in user's id and email, or a redirect to /login. */
export const requireUser = cache(async () => {
  // The session is request data, and the Supabase client checks token expiry
  // against the clock, so this can never be prerendered.
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) {
    redirect("/login");
  }
  return { id: claims.sub, email: claims.email as string | undefined };
});

/**
 * Whether this session came from an e-mail link (password reset, magic link)
 * in the last 15 minutes: proof of access to the inbox, so a new password can
 * be set without the current one. Otherwise the current one is required.
 */
export async function signedInByRecentLink(): Promise<boolean> {
  await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const amr = (data?.claims?.amr ?? []) as { method: string; timestamp: number }[];
  const since = Date.now() / 1000 - 15 * 60;
  return amr.some(
    (entry) => ["recovery", "otp", "magiclink"].includes(entry.method) && entry.timestamp > since,
  );
}

/** The signed-in user's profile (RLS limits the query to their own row). */
export const requireProfile = cache(async (): Promise<Profile> => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, display_name, primary_currency, month_start_day, onboarding_done, carry_over, opening_balance_cents, notify_budget, notify_goals",
    )
    .eq("id", user.id)
    .single();

  // No row (PGRST116): the account was deleted, e.g. on another device, while
  // this session's token is still valid. Any other error is a real failure.
  if (error?.code === "PGRST116") redirect("/auth/signout");
  if (error || !data) {
    throw new Error("Profile not found for the signed-in user.");
  }

  return {
    id: data.id,
    displayName: data.display_name,
    primaryCurrency: data.primary_currency as Currency,
    monthStartDay: data.month_start_day,
    onboardingDone: data.onboarding_done,
    carryOver: data.carry_over,
    openingBalanceCents: Number(data.opening_balance_cents),
    notifyBudget: data.notify_budget,
    notifyGoals: data.notify_goals,
  };
});
