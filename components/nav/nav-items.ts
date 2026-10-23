import {
  ArrowLeftRight,
  CalendarClock,
  ChartColumn,
  Gauge,
  House,
  ReceiptText,
  Tags,
  Target,
  type LucideIcon,
} from "lucide-react";

// Shared by the client nav (app-nav.tsx) and server pages (Mais), so no "use client".

export type NavLabel =
  | "home"
  | "transactions"
  | "goals"
  | "reports"
  | "fixed"
  | "budget"
  | "exchange"
  | "categories"
  | "settings"
  | "more";
export type NavItem = { href: string; label: NavLabel; icon: LucideIcon; exact?: boolean };

export const HOME: NavItem = { href: "/app", label: "home", icon: House, exact: true };
export const TRANSACTIONS: NavItem = {
  href: "/app/transactions",
  label: "transactions",
  icon: ReceiptText,
};
export const GOALS: NavItem = { href: "/app/goals", label: "goals", icon: Target };
// Behind "Mais" on phones; listed in full in the desktop sidebar.
export const MORE_ITEMS: NavItem[] = [
  { href: "/app/reports", label: "reports", icon: ChartColumn },
  { href: "/app/fixed", label: "fixed", icon: CalendarClock },
  { href: "/app/budget", label: "budget", icon: Gauge },
  { href: "/app/exchange", label: "exchange", icon: ArrowLeftRight },
  { href: "/app/categories", label: "categories", icon: Tags },
];

/** Opens the quick-add sheet (components/transactions/quick-add.tsx listens). */
export const QUICK_ADD_EVENT = "quick-add:open";

declare global {
  interface Window {
    /** Set while the quick-add sheet is mounted and listening. */
    __quickAddReady?: boolean;
  }
}
