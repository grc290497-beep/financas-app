import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Menu } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { InstallAppButton } from "@/components/pwa/install-app";
import { Button } from "@/components/ui/button";

/**
 * Navbar for the public pages (landing, login, signup, legal). Hidden when the
 * site runs from the home-screen icon, so the installed app feels like an app.
 */
export async function SiteHeader() {
  const [t, common] = await Promise.all([getTranslations("SiteHeader"), getTranslations("Common")]);
  const sections = [
    { href: "/#lancamento", label: t("quickAdd") },
    { href: "/#metas", label: t("goals") },
    { href: "/#cambio", label: t("exchange") },
    { href: "/#recursos", label: t("features") },
  ];
  const linkClass =
    "rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/75 backdrop-blur-md standalone:hidden">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" aria-label={t("home")}>
          <Logo name={common("appName")} size={32} className="text-base" />
        </Link>

        <nav aria-label={t("label")} className="hidden flex-1 items-center gap-1 md:flex">
          {sections.map((s) => (
            <Link key={s.href} href={s.href} className={linkClass}>
              {s.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <InstallAppButton variant="ghost" size="sm" className="hidden md:inline-flex" />
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">{t("login")}</Link>
          </Button>
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/signup">{t("signup")}</Link>
          </Button>

          {/* Phones: the section links fold into a menu (no JavaScript needed). */}
          <details className="group relative md:hidden">
            <summary
              className="flex size-9 cursor-pointer list-none items-center justify-center rounded-lg raised-control [&::-webkit-details-marker]:hidden"
              aria-label={t("menu")}
            >
              <Menu className="size-4" aria-hidden />
            </summary>
            <nav
              aria-label={t("label")}
              className="surface absolute top-11 right-0 flex w-56 flex-col p-2"
            >
              {sections.map((s) => (
                <Link key={s.href} href={s.href} className={linkClass}>
                  {s.label}
                </Link>
              ))}
              <Button asChild size="sm" className="mt-2">
                <Link href="/signup">{t("signup")}</Link>
              </Button>
              <InstallAppButton variant="outline" size="sm" className="mt-2 self-stretch" />
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
