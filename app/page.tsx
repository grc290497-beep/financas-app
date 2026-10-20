import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeftRight, CalendarRange, Target } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const t = await getTranslations("Landing");

  const features = [
    { icon: ArrowLeftRight, label: t("features.currencies") },
    { icon: CalendarRange, label: t("features.monthly") },
    { icon: Target, label: t("features.goals") },
  ];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-10 px-4 py-16 sm:px-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          {t("title")}
        </h1>
        <p className="text-lg text-pretty text-muted-foreground">{t("subtitle")}</p>
      </div>

      <ul className="flex flex-col gap-3">
        {features.map(({ icon: Icon, label }) => (
          <li key={label} className="flex items-center gap-3">
            <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            <span>{label}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg">
          <Link href="/signup">{t("cta")}</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/login">{t("login")}</Link>
        </Button>
      </div>

      <footer className="flex gap-4 text-sm text-muted-foreground">
        <Link href="/privacy" className="underline-offset-4 hover:underline">
          {t("privacy")}
        </Link>
        <Link href="/terms" className="underline-offset-4 hover:underline">
          {t("terms")}
        </Link>
      </footer>
    </main>
  );
}
