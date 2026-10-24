"use client";

import { useRef, useState, type PointerEvent } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { deleteTransaction } from "@/lib/actions/transactions";
import type { Category } from "@/lib/categories";
import { formatAmountInput, formatMoney } from "@/lib/money";
import type { TransactionRow } from "@/lib/transactions";
import { cn } from "@/lib/utils";
import type { Currency } from "@/lib/validators";
import { CategoryIcon } from "./category-icon";
import { TransactionForm } from "./transaction-form";

/** A row in the list; tapping it opens the edit sheet. */
export function TransactionItem({
  row,
  primaryCurrency,
  categories,
  usage,
  compact,
}: {
  compact?: boolean;
  row: TransactionRow;
  primaryCurrency: Currency;
  categories: Category[];
  usage: Record<string, number>;
}) {
  const t = useTranslations("Transactions");
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const sign = row.type === "income" ? "+" : "−";
  const planned = row.status === "planned";
  // "Salario · Salário" says the same thing twice; only name the category when it adds something.
  const showCategory =
    !!row.description &&
    row.description.localeCompare(row.category.name, "pt-BR", { sensitivity: "base" }) !== 0;

  // Undo instead of "are you sure?": the row hides at once and the delete only
  // runs when the toast closes without "Desfazer".
  const deleteWithUndo = () => {
    setOpen(false);
    setHidden(true);
    let settled = false;
    const commit = async () => {
      if (settled) return;
      settled = true;
      const result = await deleteTransaction(row.id);
      if (result.status === "error") {
        setHidden(false);
        toast.error(t(`errors.${result.error}` as Parameters<typeof t>[0]));
      }
    };
    toast(t("form.deleted"), {
      duration: 5000,
      action: {
        label: t("undo"),
        onClick: () => {
          settled = true;
          setHidden(false);
        },
      },
      onAutoClose: commit,
      onDismiss: commit,
    });
  };

  // Swipe left to delete (touch only; goal entries also remove a contribution,
  // so they keep the dialog in the edit sheet).
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const swipe = useRef<{ x: number; y: number; at: number; active: boolean } | null>(null);
  const swiped = useRef(false);

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === "mouse" || row.goalLinked) return;
    swipe.current = { x: e.clientX, y: e.clientY, at: performance.now(), active: false };
  };
  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const s = swipe.current;
    if (!s) return;
    const moveX = e.clientX - s.x;
    const moveY = e.clientY - s.y;
    if (!s.active) {
      if (Math.abs(moveY) > 10)
        swipe.current = null; // a vertical scroll
      else if (moveX < -10 && Math.abs(moveX) > Math.abs(moveY)) {
        s.active = true;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // The pointer is already gone; the swipe still works without capture.
        }
        setDragging(true);
      }
      return;
    }
    setDx(Math.min(0, moveX));
  };
  const onPointerEnd = () => {
    const s = swipe.current;
    swipe.current = null;
    if (!s?.active) return;
    swiped.current = true;
    setDragging(false);
    // Far enough, or a quick flick: delete (with Desfazer). Otherwise snap back.
    const velocity = dx / (performance.now() - s.at);
    setDx(0);
    if (dx < -110 || (dx < -40 && velocity < -0.5)) deleteWithUndo();
  };

  if (hidden) return null;

  return (
    <div className="relative overflow-hidden">
      {(dragging || dx < 0) && (
        <div
          aria-hidden
          className="absolute inset-0 flex items-center justify-end gap-2 bg-destructive px-5 text-sm font-medium text-white"
        >
          <Trash2 className="size-4" />
          {t("form.delete")}
        </div>
      )}
      <button
        type="button"
        onClick={() => {
          // The click that ends a swipe is not a tap.
          if (swiped.current) {
            swiped.current = false;
            return;
          }
          setOpen(true);
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined }}
        className={cn(
          "relative flex w-full touch-pan-y items-center gap-3 bg-card px-4 text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
          !dragging &&
            "transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
          compact ? "py-2.5" : "py-3.5",
        )}
      >
        <CategoryIcon
          icon={row.category.icon}
          color={row.category.color}
          className={compact ? "size-8" : undefined}
        />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate font-medium">{row.description || row.category.name}</span>
          {(showCategory || planned) && (
            <span className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
              {planned && (
                <span className="shrink-0 rounded-full bg-muted px-2 py-px text-[11px] font-medium">
                  {t("planned")}
                </span>
              )}
              {showCategory && <span className="truncate">{row.category.name}</span>}
            </span>
          )}
        </span>
        <span className="flex shrink-0 flex-col items-end">
          <span
            className={cn(
              "font-medium tabular-nums",
              row.type === "income" && "text-positive",
              planned && "text-muted-foreground",
            )}
          >
            {sign} {formatMoney(row.amountCents, row.currency)}
          </span>
          {row.currency !== primaryCurrency && (
            <span className="text-xs text-muted-foreground tabular-nums">
              ≈ {formatMoney(row.amountPrimaryCents, primaryCurrency)}
            </span>
          )}
        </span>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="mx-auto max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl pb-0"
        >
          <SheetHeader className="pb-0">
            <SheetTitle>{t("edit")}</SheetTitle>
          </SheetHeader>
          <div className="px-4">
            {open && (
              <TransactionForm
                categories={categories}
                usage={usage}
                primaryCurrency={primaryCurrency}
                today={row.occurredOn}
                initial={{
                  id: row.id,
                  type: row.type,
                  amount: formatAmountInput(row.amountCents),
                  currency: row.currency,
                  categoryId: row.categoryId,
                  occurredOn: row.occurredOn,
                  description: row.description ?? "",
                  fxRate: row.fxRate,
                  goalLinked: row.goalLinked,
                }}
                onDone={() => setOpen(false)}
                onDelete={deleteWithUndo}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
