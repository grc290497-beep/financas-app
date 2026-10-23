"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { format, parseISO } from "date-fns";
import { ArrowDownUp, TrendingDown, TrendingUp } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Segmented } from "@/components/forms/segmented";
import { addDays, addMonths } from "@/lib/dates";
import { convertCents, formatMoney, invertRate, parseAmount, parseRate } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Currency } from "@/lib/validators";

type Point = { date: string; rate: number };
type Range = "4w" | "3m" | "12m";

const rateFormat = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});
const signedPercent = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});
const dayMonth = (date: string) => format(parseISO(date), "dd/MM");
// Display only: the badge beside it already says which currency it is.
const amountFormat = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const QUICK_AMOUNTS = [10, 50, 100, 500, 1000];

/** Coin-like mark with the symbol, plus the code and the currency's name. */
function CurrencyBadge({ currency, label }: { currency: Currency; label: string }) {
  return (
    <div className="flex shrink-0 items-center gap-2.5">
      <span
        className="flex size-10 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-brass-light ring-1 ring-brass-light/30"
        aria-hidden
      >
        {currency === "EUR" ? "€" : "R$"}
      </span>
      <span className="flex flex-col leading-tight">
        <span className="font-semibold text-hero-foreground">{currency}</span>
        <span className="text-xs text-hero-muted">{label}</span>
      </span>
    </div>
  );
}

/** Converter plus the EUR→BRL history, for a feel of where the rate stands. */
export function ExchangeView({ series, today }: { series: Point[]; today: string }) {
  const t = useTranslations("Exchange");
  const [from, setFrom] = useState<Currency>("EUR");
  const [amount, setAmount] = useState("100");
  const [range, setRange] = useState<Range>("3m");

  const latest = series[series.length - 1];
  // Same rounding as transactions: micro-units, never floats, for the money itself.
  const eurToBrl = parseRate(latest.rate.toFixed(6));
  const cents = parseAmount(amount);
  const to: Currency = from === "EUR" ? "BRL" : "EUR";
  let converted: number | null = null;
  try {
    if (cents !== null) {
      converted = convertCents(cents, from === "EUR" ? eurToBrl : invertRate(eurToBrl));
    }
  } catch {
    converted = null; // an absurdly large amount: show "—" instead of crashing
  }

  const since = range === "4w" ? addDays(today, -28) : addMonths(today, range === "3m" ? -3 : -12);
  const points = series.filter((p) => p.date >= since);
  const first = points[0] ?? latest;
  const change = (latest.rate - first.rate) / first.rate;
  const high = points.reduce((a, b) => (b.rate > a.rate ? b : a), first);
  const low = points.reduce((a, b) => (b.rate < a.rate ? b : a), first);

  // Day-to-day: the latest close against the one before it.
  const previous = series[series.length - 2] ?? latest;
  const dayChange = (latest.rate - previous.rate) / previous.rate;
  const DayIcon = dayChange >= 0 ? TrendingUp : TrendingDown;

  return (
    <>
      {/* The rate itself first: it is what the page is opened for. */}
      <section className="flex flex-col gap-1" aria-labelledby="rate-today">
        <h2 id="rate-today" className="text-sm text-muted-foreground">
          {t("headline")}
        </h2>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">
            R$ {rateFormat.format(latest.rate)}
          </p>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium tabular-nums",
              dayChange >= 0 ? "bg-positive/15 text-positive" : "bg-negative/15 text-negative",
            )}
          >
            <DayIcon className="size-3.5" aria-hidden />
            {t("dayChange", { change: signedPercent.format(dayChange) })}
          </span>
        </div>
        <p className="text-xs text-muted-foreground tabular-nums">
          {t("closeOf", { date: dayMonth(latest.date) })} · R$ 1 = €{" "}
          {rateFormat.format(1 / latest.rate)}
        </p>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
        {/* Two symmetric rows (from / to) split by the swap button, then
            one-tap amounts: the pattern currency apps use. */}
        <section
          className="hero-card flex flex-col rounded-3xl px-5 pt-5 pb-4"
          aria-labelledby="converter"
        >
          <h2 id="converter" className="mb-4 text-sm text-hero-muted">
            {t("converter")}
          </h2>

          <div className="flex items-center gap-3 pb-5">
            <CurrencyBadge currency={from} label={t(`names.${from}`)} />
            <label className="sr-only" htmlFor="fx-amount">
              {t("amount", { currency: from })}
            </label>
            <input
              id="fx-amount"
              inputMode="decimal"
              autoComplete="off"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              onFocus={(event) => event.currentTarget.select()}
              placeholder="0"
              className="min-w-0 flex-1 rounded-md bg-transparent text-right text-4xl font-semibold tracking-tight text-hero-foreground tabular-nums outline-none placeholder:text-hero-muted/60 focus-visible:ring-2 focus-visible:ring-brass-light/60"
            />
          </div>

          <div className="relative border-t border-white/15">
            <button
              type="button"
              onClick={() => setFrom(to)}
              aria-label={t("swap")}
              className="metal-brass absolute top-0 left-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full outline-4 outline-[color-mix(in_oklch,var(--hero)_55%,var(--hero-2))] transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.93]"
            >
              <ArrowDownUp className="size-5" aria-hidden />
            </button>
          </div>

          <div className="flex items-center gap-3 pt-5" aria-live="polite">
            <CurrencyBadge currency={to} label={t(`names.${to}`)} />
            <p className="min-w-0 flex-1 truncate text-right text-4xl font-semibold tracking-tight text-brass-light tabular-nums">
              {converted === null ? "—" : amountFormat.format(converted / 100)}
            </p>
          </div>

          <div className="mt-5 grid grid-cols-5 gap-1.5" role="group" aria-label={t("quick")}>
            {QUICK_AMOUNTS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setAmount(String(value))}
                className="raised h-9 rounded-full px-1 text-[13px] font-medium whitespace-nowrap text-hero-foreground tabular-nums transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:translate-y-px active:scale-[0.97] hover:brightness-110 aria-pressed:metal-brass"
                aria-pressed={amount === String(value)}
              >
                {formatMoney(value * 100, from).replace(/,00$/, "")}
              </button>
            ))}
          </div>
        </section>

        <section className="surface flex flex-col gap-4 p-4 sm:p-5" aria-labelledby="history">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="history" className="text-base font-medium">
              {t("history")}
            </h2>
            <Segmented<Range>
              label={t("range")}
              value={range}
              onChange={setRange}
              options={[
                { value: "4w", label: t("ranges.4w") },
                { value: "3m", label: t("ranges.3m") },
                { value: "12m", label: t("ranges.12m") },
              ]}
              className="h-9 w-full whitespace-nowrap sm:w-auto"
            />
          </div>

          <dl className="grid grid-cols-3 divide-x rounded-xl bg-muted/40 py-2.5 text-sm">
            <Stat
              label={t("change")}
              value={signedPercent.format(change)}
              tone={change >= 0 ? "positive" : "negative"}
            />
            <Stat
              label={t("high")}
              value={rateFormat.format(high.rate)}
              hint={dayMonth(high.date)}
            />
            <Stat label={t("low")} value={rateFormat.format(low.rate)} hint={dayMonth(low.date)} />
          </dl>

          {/* Single series, so no legend: the section title names it. */}
          <div className="h-56 w-full lg:h-72" role="img" aria-label={t("chart")}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="fx-fill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--brass)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--brass)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
                <XAxis
                  dataKey="date"
                  tickFormatter={dayMonth}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={28}
                />
                <YAxis
                  width={44}
                  domain={["dataMin - 0.05", "dataMax + 0.05"]}
                  tickFormatter={(rate: number) => rate.toFixed(2).replace(".", ",")}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
                  content={({ active, payload }) => {
                    const point = active ? (payload?.[0]?.payload as Point | undefined) : null;
                    if (!point) return null;
                    return (
                      <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-sm">
                        <p className="text-muted-foreground">
                          {format(parseISO(point.date), "dd/MM/yyyy")}
                        </p>
                        <p className="font-medium tabular-nums text-popover-foreground">
                          € 1 = R$ {rateFormat.format(point.rate)}
                        </p>
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="rate"
                  stroke="var(--brass)"
                  strokeWidth={2}
                  fill="url(#fx-fill)"
                  activeDot={{ r: 4, stroke: "var(--background)", strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground">{t("source")}</p>
        </section>
      </div>
    </>
  );
}
function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "positive" | "negative";
}) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-0.5 px-2 text-center">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "font-semibold tabular-nums",
          tone === "positive" && "text-positive",
          tone === "negative" && "text-negative",
        )}
      >
        {value}
      </dd>
      {hint && <dd className="text-xs text-muted-foreground">{hint}</dd>}
    </div>
  );
}
