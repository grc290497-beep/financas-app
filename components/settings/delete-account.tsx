"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteAccount } from "@/lib/actions/account";
import { DELETE_ACCOUNT_WORD } from "@/lib/validators";

/** Typed confirmation, because deleting the account erases every row for good. */
export function DeleteAccount() {
  const t = useTranslations("Settings");
  const [pending, startTransition] = useTransition();
  const [confirmation, setConfirmation] = useState("");

  return (
    <Dialog onOpenChange={() => setConfirmation("")}>
      <DialogTrigger asChild>
        <Button variant="outline" className="self-start text-destructive">
          {t("delete.button")}
        </Button>
      </DialogTrigger>
      <DialogContent showCloseButton={false}>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              // Redirects on success, so only errors come back.
              const result = await deleteAccount({ confirmation });
              if (result?.status === "error") {
                toast.error(t(`errors.${result.error}` as Parameters<typeof t>[0]));
              }
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("delete.title")}</DialogTitle>
            <DialogDescription>{t("delete.description")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="delete-confirmation">
              {t("delete.typeToConfirm", { word: DELETE_ACCOUNT_WORD })}
            </Label>
            <Input
              id="delete-confirmation"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                {t("delete.cancel")}
              </Button>
            </DialogClose>
            <Button
              type="submit"
              variant="destructive"
              disabled={pending || confirmation !== DELETE_ACCOUNT_WORD}
            >
              {pending ? t("delete.deleting") : t("delete.confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
