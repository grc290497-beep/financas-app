import { NextResponse, type NextRequest } from "next/server";
import { transactionsCsv, type ExportTransaction } from "@/lib/export";
import { createClient } from "@/lib/supabase/server";

// "Exportar meus dados" (PLAN.md section 7, GDPR). Runs with the user's own
// client, so RLS limits every table to their rows; never the service role.

type Client = Awaited<ReturnType<typeof createClient>>;

// PostgREST caps a response at 1000 rows, so read in pages.
const PAGE = 1000;

async function fetchAll(supabase: Client, table: string, select = "*", orderBy = "created_at") {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .order(orderBy)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data as unknown as Record<string, unknown>[]));
    if (data.length < PAGE) return rows;
  }
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const format = request.nextUrl.searchParams.get("format");

  if (format === "csv") {
    const rows = await fetchAll(
      supabase,
      "transactions",
      "occurred_on, type, status, description, amount_cents, currency, fx_rate, amount_primary_cents, categories (name)",
      "occurred_on",
    );
    return download(
      transactionsCsv(rows as ExportTransaction[]),
      `lancamentos-${today}.csv`,
      "text/csv; charset=utf-8",
    );
  }

  if (format === "json") {
    const [profile, categories, transactions, recurringItems, goals, goalContributions] =
      await Promise.all([
        fetchAll(supabase, "profiles", "*", "id"),
        fetchAll(supabase, "categories"),
        fetchAll(supabase, "transactions", "*", "occurred_on"),
        fetchAll(supabase, "recurring_items"),
        fetchAll(supabase, "goals"),
        fetchAll(supabase, "goal_contributions", "*", "contributed_on"),
      ]);
    const body = {
      exported_at: new Date().toISOString(),
      email: data.claims.email ?? null,
      profile: profile[0] ?? null,
      categories,
      transactions,
      recurring_items: recurringItems,
      goals,
      goal_contributions: goalContributions,
    };
    return download(
      JSON.stringify(body, null, 2),
      `meus-dados-${today}.json`,
      "application/json; charset=utf-8",
    );
  }

  return NextResponse.json({ error: "format must be csv or json" }, { status: 400 });
}

function download(body: string, filename: string, contentType: string) {
  return new NextResponse(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
