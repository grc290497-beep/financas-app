import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarClock, CheckCircle2, Plus } from "lucide-react";
import { MonthSwitcher, periodLabel } from "@/components/nav/month-switcher";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PayButton } from "@/components/recurring/pay-button";
import { RecurringSheet } from "@/components/recurring/recurring-sheet";
import { CategoryIcon } from "@/components/transactions/category-icon";
import { requireProfile } from "@/lib/auth";
import type { Category } from "@/lib/categories";
import { formatAmountInput, formatMoney } from "@/lib/money";
import { getFinancialPeriod, periodStartingIn, shiftPeriod } from "@/lib/period";
import { nextOccurrence, type RecurringItem } from "@/lib/recurring";
import {
  ensureRecurringGenerated,
  listPlanned,
  listRecurringItems,
  type PlannedRow,
} from "@/lib/recurring-store";
import { currentDate, getCategories } from "@/lib/transactions";
import { cn } from "@/lib/utils";
import { transactionFiltersSchema, type Currency } from "@/lib/validators";

const dayMonth = (date: string) => format(parseISO(date), "dd/MM");

export default async function FixedPage({ searchParams }: PageProps<"/app/fixed">) {
  const t = await getTranslations("Fixed");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <Suspense fallback={<FixedSkeleton />}>
        <Fixed searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Fixed({ searchParams }: { searchParams: PageProps<"/app/fixed">["searchParams"] }) {
  const raw = await searchParams;
  const { month } = transactionFiltersSchema.parse({
    month: Array.isArray(raw.month) ? raw.month[0] : raw.month,
  });
  const today = await currentDate();
  await ensureRecurringGenerated(today, month);

  const profile = await requireProfile();
  const msd = profile.monthStartDay;
  const current = getFinancialPeriod(today, msd);
  const period = month ? periodStartingIn(month, msd) : current;
  const isCurrent = period.start === current.start;
  const monthLink = (count: number) =>
    `/app/fixed?month=${shiftPeriod(period, msd, count).start.slice(0, 7)}`;
  const [planned, items, categories, t] = await Promise.all([
    listPlanned(period.start, period.end, { withPaid: true }),
    listRecurringItems(),
    getCategories(),
    getTranslations("Fixed"),
  ]);
  const primary = profile.primaryCurrency;
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const toPay = planned.filter((p) => p.type === "expense");
  const toReceive = planned.filter((p) => p.type === "income");
  const pending = planned.filter((p) => !p.paid);
  const remaining = toPay.filter((p) => !p.paid).reduce((sum, p) => sum + p.amountPrimaryCents, 0);
  // Items with no occurrence left (e.g. the old version after a raise) move to a folded list.
  const running = items.filter((i) => nextOccurrence(i, today) !== null);
  const ended = items.filter((i) => nextOccurrence(i, today) === null);
  const expenses = running.filter((i) => i.type === "expense");
  const incomes = running.filter((i) => i.type === "income");

  const addButton = (
    <RecurringSheet
      categories={categories}
      primaryCurrency={primary}
      className={buttonVariants({ className: "self-start" })}
    >
      <Plus className="size-4" aria-hidden />
      {t("add")}
    </RecurringSheet>
  );

  if (items.length === 0) {
    return (
      <section className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
        <CalendarClock className="size-10 text-muted-foreground" aria-hidden />
        <h2 className="text-lg font-medium">{t("empty.title")}</h2>
        <p className="max-w-sm text-sm text-pretty text-muted-foreground">
          {t("empty.description")}
        </p>
        <div className="pt-2">{addButton}</div>
      </section>
    );
  }

  return (
    <>
      <section aria-labelledby="this-month" className="flex flex-col gap-3">
        <h2 id="this-month" className="sr-only">
          {t("period", { start: dayMonth(period.start), end: dayMonth(period.end) })}
        </h2>
        <MonthSwitcher
          label={periodLabel(period, msd)}
          previousHref={monthLink(-1)}
          nextHref={monthLink(1)}
          previousLabel={t("previousMonth")}
          nextLabel={t("nextMonth")}
          currentHref={isCurrent ? undefined : "/app/fixed"}
          currentLabel={t("current")}
        />

        {planned.length === 0 ? (
          <p className="flex items-center gap-2 surface px-4 py-3 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 text-positive" aria-hidden />
            {t("allDone")}
          </p>
        ) : (
          // The month's fixed items, paid ones ticked; folded in the current month.
          // A future month is opened precisely to see what is planned, so it starts unfolded.
          <details className="group" open={!isCurrent}>
            <summary className="surface flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm select-none">
              <span className="flex items-center gap-2">
                {pending.length === 0 && (
                  <CheckCircle2 className="size-4 text-positive" aria-hidden />
                )}
                {pending.length > 0 ? t("upcomingList", { count: pending.length }) : t("allPaid")}
              </span>
              <span className="text-muted-foreground group-open:hidden">{t("show")}</span>
              <span className="hidden text-muted-foreground group-open:inline">{t("hide")}</span>
            </summary>
            <div className="mt-3 flex flex-col gap-3">
              {/* Incomes first: usually fewer lines, and what pays for the rest. */}
              {toReceive.length > 0 && (
                <PlannedList
                  title={t("toReceive")}
                  rows={toReceive}
                  today={today}
                  primary={primary}
                  categoryIdByItem={new Map(items.map((i) => [i.id, i.categoryId]))}
                  categoryById={categoryById}
                />
              )}
              {toPay.length > 0 && (
                <PlannedList
                  title={t("toPay")}
                  rows={toPay}
                  today={today}
                  primary={primary}
                  categoryIdByItem={new Map(items.map((i) => [i.id, i.categoryId]))}
                  categoryById={categoryById}
                  footer={
                    remaining > 0
                      ? t("remaining", { amount: formatMoney(remaining, primary) })
                      : undefined
                  }
                />
              )}
            </div>
          </details>
        )}
      </section>

      {addButton}

      {incomes.length > 0 && (
        <ItemList
          title={t("incomes")}
          items={incomes}
          today={today}
          categories={categories}
          categoryById={categoryById}
          primary={primary}
        />
      )}
      {expenses.length > 0 && (
        <ItemList
          title={t("expenses")}
          items={expenses}
          today={today}
          categories={categories}
          categoryById={categoryById}
          primary={primary}
        />
      )}
      {ended.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm text-muted-foreground select-none hover:text-foreground">
            {t("endedList", { count: ended.length })}
          </summary>
          <div className="mt-2">
            <ItemList
              title={t("endedTitle")}
              items={ended}
              today={today}
              categories={categories}
              categoryById={categoryById}
              primary={primary}
            />
          </div>
        </details>
      )}
    </>
  );
}

async function PlannedList({
  title,
  rows,
  today,
  primary,
  categoryIdByItem,
  categoryById,
  footer,
}: {
  title: string;
  rows: PlannedRow[];
  today: string;
  primary: Currency;
  categoryIdByItem: Map<string, string>;
  categoryById: Map<string, Category>;
  footer?: string;
}) {
  const t = await getTranslations("Fixed");

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      <ul className="surface divide-y">
        {rows.map((row) => {
          const category = categoryById.get(
            (row.recurringItemId && categoryIdByItem.get(row.recurringItemId)) || "",
          );
          const overdue = !row.paid && row.occurredOn < today && row.type === "expense";
          const due = dayMonth(row.occurredOn);
          return (
            <li key={row.id} className="flex items-center gap-3 px-4 py-3.5">
              <CategoryIcon icon={category?.icon ?? null} color={category?.color ?? null} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className={cn("truncate font-medium", row.paid && "text-muted-foreground")}>
                  {row.description}
                </span>
                <span
                  className={cn(
                    "flex items-center gap-1 text-sm",
                    overdue ? "text-negative" : "text-muted-foreground",
                  )}
                >
                  {row.paid && <CheckCircle2 className="size-3.5 text-positive" aria-hidden />}
                  {row.paid
                    ? t(row.type === "income" ? "receivedOn" : "paidOn", { date: due })
                    : overdue
                      ? t("overdue", { date: due })
                      : row.type === "income"
                        ? t("receiveOn", { date: due })
                        : t("dueOn", { date: due })}
                </span>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="font-medium tabular-nums">
                  {formatMoney(row.amountCents, row.currency)}
                </span>
                {row.currency !== primary && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    ≈ {formatMoney(row.amountPrimaryCents, primary)}
                  </span>
                )}
              </div>
              {!row.paid && (
                <PayButton
                  id={row.id}
                  type={row.type}
                  name={row.description ?? ""}
                  dueLabel={due}
                  amountCents={row.amountCents}
                  currency={row.currency}
                />
              )}
            </li>
          );
        })}
      </ul>
      {footer && <p className="text-sm text-muted-foreground">{footer}</p>}
    </div>
  );
}

async function ItemList({
  title,
  items,
  today,
  categories,
  categoryById,
  primary,
}: {
  title: string;
  items: RecurringItem[];
  today: string;
  categories: Category[];
  categoryById: Map<string, Category>;
  primary: Currency;
}) {
  const t = await getTranslations("Fixed");

  const schedule = (item: RecurringItem) => {
    if (item.frequency === "monthly") return t("schedule.monthly", { day: item.dayOfMonth ?? 1 });
    if (item.frequency === "weekly" || item.frequency === "biweekly") {
      return t(`schedule.${item.frequency}`, {
        weekday: format(parseISO(item.startOn), "EEEE", { locale: ptBR }),
      });
    }
    return t("schedule.yearly", { date: dayMonth(item.startOn) });
  };

  return (
    <section className="flex flex-col gap-2" aria-label={title}>
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      <ul className="surface divide-y">
        {items.map((item) => {
          const category = categoryById.get(item.categoryId);
          const next = nextOccurrence(item, today);
          return (
            <li key={item.id}>
              <RecurringSheet
                categories={categories}
                primaryCurrency={primary}
                initial={{
                  id: item.id,
                  type: item.type,
                  name: item.name,
                  amount: formatAmountInput(item.amountCents),
                  currency: item.currency,
                  categoryId: item.categoryId,
                  frequency: item.frequency,
                  dayOfMonth: String(item.dayOfMonth ?? ""),
                  startOn: item.startOn,
                  endOn: item.endOn ?? "",
                }}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none"
              >
                <CategoryIcon icon={category?.icon ?? null} color={category?.color ?? null} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{item.name}</span>
                  <span className="truncate text-sm text-muted-foreground">
                    {schedule(item)} · {next ? t("next", { date: dayMonth(next) }) : t("ended")}
                  </span>
                </span>
                <span className="shrink-0 font-medium tabular-nums">
                  {formatMoney(item.amountCents, item.currency)}
                </span>
              </RecurringSheet>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function FixedSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-9 w-32" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}
