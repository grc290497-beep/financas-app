import { Suspense } from "react";
import { AppNav } from "@/components/nav/app-nav";
import { QuickAdd } from "@/components/transactions/quick-add";
import { requireProfile, requireUser } from "@/lib/auth";
import { getCategories, getCategoryUsage } from "@/lib/transactions";

export default function AppSectionLayout({ children }: LayoutProps<"/app">) {
  return (
    // Phones: bottom padding keeps the last item clear of the tab bar. md+: room for the sidebar.
    <div className="flex flex-1 flex-col pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-12 md:pl-60">
      {/* Dynamic routes (/app/goals/[id]) only know the pathname at request time. */}
      <Suspense fallback={null}>
        <NavLoader />
      </Suspense>
      {children}
      <Suspense fallback={null}>
        <QuickAddLoader />
      </Suspense>
    </div>
  );
}

async function NavLoader() {
  const [profile, user] = await Promise.all([requireProfile(), requireUser()]);
  const name = profile.displayName || user.email || "";
  return <AppNav name={name} initial={name.charAt(0) || "?"} />;
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
