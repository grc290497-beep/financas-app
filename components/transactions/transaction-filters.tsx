"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { addMonths, format, parse } from "date-fns";
import { Search, X } from "lucide-react";
import { MonthSwitcher } from "@/components/nav/month-switcher";
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
import { cn } from "@/lib/utils";
import { CURRENCIES, TRANSACTION_TYPES, type TransactionFilters } from "@/lib/validators";

const ALL = "all";

export function TransactionFiltersBar({
  month,
  periodLabel,
  filters,
  categories,
}: {
  /** yyyy-MM the shown financial month starts in. */
  month: string;
  periodLabel: string;
  filters: TransactionFilters;
  categories: Category[];
}) {
  const t = useTranslations("Transactions");
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(filters.q ?? "");

  const href = (changes: Partial<Record<keyof TransactionFilters, string | undefined>>) => {
    const next = { ...filters, month, ...changes };
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(next)) {
      if (value && value !== ALL) params.set(key, value);
    }
    return `${pathname}?${params.toString()}`;
  };
  const navigate = (changes: Parameters<typeof href>[0]) =>
    startTransition(() => router.replace(href(changes), { scroll: false }));

  // Search as you type, without a request per keystroke.
  useEffect(() => {
    if ((filters.q ?? "") === query.trim()) return;
    const timer = setTimeout(() => navigate({ q: query.trim() || undefined }), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- navigate is recreated each render
  }, [query]);

  const monthDate = parse(`${month}-01`, "yyyy-MM-dd", new Date());
  const monthHref = (delta: number) =>
    href({ month: format(addMonths(monthDate, delta), "yyyy-MM") });
  const hasFilters = Boolean(filters.type || filters.currency || filters.category || filters.q);

  return (
    <div className="flex flex-col gap-3" aria-busy={pending}>
      <MonthSwitcher
        label={periodLabel}
        previousHref={monthHref(-1)}
        nextHref={monthHref(1)}
        previousLabel={t("filters.previousMonth")}
        nextLabel={t("filters.nextMonth")}
      />

      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("filters.search")}
          aria-label={t("filters.search")}
          className="h-11 rounded-full pl-10"
          maxLength={60}
        />
      </div>

      {/* Chips scroll sideways on small screens instead of squeezing three selects. */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        <FilterChip
          label={t("filters.type")}
          value={filters.type ?? ALL}
          onChange={(type) => navigate({ type })}
          options={[
            { value: ALL, label: t("filters.allTypes") },
            ...TRANSACTION_TYPES.map((type) => ({ value: type, label: t(`form.${type}`) })),
          ]}
        />
        <FilterChip
          label={t("filters.category")}
          value={filters.category ?? ALL}
          onChange={(category) => navigate({ category })}
          options={[
            { value: ALL, label: t("filters.allCategories") },
            ...categories.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
        <FilterChip
          label={t("filters.currency")}
          value={filters.currency ?? ALL}
          onChange={(currency) => navigate({ currency })}
          options={[
            { value: ALL, label: t("filters.allCurrencies") },
            ...CURRENCIES.map((currency) => ({ value: currency, label: currency })),
          ]}
        />
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 shrink-0 rounded-full"
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
    </div>
  );
}

function FilterChip({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  const active = value !== ALL;
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        aria-label={label}
        className={cn(
          "surface h-9! w-auto shrink-0 gap-1.5 rounded-full! border-0 px-3.5 text-sm",
          active && "ring-1 ring-brass/70",
        )}
      >
        <span className="text-muted-foreground">{label}:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
