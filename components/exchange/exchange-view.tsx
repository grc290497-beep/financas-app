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

  return (
    <>
      {/* Two symmetric rows (from / to) split by the swap button, then both
          rates and one-tap amounts: the pattern currency apps use. */}
      <section
        className="hero-card flex flex-col rounded-3xl px-5 pt-5 pb-4"
        aria-labelledby="converter"
      >
        <h2 id="converter" className="sr-only">
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

        <dl className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-black/15 px-3 py-2.5 text-xs text-hero-muted">
          <div>
            <dt className="sr-only">{t("rateEurBrl")}</dt>
            <dd className="font-medium text-hero-foreground tabular-nums">
              € 1 = R$ {rateFormat.format(latest.rate)}
            </dd>
          </div>
          <div className="text-right">
            <dt className="sr-only">{t("rateBrlEur")}</dt>
            <dd className="font-medium text-hero-foreground tabular-nums">
              R$ 1 = € {rateFormat.format(1 / latest.rate)}
            </dd>
          </div>
          <dd className="col-span-2">{t("closeOf", { date: dayMonth(latest.date) })}</dd>
        </dl>

        <div className="mt-3 grid grid-cols-5 gap-1.5" role="group" aria-label={t("quick")}>
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

      <section className="surface flex flex-col gap-4 p-4" aria-labelledby="history">
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
            className="h-9 w-full sm:w-auto"
          />
        </div>

        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Stat label={t("now")} value={`R$ ${rateFormat.format(latest.rate)}`} />
          <Stat
            label={t("change")}
            value={signedPercent.format(change)}
            icon={change >= 0 ? TrendingUp : TrendingDown}
          />
          <Stat
            label={t("high")}
            value={`R$ ${rateFormat.format(high.rate)}`}
            hint={dayMonth(high.date)}
          />
          <Stat
            label={t("low")}
            value={`R$ ${rateFormat.format(low.rate)}`}
            hint={dayMonth(low.date)}
          />
        </dl>

        {/* Single series, so no legend: the section title names it. */}
        <div className="h-56 w-full" role="img" aria-label={t("chart")}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
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
                width={52}
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
                fill="var(--brass)"
                fillOpacity={0.12}
                activeDot={{ r: 4, stroke: "var(--background)", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-muted-foreground">{t("source")}</p>
      </section>
    </>
  );
}

function Stat({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: typeof TrendingUp;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-1 font-medium tabular-nums">
        {Icon && <Icon className="size-4 text-muted-foreground" aria-hidden />}
        {value}
      </dd>
      {hint && <dd className="text-xs text-muted-foreground">{hint}</dd>}
    </div>
  );
}
