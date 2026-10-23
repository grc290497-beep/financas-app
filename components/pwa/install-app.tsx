"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Download, Share, SquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// Chrome and Edge (Android and desktop) offer installation through this event;
// Safari never fires it, so iPhones get written steps instead.
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window {
    __installPrompt?: InstallPromptEvent | null;
  }
}

const READY = "install-prompt-ready";

/**
 * Mounted once in the root layout: the browser fires beforeinstallprompt once
 * per page load, often before the page with the button is open, so keep it.
 */
export function InstallPromptListener() {
  useEffect(() => {
    const keep = (event: Event) => {
      event.preventDefault(); // we show our own button instead of the mini-infobar
      window.__installPrompt = event as InstallPromptEvent;
      window.dispatchEvent(new Event(READY));
    };
    const installed = () => {
      window.__installPrompt = null;
      window.dispatchEvent(new Event(READY));
    };
    window.addEventListener("beforeinstallprompt", keep);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", keep);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);
  return null;
}

type Mode = "hidden" | "prompt" | "ios";

function detectMode(): Mode {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return "hidden";
  if (window.__installPrompt) return "prompt";
  // iPadOS reports itself as a Mac; touch support gives it away.
  const ios =
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1);
  return ios ? "ios" : "hidden";
}

/** "Instalar app": the browser's install prompt where there is one, steps on iPhone. */
export function InstallAppButton({
  explained,
  className,
}: {
  /** Ajustes: a card with what installing means, shown only where it is possible. */
  explained?: boolean;
  className?: string;
}) {
  const t = useTranslations("InstallApp");
  const [mode, setMode] = useState<Mode>("hidden");
  const [stepsOpen, setStepsOpen] = useState(false);

  useEffect(() => {
    const update = () => setMode(detectMode());
    update();
    window.addEventListener(READY, update);
    return () => window.removeEventListener(READY, update);
  }, []);

  // Nothing to offer: already installed, or a browser that cannot install sites.
  if (mode === "hidden") return null;

  const install = async () => {
    if (mode === "ios") {
      setStepsOpen(true);
      return;
    }
    const prompt = window.__installPrompt;
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    // The event can only be used once.
    window.__installPrompt = null;
    setMode(outcome === "accepted" ? "hidden" : detectMode());
  };

  const button = (
    <Button type="button" onClick={install} className={cn("self-start", className)}>
      <Download aria-hidden />
      {t("button")}
    </Button>
  );

  return (
    <>
      {explained ? (
        <section className="flex flex-col gap-2">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-base font-medium">{t("title")}</h2>
            <p className="text-xs text-pretty text-muted-foreground">{t("hint")}</p>
          </div>
          {button}
        </section>
      ) : (
        button
      )}
      <Dialog open={stepsOpen} onOpenChange={setStepsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("iosTitle")}</DialogTitle>
            <DialogDescription>{t("iosIntro")}</DialogDescription>
          </DialogHeader>
          <ol className="flex flex-col gap-3 text-sm">
            <li className="flex items-center gap-3">
              <span className="raised-control flex size-8 shrink-0 items-center justify-center rounded-lg">
                <Share className="size-4" aria-hidden />
              </span>
              {t("iosStep1")}
            </li>
            <li className="flex items-center gap-3">
              <span className="raised-control flex size-8 shrink-0 items-center justify-center rounded-lg">
                <SquarePlus className="size-4" aria-hidden />
              </span>
              {t("iosStep2")}
            </li>
            <li className="flex items-center gap-3">
              <span className="raised-control flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold">
                OK
              </span>
              {t("iosStep3")}
            </li>
          </ol>
        </DialogContent>
      </Dialog>
    </>
  );
}
