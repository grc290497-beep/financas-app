"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { pushConfigured, sendPush } from "@/lib/push";
import { createClient } from "@/lib/supabase/server";

// Error values are keys under "Notifications.errors" in messages/pt-BR.json.
export type NotificationActionResult = { status: "ok" } | { status: "error"; error: string };

// What PushSubscription.toJSON() gives the browser.
const subscriptionSchema = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

/** Saves this device's subscription (re-subscribing the same device replaces it). */
export async function saveSubscription(input: unknown): Promise<NotificationActionResult> {
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return { status: "error", error: "invalidInput" };

  await requireUser();
  const supabase = await createClient();
  // The endpoint is unique per device: clear an old row for it before inserting.
  await supabase.from("push_subscriptions").delete().eq("endpoint", parsed.data.endpoint);
  const { error } = await supabase.from("push_subscriptions").insert({
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
  });
  if (error) return { status: "error", error: "saveFailed" };
  return { status: "ok" };
}

export async function removeSubscription(endpoint: string): Promise<NotificationActionResult> {
  const parsed = z.url().max(1000).safeParse(endpoint);
  if (!parsed.success) return { status: "error", error: "invalidInput" };

  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", parsed.data);
  if (error) return { status: "error", error: "saveFailed" };
  return { status: "ok" };
}

export async function updateNotificationPrefs(input: {
  budget: boolean;
  goals: boolean;
}): Promise<NotificationActionResult> {
  const parsed = z.object({ budget: z.boolean(), goals: z.boolean() }).safeParse(input);
  if (!parsed.success) return { status: "error", error: "invalidInput" };

  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ notify_budget: parsed.data.budget, notify_goals: parsed.data.goals })
    .eq("id", user.id);
  if (error) return { status: "error", error: "saveFailed" };

  revalidatePath("/app/settings");
  return { status: "ok" };
}

/** "Enviar teste": proves the whole path to this user's devices works. */
export async function sendTestNotification(): Promise<NotificationActionResult> {
  await requireUser();
  if (!pushConfigured()) return { status: "error", error: "notConfigured" };

  const supabase = await createClient();
  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth");
  if (error) return { status: "error", error: "saveFailed" };
  if (!subs.length) return { status: "error", error: "noDevice" };

  const t = await getTranslations("Notifications");
  const delivered = await sendPush(supabase, subs, {
    title: t("testTitle"),
    body: t("testBody"),
    url: "/app/settings",
  });
  return delivered ? { status: "ok" } : { status: "error", error: "sendFailed" };
}
