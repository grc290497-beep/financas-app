"use client";

import { useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/lib/money";
import type { Currency } from "@/lib/validators";

export type MonthBar = { label: string; incomeCents: number; expenseCents: number };

// Blue/orange instead of green/red: separable with colour blindness (dataviz
// validator), with a light and a dark step in globals.css.
const SERIES = [
  { key: "incomeCents", color: "var(--income)", label: "income" },
  { key: "expenseCents", color: "var(--expense)", label: "expenses" },
] as const;

/** Income vs expenses for the last 12 periods. The table below is the table view. */
export function MonthBars({ data, currency }: { data: MonthBar[]; currency: Currency }) {
  const t = useTranslations("Reports");

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex gap-4 text-xs text-muted-foreground">
        {SERIES.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: s.color }} aria-hidden />
            {t(s.label)}
          </li>
        ))}
      </ul>
      <div className="h-60 w-full" role="img" aria-label={t("barsChart")}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }} barGap={2}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
            <XAxis
              dataKey="label"
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={8}
            />
            <YAxis
              width={56}
              tickFormatter={(cents: number) => formatMoney(cents, currency).replace(/,\d\d$/, "")}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.5 }}
              content={({ active, payload }) => {
                const point = active ? (payload?.[0]?.payload as MonthBar | undefined) : null;
                if (!point) return null;
                return (
                  <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-sm">
                    <p className="text-muted-foreground">{point.label}</p>
                    {SERIES.map((s) => (
                      <p key={s.key} className="flex items-center gap-1.5 text-popover-foreground">
                        <span
                          className="size-2 rounded-sm"
                          style={{ background: s.color }}
                          aria-hidden
                        />
                        {t(s.label)}:{" "}
                        <span className="font-medium tabular-nums">
                          {formatMoney(point[s.key], currency)}
                        </span>
                      </p>
                    ))}
                  </div>
                );
              }}
            />
            {SERIES.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                fill={s.color}
                radius={[4, 4, 0, 0]}
                maxBarSize={18}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
