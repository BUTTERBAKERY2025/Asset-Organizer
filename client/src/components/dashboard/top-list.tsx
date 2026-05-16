import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TopListItem {
  key: string | number;
  label: string;
  subLabel?: string;
  value: string | number;
  valueClassName?: string;
  icon?: LucideIcon;
  iconTone?: "primary" | "money" | "people" | "production" | "inventory" | "violet";
  onClick?: () => void;
}

const TONE: Record<NonNullable<TopListItem["iconTone"]>, string> = {
  primary:    "bg-primary/10 text-primary",
  money:      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  people:     "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400",
  production: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  inventory:  "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  violet:     "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400",
};

interface TopListProps {
  items: TopListItem[];
  emptyMessage?: string;
  className?: string;
}

export function TopList({ items, emptyMessage, className }: TopListProps) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-gray-400 dark:text-muted-foreground text-center py-6">
        {emptyMessage ?? "—"}
      </p>
    );
  }
  return (
    <ul className={cn("divide-y divide-gray-50 dark:divide-border/50", className)} data-testid="top-list">
      {items.map((it) => {
        const Icon = it.icon;
        const tone = it.iconTone ?? "primary";
        const Wrap: any = it.onClick ? "button" : "div";
        return (
          <li key={it.key}>
            <Wrap
              type={it.onClick ? "button" : undefined}
              onClick={it.onClick}
              className={cn(
                "w-full flex items-center gap-3 py-2.5 text-start",
                it.onClick && "hover:bg-gray-50 dark:hover:bg-muted/40 transition-colors rounded-md px-2 -mx-2",
              )}
              data-testid={`top-list-item-${it.key}`}
            >
              {Icon && (
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", TONE[tone])}>
                  <Icon className="w-4 h-4" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-foreground truncate">{it.label}</p>
                {it.subLabel && (
                  <p className="text-[11px] text-gray-400 dark:text-muted-foreground truncate">{it.subLabel}</p>
                )}
              </div>
              <span
                dir="ltr"
                className={cn("text-sm font-semibold text-gray-900 dark:text-foreground shrink-0", it.valueClassName)}
              >
                {typeof it.value === "number" ? new Intl.NumberFormat("en-US").format(it.value) : it.value}
              </span>
            </Wrap>
          </li>
        );
      })}
    </ul>
  );
}
