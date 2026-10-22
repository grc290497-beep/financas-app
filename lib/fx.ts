import { z } from "zod";
import { convertCents, formatRate, invertRate, parseRate } from "@/lib/money";
import type { Currency } from "@/lib/validators";

// All FX logic lives here. Only EUR -> BRL is fetched and cached (the ECB
// quotes against EUR, and the API's inverse has just 4 decimals); BRL -> EUR
// is its inverse at 6 decimals.

export type FxSource = "identity" | "cache" | "api" | "fallback";

export type FxRate = {
  /** from -> to, numeric(18,6) string. */
  rate: string;
  /** Date the rate is valid for (may be earlier than requested: weekends, holidays). */
  date: string;
  source: FxSource;
};

/** EUR -> BRL rates by date. */
export type FxCache = {
  get(date: string): Promise<string | null>;
  latestOnOrBefore(date: string): Promise<{ date: string; rate: string } | null>;
  put(date: string, rate: string): Promise<void>;
};

export type FxDeps = {
  cache: FxCache;
  /** EUR -> BRL for a date; returns the effective date the API answered with. */
  fetchEurBrl(date: string): Promise<{ date: string; rate: string }>;
  /** Today as yyyy-MM-dd. */
  today(): string;
};

export class FxUnavailableError extends Error {
  constructor(date: string) {
    super(`No EUR/BRL exchange rate available for ${date}`);
    this.name = "FxUnavailableError";
  }
}

export async function getRate(
  request: { from: Currency; to: Currency; date: string },
  deps: FxDeps,
): Promise<FxRate> {
  const today = deps.today();
  const date = request.date > today ? today : request.date;

  if (request.from === request.to) {
    return { rate: formatRate(1_000_000n), date, source: "identity" };
  }

  const eurBrl = await getEurBrl(date, deps);
  const rate =
    request.from === "EUR" ? eurBrl.rate : formatRate(invertRate(parseRate(eurBrl.rate)));
  return { ...eurBrl, rate };
}

async function getEurBrl(date: string, deps: FxDeps): Promise<FxRate> {
  const cached = await deps.cache.get(date);
  if (cached) return { rate: normalize(cached), date, source: "cache" };

  try {
    const fetched = await deps.fetchEurBrl(date);
    const rate = normalize(fetched.rate);
    // Caching is best effort: a failed write must not fail the lookup.
    await Promise.allSettled(
      [...new Set([date, fetched.date])].map((d) => deps.cache.put(d, rate)),
    );
    return { rate, date: fetched.date, source: "api" };
  } catch {
    const latest = await deps.cache.latestOnOrBefore(date);
    if (latest) return { rate: normalize(latest.rate), date: latest.date, source: "fallback" };
    throw new FxUnavailableError(date);
  }
}

function normalize(rate: string): string {
  return formatRate(parseRate(rate));
}

/**
 * Freezes the conversion of a transaction into the primary currency.
 * `rate` is from `currency` to `primary` (ignored when they match).
 */
export function convertToPrimary(
  amountCents: number,
  currency: Currency,
  primary: Currency,
  rate: string,
): { fxRate: string; amountPrimaryCents: number } {
  if (currency === primary) {
    return { fxRate: formatRate(1_000_000n), amountPrimaryCents: amountCents };
  }
  const micro = parseRate(rate);
  return { fxRate: formatRate(micro), amountPrimaryCents: convertCents(amountCents, micro) };
}

const FRANKFURTER_URL = "https://api.frankfurter.app";

const frankfurterResponse = z.object({
  date: z.iso.date(),
  rates: z.object({ BRL: z.number().positive() }),
});

/** ECB rates via Frankfurter (free, no key). Weekends resolve to the last business day. */
export async function fetchFrankfurterEurBrl(
  date: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ date: string; rate: string }> {
  const response = await fetchImpl(`${FRANKFURTER_URL}/${date}?from=EUR&to=BRL`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Frankfurter responded ${response.status}`);
  const body = frankfurterResponse.parse(await response.json());
  return { date: body.date, rate: String(body.rates.BRL) };
}

const frankfurterSeriesResponse = z.object({
  rates: z.record(z.iso.date(), z.object({ BRL: z.number().positive() })),
});

/** Daily EUR→BRL closes between two dates (ECB business days only), oldest first. */
export async function fetchFrankfurterEurBrlSeries(
  from: string,
  to: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ date: string; rate: number }[]> {
  const response = await fetchImpl(`${FRANKFURTER_URL}/${from}..${to}?from=EUR&to=BRL`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Frankfurter responded ${response.status}`);
  const body = frankfurterSeriesResponse.parse(await response.json());
  return Object.entries(body.rates)
    .map(([date, { BRL }]) => ({ date, rate: BRL }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}
