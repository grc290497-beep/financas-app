"use client";

import { useMemo, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Segmented } from "@/components/forms/segmented";
import { useValidationMessage } from "@/components/forms/use-validation-message";
import { CategoryChips } from "@/components/transactions/category-chips";
import {
  createRecurringItem,
  deleteRecurringItem,
  updateRecurringItem,
} from "@/lib/actions/recurring";
import { kindsForType, type Category, type CategoryKind } from "@/lib/categories";
import {
  CURRENCIES,
  FREQUENCIES,
  TRANSACTION_TYPES,
  recurringItemSchema,
  type Currency,
  type RecurringItemData,
  type RecurringItemInput,
  type TransactionType,
} from "@/lib/validators";
import { zodResolver } from "@/lib/zod-resolver";

export type RecurringFormInitial = RecurringItemInput & { id: string };

const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));

/** Fixed costs come first for recurring expenses (unlike quick add). */
const KIND_ORDER: CategoryKind[] = ["income", "fixed", "savings", "variable"];

function categoriesFor(categories: Category[], type: TransactionType) {
  const kinds = kindsForType(type);
  return categories
    .filter((c) => kinds.includes(c.kind))
    .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
}

export function RecurringForm({
  categories,
  primaryCurrency,
  today,
  initial,
  onDone,
}: {
  categories: Category[];
  primaryCurrency: Currency;
  today: string;
  initial?: RecurringFormInitial;
  onDone: () => void;
}) {
  const t = useTranslations("Fixed");
  const validationMessage = useValidationMessage();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<RecurringItemInput, unknown, RecurringItemData>({
    resolver: zodResolver(recurringItemSchema),
    defaultValues: initial ?? {
      type: "expense",
      name: "",
      amount: "",
      currency: primaryCurrency,
      categoryId: "",
      frequency: "monthly",
      dayOfMonth: String(Number(today.slice(8, 10))),
      // From the 1st of this month, so a bill set up mid-month still shows
      // this month's occurrence (to mark as paid) instead of skipping to next.
      startOn: `${today.slice(0, 8)}01`,
      endOn: "",
    },
  });

  const [type, currency, categoryId, frequency, dayOfMonth] = useWatch({
    control,
    name: ["type", "currency", "categoryId", "frequency", "dayOfMonth"],
  });
  const chips = useMemo(() => categoriesFor(categories, type), [categories, type]);

  const onSubmit = () =>
    startTransition(async () => {
      setError(null);
      const values = getValues();
      const result = initial
        ? await updateRecurringItem(initial.id, values)
        : await createRecurringItem(values);
      if (result.status === "error") {
        setError(result.error);
        return;
      }
      toast.success(t(initial ? "form.updated" : "form.saved"));
      onDone();
    });

  const onDelete = () =>
    startTransition(async () => {
      if (!initial) return;
      const result = await deleteRecurringItem(initial.id);
      setConfirmDelete(false);
      if (result.status === "error") {
        setError(result.error);
        return;
      }
      toast.success(t("form.deleted"));
      onDone();
    });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{t(`errors.${error}` as Parameters<typeof t>[0])}</AlertDescription>
        </Alert>
      )}

      <Segmented
        label={t("form.expense") + " / " + t("form.income")}
        options={TRANSACTION_TYPES.map((value) => ({ value, label: t(`form.${value}`) }))}
        value={type}
        onChange={(value) => {
          setValue("type", value);
          if (!categoriesFor(categories, value).some((c) => c.id === categoryId)) {
            setValue("categoryId", "");
          }
        }}
      />

      <FieldGroup className="gap-5">
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="name">{t("form.name")}</FieldLabel>
          <Input
            id="name"
            placeholder={t("form.namePlaceholder")}
            maxLength={60}
            autoFocus={!initial}
            aria-invalid={!!errors.name}
            {...register("name")}
          />
          <FieldError errors={validationMessage(errors.name)} />
        </Field>

        <Field data-invalid={!!errors.amount}>
          <FieldLabel htmlFor="recurring-amount">{t("form.amount")}</FieldLabel>
          <div className="flex gap-2">
            <Input
              id="recurring-amount"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0,00"
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
          <FieldError errors={validationMessage(errors.amount)} />
        </Field>

        <FieldSet>
          <FieldLegend variant="label">{t("form.category")}</FieldLegend>
          <CategoryChips
            label={t("form.category")}
            categories={chips}
            value={categoryId}
            onChange={(id) => setValue("categoryId", id, { shouldValidate: true })}
          />
          <FieldError errors={validationMessage(errors.categoryId)} />
        </FieldSet>

        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor="frequency">{t("form.frequency")}</FieldLabel>
            <Select
              value={frequency}
              onValueChange={(value) =>
                setValue("frequency", value as RecurringItemInput["frequency"])
              }
            >
              <SelectTrigger id="frequency" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCIES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`form.frequencies.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {frequency === "monthly" && (
            <Field data-invalid={!!errors.dayOfMonth}>
              <FieldLabel htmlFor="dayOfMonth">{t("form.dayOfMonth")}</FieldLabel>
              <Select
                value={dayOfMonth ?? ""}
                onValueChange={(value) => setValue("dayOfMonth", value, { shouldValidate: true })}
              >
                <SelectTrigger id="dayOfMonth" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map((day) => (
                    <SelectItem key={day} value={day}>
                      {t("form.day", { day })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError errors={validationMessage(errors.dayOfMonth)} />
            </Field>
          )}
        </div>
        {frequency === "monthly" && <FieldDescription>{t("form.dayHint")}</FieldDescription>}

        <div className="grid grid-cols-2 gap-3">
          <Field data-invalid={!!errors.startOn}>
            <FieldLabel htmlFor="startOn">{t("form.startOn")}</FieldLabel>
            <Input id="startOn" type="date" {...register("startOn")} />
            {frequency !== "monthly" && (
              <FieldDescription>
                {frequency === "weekly" ? t("form.startOnHintWeekly") : t("form.startOnHintYearly")}
              </FieldDescription>
            )}
            <FieldError errors={validationMessage(errors.startOn)} />
          </Field>
          <Field data-invalid={!!errors.endOn}>
            <FieldLabel htmlFor="endOn">{t("form.endOn")}</FieldLabel>
            <Input id="endOn" type="date" aria-describedby="endOn-hint" {...register("endOn")} />
            <FieldDescription id="endOn-hint">{t("form.endOnPlaceholder")}</FieldDescription>
            <FieldError errors={validationMessage(errors.endOn)} />
          </Field>
        </div>
      </FieldGroup>

      <div className="flex gap-3">
        {initial && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="text-destructive"
            disabled={pending}
            onClick={() => setConfirmDelete(true)}
          >
            {t("form.delete")}
          </Button>
        )}
        <Button type="submit" size="lg" className="flex-1" disabled={pending}>
          {pending ? t("form.saving") : t("form.save")}
        </Button>
      </div>

      {initial && (
        <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <DialogContent showCloseButton={false}>
            <DialogHeader>
              <DialogTitle>{t("delete.title")}</DialogTitle>
              <DialogDescription>{t("delete.description")}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">{t("delete.cancel")}</Button>
              </DialogClose>
              <Button variant="destructive" disabled={pending} onClick={onDelete}>
                {t("delete.confirm")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </form>
  );
}
