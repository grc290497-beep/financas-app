import { Suspense } from "react";
import { AppNav } from "@/components/nav/app-nav";
import { QuickAdd } from "@/components/transactions/quick-add";
import { requireProfile } from "@/lib/auth";
import { getCategories, getCategoryUsage } from "@/lib/transactions";

export default function AppSectionLayout({ children }: LayoutProps<"/app">) {
  return (
    // Bottom padding keeps the last item clear of the fixed tab bar and the "+" button.
    <div className="flex flex-1 flex-col pb-[calc(7rem+env(safe-area-inset-bottom))] md:pb-24">
      {/* Dynamic routes (/app/goals/[id]) only know the pathname at request time. */}
      <Suspense fallback={null}>
        <AppNav />
      </Suspense>
      {children}
      <Suspense fallback={null}>
        <QuickAddLoader />
      </Suspense>
    </div>
  );
}

async function QuickAddLoader() {
  // Profile first: it resolves the session (request time) before the category queries.
  const profile = await requireProfile();
  const [categories, usage] = await Promise.all([getCategories(), getCategoryUsage()]);
  if (!profile.onboardingDone) return null;

  return (
    <QuickAdd categories={categories} usage={usage} primaryCurrency={profile.primaryCurrency} />
  );
}
