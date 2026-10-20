"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Segmented } from "@/components/forms/segmented";

type Theme = "system" | "light" | "dark";
const subscribe = () => () => {};

/** Sistema / Claro / Escuro, stored by next-themes in this browser. */
export function ThemeSelect() {
  const t = useTranslations("Settings.theme");
  const { theme, setTheme } = useTheme();
  // The stored theme is only known in the browser; render the default (dark) until hydrated.
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  return (
    <Segmented<Theme>
      label={t("label")}
      value={hydrated ? ((theme as Theme | undefined) ?? "dark") : "dark"}
      onChange={setTheme}
      options={[
        { value: "system", label: t("system") },
        { value: "light", label: t("light") },
        { value: "dark", label: t("dark") },
      ]}
      className="self-start"
    />
  );
}
