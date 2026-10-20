import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { format, parseISO } from "date-fns";
import { BudgetBar } from "@/components/budget/budget-bar";
import { BudgetLimitInput } from "@/components/budget/budget-row";
import { CategoryIcon } from "@/components/transactions/category-icon";
import { Skeleton } from "@/components/ui/skeleton";
import { requireProfile } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { getFinancialPeriod } from "@/lib/period";
import { currentDate, getCategorySpend } from "@/lib/transactions";

const dayMonth = (date: string) => format(parseISO(date), "dd/MM");

export default async function BudgetPage() {
  const t = await getTranslations("Budget");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <Budget />
      </Suspense>
    </main>
  );
}

async function Budget() {
  const [profile, today, t] = await Promise.all([
    requireProfile(),
    currentDate(),
    getTranslations("Budget"),
  ]);
  const period = getFinancialPeriod(today, profile.monthStartDay);
  const categories = await getCategorySpend(period);
  const primary = profile.primaryCurrency;

  return (
    <>
      <p className="text-sm text-muted-foreground">
        {t("description", { currency: primary })}{" "}
        {t("period", { start: dayMonth(period.start), end: dayMonth(period.end) })}.
      </p>
      <ul className="divide-y rounded-xl border">
        {categories.map((c) => (
          <li key={c.id} className="flex flex-col gap-2 p-3">
            <div className="flex items-center gap-3">
              <CategoryIcon icon={c.icon} color={c.color} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">{c.name}</span>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {t("spent", { spent: formatMoney(c.spentCents, primary) })}
                  {c.plannedCents > 0 &&
                    ` ${t("planned", { planned: formatMoney(c.plannedCents, primary) })}`}
                  {c.budgetCents
                    ? ` ${t("of", { budget: formatMoney(c.budgetCents, primary) })}`
                    : ""}
                </span>
              </div>
            </div>
            {c.budgetCents ? (
              <BudgetBar spentCents={c.spentCents} budgetCents={c.budgetCents} label={c.name} />
            ) : null}
            <BudgetLimitInput categoryId={c.id} name={c.name} budgetCents={c.budgetCents} />
          </li>
        ))}
      </ul>
    </>
  );
}
