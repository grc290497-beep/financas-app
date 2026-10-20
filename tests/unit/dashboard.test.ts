import { describe, expect, it } from "vitest";
import { budgetLevel, computeMetrics, variation } from "@/lib/dashboard";

const summary = {
  incomeCents: 300000, // salary received
  expenseCents: 150000, // everything paid so far
  fixedPlannedCents: 120000, // rent 100000 paid + internet 20000 still planned
  variableSpentCents: 50000,
};

describe("computeMetrics", () => {
  it("computes the section 6 metrics", () => {
    expect(computeMetrics(summary, 10)).toEqual({
      incomeCents: 300000,
      expenseCents: 150000,
      fixedPlannedCents: 120000,
      balanceCents: 150000,
      // 300000 - 120000 fixed - 0 goals - 50000 variable
      freeToSpendCents: 130000,
      freePerDayCents: 13000,
      savingsRate: 0.5,
    });
  });

  it("has no per-day figure once the period is over", () => {
    expect(computeMetrics(summary, 0).freePerDayCents).toBeNull();
  });

  it("does not spread a negative free amount over the remaining days", () => {
    const over = computeMetrics({ ...summary, variableSpentCents: 250000 }, 5);
    expect(over.freeToSpendCents).toBe(-70000);
    expect(over.freePerDayCents).toBe(0);
  });

  it("rounds the per-day amount down so it never promises more than there is", () => {
    expect(computeMetrics({ ...summary, variableSpentCents: 50001 }, 3).freePerDayCents).toBe(
      43333,
    );
  });

  it("has no savings rate without income", () => {
    expect(computeMetrics({ ...summary, incomeCents: 0 }, 10).savingsRate).toBeNull();
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
