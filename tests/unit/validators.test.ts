import { describe, expect, it } from "vitest";
import { onboardingSchema, signInSchema, signUpSchema } from "@/lib/validators";

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
