import { Suspense } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ReceiptText, SearchX } from "lucide-react";
import { periodLabel } from "@/components/nav/month-switcher";
import { Skeleton } from "@/components/ui/skeleton";
import { TransactionFiltersBar } from "@/components/transactions/transaction-filters";
import { sumConfirmed, TransactionDayList } from "@/components/transactions/transaction-day-list";
import { requireProfile } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { getFinancialPeriod, periodStartingIn } from "@/lib/period";
import { ensureRecurringGenerated } from "@/lib/recurring-store";
import { currentDate, getCategories, getCategoryUsage, listTransactions } from "@/lib/transactions";
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
  const income = sumConfirmed(rows, "income");
  const expenses = sumConfirmed(rows, "expense");
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
        <TransactionDayList
          rows={shown}
          today={today}
          primaryCurrency={primary}
          categories={categories}
          usage={usage}
        />
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
