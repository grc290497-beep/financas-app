import { cn } from "@/lib/utils";

/** The account's initial on a brass coin (header, sidebar). */
export function Avatar({ initial, className }: { initial: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full metal-brass text-sm font-semibold uppercase",
        className,
      )}
    >
      {initial}
    </span>
  );
}
