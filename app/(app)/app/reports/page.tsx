import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MonthSwitcher } from "@/components/nav/month-switcher";
import { CategoryPie, type CategorySlice } from "@/components/reports/category-pie";
import { MonthBars } from "@/components/reports/month-bars";
import { ExportLinks } from "@/components/settings/export-links";
import { Skeleton } from "@/components/ui/skeleton";
import { requireProfile } from "@/lib/auth";
import { computeMetrics } from "@/lib/dashboard";
import { formatMoney } from "@/lib/money";
import { getFinancialPeriod, periodStartingIn, shiftPeriod } from "@/lib/period";
import { currentDate, getCategorySpend, getMonthSummary } from "@/lib/transactions";
import { cn } from "@/lib/utils";
import { transactionFiltersSchema } from "@/lib/validators";

const MONTHS = 12;
const PIE_SLICES = 5; // the rest folds into "Outros"
const OTHER_COLOR = "#94a3b8";
const monthLabel = (start: string) => format(parseISO(start), "MMM/yy", { locale: ptBR });
const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });

export default function ReportsPage({ searchParams }: PageProps<"/app/reports">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
      <Suspense fallback={<ReportsSkeleton />}>
        <Reports searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Reports({
  searchParams,
}: {
  searchParams: PageProps<"/app/reports">["searchParams"];
}) {
  // Profile first: it resolves the session (request time) before other queries.
  const profile = await requireProfile();
  if (!profile.onboardingDone) redirect("/onboarding");

  const raw = await searchParams;
  const { month } = transactionFiltersSchema.parse({
    month: Array.isArray(raw.month) ? raw.month[0] : raw.month,
  });
  const msd = profile.monthStartDay;
  const current = getFinancialPeriod(await currentDate(), msd);
  const period = month ? periodStartingIn(month, msd) : current;
  const isCurrent = period.start === current.start;
  const periods = Array.from({ length: MONTHS }, (_, i) =>
    shiftPeriod(period, msd, i - MONTHS + 1),
  );

  const [t, summaries, spend] = await Promise.all([
    getTranslations("Reports"),
    Promise.all(periods.map(getMonthSummary)),
    getCategorySpend(period),
  ]);

  const primary = profile.primaryCurrency;
  const months = periods.map((p, i) => ({
    start: p.start,
    label: monthLabel(p.start),
    ...computeMetrics(summaries[i], 0),
  }));
  const paid = spend.filter((c) => c.spentCents > 0); // already sorted by spend
  const slices: CategorySlice[] = paid.slice(0, PIE_SLICES).map((c) => ({
    name: c.name,
    cents: c.spentCents,
    color: c.color ?? OTHER_COLOR,
  }));
  const otherCents = paid.slice(PIE_SLICES).reduce((sum, c) => sum + c.spentCents, 0);
  if (otherCents > 0) slices.push({ name: t("other"), cents: otherCents, color: OTHER_COLOR });
  const hasData = months.some((m) => m.incomeCents > 0 || m.expenseCents > 0);
  const monthLink = (count: number) =>
    `/app/reports?month=${shiftPeriod(period, msd, count).start.slice(0, 7)}`;

  return (
    <>
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <MonthSwitcher
          label={t("range", { from: months[0].label, to: months[MONTHS - 1].label })}
          previousHref={monthLink(-1)}
          nextHref={monthLink(1)}
          previousLabel={t("previous")}
          nextLabel={t("next")}
          currentHref={isCurrent ? undefined : "/app/reports"}
          currentLabel={t("current")}
        />
      </div>

      {hasData ? (
        <>
          <Section title={t("evolution")} hint={t("inPrimary", { currency: primary })}>
            <div className="surface p-4">
              <MonthBars
                data={months.map((m) => ({
                  label: m.label,
                  incomeCents: m.incomeCents,
                  expenseCents: m.expenseCents,
                }))}
                currency={primary}
              />
            </div>
          </Section>

          <Section title={t("byCategory", { month: months[MONTHS - 1].label })}>
            {slices.length ? (
              <div className="surface p-4">
                <CategoryPie slices={slices} currency={primary} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("noSpend")}</p>
            )}
          </Section>

          <Section title={t("comparison")}>
            <div className="surface overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th scope="col" className="px-2.5 py-2.5 text-left font-medium sm:px-3">
                      {t("month")}
                    </th>
                    {/* Phones drop the income column; the bar chart above already shows it. */}
                    <th
                      scope="col"
                      className="hidden px-3 py-2.5 text-right font-medium sm:table-cell"
                    >
                      {t("income")}
                    </th>
                    <th scope="col" className="px-2.5 py-2.5 text-right font-medium sm:px-3">
                      {t("expenses")}
                    </th>
                    <th scope="col" className="px-2.5 py-2.5 text-right font-medium sm:px-3">
                      {t("balance")}
                    </th>
                    <th scope="col" className="px-2.5 py-2.5 text-right font-medium sm:px-3">
                      {t("savingsRate")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y tabular-nums">
                  {[...months].reverse().map((m) => (
                    <tr key={m.start}>
                      <th scope="row" className="px-2.5 py-2.5 text-left font-normal sm:px-3">
                        {m.label}
                      </th>
                      <td className="hidden px-3 py-2.5 text-right sm:table-cell">
                        {formatMoney(m.incomeCents, primary)}
                      </td>
                      <td className="px-2.5 py-2.5 text-right sm:px-3">
                        {formatMoney(m.expenseCents, primary)}
                      </td>
                      <td
                        className={cn(
                          "px-2.5 py-2.5 text-right sm:px-3",
                          m.balanceCents < 0 && "text-negative",
                        )}
                      >
                        {formatMoney(m.balanceCents, primary)}
                      </td>
                      <td
                        className={cn(
                          "px-2.5 py-2.5 text-right sm:px-3",
                          (m.savingsRate ?? 0) < 0 && "text-negative",
                        )}
                      >
                        {m.savingsRate === null ? "—" : percent.format(m.savingsRate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </>
      ) : (
        <p className="rounded-xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
          {t("empty")}
        </p>
      )}

      <Section title={t("export")} hint={t("exportHint")}>
        <ExportLinks />
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

function ReportsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-9 w-full" />
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
      <Skeleton className="h-44 w-full rounded-xl" />
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  );
}
