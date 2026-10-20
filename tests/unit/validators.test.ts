import { describe, expect, it } from "vitest";
import {
  onboardingSchema,
  signInSchema,
  signUpSchema,
  transactionFiltersSchema,
  transactionSchema,
} from "@/lib/validators";

const firstMessage = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues[0]?.message;

describe("signUpSchema", () => {
  const valid = { displayName: "Ana", email: "ana@example.com", password: "12345678" };

  it("accepts valid input and normalizes the email", () => {
    const result = signUpSchema.safeParse({ ...valid, email: "  Ana@Example.COM " });
    expect(result.success).toBe(true);
    expect(result.data?.email).toBe("ana@example.com");
  });

  it("trims the display name and requires it", () => {
    expect(signUpSchema.safeParse({ ...valid, displayName: "  Ana  " }).data?.displayName).toBe(
      "Ana",
    );
    expect(firstMessage(signUpSchema.safeParse({ ...valid, displayName: "   " }))).toBe(
      "nameRequired",
    );
  });

  it("rejects an invalid email", () => {
    expect(firstMessage(signUpSchema.safeParse({ ...valid, email: "ana@" }))).toBe("emailInvalid");
  });

  it("enforces the password length bounds (8..72)", () => {
    expect(firstMessage(signUpSchema.safeParse({ ...valid, password: "1234567" }))).toBe(
      "passwordTooShort",
    );
    expect(signUpSchema.safeParse({ ...valid, password: "x".repeat(72) }).success).toBe(true);
    expect(firstMessage(signUpSchema.safeParse({ ...valid, password: "x".repeat(73) }))).toBe(
      "passwordTooLong",
    );
  });
});

describe("signInSchema", () => {
  it("requires a password", () => {
    expect(firstMessage(signInSchema.safeParse({ email: "ana@example.com", password: "" }))).toBe(
      "passwordRequired",
    );
  });
});

describe("onboardingSchema", () => {
  it("accepts EUR and BRL", () => {
    expect(onboardingSchema.safeParse({ primaryCurrency: "EUR", monthStartDay: 1 }).success).toBe(
      true,
    );
    expect(onboardingSchema.safeParse({ primaryCurrency: "BRL", monthStartDay: 25 }).success).toBe(
      true,
    );
  });

  it("rejects other currencies", () => {
    expect(
      firstMessage(onboardingSchema.safeParse({ primaryCurrency: "USD", monthStartDay: 1 })),
    ).toBe("currencyRequired");
  });

  it("coerces the day from a form string", () => {
    expect(
      onboardingSchema.safeParse({ primaryCurrency: "EUR", monthStartDay: "28" }).data
        ?.monthStartDay,
    ).toBe(28);
  });

  it.each([0, 29, 31, 1.5, -1, "abc"])("rejects month start day %s", (day) => {
    expect(
      firstMessage(onboardingSchema.safeParse({ primaryCurrency: "EUR", monthStartDay: day })),
    ).toBe("monthStartDayInvalid");
  });
});

describe("transactionSchema", () => {
  const valid = {
    type: "expense",
    amount: "12,50",
    currency: "EUR",
    categoryId: "3f1c2a9e-5b7d-4c8e-9a1b-2c3d4e5f6a7b",
    occurredOn: "2026-10-20",
  } as const;

  it("turns the typed amount into cents and empty optionals into null", () => {
    const result = transactionSchema.safeParse({ ...valid, description: "  ", fxRate: "" });
    expect(result.data).toEqual({
      ...valid,
      amount: 1250,
      description: null,
      fxRate: null,
    });
  });

  it("normalizes a manual rate to 6 decimals", () => {
    expect(transactionSchema.safeParse({ ...valid, fxRate: "0,1775" }).data?.fxRate).toBe(
      "0.177500",
    );
  });

  it.each([
    ["0", "amountInvalid"],
    ["abc", "amountInvalid"],
    ["1.000.000.000,00", "amountTooLarge"],
  ])("rejects amount %j", (amount, message) => {
    expect(firstMessage(transactionSchema.safeParse({ ...valid, amount }))).toBe(message);
  });

  it("rejects a bad rate, category or date", () => {
    expect(firstMessage(transactionSchema.safeParse({ ...valid, fxRate: "0" }))).toBe(
      "rateInvalid",
    );
    expect(firstMessage(transactionSchema.safeParse({ ...valid, categoryId: "x" }))).toBe(
      "categoryRequired",
    );
    expect(firstMessage(transactionSchema.safeParse({ ...valid, occurredOn: "20/10/2026" }))).toBe(
      "dateInvalid",
    );
  });

  it("caps the description at 140 characters", () => {
    expect(
      firstMessage(transactionSchema.safeParse({ ...valid, description: "x".repeat(141) })),
    ).toBe("descriptionTooLong");
  });
});

describe("transactionFiltersSchema", () => {
  it("keeps valid filters and drops invalid ones instead of failing", () => {
    expect(
      transactionFiltersSchema.parse({
        month: "2026-13",
        type: "expense",
        currency: "USD",
        q: " pão ",
      }),
    ).toEqual({
      month: undefined,
      type: "expense",
      currency: undefined,
      category: undefined,
      q: "pão",
    });
  });
});
