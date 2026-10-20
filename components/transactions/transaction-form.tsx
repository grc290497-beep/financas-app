"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";
import { format, parseISO } from "date-fns";
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
import { useValidationMessage } from "@/components/forms/use-validation-message";
import {
  createTransaction,
  deleteTransaction,
  getFxPreview,
  updateTransaction,
  type FxPreviewResult,
} from "@/lib/actions/transactions";
import { sortForQuickAdd, type Category } from "@/lib/categories";
import { convertCents, formatMoney, parseAmount, parseRate } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  CURRENCIES,
  TRANSACTION_TYPES,
  transactionSchema,
  type Currency,
  type TransactionData,
  type TransactionInput,
} from "@/lib/validators";
import { zodResolver } from "@/lib/zod-resolver";
import { CategoryIcon } from "./category-icon";

export type TransactionFormInitial = {
  id: string;
  type: TransactionInput["type"];
  amount: string;
  currency: Currency;
  categoryId: string;
  occurredOn: string;
  description: string;
  /** The rate frozen when the transaction was saved. */
  fxRate: string;
};

type Props = {
  categories: Category[];
  usage: Record<string, number>;
  primaryCurrency: Currency;
  today: string;
  initial?: TransactionFormInitial;
  onDone: () => void;
};

export function TransactionForm({
  categories,
  usage,
  primaryCurrency,
  today,
  initial,
  onDone,
}: Props) {
  const t = useTranslations("Transactions");
  const validationMessage = useValidationMessage();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [manualRateOpen, setManualRateOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<TransactionInput, unknown, TransactionData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: initial
      ? { ...initial, fxRate: "" }
      : {
          type: "expense",
          amount: "",
          currency: primaryCurrency,
          categoryId: "",
          occurredOn: today,
          description: "",
          fxRate: "",
        },
  });

  const [type, currency, occurredOn, amount, categoryId, fxRateInput] = useWatch({
    control,
    name: ["type", "currency", "occurredOn", "amount", "categoryId", "fxRate"],
  });

  const chips = useMemo(() => sortForQuickAdd(categories, type, usage), [categories, type, usage]);
  const preview = useFxPreview(currency, occurredOn, primaryCurrency, initial);
  const showManualRate = manualRateOpen || preview?.status === "error";

  const converted = (() => {
    if (currency === primaryCurrency) return null;
    const cents = parseAmount(amount ?? "");
    const rate =
      showManualRate && fxRateInput
        ? safeRate(fxRateInput)
        : preview?.status === "ok"
          ? safeRate(preview.rate)
          : null;
    if (!cents || !rate) return null;
    return formatMoney(convertCents(cents, rate), primaryCurrency);
  })();

  const onSubmit = () =>
    startTransition(async () => {
      setError(null);
      const values = getValues();
      const payload = { ...values, fxRate: showManualRate ? values.fxRate : "" };
      const result = initial
        ? await updateTransaction(initial.id, payload)
        : await createTransaction(payload);
      if (result.status === "error") {
        setError(result.error);
        if (result.error === "fxUnavailable") setManualRateOpen(true);
        return;
      }
      toast.success(t(initial ? "form.updated" : "form.saved"));
      onDone();
    });

  const onDelete = () =>
    startTransition(async () => {
      if (!initial) return;
      const result = await deleteTransaction(initial.id);
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
          if (!sortForQuickAdd(categories, value, usage).some((c) => c.id === categoryId)) {
            setValue("categoryId", "");
          }
        }}
      />

      <FieldGroup className="gap-5">
        <Field data-invalid={!!errors.amount}>
          <FieldLabel htmlFor="amount">{t("form.amount")}</FieldLabel>
          <div className="flex gap-2">
            <Input
              id="amount"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0,00"
              autoFocus={!initial}
              aria-invalid={!!errors.amount}
              className="h-12 flex-1 text-2xl font-semibold tabular-nums md:text-2xl"
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
          {currency !== primaryCurrency && (
            <FxLine
              preview={preview}
              converted={converted}
              manual={showManualRate}
              onToggleManual={() => {
                setManualRateOpen(!manualRateOpen);
                setValue("fxRate", "");
              }}
            />
          )}
        </Field>

        {showManualRate && currency !== primaryCurrency && (
          <Field data-invalid={!!errors.fxRate}>
            <FieldLabel htmlFor="fxRate">
              {t("form.manualRate", { from: currency, to: primaryCurrency })}
            </FieldLabel>
            <Input
              id="fxRate"
              inputMode="decimal"
              autoComplete="off"
              placeholder={preview?.status === "ok" ? preview.rate.replace(".", ",") : "0,000000"}
              aria-invalid={!!errors.fxRate}
              {...register("fxRate")}
            />
            <FieldDescription>{t("form.manualRateHint")}</FieldDescription>
            <FieldError errors={validationMessage(errors.fxRate)} />
          </Field>
        )}

        <FieldSet>
          <FieldLegend variant="label">{t("form.category")}</FieldLegend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("form.category")}>
            {chips.map((category) => {
              const selected = category.id === categoryId;
              return (
                <button
                  key={category.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setValue("categoryId", category.id, { shouldValidate: true })}
                  className={cn(
                    "flex h-10 items-center gap-2 rounded-full border pr-3 pl-1 text-sm transition-colors",
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-background hover:bg-muted",
                  )}
                >
                  <CategoryIcon icon={category.icon} color={category.color} className="size-8" />
                  {category.name}
                </button>
              );
            })}
          </div>
          <FieldError errors={validationMessage(errors.categoryId)} />
        </FieldSet>

        <div className="grid grid-cols-2 gap-3">
          <Field data-invalid={!!errors.occurredOn}>
            <FieldLabel htmlFor="occurredOn">{t("form.date")}</FieldLabel>
            <Input id="occurredOn" type="date" {...register("occurredOn")} />
            <FieldError errors={validationMessage(errors.occurredOn)} />
          </Field>
          <Field data-invalid={!!errors.description}>
            <FieldLabel htmlFor="description">{t("form.description")}</FieldLabel>
            <Input
              id="description"
              placeholder={t("form.descriptionPlaceholder")}
              maxLength={140}
              {...register("description")}
            />
            <FieldError errors={validationMessage(errors.description)} />
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

function FxLine({
  preview,
  converted,
  manual,
  onToggleManual,
}: {
  preview: FxPreviewState | null;
  converted: string | null;
  manual: boolean;
  onToggleManual: () => void;
}) {
  const t = useTranslations("Transactions.form");

  let text: string;
  if (manual) {
    text = converted ? `≈ ${converted}` : "";
  } else if (!preview || preview.status === "loading") {
    text = t("rateLoading");
  } else if (preview.status === "error") {
    text = t("rateUnavailable");
  } else {
    const values = {
      amount: converted ?? "—",
      rate: preview.rate.replace(".", ","),
      date: format(parseISO(preview.date), "dd/MM"),
    };
    text = preview.source === "fallback" ? t("convertedFallback", values) : t("converted", values);
  }

  return (
    <FieldDescription className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <span aria-live="polite">{text}</span>
      {preview?.status !== "error" && (
        <button
          type="button"
          className="font-medium underline-offset-4 hover:underline"
          onClick={onToggleManual}
        >
          {manual ? t("useAutoRate") : t("adjustRate")}
        </button>
      )}
    </FieldDescription>
  );
}

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("inline-flex h-10 shrink-0 rounded-lg bg-muted p-1", className)}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            "flex-1 rounded-md px-3 text-sm font-medium transition-colors",
            option.value === value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

type FxPreviewState = FxPreviewResult | { status: "loading" };

/**
 * Rate preview for a currency other than the primary one. While editing, the
 * frozen rate is shown as long as currency and date are unchanged.
 */
function useFxPreview(
  currency: Currency,
  date: string,
  primaryCurrency: Currency,
  initial?: TransactionFormInitial,
): FxPreviewState | null {
  const [results, setResults] = useState<Record<string, FxPreviewResult>>({});
  const frozen = initial && initial.currency === currency && initial.occurredOn === date;
  const key =
    currency !== primaryCurrency && !frozen && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? `${currency}|${date}`
      : null;

  useEffect(() => {
    if (!key || results[key]) return;
    let cancelled = false;
    getFxPreview({ currency, date })
      .catch((): FxPreviewResult => ({ status: "error", error: "fxUnavailable" }))
      .then((result) => {
        if (!cancelled) setResults((previous) => ({ ...previous, [key]: result }));
      });
    return () => {
      cancelled = true;
    };
  }, [key, results, currency, date]);

  if (currency === primaryCurrency) return null;
  if (frozen && initial) {
    return { status: "ok", rate: initial.fxRate, date: initial.occurredOn, source: "cache" };
  }
  return key ? (results[key] ?? { status: "loading" }) : null;
}

function safeRate(value: string): bigint | null {
  try {
    return parseRate(value);
  } catch {
    return null;
  }
}
