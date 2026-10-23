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
    "raised-control flex size-11 shrink-0 items-center justify-center rounded-xl text-foreground transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-accent active:translate-y-px active:scale-[0.97]";

  // Full width, like the cards below it, so the page reads as one column.
  return (
    <nav
      className={cn("surface flex w-full items-center gap-2 p-1.5", className)}
      aria-label={label}
    >
      <Link href={previousHref} scroll={false} aria-label={previousLabel} className={arrow}>
        <ChevronLeft className="size-5" aria-hidden />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col items-center leading-tight">
        <span
          className="truncate text-base font-semibold tabular-nums first-letter:uppercase"
          aria-live="polite"
        >
          {label}
        </span>
        {currentHref && currentLabel && (
          <Link
            href={currentHref}
            scroll={false}
            className="text-xs font-medium text-primary underline-offset-4 hover:underline"
          >
            {currentLabel}
          </Link>
        )}
      </div>
      <Link href={nextHref} scroll={false} aria-label={nextLabel} className={arrow}>
        <ChevronRight className="size-5" aria-hidden />
      </Link>
    </nav>
  );
}
