import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ReceiptText, SearchX } from "lucide-react";
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
  const periodLabel =
    profile.monthStartDay === 1
      ? format(parseISO(period.start), "MMMM 'de' yyyy", { locale: ptBR })
      : `${format(parseISO(period.start), "dd/MM")} a ${format(parseISO(period.end), "dd/MM")}`;

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

  return (
    <>
      <TransactionFiltersBar
        month={month}
        periodLabel={periodLabel}
        filters={filters}
        categories={categories}
      />

      <section
        aria-label={t("summary.inPrimary", { currency: primary })}
        className="flex flex-col gap-2"
      >
        <dl className="grid grid-cols-3 gap-3 surface p-4">
          <SummaryItem label={t("summary.income")} value={formatMoney(income, primary)} />
          <SummaryItem label={t("summary.expenses")} value={formatMoney(expenses, primary)} />
          <SummaryItem
            label={t("summary.balance")}
            value={formatMoney(income - expenses, primary)}
            strong
          />
        </dl>
        <p className="text-xs text-muted-foreground">
          {t("summary.inPrimary", { currency: primary })}
          {rows.some((r) => r.status === "planned") && <> · {t("plannedHint")}</>}
        </p>
      </section>

      {rows.length === 0 ? (
        <EmptyState filtered={hasFilters} />
      ) : (
        <div className="flex flex-col gap-6">
          {groupByDay(rows).map(([day, items]) => (
            <section key={day} aria-labelledby={`day-${day}`}>
              <h2
                id={`day-${day}`}
                className="mb-2 text-sm font-medium text-muted-foreground first-letter:uppercase"
              >
                {format(parseISO(day), "EEEE, d 'de' MMMM", { locale: ptBR })}
              </h2>
              <ul className="surface divide-y">
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
          ))}
        </div>
      )}
    </>
  );
}

function SummaryItem({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`truncate text-base tabular-nums ${strong ? "font-semibold" : "font-medium"}`}>
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
