"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Bell, BellOff, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  removeSubscription,
  saveSubscription,
  sendTestNotification,
  updateNotificationPrefs,
} from "@/lib/actions/notifications";

type State = "loading" | "unconfigured" | "unsupported" | "ios" | "denied" | "off" | "on";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

async function currentState(): Promise<State> {
  // No key in this deploy yet: hide the block rather than blame the browser.
  if (!PUBLIC_KEY) return "unconfigured";
  const standalone = window.matchMedia("(display-mode: standalone)").matches;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  // Safari on iPhone only delivers push to an installed app.
  if (ios && !standalone) return "ios";
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return "unsupported";
  }
  if (Notification.permission === "denied") return "denied";
  const registration = await navigator.serviceWorker.ready;
  return (await registration.pushManager.getSubscription()) ? "on" : "off";
}

/** The VAPID public key comes base64url-encoded; subscribe() wants bytes. */
function keyBytes(base64url: string) {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

/** Ajustes: turn push on for this device, choose which alerts, send a test. */
export function NotificationSettings({ budget, goals }: { budget: boolean; goals: boolean }) {
  const t = useTranslations("Notifications");
  const [state, setState] = useState<State>("loading");
  const [prefs, setPrefs] = useState({ budget, goals });
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    currentState().then(setState, () => setState("unsupported"));
  }, []);

  const fail = (error: string) => {
    toast.error(t(`errors.${error}` as Parameters<typeof t>[0]));
  };

  const enable = () =>
    startTransition(async () => {
      if ((await Notification.requestPermission()) !== "granted") {
        setState(Notification.permission === "denied" ? "denied" : "off");
        return;
      }
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes(PUBLIC_KEY),
        });
        const result = await saveSubscription(subscription.toJSON());
        if (result.status === "error") {
          await subscription.unsubscribe();
          return fail(result.error);
        }
        setState("on");
        toast.success(t("enabled"));
      } catch {
        fail("subscribeFailed");
      }
    });

  const disable = () =>
    startTransition(async () => {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await removeSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setState("off");
      toast.success(t("disabled"));
    });

  const test = () =>
    startTransition(async () => {
      const result = await sendTestNotification();
      if (result.status === "error") return fail(result.error);
      toast.success(t("testSent"));
    });

  const toggle = (key: "budget" | "goals") =>
    startTransition(async () => {
      const next = { ...prefs, [key]: !prefs[key] };
      setPrefs(next);
      const result = await updateNotificationPrefs(next);
      if (result.status === "error") {
        setPrefs(prefs);
        return fail(result.error);
      }
      toast.success(t("saved"));
    });

  if (state === "loading" || state === "unconfigured") return null;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-base font-medium">{t("title")}</h2>
        <p className="text-xs text-pretty text-muted-foreground">{t("hint")}</p>
      </div>

      {(state === "unsupported" || state === "ios" || state === "denied") && (
        <p className="surface px-4 py-3 text-sm text-muted-foreground">
          {t(state === "ios" ? "iosInstall" : state)}
        </p>
      )}

      {state === "off" && (
        <Button className="self-start" onClick={enable} disabled={pending}>
          <Bell aria-hidden />
          {pending ? t("enabling") : t("enable")}
        </Button>
      )}

      {state === "on" && (
        <div className="surface flex flex-col gap-3 p-4 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <Bell className="size-4 text-positive" aria-hidden />
            {t("on")}
          </p>
          {(["budget", "goals"] as const).map((key) => (
            <label key={key} className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={prefs[key]}
                onChange={() => toggle(key)}
                disabled={pending}
                className="size-4 accent-primary"
              />
              {t(key)}
            </label>
          ))}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={test} disabled={pending}>
              <Send aria-hidden />
              {t("test")}
            </Button>
            <Button variant="ghost" size="sm" onClick={disable} disabled={pending}>
              <BellOff aria-hidden />
              {t("disable")}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
