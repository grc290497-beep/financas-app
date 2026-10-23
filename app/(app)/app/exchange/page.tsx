import { Suspense } from "react";
import { cacheLife } from "next/cache";
import { getTranslations } from "next-intl/server";
import { CloudOff } from "lucide-react";
import { ExchangeView } from "@/components/exchange/exchange-view";
import { Skeleton } from "@/components/ui/skeleton";
import { requireProfile } from "@/lib/auth";
import { addMonths } from "@/lib/dates";
import { fetchFrankfurterEurBrlSeries } from "@/lib/fx";
import { currentDate } from "@/lib/transactions";

export default async function ExchangePage() {
  const t = await getTranslations("Exchange");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 lg:max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <Suspense fallback={<ExchangeSkeleton />}>
        <Exchange />
      </Suspense>
    </main>
  );
}

/** A year of daily closes, shared by every user and refetched every few hours. */
async function yearOfRates(today: string) {
  "use cache";
  cacheLife("hours");
  return fetchFrankfurterEurBrlSeries(addMonths(today, -12), today);
}

async function Exchange() {
  // Profile first: it resolves the session (request time) before anything else.
  await requireProfile();
  const [today, t] = await Promise.all([currentDate(), getTranslations("Exchange")]);

  let series: Awaited<ReturnType<typeof yearOfRates>> | null = null;
  try {
    series = await yearOfRates(today);
  } catch {
    series = null;
  }

  if (!series?.length) {
    return (
      <section className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
        <CloudOff className="size-10 text-muted-foreground" aria-hidden />
        <h2 className="text-lg font-medium">{t("unavailableTitle")}</h2>
        <p className="max-w-sm text-sm text-pretty text-muted-foreground">
          {t("unavailableDescription")}
        </p>
      </section>
    );
  }

  return <ExchangeView series={series} today={today} />;
}

function ExchangeSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <Skeleton className="h-40 w-full rounded-3xl" />
      <Skeleton className="h-72 w-full rounded-2xl" />
    </div>
  );
}
