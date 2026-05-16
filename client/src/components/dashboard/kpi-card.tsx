import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TrendPill } from "./trend-pill";

export type KpiTone = "primary" | "people" | "money" | "production" | "inventory" | "alert" | "neutral" | "violet";

const TONE_ICON: Record<KpiTone, string> = {
  primary:    "bg-primary/10 text-primary",
  people:     "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400",
  money:      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  production: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  inventory:  "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  alert:      "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
  violet:     "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400",
  neutral:    "bg-gray-100 text-gray-700 dark:bg-muted dark:text-muted-foreground",
};

interface KpiCardProps {
  label: string;
  value: number | string;
  unit?: string;
  icon?: LucideIcon;
  tone?: KpiTone;
  trend?: number | null;
  trendInvert?: boolean;
  trendLabel?: string;
  subLabel?: string;
  onClick?: () => void;
  className?: string;
  children?: React.ReactNode;
  "data-testid"?: string;
}

const formatValue = (v: number | string) => {
  if (typeof v === "number") {
    if (!isFinite(v)) return "—";
    const abs = Math.abs(v);
    if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (abs >= 10_000) return `${(v / 1_000).toFixed(1)}K`;
    return new Intl.NumberFormat("en-US").format(v);
  }
  return v;
};

export function KpiCard({
  label,
  value,
  unit,
  icon: Icon,
  tone = "primary",
  trend,
  trendInvert,
  trendLabel,
  subLabel,
  onClick,
  className,
  children,
  ...rest
}: KpiCardProps) {
  const Wrapper: any = onClick ? "button" : "div";
  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "rounded-2xl border border-gray-100 dark:border-border bg-white dark:bg-card p-4 text-start transition-shadow",
        onClick && "hover:shadow-md hover:border-gray-200 dark:hover:border-border cursor-pointer",
        className,
      )}
      data-testid={rest["data-testid"] ?? "kpi-card"}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-[11px] font-medium text-gray-500 dark:text-muted-foreground uppercase tracking-wide">{label}</p>
        {Icon && (
          <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", TONE_ICON[tone])}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-foreground tracking-tight" dir="ltr">
          {formatValue(value)}
        </p>
        {unit && <span className="text-xs font-medium text-gray-500 dark:text-muted-foreground">{unit}</span>}
        {trend !== undefined && trend !== null && (
          <TrendPill value={trend} invertColors={trendInvert} />
        )}
      </div>
      {(subLabel || trendLabel) && (
        <p className="text-[11px] text-gray-400 dark:text-muted-foreground mt-1 truncate">
          {trendLabel ?? subLabel}
        </p>
      )}
      {children}
    </Wrapper>
  );
}
