"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { LogOut, Settings } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { Avatar } from "@/components/nav/avatar";
import { signOut } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

/**
 * The avatar opens a small account menu: who is signed in, Ajustes and Sair.
 * `children` replaces the default trigger content (the sidebar shows the name too).
 */
export function AccountMenu({
  name,
  email,
  initial,
  side = "bottom",
  className,
  children,
}: {
  name: string;
  email: string;
  initial: string;
  side?: "top" | "bottom";
  className?: string;
  children?: React.ReactNode;
}) {
  const t = useTranslations("Nav");
  const common = useTranslations("Common");
  const item =
    "flex h-10 cursor-pointer items-center gap-2.5 rounded-lg px-3 text-sm outline-none transition-colors data-[highlighted]:bg-accent";

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={t("account")}
        className={cn(
          "rounded-full outline-none transition-transform duration-150 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96]",
          className,
        )}
      >
        {children ?? <Avatar initial={initial} className="size-9" />}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side={side}
          align={side === "top" ? "start" : "end"}
          sideOffset={8}
          className="surface z-50 w-60 origin-[var(--radix-dropdown-menu-content-transform-origin)] p-1.5 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <div className="flex items-center gap-3 px-3 py-2.5">
            <Avatar initial={initial} />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium">{name}</span>
              <span className="truncate text-xs text-muted-foreground">{email}</span>
            </div>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item asChild>
            <Link href="/app/settings" className={item}>
              <Settings className="size-4 text-muted-foreground" aria-hidden />
              {t("settings")}
            </Link>
          </DropdownMenu.Item>
          {/* Sign out is a form post (Server Action); the item only submits it. */}
          <form action={signOut}>
            <DropdownMenu.Item asChild>
              <button type="submit" className={cn(item, "w-full text-destructive")}>
                <LogOut className="size-4" aria-hidden />
                {common("signOut")}
              </button>
            </DropdownMenu.Item>
          </form>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
