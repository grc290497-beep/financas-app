"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { markAsPaid } from "@/lib/actions/recurring";
import { formatAmountInput, parseAmount } from "@/lib/money";
import type { Currency, TransactionType } from "@/lib/validators";

/** "Pagar" / "Recebi": confirms a planned transaction, adjusting the amount if needed. */
export function PayButton({
  id,
  type,
  name,
  dueLabel,
  amountCents,
  currency,
}: {
  id: string;
  type: TransactionType;
  name: string;
  dueLabel: string;
  amountCents: number;
  currency: Currency;
}) {
  const t = useTranslations("Fixed");
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(formatAmountInput(amountCents));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const income = type === "income";
  const valid = (parseAmount(amount) ?? 0) > 0;

  const confirm = () =>
    startTransition(async () => {
      setError(null);
      const result = await markAsPaid(id, { amount });
      if (result.status === "error") {
        setError(result.error);
        return;
      }
      setOpen(false);
      toast.success(t(income ? "pay.doneIncome" : "pay.done"));
    });

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setAmount(formatAmountInput(amountCents));
          setError(null);
          setOpen(true);
        }}
      >
        {income ? t("markReceived") : t("markPaid")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{income ? t("pay.titleIncome") : t("pay.title")}</DialogTitle>
            <DialogDescription>{t("pay.description", { name, date: dueLabel })}</DialogDescription>
          </DialogHeader>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{t(`errors.${error}` as Parameters<typeof t>[0])}</AlertDescription>
            </Alert>
          )}
          <Field>
            <FieldLabel htmlFor={`pay-${id}`}>
              {income ? t("pay.amountIncome") : t("pay.amount")} ({currency})
            </FieldLabel>
            <Input
              id={`pay-${id}`}
              inputMode="decimal"
              autoComplete="off"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              aria-invalid={!valid}
              className="h-12 text-xl font-semibold tabular-nums md:text-xl"
            />
          </Field>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t("pay.cancel")}</Button>
            </DialogClose>
            <Button disabled={pending || !valid} onClick={confirm}>
              {pending ? t("pay.saving") : t("pay.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
