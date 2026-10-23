"use client";

import { useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { completeOnboarding, type ProfileActionResult } from "@/lib/actions/profile";
import {
  CURRENCIES,
  onboardingSchema,
  type OnboardingData,
  type OnboardingInput,
} from "@/lib/validators";
import { zodResolver } from "@/lib/zod-resolver";
import { useValidationMessage } from "./use-validation-message";

const STEPS = ["currency", "monthStart", "balance"] as const;
const DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

export function OnboardingWizard({ defaultValues }: { defaultValues: OnboardingInput }) {
  const t = useTranslations("Onboarding");
  const tCommon = useTranslations("Common");
  const validationMessage = useValidationMessage();
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ProfileActionResult | null>(null);
  const {
    control,
    register,
    getValues,
    handleSubmit,
    formState: { errors },
  } = useForm<OnboardingInput, unknown, OnboardingData>({
    resolver: zodResolver(onboardingSchema),
    defaultValues,
  });

  const isLast = step === STEPS.length - 1;
  const [monthStartDay, primaryCurrency] = useWatch({
    control,
    name: ["monthStartDay", "primaryCurrency"],
  });

  // The action validates again on the server, so it takes the raw form values.
  const onSubmit = () =>
    startTransition(async () => {
      setResult(await completeOnboarding(getValues()));
    });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {t("step", { current: step + 1, total: STEPS.length })}
      </p>

      {result?.status === "error" && (
        <Alert variant="destructive">
          <AlertDescription>
            {t(`errors.${result.error}` as Parameters<typeof t>[0])}
          </AlertDescription>
        </Alert>
      )}

      {STEPS[step] === "currency" && (
        <FieldSet>
          <FieldLegend className="text-lg">{t("currency.title")}</FieldLegend>
          <FieldDescription>{t("currency.description")}</FieldDescription>
          <Controller
            control={control}
            name="primaryCurrency"
            render={({ field }) => (
              <RadioGroup value={field.value} onValueChange={field.onChange} className="gap-3">
                {CURRENCIES.map((currency) => (
                  <FieldLabel key={currency} htmlFor={`currency-${currency}`}>
                    <Field orientation="horizontal">
                      <FieldContent>
                        <FieldTitle>{t(`currency.${currency}`)}</FieldTitle>
                        <FieldDescription>{t(`currency.${currency}Hint`)}</FieldDescription>
                      </FieldContent>
                      <RadioGroupItem value={currency} id={`currency-${currency}`} />
                    </Field>
                  </FieldLabel>
                ))}
              </RadioGroup>
            )}
          />
          <FieldError errors={validationMessage(errors.primaryCurrency)} />
        </FieldSet>
      )}

      {STEPS[step] === "monthStart" && (
        <FieldSet>
          <FieldLegend className="text-lg">{t("monthStart.title")}</FieldLegend>
          <FieldDescription>{t("monthStart.description")}</FieldDescription>
          <Field data-invalid={!!errors.monthStartDay}>
            <FieldLabel htmlFor="monthStartDay">{t("monthStart.label")}</FieldLabel>
            <Controller
              control={control}
              name="monthStartDay"
              render={({ field }) => (
                <Select
                  value={String(field.value)}
                  onValueChange={(value) => field.onChange(Number(value))}
                >
                  <SelectTrigger id="monthStartDay" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map((day) => (
                      <SelectItem key={day} value={String(day)}>
                        {t("monthStart.day", { day })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldDescription>
              {Number(monthStartDay) === 1
                ? t("monthStart.exampleFirst")
                : t("monthStart.exampleOther", {
                    day: Number(monthStartDay),
                    previousDay: Number(monthStartDay) - 1,
                  })}
            </FieldDescription>
            <FieldError errors={validationMessage(errors.monthStartDay)} />
          </Field>
        </FieldSet>
      )}

      {STEPS[step] === "balance" && (
        <FieldSet>
          <FieldLegend className="text-lg">{t("balance.title")}</FieldLegend>
          <FieldDescription>{t("balance.description")}</FieldDescription>
          <Field data-invalid={!!errors.openingBalance}>
            <FieldLabel htmlFor="openingBalance">{t("balance.label")}</FieldLabel>
            <div className="flex items-center gap-2">
              <span className="text-lg text-muted-foreground">
                {primaryCurrency === "EUR" ? "€" : "R$"}
              </span>
              <Input
                id="openingBalance"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0,00"
                aria-invalid={!!errors.openingBalance}
                className="h-12 text-xl font-semibold tabular-nums md:text-xl"
                {...register("openingBalance")}
              />
            </div>
            <FieldDescription>{t("balance.hint")}</FieldDescription>
            <FieldError errors={validationMessage(errors.openingBalance)} />
          </Field>
        </FieldSet>
      )}

      <div className="flex gap-3">
        {step > 0 && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="flex-1"
            onClick={() => setStep(step - 1)}
          >
            {tCommon("back")}
          </Button>
        )}
        {/* Distinct keys: if React reused one <button> and flipped it to type="submit"
            inside the click, the browser would submit the form on "Continuar". */}
        {isLast ? (
          <Button key="finish" type="submit" size="lg" className="flex-1" disabled={pending}>
            {pending ? t("saving") : t("finish")}
          </Button>
        ) : (
          <Button
            key="continue"
            type="button"
            size="lg"
            className="flex-1"
            onClick={() => setStep(step + 1)}
          >
            {tCommon("continue")}
          </Button>
        )}
      </div>
    </form>
  );
}
