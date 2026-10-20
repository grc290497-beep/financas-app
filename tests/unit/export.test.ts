import { describe, expect, it } from "vitest";
import { transactionsCsv, type ExportTransaction } from "@/lib/export";

const row: ExportTransaction = {
  occurred_on: "2026-10-05",
  type: "expense",
  status: "confirmed",
  description: "Mercado",
  amount_cents: 1250,
  currency: "EUR",
  fx_rate: "6.123456",
  amount_primary_cents: "7654",
  categories: { name: "Alimentação" },
};

const lines = (csv: string) => csv.replace(/^﻿/, "").trimEnd().split("\r\n");

describe("transactionsCsv", () => {
  it("writes a BOM, a header and one line per transaction with decimal commas", () => {
    const csv = transactionsCsv([row]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(lines(csv)).toEqual([
      "data;tipo;status;categoria;descricao;valor;moeda;cambio;valor_moeda_principal",
      "2026-10-05;expense;confirmed;Alimentação;Mercado;12,50;EUR;6,123456;76,54",
    ]);
  });

  it("writes only the header when there are no transactions", () => {
    expect(lines(transactionsCsv([]))).toHaveLength(1);
  });

  it("quotes separators, quotes and line breaks", () => {
    const csv = transactionsCsv([{ ...row, description: 'Pão; "bom"\nfresco' }]);
    expect(csv).toContain(';"Pão; ""bom""\nfresco";');
  });

  it("neutralises spreadsheet formulas but keeps negative-looking text", () => {
    expect(lines(transactionsCsv([{ ...row, description: "=HYPERLINK(1)" }]))[1]).toContain(
      ";'=HYPERLINK(1);",
    );
    expect(lines(transactionsCsv([{ ...row, description: "-5 desconto" }]))[1]).toContain(
      ";-5 desconto;",
    );
  });

  it("handles a missing category and description", () => {
    expect(lines(transactionsCsv([{ ...row, description: null, categories: null }]))[1]).toBe(
      "2026-10-05;expense;confirmed;;;12,50;EUR;6,123456;76,54",
    );
  });
});
