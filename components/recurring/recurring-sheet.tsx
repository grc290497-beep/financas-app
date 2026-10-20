"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { Category } from "@/lib/categories";
import type { Currency } from "@/lib/validators";
import { RecurringForm, type RecurringFormInitial } from "./recurring-form";

/**
 * A button (the "Novo fixo" action or an item row) that opens the recurring
 * item form in a bottom sheet: create without `initial`, edit with it.
 * `children` is the button's content, so server pages can render it.
 */
export function RecurringSheet({
  categories,
  primaryCurrency,
  initial,
  className,
  label,
  children,
}: {
  categories: Category[];
  primaryCurrency: Currency;
  initial?: RecurringFormInitial;
  className?: string;
  label?: string;
  children: ReactNode;
}) {
  const t = useTranslations("Fixed");
  const [open, setOpen] = useState(false);
  const [today, setToday] = useState("");

  return (
    <>
      <button
        type="button"
        aria-label={label}
        className={className}
        onClick={() => {
          setToday(format(new Date(), "yyyy-MM-dd"));
          setOpen(true);
        }}
      >
        {children}
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="mx-auto max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl pb-[calc(1rem+env(safe-area-inset-bottom))]"
        >
          <SheetHeader className="pb-0">
            <SheetTitle>{initial ? t("edit") : t("add")}</SheetTitle>
          </SheetHeader>
          <div className="px-4">
            {open && (
              <RecurringForm
                categories={categories}
                primaryCurrency={primaryCurrency}
                today={today}
                initial={initial}
                onDone={() => setOpen(false)}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
