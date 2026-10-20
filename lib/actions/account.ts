"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { deleteAccountSchema } from "@/lib/validators";

// Error values are keys under "Settings.errors" in messages/pt-BR.json.
export type AccountActionResult = { status: "error"; error: string };

/**
 * Deletes the signed-in user's auth record. Every table references
 * auth.users with on delete cascade, so all their data goes with it
 * (verified against the live schema, PLAN.md section 7).
 */
export async function deleteAccount(input: { confirmation: string }): Promise<AccountActionResult> {
  const parsed = deleteAccountSchema.safeParse(input);
  if (!parsed.success) return { status: "error", error: "confirmationMismatch" };

  const user = await requireUser();
  const admin = createAdminClient();
  if (!admin) return { status: "error", error: "deleteUnavailable" };

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return { status: "error", error: "deleteFailed" };

  // The session's user no longer exists; clear its cookies.
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
