import { formatAmountInput } from "@/lib/money";

// Data export (PLAN.md section 7, GDPR). Pure so it can be unit-tested; the
// route handler does the fetching.

export type ExportTransaction = {
  occurred_on: string;
  type: string;
  status: string;
  description: string | null;
  amount_cents: number | string;
  currency: string;
  fx_rate: number | string;
  amount_primary_cents: number | string;
  categories: { name: string } | null;
};

const HEADER = [
  "data",
  "tipo",
  "status",
  "categoria",
  "descricao",
  "valor",
  "moeda",
  "cambio",
  "valor_moeda_principal",
];

/**
 * Semicolon-separated with decimal commas and a BOM, which is what Excel and
 * Google Sheets expect from a pt-BR CSV.
 */
export function transactionsCsv(rows: ExportTransaction[]): string {
  const lines = rows.map((t) =>
    [
      t.occurred_on,
      t.type,
      t.status,
      t.categories?.name ?? "",
      t.description ?? "",
      formatAmountInput(Number(t.amount_cents)),
      t.currency,
      String(t.fx_rate).replace(".", ","),
      formatAmountInput(Number(t.amount_primary_cents)),
    ]
      .map(csvField)
      .join(";"),
  );
  return `﻿${[HEADER.join(";"), ...lines].join("\r\n")}\r\n`;
}

function csvField(value: string): string {
  // Leading = + - @ would run as a formula in a spreadsheet (CSV injection).
  const safe = /^[=+\-@\t\r]/.test(value) && !/^-?\d/.test(value) ? `'${value}` : value;
  return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
