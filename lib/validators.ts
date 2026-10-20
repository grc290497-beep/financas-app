import { z } from "zod";

// Shared by forms (client) and Server Actions (server).
// Error messages are keys under "Validation" in messages/pt-BR.json.

export const CURRENCIES = ["EUR", "BRL"] as const;
export type Currency = (typeof CURRENCIES)[number];

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "emailInvalid" }));

export const signUpSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, { error: "nameRequired" })
    .max(80, { error: "nameTooLong" }),
  email,
  // Supabase/bcrypt ignores bytes beyond 72.
  password: z.string().min(8, { error: "passwordTooShort" }).max(72, { error: "passwordTooLong" }),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email,
  password: z.string().min(1, { error: "passwordRequired" }),
  next: z.string().optional(),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const magicLinkSchema = z.object({
  email,
  next: z.string().optional(),
});
export type MagicLinkInput = z.infer<typeof magicLinkSchema>;

export const onboardingSchema = z.object({
  primaryCurrency: z.enum(CURRENCIES, { error: "currencyRequired" }),
  monthStartDay: z.coerce
    .number({ error: "monthStartDayInvalid" })
    .int({ error: "monthStartDayInvalid" })
    .min(1, { error: "monthStartDayInvalid" })
    .max(28, { error: "monthStartDayInvalid" }),
});
export type OnboardingInput = z.input<typeof onboardingSchema>;
export type OnboardingData = z.output<typeof onboardingSchema>;
