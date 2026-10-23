"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { updatePassword, type AuthActionResult } from "@/lib/actions/auth";
import { newPasswordSchema, type NewPasswordInput } from "@/lib/validators";
import { zodResolver } from "@/lib/zod-resolver";
import { useValidationMessage } from "./use-validation-message";

/** New password twice; on success the action sends the user into the app. */
export function NewPasswordForm() {
  const t = useTranslations("Auth");
  const validationMessage = useValidationMessage();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<AuthActionResult | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NewPasswordInput>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: "", confirm: "" },
  });

  const onSubmit = (data: NewPasswordInput) =>
    startTransition(async () => {
      setResult(await updatePassword(data));
    });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        {result?.status === "error" && (
          <Alert variant="destructive">
            <AlertDescription>
              {t(`errors.${result.error}` as Parameters<typeof t>[0])}
            </AlertDescription>
          </Alert>
        )}
        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="new-password">{t("reset.password")}</FieldLabel>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            autoFocus
            aria-invalid={!!errors.password}
            {...register("password")}
          />
          <FieldDescription>{t("signup.passwordHint")}</FieldDescription>
          <FieldError errors={validationMessage(errors.password)} />
        </Field>
        <Field data-invalid={!!errors.confirm}>
          <FieldLabel htmlFor="confirm-password">{t("reset.confirm")}</FieldLabel>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.confirm}
            {...register("confirm")}
          />
          <FieldError errors={validationMessage(errors.confirm)} />
        </Field>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? t("reset.submitting") : t("reset.submit")}
        </Button>
      </FieldGroup>
    </form>
  );
}
