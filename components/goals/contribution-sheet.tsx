"use client";

import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Segmented } from "@/components/forms/segmented";
import { useValidationMessage } from "@/components/forms/use-validation-message";
import { addContribution } from "@/lib/actions/goals";
import {
  CURRENCIES,
  contributionSchema,
  type ContributionData,
  type ContributionInput,
  type Currency,
} from "@/lib/validators";
import { zodResolver } from "@/lib/zod-resolver";

type Kind = ContributionInput["kind"];

/** "Aportar" and "Retirar" buttons, each opening the contribution form. */
export function ContributionButtons({
  goalId,
  goalCurrency,
}: {
  goalId: string;
  goalCurrency: Currency;
}) {
  const t = useTranslations("Goals");
  const [kind, setKind] = useState<Kind | null>(null);
  const [today, setToday] = useState("");

  const open = (next: Kind) => {
    setToday(format(new Date(), "yyyy-MM-dd"));
    setKind(next);
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Button size="lg" onClick={() => open("deposit")}>
          <Plus aria-hidden />
          {t("deposit")}
        </Button>
        <Button size="lg" variant="outline" onClick={() => open("withdrawal")}>
          <Minus aria-hidden />
          {t("withdraw")}
        </Button>
      </div>
      <Sheet open={kind !== null} onOpenChange={(isOpen) => !isOpen && setKind(null)}>
        <SheetContent
          side="bottom"
          className="mx-auto max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl pb-[calc(1rem+env(safe-area-inset-bottom))]"
        >
          <SheetHeader className="pb-0">
            <SheetTitle>
              {kind === "withdrawal"
                ? t("contribution.withdrawTitle")
                : t("contribution.depositTitle")}
            </SheetTitle>
          </SheetHeader>
          <div className="px-4">
            {kind && (
              <ContributionForm
                key={kind}
                goalId={goalId}
                goalCurrency={goalCurrency}
                kind={kind}
                today={today}
                onDone={() => setKind(null)}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function ContributionForm({
  goalId,
  goalCurrency,
  kind,
  today,
  onDone,
}: {
  goalId: string;
  goalCurrency: Currency;
  kind: Kind;
  today: string;
  onDone: () => void;
}) {
  const t = useTranslations("Goals");
  const validationMessage = useValidationMessage();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<ContributionInput, unknown, ContributionData>({
    resolver: zodResolver(contributionSchema),
    defaultValues: { kind, amount: "", currency: goalCurrency, contributedOn: today, note: "" },
  });
  const currency = useWatch({ control, name: "currency" });

  const onSubmit = () =>
    startTransition(async () => {
      setError(null);
      const result = await addContribution(goalId, getValues());
      if (result.status === "error") {
        setError(result.error);
        return;
      }
      toast.success(kind === "withdrawal" ? t("contribution.withdrawn") : t("contribution.saved"));
      onDone();
    });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{t(`errors.${error}` as Parameters<typeof t>[0])}</AlertDescription>
        </Alert>
      )}
      <FieldGroup className="gap-5">
        <Field data-invalid={!!errors.amount}>
          <FieldLabel htmlFor="contribution-amount">{t("contribution.amount")}</FieldLabel>
          <div className="flex gap-2">
            <Input
              id="contribution-amount"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0,00"
              autoFocus
              aria-invalid={!!errors.amount}
              className="h-12 flex-1 text-xl font-semibold tabular-nums md:text-xl"
              {...register("amount")}
            />
            <Segmented
              label={t("form.currency")}
              options={CURRENCIES.map((value) => ({ value, label: value }))}
              value={currency}
              onChange={(value) => setValue("currency", value)}
              className="h-12"
            />
          </div>
          {currency !== goalCurrency && (
            <FieldDescription>
              {t("contribution.converted", { currency: goalCurrency })}
            </FieldDescription>
          )}
          <FieldError errors={validationMessage(errors.amount)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field data-invalid={!!errors.contributedOn}>
            <FieldLabel htmlFor="contribution-date">{t("contribution.date")}</FieldLabel>
            <Input id="contribution-date" type="date" {...register("contributedOn")} />
            <FieldError errors={validationMessage(errors.contributedOn)} />
          </Field>
          <Field data-invalid={!!errors.note}>
            <FieldLabel htmlFor="contribution-note">{t("contribution.note")}</FieldLabel>
            <Input
              id="contribution-note"
              placeholder={t("contribution.notePlaceholder")}
              maxLength={140}
              {...register("note")}
            />
            <FieldError errors={validationMessage(errors.note)} />
          </Field>
        </div>
      </FieldGroup>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? t("contribution.saving") : t("contribution.save")}
      </Button>
    </form>
  );
}
