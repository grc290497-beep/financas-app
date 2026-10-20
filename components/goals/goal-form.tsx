"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Segmented } from "@/components/forms/segmented";
import { useValidationMessage } from "@/components/forms/use-validation-message";
import { CategoryIcon } from "@/components/transactions/category-icon";
import { createGoal, updateGoal } from "@/lib/actions/goals";
import { cn } from "@/lib/utils";
import {
  CURRENCIES,
  GOAL_COLORS,
  GOAL_ICONS,
  goalSchema,
  type Currency,
  type GoalData,
  type GoalInput,
} from "@/lib/validators";
import { zodResolver } from "@/lib/zod-resolver";

/** A button that opens the goal form in a sheet: create without `initial`, edit with it. */
export function GoalSheet({
  primaryCurrency,
  initial,
  className,
  children,
}: {
  primaryCurrency: Currency;
  initial?: GoalInput & { id: string };
  className?: string;
  children: ReactNode;
}) {
  const t = useTranslations("Goals");
  const [open, setOpen] = useState(false);
  const [defaultDeadline, setDefaultDeadline] = useState("");

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => {
          // A year from today: the device's date, taken on click.
          const nextYear = new Date();
          nextYear.setFullYear(nextYear.getFullYear() + 1);
          setDefaultDeadline(format(nextYear, "yyyy-MM-dd"));
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
              <GoalForm
                initial={
                  initial ?? {
                    name: "",
                    target: "",
                    currency: primaryCurrency,
                    initial: "",
                    deadline: defaultDeadline,
                    icon: GOAL_ICONS[0],
                    color: GOAL_COLORS[0],
                  }
                }
                goalId={initial?.id}
                onDone={() => setOpen(false)}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function GoalForm({
  initial,
  goalId,
  onDone,
}: {
  initial: GoalInput;
  goalId?: string;
  onDone: () => void;
}) {
  const t = useTranslations("Goals");
  const router = useRouter();
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
  } = useForm<GoalInput, unknown, GoalData>({
    resolver: zodResolver(goalSchema),
    defaultValues: initial,
  });
  const [currency, icon, color] = useWatch({ control, name: ["currency", "icon", "color"] });

  const onSubmit = () =>
    startTransition(async () => {
      setError(null);
      const result = goalId ? await updateGoal(goalId, getValues()) : await createGoal(getValues());
      if (result.status === "error") {
        setError(result.error);
        return;
      }
      toast.success(t(goalId ? "form.updated" : "form.saved"));
      onDone();
      if (!goalId && result.id) router.push(`/app/goals/${result.id}`);
    });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{t(`errors.${error}` as Parameters<typeof t>[0])}</AlertDescription>
        </Alert>
      )}

      <FieldGroup className="gap-5">
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="goal-name">{t("form.name")}</FieldLabel>
          <Input
            id="goal-name"
            placeholder={t("form.namePlaceholder")}
            maxLength={60}
            autoFocus={!goalId}
            aria-invalid={!!errors.name}
            {...register("name")}
          />
          <FieldError errors={validationMessage(errors.name)} />
        </Field>

        <Field data-invalid={!!errors.target}>
          <FieldLabel htmlFor="goal-target">{t("form.target")}</FieldLabel>
          <div className="flex gap-2">
            <Input
              id="goal-target"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0,00"
              aria-invalid={!!errors.target}
              className="h-12 flex-1 text-xl font-semibold tabular-nums md:text-xl"
              {...register("target")}
            />
            {goalId ? (
              <span className="flex h-12 items-center rounded-lg bg-muted px-3 text-sm font-medium">
                {currency}
              </span>
            ) : (
              <Segmented
                label={t("form.currency")}
                options={CURRENCIES.map((value) => ({ value, label: value }))}
                value={currency}
                onChange={(value) => setValue("currency", value)}
                className="h-12"
              />
            )}
          </div>
          {goalId && <FieldDescription>{t("form.currencyLocked")}</FieldDescription>}
          <FieldError errors={validationMessage(errors.target)} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field data-invalid={!!errors.initial}>
            <FieldLabel htmlFor="goal-initial">{t("form.initial")}</FieldLabel>
            <Input
              id="goal-initial"
              inputMode="decimal"
              autoComplete="off"
              placeholder={t("form.initialPlaceholder")}
              {...register("initial")}
            />
            <FieldError errors={validationMessage(errors.initial)} />
          </Field>
          <Field data-invalid={!!errors.deadline}>
            <FieldLabel htmlFor="goal-deadline">{t("form.deadline")}</FieldLabel>
            <Input id="goal-deadline" type="date" {...register("deadline")} />
            <FieldError errors={validationMessage(errors.deadline)} />
          </Field>
        </div>

        <FieldSet>
          <FieldLegend variant="label">{t("form.icon")}</FieldLegend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("form.icon")}>
            {GOAL_ICONS.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={icon === value}
                aria-label={t(`form.icons.${value}`)}
                onClick={() => setValue("icon", value)}
                className={cn(
                  "rounded-full p-0.5 ring-offset-2 ring-offset-background",
                  icon === value && "ring-2 ring-primary",
                )}
              >
                <CategoryIcon icon={value} color={color} />
              </button>
            ))}
          </div>
        </FieldSet>

        <FieldSet>
          <FieldLegend variant="label">{t("form.color")}</FieldLegend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("form.color")}>
            {GOAL_COLORS.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={color === value}
                aria-label={t(`form.colors.${value}`)}
                onClick={() => setValue("color", value)}
                className={cn(
                  "size-8 rounded-full ring-offset-2 ring-offset-background",
                  color === value && "ring-2 ring-primary",
                )}
                style={{ backgroundColor: value }}
              />
            ))}
          </div>
        </FieldSet>
      </FieldGroup>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? t("form.saving") : t("form.save")}
      </Button>
    </form>
  );
}
