"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Segmented } from "@/components/forms/segmented";
import { useValidationMessage } from "@/components/forms/use-validation-message";
import { CategoryIcon } from "@/components/transactions/category-icon";
import { createCategory, setCategoryArchived, updateCategory } from "@/lib/actions/categories";
import { cn } from "@/lib/utils";
import {
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  CATEGORY_KINDS,
  categorySchema,
  type CategoryInput,
} from "@/lib/validators";
import { zodResolver } from "@/lib/zod-resolver";

/** A button that opens the category form in a sheet: create without `initial`, edit with it. */
export function CategorySheet({
  initial,
  className,
  ariaLabel,
  children,
}: {
  initial?: CategoryInput & { id: string };
  className?: string;
  ariaLabel?: string;
  children: ReactNode;
}) {
  const t = useTranslations("Categories");
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={className}
        aria-label={ariaLabel}
        onClick={() => setOpen(true)}
      >
        {children}
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="mx-auto max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl pb-[calc(1rem+env(safe-area-inset-bottom))]"
        >
          <SheetHeader className="pb-0">
            <SheetTitle>{initial ? t("edit") : t("add")}</SheetTitle>
          </SheetHeader>
          <div className="px-4">
            {open && (
              <CategoryForm
                initial={
                  initial ?? {
                    name: "",
                    kind: "variable",
                    icon: CATEGORY_ICONS[0],
                    color: CATEGORY_COLORS[0],
                  }
                }
                categoryId={initial?.id}
                onDone={() => setOpen(false)}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function CategoryForm({
  initial,
  categoryId,
  onDone,
}: {
  initial: CategoryInput;
  categoryId?: string;
  onDone: () => void;
}) {
  const t = useTranslations("Categories");
  const validationMessage = useValidationMessage();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<CategoryInput>({
    resolver: zodResolver(categorySchema),
    defaultValues: initial,
  });
  const [kind, icon, color] = useWatch({ control, name: ["kind", "icon", "color"] });

  const onSubmit = () =>
    startTransition(async () => {
      setError(null);
      const result = categoryId
        ? await updateCategory(categoryId, getValues())
        : await createCategory(getValues());
      if (result.status === "error") {
        setError(result.error);
        return;
      }
      toast.success(t(categoryId ? "form.updated" : "form.saved"));
      onDone();
    });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{t(`errors.${error}` as Parameters<typeof t>[0])}</AlertDescription>
        </Alert>
      )}

      <FieldGroup className="gap-5">
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="category-name">{t("form.name")}</FieldLabel>
          <Input
            id="category-name"
            placeholder={t("form.namePlaceholder")}
            maxLength={60}
            autoFocus={!categoryId}
            aria-invalid={!!errors.name}
            {...register("name")}
          />
          <FieldError errors={validationMessage(errors.name)} />
        </Field>

        <Field>
          <FieldLabel>{t("form.kind")}</FieldLabel>
          {categoryId ? (
            <>
              <span className="text-sm font-medium">{t(`kinds.${kind}`)}</span>
              <FieldDescription>{t("form.kindLocked")}</FieldDescription>
            </>
          ) : (
            <Segmented
              label={t("form.kind")}
              options={CATEGORY_KINDS.map((value) => ({ value, label: t(`kinds.${value}`) }))}
              value={kind}
              onChange={(value) => setValue("kind", value)}
              className="grid h-auto w-full grid-cols-2 gap-1 *:py-2"
            />
          )}
        </Field>

        <FieldSet>
          <FieldLegend variant="label">{t("form.icon")}</FieldLegend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("form.icon")}>
            {CATEGORY_ICONS.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={icon === value}
                aria-label={t(`form.icons.${value}`)}
                onClick={() => setValue("icon", value)}
                className={cn(
                  "rounded-full p-0.5 ring-offset-2 ring-offset-background",
                  icon === value && "ring-2 ring-primary",
                )}
              >
                <CategoryIcon icon={value} color={color} />
              </button>
            ))}
          </div>
        </FieldSet>

        <FieldSet>
          <FieldLegend variant="label">{t("form.color")}</FieldLegend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("form.color")}>
            {CATEGORY_COLORS.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={color === value}
                aria-label={t(`form.colors.${value}`)}
                onClick={() => setValue("color", value)}
                className={cn(
                  "size-8 rounded-full ring-offset-2 ring-offset-background",
                  color === value && "ring-2 ring-primary",
                )}
                style={{ backgroundColor: value }}
              />
            ))}
          </div>
        </FieldSet>
      </FieldGroup>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? t("form.saving") : t("form.save")}
      </Button>
    </form>
  );
}

export function ArchiveCategoryButton({
  id,
  name,
  archived,
}: {
  id: string;
  name: string;
  archived: boolean;
}) {
  const t = useTranslations("Categories");
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      aria-label={archived ? undefined : t("hideNamed", { name })}
      onClick={() =>
        startTransition(async () => {
          const result = await setCategoryArchived(id, !archived);
          if (result.status === "error") {
            toast.error(t(`errors.${result.error}` as Parameters<typeof t>[0]));
            return;
          }
          toast.success(t(archived ? "shownToast" : "hiddenToast"));
        })
      }
    >
      {archived ? t("show") : t("hide")}
    </Button>
  );
}
