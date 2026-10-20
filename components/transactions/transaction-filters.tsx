"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { addMonths, format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Category } from "@/lib/categories";
import { CURRENCIES, TRANSACTION_TYPES, type TransactionFilters } from "@/lib/validators";

const ALL = "all";

export function TransactionFiltersBar({
  month,
  filters,
  categories,
}: {
  month: string;
  filters: TransactionFilters;
  categories: Category[];
}) {
  const t = useTranslations("Transactions");
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(filters.q ?? "");

  const navigate = (changes: Partial<Record<keyof TransactionFilters, string | undefined>>) => {
    const next = { ...filters, month, ...changes };
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(next)) {
      if (value && value !== ALL) params.set(key, value);
    }
    startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
  };

  // Search as you type, without a request per keystroke.
  useEffect(() => {
    if ((filters.q ?? "") === query.trim()) return;
    const timer = setTimeout(() => navigate({ q: query.trim() || undefined }), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- navigate is recreated each render
  }, [query]);

  const monthDate = parse(`${month}-01`, "yyyy-MM-dd", new Date());
  const shiftMonth = (delta: number) =>
    navigate({ month: format(addMonths(monthDate, delta), "yyyy-MM") });
  const hasFilters = Boolean(filters.type || filters.currency || filters.category || filters.q);

  return (
    <div className="flex flex-col gap-3" aria-busy={pending}>
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => shiftMonth(-1)}
          aria-label={t("filters.previousMonth")}
        >
          <ChevronLeft aria-hidden />
        </Button>
        <p className="text-base font-medium first-letter:uppercase" aria-live="polite">
          {format(monthDate, "MMMM 'de' yyyy", { locale: ptBR })}
        </p>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => shiftMonth(1)}
          aria-label={t("filters.nextMonth")}
        >
          <ChevronRight aria-hidden />
        </Button>
      </div>

      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("filters.search")}
          aria-label={t("filters.search")}
          className="pl-9"
          maxLength={60}
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Select value={filters.type ?? ALL} onValueChange={(type) => navigate({ type })}>
          <SelectTrigger className="w-full" aria-label={t("filters.type")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("filters.allTypes")}</SelectItem>
            {TRANSACTION_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {t(`form.${type}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.currency ?? ALL}
          onValueChange={(currency) => navigate({ currency })}
        >
          <SelectTrigger className="w-full" aria-label={t("filters.currency")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("filters.allCurrencies")}</SelectItem>
            {CURRENCIES.map((currency) => (
              <SelectItem key={currency} value={currency}>
                {currency}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.category ?? ALL}
          onValueChange={(category) => navigate({ category })}
        >
          <SelectTrigger className="w-full" aria-label={t("filters.category")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("filters.allCategories")}</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => {
            setQuery("");
            navigate({ type: undefined, currency: undefined, category: undefined, q: undefined });
          }}
        >
          <X aria-hidden />
          {t("filters.clear")}
        </Button>
      )}
    </div>
  );
}
