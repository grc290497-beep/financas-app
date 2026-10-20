"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteContribution, deleteGoal, setGoalStatus } from "@/lib/actions/goals";

/** Mark done / reopen, archive and delete for a goal's detail page. */
export function GoalActions({ goalId, done }: { goalId: string; done: boolean }) {
  const t = useTranslations("Goals");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const run = (action: () => Promise<{ status: string; error?: string }>, success?: string) =>
    startTransition(async () => {
      const result = await action();
      if (result.status === "error") {
        toast.error(t(`errors.${result.error}` as Parameters<typeof t>[0]));
        return;
      }
      if (success) toast.success(success);
    });

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => run(() => setGoalStatus(goalId, done ? "active" : "done"))}
      >
        {done ? t("reopen") : t("markDone")}
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          run(async () => {
            const result = await setGoalStatus(goalId, "archived");
            if (result.status === "ok") router.push("/app/goals");
            return result;
          }, t("archived"))
        }
      >
        {t("archive")}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="text-destructive"
        disabled={pending}
        onClick={() => setConfirmDelete(true)}
      >
        {t("form.delete")}
      </Button>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t("delete.title")}</DialogTitle>
            <DialogDescription>{t("delete.description")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t("delete.cancel")}</Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => run(() => deleteGoal(goalId))}
            >
              {t("delete.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function DeleteContributionButton({ id, dateLabel }: { id: string; dateLabel: string }) {
  const t = useTranslations("Goals");
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      disabled={pending}
      aria-label={t("deleteContribution", { date: dateLabel })}
      onClick={() =>
        startTransition(async () => {
          const result = await deleteContribution(id);
          if (result.status === "error") {
            toast.error(t(`errors.${result.error}` as Parameters<typeof t>[0]));
            return;
          }
          toast.success(t("contributionDeleted"));
        })
      }
    >
      <Trash2 aria-hidden />
    </Button>
  );
}
