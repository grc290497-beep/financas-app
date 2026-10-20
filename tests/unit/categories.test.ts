import { describe, expect, it } from "vitest";
import { kindsForType, sortForQuickAdd, type Category } from "@/lib/categories";

const cat = (id: string, kind: Category["kind"]): Category => ({
  id,
  name: id,
  kind,
  icon: null,
  color: null,
});

const categories = [
  cat("salario", "income"),
  cat("aluguel", "fixed"),
  cat("mercado", "variable"),
  cat("lazer", "variable"),
  cat("reserva", "savings"),
];

describe("kindsForType", () => {
  it("allows only income categories for income", () => {
    expect(kindsForType("income")).toEqual(["income"]);
  });

  it("allows variable, fixed and savings categories for expenses", () => {
    expect(kindsForType("expense")).toEqual(["variable", "fixed", "savings"]);
  });
});

describe("sortForQuickAdd", () => {
  it("keeps only categories valid for the type", () => {
    expect(sortForQuickAdd(categories, "income", {}).map((c) => c.id)).toEqual(["salario"]);
  });

  it("puts the most used first", () => {
    const usage = { lazer: 5, reserva: 2 };
    expect(sortForQuickAdd(categories, "expense", usage).map((c) => c.id)).toEqual([
      "lazer",
      "reserva",
      "mercado",
      "aluguel",
    ]);
  });

  it("without history, lists variable before fixed before savings, then configured order", () => {
    expect(sortForQuickAdd(categories, "expense", {}).map((c) => c.id)).toEqual([
      "mercado",
      "lazer",
      "aluguel",
      "reserva",
    ]);
  });
});
