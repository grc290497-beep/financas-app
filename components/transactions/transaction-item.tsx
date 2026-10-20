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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
      >
        <CategoryIcon icon={row.category.icon} color={row.category.color} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium">{row.description || row.category.name}</span>
          {row.description && (
            <span className="truncate text-sm text-muted-foreground">{row.category.name}</span>
          )}
        </span>
        <span className="flex shrink-0 flex-col items-end">
          <span
            className={cn(
              "font-medium tabular-nums",
              row.type === "income" && "text-emerald-600 dark:text-emerald-400",
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
