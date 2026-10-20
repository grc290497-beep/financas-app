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
              "flex h-10 items-center gap-2 rounded-full border pr-3 pl-1 text-sm transition-colors",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-background hover:bg-muted",
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
