import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LogOut, Settings } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/actions/auth";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const t = await getTranslations("Common");

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b bg-card/60 backdrop-blur-sm">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4">
          <Link href="/app">
            <Logo name={t("appName")} />
          </Link>
          <div className="flex items-center gap-1">
            {/* Ajustes sits here instead of a sixth tab; revisited in the design pass. */}
            <Button asChild variant="ghost" size="sm">
              <Link href="/app/settings">
                <Settings aria-hidden />
                {t("settings")}
              </Link>
            </Button>
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm">
                <LogOut aria-hidden />
                {t("signOut")}
              </Button>
            </form>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
