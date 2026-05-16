import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrendPillProps {
  value: number | null | undefined;
  suffix?: string;
  invertColors?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function TrendPill({ value, suffix = "%", invertColors = false, size = "sm", className }: TrendPillProps) {
  if (value === null || value === undefined || !isFinite(value)) return null;

  const rounded = Math.round(value * 10) / 10;
  const isPositive = rounded > 0;
  const isNegative = rounded < 0;
  const isZero = rounded === 0;

  const good = invertColors ? isNegative : isPositive;
  const bad = invertColors ? isPositive : isNegative;

  const colorClass = good
    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
    : bad
      ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
      : "bg-gray-100 text-gray-600 dark:bg-muted dark:text-muted-foreground";

  const Icon = isZero ? Minus : isPositive ? TrendingUp : TrendingDown;
  const sizeClass = size === "md" ? "text-xs px-2 py-0.5 gap-1" : "text-[10px] px-1.5 py-0.5 gap-0.5";
  const iconSize = size === "md" ? "w-3 h-3" : "w-2.5 h-2.5";

  const sign = isPositive ? "+" : "";
  return (
    <span
      className={cn("inline-flex items-center rounded-full font-semibold tracking-tight", sizeClass, colorClass, className)}
      data-testid="trend-pill"
    >
      <Icon className={iconSize} />
      <span dir="ltr">{sign}{rounded}{suffix}</span>
    </span>
  );
}
