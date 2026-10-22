"use client";

import { useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/forms/segmented";
import { useValidationMessage } from "@/components/forms/use-validation-message";
import { updateBalanceSettings } from "@/lib/actions/profile";
import {
  balanceSettingsSchema,
  type BalanceSettingsData,
  type BalanceSettingsInput,
} from "@/lib/validators";
import { zodResolver } from "@/lib/zod-resolver";

/** Whether "Disponível agora" carries earlier months' leftover, from an opening balance. */
export function BalanceForm({
  defaultValues,
  symbol,
}: {
  defaultValues: BalanceSettingsInput;
  symbol: string;
}) {
  const t = useTranslations("Settings.balance");
  const validationMessage = useValidationMessage();
  const [pending, startTransition] = useTransition();
  const {
    control,
    register,
    handleSubmit,
    setValue,
    getValues,
    reset,
    formState: { errors, isDirty },
  } = useForm<BalanceSettingsInput, unknown, BalanceSettingsData>({
    resolver: zodResolver(balanceSettingsSchema),
    defaultValues,
  });
  const carryOver = useWatch({ control, name: "carryOver" });

  const onSubmit = () =>
    startTransition(async () => {
      const values = getValues();
      const result = await updateBalanceSettings(values);
      if (result.status === "error") {
        toast.error(t(`errors.${result.error}` as Parameters<typeof t>[0]));
        return;
      }
      reset(values);
      toast.success(t("saved"));
    });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="surface flex flex-col gap-5 p-4">
      <Field>
        <Segmented
          label={t("mode")}
          options={[
            { value: "month", label: t("monthOnly") },
            { value: "carry", label: t("carry") },
          ]}
          value={carryOver ? "carry" : "month"}
          onChange={(value) => setValue("carryOver", value === "carry", { shouldDirty: true })}
          className="w-full"
        />
        <FieldDescription>{carryOver ? t("carryHint") : t("monthOnlyHint")}</FieldDescription>
      </Field>

      {carryOver && (
        <Field data-invalid={!!errors.openingBalance}>
          <FieldLabel htmlFor="openingBalance">{t("opening")}</FieldLabel>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{symbol}</span>
            <Input
              id="openingBalance"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0,00"
              aria-invalid={!!errors.openingBalance}
              className="tabular-nums"
              {...register("openingBalance")}
            />
          </div>
          <FieldDescription>{t("openingHint")}</FieldDescription>
          <FieldError errors={validationMessage(errors.openingBalance)} />
        </Field>
      )}

      <Button type="submit" className="self-start" disabled={pending || !isDirty}>
        {pending ? t("saving") : t("save")}
      </Button>
    </form>
  );
}
