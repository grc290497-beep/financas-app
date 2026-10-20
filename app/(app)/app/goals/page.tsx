import { Suspense } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Target } from "lucide-react";
import { GoalSheet } from "@/components/goals/goal-form";
import { GoalProgress, GoalStatusBadge } from "@/components/goals/goal-status";
import { CategoryIcon } from "@/components/transactions/category-icon";
import { Skeleton } from "@/components/ui/skeleton";
import { requireProfile } from "@/lib/auth";
import { goalMetrics } from "@/lib/goals";
import { listGoals } from "@/lib/goals-store";
import { formatMoney } from "@/lib/money";
import { currentDate } from "@/lib/transactions";

const ADD_BUTTON =
  "inline-flex h-9 items-center gap-2 self-start rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90";

const monthYear = (date: string) => format(parseISO(date), "MMM/yyyy", { locale: ptBR });

export default async function GoalsPage() {
  const t = await getTranslations("Goals");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
        <Goals />
      </Suspense>
    </main>
  );
}

async function Goals() {
  // Profile first: it resolves the session (request time) before the goal query.
  const profile = await requireProfile();
  const [today, goals, t] = await Promise.all([
    currentDate(),
    listGoals(),
    getTranslations("Goals"),
  ]);

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
      <ul className="flex flex-col gap-3">
        {goals.map((goal) => {
          const m = goalMetrics(goal, goal.contributions, today);
          const color = goal.color ?? "#64748b";
          return (
            <li key={goal.id}>
              <Link
                href={`/app/goals/${goal.id}`}
                className="flex flex-col gap-3 rounded-xl border p-4 transition-colors hover:bg-muted/50"
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
                    {m.status === "done"
                      ? t("planDone")
                      : t("plan", {
                          amount: formatMoney(m.requiredMonthlyCents, goal.currency),
                          deadline: monthYear(goal.deadline),
                        })}
                  </span>
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
