import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { FormSkeleton } from "@/components/auth/form-skeleton";
import { OnboardingWizard } from "@/components/forms/onboarding-wizard";
import { requireProfile } from "@/lib/auth";

export default async function OnboardingPage() {
  const t = await getTranslations("Onboarding");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <Suspense fallback={<FormSkeleton fields={2} />}>
        <Onboarding />
      </Suspense>
    </main>
  );
}

async function Onboarding() {
  const profile = await requireProfile();
  if (profile.onboardingDone) {
    redirect("/app");
  }

  return (
    <OnboardingWizard
      defaultValues={{
        primaryCurrency: profile.primaryCurrency,
        monthStartDay: profile.monthStartDay,
      }}
    />
  );
}
