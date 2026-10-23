import { Suspense } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronRight } from "lucide-react";
import { InstallAppButton } from "@/components/pwa/install-app";
import { BalanceForm } from "@/components/settings/balance-form";
import { NotificationSettings } from "@/components/settings/notification-settings";
import { DeleteAccount } from "@/components/settings/delete-account";
import { ExportLinks } from "@/components/settings/export-links";
import { ProfileForm } from "@/components/settings/profile-form";
import { ThemeSelect } from "@/components/settings/theme-select";
import { Skeleton } from "@/components/ui/skeleton";
import { requireProfile, requireUser } from "@/lib/auth";
import { formatAmountInput } from "@/lib/money";

export default function SettingsPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <Settings />
      </Suspense>
    </main>
  );
}

async function Settings() {
  // Profile first: it resolves the session (request time) before anything else.
  const profile = await requireProfile();
  const [user, t, tFooter] = await Promise.all([
    requireUser(),
    getTranslations("Settings"),
    getTranslations("Footer"),
  ]);

  // The currency stays read-only: changing it would have to re-price every transaction.
  const rows = [
    { label: t("email"), value: user.email ?? "—" },
    { label: t("currency"), value: profile.primaryCurrency },
  ];

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>

      <Section title={t("profile.title")}>
        <ProfileForm
          defaultValues={{
            displayName: profile.displayName ?? "",
            monthStartDay: profile.monthStartDay,
          }}
        />
      </Section>

      <Section title={t("balance.title")}>
        <BalanceForm
          defaultValues={{
            carryOver: profile.carryOver,
            openingBalance: profile.openingBalanceCents
              ? formatAmountInput(profile.openingBalanceCents)
              : "",
          }}
          symbol={profile.primaryCurrency === "EUR" ? "€" : "R$"}
        />
      </Section>

      <Section title={t("organize.title")}>
        <ul className="surface divide-y text-sm">
          {[
            { href: "/app/categories", label: t("organize.categories") },
            { href: "/app/budget", label: t("organize.budget") },
          ].map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-accent/50"
              >
                {link.label}
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t("account")} hint={t("currencyHint")}>
        <dl className="surface divide-y text-sm">
          {rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-3 px-4 py-3">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="min-w-0 truncate">{row.value}</dd>
            </div>
          ))}
        </dl>
        <Link
          href="/reset-password"
          className="surface flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-accent/50"
        >
          {t("changePassword")}
          <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
        </Link>
      </Section>

      <InstallAppButton look="explained" />

      <NotificationSettings budget={profile.notifyBudget} goals={profile.notifyGoals} />

      <Section title={t("theme.label")}>
        <ThemeSelect />
      </Section>

      <Section title={t("data")} hint={t("dataHint")}>
        <ExportLinks />
      </Section>

      <Section title={t("legal")}>
        <ul className="flex flex-col gap-1 text-sm">
          <li>
            <Link href="/privacy" className="underline-offset-4 hover:underline">
              {t("privacy")}
            </Link>
          </li>
          <li>
            <Link href="/terms" className="underline-offset-4 hover:underline">
              {t("terms")}
            </Link>
          </li>
          <li>
            <a
              href={`mailto:${tFooter("contactEmail")}`}
              className="underline-offset-4 hover:underline"
            >
              {t("contact")}
            </a>
          </li>
        </ul>
      </Section>

      <Section title={t("delete.section")} hint={t("delete.hint")}>
        <DeleteAccount />
      </Section>
    </>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-base font-medium">{title}</h2>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}
