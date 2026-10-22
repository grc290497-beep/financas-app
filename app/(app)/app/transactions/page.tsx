import { Suspense } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ReceiptText, SearchX } from "lucide-react";
import { periodLabel } from "@/components/nav/month-switcher";
import { Skeleton } from "@/components/ui/skeleton";
import { TransactionFiltersBar } from "@/components/transactions/transaction-filters";
import { TransactionItem } from "@/components/transactions/transaction-item";
import { requireProfile } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { getFinancialPeriod, periodStartingIn } from "@/lib/period";
import { ensureRecurringGenerated } from "@/lib/recurring-store";
import {
  currentDate,
  getCategories,
  getCategoryUsage,
  listTransactions,
  type TransactionRow,
} from "@/lib/transactions";
import { cn } from "@/lib/utils";
import { transactionFiltersSchema } from "@/lib/validators";

export default async function TransactionsPage({ searchParams }: PageProps<"/app/transactions">) {
  const t = await getTranslations("Transactions");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <Suspense fallback={<ListSkeleton />}>
        <Transactions searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Transactions({
  searchParams,
}: {
  searchParams: PageProps<"/app/transactions">["searchParams"];
}) {
  const raw = await searchParams;
  const filters = transactionFiltersSchema.parse(
    Object.fromEntries(
      Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
    ),
  );
  const today = await currentDate();
  await ensureRecurringGenerated(today, filters.month);
  const profile = await requireProfile();
  // Months are financial months (month_start_day), keyed by the month they start in.
  const period = filters.month
    ? periodStartingIn(filters.month, profile.monthStartDay)
    : getFinancialPeriod(today, profile.monthStartDay);
  const month = period.start.slice(0, 7);

  const [categories, usage, rows, t] = await Promise.all([
    getCategories(),
    getCategoryUsage(),
    listTransactions(filters, period),
    getTranslations("Transactions"),
  ]);

  const primary = profile.primaryCurrency;
  const income = sum(rows, "income");
  const expenses = sum(rows, "expense");
  const hasFilters = Boolean(filters.type || filters.currency || filters.category || filters.q);

  // In the current month, what is still to come stays folded until asked for;
  // a future month is opened precisely to see it, so it shows everything.
  const isCurrent = period.start <= today && today <= period.end;
  const showFuture = raw.futuros === "1";
  const future = isCurrent ? rows.filter((r) => r.occurredOn > today) : [];
  const shown = showFuture ? rows : rows.filter((r) => !future.includes(r));
  const toggleFuture = new URLSearchParams(
    Object.entries(raw).flatMap(([key, value]) =>
      key === "futuros" || value === undefined ? [] : [[key, String(value)]],
    ),
  );
  if (!showFuture) toggleFuture.set("futuros", "1");
  const futureLink = future.length > 0 && (
    <Link
      href={`/app/transactions?${toggleFuture.toString()}`}
      scroll={false}
      className="self-center rounded-full px-4 py-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
    >
      {showFuture ? t("hideFuture") : t("showFuture", { count: future.length })}
    </Link>
  );

  return (
    <>
      <TransactionFiltersBar
        month={month}
        periodLabel={periodLabel(period, profile.monthStartDay)}
        filters={filters}
        categories={categories}
      />

      <section aria-label={t("summary.inPrimary", { currency: primary })} className="surface">
        <dl className="grid grid-cols-3 gap-3 p-4">
          <SummaryItem label={t("summary.income")} value={formatMoney(income, primary)} />
          <SummaryItem label={t("summary.expenses")} value={formatMoney(expenses, primary)} />
          <SummaryItem
            label={t("summary.balance")}
            value={formatMoney(income - expenses, primary)}
            tone={
              income - expenses < 0 ? "negative" : income - expenses > 0 ? "positive" : undefined
            }
          />
        </dl>
        <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">
          {t("summary.inPrimary", { currency: primary })}
          {shown.some((r) => r.status === "planned") && <> · {t("plannedHint")}</>}
        </p>
      </section>

      {shown.length === 0 ? (
        <EmptyState filtered={hasFilters} />
      ) : (
        // One card for the month; each day is a labelled band inside it.
        <div className="surface overflow-hidden">
          {groupByDay(shown).map(([day, items]) => {
            const net = sum(items, "income") - sum(items, "expense");
            return (
              <section key={day} aria-labelledby={`day-${day}`}>
                <div className="flex items-baseline justify-between gap-3 border-y bg-muted/40 px-4 py-2 first:border-t-0">
                  <h2
                    id={`day-${day}`}
                    className="text-xs font-medium text-muted-foreground first-letter:uppercase"
                  >
                    {format(parseISO(day), "EEEE, d 'de' MMMM", { locale: ptBR })}
                  </h2>
                  {net !== 0 && (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {net > 0 ? "+" : "−"} {formatMoney(Math.abs(net), primary)}
                    </span>
                  )}
                </div>
                <ul className="divide-y">
                  {items.map((row) => (
                    <li key={row.id}>
                      <TransactionItem
                        row={row}
                        primaryCurrency={primary}
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
      )}
      {futureLink}
    </>
  );
}

function SummaryItem({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "truncate text-base font-medium tabular-nums",
          tone === "positive" && "text-positive",
          tone === "negative" && "text-negative",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

async function EmptyState({ filtered }: { filtered: boolean }) {
  const t = await getTranslations("Transactions.empty");
  const Icon = filtered ? SearchX : ReceiptText;
  return (
    <section className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
      <Icon className="size-10 text-muted-foreground" aria-hidden />
      <h2 className="text-lg font-medium">{filtered ? t("filteredTitle") : t("title")}</h2>
      <p className="max-w-sm text-sm text-pretty text-muted-foreground">
        {filtered ? t("filteredDescription") : t("description")}
      </p>
    </section>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-20 w-full rounded-2xl" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    </div>
  );
}

/** Paid or received only: planned fixed costs are not money that moved yet. */
function sum(rows: TransactionRow[], type: TransactionRow["type"]) {
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
