import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  FxUnavailableError,
  convertToPrimary,
  fetchFrankfurterEurBrl,
  fetchFrankfurterEurBrlSeries,
  getRate,
  type FxCache,
  type FxDeps,
} from "@/lib/fx";

// In-memory stand-in for the fx_rates table (EUR -> BRL by date).
function memoryCache(
  initial: Record<string, string> = {},
): FxCache & { rows: Map<string, string> } {
  const rows = new Map(Object.entries(initial));
  return {
    rows,
    async get(date) {
      return rows.get(date) ?? null;
    },
    async latestOnOrBefore(date) {
      const dates = [...rows.keys()].filter((d) => d <= date).sort();
      const last = dates.at(-1);
      return last ? { date: last, rate: rows.get(last)! } : null;
    },
    async put(date, rate) {
      rows.set(date, rate);
    },
  };
}

let cache: ReturnType<typeof memoryCache>;
let fetchEurBrl: ReturnType<typeof vi.fn<FxDeps["fetchEurBrl"]>>;
let deps: FxDeps;

beforeEach(() => {
  cache = memoryCache();
  fetchEurBrl = vi.fn<FxDeps["fetchEurBrl"]>();
  deps = { cache, fetchEurBrl, today: () => "2026-10-20" };
});

describe("getRate", () => {
  it("returns 1 for the same currency without touching cache or API", async () => {
    const result = await getRate({ from: "EUR", to: "EUR", date: "2026-10-20" }, deps);
    expect(result).toEqual({ rate: "1.000000", date: "2026-10-20", source: "identity" });
    expect(fetchEurBrl).not.toHaveBeenCalled();
  });

  it("serves a cached rate without calling the API", async () => {
    cache.rows.set("2026-10-20", "5.633900");
    const result = await getRate({ from: "EUR", to: "BRL", date: "2026-10-20" }, deps);
    expect(result).toEqual({ rate: "5.633900", date: "2026-10-20", source: "cache" });
    expect(fetchEurBrl).not.toHaveBeenCalled();
  });

  it("fetches from the API on a cache miss and caches it under the requested date", async () => {
    fetchEurBrl.mockResolvedValue({ date: "2026-10-20", rate: "5.6339" });
    const result = await getRate({ from: "EUR", to: "BRL", date: "2026-10-20" }, deps);
    expect(result).toEqual({ rate: "5.633900", date: "2026-10-20", source: "api" });
    expect(fetchEurBrl).toHaveBeenCalledWith("2026-10-20");
    expect(cache.rows.get("2026-10-20")).toBe("5.633900");
  });

  it("calls the API at most once per day and pair", async () => {
    fetchEurBrl.mockResolvedValue({ date: "2026-10-20", rate: "5.6339" });
    await getRate({ from: "EUR", to: "BRL", date: "2026-10-20" }, deps);
    await getRate({ from: "BRL", to: "EUR", date: "2026-10-20" }, deps);
    await getRate({ from: "EUR", to: "BRL", date: "2026-10-20" }, deps);
    expect(fetchEurBrl).toHaveBeenCalledTimes(1);
  });

  it("uses the last business day on weekends and caches both dates", async () => {
    // Saturday: the ECB has no rate, the API answers with Friday's.
    fetchEurBrl.mockResolvedValue({ date: "2026-10-16", rate: "5.7197" });
    const result = await getRate({ from: "EUR", to: "BRL", date: "2026-10-17" }, deps);
    expect(result).toEqual({ rate: "5.719700", date: "2026-10-16", source: "api" });
    expect(cache.rows.get("2026-10-17")).toBe("5.719700");
    expect(cache.rows.get("2026-10-16")).toBe("5.719700");
  });

  it("inverts EUR->BRL for BRL->EUR with six decimals", async () => {
    cache.rows.set("2026-10-20", "5.633900");
    const result = await getRate({ from: "BRL", to: "EUR", date: "2026-10-20" }, deps);
    expect(result.rate).toBe("0.177497");
  });

  it("clamps future dates to today", async () => {
    fetchEurBrl.mockResolvedValue({ date: "2026-10-20", rate: "5.6339" });
    const result = await getRate({ from: "EUR", to: "BRL", date: "2026-12-25" }, deps);
    expect(fetchEurBrl).toHaveBeenCalledWith("2026-10-20");
    expect(result.date).toBe("2026-10-20");
  });

  it("falls back to the latest cached rate when the API fails", async () => {
    cache.rows.set("2026-10-14", "5.600000");
    cache.rows.set("2026-10-15", "5.650000");
    cache.rows.set("2026-10-30", "9.999999"); // after the requested date: ignored
    fetchEurBrl.mockRejectedValue(new Error("network down"));
    const result = await getRate({ from: "EUR", to: "BRL", date: "2026-10-20" }, deps);
    expect(result).toEqual({ rate: "5.650000", date: "2026-10-15", source: "fallback" });
  });

  it("throws FxUnavailableError when the API fails and nothing is cached", async () => {
    fetchEurBrl.mockRejectedValue(new Error("network down"));
    await expect(
      getRate({ from: "EUR", to: "BRL", date: "2026-10-20" }, deps),
    ).rejects.toBeInstanceOf(FxUnavailableError);
  });

  it("still returns the API rate if writing the cache fails", async () => {
    fetchEurBrl.mockResolvedValue({ date: "2026-10-20", rate: "5.6339" });
    cache.put = vi.fn().mockRejectedValue(new Error("no service role"));
    const result = await getRate({ from: "EUR", to: "BRL", date: "2026-10-20" }, deps);
    expect(result.rate).toBe("5.633900");
  });
});

describe("convertToPrimary", () => {
  it("keeps the amount and rate 1 when already in the primary currency", () => {
    expect(convertToPrimary(1250, "EUR", "EUR", "1.000000")).toEqual({
      fxRate: "1.000000",
      amountPrimaryCents: 1250,
    });
  });

  it("ignores any rate given for the same currency", () => {
    expect(convertToPrimary(1250, "EUR", "EUR", "5.633900").fxRate).toBe("1.000000");
  });

  it("converts €12,50 and R$80,00 into an EUR primary currency", () => {
    expect(convertToPrimary(1250, "EUR", "EUR", "1")).toEqual({
      fxRate: "1.000000",
      amountPrimaryCents: 1250,
    });
    expect(convertToPrimary(8000, "BRL", "EUR", "0.177497")).toEqual({
      fxRate: "0.177497",
      amountPrimaryCents: 1420,
    });
  });

  it("converts into a BRL primary currency", () => {
    expect(convertToPrimary(1250, "EUR", "BRL", "5,6339")).toEqual({
      fxRate: "5.633900",
      amountPrimaryCents: 7042,
    });
  });
});

describe("fetchFrankfurterEurBrl", () => {
  it("requests EUR->BRL for the date and returns the effective date and rate", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ amount: 1, base: "EUR", date: "2026-10-16", rates: { BRL: 5.7197 } }),
        ),
      );
    await expect(fetchFrankfurterEurBrl("2026-10-17", fetchImpl)).resolves.toEqual({
      date: "2026-10-16",
      rate: "5.7197",
    });
    expect(fetchImpl.mock.calls[0][0]).toBe(
      "https://api.frankfurter.app/2026-10-17?from=EUR&to=BRL",
    );
  });

  it("rejects non-200 responses", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("nope", { status: 503 }));
    await expect(fetchFrankfurterEurBrl("2026-10-20", fetchImpl)).rejects.toThrow();
  });

  it("rejects malformed payloads", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ rates: {} })));
    await expect(fetchFrankfurterEurBrl("2026-10-20", fetchImpl)).rejects.toThrow();
  });
});

describe("fetchFrankfurterEurBrlSeries", () => {
  it("requests the range and returns the daily closes oldest first", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          amount: 1,
          base: "EUR",
          start_date: "2026-10-01",
          end_date: "2026-10-05",
          rates: {
            "2026-10-05": { BRL: 5.8 },
            "2026-10-01": { BRL: 5.7 },
            "2026-10-02": { BRL: 5.75 },
          },
        }),
      ),
    );
    await expect(
      fetchFrankfurterEurBrlSeries("2026-10-01", "2026-10-05", fetchImpl),
    ).resolves.toEqual([
      { date: "2026-10-01", rate: 5.7 },
      { date: "2026-10-02", rate: 5.75 },
      { date: "2026-10-05", rate: 5.8 },
    ]);
    expect(fetchImpl.mock.calls[0][0]).toBe(
      "https://api.frankfurter.app/2026-10-01..2026-10-05?from=EUR&to=BRL",
    );
  });

  it("rejects malformed payloads", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ rates: { "2026-10-01": { USD: 1 } } })));
    await expect(
      fetchFrankfurterEurBrlSeries("2026-10-01", "2026-10-05", fetchImpl),
    ).rejects.toThrow();
  });
});
