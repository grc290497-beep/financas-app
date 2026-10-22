import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { BudgetBar } from "@/components/budget/budget-bar";
import { BudgetLimitInput } from "@/components/budget/budget-row";
import { MonthSwitcher, periodLabel } from "@/components/nav/month-switcher";
import { CategoryIcon } from "@/components/transactions/category-icon";
import { Skeleton } from "@/components/ui/skeleton";
import { requireProfile } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { getFinancialPeriod, periodStartingIn, shiftPeriod } from "@/lib/period";
import { ensureRecurringGenerated } from "@/lib/recurring-store";
import { currentDate, getCategorySpend } from "@/lib/transactions";
import { transactionFiltersSchema } from "@/lib/validators";

export default async function BudgetPage({ searchParams }: PageProps<"/app/budget">) {
  const t = await getTranslations("Budget");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <Budget searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Budget({
  searchParams,
}: {
  searchParams: PageProps<"/app/budget">["searchParams"];
}) {
  const raw = await searchParams;
  const { month } = transactionFiltersSchema.parse({
    month: Array.isArray(raw.month) ? raw.month[0] : raw.month,
  });
  // Profile first: it resolves the session (request time) before other queries.
  const profile = await requireProfile();
  const today = await currentDate();
  // A future month's fixed costs must exist before its spending can be shown.
  await ensureRecurringGenerated(today, month);
  const t = await getTranslations("Budget");
  const msd = profile.monthStartDay;
  const current = getFinancialPeriod(today, msd);
  const period = month ? periodStartingIn(month, msd) : current;
  const categories = await getCategorySpend(period);
  const primary = profile.primaryCurrency;
  const monthLink = (count: number) =>
    `/app/budget?month=${shiftPeriod(period, msd, count).start.slice(0, 7)}`;

  return (
    <>
      <MonthSwitcher
        label={periodLabel(period, msd)}
        previousHref={monthLink(-1)}
        nextHref={monthLink(1)}
        previousLabel={t("previousMonth")}
        nextLabel={t("nextMonth")}
        currentHref={period.start === current.start ? undefined : "/app/budget"}
        currentLabel={t("current")}
      />
      <p className="text-sm text-muted-foreground">{t("description", { currency: primary })}</p>
      <ul className="surface divide-y">
        {categories.map((c) => (
          <li key={c.id} className="flex flex-col gap-2.5 px-4 py-3.5">
            <div className="flex items-start gap-3">
              <CategoryIcon icon={c.icon} color={c.color} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">{c.name}</span>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {t("spent", { spent: formatMoney(c.spentCents, primary) })}
                  {c.plannedCents > 0 &&
                    ` ${t("planned", { planned: formatMoney(c.plannedCents, primary) })}`}
                </span>
              </div>
              <BudgetLimitInput
                categoryId={c.id}
                name={c.name}
                budgetCents={c.budgetCents}
                symbol={primary === "EUR" ? "€" : "R$"}
              />
            </div>
            {c.budgetCents ? (
              <BudgetBar spentCents={c.spentCents} budgetCents={c.budgetCents} label={c.name} />
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}
