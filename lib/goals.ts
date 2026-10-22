import { addMonths, makeDate, monthsUntil, ymd } from "@/lib/dates";

// Goal metrics (PLAN.md 3.5). Amounts are cents in the goal's own currency.
//
// The plan is a monthly installment: what was left at the start of this
// calendar month, spread over the months until the deadline (this one
// included). Contributions made this month come off this month's installment;
// whatever this month leaves unpaid is spread over the remaining months when
// the next month starts, because the installment is recomputed from what is
// left then.

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

/** First day of the calendar month `date` falls in. */
export function monthStart(date: string): string {
  const [y, m] = ymd(date);
  return makeDate(y, m, 1);
}

const sum = (contributions: GoalContribution[]) =>
  contributions.reduce((total, c) => total + c.amountGoalCents, 0);

/** Months from `from`'s month to the deadline's month, both included; 0 once past it. */
const monthsLeft = (from: string, deadline: string) =>
  from > deadline ? 0 : monthsUntil(from, deadline) + 1;

/** `remaining` split over `months`, rounded up so the plan never falls short. */
const share = (remaining: number, months: number) =>
  remaining <= 0 ? 0 : months <= 0 ? remaining : Math.ceil(remaining / months);

export function goalMetrics(goal: GoalPlan, contributions: GoalContribution[], today: string) {
  const accumulatedCents = goal.initialCents + sum(contributions);
  const remainingCents = Math.max(goal.targetCents - accumulatedCents, 0);
  const thisMonth = monthStart(today);
  const monthsRemaining = monthsLeft(today, goal.deadline);

  // This month's installment comes from what was left when the month began.
  const thisMonthContributions = contributions.filter(
    (c) => c.contributedOn >= thisMonth && c.contributedOn <= today,
  );
  const contributedThisMonthCents = sum(thisMonthContributions);
  const remainingAtMonthStart = Math.max(
    goal.targetCents -
      goal.initialCents -
      sum(contributions.filter((c) => c.contributedOn < thisMonth)),
    0,
  );
  const installmentCents = share(remainingAtMonthStart, monthsRemaining);
  const dueThisMonthCents = Math.min(
    Math.max(installmentCents - contributedThisMonthCents, 0),
    remainingCents,
  );
  // What each later month needs if this month's installment is completed.
  const laterMonthlyCents =
    monthsRemaining > 1 ? share(remainingCents - dueThisMonthCents, monthsRemaining - 1) : null;

  // Average saved per month over the last 3 months (withdrawals included).
  const windowStart = addMonths(today, -PACE_MONTHS);
  const pacePerMonthCents = Math.round(
    sum(contributions.filter((c) => c.contributedOn > windowStart && c.contributedOn <= today)) /
      PACE_MONTHS,
  );

  // Following the plan the goal is reached in the deadline's month; once that
  // has passed with money still missing there is no plan left to follow.
  const planEndsOn = remainingCents === 0 ? null : monthsRemaining > 0 ? goal.deadline : null;

  return {
    accumulatedCents,
    remainingCents,
    progress: accumulatedCents / goal.targetCents,
    monthsRemaining,
    installmentCents,
    contributedThisMonthCents,
    dueThisMonthCents,
    laterMonthlyCents,
    pacePerMonthCents,
    planEndsOn,
    status: goalStatus(goal, contributions, { remainingCents, installmentCents, monthsRemaining }),
  };
}

function goalStatus(
  goal: GoalPlan,
  contributions: GoalContribution[],
  m: { remainingCents: number; installmentCents: number; monthsRemaining: number },
): GoalStatus {
  if (goal.status === "done" || m.remainingCents === 0) return "done";
  if (m.monthsRemaining === 0) return "behind";
  // The goal starts at creation or at its first contribution, whichever is earlier.
  const start = contributions.reduce(
    (first, c) => (c.contributedOn < first ? c.contributedOn : first),
    goal.createdOn,
  );
  // Behind when earlier months fell short and the gap was spread forward,
  // i.e. this month asks for more than the original installment.
  const original = share(goal.targetCents - goal.initialCents, monthsLeft(start, goal.deadline));
  return m.installmentCents > original ? "behind" : "on_track";
}

/**
 * The installment as seen from another calendar month (yyyy-MM-01): what was
 * contributed in a past month, what is due in the current one, and what a
 * future month is planned to need if the plan is followed.
 */
export function goalMonthView(
  goal: GoalPlan,
  contributions: GoalContribution[],
  today: string,
  month: string,
): { kind: "past"; contributedCents: number } | { kind: "current" | "future"; cents: number } {
  const current = monthStart(today);
  if (month < current) {
    const next = addMonths(month, 1);
    return {
      kind: "past",
      contributedCents: sum(
        contributions.filter((c) => c.contributedOn >= month && c.contributedOn < next),
      ),
    };
  }
  const m = goalMetrics(goal, contributions, today);
  if (month === current) return { kind: "current", cents: m.dueThisMonthCents };
  return { kind: "future", cents: month > goal.deadline ? 0 : (m.laterMonthlyCents ?? 0) };
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
