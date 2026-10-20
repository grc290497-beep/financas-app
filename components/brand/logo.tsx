import { markDataUri } from "./mark";
import { cn } from "@/lib/utils";

const MARK = markDataUri();

/** The mark, plus the wordmark when `name` is given (Common.appName). */
export function Logo({
  name,
  size = 28,
  className,
}: {
  name?: string;
  size?: number;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- inline SVG data URI, nothing to optimise */}
      <img
        src={MARK}
        alt={name ? "" : "Finanças"}
        width={size}
        height={size}
        className="shrink-0 rounded-[22%] shadow-[0_4px_12px_-4px_oklch(0.25_0.06_168/0.6)]"
      />
      {name && <span className="font-semibold tracking-tight">{name}</span>}
    </span>
  );
}
