import { getTranslations } from "next-intl/server";
import { Download, FileJson } from "lucide-react";
import { Button } from "@/components/ui/button";

/** CSV and JSON downloads (app/(app)/app/reports/export/route.ts). */
export async function ExportLinks() {
  const t = await getTranslations("Reports");

  return (
    <div className="flex flex-wrap gap-2">
      {/* Plain links: the route handler answers with a file download. */}
      <Button asChild variant="outline">
        <a href="/app/reports/export?format=csv" download>
          <Download aria-hidden />
          {t("exportCsv")}
        </a>
      </Button>
      <Button asChild variant="outline">
        <a href="/app/reports/export?format=json" download>
          <FileJson aria-hidden />
          {t("exportJson")}
        </a>
      </Button>
    </div>
  );
}
