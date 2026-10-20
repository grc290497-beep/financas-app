import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { format, parseISO } from "date-fns";
import { CalendarClock, ReceiptText } from "lucide-react";
import { MonthSwitcher, periodLabel } from "@/components/nav/month-switcher";
import { BudgetBar } from "@/components/budget/budget-bar";
import { GoalProgress, GoalStatusBadge } from "@/components/goals/goal-status";
import { CategoryIcon } from "@/components/transactions/category-icon";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireProfile } from "@/lib/auth";
import { computeMetrics, variation } from "@/lib/dashboard";
import { formatMoney } from "@/lib/money";
import { daysLeft, getFinancialPeriod, periodStartingIn, shiftPeriod } from "@/lib/period";
import { goalMetrics } from "@/lib/goals";
import { goalsPlannedThisMonth, listGoals } from "@/lib/goals-store";
import { ensureRecurringGenerated, listPlanned } from "@/lib/recurring-store";
import { currentDate, getCategorySpend, getMonthSummary } from "@/lib/transactions";
import { cn } from "@/lib/utils";
import { transactionFiltersSchema } from "@/lib/validators";

const dayMonth = (date: string) => format(parseISO(date), "dd/MM");
const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });
const signedPercent = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 0,
  signDisplay: "exceptZero",
});

export default function DashboardPage({ searchParams }: PageProps<"/app">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Dashboard({ searchParams }: { searchParams: PageProps<"/app">["searchParams"] }) {
  const profile = await requireProfile();
  if (!profile.onboardingDone) {
    redirect("/onboarding");
  }

  const raw = await searchParams;
  const { month } = transactionFiltersSchema.parse({
    month: Array.isArray(raw.month) ? raw.month[0] : raw.month,
  });

  // Plan fixed costs (this month, or the future month being viewed) before reading anything (PLAN.md 3.4).
  const today = await currentDate();
  await ensureRecurringGenerated(today, month);
  const msd = profile.monthStartDay;
  const current = getFinancialPeriod(today, msd);
  const period = month ? periodStartingIn(month, msd) : current;
  const isCurrent = period.start === current.start;

  const [t, summary, spend, previousSpend, planned, goals] = await Promise.all([
    getTranslations("Dashboard"),
    getMonthSummary(period),
    getCategorySpend(period),
    getCategorySpend(shiftPeriod(period, msd, -1)),
    listPlanned(period.start, period.end),
    listGoals(),
  ]);

  const primary = profile.primaryCurrency;
  // Goals only set money aside in the current month; past months are history.
  const goalsPlannedCents = isCurrent ? await goalsPlannedThisMonth(goals, primary, today) : 0;
  const m = computeMetrics(summary, isCurrent ? daysLeft(period, today) : 0, goalsPlannedCents);
  const highlightedGoals = goals.filter((g) => g.status === "active").slice(0, 3);
  const previousById = new Map(previousSpend.map((c) => [c.id, c.spentCents]));
  const budgets = spend.filter((c) => c.budgetCents);
  const top = spend.filter((c) => c.spentCents > 0).slice(0, 5);
  const upcoming = planned.filter((p) => p.type === "expense").slice(0, 5);
  const isEmpty = summary.incomeCents === 0 && summary.expenseCents === 0 && planned.length === 0;

  const monthLink = (count: number) =>
    `/app?month=${shiftPeriod(period, msd, count).start.slice(0, 7)}`;

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {profile.displayName ? t("greeting", { name: profile.displayName }) : t("greetingNoName")}
        </h1>
        <MonthSwitcher
          className="mt-2"
          label={periodLabel(period, msd)}
          previousHref={monthLink(-1)}
          nextHref={monthLink(1)}
          previousLabel={t("previousPeriod")}
          nextLabel={t("nextPeriod")}
          currentHref={isCurrent ? undefined : "/app"}
          currentLabel={t("current")}
        />
      </div>

      {isEmpty ? (
        <section className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
          <ReceiptText className="size-10 text-muted-foreground" aria-hidden />
          <h2 className="text-lg font-medium">{t("emptyTitle")}</h2>
          <p className="max-w-sm text-sm text-pretty text-muted-foreground">
            {t("emptyDescription")}
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href="/app/fixed">{t("seeFixed")}</Link>
          </Button>
        </section>
      ) : (
        <>
          {/* The one coloured region: the number the month is steered by. */}
          <section
            className="hero-card flex flex-col gap-1.5 rounded-3xl px-5 py-6"
            aria-labelledby="free"
          >
            <h2 id="free" className="text-sm text-hero-muted">
              {t("freeToSpend")}
            </h2>
            <p
              className={cn(
                "text-5xl font-semibold tracking-tight text-brass-light tabular-nums",
                m.freeToSpendCents < 0 && "text-hero-negative",
              )}
            >
              {formatMoney(m.freeToSpendCents, primary)}
            </p>
            <p className="text-sm text-hero-muted">
              {isCurrent && m.freePerDayCents !== null
                ? t("perDay", {
                    amount: formatMoney(m.freePerDayCents, primary),
                    days: daysLeft(period, today),
                  })
                : t("freeToSpendHint")}
            </p>
            {goalsPlannedCents > 0 && (
              <p className="text-xs text-hero-muted">
                {t("goalsHint", { amount: formatMoney(goalsPlannedCents, primary) })}
              </p>
            )}
          </section>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-5 surface p-4 sm:grid-cols-3">
            <Metric label={t("income")} value={formatMoney(m.incomeCents, primary)} />
            <Metric label={t("expenses")} value={formatMoney(m.expenseCents, primary)} />
            <Metric
              label={t("balance")}
              value={formatMoney(m.balanceCents, primary)}
              negative={m.balanceCents < 0}
            />
            <Metric label={t("fixed")} value={formatMoney(m.fixedPlannedCents, primary)} />
            <Metric
              label={t("savingsRate")}
              value={m.savingsRate === null ? t("noRate") : percent.format(m.savingsRate)}
              negative={(m.savingsRate ?? 0) < 0}
            />
          </dl>
          <p className="-mt-3 text-xs text-muted-foreground">
            {t("inPrimary", { currency: primary })}
          </p>

          {highlightedGoals.length > 0 && (
            <Section
              title={t("goals")}
              action={
                <Link
                  href="/app/goals"
                  className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  {t("seeGoals")}
                </Link>
              }
            >
              <ul className="surface flex flex-col gap-4 p-4">
                {highlightedGoals.map((goal) => {
                  const g = goalMetrics(goal, goal.contributions, today);
                  return (
                    <li key={goal.id}>
                      <Link href={`/app/goals/${goal.id}`} className="flex flex-col gap-1.5">
                        <span className="flex items-baseline justify-between gap-2 text-sm">
                          <span className="truncate">{goal.name}</span>
                          <GoalStatusBadge status={g.status} />
                        </span>
                        <GoalProgress progress={g.progress} color={goal.color ?? "#64748b"} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}

          <Section
            title={t("upcoming")}
            action={
              <Link
                href="/app/fixed"
                className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                {t("seeFixed")}
              </Link>
            }
          >
            {upcoming.length === 0 ? (
              <p className="surface flex items-center gap-2 px-4 py-3.5 text-sm text-muted-foreground">
                <CalendarClock className="size-4" aria-hidden />
                {t("noUpcoming")}
              </p>
            ) : (
              <ul className="surface divide-y">
                {upcoming.map((bill) => (
                  <li
                    key={bill.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span
                        className={cn(
                          "w-11 shrink-0 tabular-nums",
                          bill.occurredOn < today ? "text-negative" : "text-muted-foreground",
                        )}
                      >
                        {dayMonth(bill.occurredOn)}
                      </span>
                      <span className="truncate">{bill.description}</span>
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {formatMoney(bill.amountCents, bill.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section
            title={t("budgets")}
            action={
              <Link
                href="/app/budget"
                className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                {t("editBudgets")}
              </Link>
            }
          >
            {budgets.length === 0 ? (
              <p className="surface px-4 py-3.5 text-sm text-muted-foreground">{t("noBudgets")}</p>
            ) : (
              <ul className="surface flex flex-col gap-4 p-4">
                {budgets.map((c) => (
                  <li key={c.id} className="flex flex-col gap-1.5">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate">{c.name}</span>
                      <span className="shrink-0 text-muted-foreground tabular-nums">
                        {t("budgetLine", {
                          spent: formatMoney(c.spentCents, primary),
                          budget: formatMoney(c.budgetCents!, primary),
                        })}
                      </span>
                    </div>
                    <BudgetBar
                      spentCents={c.spentCents}
                      budgetCents={c.budgetCents!}
                      label={c.name}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {top.length > 0 && (
            <Section title={t("topCategories")}>
              <ul className="surface divide-y">
                {top.map((c) => {
                  const change = variation(c.spentCents, previousById.get(c.id) ?? 0);
                  return (
                    <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                      <CategoryIcon icon={c.icon} color={c.color} />
                      <span className="min-w-0 flex-1 truncate">{c.name}</span>
                      <span className="flex shrink-0 flex-col items-end">
                        <span className="font-medium tabular-nums">
                          {formatMoney(c.spentCents, primary)}
                        </span>
                        {change !== null && (
                          <span
                            className={cn(
                              "text-xs tabular-nums",
                              change > 0
                                ? "text-negative"
                                : change < 0
                                  ? "text-positive"
                                  : "text-muted-foreground",
                            )}
                          >
                            {t("vsPrevious", { change: signedPercent.format(change) })}
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}
        </>
      )}
    </>
  );
}

function Metric({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("truncate text-lg font-medium tabular-nums", negative && "text-negative")}>
        {value}
      </dd>
    </div>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-base font-medium">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-full" />
      </div>
      <Skeleton className="h-40 w-full rounded-3xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}
