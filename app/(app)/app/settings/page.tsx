import { Suspense } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { DeleteAccount } from "@/components/settings/delete-account";
import { ExportLinks } from "@/components/settings/export-links";
import { ThemeSelect } from "@/components/settings/theme-select";
import { Skeleton } from "@/components/ui/skeleton";
import { requireProfile, requireUser } from "@/lib/auth";

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
  const [user, t] = await Promise.all([requireUser(), getTranslations("Settings")]);

  // shortcut: profile is read-only here; editing name, currency and start day
  // (which would re-price every transaction) comes with the design pass.
  const rows = [
    { label: t("name"), value: profile.displayName ?? "—" },
    { label: t("email"), value: user.email ?? "—" },
    { label: t("currency"), value: profile.primaryCurrency },
    { label: t("monthStartDay"), value: t("dayValue", { day: profile.monthStartDay }) },
  ];

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>

      <Section title={t("account")}>
        <dl className="surface divide-y text-sm">
          {rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-3 px-3 py-2.5">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="min-w-0 truncate">{row.value}</dd>
            </div>
          ))}
        </dl>
      </Section>

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
