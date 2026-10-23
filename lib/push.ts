import "server-only";
import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import { publicSiteOrigin } from "@/lib/site";

// Sends Web Push messages (public/sw.js shows them). Keys come from the env:
// NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY (npx web-push generate-vapid-keys).

export type PushPayload = { title: string; body: string; url: string };
export type PushSubscriptionRow = { endpoint: string; p256dh: string; auth: string };

let configured = false;

export function pushConfigured(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  if (!configured) {
    // The subject tells push services who to contact: the site's https URL,
    // or a placeholder mailto in local dev (web-push rejects http URLs).
    const origin = publicSiteOrigin();
    const subject = origin.startsWith("https://") ? origin : "mailto:dev@localhost";
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  }
  return true;
}

/**
 * Sends to every device; drops subscriptions the push service says are gone.
 * Returns how many devices got it.
 */
export async function sendPush(
  client: SupabaseClient,
  subscriptions: PushSubscriptionRow[],
  payload: PushPayload,
): Promise<number> {
  let delivered = 0;
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
        { TTL: 60 * 60 * 12 },
      );
      delivered++;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      // 404/410: the browser unsubscribed or the app was uninstalled.
      if (status === 404 || status === 410) {
        await client.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      } else {
        console.error("Push failed", status, error);
      }
    }
  }
  return delivered;
}
