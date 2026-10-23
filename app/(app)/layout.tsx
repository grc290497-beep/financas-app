import { Suspense } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { AccountMenu } from "@/components/nav/account-menu";
import { requireProfile, requireUser } from "@/lib/auth";

// Phones (and onboarding): logo and the account avatar. Inside /app from md up
// the sidebar takes over (globals.css hides this header there).
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const t = await getTranslations("Common");

  return (
    <div className="flex flex-1 flex-col">
      <header className="app-header sticky top-0 z-20 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
          <Link href="/app">
            <Logo name={t("appName")} />
          </Link>
          <Suspense fallback={<span className="size-8" />}>
            <AccountLink />
          </Suspense>
        </div>
      </header>
      {children}
    </div>
  );
}

async function AccountLink() {
  const [profile, user] = await Promise.all([requireProfile(), requireUser()]);
  const name = profile.displayName || user.email || "";
  return <AccountMenu name={name} email={user.email ?? ""} initial={name.charAt(0) || "?"} />;
}
