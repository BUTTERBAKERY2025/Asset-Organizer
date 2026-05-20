import { type LucideIcon, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SecurityHeroProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  badge?: string;
  badgeTone?: "violet" | "amber" | "rose" | "emerald";
  actions?: React.ReactNode;
  backHref?: string;
  className?: string;
}

const BADGE_TONES = {
  violet: "bg-white/20 text-white border-white/30",
  amber: "bg-amber-400/90 text-amber-950 border-amber-300",
  rose: "bg-rose-400/90 text-rose-950 border-rose-300",
  emerald: "bg-emerald-400/90 text-emerald-950 border-emerald-300",
};

export function SecurityHero({
  icon: Icon,
  title,
  description,
  badge,
  badgeTone = "violet",
  actions,
  backHref = "/settings",
  className,
}: SecurityHeroProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-l from-violet-600 via-purple-600 to-fuchsia-600 p-4 sm:p-6 md:p-8 text-white shadow-lg",
        className
      )}
      dir="rtl"
      data-testid="security-hero"
    >
      {/* خلفية زخرفية */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.15),transparent_50%)] pointer-events-none" />
      <div className="absolute -top-12 -left-12 w-48 h-48 bg-white/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -right-12 w-56 h-56 bg-fuchsia-300/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
          {backHref && (
            <Link href={backHref}>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 sm:h-10 sm:w-10 bg-white/10 hover:bg-white/20 text-white shrink-0 rounded-xl"
                data-testid="btn-hero-back"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </Link>
          )}
          <div className="bg-white/15 backdrop-blur-sm p-2.5 sm:p-3 rounded-2xl shrink-0 ring-1 ring-white/20">
            <Icon className="w-5 h-5 sm:w-7 sm:h-7" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1
                className="text-lg sm:text-2xl md:text-3xl font-bold truncate"
                data-testid="text-hero-title"
              >
                {title}
              </h1>
              {badge && (
                <Badge
                  className={cn("text-[10px] sm:text-xs font-semibold border", BADGE_TONES[badgeTone])}
                  data-testid="badge-hero"
                >
                  {badge}
                </Badge>
              )}
            </div>
            {description && (
              <p
                className="text-violet-50/90 text-xs sm:text-sm md:text-base mt-1 max-w-2xl leading-relaxed line-clamp-2"
                data-testid="text-hero-description"
              >
                {description}
              </p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 shrink-0" data-testid="hero-actions">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

/** كلاس موحّد لقائمة التبويبات في صفحات الأمان والحوكمة */
export const SECURITY_TABS_LIST =
  "bg-violet-50/60 border border-violet-100 p-1 rounded-xl h-auto gap-1";

/** كلاس موحّد لكل زر تبويب — الـ active بنفسجي/فوشي */
export const SECURITY_TAB_TRIGGER =
  "h-10 sm:h-9 text-xs sm:text-sm rounded-lg font-semibold transition " +
  "data-[state=active]:bg-gradient-to-l data-[state=active]:from-violet-600 data-[state=active]:to-fuchsia-600 " +
  "data-[state=active]:text-white data-[state=active]:shadow-md " +
  "text-slate-600 hover:bg-violet-100/60 hover:text-violet-700";
