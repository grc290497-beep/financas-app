import { describe, expect, it } from "vitest";
import { daysLeft, getFinancialPeriod, periodStartingIn, shiftPeriod } from "@/lib/period";

describe("periodStartingIn", () => {
  it("is the period whose first day falls in that month", () => {
    expect(periodStartingIn("2026-10", 25)).toEqual({ start: "2026-10-25", end: "2026-11-24" });
    expect(periodStartingIn("2026-10", 1)).toEqual({ start: "2026-10-01", end: "2026-10-31" });
    expect(periodStartingIn("2027-02", 28)).toEqual({ start: "2027-02-28", end: "2027-03-27" });
  });
});

describe("getFinancialPeriod", () => {
  it("is the calendar month when the month starts on day 1", () => {
    expect(getFinancialPeriod("2026-10-20", 1)).toEqual({ start: "2026-10-01", end: "2026-10-31" });
    expect(getFinancialPeriod("2026-10-01", 1)).toEqual({ start: "2026-10-01", end: "2026-10-31" });
    expect(getFinancialPeriod("2026-10-31", 1)).toEqual({ start: "2026-10-01", end: "2026-10-31" });
  });

  it("runs from the start day to the day before it in the next month", () => {
    expect(getFinancialPeriod("2026-10-25", 25)).toEqual({
      start: "2026-10-25",
      end: "2026-11-24",
    });
    expect(getFinancialPeriod("2026-11-24", 25)).toEqual({
      start: "2026-10-25",
      end: "2026-11-24",
    });
  });

  it("belongs to the previous period before the start day", () => {
    expect(getFinancialPeriod("2026-10-24", 25)).toEqual({
      start: "2026-09-25",
      end: "2026-10-24",
    });
  });

  it("crosses the year boundary", () => {
    expect(getFinancialPeriod("2027-01-10", 25)).toEqual({
      start: "2026-12-25",
      end: "2027-01-24",
    });
    expect(getFinancialPeriod("2026-12-31", 1)).toEqual({ start: "2026-12-01", end: "2026-12-31" });
  });

  it("handles month_start_day = 28 around February", () => {
    expect(getFinancialPeriod("2027-02-28", 28)).toEqual({
      start: "2027-02-28",
      end: "2027-03-27",
    });
    expect(getFinancialPeriod("2027-02-27", 28)).toEqual({
      start: "2027-01-28",
      end: "2027-02-27",
    });
    expect(getFinancialPeriod("2027-03-01", 28)).toEqual({
      start: "2027-02-28",
      end: "2027-03-27",
    });
  });

  it("handles leap years", () => {
    expect(getFinancialPeriod("2028-02-29", 1)).toEqual({ start: "2028-02-01", end: "2028-02-29" });
    expect(getFinancialPeriod("2028-02-29", 28)).toEqual({
      start: "2028-02-28",
      end: "2028-03-27",
    });
    expect(getFinancialPeriod("2027-02-15", 1)).toEqual({ start: "2027-02-01", end: "2027-02-28" });
  });

  it.each([0, 29, 31, 1.5])("rejects month_start_day %s", (day) => {
    expect(() => getFinancialPeriod("2026-10-20", day)).toThrow();
  });
});

describe("shiftPeriod", () => {
  it("moves whole periods backwards and forwards", () => {
    const october = getFinancialPeriod("2026-10-30", 25);
    expect(shiftPeriod(october, 25, 1)).toEqual({ start: "2026-11-25", end: "2026-12-24" });
    expect(shiftPeriod(october, 25, -1)).toEqual({ start: "2026-09-25", end: "2026-10-24" });
    expect(shiftPeriod(october, 25, 3)).toEqual({ start: "2027-01-25", end: "2027-02-24" });
  });
});

describe("daysLeft", () => {
  it("counts today and the remaining days of the period", () => {
    const period = { start: "2026-10-01", end: "2026-10-31" };
    expect(daysLeft(period, "2026-10-31")).toBe(1);
    expect(daysLeft(period, "2026-10-20")).toBe(12);
    expect(daysLeft(period, "2026-10-01")).toBe(31);
  });

  it("is 0 outside the period", () => {
    expect(daysLeft({ start: "2026-10-01", end: "2026-10-31" }, "2026-11-01")).toBe(0);
  });
});
