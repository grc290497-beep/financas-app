import { describe, expect, it } from "vitest";
import { addMonths, monthsUntil } from "@/lib/dates";
import { evolutionSeries, goalMetrics, type GoalPlan } from "@/lib/goals";

const emergency: GoalPlan = {
  targetCents: 600000,
  initialCents: 0,
  deadline: "2027-12-31",
  createdOn: "2026-10-20",
  status: "active",
};

describe("goalMetrics: the phase 5 example", () => {
  it("'Reserva de emergência €6.000 até dez/2027' needs €400 a month and starts on track", () => {
    expect(goalMetrics(emergency, [], "2026-10-20")).toEqual({
      accumulatedCents: 0,
      remainingCents: 600000,
      progress: 0,
      monthsRemaining: 15, // Oct 2026 .. Dec 2027
      requiredMonthlyCents: 40000,
      pacePerMonthCents: 0,
      forecastDate: null,
      status: "on_track",
    });
  });
});

describe("goalMetrics", () => {
  const year: GoalPlan = {
    targetCents: 120000,
    initialCents: 0,
    deadline: "2026-12-31",
    createdOn: "2026-01-01",
    status: "active",
  };
  const contributions = [
    { amountGoalCents: 20000, contributedOn: "2026-03-01" }, // outside the 3-month pace window
    { amountGoalCents: 10000, contributedOn: "2026-08-10" },
    { amountGoalCents: 10000, contributedOn: "2026-09-10" },
    { amountGoalCents: 10000, contributedOn: "2026-10-10" },
  ];

  it("is behind when both the pace and the progress fall short", () => {
    const m = goalMetrics(year, contributions, "2026-10-20");
    expect(m.accumulatedCents).toBe(50000);
    expect(m.remainingCents).toBe(70000);
    expect(m.monthsRemaining).toBe(3); // Oct, Nov, Dec
    expect(m.requiredMonthlyCents).toBe(23334); // rounded up so it is enough
    expect(m.pacePerMonthCents).toBe(10000); // last 3 months only
    expect(m.forecastDate).toBe("2027-05-20"); // 70000 / 10000 = 7 months
    expect(m.status).toBe("behind");
  });

  it("is on track when the recent pace covers what is still needed", () => {
    const m = goalMetrics(
      year,
      [...contributions, { amountGoalCents: 60000, contributedOn: "2026-10-15" }],
      "2026-10-20",
    );
    expect(m.pacePerMonthCents).toBe(30000);
    expect(m.requiredMonthlyCents).toBe(3334);
    expect(m.status).toBe("on_track");
  });

  it("counts withdrawals (negative contributions) against the total and the pace", () => {
    const m = goalMetrics(
      year,
      [...contributions, { amountGoalCents: -20000, contributedOn: "2026-10-15" }],
      "2026-10-20",
    );
    expect(m.accumulatedCents).toBe(30000);
    expect(m.pacePerMonthCents).toBe(3333);
    expect(m.forecastDate).toBe("2029-02-20"); // ceil(90000 / 3333) = 28 months
  });

  it("has no forecast when the pace is zero or negative", () => {
    const m = goalMetrics(
      year,
      [{ amountGoalCents: -5000, contributedOn: "2026-10-01" }],
      "2026-10-20",
    );
    expect(m.pacePerMonthCents).toBeLessThan(0);
    expect(m.forecastDate).toBeNull();
  });

  it("is done once the target is reached, with nothing left to save", () => {
    const m = goalMetrics({ ...year, initialCents: 100000 }, contributions, "2026-10-20");
    expect(m.status).toBe("done");
    expect(m.remainingCents).toBe(0);
    expect(m.requiredMonthlyCents).toBe(0);
    expect(m.forecastDate).toBeNull();
    expect(m.progress).toBe(1.25);
  });

  it("is done when marked done, even below the target", () => {
    expect(goalMetrics({ ...year, status: "done" }, [], "2026-10-20").status).toBe("done");
  });

  it("asks for everything that is left once the deadline has passed", () => {
    const m = goalMetrics(year, contributions, "2027-01-05");
    expect(m.monthsRemaining).toBe(0);
    expect(m.requiredMonthlyCents).toBe(70000);
    expect(m.status).toBe("behind");
  });

  it("counts the initial amount as saved", () => {
    const m = goalMetrics({ ...emergency, initialCents: 150000 }, [], "2026-10-20");
    expect(m.accumulatedCents).toBe(150000);
    expect(m.requiredMonthlyCents).toBe(30000);
    expect(m.progress).toBe(0.25);
  });
});

describe("evolutionSeries", () => {
  it("starts at the initial amount and accumulates by date, ending today", () => {
    expect(
      evolutionSeries(
        { ...emergency, initialCents: 10000, createdOn: "2026-08-01" },
        [
          { amountGoalCents: 5000, contributedOn: "2026-09-10" },
          { amountGoalCents: 3000, contributedOn: "2026-08-15" },
          { amountGoalCents: -2000, contributedOn: "2026-09-10" },
        ],
        "2026-10-20",
      ),
    ).toEqual([
      { date: "2026-08-01", cents: 10000 },
      { date: "2026-08-15", cents: 13000 },
      { date: "2026-09-10", cents: 16000 },
      { date: "2026-10-20", cents: 16000 },
    ]);
  });

  it("does not repeat today when the last contribution is today", () => {
    expect(
      evolutionSeries(
        emergency,
        [{ amountGoalCents: 1000, contributedOn: "2026-10-20" }],
        "2026-10-20",
      ),
    ).toEqual([{ date: "2026-10-20", cents: 1000 }]);
  });
});

describe("date helpers used by goals", () => {
  it("adds months, clamping to the month's last day", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-10-20", -3)).toBe("2026-07-20");
    expect(addMonths("2026-11-30", 3)).toBe("2027-02-28");
  });

  it("counts calendar months between two dates", () => {
    expect(monthsUntil("2026-10-20", "2027-12-31")).toBe(14);
    expect(monthsUntil("2026-10-31", "2026-10-01")).toBe(0);
    expect(monthsUntil("2027-01-05", "2026-12-31")).toBe(-1);
  });
});
