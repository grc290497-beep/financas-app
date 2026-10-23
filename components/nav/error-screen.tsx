import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";

/** Shared look of the 404 and error pages: logo, a big code, the message, actions. */
export function ErrorScreen({
  appName,
  code,
  title,
  body,
  children,
}: {
  appName: string;
  code: string;
  title: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <Logo name={appName} size={36} className="text-lg" />
      <p className="privacy-safe text-7xl font-semibold tracking-tight text-brass-dark tabular-nums dark:text-brass">
        {code}
      </p>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
        <p className="text-pretty text-muted-foreground">{body}</p>
      </div>
      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">{children}</div>
    </main>
  );
}
