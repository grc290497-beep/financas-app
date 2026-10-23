import { getTranslations } from "next-intl/server";
import { ArrowUpDown } from "lucide-react";
import { CategoryIcon } from "@/components/transactions/category-icon";
import { cn } from "@/lib/utils";

// Static "screenshots" of the app for the landing page, drawn with the app's
// own surfaces so they stay sharp and follow the theme. Figures are examples.

export function PhoneFrame({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="img"
      aria-label={label}
      className={cn(
        "relative mx-auto w-[280px] shrink-0 rounded-[2.75rem] bg-[oklch(0.13_0.02_168)] p-2.5 shadow-[0_40px_80px_-30px_oklch(0.1_0.05_168/0.75),inset_0_0_0_1px_oklch(1_0_0/0.1)]",
        className,
      )}
    >
      <div className="flex h-[560px] flex-col gap-3 overflow-hidden rounded-[2.25rem] bg-background px-3 pt-2 pb-3">
        <div className="mx-auto h-5 w-24 shrink-0 rounded-full bg-black/85" aria-hidden />
        {children}
      </div>
    </div>
  );
}

export async function DashboardPrint() {
  const t = await getTranslations("Landing.mock");
  return (
    <>
      <p className="px-1 text-lg font-semibold tracking-tight">{t("greeting")}</p>
      <div className="surface flex items-center justify-between p-1">
        <span className="raised-control size-7 rounded-lg" />
        <span className="text-xs font-semibold">{t("month")}</span>
        <span className="raised-control size-7 rounded-lg" />
      </div>
      <div className="hero-card flex flex-col gap-1 rounded-2xl px-4 py-4">
        <span className="text-[11px] text-hero-muted">{t("available")}</span>
        <span className="text-3xl font-semibold tracking-tight text-brass-light tabular-nums">
          € 2.184,30
        </span>
        <span className="text-[10px] text-hero-muted">{t("availableHint")}</span>
      </div>
      <div className="surface flex flex-col gap-2 p-3 text-[11px]">
        <span className="text-xs font-medium">{t("projection")}</span>
        <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-muted">
          <span className="w-[58%] bg-expense" />
          <span className="w-[12%] bg-hero-muted" />
          <span className="flex-1 bg-positive" />
        </div>
        <Row label={t("income")} value="€ 3.200,00" />
        <Row label={t("expenses")} value="€ 1.856,40" />
        <div className="flex justify-between border-t pt-2 font-medium">
          <span>{t("leftover")}</span>
          <span className="text-positive tabular-nums">€ 371,60</span>
        </div>
        <span className="text-[10px] text-muted-foreground">{t("perDay")}</span>
      </div>
      <div className="surface overflow-hidden text-[11px]">
        <div className="bg-muted/40 px-3 py-1.5 text-[10px] text-muted-foreground">
          {t("today")}
        </div>
        <PrintEntry icon="shopping-cart" color="#f97316" name={t("groceries")} value="− € 42,90" />
        <PrintEntry icon="coffee" color="#a855f7" name={t("coffee")} value="− € 3,20" />
      </div>
    </>
  );
}

export async function QuickAddPrint() {
  const t = await getTranslations("Landing.mock");
  const chips = [
    { icon: "shopping-cart", color: "#f97316", name: t("groceries"), selected: true },
    { icon: "utensils", color: "#ef4444", name: t("restaurants") },
    { icon: "party-popper", color: "#ec4899", name: t("leisure") },
    { icon: "bus", color: "#14b8a6", name: t("transport") },
    { icon: "dog", color: "#a855f7", name: t("pets") },
    { icon: "heart-pulse", color: "#e11d48", name: t("health") },
  ];
  return (
    <>
      {/* The page behind the sheet, dimmed. */}
      <div className="flex flex-col gap-2 opacity-40" aria-hidden>
        <div className="hero-card h-20 rounded-2xl" />
        <div className="surface h-16" />
      </div>
      <div className="-mx-3 mt-auto flex flex-col gap-3 rounded-t-3xl border-t bg-card px-4 pt-4 pb-1 shadow-[0_-20px_40px_-20px_oklch(0_0_0/0.5)]">
        <span className="text-sm font-semibold">{t("newEntry")}</span>
        <div className="sunken grid grid-cols-2 rounded-lg p-1 text-[11px] font-medium">
          <span className="raised-control rounded-md py-1 text-center">{t("expense")}</span>
          <span className="py-1 text-center text-muted-foreground">{t("incomeTab")}</span>
        </div>
        <div className="flex gap-2">
          <span className="flex-1 rounded-lg border px-3 py-2 text-xl font-semibold tabular-nums">
            42,90
          </span>
          <span className="sunken flex rounded-lg p-1 text-[10px] font-medium">
            <span className="raised-control rounded-md px-2 py-1.5">EUR</span>
            <span className="px-2 py-1.5 text-muted-foreground">BRL</span>
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <span
              key={chip.name}
              className={cn(
                "flex items-center gap-1.5 rounded-full py-1 pr-2.5 pl-1 text-[11px]",
                chip.selected
                  ? "bg-primary text-primary-foreground dark:metal-brass"
                  : "raised-control",
              )}
            >
              <CategoryIcon icon={chip.icon} color={chip.color} className="size-5 [&_svg]:size-3" />
              {chip.name}
            </span>
          ))}
        </div>
        <span className="rounded-lg bg-primary py-2 text-center text-xs font-medium text-primary-foreground dark:metal-brass">
          {t("save")}
        </span>
      </div>
    </>
  );
}

export async function GoalsPrint() {
  const t = await getTranslations("Landing.mock");
  return (
    <div className="flex w-full max-w-sm flex-col gap-3" role="img" aria-label={t("goalName")}>
      <GoalCard
        icon="plane"
        color="#0ea5e9"
        name={t("goalName")}
        status={t("goalStatus")}
        statusClass="bg-positive/15 text-positive"
        progress={62}
        of={t("goalOf")}
        detail={t("goalMonth")}
        footnote={t("goalEnd")}
      />
      <GoalCard
        icon="shield-check"
        color="#10b981"
        name={t("goal2Name")}
        status={t("goal2Status")}
        statusClass="bg-warning/15 text-warning"
        progress={40}
        of={t("goal2Of")}
        className="translate-x-6 opacity-80"
      />
    </div>
  );
}

export async function ExchangePrint() {
  const t = await getTranslations("Landing.mock");
  // A hand-drawn three-month line, falling slightly like the example says.
  const points = [32, 28, 30, 22, 26, 18, 24, 20, 30, 34, 38, 36, 42, 40, 46];
  const path = points.map((y, i) => `${i === 0 ? "M" : "L"}${i * 20},${y}`).join(" ");
  return (
    <div className="flex w-full max-w-sm flex-col gap-3" role="img" aria-label={t("chartTitle")}>
      <div className="hero-card flex flex-col gap-3 rounded-3xl p-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-brass-light ring-1 ring-brass-light/30">
            €
          </span>
          <span className="flex-1 text-sm font-medium">EUR</span>
          <span className="text-2xl font-semibold tabular-nums">100</span>
        </div>
        <div className="relative h-px bg-white/15">
          <span className="absolute top-1/2 left-1/2 flex size-8 -translate-1/2 items-center justify-center rounded-full metal-brass">
            <ArrowUpDown className="size-4" aria-hidden />
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-brass-light ring-1 ring-brass-light/30">
            R$
          </span>
          <span className="flex-1 text-sm font-medium">BRL</span>
          <span className="text-2xl font-semibold text-brass-light tabular-nums">565,74</span>
        </div>
        <p className="rounded-xl bg-black/15 px-3 py-2 text-[11px] text-hero-muted">
          {t("rate")} · {t("rateSource")}
        </p>
      </div>
      <div className="surface flex flex-col gap-2 p-4">
        <div className="flex items-baseline justify-between text-xs">
          <span className="font-medium">{t("chartTitle")}</span>
          <span className="text-muted-foreground">{t("change")}</span>
        </div>
        <svg viewBox="0 0 280 60" className="h-16 w-full" aria-hidden>
          <defs>
            <linearGradient id="landing-fx" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--brass)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--brass)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${path} L280,60 L0,60 Z`} fill="url(#landing-fx)" />
          <path d={path} fill="none" stroke="var(--brass)" strokeWidth="2" />
        </svg>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="text-foreground tabular-nums">{value}</span>
    </div>
  );
}

function PrintEntry({
  icon,
  color,
  name,
  value,
}: {
  icon: string;
  color: string;
  name: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 border-t px-3 py-2">
      <CategoryIcon icon={icon} color={color} className="size-7 [&_svg]:size-3.5" />
      <span className="flex-1">{name}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

function GoalCard({
  icon,
  color,
  name,
  status,
  statusClass,
  progress,
  of,
  detail,
  footnote,
  className,
}: {
  icon: string;
  color: string;
  name: string;
  status: string;
  statusClass: string;
  progress: number;
  of: string;
  detail?: string;
  footnote?: string;
  className?: string;
}) {
  return (
    <div className={cn("surface flex flex-col gap-3 p-4", className)}>
      <div className="flex items-center gap-3">
        <CategoryIcon icon={icon} color={color} />
        <div className="flex flex-col">
          <span className="text-sm font-medium">{name}</span>
          <span className={cn("self-start rounded-full px-2 py-0.5 text-[10px]", statusClass)}>
            {status}
          </span>
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <span
          className="block h-full rounded-full"
          style={{ width: `${progress}%`, backgroundColor: color }}
        />
      </div>
      <div className="flex flex-wrap justify-between gap-1 text-xs">
        <span className="tabular-nums">{of}</span>
        {detail && <span className="text-muted-foreground">{detail}</span>}
      </div>
      {footnote && <span className="text-[11px] text-muted-foreground">{footnote}</span>}
    </div>
  );
}
