"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setCategoryBudget } from "@/lib/actions/budget";
import { formatAmountInput } from "@/lib/money";
import { cn } from "@/lib/utils";

/** Compact inline editor for one category's monthly limit; the save button shows once edited. */
export function BudgetLimitInput({
  categoryId,
  name,
  budgetCents,
  symbol,
}: {
  categoryId: string;
  name: string;
  budgetCents: number | null;
  /** "€" or "R$", shown inside the field. */
  symbol: string;
}) {
  const t = useTranslations("Budget");
  const initial = budgetCents ? formatAmountInput(budgetCents) : "";
  const [saved, setSaved] = useState(initial);
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = value.trim() !== saved;

  const save = () =>
    startTransition(async () => {
      setError(null);
      const result = await setCategoryBudget({ categoryId, amount: value });
      if (result.status === "error") {
        setError(result.error);
        return;
      }
      setSaved(value.trim());
      toast.success(value.trim() ? t("saved") : t("removed"));
    });

  return (
    <form
      className="flex shrink-0 flex-col items-end gap-1"
      onSubmit={(event) => {
        event.preventDefault();
        if (dirty) save();
      }}
    >
      <div className="flex items-center gap-1.5">
        <div className="relative">
          {value && (
            <span
              className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs text-muted-foreground"
              aria-hidden
            >
              {symbol}
            </span>
          )}
          <Input
            inputMode="decimal"
            autoComplete="off"
            placeholder={t("noLimit")}
            aria-label={t("limit", { name })}
            aria-invalid={!!error}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className={cn("h-9 w-28 text-right tabular-nums", value && "pl-7")}
          />
        </div>
        {dirty && (
          <Button
            type="submit"
            size="icon"
            className="size-9"
            disabled={pending}
            aria-label={t("save")}
          >
            <Check aria-hidden />
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="max-w-48 text-right text-xs text-destructive">
          {t(`errors.${error}` as Parameters<typeof t>[0])}
        </p>
      )}
    </form>
  );
}
