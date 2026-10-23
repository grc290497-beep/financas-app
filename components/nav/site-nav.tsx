"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { InstallAppButton } from "@/components/pwa/install-app";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SiteSection = { id: string; label: string };

type Labels = { nav: string; login: string; signup: string; menu: string };

/**
 * The public navbar's links. On the landing page the link of the section on
 * screen is marked, with a pill that slides between links (a chip by the logo
 * on phones); on /login and /signup their button is marked instead.
 */
export function SiteNav({ sections, labels }: { sections: SiteSection[]; labels: Labels }) {
  const pathname = usePathname();
  const onLanding = pathname === "/";
  const active = useSectionOnScreen(onLanding ? sections.map((s) => s.id) : []);
  const activeLabel = sections.find((s) => s.id === active)?.label;

  const navRef = useRef<HTMLElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);
  // Measure before paint so the pill never shows in the wrong place.
  useLayoutEffect(() => {
    const link = navRef.current?.querySelector<HTMLElement>(`[data-section="${active}"]`);
    setPill(link ? { left: link.offsetLeft, width: link.offsetWidth } : null);
  }, [active]);

  const menuRef = useRef<HTMLDetailsElement>(null);
  const closeMenu = () => menuRef.current?.removeAttribute("open");

  const linkClass = (id: string) =>
    cn(
      "relative z-10 rounded-lg px-3 py-2 text-sm transition-colors duration-200",
      active === id ? "text-foreground" : "text-muted-foreground hover:text-foreground",
    );

  return (
    <>
      {/* Phones: which part of the page this is, by the logo. */}
      {activeLabel && (
        <span
          key={activeLabel}
          className="animate-section-chip rounded-full bg-accent px-2.5 py-1 text-xs font-medium md:hidden"
          aria-hidden
        >
          {activeLabel}
        </span>
      )}

      <nav
        ref={navRef}
        aria-label={labels.nav}
        className="relative hidden flex-1 items-center gap-1 md:flex"
      >
        {pill && (
          <span
            aria-hidden
            className="absolute inset-y-0 my-auto h-9 rounded-lg bg-accent transition-[transform,width] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]"
            style={{ width: pill.width, transform: `translateX(${pill.left}px)` }}
          />
        )}
        {sections.map((s) => (
          <Link
            key={s.id}
            href={`/#${s.id}`}
            data-section={s.id}
            aria-current={active === s.id ? "location" : undefined}
            className={linkClass(s.id)}
          >
            {s.label}
          </Link>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <InstallAppButton variant="ghost" size="sm" className="hidden md:inline-flex" />
        <Button
          asChild
          variant="ghost"
          size="sm"
          className={cn(pathname === "/login" && "bg-accent text-foreground")}
        >
          <Link href="/login" aria-current={pathname === "/login" ? "page" : undefined}>
            {labels.login}
          </Link>
        </Button>
        <Button
          asChild
          size="sm"
          className={cn(
            "hidden sm:inline-flex",
            pathname === "/signup" && "ring-2 ring-ring ring-offset-2 ring-offset-background",
          )}
        >
          <Link href="/signup" aria-current={pathname === "/signup" ? "page" : undefined}>
            {labels.signup}
          </Link>
        </Button>

        {/* Phones: the section links fold into a menu. */}
        <details ref={menuRef} className="group relative md:hidden">
          <summary
            className="flex size-9 cursor-pointer list-none items-center justify-center rounded-lg raised-control [&::-webkit-details-marker]:hidden"
            aria-label={labels.menu}
          >
            <Menu className="size-4" aria-hidden />
          </summary>
          <nav
            aria-label={labels.nav}
            className="surface absolute top-11 right-0 flex w-56 flex-col p-2"
          >
            {sections.map((s) => (
              <Link
                key={s.id}
                href={`/#${s.id}`}
                onClick={closeMenu}
                aria-current={active === s.id ? "location" : undefined}
                className={cn(
                  "flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
                  active === s.id
                    ? "bg-accent font-medium text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {s.label}
                {active === s.id && (
                  <span className="size-1.5 rounded-full bg-primary" aria-hidden />
                )}
              </Link>
            ))}
            <Button asChild size="sm" className="mt-2">
              <Link href="/signup" onClick={closeMenu}>
                {labels.signup}
              </Link>
            </Button>
            <InstallAppButton variant="outline" size="sm" className="mt-2 self-stretch" />
          </nav>
        </details>
      </div>
    </>
  );
}

/** The id of the section crossing the middle band of the screen. */
function useSectionOnScreen(ids: string[]) {
  const [active, setActive] = useState<string | null>(null);
  const key = ids.join(",");

  useEffect(() => {
    const elements = key
      .split(",")
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el);
    if (!elements.length) {
      const timer = setTimeout(() => setActive(null));
      return () => clearTimeout(timer);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length) setActive(visible[0].target.id);
      },
      // A thin band a bit above the middle: one section at a time.
      { rootMargin: "-40% 0px -55% 0px" },
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [key]);

  return active;
}
