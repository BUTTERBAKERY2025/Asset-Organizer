import { useEffect } from "react";
import { Layout } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { changeLanguage } from "@/lib/i18n";
import {
  Package, Hammer, Settings, Users, Building2,
  HardDrive, LayoutDashboard, Factory, Megaphone,
  UsersRound, ClipboardList, Receipt, TrendingUp, TrendingDown,
  Sun, Moon, CloudSun, Languages, Warehouse,
  Store, Briefcase, Sparkles, Search,
} from "lucide-react";
import type { SystemModule } from "@shared/schema";
import { ThemeToggle } from "@/components/theme-toggle";
import { HeroWidgets } from "@/components/hero-widgets";

type SemanticColor =
  | "money"
  | "production"
  | "people"
  | "inventory"
  | "projects"
  | "marketing"
  | "executive"
  | "system";

const COLOR_MAP: Record<SemanticColor, { bg: string; soft: string; ring: string }> = {
  money:      { bg: "bg-emerald-500",  soft: "bg-emerald-50",  ring: "ring-emerald-100" },
  production: { bg: "bg-blue-500",     soft: "bg-blue-50",     ring: "ring-blue-100" },
  people:     { bg: "bg-teal-500",     soft: "bg-teal-50",     ring: "ring-teal-100" },
  inventory:  { bg: "bg-amber-500",    soft: "bg-amber-50",    ring: "ring-amber-100" },
  projects:   { bg: "bg-orange-500",   soft: "bg-orange-50",   ring: "ring-orange-100" },
  marketing:  { bg: "bg-pink-500",     soft: "bg-pink-50",     ring: "ring-pink-100" },
  executive:  { bg: "bg-violet-500",   soft: "bg-violet-50",   ring: "ring-violet-100" },
  system:     { bg: "bg-slate-500",    soft: "bg-slate-50",    ring: "ring-slate-100" },
};

interface AppTileProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  color: SemanticColor;
}

function AppTile({ title, icon: Icon, href, color }: AppTileProps) {
  const [, navigate] = useLocation();
  const c = COLOR_MAP[color];

  return (
    <button
      type="button"
      onClick={() => navigate(href)}
      className="group flex flex-col items-center gap-2 p-2 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary/40 transition-all"
      data-testid={`app-tile-${href.replace(/\//g, "")}`}
    >
      <div
        className={`w-[72px] h-[72px] sm:w-[80px] sm:h-[80px] rounded-2xl flex items-center justify-center ${c.bg} shadow-sm group-hover:shadow-lg group-hover:-translate-y-1 transition-all duration-300`}
      >
        <Icon className="w-8 h-8 text-white" />
      </div>
      <span className="text-[12px] sm:text-[13px] font-medium text-gray-700 text-center leading-tight line-clamp-2 max-w-[96px] group-hover:text-primary transition-colors">
        {title}
      </span>
    </button>
  );
}

export default function PlatformHomePage() {
  const { user, isAuthenticated, activeBranch, isAttendanceClerk } = useAuth();
  const { canView } = usePermissions();
  const { t, i18n } = useTranslation("platformHome");
  const currentLang = i18n.language as "ar" | "en";

  const toggleLanguage = () => {
    changeLanguage(currentLang === "ar" ? "en" : "ar");
  };

  const [, navigate] = useLocation();

  useEffect(() => {
    if (isAttendanceClerk) {
      navigate("/attendance-check");
    }
  }, [isAttendanceClerk, navigate]);

  if (isAttendanceClerk) {
    return null;
  }

  const { data: stats } = useQuery({
    queryKey: ["/api/dashboard/stats", activeBranch?.id],
    queryFn: async () => {
      const branchParam = activeBranch?.id ? `?branchId=${activeBranch.id}` : "";
      const res = await fetch(`/api/dashboard/stats${branchParam}`);
      if (!res.ok) throw new Error(`${res.status}: request failed`);
      return res.json();
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: branchesCount } = useQuery({
    queryKey: ["/api/branches"],
    staleTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    select: (data: any[]) => data?.length || 0,
  });

  const { data: employeesCount } = useQuery({
    queryKey: ["/api/branch-employees/count"],
    queryFn: async () => {
      const res = await fetch("/api/branch-employees?countOnly=true");
      if (!res.ok) throw new Error(`${res.status}: request failed`);
      const data = await res.json();
      if (typeof data === "number") return data;
      if (Array.isArray(data)) return data.filter((e: any) => e.status === "active").length;
      return data?.count || 0;
    },
    enabled: isAuthenticated,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const apps: (AppTileProps & { module?: SystemModule })[] = [
    { title: "مركز الموارد البشرية",          icon: UsersRound,     href: "/hr-hub",                  color: "people",     module: "hr_management" },
    { title: t("modules.sales.title"),       icon: Receipt,        href: "/cashier-journals",        color: "money",      module: "cashier_journal" },
    { title: t("modules.operations.title"),  icon: Factory,        href: "/operations",              color: "production", module: "operations" },
    { title: t("modules.production.title"),  icon: ClipboardList,  href: "/production-dashboard",    color: "production", module: "production" },
    { title: t("modules.assets.title"),      icon: Package,        href: "/inventory",               color: "inventory",  module: "inventory" },
    { title: t("modules.warehouse.title"),   icon: Warehouse,      href: "/warehouse-dashboard",     color: "inventory",  module: "warehouse" },
    { title: t("modules.projects.title"),    icon: Hammer,         href: "/construction-projects",   color: "projects",   module: "construction_projects" },
    { title: t("modules.marketing.title"),   icon: Megaphone,      href: "/marketing",               color: "marketing",  module: "marketing" },
    { title: t("modules.executive.title"),   icon: Briefcase,      href: "/executive",               color: "executive",  module: "executive_dashboard" },
    { title: t("modules.settings.title"),    icon: Settings,       href: "/settings",                color: "system",     module: "settings" },
  ];

  const accessibleApps = apps.filter((a) => !a.module || canView(a.module));

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return { text: t("greeting.morning"), icon: Sun, color: "text-amber-500" };
    if (hour >= 12 && hour < 17) return { text: t("greeting.afternoon"), icon: CloudSun, color: "text-orange-500" };
    return { text: t("greeting.evening"), icon: Moon, color: "text-indigo-500" };
  };

  const greeting = getGreeting();
  const GreetingIcon = greeting.icon;

  const todaySales: number = stats?.todaySales ?? 0;
  const yesterdaySales: number = stats?.yesterdaySales ?? 0;
  const salesTrend =
    yesterdaySales > 0
      ? Math.round(((todaySales - yesterdaySales) / yesterdaySales) * 100)
      : null;

  const todayOrders: number = stats?.productionOrders ?? 0;
  const pendingApprovals: number = stats?.pendingApprovals ?? 0;

  const formatNumber = (n: number) =>
    new Intl.NumberFormat("en-US").format(n);

  return (
    <Layout>
      <div
        className="page-container space-y-6"
        dir={currentLang === "ar" ? "rtl" : "ltr"}
      >
        {/* ============ HERO CARD (conversational) ============ */}
        <section
          className="relative overflow-hidden bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-7"
          data-testid="hero-card"
        >
          {/* soft brand background blobs */}
          <div className="pointer-events-none absolute -top-16 -left-16 w-48 h-48 rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -right-10 w-56 h-56 rounded-full bg-fuchsia-300/30 blur-3xl" />

          <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2">
                <GreetingIcon className={`w-6 h-6 ${greeting.color}`} />
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">
                  {greeting.text}
                  {user?.firstName ? `${currentLang === "ar" ? "، " : ", "}${user.firstName}` : ""}
                </h1>
                <Sparkles className="w-5 h-5 text-amber-400" />
              </div>

              <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                {pendingApprovals > 0 && (
                  <span data-testid="text-pending-approvals">
                    {t("hero.pendingApprovals", { count: formatNumber(pendingApprovals) as unknown as number })}
                  </span>
                )}
                <span className="font-bold text-gray-900">
                  {t("hero.salesSummary", {
                    amount: formatNumber(todaySales),
                    currency: t("currency"),
                  })}
                </span>
                {salesTrend !== null && (
                  <span
                    className={`inline-flex items-center gap-1 mx-2 text-xs font-medium ${
                      salesTrend >= 0 ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {salesTrend >= 0 ? (
                      <TrendingUp className="w-3.5 h-3.5" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5" />
                    )}
                    {salesTrend >= 0 ? "+" : ""}
                    {salesTrend}%
                  </span>
                )}
                .
              </p>

              {activeBranch && (
                <div className="flex items-center gap-2 pt-1">
                  <Badge
                    variant="outline"
                    className="text-xs bg-primary/5 border-primary/20 text-primary"
                    data-testid="badge-active-branch"
                  >
                    <Building2 className="w-3 h-3 mx-1" />
                    {activeBranch.name}
                  </Badge>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.dispatchEvent(new CustomEvent("open-global-search"))}
                className="gap-2 min-w-[180px] justify-between text-muted-foreground"
                data-testid="button-open-command-palette"
              >
                <span className="flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  {t("hero.searchPlaceholder")}
                </span>
                <kbd className="hidden sm:inline-flex pointer-events-none h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </Button>
              <ThemeToggle />
              <Button
                variant="outline"
                size="sm"
                onClick={toggleLanguage}
                className="gap-2"
                data-testid="button-toggle-language"
              >
                <Languages className="w-4 h-4" />
                {t("switchLanguage")}
              </Button>
            </div>
          </div>

          {/* ============ HERO WIDGETS (sparkline + highlights + quick actions) ============ */}
          {isAuthenticated && <HeroWidgets />}
        </section>

        {/* ============ KPI STRIP (narrative horizontal) ============ */}
        {isAuthenticated && (
          <section
            className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
            data-testid="kpi-strip"
          >
            <div className="kpi-grid divide-x divide-y lg:divide-y-0 divide-gray-100 rtl:divide-x-reverse [&>button]:text-start">
              {canView("branches") && (
                <button
                  type="button"
                  onClick={() => navigate("/branches")}
                  className="p-4 hover:bg-gray-50 transition-colors"
                  data-testid="kpi-branches"
                >
                  <p className="text-[11px] text-gray-500 mb-1">{t("stats.branches")}</p>
                  <p className="text-2xl font-bold text-gray-900">{formatNumber(branchesCount || 0)}</p>
                </button>
              )}
              {canView("branch_employees") && (
                <button
                  type="button"
                  onClick={() => navigate("/branch-employees")}
                  className="p-4 hover:bg-gray-50 transition-colors"
                  data-testid="kpi-employees"
                >
                  <p className="text-[11px] text-gray-500 mb-1">{t("stats.employees")}</p>
                  <p className="text-2xl font-bold text-gray-900">{formatNumber(employeesCount || 0)}</p>
                </button>
              )}
              {canView("production") && (
                <button
                  type="button"
                  onClick={() => navigate("/advanced-production-orders")}
                  className="p-4 hover:bg-gray-50 transition-colors"
                  data-testid="kpi-orders"
                >
                  <p className="text-[11px] text-gray-500 mb-1">{t("stats.todayOrders")}</p>
                  <p className="text-2xl font-bold text-gray-900">{formatNumber(todayOrders)}</p>
                </button>
              )}
              {canView("cashier_journal") && (
                <button
                  type="button"
                  onClick={() => navigate("/cashier-journals")}
                  className="p-4 hover:bg-gray-50 transition-colors"
                  data-testid="kpi-sales"
                >
                  <p className="text-[11px] text-gray-500 mb-1">{t("todaySales")}</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatNumber(todaySales)}{" "}
                    <span className="text-sm font-normal text-gray-500">{t("currency")}</span>
                  </p>
                </button>
              )}
            </div>
          </section>
        )}

        {/* ============ APPS GRID (Odoo style) ============ */}
        <section data-testid="apps-grid-section">
          <div className="flex items-center gap-2 mb-4 px-1">
            <LayoutDashboard className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-600 tracking-wide">
              {t("systemModules")}
            </h2>
            <span className="text-xs text-gray-400">({accessibleApps.length})</span>
          </div>

          <div
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6"
            data-testid="apps-grid"
          >
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-y-6 gap-x-2 sm:gap-x-4 justify-items-center">
              {accessibleApps.map((app, idx) => (
                <AppTile
                  key={`${app.href}-${idx}`}
                  title={app.title}
                  icon={app.icon}
                  href={app.href}
                  color={app.color}
                />
              ))}
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
