import { type LucideIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Tone = "primary" | "people" | "money" | "production" | "inventory" | "construction" | "marketing" | "executive";

const TONE_CLASS: Record<Tone, string> = {
  primary:      "bg-primary/10 text-primary",
  people:       "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400",
  money:        "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  production:   "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  inventory:    "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  construction: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
  marketing:    "bg-pink-100 text-pink-700 dark:bg-pink-950/40 dark:text-pink-400",
  executive:    "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400",
};

interface PageHeaderProps {
  icon?: LucideIcon;
  tone?: Tone;
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  icon: Icon,
  tone = "primary",
  title,
  description,
  backHref,
  backLabel,
  actions,
  className,
}: PageHeaderProps) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const [, navigate] = useLocation();
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;

  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3", className)} data-testid="page-header">
      <div className="flex items-center gap-3 min-w-0">
        {backHref && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-gray-500 hover:text-gray-900 dark:hover:text-foreground"
            onClick={() => navigate(backHref)}
            aria-label={backLabel ?? "back"}
            data-testid="button-page-back"
          >
            <BackIcon className="w-5 h-5" />
          </Button>
        )}
        {Icon && (
          <div className={cn("shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center", TONE_CLASS[tone])}>
            <Icon className="w-5 h-5" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-foreground truncate" data-testid="text-page-title">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-gray-500 dark:text-muted-foreground mt-0.5 line-clamp-2">{description}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 shrink-0" data-testid="page-header-actions">
          {actions}
        </div>
      )}
    </div>
  );
}
