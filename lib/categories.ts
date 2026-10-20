import type { TransactionType } from "@/lib/validators";

export type CategoryKind = "income" | "fixed" | "variable" | "savings";

export type Category = {
  id: string;
  name: string;
  kind: CategoryKind;
  icon: string | null;
  color: string | null;
};

/** Which category kinds a transaction of this type may use. */
export function kindsForType(type: TransactionType): CategoryKind[] {
  return type === "income" ? ["income"] : ["variable", "fixed", "savings"];
}

/**
 * Categories valid for the type, most used first, so the quick-add chips put
 * the likely pick under the thumb. Ties follow kindsForType (everyday
 * variable spending before fixed costs), then the configured order.
 */
export function sortForQuickAdd(
  categories: Category[],
  type: TransactionType,
  usage: Record<string, number>,
): Category[] {
  const kinds = kindsForType(type);
  return categories
    .filter((c) => kinds.includes(c.kind))
    .map((c, index) => ({ c, index }))
    .sort(
      (a, b) =>
        (usage[b.c.id] ?? 0) - (usage[a.c.id] ?? 0) ||
        kinds.indexOf(a.c.kind) - kinds.indexOf(b.c.kind) ||
        a.index - b.index,
    )
    .map(({ c }) => c);
}
