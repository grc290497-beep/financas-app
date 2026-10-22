import {
  Baby,
  Banknote,
  BookOpen,
  Briefcase,
  Coffee,
  Dog,
  Dumbbell,
  Fuel,
  Gamepad2,
  Gift,
  Shirt,
  Smartphone,
  Wrench,
  Bus,
  Car,
  GraduationCap,
  CircleDashed,
  CirclePlus,
  HandCoins,
  HeartPulse,
  House,
  Lightbulb,
  PartyPopper,
  PiggyBank,
  Plane,
  Repeat,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  TrendingUp,
  TriangleAlert,
  Utensils,
  Wifi,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Icon names stored in categories.icon (CATEGORY_ICONS) and goals.icon (GOAL_ICONS).
const ICONS: Record<string, LucideIcon> = {
  baby: Baby,
  "book-open": BookOpen,
  briefcase: Briefcase,
  coffee: Coffee,
  dog: Dog,
  dumbbell: Dumbbell,
  fuel: Fuel,
  gamepad: Gamepad2,
  gift: Gift,
  shirt: Shirt,
  smartphone: Smartphone,
  wrench: Wrench,
  banknote: Banknote,
  bus: Bus,
  car: Car,
  "graduation-cap": GraduationCap,
  "circle-plus": CirclePlus,
  "hand-coins": HandCoins,
  "heart-pulse": HeartPulse,
  house: House,
  lightbulb: Lightbulb,
  "party-popper": PartyPopper,
  "piggy-bank": PiggyBank,
  plane: Plane,
  repeat: Repeat,
  "shield-check": ShieldCheck,
  "shopping-bag": ShoppingBag,
  "shopping-cart": ShoppingCart,
  "trending-up": TrendingUp,
  "triangle-alert": TriangleAlert,
  utensils: Utensils,
  wifi: Wifi,
};

export function CategoryIcon({
  icon,
  color,
  className,
}: {
  icon: string | null;
  color: string | null;
  className?: string;
}) {
  const Icon = (icon && ICONS[icon]) || CircleDashed;
  return (
    <span
      className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", className)}
      style={{ backgroundColor: `${color ?? "#64748b"}1f`, color: color ?? "#64748b" }}
      aria-hidden
    >
      <Icon className="size-4" />
    </span>
  );
}
