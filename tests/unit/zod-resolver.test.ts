import { describe, expect, it } from "vitest";
import { z } from "zod";
import { zodResolver } from "@/lib/zod-resolver";

const options = { fields: {}, shouldUseNativeValidation: false };

describe("zodResolver", () => {
  it("returns parsed values when valid", async () => {
    const resolver = zodResolver(z.object({ day: z.coerce.number() }));
    const result = await resolver({ day: "5" } as never, undefined, options);
    expect(result).toEqual({ values: { day: 5 }, errors: {} });
  });

  it("returns the first error per field, nested by path", async () => {
    const schema = z.object({
      name: z.string().min(1, { error: "required" }).max(2, { error: "tooLong" }),
      address: z.object({ city: z.string().min(1, { error: "cityRequired" }) }),
    });
    const result = await zodResolver(schema)(
      { name: "", address: { city: "" } },
      undefined,
      options,
    );
    expect(result.values).toEqual({});
    expect(result.errors).toMatchObject({
      name: { message: "required" },
      address: { city: { message: "cityRequired" } },
    });
  });
});
