import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { SiteNav } from "@/components/nav/site-nav";

/**
 * Navbar for the public pages (landing, login, signup, legal). Hidden when the
 * site runs from the home-screen icon, so the installed app feels like an app.
 */
export async function SiteHeader() {
  const [t, common] = await Promise.all([getTranslations("SiteHeader"), getTranslations("Common")]);
  // Ids of the landing page's sections (app/page.tsx).
  const sections = [
    { id: "inicio", label: t("start") },
    { id: "lancamento", label: t("quickAdd") },
    { id: "metas", label: t("goals") },
    { id: "cambio", label: t("exchange") },
    { id: "recursos", label: t("features") },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/75 backdrop-blur-md standalone:hidden">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 sm:gap-4 sm:px-6">
        <Link href="/" aria-label={t("home")}>
          <Logo name={common("appName")} size={32} className="text-base" />
        </Link>
        <SiteNav
          sections={sections}
          labels={{
            nav: t("label"),
            login: t("login"),
            signup: t("signup"),
            openApp: t("openApp"),
            menu: t("menu"),
          }}
        />
      </div>
    </header>
  );
}
