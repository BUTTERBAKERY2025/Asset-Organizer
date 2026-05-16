import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import {
  Trophy, Factory, TrendingUp, Receipt, ClipboardList,
  UserCheck, Package, Plus, ChevronDown, ChevronUp,
} from "lucide-react";

interface WidgetsData {
  weekSales: { date: string; total: number }[];
  yesterdaySales: number;
  topBranchToday: { name: string; total: number } | null;
  topProductionToday: { name: string; orders: number } | null;
}

interface SparklineProps {
  data: number[];
  height?: number;
  width?: number;
}

function Sparkline({ data, height = 36, width = 140 }: SparklineProps) {
  const path = useMemo(() => {
    if (data.length === 0) return { d: "", area: "", points: [] as { x: number; y: number }[] };
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    const stepX = width / Math.max(data.length - 1, 1);
    const points = data.map((v, i) => ({
      x: i * stepX,
      y: height - ((v - min) / range) * (height - 4) - 2,
    }));
    const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const area = `${d} L${width},${height} L0,${height} Z`;
    return { d, area, points };
  }, [data, height, width]);

  if (data.length === 0) return null;

  return (
    <svg width={width} height={height} className="overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id="spark-grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={path.area} fill="url(#spark-grad)" className="text-primary" />
      <path d={path.d} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-primary" />
      {path.points.length > 0 && (
        <circle
          cx={path.points[path.points.length - 1].x}
          cy={path.points[path.points.length - 1].y}
          r="3"
          fill="currentColor"
          className="text-primary"
        />
      )}
    </svg>
  );
}

interface QuickAction {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  module?: string;
  tone: "money" | "production" | "people" | "inventory";
}

const TONE_CLASS: Record<QuickAction["tone"], string> = {
  money:      "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/40",
  production: "bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:hover:bg-blue-950/50 dark:text-blue-400 border-blue-100 dark:border-blue-900/40",
  people:     "bg-teal-50 hover:bg-teal-100 text-teal-700 dark:bg-teal-950/30 dark:hover:bg-teal-950/50 dark:text-teal-400 border-teal-100 dark:border-teal-900/40",
  inventory:  "bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:hover:bg-amber-950/50 dark:text-amber-400 border-amber-100 dark:border-amber-900/40",
};

export function HeroWidgets() {
  const { t, i18n } = useTranslation("platformHome");
  const { isAuthenticated, activeBranch } = useAuth();
  const { canView } = usePermissions();
  const [, navigate] = useLocation();
  const lang = i18n.language;

  const { data } = useQuery<WidgetsData>({
    queryKey: ["/api/dashboard/widgets", activeBranch?.id],
    queryFn: async () => {
      const param = activeBranch?.id ? `?branchId=${activeBranch.id}` : "";
      const res = await fetch(`/api/dashboard/widgets${param}`);
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const weekTotals = data?.weekSales?.map((d) => d.total) ?? [];
  const weekSum = weekTotals.reduce((a, b) => a + b, 0);
  const formatNumber = (n: number) =>
    new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
  const formatShort = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return formatNumber(n);
  };

  const quickActions: QuickAction[] = [
    { key: "qa-sales",      label: t("widgets.quickActions.newCashier"),    icon: Receipt,        href: "/cashier-journals/new",       module: "cashier_journal", tone: "money" },
    { key: "qa-production", label: t("widgets.quickActions.newProduction"), icon: ClipboardList,  href: "/advanced-production-orders", module: "production",      tone: "production" },
    { key: "qa-attendance", label: t("widgets.quickActions.checkIn"),       icon: UserCheck,      href: "/attendance-check",           module: "attendance_check", tone: "people" },
    { key: "qa-inventory",  label: t("widgets.quickActions.inventory"),     icon: Package,        href: "/inventory",                  module: "inventory",       tone: "inventory" },
  ];
  const accessibleActions = quickActions.filter((a) => !a.module || canView(a.module as any));

  const highlights: { key: string; icon: React.ComponentType<{ className?: string }>; iconClass: string; title: string; value: string }[] = [];
  if (weekSum > 0) {
    highlights.push({
      key: "h-week",
      icon: TrendingUp,
      iconClass: "text-primary",
      title: t("widgets.highlights.weekTotal"),
      value: `${formatShort(weekSum)} ${t("currency")}`,
    });
  }
  if (data?.topBranchToday) {
    highlights.push({
      key: "h-branch",
      icon: Trophy,
      iconClass: "text-amber-500",
      title: t("widgets.highlights.topBranch"),
      value: `${data.topBranchToday.name} · ${formatShort(data.topBranchToday.total)}`,
    });
  }
  if (data?.topProductionToday) {
    highlights.push({
      key: "h-prod",
      icon: Factory,
      iconClass: "text-blue-500",
      title: t("widgets.highlights.topProduction"),
      value: `${data.topProductionToday.name} · ${formatNumber(data.topProductionToday.orders)}`,
    });
  }

  const showSparkline = weekSum > 0;

  const [qaCollapsed, setQaCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("butter:hero-quickactions:collapsed") === "1";
  });
  useEffect(() => {
    try {
      window.localStorage.setItem("butter:hero-quickactions:collapsed", qaCollapsed ? "1" : "0");
    } catch {}
  }, [qaCollapsed]);
  const QaToggleIcon = qaCollapsed ? ChevronDown : ChevronUp;

  if (!showSparkline && highlights.length === 0 && accessibleActions.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 mt-3" data-testid="hero-widgets">
      {/* Sparkline */}
      {showSparkline && (
        <div
          className="rounded-xl border border-gray-100 dark:border-border bg-gradient-to-br from-primary/5 to-transparent px-3 py-2 flex items-center justify-between gap-3"
          data-testid="widget-sparkline"
        >
          <div className="min-w-0">
            <p className="text-[11px] text-gray-500 dark:text-muted-foreground leading-tight">{t("widgets.weekSales")}</p>
            <p className="text-base font-bold text-gray-900 dark:text-foreground truncate leading-tight">
              {formatShort(weekSum)}{" "}
              <span className="text-[11px] font-normal text-gray-500 dark:text-muted-foreground">{t("currency")}</span>
            </p>
            <p className="text-[10px] text-gray-400 dark:text-muted-foreground leading-tight">
              {t("widgets.last7Days")}
            </p>
          </div>
          <div className="shrink-0">
            <Sparkline data={weekTotals} height={30} width={120} />
          </div>
        </div>
      )}

      {/* Highlights */}
      {highlights.length > 0 && (
        <div
          className="rounded-xl border border-gray-100 dark:border-border bg-white dark:bg-card px-3 py-2 space-y-1"
          data-testid="widget-highlights"
        >
          <p className="text-[11px] text-gray-500 dark:text-muted-foreground">{t("widgets.highlights.title")}</p>
          {highlights.slice(0, 3).map((h) => {
            const Icon = h.icon;
            return (
              <div key={h.key} className="flex items-center gap-2 text-sm" data-testid={`highlight-${h.key}`}>
                <Icon className={`w-4 h-4 shrink-0 ${h.iconClass}`} />
                <div className="flex-1 min-w-0">
                  <span className="text-gray-500 dark:text-muted-foreground text-[11px]">{h.title}: </span>
                  <span className="font-medium text-gray-800 dark:text-foreground truncate">{h.value}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Actions */}
      {accessibleActions.length > 0 && (
        <div
          className="rounded-xl border border-gray-100 dark:border-border bg-white dark:bg-card px-3 py-2"
          data-testid="widget-quick-actions"
        >
          <div className="flex items-center justify-between mb-1">
            <p className="text-[11px] text-gray-500 dark:text-muted-foreground">{t("widgets.quickActions.title")}</p>
            <button
              type="button"
              onClick={() => setQaCollapsed((v) => !v)}
              className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-muted text-gray-400 hover:text-gray-600 dark:hover:text-foreground transition-colors"
              aria-expanded={!qaCollapsed}
              aria-label={qaCollapsed ? t("widgets.quickActions.expand") : t("widgets.quickActions.collapse")}
              title={qaCollapsed ? t("widgets.quickActions.expand") : t("widgets.quickActions.collapse")}
              data-testid="button-toggle-quick-actions"
            >
              <QaToggleIcon className="w-3.5 h-3.5" />
            </button>
          </div>
          {!qaCollapsed && (
            <div className="grid grid-cols-2 gap-1">
              {accessibleActions.map((a) => {
                const Icon = a.icon;
                return (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => navigate(a.href)}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs font-medium transition-colors ${TONE_CLASS[a.tone]}`}
                    data-testid={a.key}
                  >
                    <Plus className="w-3 h-3 shrink-0 opacity-60" />
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{a.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
