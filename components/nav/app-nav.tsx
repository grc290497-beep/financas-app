"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Ellipsis, PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { PrivacyToggle } from "@/components/dashboard/privacy-toggle";
import { AccountMenu } from "@/components/nav/account-menu";
import { Avatar } from "@/components/nav/avatar";
import {
  GOALS,
  HOME,
  MORE_ITEMS,
  QUICK_ADD_EVENT,
  TRANSACTIONS,
  type NavItem,
} from "@/components/nav/nav-items";
import { SIDEBAR_KEY } from "@/lib/prefs";
import { cn } from "@/lib/utils";

// Before the sheet has loaded, leave ?novo=1 in the URL: it opens as soon as it mounts.
const openQuickAdd = () => {
  if (window.__quickAddReady) {
    window.dispatchEvent(new Event(QUICK_ADD_EVENT));
    return;
  }
  const url = new URL(window.location.href);
  url.searchParams.set("novo", "1");
  window.history.replaceState(null, "", url);
};

const isActive = (pathname: string, { href, exact }: NavItem) =>
  exact ? pathname === href : pathname.startsWith(href);

/**
 * Phones: a bottom bar with the "+" in the middle (Início · Lançamentos · + ·
 * Metas · Mais). From md up: a sidebar with every section.
 */
export function AppNav({ name, email, initial }: { name: string; email: string; initial: string }) {
  const t = useTranslations("Nav");
  const common = useTranslations("Common");
  const pathname = usePathname();
  // Mirrors html[data-sidebar-collapsed] (set before paint by lib/prefs.ts) for aria-expanded.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const sync = () =>
      setCollapsed(document.documentElement.hasAttribute("data-sidebar-collapsed"));
    sync();
  }, []);
  const toggleSidebar = () => {
    const next = !collapsed;
    setCollapsed(next);
    document.documentElement.toggleAttribute("data-sidebar-collapsed", next);
    try {
      localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
    } catch {
      // Private mode: the choice lasts until the page closes.
    }
  };
  const moreActive =
    pathname.startsWith("/app/more") ||
    pathname.startsWith("/app/settings") ||
    MORE_ITEMS.some((item) => isActive(pathname, item));

  const tab = (item: NavItem, active = isActive(pathname, item)) => (
    <li key={item.href} className="flex-1">
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
          active ? "text-primary" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <item.icon className="size-5" aria-hidden />
        {t(item.label)}
      </Link>
    </li>
  );

  return (
    <div data-bottom-nav data-sidebar>
      <nav
        aria-label={t("main")}
        className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/90 pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_28px_-20px_oklch(0_0_0/0.35)] backdrop-blur md:hidden"
      >
        <ul className="mx-auto flex max-w-lg items-center">
          {tab(HOME)}
          {tab(TRANSACTIONS)}
          <li className="flex flex-1 justify-center">
            <button
              type="button"
              onClick={openQuickAdd}
              aria-label={t("add")}
              className="-mt-6 flex size-14 items-center justify-center rounded-full metal-brass ring-4 ring-background transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.94]"
            >
              <Plus className="size-6" aria-hidden />
            </button>
          </li>
          {tab(GOALS)}
          {tab({ href: "/app/more", label: "more", icon: Ellipsis }, moreActive)}
        </ul>
      </nav>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col gap-6 overflow-hidden border-r bg-card/60 px-3 py-5 backdrop-blur transition-[width] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] md:flex collapsed:w-16 collapsed:px-2">
        <div className="flex items-center justify-between gap-2 pl-3 collapsed:flex-col collapsed:pl-0">
          <Link href="/app" aria-label={common("appName")}>
            <span className="collapsed:hidden">
              <Logo name={common("appName")} />
            </span>
            <span className="hidden collapsed:inline">
              <Logo />
            </span>
          </Link>
          <div className="flex items-center gap-0.5 collapsed:flex-col">
            <PrivacyToggle className="size-8 rounded-lg" />
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label={t("toggleSidebar")}
              aria-expanded={!collapsed}
              title={t("toggleSidebar")}
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <PanelLeftClose className="size-4 collapsed:hidden" aria-hidden />
              <PanelLeftOpen className="hidden size-4 collapsed:block" aria-hidden />
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={openQuickAdd}
          title={t("add")}
          className="mx-1 flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg text-sm font-medium metal-brass transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] collapsed:mx-0"
        >
          <Plus className="size-4 shrink-0" aria-hidden />
          <span className="whitespace-nowrap collapsed:sr-only">{t("add")}</span>
        </button>
        <nav aria-label={t("main")} className="flex flex-1 flex-col gap-0.5">
          {[HOME, TRANSACTIONS, GOALS, ...MORE_ITEMS].map((item) => {
            const active = isActive(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={t(item.label)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors collapsed:justify-center collapsed:px-0",
                  active
                    ? "bg-accent font-medium text-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                <item.icon
                  className={cn("size-4 shrink-0", active && "text-primary")}
                  aria-hidden
                />
                <span className="whitespace-nowrap collapsed:sr-only">{t(item.label)}</span>
              </Link>
            );
          })}
        </nav>
        <AccountMenu
          name={name}
          email={email}
          initial={initial}
          side="top"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-accent/60 collapsed:justify-center collapsed:px-0",
            pathname.startsWith("/app/settings") && "bg-accent",
          )}
        >
          <Avatar initial={initial} />
          <span className="flex min-w-0 flex-col collapsed:sr-only">
            <span className="truncate font-medium">{name}</span>
            <span className="truncate text-xs text-muted-foreground">{email}</span>
          </span>
        </AccountMenu>
      </aside>
    </div>
  );
}
