"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  onboardingSchema,
  profileSchema,
  type OnboardingInput,
  type ProfileInput,
} from "@/lib/validators";

export type ProfileActionResult = { status: "error"; error: string };

/** Name and financial-month start, from Ajustes. Periods recompute on the next read. */
export async function updateProfile(
  input: ProfileInput,
): Promise<{ status: "ok" } | ProfileActionResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { status: "error", error: "invalidInput" };

  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      month_start_day: parsed.data.monthStartDay,
    })
    .eq("id", user.id);
  if (error) return { status: "error", error: "saveFailed" };

  revalidatePath("/app", "layout");
  return { status: "ok" };
}

export async function completeOnboarding(input: OnboardingInput): Promise<ProfileActionResult> {
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) return { status: "error", error: "invalidInput" };

  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      primary_currency: parsed.data.primaryCurrency,
      month_start_day: parsed.data.monthStartDay,
      onboarding_done: true,
    })
    .eq("id", user.id);

  if (error) return { status: "error", error: "saveFailed" };
  redirect("/app");
}
