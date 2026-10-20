import { describe, expect, it } from "vitest";
import { DEFAULT_AFTER_LOGIN, safeNextPath } from "@/lib/redirect";

describe("safeNextPath", () => {
  it("keeps same-origin paths with query strings", () => {
    expect(safeNextPath("/app/transactions?month=2026-10")).toBe("/app/transactions?month=2026-10");
    expect(safeNextPath("/onboarding")).toBe("/onboarding");
  });

  it.each([
    ["missing", undefined],
    ["null", null],
    ["empty", ""],
    ["absolute URL", "https://evil.example/app"],
    ["protocol-relative URL", "//evil.example"],
    ["backslash trick", "/\\evil.example"],
    ["relative path", "app"],
    ["javascript URL", "javascript:alert(1)"],
  ])("falls back to the default for %s", (_, next) => {
    expect(safeNextPath(next)).toBe(DEFAULT_AFTER_LOGIN);
  });
});
