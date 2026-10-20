"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setCategoryBudget } from "@/lib/actions/budget";
import { formatAmountInput } from "@/lib/money";

/** Inline editor for one category's monthly limit. */
export function BudgetLimitInput({
  categoryId,
  name,
  budgetCents,
}: {
  categoryId: string;
  name: string;
  budgetCents: number | null;
}) {
  const t = useTranslations("Budget");
  const initial = budgetCents ? formatAmountInput(budgetCents) : "";
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      setError(null);
      const result = await setCategoryBudget({ categoryId, amount: value });
      if (result.status === "error") {
        setError(result.error);
        return;
      }
      toast.success(value.trim() ? t("saved") : t("removed"));
    });

  return (
    <form
      className="flex flex-col gap-1"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <div className="flex gap-2">
        <Input
          inputMode="decimal"
          autoComplete="off"
          placeholder={t("noLimit")}
          aria-label={t("limit", { name })}
          aria-invalid={!!error}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="h-9 flex-1 tabular-nums"
        />
        <Button
          type="submit"
          size="sm"
          variant="outline"
          className="h-9"
          disabled={pending || value === initial}
        >
          {t("save")}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t(`errors.${error}` as Parameters<typeof t>[0])}
        </p>
      )}
    </form>
  );
}
