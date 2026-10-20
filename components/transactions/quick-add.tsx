"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { Category } from "@/lib/categories";
import type { Currency } from "@/lib/validators";
import { TransactionForm } from "./transaction-form";

/** Floating "+" that opens the quick-add sheet. Always visible on mobile. */
export function QuickAdd(props: {
  categories: Category[];
  usage: Record<string, number>;
  primaryCurrency: Currency;
}) {
  const t = useTranslations("Transactions");
  const [open, setOpen] = useState(false);
  // The device's date, taken when the sheet opens (the server runs in UTC).
  const [today, setToday] = useState("");
  const [formKey, setFormKey] = useState(0);

  const openSheet = () => {
    setToday(format(new Date(), "yyyy-MM-dd"));
    setFormKey((k) => k + 1);
    setOpen(true);
  };

  return (
    <>
      <Button
        size="icon-lg"
        onClick={openSheet}
        aria-label={t("add")}
        className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 size-14 rounded-full shadow-lg md:right-8 md:bottom-8"
      >
        <Plus className="size-6" aria-hidden />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="mx-auto max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl pb-[calc(1rem+env(safe-area-inset-bottom))]"
        >
          <SheetHeader className="pb-0">
            <SheetTitle>{t("add")}</SheetTitle>
          </SheetHeader>
          <div className="px-4">
            {open && (
              <TransactionForm
                key={formKey}
                {...props}
                today={today}
                onDone={() => setOpen(false)}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
