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
    status: goalStatus(goal, contributions, {
      accumulatedCents,
      remainingCents,
      paceCents: pacePerMonthCents,
      requiredCents: requiredMonthlyCents,
      forecastDate,
      windowStart,
      today,
    }),
  };
}

function goalStatus(
  goal: GoalPlan,
  contributions: GoalContribution[],
  m: {
    accumulatedCents: number;
    remainingCents: number;
    paceCents: number;
    requiredCents: number;
    forecastDate: string | null;
    windowStart: string;
    today: string;
  },
): GoalStatus {
  if (goal.status === "done" || m.remainingCents === 0) return "done";
  if (m.paceCents > 0 && m.paceCents >= m.requiredCents) return "on_track";

  // History starts at creation or at the first contribution, whichever is earlier.
  const start = contributions.reduce(
    (first, c) => (c.contributedOn < first ? c.contributedOn : first),
    goal.createdOn,
  );
  // With a full pace window, a pace that finishes after the deadline is behind:
  // status must never contradict the forecast shown next to it.
  if (start <= m.windowStart && m.forecastDate && m.forecastDate > goal.deadline) {
    return "behind";
  }

  // Otherwise (a young goal, or one paused while ahead) compare with a straight
  // line from the start to the target, so a brand-new goal is not behind on day one.
  const totalDays = Math.max(daysBetween(start, goal.deadline), 1);
  const elapsedDays = Math.min(Math.max(daysBetween(start, m.today), 0), totalDays);
  const expectedCents =
    goal.initialCents + ((goal.targetCents - goal.initialCents) * elapsedDays) / totalDays;
  return m.accumulatedCents >= expectedCents ? "on_track" : "behind";
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
