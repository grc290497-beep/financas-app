import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Pencil, Plus } from "lucide-react";
import { ArchiveCategoryButton, CategorySheet } from "@/components/categories/category-sheet";
import { CategoryIcon } from "@/components/transactions/category-icon";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireProfile } from "@/lib/auth";
import { listAllCategories } from "@/lib/transactions";
import { CATEGORY_ICONS, CATEGORY_KINDS } from "@/lib/validators";

type Row = Awaited<ReturnType<typeof listAllCategories>>[number];

export default function CategoriesPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <Categories />
      </Suspense>
    </main>
  );
}

async function Categories() {
  // Profile first: it resolves the session (request time) before the query.
  await requireProfile();
  const [categories, t] = await Promise.all([listAllCategories(), getTranslations("Categories")]);
  const visible = categories.filter((c) => !c.archived);
  const hidden = categories.filter((c) => c.archived);

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-pretty text-muted-foreground">{t("description")}</p>
      </div>
      <CategorySheet className={buttonVariants({ className: "self-start" })}>
        <Plus className="size-4" aria-hidden />
        {t("add")}
      </CategorySheet>

      {CATEGORY_KINDS.map((kind) => {
        const rows = visible.filter((c) => c.kind === kind);
        if (!rows.length) return null;
        return (
          <section key={kind} className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-muted-foreground">{t(`kinds.${kind}`)}</h2>
            <ul className="surface divide-y">
              {rows.map((c) => (
                <CategoryRow key={c.id} category={c} editLabel={t("editNamed", { name: c.name })} />
              ))}
            </ul>
          </section>
        );
      })}

      {hidden.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">{t("hidden")}</h2>
          <ul className="surface divide-y opacity-70">
            {hidden.map((c) => (
              <CategoryRow key={c.id} category={c} editLabel={t("editNamed", { name: c.name })} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function CategoryRow({ category: c, editLabel }: { category: Row; editLabel: string }) {
  // Older rows may hold an icon outside the picker; fall back to the first one.
  const icon = CATEGORY_ICONS.find((value) => value === c.icon) ?? CATEGORY_ICONS[0];

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <CategoryIcon icon={c.icon} color={c.color} />
      <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
      <CategorySheet
        initial={{ id: c.id, name: c.name, kind: c.kind, icon, color: c.color ?? "#64748b" }}
        ariaLabel={editLabel}
        className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
      >
        <Pencil aria-hidden />
      </CategorySheet>
      <ArchiveCategoryButton id={c.id} name={c.name} archived={c.archived} />
    </li>
  );
}
