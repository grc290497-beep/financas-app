"use client";

import { useEffect, useState } from "react";
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

  // The installed app's "Novo lançamento" shortcut opens /app?novo=1.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("novo") !== "1") return;
    // Next tick, so a cancelled effect (React's dev double-run) leaves the URL alone.
    const timer = setTimeout(() => {
      url.searchParams.delete("novo");
      window.history.replaceState(null, "", url);
      openSheet();
    });
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <Button
        size="icon-lg"
        onClick={openSheet}
        aria-label={t("add")}
        className="metal-brass active:scale-[0.94] fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 size-14 rounded-full hover:brightness-105 md:right-8 md:bottom-8"
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
