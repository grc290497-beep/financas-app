import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ReceiptText } from "lucide-react";
import { MonthSwitcher, periodLabel } from "@/components/nav/month-switcher";
import { BudgetBar } from "@/components/budget/budget-bar";
import { AnimatedMoney } from "@/components/dashboard/animated-money";
import { Sparkline } from "@/components/dashboard/sparkline";
import { InstallAppButton } from "@/components/pwa/install-app";
import { GoalProgress, GoalStatusBadge } from "@/components/goals/goal-status";
import { CategoryIcon } from "@/components/transactions/category-icon";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireProfile } from "@/lib/auth";
import { computeMetrics, dailyBalance, variation } from "@/lib/dashboard";
import { formatMoney } from "@/lib/money";
import { daysLeft, getFinancialPeriod, periodStartingIn, shiftPeriod } from "@/lib/period";
import { goalMetrics } from "@/lib/goals";
import { goalsPlannedThisMonth, listGoals } from "@/lib/goals-store";
import { ensureRecurringGenerated, listPlanned } from "@/lib/recurring-store";
import { TransactionDayList } from "@/components/transactions/transaction-day-list";
import {
  currentDate,
  getBalanceBefore,
  getCategories,
  getCategorySpend,
  getCategoryUsage,
  getMonthSummary,
  getMovements,
  listTransactions,
} from "@/lib/transactions";
import { cn } from "@/lib/utils";
import { transactionFiltersSchema, type Currency } from "@/lib/validators";

const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });
const signedPercent = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 0,
  signDisplay: "exceptZero",
});

export default function DashboardPage({ searchParams }: PageProps<"/app">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl lg:max-w-5xl flex-1 flex-col gap-6 px-4 py-6">
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

  const previous = shiftPeriod(period, msd, -1);
  // The month so far: up to today, or the whole of a past month.
  const lastDay = period.end < today ? period.end : today;
  const [
    t,
    summary,
    previousSummary,
    spend,
    previousSpend,
    planned,
    goals,
    recent,
    carriedCents,
    categories,
    usage,
    movements,
  ] = await Promise.all([
    getTranslations("Dashboard"),
    getMonthSummary(period),
    getMonthSummary(previous),
    getCategorySpend(period),
    getCategorySpend(previous),
    listPlanned(period.start, period.end),
    listGoals(),
    // Up to today: future planned items stay out of sight, as on Lançamentos.
    period.start <= today
      ? listTransactions(
          {},
          { start: period.start, end: period.end < today ? period.end : today },
          5,
        )
      : [],
    profile.carryOver
      ? getBalanceBefore(period.start).then((cents) => cents + profile.openingBalanceCents)
      : 0,
    // Same per-request cache as the quick-add sheet: tapping a recent entry edits it.
    getCategories(),
    getCategoryUsage(),
    period.start <= today ? getMovements(period.start, lastDay) : [],
  ]);

  const primary = profile.primaryCurrency;
  // Goals only set money aside in the current month; past months are history.
  const goalsPlannedCents = isCurrent ? await goalsPlannedThisMonth(goals, primary, today) : 0;
  // Expected income counts for this month and future ones; in a past month it simply never came.
  const plannedIncomeCents =
    period.end >= today
      ? planned.filter((p) => p.type === "income").reduce((sum, p) => sum + p.amountPrimaryCents, 0)
      : 0;
  const m = computeMetrics(
    summary,
    isCurrent ? daysLeft(period, today) : 0,
    goalsPlannedCents,
    plannedIncomeCents,
    carriedCents,
  );
  const highlightedGoals = goals.filter((g) => g.status === "active").slice(0, 3);
  const previousById = new Map(previousSpend.map((c) => [c.id, c.spentCents]));
  const budgets = spend.filter((c) => c.budgetCents);
  const top = spend.filter((c) => c.spentCents > 0).slice(0, 5);
  const isEmpty =
    summary.incomeCents === 0 &&
    summary.expenseCents === 0 &&
    planned.length === 0 &&
    carriedCents === 0;
  const spendChange = variation(summary.expenseCents, previousSummary.expenseCents);

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

      <InstallAppButton look="banner" />

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
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <div className="flex flex-col gap-6">
            {/* The one coloured region: what there is to work with today. */}
            <section
              className="hero-card flex flex-col gap-1.5 rounded-3xl px-5 py-6"
              aria-labelledby="available"
            >
              <h2 id="available" className="text-sm text-hero-muted">
                {t("available")}
              </h2>
              <p
                className={cn(
                  "text-5xl font-semibold tracking-tight text-brass-light tabular-nums",
                  m.balanceCents < 0 && "text-hero-negative",
                )}
              >
                <AnimatedMoney id="available" cents={m.balanceCents} currency={primary} />
              </p>
              {/* tabular-nums: the sentence carries an amount, so it blurs with the rest. */}
              <p className="text-sm text-hero-muted tabular-nums">
                {profile.carryOver
                  ? t("availableHintCarry", { amount: formatMoney(carriedCents, primary) })
                  : t("availableHint")}
              </p>
              {movements.length > 0 && (
                <div className="-mx-1 mt-2">
                  <Sparkline
                    values={dailyBalance(movements, period.start, lastDay, carriedCents)}
                  />
                </div>
              )}
            </section>

            <MonthProjection
              m={m}
              primary={primary}
              perDay={
                isCurrent && m.leftoverPerDayCents !== null
                  ? t("perDay", {
                      amount: formatMoney(m.leftoverPerDayCents, primary),
                      days: daysLeft(period, today),
                    })
                  : null
              }
            />

            {recent.length > 0 && (
              <Section
                title={t("recent")}
                action={
                  <Link
                    href={isCurrent ? "/app/transactions" : `/app/transactions?month=${month}`}
                    className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    {t("seeAll")}
                  </Link>
                }
              >
                <TransactionDayList
                  compact
                  rows={recent}
                  today={today}
                  primaryCurrency={primary}
                  categories={categories}
                  usage={usage}
                />
              </Section>
            )}
          </div>
          <div className="flex flex-col gap-6">
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
                <p className="surface px-4 py-3.5 text-sm text-muted-foreground">
                  {t("noBudgets")}
                </p>
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
              <Section
                title={t("topCategories")}
                action={
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {t("spentTotal", { amount: formatMoney(summary.expenseCents, primary) })}
                    {spendChange !== null && (
                      <>
                        {" · "}
                        <span className={spendChange > 0 ? "text-negative" : "text-positive"}>
                          {t("vsPrevious", { change: signedPercent.format(spendChange) })}
                        </span>
                      </>
                    )}
                  </span>
                }
              >
                <ul className="surface divide-y">
                  {top.map((c) => {
                    const change = variation(c.spentCents, previousById.get(c.id) ?? 0);
                    return (
                      <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                        <CategoryIcon icon={c.icon} color={c.color} />
                        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                          <span className="truncate">{c.name}</span>
                          {/* Its share of the month's spending. */}
                          <span className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                            <span
                              className="grow-x block h-full rounded-full"
                              style={{
                                width: `${(c.spentCents / Math.max(summary.expenseCents, 1)) * 100}%`,
                                backgroundColor: c.color ?? "#64748b",
                              }}
                            />
                          </span>
                        </span>
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
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Where the month ends up: expected income split into what goes out, what is
 * set aside for goals and what is left. The bar is the chart; the list beside
 * it carries the exact figures (and the meaning, so colour is never alone).
 */
async function MonthProjection({
  m,
  primary,
  perDay,
}: {
  m: ReturnType<typeof computeMetrics>;
  primary: Currency;
  perDay: string | null;
}) {
  const t = await getTranslations("Dashboard");
  const short = m.leftoverCents < 0;
  // When more goes out than comes in, the bar is scaled to the outflow instead.
  const total = Math.max(
    m.projectedIncomeCents + Math.max(m.carriedCents, 0),
    m.projectedExpenseCents + m.goalsPlannedCents,
    1,
  );
  const width = (cents: number) => `${(Math.max(cents, 0) / total) * 100}%`;
  const rows = [
    ...(m.carriedCents !== 0 ? [{ label: t("carried"), cents: m.carriedCents, swatch: null }] : []),
    { label: t("projectedIncome"), cents: m.projectedIncomeCents, swatch: null },
    { label: t("projectedExpenses"), cents: m.projectedExpenseCents, swatch: "bg-expense" },
    ...(m.goalsPlannedCents > 0
      ? [{ label: t("goalsReserved"), cents: m.goalsPlannedCents, swatch: "bg-hero-muted" }]
      : []),
  ];

  return (
    <section className="surface flex flex-col gap-4 p-4" aria-labelledby="projection">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="projection" className="text-base font-medium">
          {t("projection")}
        </h2>
        <span className="text-xs text-muted-foreground">
          {t("inPrimaryShort", { currency: primary })}
        </span>
      </div>

      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <span className="h-full bg-expense" style={{ width: width(m.projectedExpenseCents) }} />
        {m.goalsPlannedCents > 0 && (
          <span className="h-full bg-hero-muted" style={{ width: width(m.goalsPlannedCents) }} />
        )}
        {!short && (
          <span className="h-full bg-positive" style={{ width: width(m.leftoverCents) }} />
        )}
      </div>

      <dl className="flex flex-col gap-2 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-2 text-muted-foreground">
              {row.swatch && <span className={cn("size-2.5 rounded-sm", row.swatch)} aria-hidden />}
              {row.label}
            </dt>
            <dd className="tabular-nums">{formatMoney(row.cents, primary)}</dd>
          </div>
        ))}
        <div className="mt-1 flex items-center justify-between gap-3 border-t pt-3">
          <dt className="flex items-center gap-2 font-medium">
            <span
              className={cn("size-2.5 rounded-sm", short ? "bg-negative" : "bg-positive")}
              aria-hidden
            />
            {short ? t("shortfall") : t("leftover")}
          </dt>
          <dd
            className={cn(
              "text-lg font-semibold tabular-nums",
              short ? "text-negative" : "text-positive",
            )}
          >
            <AnimatedMoney id="leftover" cents={Math.abs(m.leftoverCents)} currency={primary} />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3 text-muted-foreground">
          <dt>{t("leftoverRate")}</dt>
          <dd className="tabular-nums">
            {m.leftoverRate === null ? t("noRate") : percent.format(m.leftoverRate)}
          </dd>
        </div>
      </dl>
      {perDay && <p className="text-xs text-muted-foreground tabular-nums">{perDay}</p>}
    </section>
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
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
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
