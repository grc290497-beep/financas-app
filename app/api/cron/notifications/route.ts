import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { formatMoney } from "@/lib/money";
import { budgetAlerts, goalReminders, unsent, type Alert } from "@/lib/notifications";
import { getFinancialPeriod } from "@/lib/period";
import { pushConfigured, sendPush, type PushSubscriptionRow } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Currency } from "@/lib/validators";

// Daily push notifications (vercel.json, 08:00 UTC = 09:00 in Lisbon in
// summer). Only users with a subscribed device are looked at.

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
  }
  if (!pushConfigured()) {
    return NextResponse.json({ error: "VAPID keys are not set" }, { status: 500 });
  }

  const { data: subs, error: subsError } = await admin
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth");
  if (subsError) throw subsError;
  const byUser = new Map<string, PushSubscriptionRow[]>();
  for (const { user_id, ...sub } of subs)
    byUser.set(user_id, [...(byUser.get(user_id) ?? []), sub]);
  if (!byUser.size) return NextResponse.json({ users: 0, sent: 0, failed: 0 });

  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("id, primary_currency, month_start_day, notify_budget, notify_goals")
    .in("id", [...byUser.keys()])
    .eq("onboarding_done", true);
  if (profilesError) throw profilesError;

  const today = new Date().toISOString().slice(0, 10);
  const t = await getTranslations({ locale: "pt-BR", namespace: "Notifications" });
  let sent = 0;
  let failed = 0;

  // One user's failure must not stop everyone else's notifications.
  for (const profile of profiles) {
    try {
      const primary = profile.primary_currency as Currency;
      const period = getFinancialPeriod(today, profile.month_start_day);
      const alerts: Alert[] = [
        ...(profile.notify_budget ? await budgetAlertsFor(admin, profile.id, period) : []),
        ...(profile.notify_goals ? await goalAlertsFor(admin, profile.id, today) : []),
      ];
      if (!alerts.length) continue;

      const { data: logged } = await admin
        .from("notification_log")
        .select("key")
        .eq("user_id", profile.id)
        .in(
          "key",
          alerts.map((a) => a.keys[0]),
        );
      const fresh = unsent(alerts, new Set((logged ?? []).map((row) => row.key)));

      for (const alert of fresh) {
        const delivered = await sendPush(
          admin,
          byUser.get(profile.id)!,
          message(alert, primary, t),
        );
        if (!delivered) continue;
        sent++;
        await admin.from("notification_log").upsert(
          alert.keys.map((key) => ({ user_id: profile.id, key })),
          {
            ignoreDuplicates: true,
          },
        );
      }
    } catch (error) {
      failed++;
      console.error("Notifications failed for a user", error);
    }
  }

  return NextResponse.json({ users: profiles.length, sent, failed });
}

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

/** Confirmed spending per budgeted category in the period, like the Orçamento bars. */
async function budgetAlertsFor(
  admin: Admin,
  userId: string,
  period: { start: string; end: string },
) {
  const { data: categories, error } = await admin
    .from("categories")
    .select("id, name, monthly_budget_cents")
    .eq("user_id", userId)
    .eq("archived", false)
    .neq("kind", "income")
    .not("monthly_budget_cents", "is", null);
  if (error) throw error;
  if (!categories.length) return [];

  const { data: spent, error: spentError } = await admin
    .from("transactions")
    .select("category_id, amount_primary_cents")
    .eq("user_id", userId)
    .eq("type", "expense")
    .eq("status", "confirmed")
    .gte("occurred_on", period.start)
    .lte("occurred_on", period.end)
    .in(
      "category_id",
      categories.map((c) => c.id),
    );
  if (spentError) throw spentError;

  const totals = new Map<string, number>();
  for (const row of spent) {
    totals.set(
      row.category_id,
      (totals.get(row.category_id) ?? 0) + Number(row.amount_primary_cents),
    );
  }
  return budgetAlerts(
    categories.map((c) => ({
      id: c.id,
      name: c.name,
      budgetCents: Number(c.monthly_budget_cents),
      spentCents: totals.get(c.id) ?? 0,
    })),
    period.start,
  );
}

async function goalAlertsFor(admin: Admin, userId: string, today: string) {
  const { data, error } = await admin
    .from("goals")
    .select(
      "id, name, target_cents, initial_cents, deadline, status, created_at, currency, goal_contributions (amount_goal_cents, contributed_on)",
    )
    .eq("user_id", userId)
    .eq("status", "active");
  if (error) throw error;
  return goalReminders(
    data.map((g) => ({
      id: g.id,
      name: g.name,
      targetCents: Number(g.target_cents),
      initialCents: Number(g.initial_cents),
      deadline: g.deadline,
      createdOn: g.created_at.slice(0, 10),
      status: g.status as "active",
      contributions: g.goal_contributions.map((c) => ({
        amountGoalCents: Number(c.amount_goal_cents),
        contributedOn: c.contributed_on,
      })),
    })),
    today,
  ).map((alert) => ({
    ...alert,
    // The installment is in the goal's own currency.
    currency: data.find((g) => g.id === alert.goalId)!.currency as Currency,
  }));
}

function message(
  alert: Alert & { currency?: Currency },
  primary: Currency,
  t: Awaited<ReturnType<typeof getTranslations<"Notifications">>>,
) {
  if (alert.kind === "goalReminder") {
    return {
      title: t("goalTitle", { name: alert.name }),
      body: t("goalBody", { amount: formatMoney(alert.dueCents, alert.currency ?? primary) }),
      url: `/app/goals/${alert.goalId}`,
    };
  }
  const values = {
    name: alert.name,
    spent: formatMoney(alert.spentCents, primary),
    budget: formatMoney(alert.budgetCents, primary),
  };
  return alert.kind === "budgetOver"
    ? { title: t("budgetOverTitle", values), body: t("budgetOverBody", values), url: "/app/budget" }
    : {
        title: t("budgetWarningTitle", values),
        body: t("budgetWarningBody", values),
        url: "/app/budget",
      };
}
