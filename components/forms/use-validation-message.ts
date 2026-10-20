"use client";

import { useTranslations } from "next-intl";

/** Turns a zod message key from lib/validators.ts into translated text. */
export function useValidationMessage() {
  const t = useTranslations("Validation");
  return (error: { message?: string } | undefined) =>
    error?.message ? [{ message: t(error.message as Parameters<typeof t>[0]) }] : undefined;
}
