"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Eye, EyeOff } from "lucide-react";
import { PRIVACY_KEY } from "@/lib/prefs";

/**
 * The eye on the hero card: hides every amount (globals.css blurs
 * .tabular-nums under html[data-privacy]). The root layout applies the saved
 * choice before paint, so amounts never flash visible.
 */
export function PrivacyToggle() {
  const t = useTranslations("Dashboard");
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const sync = () => setHidden(document.documentElement.hasAttribute("data-privacy"));
    sync();
  }, []);

  const toggle = () => {
    const next = !hidden;
    setHidden(next);
    document.documentElement.toggleAttribute("data-privacy", next);
    try {
      localStorage.setItem(PRIVACY_KEY, next ? "1" : "0");
    } catch {
      // Private mode: the choice lasts until the page closes.
    }
  };

  const Icon = hidden ? EyeOff : Eye;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={hidden}
      aria-label={hidden ? t("showValues") : t("hideValues")}
      className="raised -mr-1 flex size-9 items-center justify-center rounded-full text-hero-muted transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.94]"
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}
