"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarClock, ChartColumn, House, ReceiptText, Target } from "lucide-react";
import { cn } from "@/lib/utils";

// Ajustes joins when its phase lands (PLAN.md section 5).
const ITEMS = [
  { href: "/app", label: "home", icon: House, exact: true },
  { href: "/app/transactions", label: "transactions", icon: ReceiptText, exact: false },
  // Not in PLAN.md's tab list; placement gets revisited in the final layout pass.
  { href: "/app/fixed", label: "fixed", icon: CalendarClock, exact: false },
  { href: "/app/goals", label: "goals", icon: Target, exact: false },
  { href: "/app/reports", label: "reports", icon: ChartColumn, exact: false },
] as const;

/** Bottom tab bar on mobile, a top bar from md up. */
export function AppNav() {
  const t = useTranslations("Nav");
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("main")}
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:static md:order-first md:border-t-0 md:border-b md:pb-0"
    >
      <ul className="mx-auto flex max-w-3xl md:gap-1 md:px-4">
        {ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1 md:flex-none">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium md:h-11 md:flex-row md:gap-2 md:px-3 md:text-sm",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-5 md:size-4" aria-hidden />
                {t(label)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
