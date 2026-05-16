import { useQueries } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { usePermissions } from "@/hooks/usePermissions";
import { AlertTriangle, Bell, Package, Warehouse, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

interface AlertItem {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  count: number;
  href: string;
  tone: "warn" | "danger" | "info";
}

const TONE: Record<AlertItem["tone"], { dot: string; soft: string; text: string }> = {
  warn:   { dot: "bg-amber-500",  soft: "bg-amber-50 dark:bg-amber-950/30",   text: "text-amber-700 dark:text-amber-400" },
  danger: { dot: "bg-rose-500",   soft: "bg-rose-50 dark:bg-rose-950/30",     text: "text-rose-700 dark:text-rose-400" },
  info:   { dot: "bg-sky-500",    soft: "bg-sky-50 dark:bg-sky-950/30",       text: "text-sky-700 dark:text-sky-400" },
};

export function SmartAlertsCard() {
  const { canView } = usePermissions();
  const { t, i18n } = useTranslation("platformHome");
  const [, navigate] = useLocation();
  const isRTL = i18n.language === "ar";

  const fetchSafe = async <T,>(url: string, transform: (data: any) => number): Promise<number> => {
    try {
      const res = await fetch(url);
      if (!res.ok) return 0;
      const data = await res.json();
      return transform(data);
    } catch {
      return 0;
    }
  };

  const queries = useQueries({
    queries: [
      {
        queryKey: ["alerts:inventory:lowQty"],
        queryFn: () => fetchSafe<any[]>("/api/inventory/low-quantity", (d) => Array.isArray(d) ? d.length : 0),
        enabled: canView("inventory"),
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
      },
      {
        queryKey: ["alerts:warehouse:unread"],
        queryFn: () => fetchSafe<any>("/api/warehouse/notifications/unread-count", (d) => Number(d?.count ?? d ?? 0)),
        enabled: canView("warehouse"),
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
      },
      {
        queryKey: ["alerts:waste:risk"],
        queryFn: () => fetchSafe<any>("/api/waste-risk-alerts/count", (d) => Number(d?.count ?? d ?? 0)),
        enabled: canView("production"),
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
      },
      {
        queryKey: ["alerts:security:unresolved"],
        queryFn: () => fetchSafe<any>("/api/security/alerts/unresolved-count", (d) => Number(d?.count ?? d ?? 0)),
        enabled: canView("rbac_management"),
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
      },
    ],
  });

  const [inv, wh, waste, sec] = queries.map((q) => Number(q.data ?? 0));

  const alerts: AlertItem[] = [];
  if (canView("inventory") && inv > 0) {
    alerts.push({ key: "inv", icon: Package, title: t("alerts.lowInventory"), count: inv, href: "/inventory", tone: "warn" });
  }
  if (canView("warehouse") && wh > 0) {
    alerts.push({ key: "wh", icon: Warehouse, title: t("alerts.warehouseNotifications"), count: wh, href: "/warehouse-dashboard", tone: "info" });
  }
  if (canView("production") && waste > 0) {
    alerts.push({ key: "waste", icon: AlertTriangle, title: t("alerts.wasteRisk"), count: waste, href: "/display-bar-waste", tone: "danger" });
  }
  if (canView("rbac_management") && sec > 0) {
    alerts.push({ key: "sec", icon: ShieldAlert, title: t("alerts.securityAlerts"), count: sec, href: "/security", tone: "danger" });
  }

  const total = alerts.reduce((acc, a) => acc + a.count, 0);

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("butter:smart-alerts:collapsed") === "1";
  });

  useEffect(() => {
    try {
      window.localStorage.setItem("butter:smart-alerts:collapsed", collapsed ? "1" : "0");
    } catch {}
  }, [collapsed]);

  if (total === 0) return null;

  const Chevron = isRTL ? ChevronLeft : ChevronRight;
  const ToggleIcon = collapsed ? ChevronDown : ChevronUp;

  return (
    <section
      className="bg-white dark:bg-card rounded-2xl border border-gray-100 dark:border-border shadow-sm overflow-hidden"
      data-testid="smart-alerts-card"
    >
      <header
        className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-border bg-gradient-to-l from-amber-50/60 to-transparent dark:from-amber-950/20 cursor-pointer select-none"
        onClick={() => setCollapsed((v) => !v)}
        role="button"
        aria-expanded={!collapsed}
        data-testid="alerts-header-toggle"
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center">
            <Bell className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="text-sm font-semibold text-gray-800 dark:text-foreground">{t("alerts.title")}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs" data-testid="badge-alerts-total">
            {t("alerts.totalCount", { count: total })}
          </Badge>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => { e.stopPropagation(); setCollapsed((v) => !v); }}
            aria-label={collapsed ? t("alerts.expand") : t("alerts.collapse")}
            title={collapsed ? t("alerts.expand") : t("alerts.collapse")}
            data-testid="button-toggle-alerts"
          >
            <ToggleIcon className="w-4 h-4 text-gray-500 dark:text-muted-foreground" />
          </Button>
        </div>
      </header>

      {!collapsed && (
      <ul className="divide-y divide-gray-100 dark:divide-border">
        {alerts.map((a) => {
          const tone = TONE[a.tone];
          const Icon = a.icon;
          return (
            <li key={a.key}>
              <button
                type="button"
                onClick={() => navigate(a.href)}
                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-muted/40 transition-colors text-start"
                data-testid={`alert-row-${a.key}`}
              >
                <div className={`w-9 h-9 rounded-lg ${tone.soft} flex items-center justify-center shrink-0`}>
                  <Icon className={`w-4 h-4 ${tone.text}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-foreground truncate">{a.title}</p>
                </div>
                <span className={`inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full text-xs font-bold text-white ${tone.dot}`}>
                  {a.count}
                </span>
                <Chevron className="w-4 h-4 text-gray-400" />
              </button>
            </li>
          );
        })}
      </ul>
      )}
    </section>
  );
}
