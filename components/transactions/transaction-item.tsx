"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { Category } from "@/lib/categories";
import { formatAmountInput, formatMoney } from "@/lib/money";
import type { TransactionRow } from "@/lib/transactions";
import { cn } from "@/lib/utils";
import type { Currency } from "@/lib/validators";
import { CategoryIcon } from "./category-icon";
import { TransactionForm } from "./transaction-form";

/** A row in the list; tapping it opens the edit sheet. */
export function TransactionItem({
  row,
  primaryCurrency,
  categories,
  usage,
}: {
  row: TransactionRow;
  primaryCurrency: Currency;
  categories: Category[];
  usage: Record<string, number>;
}) {
  const t = useTranslations("Transactions");
  const [open, setOpen] = useState(false);
  const sign = row.type === "income" ? "+" : "−";
  const planned = row.status === "planned";
  // "Salario · Salário" says the same thing twice; only name the category when it adds something.
  const showCategory =
    !!row.description &&
    row.description.localeCompare(row.category.name, "pt-BR", { sensitivity: "base" }) !== 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none"
      >
        <CategoryIcon icon={row.category.icon} color={row.category.color} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate font-medium">{row.description || row.category.name}</span>
          {(showCategory || planned) && (
            <span className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
              {planned && (
                <span className="shrink-0 rounded-full bg-muted px-2 py-px text-[11px] font-medium">
                  {t("planned")}
                </span>
              )}
              {showCategory && <span className="truncate">{row.category.name}</span>}
            </span>
          )}
        </span>
        <span className="flex shrink-0 flex-col items-end">
          <span
            className={cn(
              "font-medium tabular-nums",
              row.type === "income" && "text-positive",
              planned && "text-muted-foreground",
            )}
          >
            {sign} {formatMoney(row.amountCents, row.currency)}
          </span>
          {row.currency !== primaryCurrency && (
            <span className="text-xs text-muted-foreground tabular-nums">
              ≈ {formatMoney(row.amountPrimaryCents, primaryCurrency)}
            </span>
          )}
        </span>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="mx-auto max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl pb-[calc(1rem+env(safe-area-inset-bottom))]"
        >
          <SheetHeader className="pb-0">
            <SheetTitle>{t("edit")}</SheetTitle>
          </SheetHeader>
          <div className="px-4">
            {open && (
              <TransactionForm
                categories={categories}
                usage={usage}
                primaryCurrency={primaryCurrency}
                today={row.occurredOn}
                initial={{
                  id: row.id,
                  type: row.type,
                  amount: formatAmountInput(row.amountCents),
                  currency: row.currency,
                  categoryId: row.categoryId,
                  occurredOn: row.occurredOn,
                  description: row.description ?? "",
                  fxRate: row.fxRate,
                }}
                onDone={() => setOpen(false)}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
