"use client";

import type { Category } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "./category-icon";

export function CategoryChips({
  label,
  categories,
  value,
  onChange,
}: {
  label: string;
  categories: Category[];
  value: string | undefined;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
      {categories.map((category) => {
        const selected = category.id === value;
        return (
          <button
            key={category.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(category.id)}
            className={cn(
              "flex h-10 items-center gap-2 rounded-full pr-3 pl-1 text-sm transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:translate-y-px active:scale-[0.97]",
              selected
                ? "bg-primary text-primary-foreground shadow-[inset_0_1px_0_oklch(1_0_0/0.18),0_4px_10px_-6px_oklch(0_0_0/0.5)] dark:metal-brass"
                : "raised-control hover:bg-accent",
            )}
          >
            <CategoryIcon icon={category.icon} color={category.color} className="size-8" />
            {category.name}
          </button>
        );
      })}
    </div>
  );
}
