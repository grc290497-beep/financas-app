import "server-only";
import { FxUnavailableError, convertToPrimary, getRate } from "@/lib/fx";
import { serverFxDeps } from "@/lib/fx-cache";
import { createClient } from "@/lib/supabase/server";
import { goalMetrics, type GoalContribution, type GoalPlan } from "@/lib/goals";
import type { Currency } from "@/lib/validators";

// Data Access Layer for goals. RLS limits every query to the user's rows.

export type Goal = GoalPlan & {
  id: string;
  name: string;
  currency: Currency;
  icon: string | null;
  color: string | null;
  contributions: (GoalContribution & {
    id: string;
    amountCents: number;
    currency: Currency;
    note: string | null;
  })[];
};

const COLUMNS =
  "id, name, target_cents, currency, initial_cents, deadline, icon, color, status, created_at, goal_contributions (id, amount_cents, currency, amount_goal_cents, contributed_on, note)";

type Row = {
  id: string;
  name: string;
  target_cents: number;
  currency: string;
  initial_cents: number;
  deadline: string;
  icon: string | null;
  color: string | null;
  status: string;
  created_at: string;
  goal_contributions: {
    id: string;
    amount_cents: number;
    currency: string;
    amount_goal_cents: number;
    contributed_on: string;
    note: string | null;
  }[];
};

function toGoal(row: Row): Goal {
  return {
    id: row.id,
    name: row.name,
    targetCents: Number(row.target_cents),
    currency: row.currency as Currency,
    initialCents: Number(row.initial_cents),
    deadline: row.deadline,
    createdOn: row.created_at.slice(0, 10),
    status: row.status as Goal["status"],
    icon: row.icon,
    color: row.color,
    contributions: row.goal_contributions
      .map((c) => ({
        id: c.id,
        amountCents: Number(c.amount_cents),
        currency: c.currency as Currency,
        amountGoalCents: Number(c.amount_goal_cents),
        contributedOn: c.contributed_on,
        note: c.note,
      }))
      .sort((a, b) => (a.contributedOn < b.contributedOn ? 1 : -1)),
  };
}

/** Active and finished goals (archived ones are hidden), soonest deadline first. */
export async function listGoals(): Promise<Goal[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goals")
    .select(COLUMNS)
    .neq("status", "archived")
    .order("deadline");
  if (error) throw error;
  return (data as Row[]).map(toGoal);
}

/**
 * What active goals still need this month, in the primary currency: the
 * "aportes planejados em metas" that free-to-spend sets aside (PLAN.md 6).
 */
export async function goalsPlannedThisMonth(
  goals: Goal[],
  primaryCurrency: Currency,
  today: string,
): Promise<number> {
  let total = 0;
  for (const goal of goals) {
    if (goal.status !== "active") continue;
    // What this month still asks for: contributions already made come off it.
    const required = goalMetrics(goal, goal.contributions, today).dueThisMonthCents;
    if (!required) continue;
    if (goal.currency === primaryCurrency) {
      total += required;
      continue;
    }
    try {
      const { rate } = await getRate(
        { from: goal.currency, to: primaryCurrency, date: today },
        await serverFxDeps(),
      );
      total += convertToPrimary(required, goal.currency, primaryCurrency, rate).amountPrimaryCents;
    } catch (error) {
      // shortcut: without a rate the goal is left out of free-to-spend for now; retried on the next load.
      if (!(error instanceof FxUnavailableError)) throw error;
    }
  }
  return total;
}

export async function getGoal(id: string): Promise<Goal | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("goals").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toGoal(data as Row) : null;
}
