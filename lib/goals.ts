import { addMonths, daysBetween, monthsUntil } from "@/lib/dates";

// Goal metrics (PLAN.md 3.5). Amounts are cents in the goal's own currency.

export type GoalPlan = {
  targetCents: number;
  initialCents: number;
  deadline: string;
  createdOn: string;
  status: "active" | "done" | "archived";
};

export type GoalContribution = {
  /** Negative for a withdrawal. */
  amountGoalCents: number;
  contributedOn: string;
};

export type GoalStatus = "on_track" | "behind" | "done";

const PACE_MONTHS = 3;

export function goalMetrics(goal: GoalPlan, contributions: GoalContribution[], today: string) {
  const accumulatedCents =
    goal.initialCents + contributions.reduce((sum, c) => sum + c.amountGoalCents, 0);
  const remainingCents = Math.max(goal.targetCents - accumulatedCents, 0);

  // Months left to save in, counting the current one (Oct -> Dec = 3); 0 once past the deadline.
  const monthsRemaining = today > goal.deadline ? 0 : monthsUntil(today, goal.deadline) + 1;
  const requiredMonthlyCents =
    remainingCents === 0
      ? 0
      : monthsRemaining === 0
        ? remainingCents
        : Math.ceil(remainingCents / monthsRemaining);

  // Average saved per month over the last 3 months (withdrawals included).
  const windowStart = addMonths(today, -PACE_MONTHS);
  const pacePerMonthCents = Math.round(
    contributions
      .filter((c) => c.contributedOn > windowStart && c.contributedOn <= today)
      .reduce((sum, c) => sum + c.amountGoalCents, 0) / PACE_MONTHS,
  );

  const forecastDate =
    remainingCents > 0 && pacePerMonthCents > 0
      ? addMonths(today, Math.ceil(remainingCents / pacePerMonthCents))
      : null;

  return {
    accumulatedCents,
    remainingCents,
    progress: accumulatedCents / goal.targetCents,
    monthsRemaining,
    requiredMonthlyCents,
    pacePerMonthCents,
    forecastDate,
    status: goalStatus(
      goal,
      accumulatedCents,
      remainingCents,
      pacePerMonthCents,
      requiredMonthlyCents,
      today,
    ),
  };
}

function goalStatus(
  goal: GoalPlan,
  accumulatedCents: number,
  remainingCents: number,
  paceCents: number,
  requiredCents: number,
  today: string,
): GoalStatus {
  if (goal.status === "done" || remainingCents === 0) return "done";
  // On track if the recent pace covers what is needed, or if the amount saved
  // keeps up with a straight line from the start to the target by the deadline
  // (which also keeps a brand-new goal from showing as behind on day one).
  if (paceCents > 0 && paceCents >= requiredCents) return "on_track";
  const totalDays = Math.max(daysBetween(goal.createdOn, goal.deadline), 1);
  const elapsedDays = Math.min(Math.max(daysBetween(goal.createdOn, today), 0), totalDays);
  const expectedCents =
    goal.initialCents + ((goal.targetCents - goal.initialCents) * elapsedDays) / totalDays;
  return accumulatedCents >= expectedCents ? "on_track" : "behind";
}

/** Accumulated amount over time for the chart: start, each contribution date, today. */
export function evolutionSeries(
  goal: GoalPlan,
  contributions: GoalContribution[],
  today: string,
): { date: string; cents: number }[] {
  const byDate = new Map<string, number>([[goal.createdOn, 0]]);
  for (const c of contributions) {
    byDate.set(c.contributedOn, (byDate.get(c.contributedOn) ?? 0) + c.amountGoalCents);
  }
  if (!byDate.has(today)) byDate.set(today, 0);

  let total = goal.initialCents;
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, delta]) => ({ date, cents: (total += delta) }));
}
