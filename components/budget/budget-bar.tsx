import { budgetLevel } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

const LEVEL_CLASS = {
  ok: "bg-budget-ok",
  warning: "bg-budget-warning",
  over: "bg-budget-over",
} as const;

/** Spent against a budget: green, yellow from 80%, red from 100% (PLAN.md 3.6). */
export function BudgetBar({
  spentCents,
  budgetCents,
  label,
}: {
  spentCents: number;
  budgetCents: number;
  label: string;
}) {
  const level = budgetLevel(spentCents, budgetCents);
  const percent = Math.round((spentCents / budgetCents) * 100);

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.min(percent, 100)}
      aria-valuetext={`${percent}%`}
      className="h-2 w-full overflow-hidden rounded-full bg-muted"
    >
      <div
        className={cn("grow-x h-full rounded-full", LEVEL_CLASS[level])}
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  );
}
