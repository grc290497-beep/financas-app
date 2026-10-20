import Link from "next/link";
import { getTranslations } from "next-intl/server";

/** One footer for every page; globals.css lifts it above the mobile tab bar when there is one. */
export async function SiteFooter() {
  const t = await getTranslations("Footer");

  return (
    <footer className="site-footer mt-12 border-t bg-card/40">
      {/* pr-20 on phones keeps the text clear of the floating "+" button. */}
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 py-8 pr-20 pl-4 text-sm sm:flex-row sm:items-end sm:justify-between sm:px-4">
        <div className="flex flex-col gap-1">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="metal-brass size-5 rounded-md" aria-hidden />
            {t("appName")}
          </Link>
          <p className="text-muted-foreground">{t("tagline")}</p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <nav aria-label={t("legal")} className="flex gap-5">
            <Link
              href="/privacy"
              className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {t("privacy")}
            </Link>
            <Link
              href="/terms"
              className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {t("terms")}
            </Link>
          </nav>
          <p className="text-xs text-muted-foreground">{t("data")}</p>
        </div>
      </div>
    </footer>
  );
}
