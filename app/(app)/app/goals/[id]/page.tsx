import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, Pencil } from "lucide-react";
import { z } from "zod";
import { ContributionButtons } from "@/components/goals/contribution-sheet";
import { DeleteContributionButton, GoalActions } from "@/components/goals/goal-actions";
import { GoalChart } from "@/components/goals/goal-chart";
import { GoalSheet } from "@/components/goals/goal-form";
import { GoalProgress, GoalStatusBadge } from "@/components/goals/goal-status";
import { CategoryIcon } from "@/components/transactions/category-icon";
import { Skeleton } from "@/components/ui/skeleton";
import { requireProfile } from "@/lib/auth";
import { evolutionSeries, goalMetrics } from "@/lib/goals";
import { getGoal } from "@/lib/goals-store";
import { formatAmountInput, formatMoney } from "@/lib/money";
import { currentDate } from "@/lib/transactions";
import { cn } from "@/lib/utils";
import type { GoalInput } from "@/lib/validators";

const monthYear = (date: string) => format(parseISO(date), "MMM/yyyy", { locale: ptBR });
const dayMonthYear = (date: string) => format(parseISO(date), "dd/MM/yyyy");

export default function GoalPage({ params }: PageProps<"/app/goals/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <GoalDetail params={params} />
      </Suspense>
    </main>
  );
}

async function GoalDetail({ params }: { params: PageProps<"/app/goals/[id]">["params"] }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [profile, today, goal, t] = await Promise.all([
    requireProfile(),
    currentDate(),
    getGoal(id),
    getTranslations("Goals"),
  ]);
  if (!goal) notFound();

  const m = goalMetrics(goal, goal.contributions, today);
  const color = goal.color ?? "#64748b";
  const money = (cents: number) => formatMoney(cents, goal.currency);

  return (
    <>
      <div className="flex flex-col gap-3">
        <Link
          href="/app/goals"
          className="inline-flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {t("back")}
        </Link>
        <div className="flex items-center gap-3">
          <CategoryIcon icon={goal.icon} color={color} className="size-11" />
          <div className="flex min-w-0 flex-1 flex-col">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{goal.name}</h1>
            <GoalStatusBadge status={m.status} />
          </div>
          <GoalSheet
            primaryCurrency={profile.primaryCurrency}
            initial={{
              id: goal.id,
              name: goal.name,
              target: formatAmountInput(goal.targetCents),
              currency: goal.currency,
              initial: goal.initialCents ? formatAmountInput(goal.initialCents) : "",
              deadline: goal.deadline,
              icon: goal.icon as GoalInput["icon"],
              color: goal.color as GoalInput["color"],
            }}
            className="inline-flex size-9 items-center justify-center rounded-md hover:bg-muted"
          >
            <Pencil className="size-4" aria-hidden />
            <span className="sr-only">{t("edit")}</span>
          </GoalSheet>
        </div>
      </div>

      <section className="flex flex-col gap-3 rounded-xl border p-4">
        <p className="text-sm text-muted-foreground tabular-nums">
          {t("of", { saved: money(m.accumulatedCents), target: money(goal.targetCents) })}
        </p>
        <GoalProgress progress={m.progress} color={color} />
        <p className="text-base font-medium">
          {m.status === "done"
            ? t("planDone")
            : t("plan", {
                amount: money(m.requiredMonthlyCents),
                deadline: monthYear(goal.deadline),
              })}
        </p>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <Metric label={t("metrics.saved")} value={money(m.accumulatedCents)} />
          <Metric label={t("metrics.remaining")} value={money(m.remainingCents)} />
          <Metric
            label={t("metrics.monthly")}
            value={money(m.requiredMonthlyCents)}
            hint={t("metrics.monthsLeft", { count: m.monthsRemaining })}
          />
          <Metric
            label={t("metrics.pace")}
            value={t("metrics.perMonth", { amount: money(m.pacePerMonthCents) })}
          />
          <Metric
            label={t("metrics.forecast")}
            value={m.forecastDate ? monthYear(m.forecastDate) : t("metrics.noForecast")}
            negative={!!m.forecastDate && m.forecastDate > goal.deadline}
          />
        </dl>
      </section>

      <ContributionButtons goalId={goal.id} goalCurrency={goal.currency} />

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-medium">{t("chart")}</h2>
        <GoalChart
          points={evolutionSeries(goal, goal.contributions, today)}
          targetCents={goal.targetCents}
          currency={goal.currency}
          color={color}
        />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-medium">{t("history")}</h2>
        {goal.contributions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noHistory")}</p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {goal.contributions.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                <span className="w-20 shrink-0 text-muted-foreground tabular-nums">
                  {dayMonthYear(c.contributedOn)}
                </span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{c.note}</span>
                <span className="flex shrink-0 flex-col items-end">
                  <span
                    className={cn(
                      "font-medium tabular-nums",
                      c.amountGoalCents > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-destructive",
                    )}
                  >
                    {c.amountGoalCents > 0 ? "+" : "−"}{" "}
                    {formatMoney(Math.abs(c.amountCents), c.currency)}
                  </span>
                  {c.currency !== goal.currency && (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      ≈ {money(Math.abs(c.amountGoalCents))}
                    </span>
                  )}
                </span>
                <DeleteContributionButton id={c.id} dateLabel={dayMonthYear(c.contributedOn)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <GoalActions goalId={goal.id} done={goal.status === "done"} />
    </>
  );
}

function Metric({
  label,
  value,
  hint,
  negative,
}: {
  label: string;
  value: string;
  hint?: string;
  negative?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("truncate font-medium tabular-nums", negative && "text-destructive")}>
        {value}
      </dd>
      {hint && <dd className="text-xs text-muted-foreground">{hint}</dd>}
    </div>
  );
}
