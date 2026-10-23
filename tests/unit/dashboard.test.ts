import { describe, expect, it } from "vitest";
import { budgetLevel, computeMetrics, dailyBalance, variation } from "@/lib/dashboard";

const summary = {
  incomeCents: 300000, // salary received
  expenseCents: 150000, // everything paid so far
  fixedPlannedCents: 120000, // rent 100000 paid + internet 20000 still planned
  variableSpentCents: 50000,
};

describe("computeMetrics", () => {
  it("computes what is available now and where the month ends up", () => {
    expect(computeMetrics(summary, 10)).toEqual({
      incomeCents: 300000,
      expenseCents: 150000,
      fixedPlannedCents: 120000,
      balanceCents: 150000, // available now: received minus paid
      carriedCents: 0,
      projectedIncomeCents: 300000,
      projectedExpenseCents: 170000, // 150000 paid + 20000 internet still to pay
      goalsPlannedCents: 0,
      leftoverCents: 130000,
      leftoverPerDayCents: 13000,
      leftoverRate: 130000 / 300000,
      savingsRate: 0.5,
    });
  });

  it("sets aside the month's planned goal contributions", () => {
    const m = computeMetrics(summary, 10, 40000);
    expect(m.leftoverCents).toBe(90000); // 130000 - 40000
    expect(m.leftoverPerDayCents).toBe(9000);
    expect(m.balanceCents).toBe(150000); // available now is money that moved, goals aside
  });

  it("counts income still expected this month in the projection only", () => {
    const m = computeMetrics(summary, 10, 40000, 150000);
    expect(m.projectedIncomeCents).toBe(450000);
    expect(m.leftoverCents).toBe(240000); // 90000 + 150000 salary still to come
    expect(m.incomeCents).toBe(300000); // received only
    expect(m.balanceCents).toBe(150000);
  });

  it("adds what earlier months left to the balance and the leftover, not to the rate", () => {
    const m = computeMetrics(summary, 10, 0, 0, 50000);
    expect(m.balanceCents).toBe(200000); // 150000 + 50000 carried
    expect(m.leftoverCents).toBe(180000); // 130000 + 50000
    expect(m.leftoverPerDayCents).toBe(18000);
    expect(m.leftoverRate).toBe(130000 / 300000); // this month's alone
  });

  it("carries a negative balance from earlier months too", () => {
    const m = computeMetrics(summary, 10, 0, 0, -200000);
    expect(m.balanceCents).toBe(-50000);
    expect(m.leftoverCents).toBe(-70000);
    expect(m.leftoverPerDayCents).toBe(0);
  });

  it("has no per-day figure once the period is over", () => {
    expect(computeMetrics(summary, 0).leftoverPerDayCents).toBeNull();
  });

  it("does not spread a shortfall over the remaining days", () => {
    const over = computeMetrics({ ...summary, variableSpentCents: 250000 }, 5);
    expect(over.leftoverCents).toBe(-70000);
    expect(over.leftoverPerDayCents).toBe(0);
    expect(over.leftoverRate).toBeLessThan(0);
  });

  it("rounds the per-day amount down so it never promises more than there is", () => {
    expect(computeMetrics({ ...summary, variableSpentCents: 50001 }, 3).leftoverPerDayCents).toBe(
      43333,
    );
  });

  it("has no rates without income", () => {
    const m = computeMetrics({ ...summary, incomeCents: 0 }, 10);
    expect(m.savingsRate).toBeNull();
    expect(m.leftoverRate).toBeNull();
  });

  it("allows a negative savings rate when spending exceeds income", () => {
    expect(computeMetrics({ ...summary, expenseCents: 450000 }, 10).savingsRate).toBe(-0.5);
  });
});

describe("budgetLevel", () => {
  it.each([
    [0, 10000, "ok"],
    [7999, 10000, "ok"],
    [8000, 10000, "warning"],
    [9999, 10000, "warning"],
    [10000, 10000, "over"],
    [15000, 10000, "over"],
  ])("spent %i of %i is %s", (spent, budget, level) => {
    expect(budgetLevel(spent, budget)).toBe(level);
  });
});

describe("variation", () => {
  it("is the relative change against the previous month", () => {
    expect(variation(15000, 10000)).toBe(0.5);
    expect(variation(5000, 10000)).toBe(-0.5);
    expect(variation(10000, 10000)).toBe(0);
  });

  it("is null when there is nothing to compare with", () => {
    expect(variation(5000, 0)).toBeNull();
  });
});

describe("dailyBalance", () => {
  it("carries the balance from day to day, adding each day's movements", () => {
    const movements = [
      { date: "2026-10-01", cents: 300000 },
      { date: "2026-10-03", cents: -90000 },
      { date: "2026-10-03", cents: -1000 },
    ];
    expect(dailyBalance(movements, "2026-10-01", "2026-10-04", 5000)).toEqual([
      305000, 305000, 214000, 214000,
    ]);
  });

  it("crosses month ends and ignores days outside the range", () => {
    const series = dailyBalance([{ date: "2026-12-01", cents: 1 }], "2026-11-29", "2026-12-01");
    expect(series).toEqual([0, 0, 1]);
    expect(dailyBalance([{ date: "2026-12-05", cents: 1 }], "2026-12-01", "2026-12-02")).toEqual([
      0, 0,
    ]);
  });
});
