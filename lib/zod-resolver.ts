import type { FieldErrors, FieldValues, Resolver } from "react-hook-form";
import type { z } from "zod";

/**
 * Minimal react-hook-form resolver for zod schemas (avoids @hookform/resolvers,
 * whose optional peer dependencies conflict with zod 4). Field errors carry the
 * zod message, which the form translates.
 */
export function zodResolver<Input extends FieldValues, Output extends FieldValues>(
  schema: z.ZodType<Output, Input>,
): Resolver<Input, unknown, Output> {
  return async (values) => {
    const result = await schema.safeParseAsync(values);
    if (result.success) {
      return { values: result.data, errors: {} };
    }

    const errors: Record<string, unknown> = {};
    for (const issue of result.error.issues) {
      let target = errors;
      const path = issue.path.map(String);
      path.slice(0, -1).forEach((key) => {
        target[key] ??= {};
        target = target[key] as Record<string, unknown>;
      });
      const leaf = path.at(-1) ?? "root";
      target[leaf] ??= { type: issue.code, message: issue.message };
    }

    return { values: {}, errors: errors as FieldErrors<Input> };
  };
}
