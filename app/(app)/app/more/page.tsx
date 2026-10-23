import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronRight, Settings } from "lucide-react";
import { MORE_ITEMS } from "@/components/nav/nav-items";

// "Mais" in the phone tab bar: the sections that don't fit in five tabs.
export default async function MorePage() {
  const t = await getTranslations("Nav");
  const items = [
    ...MORE_ITEMS,
    { href: "/app/settings", label: "settings" as const, icon: Settings },
  ];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("more")}</h1>
      <ul className="surface divide-y">
        {items.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-accent/50"
            >
              <span className="flex size-9 items-center justify-center rounded-xl bg-brass/15 text-brass-dark dark:text-brass">
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="flex-1 font-medium">{t(label)}</span>
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
