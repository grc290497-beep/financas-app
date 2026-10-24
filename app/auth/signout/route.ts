import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Where a session whose account no longer exists is sent (lib/auth.ts): a page
// can't clear cookies, and the proxy would keep bouncing /login back to /app.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  return NextResponse.redirect(new URL("/login", request.nextUrl.origin));
}
