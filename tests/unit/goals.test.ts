import { describe, expect, it } from "vitest";
import { addMonths, monthsUntil } from "@/lib/dates";
import { evolutionSeries, goalMetrics, goalMonthView, type GoalPlan } from "@/lib/goals";

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
      installmentCents: 40000,
      contributedThisMonthCents: 0,
      dueThisMonthCents: 40000,
      laterMonthlyCents: 40000,
      pacePerMonthCents: 0,
      planEndsOn: "2027-12-31",
      status: "on_track",
    });
  });
});

describe("goalMetrics: the monthly installment", () => {
  it("takes this month's contributions off this month only", () => {
    // €6.000, €400/month; €200 put in this month: €200 still due now, later months unchanged.
    const m = goalMetrics(
      emergency,
      [{ amountGoalCents: 20000, contributedOn: "2026-10-21" }],
      "2026-10-22",
    );
    expect(m.installmentCents).toBe(40000);
    expect(m.contributedThisMonthCents).toBe(20000);
    expect(m.dueThisMonthCents).toBe(20000);
    expect(m.laterMonthlyCents).toBe(40000);
    expect(m.status).toBe("on_track");
  });

  it("spreads what a month left unpaid over the remaining months once the next one starts", () => {
    // October closed with €200 of €400: from November, 580000 left over 14 months.
    const m = goalMetrics(
      emergency,
      [{ amountGoalCents: 20000, contributedOn: "2026-10-21" }],
      "2026-11-02",
    );
    expect(m.installmentCents).toBe(Math.ceil(580000 / 14)); // 41429
    expect(m.dueThisMonthCents).toBe(41429);
    expect(m.status).toBe("behind");
  });

  it("lowers the later months when this month gets more than its installment", () => {
    const m = goalMetrics(
      emergency,
      [{ amountGoalCents: 100000, contributedOn: "2026-10-21" }],
      "2026-10-22",
    );
    expect(m.dueThisMonthCents).toBe(0);
    expect(m.laterMonthlyCents).toBe(Math.ceil(500000 / 14)); // 35715
    expect(m.status).toBe("on_track");
  });

  it("is back on track once the shortfall has been made up", () => {
    const m = goalMetrics(
      emergency,
      [
        { amountGoalCents: 20000, contributedOn: "2026-10-21" },
        { amountGoalCents: 60000, contributedOn: "2026-11-05" },
      ],
      "2026-12-03",
    );
    // 520000 left at the start of December over 13 months = 40000, the original installment.
    expect(m.installmentCents).toBe(40000);
    expect(m.status).toBe("on_track");
  });

  it("counts a withdrawal this month against this month", () => {
    const m = goalMetrics(
      emergency,
      [{ amountGoalCents: -10000, contributedOn: "2026-10-21" }],
      "2026-10-22",
    );
    expect(m.accumulatedCents).toBe(-10000);
    expect(m.dueThisMonthCents).toBe(50000);
  });

  it("asks for everything that is left once the deadline has passed", () => {
    const m = goalMetrics(
      emergency,
      [{ amountGoalCents: 100000, contributedOn: "2027-06-01" }],
      "2028-01-05",
    );
    expect(m.monthsRemaining).toBe(0);
    expect(m.installmentCents).toBe(500000);
    expect(m.laterMonthlyCents).toBeNull();
    expect(m.planEndsOn).toBeNull();
    expect(m.status).toBe("behind");
  });

  it("has no later months in the deadline's month", () => {
    const m = goalMetrics(emergency, [], "2027-12-10");
    expect(m.monthsRemaining).toBe(1);
    expect(m.dueThisMonthCents).toBe(600000);
    expect(m.laterMonthlyCents).toBeNull();
  });

  it("is done once the target is reached, with nothing left to save", () => {
    const m = goalMetrics({ ...emergency, initialCents: 700000 }, [], "2026-10-20");
    expect(m.status).toBe("done");
    expect(m.remainingCents).toBe(0);
    expect(m.dueThisMonthCents).toBe(0);
    expect(m.planEndsOn).toBeNull();
    expect(m.progress).toBeCloseTo(7 / 6);
  });

  it("is done when marked done, even below the target", () => {
    expect(goalMetrics({ ...emergency, status: "done" }, [], "2026-10-20").status).toBe("done");
  });

  it("counts the initial amount as saved", () => {
    const m = goalMetrics({ ...emergency, initialCents: 150000 }, [], "2026-10-20");
    expect(m.accumulatedCents).toBe(150000);
    expect(m.installmentCents).toBe(30000);
    expect(m.progress).toBe(0.25);
  });

  it("dates the goal from an earlier first contribution", () => {
    // Created in October with contributions logged since May at €550: May's
    // original installment was 600000 / 20 = 30000, so November's is still below it.
    const monthly = ["05", "06", "07", "08", "09", "10"].map((month) => ({
      amountGoalCents: 55000,
      contributedOn: `2026-${month}-07`,
    }));
    const m = goalMetrics({ ...emergency, deadline: "2027-12-31" }, monthly, "2026-11-02");
    expect(m.status).toBe("on_track");
  });

  it("keeps the 3-month pace as information", () => {
    const m = goalMetrics(
      emergency,
      [
        { amountGoalCents: 30000, contributedOn: "2026-08-10" },
        { amountGoalCents: 30000, contributedOn: "2026-09-10" },
        { amountGoalCents: 30000, contributedOn: "2026-10-10" },
      ],
      "2026-10-20",
    );
    expect(m.pacePerMonthCents).toBe(30000);
  });
});

describe("goalMonthView", () => {
  const contributions = [
    { amountGoalCents: 15000, contributedOn: "2026-09-12" },
    { amountGoalCents: 20000, contributedOn: "2026-10-21" },
  ];

  it("shows what went in during a past month", () => {
    expect(goalMonthView(emergency, contributions, "2026-10-22", "2026-09-01")).toEqual({
      kind: "past",
      contributedCents: 15000,
    });
  });

  it("shows what is still due this month", () => {
    const m = goalMetrics(emergency, contributions, "2026-10-22");
    expect(goalMonthView(emergency, contributions, "2026-10-22", "2026-10-01")).toEqual({
      kind: "current",
      cents: m.dueThisMonthCents,
    });
  });

  it("plans a future month at the later-months amount, and nothing after the deadline", () => {
    const m = goalMetrics(emergency, contributions, "2026-10-22");
    expect(goalMonthView(emergency, contributions, "2026-10-22", "2026-12-01")).toEqual({
      kind: "future",
      cents: m.laterMonthlyCents,
    });
    expect(goalMonthView(emergency, contributions, "2026-10-22", "2028-02-01")).toEqual({
      kind: "future",
      cents: 0,
    });
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
