import { addDays, daysBetween, makeDate, ymd } from "@/lib/dates";

// All financial-month logic lives here. A period runs from month_start_day
// to the day before it in the next month (25/10 -> 24/11). month_start_day
// is capped at 28, so the start day exists in every month.

export type Period = { start: string; end: string };

export function getFinancialPeriod(date: string, monthStartDay: number): Period {
  if (!Number.isInteger(monthStartDay) || monthStartDay < 1 || monthStartDay > 28) {
    throw new Error(`month_start_day must be an integer between 1 and 28: ${monthStartDay}`);
  }
  const [year, month, day] = ymd(date);
  const startMonth = day >= monthStartDay ? month : month - 1;
  return {
    start: makeDate(year, startMonth, monthStartDay),
    end: addDays(makeDate(year, startMonth + 1, monthStartDay), -1),
  };
}

/** The period `count` periods before (negative) or after the given one. */
export function shiftPeriod(period: Period, monthStartDay: number, count: number): Period {
  const [year, month] = ymd(period.start);
  return getFinancialPeriod(makeDate(year, month + count, monthStartDay), monthStartDay);
}

/** Days left in the period counting today; 0 when today is outside it. */
export function daysLeft(period: Period, today: string): number {
  if (today < period.start || today > period.end) return 0;
  return daysBetween(today, period.end) + 1;
}
