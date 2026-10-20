import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeftRight, CalendarRange, Target } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const [t, common] = await Promise.all([getTranslations("Landing"), getTranslations("Common")]);

  const features = [
    { icon: ArrowLeftRight, label: t("features.currencies") },
    { icon: CalendarRange, label: t("features.monthly") },
    { icon: Target, label: t("features.goals") },
  ];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-10 px-4 py-16 sm:px-6">
      <Logo name={common("appName")} size={40} className="text-lg" />
      <div className="flex flex-col gap-4">
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          {t("title")}
        </h1>
        <p className="text-lg text-pretty text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* A preview of the dashboard's headline card, with made-up figures labelled as such. */}
      <figure
        className="hero-card flex flex-col gap-1.5 rounded-3xl px-5 py-6"
        aria-label={t("preview.label")}
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-hero-muted">{t("preview.title")}</span>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-hero-muted">
            {t("preview.sample")}
          </span>
        </div>
        <p className="text-4xl font-semibold tracking-tight text-brass-light tabular-nums sm:text-5xl">
          € 1.108,73
        </p>
        <p className="text-sm text-hero-muted">{t("preview.perDay")}</p>
      </figure>

      <ul className="flex flex-col gap-3">
        {features.map(({ icon: Icon, label }) => (
          <li key={label} className="flex items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brass/15 text-brass">
              <Icon className="size-4" aria-hidden />
            </span>
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
    </main>
  );
}
