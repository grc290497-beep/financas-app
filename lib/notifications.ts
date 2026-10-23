import { budgetLevel } from "@/lib/dashboard";
import { goalMetrics, type GoalContribution, type GoalPlan } from "@/lib/goals";

// Which push notifications are due (the daily job sends them). Pure, so the
// rules are unit-tested; texts live in messages/pt-BR.json ("Notifications").
//
// Each alert has keys logged in notification_log after sending: the first is
// its own and decides whether it was sent already; the others are alerts it
// makes redundant (going over the budget covers the 80% warning).

export type BudgetAlert = {
  kind: "budgetWarning" | "budgetOver";
  keys: string[];
  categoryId: string;
  name: string;
  spentCents: number;
  budgetCents: number;
};

export type GoalAlert = {
  kind: "goalReminder";
  keys: string[];
  goalId: string;
  name: string;
  dueCents: number;
};

export type Alert = BudgetAlert | GoalAlert;

/** From this day of the month, an unpaid goal installment gets a reminder. */
export const GOAL_REMINDER_DAY = 25;

export function budgetAlerts(
  categories: { id: string; name: string; budgetCents: number; spentCents: number }[],
  periodStart: string,
): BudgetAlert[] {
  return categories.flatMap((c) => {
    const level = budgetLevel(c.spentCents, c.budgetCents);
    if (level === "ok") return [];
    const warning = `budget80:${c.id}:${periodStart}`;
    const over = `budget100:${c.id}:${periodStart}`;
    return [
      {
        kind: level === "over" ? "budgetOver" : "budgetWarning",
        keys: level === "over" ? [over, warning] : [warning],
        categoryId: c.id,
        name: c.name,
        spentCents: c.spentCents,
        budgetCents: c.budgetCents,
      },
    ];
  });
}

export function goalReminders(
  goals: (GoalPlan & { id: string; name: string; contributions: GoalContribution[] })[],
  today: string,
): GoalAlert[] {
  if (Number(today.slice(8, 10)) < GOAL_REMINDER_DAY) return [];
  return goals.flatMap((goal) => {
    if (goal.status !== "active") return [];
    const due = goalMetrics(goal, goal.contributions, today).dueThisMonthCents;
    if (due <= 0) return [];
    return [
      {
        kind: "goalReminder",
        keys: [`goal:${goal.id}:${today.slice(0, 7)}`],
        goalId: goal.id,
        name: goal.name,
        dueCents: due,
      },
    ];
  });
}

/** Alerts whose own key was not logged yet. */
export function unsent<T extends Alert>(alerts: T[], logged: Set<string>): T[] {
  return alerts.filter((alert) => !logged.has(alert.keys[0]));
}
