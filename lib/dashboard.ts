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

/**
 * `goalsPlannedCents`: this month's required contributions to active goals.
 * `plannedIncomeCents`: income expected this month but not received yet (a
 * salary still to come). Both in the primary currency.
 *
 * `carriedCents`: what was left from earlier months (plus the opening
 * balance) when the user carries it over; 0 when each month stands alone.
 *
 * `balanceCents` is what is available now (received minus paid, plus what was
 * carried); the projected figures are where the month ends up once everything
 * planned lands. The leftover rate stays this month's alone.
 */
export function computeMetrics(
  summary: MonthSummary,
  daysLeft: number,
  goalsPlannedCents = 0,
  plannedIncomeCents = 0,
  carriedCents = 0,
) {
  // Paid so far plus fixed costs still planned: fixed (paid or planned) + variable paid.
  const projectedExpenseCents = summary.fixedPlannedCents + summary.variableSpentCents;
  const projectedIncomeCents = summary.incomeCents + plannedIncomeCents;
  const monthLeftoverCents = projectedIncomeCents - projectedExpenseCents - goalsPlannedCents;
  const leftoverCents = monthLeftoverCents + carriedCents;

  return {
    incomeCents: summary.incomeCents,
    expenseCents: summary.expenseCents,
    fixedPlannedCents: summary.fixedPlannedCents,
    balanceCents: summary.incomeCents - summary.expenseCents + carriedCents,
    carriedCents,
    projectedIncomeCents,
    projectedExpenseCents,
    goalsPlannedCents,
    leftoverCents,
    leftoverPerDayCents: daysLeft > 0 ? Math.floor(Math.max(leftoverCents, 0) / daysLeft) : null,
    leftoverRate: projectedIncomeCents > 0 ? monthLeftoverCents / projectedIncomeCents : null,
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
