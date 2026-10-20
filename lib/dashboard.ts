// Dashboard metrics (PLAN.md section 6), all in the primary currency.

export type MonthSummary = {
  /** Income received (confirmed). */
  incomeCents: number;
  /** Expenses paid (confirmed). */
  expenseCents: number;
  /** Expenses from recurring items, planned or paid. */
  fixedPlannedCents: number;
  /** Paid expenses that are not from recurring items. */
  variableSpentCents: number;
};

/** `goalsPlannedCents`: this month's required contributions to active goals, in the primary currency. */
export function computeMetrics(summary: MonthSummary, daysLeft: number, goalsPlannedCents = 0) {
  const freeToSpendCents =
    summary.incomeCents -
    summary.fixedPlannedCents -
    goalsPlannedCents -
    summary.variableSpentCents;

  return {
    incomeCents: summary.incomeCents,
    expenseCents: summary.expenseCents,
    fixedPlannedCents: summary.fixedPlannedCents,
    balanceCents: summary.incomeCents - summary.expenseCents,
    freeToSpendCents,
    freePerDayCents: daysLeft > 0 ? Math.floor(Math.max(freeToSpendCents, 0) / daysLeft) : null,
    savingsRate:
      summary.incomeCents > 0
        ? (summary.incomeCents - summary.expenseCents) / summary.incomeCents
        : null,
  };
}

/** Progress bar colour: warning from 80% of the budget, over from 100%. */
export function budgetLevel(spentCents: number, budgetCents: number): "ok" | "warning" | "over" {
  if (spentCents >= budgetCents) return "over";
  if (spentCents * 5 >= budgetCents * 4) return "warning";
  return "ok";
}

/** Relative change against the previous month; null without a previous amount. */
export function variation(currentCents: number, previousCents: number): number | null {
  return previousCents > 0 ? (currentCents - previousCents) / previousCents : null;
}
