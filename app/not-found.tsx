import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ErrorScreen } from "@/components/nav/error-screen";
import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const [t, common] = await Promise.all([getTranslations("ErrorPages"), getTranslations("Common")]);

  return (
    <ErrorScreen
      appName={common("appName")}
      code="404"
      title={t("notFoundTitle")}
      body={t("notFoundBody")}
    >
      <Button asChild size="lg">
        <Link href="/app">{t("openApp")}</Link>
      </Button>
      <Button asChild size="lg" variant="outline">
        <Link href="/">{t("home")}</Link>
      </Button>
    </ErrorScreen>
  );
}
