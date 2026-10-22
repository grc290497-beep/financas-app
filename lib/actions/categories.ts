"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { categorySchema, type CategoryInput } from "@/lib/validators";

// Error values are keys under "Categories.errors" in messages/pt-BR.json.
export type CategoryActionResult = { status: "ok" } | { status: "error"; error: string };

const UNIQUE_VIOLATION = "23505";

export async function createCategory(input: CategoryInput): Promise<CategoryActionResult> {
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { status: "error", error: "invalidInput" };

  const supabase = await createClient();
  // New categories go to the end of their group.
  const { data: last } = await supabase
    .from("categories")
    .select("sort_order")
    .eq("kind", parsed.data.kind)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase
    .from("categories")
    .insert({ ...parsed.data, sort_order: (last?.sort_order ?? 0) + 1 });
  if (error) {
    return { status: "error", error: error.code === UNIQUE_VIOLATION ? "duplicate" : "saveFailed" };
  }

  revalidatePath("/app", "layout");
  return { status: "ok" };
}

/** Name, icon and color only: the kind stays, since it decides income vs expense. */
export async function updateCategory(
  id: string,
  input: CategoryInput,
): Promise<CategoryActionResult> {
  const parsedId = z.uuid().safeParse(id);
  const parsed = categorySchema.safeParse(input);
  if (!parsedId.success || !parsed.success) return { status: "error", error: "invalidInput" };

  const { name, icon, color } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .update({ name, icon, color })
    .eq("id", parsedId.data)
    .select("id");
  if (error) {
    return { status: "error", error: error.code === UNIQUE_VIOLATION ? "duplicate" : "saveFailed" };
  }
  if (!data.length) return { status: "error", error: "notFound" };

  revalidatePath("/app", "layout");
  return { status: "ok" };
}

/**
 * Hiding instead of deleting: past transactions keep pointing at the category
 * (the foreign key restricts deletes), and reports still show it.
 */
export async function setCategoryArchived(
  id: string,
  archived: boolean,
): Promise<CategoryActionResult> {
  const parsed = z.object({ id: z.uuid(), archived: z.boolean() }).safeParse({ id, archived });
  if (!parsed.success) return { status: "error", error: "invalidInput" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .update({ archived: parsed.data.archived })
    .eq("id", parsed.data.id)
    .select("id");
  if (error) return { status: "error", error: "saveFailed" };
  if (!data.length) return { status: "error", error: "notFound" };

  revalidatePath("/app", "layout");
  return { status: "ok" };
}
