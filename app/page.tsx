import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  BarChart3,
  CalendarRange,
  Download,
  Gauge,
  Repeat,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import {
  DashboardPrint,
  ExchangePrint,
  GoalsPrint,
  PhoneFrame,
  QuickAddPrint,
} from "@/components/landing/mockups";
import { SiteHeader } from "@/components/nav/site-header";
import { InstallAppButton } from "@/components/pwa/install-app";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function Home() {
  const t = await getTranslations("Landing");

  const more: {
    icon: LucideIcon;
    key: "fixed" | "budget" | "reports" | "month" | "export" | "app";
  }[] = [
    { icon: Repeat, key: "fixed" },
    { icon: Gauge, key: "budget" },
    { icon: BarChart3, key: "reports" },
    { icon: CalendarRange, key: "month" },
    { icon: Download, key: "export" },
    { icon: Smartphone, key: "app" },
  ];

  const ctas = (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Button asChild size="lg" className="h-12 px-6 text-base">
        <Link href="/signup">{t("cta")}</Link>
      </Button>
      <Button asChild size="lg" variant="outline" className="h-12 px-6 text-base">
        <Link href="/login">{t("login")}</Link>
      </Button>
    </div>
  );

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />

      <main className="flex flex-col gap-24 pb-24 sm:gap-32">
        {/* Hero: the pitch on the left, the dashboard on a phone on the right. */}
        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pt-8 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-16">
          <div className="flex flex-col gap-6">
            <span className="self-start rounded-full bg-brass/15 px-3 py-1 text-xs font-medium text-brass">
              {t("eyebrow")}
            </span>
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
              {t("title")}
            </h1>
            <p className="max-w-xl text-lg text-pretty text-muted-foreground">{t("subtitle")}</p>
            {ctas}
            <p className="text-xs text-muted-foreground">{t("trust")}</p>
          </div>
          <div className="relative">
            {/* A soft emerald glow behind the phone. */}
            <div
              className="absolute inset-x-8 top-10 -z-10 h-3/4 rounded-full bg-hero-2/40 blur-3xl"
              aria-hidden
            />
            <PhoneFrame label={t("printLabel", { name: t("sections.dashboard.kicker") })}>
              <DashboardPrint />
            </PhoneFrame>
          </div>
        </section>

        <Feature
          id="lancamento"
          kicker={t("sections.quickAdd.kicker")}
          title={t("sections.quickAdd.title")}
          body={t("sections.quickAdd.body")}
          sample={t("sample")}
        >
          <PhoneFrame label={t("printLabel", { name: t("sections.quickAdd.kicker") })}>
            <QuickAddPrint />
          </PhoneFrame>
        </Feature>

        <Feature
          id="metas"
          kicker={t("sections.goals.kicker")}
          title={t("sections.goals.title")}
          body={t("sections.goals.body")}
          sample={t("sample")}
          reverse
        >
          <GoalsPrint />
        </Feature>

        <Feature
          id="cambio"
          kicker={t("sections.exchange.kicker")}
          title={t("sections.exchange.title")}
          body={t("sections.exchange.body")}
          sample={t("sample")}
        >
          <ExchangePrint />
        </Feature>

        <section
          id="recursos"
          className="mx-auto flex w-full max-w-6xl scroll-mt-24 flex-col gap-8 px-4 sm:px-6"
        >
          <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            {t("more.title")}
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {more.map(({ icon: Icon, key }) => (
              <li key={key} className="surface flex flex-col gap-3 p-5">
                <span className="flex size-10 items-center justify-center rounded-xl bg-brass/15 text-brass">
                  <Icon className="size-5" aria-hidden />
                </span>
                <h3 className="font-medium">{t(`more.${key}`)}</h3>
                <p className="text-sm text-pretty text-muted-foreground">{t(`more.${key}Hint`)}</p>
                {key === "app" && <InstallAppButton className="mt-1" />}
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="hero-card flex flex-col items-start gap-5 rounded-3xl px-6 py-10 sm:px-10 sm:py-14">
            <h2 className="text-3xl font-semibold tracking-tight text-balance text-brass-light sm:text-4xl">
              {t("final.title")}
            </h2>
            <p className="max-w-lg text-pretty text-hero-muted">{t("final.body")}</p>
            <Button asChild size="lg" className="h-12 px-6 text-base metal-brass">
              <Link href="/signup">{t("cta")}</Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}

function Feature({
  id,
  kicker,
  title,
  body,
  sample,
  reverse,
  children,
}: {
  id: string;
  kicker: string;
  title: string;
  body: string;
  sample: string;
  reverse?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="mx-auto grid w-full max-w-6xl scroll-mt-24 items-center gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16"
    >
      <div className={cn("flex flex-col gap-4", reverse && "lg:order-last")}>
        <span className="text-sm font-medium text-brass">{kicker}</span>
        <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h2>
        <p className="max-w-lg text-lg text-pretty text-muted-foreground">{body}</p>
      </div>
      <div className="relative flex flex-col items-center gap-3">
        {children}
        <span className="text-[11px] text-muted-foreground">{sample}</span>
      </div>
    </section>
  );
}
