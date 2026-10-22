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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
      <section
        className="hero-card flex flex-col gap-4 rounded-3xl px-5 py-6"
        aria-labelledby="converter"
      >
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="converter" className="text-sm text-hero-muted">
            {t("converter")}
          </h2>
          <span className="text-xs text-hero-muted">
            {t("rateOf", { rate: rateFormat.format(latest.rate), date: dayMonth(latest.date) })}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="fx-amount">
            {t("amount", { currency: from })}
          </label>
          <span className="w-10 shrink-0 text-sm font-medium text-hero-muted">{from}</span>
          <Input
            id="fx-amount"
            inputMode="decimal"
            autoComplete="off"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="h-12 border-white/15 bg-white/10 text-2xl font-semibold text-hero-foreground tabular-nums md:text-2xl"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-12 shrink-0 text-hero-foreground hover:bg-white/10"
            aria-label={t("swap")}
            onClick={() => setFrom(to)}
          >
            <ArrowDownUp aria-hidden />
          </Button>
        </div>

        <p className="flex items-baseline gap-2" aria-live="polite">
          <span className="w-10 shrink-0 text-sm font-medium text-hero-muted">{to}</span>
          <span className="text-4xl font-semibold tracking-tight text-brass-light tabular-nums">
            {converted === null ? "—" : formatMoney(converted, to)}
          </span>
        </p>
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
