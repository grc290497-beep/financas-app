"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requireUser, signedInByRecentLink } from "@/lib/auth";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";
import { safeNextPath } from "@/lib/redirect";
import { resolveSiteOrigin } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import {
  magicLinkSchema,
  newPasswordSchema,
  signInSchema,
  signUpSchema,
  type MagicLinkInput,
  type NewPasswordInput,
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

/** "Esqueci minha senha": the e-mail's link signs in and lands on /reset-password. */
export async function requestPasswordReset(input: MagicLinkInput): Promise<AuthActionResult> {
  const parsed = magicLinkSchema.safeParse(input);
  if (!parsed.success) return { status: "error", error: "invalidInput" };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await siteOrigin()}/auth/callback?next=/reset-password`,
  });

  if (error?.status === 429) return { status: "error", error: "rateLimited" };
  // Same answer whether or not the email has an account, to avoid leaking which do.
  return { status: "link-sent" };
}

/** Sets a new password for the signed-in user (after the reset link, or from Ajustes). */
export async function updatePassword(input: NewPasswordInput): Promise<AuthActionResult> {
  const parsed = newPasswordSchema.safeParse(input);
  if (!parsed.success) return { status: "error", error: "invalidInput" };

  const user = await requireUser();
  // Someone holding an unlocked phone must not be able to take over the account.
  if (!(await signedInByRecentLink())) {
    if (!parsed.data.currentPassword || !user.email) {
      return { status: "error", error: "currentPassword" };
    }
    const check = await verifyPassword(user.email, parsed.data.currentPassword);
    if (check !== "ok") return { status: "error", error: check };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    if (error.code === "weak_password") return { status: "error", error: "weakPassword" };
    if (error.code === "same_password") return { status: "error", error: "samePassword" };
    if (error.status === 429) return { status: "error", error: "rateLimited" };
    return { status: "error", error: "unexpected" };
  }

  redirect("/app");
}

/** Checks a password on a throwaway client, so the user's own session cookies stay as they are. */
async function verifyPassword(email: string, password: string) {
  const client = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) return error.status === 429 ? "rateLimited" : "currentPassword";
  // End only the session this check opened.
  await client.auth.signOut({ scope: "local" });
  return "ok";
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
