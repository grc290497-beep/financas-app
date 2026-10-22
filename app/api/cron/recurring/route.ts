import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { serverFxDeps } from "@/lib/fx-cache";
import { getFinancialPeriod } from "@/lib/period";
import { generateRecurringForPeriod } from "@/lib/recurring";
import { confirmDue, supabaseRecurringStore } from "@/lib/recurring-store";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Currency } from "@/lib/validators";

// Daily backstop for recurring generation (vercel.json). The app also plans
// the current month whenever its pages open; this covers users who don't.
// Vercel sends `Authorization: Bearer $CRON_SECRET`.

export async function GET(request: NextRequest) {
  if (!isAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
  }

  const { data: items, error: itemsError } = await admin
    .from("recurring_items")
    .select("user_id")
    .eq("active", true);
  if (itemsError) throw itemsError;

  const userIds = [...new Set(items.map((item) => item.user_id))];
  if (!userIds.length) return NextResponse.json({ users: 0, created: 0, failed: 0 });

  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("id, primary_currency, month_start_day")
    .in("id", userIds)
    .eq("onboarding_done", true);
  if (profilesError) throw profilesError;

  const today = new Date().toISOString().slice(0, 10);
  const fx = await serverFxDeps(admin);
  let created = 0;
  let failed = 0;

  // One user's failure must not stop everyone else's month from being planned.
  for (const profile of profiles) {
    try {
      const result = await generateRecurringForPeriod(
        profile.id,
        getFinancialPeriod(today, profile.month_start_day),
        profile.primary_currency as Currency,
        { store: supabaseRecurringStore(admin, profile.id), fx },
      );
      created += result.created;
    } catch (error) {
      failed++;
      console.error("Recurring generation failed for a user", error);
    }
  }

  const confirmed = await confirmDue(admin, today);
  return NextResponse.json({ users: profiles.length, created, failed, confirmed });
}

function isAuthorized(header: string | null) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
