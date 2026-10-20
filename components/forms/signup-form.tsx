"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { MailCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { signUp, type AuthActionResult } from "@/lib/actions/auth";
import { signUpSchema, type SignUpInput } from "@/lib/validators";
import { zodResolver } from "@/lib/zod-resolver";
import { useValidationMessage } from "./use-validation-message";

export function SignupForm() {
  const t = useTranslations("Auth");
  const validationMessage = useValidationMessage();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<AuthActionResult | null>(null);
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { displayName: "", email: "", password: "" },
  });

  if (result?.status === "check-email") {
    return (
      <Alert>
        <MailCheck aria-hidden />
        <AlertTitle>{t("signup.checkEmailTitle")}</AlertTitle>
        <AlertDescription>{t("signup.checkEmail", { email: getValues("email") })}</AlertDescription>
      </Alert>
    );
  }

  const onSubmit = (data: SignUpInput) =>
    startTransition(async () => {
      setResult(await signUp(data));
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
        <Field data-invalid={!!errors.displayName}>
          <FieldLabel htmlFor="displayName">{t("signup.name")}</FieldLabel>
          <Input
            id="displayName"
            autoComplete="given-name"
            aria-invalid={!!errors.displayName}
            {...register("displayName")}
          />
          <FieldError errors={validationMessage(errors.displayName)} />
        </Field>
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="email">{t("signup.email")}</FieldLabel>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            aria-invalid={!!errors.email}
            {...register("email")}
          />
          <FieldError errors={validationMessage(errors.email)} />
        </Field>
        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="password">{t("signup.password")}</FieldLabel>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            aria-describedby="password-hint"
            {...register("password")}
          />
          <FieldDescription id="password-hint">{t("signup.passwordHint")}</FieldDescription>
          <FieldError errors={validationMessage(errors.password)} />
        </Field>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? t("signup.submitting") : t("signup.submit")}
        </Button>
      </FieldGroup>
    </form>
  );
}
