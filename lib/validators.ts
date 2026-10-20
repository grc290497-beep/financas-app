import { z } from "zod";
import { formatRate, parseAmount, parseRate } from "@/lib/money";

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

export const TRANSACTION_TYPES = ["expense", "income"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

/** 999.999.999,99: far above any personal amount, well inside safe integers. */
export const MAX_AMOUNT_CENTS = 99_999_999_999;

/** Typed text ("12,50") in, positive integer cents out. */
const amountSchema = z.string().transform((value, ctx) => {
  const cents = parseAmount(value);
  if (cents === null || cents <= 0) {
    ctx.addIssue({ code: "custom", message: "amountInvalid" });
    return z.NEVER;
  }
  if (cents > MAX_AMOUNT_CENTS) {
    ctx.addIssue({ code: "custom", message: "amountTooLarge" });
    return z.NEVER;
  }
  return cents;
});

export const transactionSchema = z.object({
  type: z.enum(TRANSACTION_TYPES),
  amount: amountSchema,
  currency: z.enum(CURRENCIES, { error: "currencyRequired" }),
  categoryId: z.uuid({ error: "categoryRequired" }),
  occurredOn: z.iso.date({ error: "dateInvalid" }),
  description: z
    .string()
    .trim()
    .max(140, { error: "descriptionTooLong" })
    .optional()
    .transform((value) => value || null),
  // Optional manual rate (e.g. the one Wise/Revolut actually charged), currency -> primary.
  fxRate: z
    .string()
    .trim()
    .optional()
    .transform((value, ctx) => {
      if (!value) return null;
      try {
        return formatRate(parseRate(value));
      } catch {
        ctx.addIssue({ code: "custom", message: "rateInvalid" });
        return z.NEVER;
      }
    }),
});
export type TransactionInput = z.input<typeof transactionSchema>;
export type TransactionData = z.output<typeof transactionSchema>;

/** Filters on /app/transactions, read from the URL. Invalid values are dropped. */
export const transactionFiltersSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional()
    .catch(undefined),
  type: z.enum(TRANSACTION_TYPES).optional().catch(undefined),
  currency: z.enum(CURRENCIES).optional().catch(undefined),
  category: z.uuid().optional().catch(undefined),
  q: z.string().trim().max(60).optional().catch(undefined),
});
export type TransactionFilters = z.output<typeof transactionFiltersSchema>;

export const FREQUENCIES = ["monthly", "weekly", "yearly"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const recurringItemSchema = z
  .object({
    type: z.enum(TRANSACTION_TYPES),
    name: z
      .string()
      .trim()
      .min(1, { error: "recurringNameRequired" })
      .max(60, { error: "recurringNameTooLong" }),
    amount: amountSchema,
    currency: z.enum(CURRENCIES, { error: "currencyRequired" }),
    categoryId: z.uuid({ error: "categoryRequired" }),
    frequency: z.enum(FREQUENCIES),
    // Form strings in; only used (and required) for monthly items.
    dayOfMonth: z.string().optional(),
    startOn: z.iso.date({ error: "dateInvalid" }),
    endOn: z
      .string()
      .optional()
      .transform((value) => value || null)
      .pipe(z.iso.date({ error: "dateInvalid" }).nullable()),
  })
  .transform((item, ctx) => {
    let dayOfMonth: number | null = null;
    if (item.frequency === "monthly") {
      dayOfMonth = Number(item.dayOfMonth);
      if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
        ctx.addIssue({ code: "custom", message: "dayOfMonthInvalid", path: ["dayOfMonth"] });
        return z.NEVER;
      }
    }
    if (item.endOn && item.endOn < item.startOn) {
      ctx.addIssue({ code: "custom", message: "endBeforeStart", path: ["endOn"] });
      return z.NEVER;
    }
    return { ...item, dayOfMonth };
  });
export type RecurringItemInput = z.input<typeof recurringItemSchema>;
export type RecurringItemData = z.output<typeof recurringItemSchema>;

/**
 * Confirms a planned transaction with the amount actually paid. The date
 * stays the due date: it is half of the (recurring_item_id, occurred_on) key
 * that keeps generation from recreating an occurrence that was already paid.
 */
export const markPaidSchema = z.object({
  amount: amountSchema,
});
export type MarkPaidInput = z.input<typeof markPaidSchema>;

/** A category's monthly budget in the primary currency; empty clears it. */
export const budgetSchema = z.object({
  categoryId: z.uuid(),
  amount: z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (!value) return null;
      const cents = parseAmount(value);
      if (cents === null || cents <= 0 || cents > MAX_AMOUNT_CENTS) {
        ctx.addIssue({ code: "custom", message: "amountInvalid" });
        return z.NEVER;
      }
      return cents;
    }),
});
export type BudgetInput = z.input<typeof budgetSchema>;
