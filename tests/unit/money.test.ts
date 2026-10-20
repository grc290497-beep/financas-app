import { describe, expect, it } from "vitest";
import {
  convertCents,
  formatAmountInput,
  formatMoney,
  formatRate,
  invertRate,
  parseAmount,
  parseRate,
} from "@/lib/money";

// Intl uses a no-break space between symbol and number.
const plain = (s: string) => s.replace(/ | /g, " ");

describe("parseAmount", () => {
  it.each([
    ["12,50", 1250],
    ["12.50", 1250],
    ["12,5", 1250],
    ["80", 8000],
    ["0,01", 1],
    ["1.234,56", 123456],
    ["1,234.56", 123456],
    ["1 234,56", 123456],
    ["1.234", 123400],
    ["1.234.567", 123456700],
    ["R$ 80,00", 8000],
    ["€12,50", 1250],
    ["  12,50 EUR ", 1250],
    ["0", 0],
  ])("parses %j as %i cents", (input, cents) => {
    expect(parseAmount(input)).toBe(cents);
  });

  it.each([
    [""],
    ["   "],
    ["abc"],
    ["12,345,6"],
    ["1,2,3"],
    ["12.34.56"],
    ["1,234567"],
    ["-5"],
    ["12,"],
    [",50"],
    ["1e3"],
    ["99999999999999999999"],
  ])("rejects %j", (input) => {
    expect(parseAmount(input)).toBeNull();
  });
});

describe("formatMoney (pt-BR)", () => {
  it("formats EUR and BRL like the spec", () => {
    expect(plain(formatMoney(1250, "EUR"))).toBe("€ 12,50");
    expect(plain(formatMoney(8000, "BRL"))).toBe("R$ 80,00");
  });

  it("groups thousands and keeps two decimals", () => {
    expect(plain(formatMoney(123456789, "BRL"))).toBe("R$ 1.234.567,89");
    expect(plain(formatMoney(5, "EUR"))).toBe("€ 0,05");
  });

  it("formats negative amounts", () => {
    expect(plain(formatMoney(-1250, "EUR"))).toBe("-€ 12,50");
  });
});

describe("formatAmountInput", () => {
  it("renders cents for an editable input", () => {
    expect(formatAmountInput(1250)).toBe("12,50");
    expect(formatAmountInput(8000)).toBe("80,00");
    expect(formatAmountInput(123456)).toBe("1234,56");
    expect(parseAmount(formatAmountInput(123456))).toBe(123456);
  });
});

describe("rates", () => {
  it("parses rates into micro-units with either decimal separator", () => {
    expect(parseRate("5.6339")).toBe(5_633_900n);
    expect(parseRate("5,6339")).toBe(5_633_900n);
    expect(parseRate("1")).toBe(1_000_000n);
    expect(parseRate(5.6339)).toBe(5_633_900n);
    expect(parseRate("0.177497")).toBe(177_497n);
  });

  it("rounds rates beyond six decimals", () => {
    expect(parseRate("0.1774974")).toBe(177_497n);
    expect(parseRate("0.1774975")).toBe(177_498n);
  });

  it.each(["", "0", "0.0000001", "-1", "abc", "1,2,3"])("rejects rate %j", (input) => {
    expect(() => parseRate(input)).toThrow();
  });

  it("formats micro-units as a numeric(18,6) string", () => {
    expect(formatRate(5_633_900n)).toBe("5.633900");
    expect(formatRate(177_497n)).toBe("0.177497");
    expect(formatRate(1_000_000n)).toBe("1.000000");
  });

  it("inverts a rate to six decimals", () => {
    expect(invertRate(5_633_900n)).toBe(177_497n); // 1 / 5.6339 = 0.17749694...
    expect(invertRate(1_000_000n)).toBe(1_000_000n);
    expect(invertRate(2_000_000n)).toBe(500_000n);
  });
});

describe("convertCents", () => {
  it("converts €12,50 to BRL at 5.6339 (70.42375 -> R$ 70,42)", () => {
    expect(convertCents(1250, parseRate("5.6339"))).toBe(7042);
  });

  it("converts R$80,00 to EUR with the inverted rate", () => {
    const brlToEur = invertRate(parseRate("5.6339"));
    expect(convertCents(8000, brlToEur)).toBe(1420); // 8000 * 0.177497 = 1419.976
  });

  it("round-trips within one cent for everyday amounts (up to 10.000,00)", () => {
    const eurToBrl = parseRate("5.6339");
    const brlToEur = invertRate(eurToBrl);
    for (const cents of [1, 99, 1250, 8000, 123456, 1_000_000]) {
      const back = convertCents(convertCents(cents, eurToBrl), brlToEur);
      expect(Math.abs(back - cents)).toBeLessThanOrEqual(1);
    }
  });

  it("keeps large round trips within the 6-decimal rate precision", () => {
    // A rate stored with 6 decimals is off by at most 0.5e-6 absolute, which
    // for ~0.18 is a relative error under 3e-6.
    const eurToBrl = parseRate("5.6339");
    const brlToEur = invertRate(eurToBrl);
    const cents = 99_999_999;
    const back = convertCents(convertCents(cents, eurToBrl), brlToEur);
    expect(Math.abs(back - cents)).toBeLessThanOrEqual(Math.ceil(cents * 3e-6));
  });

  it("rounds half away from zero", () => {
    expect(convertCents(1, parseRate("0.5"))).toBe(1);
    expect(convertCents(3, parseRate("0.5"))).toBe(2);
    expect(convertCents(-3, parseRate("0.5"))).toBe(-2);
    expect(convertCents(1, parseRate("0.499999"))).toBe(0);
  });

  it("is exact for large amounts (no float drift)", () => {
    // 9 trillion cents * 1.000001 = 9,000,009,000,000 exactly
    expect(convertCents(9_000_000_000_000, parseRate("1.000001"))).toBe(9_000_009_000_000);
  });

  it("returns the same cents at rate 1", () => {
    expect(convertCents(1250, 1_000_000n)).toBe(1250);
  });
});
