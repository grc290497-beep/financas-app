// Calendar-date helpers over "yyyy-MM-dd" strings, computed in UTC so local
// time zones and daylight saving never shift a day. ISO dates compare
// correctly as strings.

export const DAY_MS = 86_400_000;

export function toUtc(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function ymd(date: string): [year: number, month: number, day: number] {
  const [y, m, d] = date.split("-").map(Number);
  return [y, m, d];
}

/** Builds a date, rolling month overflow into the year (month 13 = January next year). */
export function makeDate(year: number, month: number, day: number): string {
  return fromUtc(Date.UTC(year, month - 1, day));
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function addDays(date: string, days: number): string {
  return fromUtc(toUtc(date) + days * DAY_MS);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}
