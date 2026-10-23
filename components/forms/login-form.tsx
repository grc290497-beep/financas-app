"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { MailCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  requestPasswordReset,
  sendMagicLink,
  signIn,
  type AuthActionResult,
} from "@/lib/actions/auth";
import {
  magicLinkSchema,
  signInSchema,
  type MagicLinkInput,
  type SignInInput,
} from "@/lib/validators";
import { zodResolver } from "@/lib/zod-resolver";
import { useValidationMessage } from "./use-validation-message";

export function LoginForm() {
  const t = useTranslations("Auth");
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? undefined;
  const linkError = searchParams.get("error") === "link";
  const [mode, setMode] = useState<"password" | "magic" | "reset">("password");

  return (
    <div className="flex flex-col gap-6">
      {linkError && (
        <Alert variant="destructive">
          <AlertDescription>{t("errors.link")}</AlertDescription>
        </Alert>
      )}
      {mode === "password" ? (
        <PasswordForm next={next} onForgot={() => setMode("reset")} />
      ) : (
        <MagicLinkForm key={mode} next={next} reset={mode === "reset"} />
      )}
      <Button
        type="button"
        variant="link"
        className="h-auto p-0"
        onClick={() => setMode(mode === "password" ? "magic" : "password")}
      >
        {mode === "password" ? t("login.useMagicLink") : t("login.usePassword")}
      </Button>
    </div>
  );
}

function PasswordForm({ next, onForgot }: { next?: string; onForgot: () => void }) {
  const t = useTranslations("Auth");
  const validationMessage = useValidationMessage();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<AuthActionResult | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "", next },
  });

  const onSubmit = (data: SignInInput) =>
    startTransition(async () => {
      setResult(await signIn({ ...data, next }));
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
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="email">{t("login.email")}</FieldLabel>
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
          <FieldLabel htmlFor="password">{t("login.password")}</FieldLabel>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            {...register("password")}
          />
          <FieldError errors={validationMessage(errors.password)} />
          <button
            type="button"
            onClick={onForgot}
            className="self-end text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {t("login.forgot")}
          </button>
        </Field>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? t("login.submitting") : t("login.submit")}
        </Button>
      </FieldGroup>
    </form>
  );
}

/** The e-mail form behind "link de acesso" and, with `reset`, "Esqueci minha senha". */
function MagicLinkForm({ next, reset }: { next?: string; reset?: boolean }) {
  const t = useTranslations("Auth");
  const validationMessage = useValidationMessage();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<AuthActionResult | null>(null);
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<MagicLinkInput>({
    resolver: zodResolver(magicLinkSchema),
    defaultValues: { email: "", next },
  });

  if (result?.status === "link-sent") {
    return (
      <Alert>
        <MailCheck aria-hidden />
        <AlertTitle>{t("login.linkSentTitle")}</AlertTitle>
        <AlertDescription>
          {t(reset ? "login.resetSent" : "login.linkSent", { email: getValues("email") })}
        </AlertDescription>
      </Alert>
    );
  }

  const onSubmit = (data: MagicLinkInput) =>
    startTransition(async () => {
      setResult(reset ? await requestPasswordReset(data) : await sendMagicLink({ ...data, next }));
    });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        {reset && <p className="text-sm text-muted-foreground">{t("login.resetIntro")}</p>}
        {result?.status === "error" && (
          <Alert variant="destructive">
            <AlertDescription>
              {t(`errors.${result.error}` as Parameters<typeof t>[0])}
            </AlertDescription>
          </Alert>
        )}
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="magic-email">{t("login.email")}</FieldLabel>
          <Input
            id="magic-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            aria-invalid={!!errors.email}
            {...register("email")}
          />
          <FieldError errors={validationMessage(errors.email)} />
        </Field>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? t("login.sendingLink") : t(reset ? "login.sendReset" : "login.sendLink")}
        </Button>
      </FieldGroup>
    </form>
  );
}
