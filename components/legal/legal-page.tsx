import { getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/nav/site-header";

type LegalSection = { title: string; paragraphs: string[] };

/** Privacy policy and terms: plain sections kept in messages/pt-BR.json. */
export async function LegalPage({ namespace }: { namespace: "Legal.privacy" | "Legal.terms" }) {
  const [t, common] = await Promise.all([getTranslations(namespace), getTranslations("Legal")]);
  const sections = t.raw("sections") as LegalSection[];

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{common("updated")}</p>
        </header>
        {sections.map((section) => (
          <section key={section.title} className="flex flex-col gap-2">
            <h2 className="text-lg font-medium">{section.title}</h2>
            {section.paragraphs.map((p) => (
              <p key={p} className="text-pretty text-muted-foreground">
                {p}
              </p>
            ))}
          </section>
        ))}
      </main>
    </>
  );
}
