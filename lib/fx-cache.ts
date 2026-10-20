import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchFrankfurterEurBrl, type FxCache, type FxDeps } from "@/lib/fx";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Wires lib/fx.ts to the fx_rates table. Reads are public; writes need the
// service role, and are skipped (not fatal) when it is not configured.

async function supabaseFxCache(reader?: SupabaseClient): Promise<FxCache> {
  const supabase = reader ?? (await createClient());
  const admin = createAdminClient();
  const pair = { base: "EUR", quote: "BRL" } as const;

  return {
    async get(date) {
      const { data } = await supabase
        .from("fx_rates")
        .select("rate")
        .match({ ...pair, date })
        .maybeSingle();
      return data ? String(data.rate) : null;
    },
    async latestOnOrBefore(date) {
      const { data } = await supabase
        .from("fx_rates")
        .select("date, rate")
        .match(pair)
        .lte("date", date)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data ? { date: data.date, rate: String(data.rate) } : null;
    },
    async put(date, rate) {
      if (!admin) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set; FX cache not written");
      const { error } = await admin.from("fx_rates").upsert({ ...pair, date, rate });
      if (error) throw error;
    },
  };
}

/** `reader` defaults to the request's client; the cron passes the service-role one. */
export async function serverFxDeps(reader?: SupabaseClient): Promise<FxDeps> {
  return {
    cache: await supabaseFxCache(reader),
    fetchEurBrl: (date) => fetchFrankfurterEurBrl(date),
    today: () => new Date().toISOString().slice(0, 10),
  };
}
