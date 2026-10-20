import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CalendarClock, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireProfile } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { getFinancialPeriod } from "@/lib/period";
import { ensureRecurringGenerated, listPlanned } from "@/lib/recurring-store";
import { currentDate, currentMonth, listTransactions } from "@/lib/transactions";
import type { Currency } from "@/lib/validators";

export default function DashboardPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-8">
      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard />
      </Suspense>
    </main>
  );
}

async function Dashboard() {
  const profile = await requireProfile();
  if (!profile.onboardingDone) {
    redirect("/onboarding");
  }

  // Plan this month's fixed costs before reading anything (PLAN.md 3.4).
  const today = await currentDate();
  await ensureRecurringGenerated(today);
  const period = getFinancialPeriod(today, profile.monthStartDay);

  const [t, tTx, rows, planned] = await Promise.all([
    getTranslations("Dashboard"),
    getTranslations("Transactions"),
    currentMonth().then((month) => listTransactions({ month })),
    listPlanned(period.start, period.end),
  ]);
  const primary = profile.primaryCurrency;
  // Totals count only what was actually paid or received (PLAN.md section 6).
  const confirmed = rows.filter((r) => r.status === "confirmed");
  const income = confirmed
    .filter((r) => r.type === "income")
    .reduce((s, r) => s + r.amountPrimaryCents, 0);
  const expenses = confirmed
    .filter((r) => r.type === "expense")
    .reduce((s, r) => s + r.amountPrimaryCents, 0);
  const toPay = planned.filter((p) => p.type === "expense");
  const toPayTotal = toPay.reduce((s, p) => s + p.amountPrimaryCents, 0);

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {profile.displayName ? t("greeting", { name: profile.displayName }) : t("greetingNoName")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("summary", { currency: profile.primaryCurrency, day: profile.monthStartDay })}
        </p>
      </div>

      {toPay.length > 0 && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
          <p className="flex items-center gap-2 text-sm">
            <CalendarClock className="size-4 text-muted-foreground" aria-hidden />
            {t("pending", { count: toPay.length, amount: formatMoney(toPayTotal, primary) })}
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href="/app/fixed">{t("seeFixed")}</Link>
          </Button>
        </section>
      )}

      {rows.length === 0 ? (
        <section className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
          <ReceiptText className="size-10 text-muted-foreground" aria-hidden />
          <h2 className="text-lg font-medium">{t("emptyTitle")}</h2>
          <p className="max-w-sm text-sm text-pretty text-muted-foreground">
            {t("emptyDescription")}
          </p>
        </section>
      ) : (
        // Placeholder until the phase 4 dashboard: this month's totals in the primary currency.
        <section className="flex flex-col gap-3 rounded-xl border p-4">
          <dl className="grid grid-cols-3 gap-2 text-sm">
            <Total label={tTx("summary.income")} cents={income} currency={primary} />
            <Total label={tTx("summary.expenses")} cents={expenses} currency={primary} />
            <Total label={tTx("summary.balance")} cents={income - expenses} currency={primary} />
          </dl>
          <Button asChild variant="outline" className="self-start">
            <Link href="/app/transactions">{t("seeTransactions")}</Link>
          </Button>
        </section>
      )}
    </>
  );
}

function Total({ label, cents, currency }: { label: string; cents: number; currency: Currency }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium tabular-nums">{formatMoney(cents, currency)}</dd>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-hidden>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-52 w-full rounded-xl" />
    </div>
  );
}
