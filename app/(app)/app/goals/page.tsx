import { Suspense } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Target } from "lucide-react";
import { GoalSheet } from "@/components/goals/goal-form";
import { MonthSwitcher } from "@/components/nav/month-switcher";
import { GoalProgress, GoalStatusBadge } from "@/components/goals/goal-status";
import { CategoryIcon } from "@/components/transactions/category-icon";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireProfile } from "@/lib/auth";
import { addMonths } from "@/lib/dates";
import { goalMetrics, goalMonthView, monthStart } from "@/lib/goals";
import { listGoals } from "@/lib/goals-store";
import { formatMoney } from "@/lib/money";
import { currentDate } from "@/lib/transactions";
import { transactionFiltersSchema } from "@/lib/validators";

const ADD_BUTTON = buttonVariants({ className: "self-start" });

const monthYear = (date: string) => format(parseISO(date), "MMM/yyyy", { locale: ptBR });

export default async function GoalsPage({ searchParams }: PageProps<"/app/goals">) {
  const t = await getTranslations("Goals");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
        <Goals searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Goals({ searchParams }: { searchParams: PageProps<"/app/goals">["searchParams"] }) {
  const raw = await searchParams;
  const { month } = transactionFiltersSchema.parse({
    month: Array.isArray(raw.month) ? raw.month[0] : raw.month,
  });
  // Profile first: it resolves the session (request time) before the goal query.
  const profile = await requireProfile();
  const [today, goals, t] = await Promise.all([
    currentDate(),
    listGoals(),
    getTranslations("Goals"),
  ]);
  // Goals plan by calendar month (yyyy-MM-01).
  const thisMonth = monthStart(today);
  const viewed = month ? `${month}-01` : thisMonth;
  const viewedLabel = format(parseISO(viewed), "MMM/yyyy", { locale: ptBR });
  const monthLink = (count: number) => `/app/goals?month=${addMonths(viewed, count).slice(0, 7)}`;

  const addButton = (
    <GoalSheet primaryCurrency={profile.primaryCurrency} className={ADD_BUTTON}>
      <Plus className="size-4" aria-hidden />
      {t("add")}
    </GoalSheet>
  );

  if (goals.length === 0) {
    return (
      <section className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
        <Target className="size-10 text-muted-foreground" aria-hidden />
        <h2 className="text-lg font-medium">{t("empty.title")}</h2>
        <p className="max-w-sm text-sm text-pretty text-muted-foreground">
          {t("empty.description")}
        </p>
        <div className="pt-2">{addButton}</div>
      </section>
    );
  }

  return (
    <>
      <MonthSwitcher
        label={format(parseISO(viewed), "MMMM 'de' yyyy", { locale: ptBR })}
        previousHref={monthLink(-1)}
        nextHref={monthLink(1)}
        previousLabel={t("previousMonth")}
        nextLabel={t("nextMonth")}
        currentHref={viewed === thisMonth ? undefined : "/app/goals"}
        currentLabel={t("currentMonth")}
      />
      <ul className="flex flex-col gap-3">
        {goals.map((goal) => {
          const m = goalMetrics(goal, goal.contributions, today);
          const view = goalMonthView(goal, goal.contributions, today, viewed);
          const money = (cents: number) => formatMoney(cents, goal.currency);
          const color = goal.color ?? "#64748b";
          return (
            <li key={goal.id}>
              <Link
                href={`/app/goals/${goal.id}`}
                className="flex flex-col gap-3 surface p-4 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <CategoryIcon icon={goal.icon} color={color} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{goal.name}</span>
                    <GoalStatusBadge status={m.status} />
                  </div>
                </div>
                <GoalProgress progress={m.progress} color={color} />
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
                  <span className="tabular-nums">
                    {t("of", {
                      saved: formatMoney(m.accumulatedCents, goal.currency),
                      target: formatMoney(goal.targetCents, goal.currency),
                    })}
                  </span>
                  <span className="text-muted-foreground">
                    {view.kind === "past"
                      ? t("monthContributed", {
                          month: viewedLabel,
                          amount: money(view.contributedCents),
                        })
                      : m.status === "done"
                        ? t("planDone")
                        : view.kind === "future"
                          ? t("monthPlanned", { month: viewedLabel, amount: money(view.cents) })
                          : view.cents > 0
                            ? t("thisMonthDue", {
                                due: money(view.cents),
                                installment: money(m.installmentCents),
                              })
                            : t("thisMonthDone")}
                  </span>
                  {view.kind === "current" &&
                    m.status !== "done" &&
                    m.laterMonthlyCents !== null && (
                      <span className="w-full text-xs text-muted-foreground">
                        {t("later", {
                          amount: money(m.laterMonthlyCents),
                          deadline: monthYear(goal.deadline),
                        })}
                      </span>
                    )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      {addButton}
    </>
  );
}
