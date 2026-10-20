"use client";

import { useTranslations } from "next-intl";
import { format, parseISO } from "date-fns";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney } from "@/lib/money";
import type { Currency } from "@/lib/validators";

/**
 * Amount saved over time: a single series (no legend; the section title
 * names it), stepped because the balance only changes on contribution days,
 * with the target as a dashed reference line. The history list below is the
 * table view.
 */
export function GoalChart({
  points,
  targetCents,
  currency,
  color,
}: {
  points: { date: string; cents: number }[];
  targetCents: number;
  currency: Currency;
  color: string;
}) {
  const t = useTranslations("Goals");
  const data = points.map((p) => ({ date: p.date, value: p.cents }));

  return (
    <div className="h-52 w-full" role="img" aria-label={t("chart")}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
          <XAxis
            dataKey="date"
            tickFormatter={(date: string) => format(parseISO(date), "dd/MM")}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            width={56}
            domain={[0, (max: number) => Math.max(max, targetCents)]}
            tickFormatter={(cents: number) => formatMoney(cents, currency).replace(/,\d\d$/, "")}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <ReferenceLine
            y={targetCents}
            stroke="var(--muted-foreground)"
            strokeDasharray="4 4"
            label={{
              value: t("chartTarget"),
              position: "insideTopRight",
              fill: "var(--muted-foreground)",
              fontSize: 12,
            }}
          />
          <Tooltip
            cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
            content={({ active, payload }) => {
              const point = active ? payload?.[0]?.payload : null;
              if (!point) return null;
              return (
                <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-sm">
                  <p className="text-muted-foreground">
                    {format(parseISO(point.date), "dd/MM/yyyy")}
                  </p>
                  <p className="font-medium tabular-nums text-popover-foreground">
                    {formatMoney(point.value, currency)}
                  </p>
                </div>
              );
            }}
          />
          <Area
            type="stepAfter"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={color}
            fillOpacity={0.12}
            activeDot={{ r: 4, stroke: "var(--background)", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
