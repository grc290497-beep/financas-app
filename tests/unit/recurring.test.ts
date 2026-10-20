import { describe, expect, it } from "vitest";
import type { FxDeps } from "@/lib/fx";
import {
  generateRecurringForPeriod,
  nextOccurrence,
  occurrencesInRange,
  type PlannedTransaction,
  type RecurringItem,
  type RecurringSchedule,
  type RecurringStore,
} from "@/lib/recurring";

const monthly = (
  dayOfMonth: number,
  extra: Partial<RecurringSchedule> = {},
): RecurringSchedule => ({
  frequency: "monthly",
  dayOfMonth,
  startOn: "2026-01-01",
  endOn: null,
  ...extra,
});

describe("occurrencesInRange: monthly", () => {
  it("falls once per calendar month inside the range", () => {
    expect(occurrencesInRange(monthly(1), "2026-10-01", "2026-10-31")).toEqual(["2026-10-01"]);
  });

  it("covers a financial month that spans two calendar months", () => {
    expect(occurrencesInRange(monthly(1), "2026-10-25", "2026-11-24")).toEqual(["2026-11-01"]);
    expect(occurrencesInRange(monthly(26), "2026-10-25", "2026-11-24")).toEqual(["2026-10-26"]);
  });

  it("moves day 31 to the last day of short months", () => {
    expect(occurrencesInRange(monthly(31), "2027-02-01", "2027-02-28")).toEqual(["2027-02-28"]);
    expect(occurrencesInRange(monthly(31), "2028-02-01", "2028-02-29")).toEqual(["2028-02-29"]);
    expect(occurrencesInRange(monthly(30), "2026-04-01", "2026-04-30")).toEqual(["2026-04-30"]);
  });

  it("returns one date per month across several months", () => {
    expect(occurrencesInRange(monthly(15), "2026-10-01", "2027-01-31")).toEqual([
      "2026-10-15",
      "2026-11-15",
      "2026-12-15",
      "2027-01-15",
    ]);
  });

  it("respects the start and end dates", () => {
    const item = monthly(10, { startOn: "2026-11-05", endOn: "2027-01-09" });
    expect(occurrencesInRange(item, "2026-10-01", "2027-02-28")).toEqual([
      "2026-11-10",
      "2026-12-10",
    ]);
  });

  it("is empty when the item starts after the range", () => {
    expect(
      occurrencesInRange(monthly(1, { startOn: "2026-12-01" }), "2026-10-01", "2026-10-31"),
    ).toEqual([]);
  });
});

describe("occurrencesInRange: weekly", () => {
  const weekly: RecurringSchedule = {
    frequency: "weekly",
    dayOfMonth: null,
    startOn: "2026-10-05", // a Monday
    endOn: null,
  };

  it("repeats every 7 days from the start date", () => {
    expect(occurrencesInRange(weekly, "2026-10-01", "2026-10-31")).toEqual([
      "2026-10-05",
      "2026-10-12",
      "2026-10-19",
      "2026-10-26",
    ]);
  });

  it("stays aligned to the start weekday in later ranges", () => {
    expect(occurrencesInRange(weekly, "2026-11-01", "2026-11-15")).toEqual([
      "2026-11-02",
      "2026-11-09",
    ]);
  });
});

describe("occurrencesInRange: yearly", () => {
  it("falls on the start date's month and day", () => {
    const yearly: RecurringSchedule = {
      frequency: "yearly",
      dayOfMonth: null,
      startOn: "2026-03-15",
      endOn: null,
    };
    expect(occurrencesInRange(yearly, "2027-03-01", "2027-03-31")).toEqual(["2027-03-15"]);
    expect(occurrencesInRange(yearly, "2027-04-01", "2028-02-28")).toEqual([]);
  });

  it("moves 29 February to the 28th in non-leap years", () => {
    const leap: RecurringSchedule = {
      frequency: "yearly",
      dayOfMonth: null,
      startOn: "2028-02-29",
      endOn: null,
    };
    expect(occurrencesInRange(leap, "2029-02-01", "2029-02-28")).toEqual(["2029-02-28"]);
    expect(occurrencesInRange(leap, "2032-02-01", "2032-02-29")).toEqual(["2032-02-29"]);
  });
});

describe("nextOccurrence", () => {
  it("returns the first date on or after the given day", () => {
    expect(nextOccurrence(monthly(1), "2026-10-20")).toBe("2026-11-01");
    expect(nextOccurrence(monthly(20), "2026-10-20")).toBe("2026-10-20");
  });

  it("is null once the item has ended", () => {
    expect(nextOccurrence(monthly(1, { endOn: "2026-10-31" }), "2026-11-02")).toBeNull();
  });
});

describe("generateRecurringForPeriod", () => {
  const rent: RecurringItem = {
    id: "rent",
    type: "expense",
    name: "Aluguel",
    categoryId: "cat-rent",
    amountCents: 120000,
    currency: "EUR",
    frequency: "monthly",
    dayOfMonth: 1,
    startOn: "2026-01-01",
    endOn: null,
  };
  const netflix: RecurringItem = {
    ...rent,
    id: "netflix",
    name: "Netflix",
    categoryId: "cat-subs",
    amountCents: 5590,
    currency: "BRL",
    dayOfMonth: 15,
  };

  // In-memory transactions table with the unique (recurring_item_id, occurred_on) guard.
  function memoryStore(items: RecurringItem[]) {
    const rows = new Map<string, PlannedTransaction>();
    const store: RecurringStore = {
      activeItems: async () => items,
      insertIgnoringExisting: async (newRows) => {
        let created = 0;
        for (const row of newRows) {
          const key = `${row.recurring_item_id}|${row.occurred_on}`;
          if (!rows.has(key)) {
            rows.set(key, row);
            created++;
          }
        }
        return created;
      },
    };
    return { store, rows };
  }

  const fx = (rate: string | Error): FxDeps => ({
    today: () => "2026-10-20",
    cache: { get: async () => null, latestOnOrBefore: async () => null, put: async () => {} },
    fetchEurBrl: async () => {
      if (rate instanceof Error) throw rate;
      return { date: "2026-10-20", rate };
    },
  });

  const october = { start: "2026-10-01", end: "2026-10-31" };

  it("plans each item's due dates in the period, converted to the primary currency", async () => {
    const { store, rows } = memoryStore([rent, netflix]);
    const result = await generateRecurringForPeriod("user-1", october, "EUR", {
      store,
      fx: fx("5.6339"),
    });

    expect(result).toEqual({ created: 2, skipped: 0 });
    expect(rows.get("rent|2026-10-01")).toMatchObject({
      user_id: "user-1",
      status: "planned",
      description: "Aluguel",
      amount_cents: 120000,
      fx_rate: "1.000000",
      amount_primary_cents: 120000,
    });
    // R$ 55,90 at 1/5.6339 = 0.177497 -> 9.92 EUR
    expect(rows.get("netflix|2026-10-15")).toMatchObject({
      currency: "BRL",
      fx_rate: "0.177497",
      amount_primary_cents: 992,
    });
  });

  it("is idempotent: a second run creates nothing", async () => {
    const { store, rows } = memoryStore([rent, netflix]);
    await generateRecurringForPeriod("user-1", october, "EUR", { store, fx: fx("5.6339") });
    const again = await generateRecurringForPeriod("user-1", october, "EUR", {
      store,
      fx: fx("5.6339"),
    });

    expect(again.created).toBe(0);
    expect(rows.size).toBe(2);
  });

  it("plans the rent once per month, month after month, without duplicates", async () => {
    const { store, rows } = memoryStore([rent]);
    for (const period of [
      { start: "2026-10-01", end: "2026-10-31" },
      { start: "2026-11-01", end: "2026-11-30" },
      { start: "2026-10-01", end: "2026-10-31" },
      { start: "2026-12-01", end: "2026-12-31" },
    ]) {
      await generateRecurringForPeriod("user-1", period, "EUR", { store, fx: fx("5.6339") });
    }
    expect([...rows.keys()]).toEqual(["rent|2026-10-01", "rent|2026-11-01", "rent|2026-12-01"]);
  });

  it("skips foreign-currency items when no rate is available, and keeps the rest", async () => {
    const { store, rows } = memoryStore([rent, netflix]);
    const result = await generateRecurringForPeriod("user-1", october, "EUR", {
      store,
      fx: fx(new Error("offline")),
    });
    expect(result).toEqual({ created: 1, skipped: 1 });
    expect([...rows.keys()]).toEqual(["rent|2026-10-01"]);
  });

  it("does nothing when there are no active items", async () => {
    const { store } = memoryStore([]);
    expect(
      await generateRecurringForPeriod("user-1", october, "EUR", { store, fx: fx("5.6339") }),
    ).toEqual({ created: 0, skipped: 0 });
  });
});
