import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/actions/auth";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const t = await getTranslations("Common");

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4">
          <Link href="/app" className="font-semibold tracking-tight">
            {t("appName")}
          </Link>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">
              <LogOut aria-hidden />
              {t("signOut")}
            </Button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
