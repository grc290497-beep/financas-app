"use client";

import { cn } from "@/lib/utils";

/** A small one-of-many toggle (Gasto/Entrada, EUR/BRL). */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("sunken inline-flex h-10 shrink-0 rounded-lg p-1", className)}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            "flex-1 rounded-md px-3 text-sm font-medium transition-[transform,color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97]",
            option.value === value
              ? "raised-control text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
