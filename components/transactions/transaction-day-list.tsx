import { getTranslations } from "next-intl/server";
import { format, parseISO, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TransactionItem } from "@/components/transactions/transaction-item";
import type { Category } from "@/lib/categories";
import { formatMoney } from "@/lib/money";
import type { TransactionRow } from "@/lib/transactions";
import type { Currency } from "@/lib/validators";

/** Paid or received only: planned fixed costs are not money that moved yet. */
export function sumConfirmed(rows: TransactionRow[], type: TransactionRow["type"]) {
  return rows
    .filter((r) => r.type === type && r.status === "confirmed")
    .reduce((total, r) => total + r.amountPrimaryCents, 0);
}

function groupByDay(rows: TransactionRow[]): [string, TransactionRow[]][] {
  const groups = new Map<string, TransactionRow[]>();
  for (const row of rows) {
    groups.set(row.occurredOn, [...(groups.get(row.occurredOn) ?? []), row]);
  }
  return [...groups.entries()];
}

/** One card; each day is a labelled band inside it with the day's net. */
export async function TransactionDayList({
  rows,
  today,
  primaryCurrency,
  categories,
  usage,
}: {
  rows: TransactionRow[];
  today: string;
  primaryCurrency: Currency;
  categories: Category[];
  usage: Record<string, number>;
}) {
  const t = await getTranslations("Transactions");
  const yesterday = format(subDays(parseISO(today), 1), "yyyy-MM-dd");
  const dayLabel = (day: string) => {
    const full = format(parseISO(day), "EEEE, d 'de' MMMM", { locale: ptBR });
    if (day === today) return `${t("today")} · ${full}`;
    if (day === yesterday) return `${t("yesterday")} · ${full}`;
    return full;
  };

  return (
    <div className="surface overflow-hidden">
      {groupByDay(rows).map(([day, items]) => {
        const net = sumConfirmed(items, "income") - sumConfirmed(items, "expense");
        return (
          <section key={day} aria-labelledby={`day-${day}`}>
            <div className="flex items-baseline justify-between gap-3 border-y bg-muted/40 px-4 py-2 first:border-t-0">
              <h2
                id={`day-${day}`}
                className="text-xs font-medium text-muted-foreground first-letter:uppercase"
              >
                {dayLabel(day)}
              </h2>
              {net !== 0 && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {net > 0 ? "+" : "−"} {formatMoney(Math.abs(net), primaryCurrency)}
                </span>
              )}
            </div>
            <ul className="divide-y">
              {items.map((row) => (
                <li key={row.id}>
                  <TransactionItem
                    row={row}
                    primaryCurrency={primaryCurrency}
                    categories={categories}
                    usage={usage}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
