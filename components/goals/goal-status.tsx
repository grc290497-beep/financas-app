import { useTranslations } from "next-intl";
import { CircleAlert, CircleCheck, Trophy } from "lucide-react";
import type { GoalStatus } from "@/lib/goals";
import { cn } from "@/lib/utils";

const STYLE = {
  on_track: { icon: CircleCheck, className: "text-positive" },
  behind: { icon: CircleAlert, className: "text-negative" },
  done: { icon: Trophy, className: "text-primary" },
} as const;

/** Status always shown as icon + label, never colour alone. */
export function GoalStatusBadge({ status }: { status: GoalStatus }) {
  const t = useTranslations("Goals.status");
  const { icon: Icon, className } = STYLE[status];
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", className)}>
      <Icon className="size-3.5" aria-hidden />
      {t(status)}
    </span>
  );
}

export function GoalProgress({ progress, color }: { progress: number; color: string }) {
  const percent = Math.max(0, Math.min(Math.round(progress * 100), 100));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className="h-2 w-full overflow-hidden rounded-full bg-muted"
    >
      <div
        className="grow-x h-full rounded-full"
        style={{ width: `${percent}%`, backgroundColor: color }}
      />
    </div>
  );
}
