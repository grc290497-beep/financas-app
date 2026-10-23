"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ErrorScreen } from "@/components/nav/error-screen";
import { Button } from "@/components/ui/button";

/** Any page that throws lands here, inside the root layout (header, theme, footer). */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("ErrorPages");
  const common = useTranslations("Common");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorScreen
      appName={common("appName")}
      code=":("
      title={t("errorTitle")}
      body={t("errorBody")}
    >
      <Button size="lg" onClick={reset}>
        {t("retry")}
      </Button>
      <Button asChild size="lg" variant="outline">
        <Link href="/app">{t("openApp")}</Link>
      </Button>
    </ErrorScreen>
  );
}
