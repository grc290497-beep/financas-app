import { describe, expect, it } from "vitest";
import { budgetAlerts, goalReminders, unsent } from "@/lib/notifications";

const category = (spentCents: number) => ({
  id: "cat",
  name: "Mercado",
  budgetCents: 40000,
  spentCents,
});

describe("budgetAlerts", () => {
  it("says nothing below 80% of the limit", () => {
    expect(budgetAlerts([category(31999)], "2026-10-01")).toEqual([]);
  });

  it("warns from 80%", () => {
    const [alert] = budgetAlerts([category(32000)], "2026-10-01");
    expect(alert.kind).toBe("budgetWarning");
    expect(alert.keys).toEqual(["budget80:cat:2026-10-01"]);
  });

  it("going over also covers the 80% warning, so it is not sent afterwards", () => {
    const [alert] = budgetAlerts([category(40000)], "2026-10-01");
    expect(alert.kind).toBe("budgetOver");
    expect(alert.keys).toEqual(["budget100:cat:2026-10-01", "budget80:cat:2026-10-01"]);
  });

  it("keys are per period, so a new month warns again", () => {
    const [october] = budgetAlerts([category(32000)], "2026-10-01");
    const [november] = budgetAlerts([category(32000)], "2026-11-01");
    expect(october.keys[0]).not.toBe(november.keys[0]);
  });
});

describe("goalReminders", () => {
  const goal = {
    id: "g",
    name: "Viagem",
    targetCents: 120000,
    initialCents: 0,
    deadline: "2027-09-30",
    createdOn: "2026-10-01",
    status: "active" as const,
    contributions: [],
  };

  it("waits until the 25th", () => {
    expect(goalReminders([goal], "2026-10-24")).toEqual([]);
  });

  it("reminds of this month's installment from the 25th", () => {
    const [alert] = goalReminders([goal], "2026-10-25");
    expect(alert.keys).toEqual(["goal:g:2026-10"]);
    expect(alert.dueCents).toBe(10000); // 1.200,00 over 12 months
  });

  it("stays quiet once the installment is saved, and for goals that are not active", () => {
    const paid = {
      ...goal,
      contributions: [{ amountGoalCents: 10000, contributedOn: "2026-10-03" }],
    };
    expect(goalReminders([paid], "2026-10-26")).toEqual([]);
    expect(goalReminders([{ ...goal, status: "done" }], "2026-10-26")).toEqual([]);
  });
});

describe("unsent", () => {
  it("drops alerts whose own key was logged", () => {
    const alerts = budgetAlerts([category(40000)], "2026-10-01");
    expect(unsent(alerts, new Set(["budget80:cat:2026-10-01"]))).toHaveLength(1);
    expect(unsent(alerts, new Set(["budget100:cat:2026-10-01"]))).toHaveLength(0);
  });
});
