import { getRequestConfig } from "next-intl/server";

// Single locale for v1; locale routing comes with the English version (PLAN.md backlog).
export const defaultLocale = "pt-BR";

export default getRequestConfig(async () => {
  const locale = defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
