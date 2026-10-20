import type { Currency } from "@/lib/validators";

// All money math lives here. Amounts are integer cents (bigint in Postgres;
// JS numbers here, guarded to the safe-integer range). Exchange rates are
// integer micro-units (rate * 1e6, matching numeric(18,6)) held as bigint,
// so conversion never touches floating point.

const MICRO = 1_000_000n;

const CURRENCY_NOISE = /R\$|€|EUR|BRL|\s| | /gi;

/**
 * Parses a typed amount into cents. Accepts pt-BR ("1.234,56") and en
 * ("1,234.56") styles: the last separator followed by 1-2 digits is the
 * decimal point; any other separators must group thousands in threes.
 * Returns null for anything else, including negatives.
 */
export function parseAmount(input: string): number | null {
  const s = input.replace(CURRENCY_NOISE, "");
  if (!/^[\d.,]+$/.test(s) || !/^\d/.test(s)) return null;

  let integerPart = s;
  let fraction = "";
  const lastSep = Math.max(s.lastIndexOf(","), s.lastIndexOf("."));
  if (lastSep >= 0) {
    const after = s.slice(lastSep + 1);
    if (/^\d{1,2}$/.test(after)) {
      integerPart = s.slice(0, lastSep);
      fraction = after;
      if (integerPart.includes(s[lastSep])) return null;
    } else if (after.length === 0) {
      return null;
    }
  }

  if (!/^\d+$/.test(integerPart) && !/^\d{1,3}([.,])\d{3}(\1\d{3})*$/.test(integerPart)) {
    return null;
  }

  const digits = integerPart.replace(/[.,]/g, "") + fraction.padEnd(2, "0");
  const cents = Number(digits);
  return Number.isSafeInteger(cents) ? cents : null;
}

const formatters = new Map<string, Intl.NumberFormat>();

/** "€ 12,50", "R$ 80,00" (pt-BR by default). */
export function formatMoney(cents: number, currency: Currency, locale = "pt-BR"): string {
  const key = `${locale}:${currency}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { style: "currency", currency });
    formatters.set(key, formatter);
  }
  // Format from exact integer parts so large values never pass through a float division.
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const whole = Math.trunc(abs / 100);
  const decimal = String(abs % 100).padStart(2, "0");
  return sign + formatter.format(Number(`${whole}.${decimal}`));
}

/** Cents as an editable pt-BR input value: 123456 -> "1234,56". */
export function formatAmountInput(cents: number): string {
  const abs = Math.abs(cents);
  return `${cents < 0 ? "-" : ""}${Math.trunc(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
}

/** "5.6339" or "5,6339" -> 5_633_900n. Rounds past 6 decimals; must be > 0. */
export function parseRate(input: string | number): bigint {
  const s = String(input).trim().replace(",", ".");
  const match = /^(\d+)(?:\.(\d+))?$/.exec(s);
  if (!match) throw new Error(`Invalid exchange rate: ${input}`);

  const [, whole, fraction = ""] = match;
  let micro = BigInt(whole) * MICRO + BigInt(fraction.slice(0, 6).padEnd(6, "0"));
  if (fraction.length > 6 && Number(fraction[6]) >= 5) micro += 1n;
  if (micro <= 0n) throw new Error(`Exchange rate must be positive: ${input}`);
  return micro;
}

/** 5_633_900n -> "5.633900" (Postgres numeric(18,6)). */
export function formatRate(micro: bigint): string {
  return `${micro / MICRO}.${String(micro % MICRO).padStart(6, "0")}`;
}

/** 1 / rate, rounded to 6 decimals. */
export function invertRate(micro: bigint): bigint {
  return divRound(MICRO * MICRO, micro);
}

/** cents * rate, rounded half away from zero. */
export function convertCents(cents: number, rateMicro: bigint): number {
  if (!Number.isSafeInteger(cents)) throw new Error(`Not an integer amount of cents: ${cents}`);
  const result = Number(divRound(BigInt(cents) * rateMicro, MICRO));
  if (!Number.isSafeInteger(result)) throw new Error("Converted amount is out of range");
  return result;
}

function divRound(numerator: bigint, denominator: bigint): bigint {
  const negative = numerator < 0n !== denominator < 0n;
  const n = numerator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  const q = (n + d / 2n) / d;
  return negative ? -q : q;
}
