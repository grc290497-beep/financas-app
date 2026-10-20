"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/redirect";
import { resolveSiteOrigin } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import {
  magicLinkSchema,
  signInSchema,
  signUpSchema,
  type MagicLinkInput,
  type SignInInput,
  type SignUpInput,
} from "@/lib/validators";

// Error values are keys under "Auth.errors" in messages/pt-BR.json.
export type AuthActionResult =
  { status: "error"; error: string } | { status: "check-email" } | { status: "link-sent" };

async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return resolveSiteOrigin(
    {
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
      VERCEL_ENV: process.env.VERCEL_ENV,
      VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
    },
    `${proto}://${host}`,
  );
}

export async function signUp(input: SignUpInput): Promise<AuthActionResult> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return { status: "error", error: "invalidInput" };

  const { displayName, email, password } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: `${await siteOrigin()}/auth/callback?next=/onboarding`,
    },
  });

  if (error) {
    if (error.code === "weak_password") return { status: "error", error: "weakPassword" };
    if (error.code === "over_email_send_rate_limit" || error.status === 429) {
      return { status: "error", error: "rateLimited" };
    }
    return { status: "error", error: "signUpFailed" };
  }

  // With email confirmation on (Supabase default) there is no session yet.
  if (!data.session) return { status: "check-email" };
  redirect("/onboarding");
}

export async function signIn(input: SignInInput): Promise<AuthActionResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return { status: "error", error: "invalidInput" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    if (error.code === "email_not_confirmed") {
      return { status: "error", error: "emailNotConfirmed" };
    }
    if (error.status === 429) return { status: "error", error: "rateLimited" };
    return { status: "error", error: "invalidCredentials" };
  }

  redirect(safeNextPath(parsed.data.next));
}

export async function sendMagicLink(input: MagicLinkInput): Promise<AuthActionResult> {
  const parsed = magicLinkSchema.safeParse(input);
  if (!parsed.success) return { status: "error", error: "invalidInput" };

  const supabase = await createClient();
  const next = safeNextPath(parsed.data.next);
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      // Accounts are created on /signup so they always get a display name.
      shouldCreateUser: false,
      emailRedirectTo: `${await siteOrigin()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error?.status === 429) return { status: "error", error: "rateLimited" };
  // Same answer whether or not the email has an account, to avoid leaking which do.
  return { status: "link-sent" };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
