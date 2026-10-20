import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ReceiptText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireProfile } from "@/lib/auth";

export default function DashboardPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-8">
      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard />
      </Suspense>
    </main>
  );
}

async function Dashboard() {
  const profile = await requireProfile();
  if (!profile.onboardingDone) {
    redirect("/onboarding");
  }

  const t = await getTranslations("Dashboard");

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {profile.displayName ? t("greeting", { name: profile.displayName }) : t("greetingNoName")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("summary", { currency: profile.primaryCurrency, day: profile.monthStartDay })}
        </p>
      </div>

      <section className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
        <ReceiptText className="size-10 text-muted-foreground" aria-hidden />
        <h2 className="text-lg font-medium">{t("emptyTitle")}</h2>
        <p className="max-w-sm text-sm text-pretty text-muted-foreground">
          {t("emptyDescription")}
        </p>
      </section>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-hidden>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-52 w-full rounded-xl" />
    </div>
  );
}
