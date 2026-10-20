"use client";

import { useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateProfile } from "@/lib/actions/profile";
import { profileSchema, type ProfileData, type ProfileInput } from "@/lib/validators";
import { zodResolver } from "@/lib/zod-resolver";
import { useValidationMessage } from "@/components/forms/use-validation-message";

const DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

/** Name and month start day; the same day picker as onboarding. */
export function ProfileForm({ defaultValues }: { defaultValues: ProfileData }) {
  const t = useTranslations("Settings.profile");
  const tOnboarding = useTranslations("Onboarding.monthStart");
  const validationMessage = useValidationMessage();
  const [pending, startTransition] = useTransition();
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileInput, unknown, ProfileData>({
    resolver: zodResolver(profileSchema),
    defaultValues,
  });
  const monthStartDay = Number(useWatch({ control, name: "monthStartDay" }));

  const onSubmit = (data: ProfileData) =>
    startTransition(async () => {
      const result = await updateProfile(data);
      if (result.status === "error") {
        toast.error(t(`errors.${result.error}` as Parameters<typeof t>[0]));
        return;
      }
      reset(data);
      toast.success(t("saved"));
    });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="surface flex flex-col gap-5 p-4">
      <Field data-invalid={!!errors.displayName}>
        <FieldLabel htmlFor="displayName">{t("name")}</FieldLabel>
        <Input
          id="displayName"
          autoComplete="given-name"
          maxLength={80}
          aria-invalid={!!errors.displayName}
          {...register("displayName")}
        />
        <FieldError errors={validationMessage(errors.displayName)} />
      </Field>

      <Field data-invalid={!!errors.monthStartDay}>
        <FieldLabel htmlFor="monthStartDay">{t("monthStartDay")}</FieldLabel>
        <Controller
          control={control}
          name="monthStartDay"
          render={({ field }) => (
            <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
              <SelectTrigger id="monthStartDay" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAYS.map((day) => (
                  <SelectItem key={day} value={String(day)}>
                    {tOnboarding("day", { day })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <FieldDescription>
          {monthStartDay === 1
            ? tOnboarding("exampleFirst")
            : tOnboarding("exampleOther", { day: monthStartDay, previousDay: monthStartDay - 1 })}
        </FieldDescription>
        <FieldError errors={validationMessage(errors.monthStartDay)} />
      </Field>

      <Button type="submit" className="self-start" disabled={pending || !isDirty}>
        {pending ? t("saving") : t("save")}
      </Button>
    </form>
  );
}
