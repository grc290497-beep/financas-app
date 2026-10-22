import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Period } from "@/lib/period";
import { cn } from "@/lib/utils";

/** "outubro de 2026" for calendar months, "25/10 a 24/11" when the month starts mid-month. */
export function periodLabel(period: Period, monthStartDay: number) {
  return monthStartDay === 1
    ? format(parseISO(period.start), "MMMM 'de' yyyy", { locale: ptBR })
    : `${format(parseISO(period.start), "dd/MM")} a ${format(parseISO(period.end), "dd/MM")}`;
}

/** The period pill shared by Início, Lançamentos and Relatórios: ‹ label › */
export function MonthSwitcher({
  label,
  previousHref,
  nextHref,
  previousLabel,
  nextLabel,
  currentHref,
  currentLabel,
  className,
}: {
  label: string;
  previousHref: string;
  nextHref: string;
  previousLabel: string;
  nextLabel: string;
  /** Shown as a "back to current" link when the user moved away from it. */
  currentHref?: string;
  currentLabel?: string;
  className?: string;
}) {
  const arrow =
    "flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:translate-y-px active:scale-[0.97]";

  return (
    <nav className={cn("flex items-center gap-3", className)} aria-label={label}>
      <div className="surface flex items-center gap-1 rounded-full! p-1">
        <Link href={previousHref} scroll={false} aria-label={previousLabel} className={arrow}>
          <ChevronLeft className="size-4" aria-hidden />
        </Link>
        <span
          className="min-w-32 px-1 text-center text-sm font-medium tabular-nums first-letter:uppercase"
          aria-live="polite"
        >
          {label}
        </span>
        <Link href={nextHref} scroll={false} aria-label={nextLabel} className={arrow}>
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
      {currentHref && currentLabel && (
        <Link
          href={currentHref}
          scroll={false}
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {currentLabel}
        </Link>
      )}
    </nav>
  );
}
