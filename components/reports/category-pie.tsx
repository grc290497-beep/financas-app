"use client";

import { useTranslations } from "next-intl";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatMoney } from "@/lib/money";
import type { Currency } from "@/lib/validators";

export type CategorySlice = { name: string; cents: number; color: string };

const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });

/**
 * Spending by category as a donut. Slices use the category's own colour, so
 * the list next to it (name, amount, share) carries identity and is the
 * table view.
 */
export function CategoryPie({ slices, currency }: { slices: CategorySlice[]; currency: Currency }) {
  const t = useTranslations("Reports");
  const total = slices.reduce((sum, s) => sum + s.cents, 0);

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="size-44 shrink-0" role="img" aria-label={t("pieChart")}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="cents"
              nameKey="name"
              innerRadius="58%"
              outerRadius="100%"
              stroke="var(--background)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {slices.map((s) => (
                <Cell key={s.name} fill={s.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                const slice = active ? (payload?.[0]?.payload as CategorySlice | undefined) : null;
                if (!slice) return null;
                return (
                  <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-sm">
                    <p className="text-muted-foreground">{slice.name}</p>
                    <p className="font-medium tabular-nums text-popover-foreground">
                      {formatMoney(slice.cents, currency)} · {percent.format(slice.cents / total)}
                    </p>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex w-full flex-col gap-2 text-sm">
        {slices.map((s) => (
          <li key={s.name} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-sm" style={{ background: s.color }} aria-hidden />
            <span className="min-w-0 flex-1 truncate">{s.name}</span>
            <span className="shrink-0 tabular-nums">{formatMoney(s.cents, currency)}</span>
            <span className="w-10 shrink-0 text-right text-muted-foreground tabular-nums">
              {percent.format(s.cents / total)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
