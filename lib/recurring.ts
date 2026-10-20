import { addDays, daysBetween, daysInMonth, makeDate, ymd } from "@/lib/dates";
import { FxUnavailableError, convertToPrimary, getRate, type FxDeps } from "@/lib/fx";
import { getFinancialPeriod, periodStartingIn, shiftPeriod, type Period } from "@/lib/period";
import type { Currency, Frequency, TransactionType } from "@/lib/validators";

// When a recurring item (rent, salary, subscriptions) falls due.

export type { Frequency };

export type RecurringSchedule = {
  frequency: Frequency;
  /** Monthly only: 1-31; short months use their last day. */
  dayOfMonth: number | null;
  /** Weekly items repeat on this weekday; yearly ones on this month and day. */
  startOn: string;
  endOn: string | null;
};

/** Due dates within [from, to], both inclusive, in ascending order. */
export function occurrencesInRange(item: RecurringSchedule, from: string, to: string): string[] {
  const lo = item.startOn > from ? item.startOn : from;
  const hi = item.endOn && item.endOn < to ? item.endOn : to;
  if (lo > hi) return [];

  const dates: string[] = [];
  const keep = (date: string) => {
    if (date >= lo && date <= hi) dates.push(date);
  };

  if (item.frequency === "weekly") {
    const weeksToSkip = Math.max(0, Math.ceil(daysBetween(item.startOn, lo) / 7));
    for (let date = addDays(item.startOn, weeksToSkip * 7); date <= hi; date = addDays(date, 7)) {
      keep(date);
    }
    return dates;
  }

  const [loYear, loMonth] = ymd(lo);
  const [hiYear, hiMonth] = ymd(hi);

  if (item.frequency === "monthly") {
    const day = item.dayOfMonth ?? ymd(item.startOn)[2];
    for (let i = loYear * 12 + loMonth - 1; i <= hiYear * 12 + hiMonth - 1; i++) {
      const year = Math.floor(i / 12);
      const month = (i % 12) + 1;
      keep(makeDate(year, month, Math.min(day, daysInMonth(year, month))));
    }
    return dates;
  }

  const [, startMonth, startDay] = ymd(item.startOn);
  for (let year = loYear; year <= hiYear; year++) {
    keep(makeDate(year, startMonth, Math.min(startDay, daysInMonth(year, startMonth))));
  }
  return dates;
}

/** First due date on or after `from`, or null if the item has ended. */
export function nextOccurrence(item: RecurringSchedule, from: string): string | null {
  return occurrencesInRange(item, from, addDays(from, 400))[0] ?? null;
}

/**
 * A change that takes effect on a date (a raise, a new job) splits the item:
 * the old one ends the day before, the new one starts at its first due date
 * from then on (same weekday / day of month). Null when the change covers the
 * whole item, i.e. it takes effect on or before the item started.
 */
export function splitDates(oldStartOn: string, next: RecurringSchedule, effectiveFrom: string) {
  if (effectiveFrom <= oldStartOn) return null;
  return {
    oldEndOn: addDays(effectiveFrom, -1),
    newStartOn: nextOccurrence(next, effectiveFrom) ?? effectiveFrom,
  };
}

/** How far ahead a future month can be planned by opening it. */
export const PLAN_AHEAD_MONTHS = 12;

/** The current period, plus the viewed one when it is a future month within reach. */
export function periodsToPlan(
  today: string,
  monthStartDay: number,
  viewedMonth?: string,
): Period[] {
  const current = getFinancialPeriod(today, monthStartDay);
  if (!viewedMonth) return [current];
  const viewed = periodStartingIn(viewedMonth, monthStartDay);
  const limit = shiftPeriod(current, monthStartDay, PLAN_AHEAD_MONTHS);
  return viewed.start > current.start && viewed.start <= limit.start
    ? [current, viewed]
    : [current];
}

export type RecurringItem = RecurringSchedule & {
  id: string;
  type: TransactionType;
  name: string;
  categoryId: string;
  amountCents: number;
  currency: Currency;
};

export type PlannedTransaction = {
  user_id: string;
  recurring_item_id: string;
  type: TransactionType;
  category_id: string;
  description: string;
  amount_cents: number;
  currency: Currency;
  fx_rate: string;
  amount_primary_cents: number;
  occurred_on: string;
  status: "planned";
};

export type RecurringStore = {
  activeItems(): Promise<RecurringItem[]>;
  /** Inserts rows, skipping any (recurring_item_id, occurred_on) that already exists. Returns how many were new. */
  insertIgnoringExisting(rows: PlannedTransaction[]): Promise<number>;
};

/**
 * Creates the planned transactions due in the period for the user's active
 * recurring items. Idempotent: running it again creates nothing new (the
 * database's unique (recurring_item_id, occurred_on) is the final guard).
 * Items whose rate cannot be found are skipped and retried on the next run.
 */
export async function generateRecurringForPeriod(
  userId: string,
  period: Period,
  primaryCurrency: Currency,
  deps: { store: RecurringStore; fx: FxDeps },
): Promise<{ created: number; skipped: number }> {
  const rows: PlannedTransaction[] = [];
  let skipped = 0;

  for (const item of await deps.store.activeItems()) {
    for (const date of occurrencesInRange(item, period.start, period.end)) {
      let rate = "1";
      if (item.currency !== primaryCurrency) {
        try {
          rate = (await getRate({ from: item.currency, to: primaryCurrency, date }, deps.fx)).rate;
        } catch (error) {
          if (!(error instanceof FxUnavailableError)) throw error;
          skipped++;
          continue;
        }
      }
      const { fxRate, amountPrimaryCents } = convertToPrimary(
        item.amountCents,
        item.currency,
        primaryCurrency,
        rate,
      );
      rows.push({
        user_id: userId,
        recurring_item_id: item.id,
        type: item.type,
        category_id: item.categoryId,
        description: item.name,
        amount_cents: item.amountCents,
        currency: item.currency,
        fx_rate: fxRate,
        amount_primary_cents: amountPrimaryCents,
        occurred_on: date,
        status: "planned",
      });
    }
  }

  const created = rows.length ? await deps.store.insertIgnoringExisting(rows) : 0;
  return { created, skipped };
}
