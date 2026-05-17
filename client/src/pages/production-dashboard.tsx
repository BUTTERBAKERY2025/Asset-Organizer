import { useEffect, useCallback } from "react";
import { Layout } from "@/components/layout";
import { PageHeader } from "@/components/dashboard/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useBranches } from "@/hooks/useBranches";
import {
  Factory,
  ClipboardList,
  BarChart3,
  Upload,
  Plus,
  Calendar,
  CheckCircle,
  Clock,
  Package,
  Target,
  Zap,
  RefreshCw,
  ChefHat,
  ShoppingCart,
  Activity,
  Trash2,
  FileBarChart2,
  LayoutDashboard,
  Settings2,
  Layers,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { useProductionContext } from "@/contexts/ProductionContext";

interface OrderStats {
  total: number;
  draft: number;
  pending: number;
  approved: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  daily: number;
  weekly: number;
  longTerm: number;
  totalEstimatedCost: number;
}

interface DailyStats {
  totalBatches: number;
  totalQuantity: number;
  byDestination: Record<string, number>;
  byCategory: Record<string, number>;
  byHour: Record<string, number>;
}

interface ProductionHubData {
  today: DailyStats;
  yesterday: DailyStats;
  deltas: {
    quantity: number;
    batches: number;
    quantityPercent: number;
    batchesPercent: number;
  };
  target: {
    totalTarget: number;
    totalProduced: number;
    gap: number;
    completionRate: number;
  };
  activeOrders: number;
  date: string;
  branchId: string;
}

type QuickAction = { title: string; description: string; icon: typeof ChefHat; href: string; badge: string | null };
const QUICK_ACTIONS: QuickAction[] = [
  { title: "الإنتاج اليومي", description: "تسجيل دفعات الإنتاج", icon: ChefHat,        href: "/daily-production",               badge: "جديد" },
  { title: "رفع المبيعات",   description: "استيراد من Excel",     icon: Upload,         href: "/sales-data-uploads",             badge: null },
  { title: "أوامر الإنتاج",  description: "إدارة ومتابعة",        icon: ClipboardList,  href: "/advanced-production-orders",     badge: null },
  { title: "أمر جديد",       description: "إنشاء أمر إنتاج",      icon: Plus,           href: "/advanced-production-orders/new", badge: null },
  { title: "التقارير",       description: "تقارير شاملة",         icon: FileBarChart2,  href: "/production-reports",             badge: "جديد" },
  { title: "تقارير التشغيل", description: "التحليلات",            icon: BarChart3,      href: "/operations-reports",             badge: null },
  { title: "المنتجات",       description: "كتالوج المنتجات",      icon: Package,        href: "/products",                       badge: null },
  { title: "مخزون الإنتاج",  description: "الإنتاج النهائي",      icon: Layers,         href: "/finished-goods-inventory",       badge: "جديد" },
];

// Royal Violet palette for charts
const CHART_PRIMARY   = "hsl(262 83% 58%)";  // Royal violet
const CHART_MUTED     = "hsl(265 15% 78%)";  // Lavender-gray
const CHART_GOLD      = "hsl(42 87% 55%)";   // Butter gold accent

// Order status palette (Royal Violet family + accents)
const STATUS_COLORS = {
  completed: "hsl(160 60% 45%)",   // Mint
  inProgress: "hsl(262 83% 58%)",  // Primary violet
  approved: "hsl(220 75% 60%)",    // Indigo
  pending: "hsl(42 87% 55%)",      // Gold
  draft: "hsl(265 10% 65%)",       // Neutral
} as const;

export default function ProductionDashboardPage() {
  const {
    selectedBranch, setSelectedBranch,
    selectedDate, setSelectedDate,
    autoRefresh, setAutoRefresh,
    lastUpdated,
    commandCenterData,
    isLoading: commandCenterLoading,
    refetch: refetchCommandCenter,
  } = useProductionContext();

  useEffect(() => {
    if (!selectedBranch) setSelectedBranch("all");
  }, [selectedBranch, setSelectedBranch]);

  const { branches, userBranchId, canSelectBranch } = useBranches();

  useEffect(() => {
    if (userBranchId && !selectedBranch) setSelectedBranch(userBranchId);
  }, [userBranchId, selectedBranch, setSelectedBranch]);

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<OrderStats>({
    queryKey: ["/api/advanced-production-orders/stats", selectedBranch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBranch && selectedBranch !== "all") params.set("branchId", selectedBranch);
      const res = await fetch(`/api/advanced-production-orders/stats?${params}`, { credentials: "include" });
      if (!res.ok) return { total: 0, draft: 0, pending: 0, approved: 0, inProgress: 0, completed: 0, cancelled: 0, daily: 0, weekly: 0, longTerm: 0, totalEstimatedCost: 0 };
      return res.json();
    },
    enabled: !!selectedBranch,
    staleTime: 1000 * 30,
    placeholderData: (prev) => prev,
  });

  const { data: hubData, isLoading: dailyLoading, refetch: refetchDaily } = useQuery<ProductionHubData>({
    queryKey: ["/api/production/hub", selectedBranch, selectedDate],
    queryFn: async () => {
      const params = new URLSearchParams({ branchId: selectedBranch, date: selectedDate });
      const res = await fetch(`/api/production/hub?${params}`, { credentials: "include" });
      if (!res.ok) {
        return {
          today: { totalBatches: 0, totalQuantity: 0, byDestination: {}, byCategory: {}, byHour: {} },
          yesterday: { totalBatches: 0, totalQuantity: 0, byDestination: {}, byCategory: {}, byHour: {} },
          deltas: { quantity: 0, batches: 0, quantityPercent: 0, batchesPercent: 0 },
          target: { totalTarget: 0, totalProduced: 0, gap: 0, completionRate: 0 },
          activeOrders: 0,
          date: selectedDate,
          branchId: selectedBranch,
        };
      }
      const data = await res.json();
      if (!data.target) data.target = { totalTarget: 0, totalProduced: 0, gap: 0, completionRate: 0 };
      return data;
    },
    enabled: !!selectedBranch && !!selectedDate,
    staleTime: 1000 * 30,
    refetchInterval: autoRefresh ? 60000 : false,
    placeholderData: (prev) => prev,
  });

  const dailyStats = hubData?.today;
  const prevDayStats = hubData?.yesterday;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("ar-SA", { style: "decimal", maximumFractionDigits: 0 }).format(amount || 0) + " ر.س";

  const completionRate = stats ? Math.round((stats.completed / Math.max(stats.total, 1)) * 100) : 0;

  const handleRefresh = useCallback(() => {
    refetchStats();
    refetchDaily();
    refetchCommandCenter();
  }, [refetchStats, refetchDaily, refetchCommandCenter]);

  const formatLastUpdated = () => {
    if (!lastUpdated) return "جارٍ التحميل...";
    const now = new Date();
    const diff = Math.floor((now.getTime() - lastUpdated.getTime()) / 1000);
    if (diff < 60) return `منذ ${diff} ث`;
    const mins = Math.floor(diff / 60);
    return `منذ ${mins} د`;
  };

  // Trend percentages (today vs yesterday)
  const qtyTrend = hubData?.deltas?.quantityPercent ?? null;
  const batchTrend = hubData?.deltas?.batchesPercent ?? null;

  // Target status (single source of truth)
  const target = hubData?.target;
  const hasTarget = !!target && target.totalTarget > 0;
  const targetState: "achieved" | "near" | "behind" | "none" = !hasTarget
    ? "none"
    : target!.completionRate >= 100 ? "achieved"
    : target!.completionRate >= 80  ? "near"
    : "behind";
  const targetBadge = {
    achieved: { label: "تم تحقيق الهدف", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-0" },
    near:     { label: "قريب من الهدف",  cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-0" },
    behind:   { label: "يحتاج متابعة",   cls: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-0" },
    none:     { label: "", cls: "" },
  }[targetState];

  // Comparison chart data (today vs yesterday vs target)
  const comparisonData = [
    {
      name: "الإجمالي",
      اليوم: dailyStats?.totalQuantity || 0,
      أمس: prevDayStats?.totalQuantity || 0,
      الهدف: target?.totalTarget || 0,
    },
    {
      name: "بار العرض",
      اليوم: dailyStats?.byDestination?.display_bar || 0,
      أمس: prevDayStats?.byDestination?.display_bar || 0,
      الهدف: 0,
    },
    {
      name: "التخزين",
      اليوم: (dailyStats?.byDestination?.freezer || 0) + (dailyStats?.byDestination?.refrigerator || 0),
      أمس: (prevDayStats?.byDestination?.freezer || 0) + (prevDayStats?.byDestination?.refrigerator || 0),
      الهدف: 0,
    },
  ];

  // Order status — for stacked horizontal bar
  const orderStatusRows = [
    { key: "completed",  label: "مكتمل",        value: stats?.completed  || 0, color: STATUS_COLORS.completed,  icon: CheckCircle },
    { key: "inProgress", label: "قيد التنفيذ",  value: stats?.inProgress || 0, color: STATUS_COLORS.inProgress, icon: Activity },
    { key: "approved",   label: "معتمد",        value: stats?.approved   || 0, color: STATUS_COLORS.approved,   icon: CheckCircle },
    { key: "pending",    label: "قيد الانتظار", value: stats?.pending    || 0, color: STATUS_COLORS.pending,    icon: Clock },
    { key: "draft",      label: "مسودة",        value: stats?.draft      || 0, color: STATUS_COLORS.draft,      icon: ClipboardList },
  ];
  const totalOrders = orderStatusRows.reduce((s, r) => s + r.value, 0);

  return (
    <Layout>
      <div className="page-container space-y-4 md:space-y-6" dir="rtl">
        <PageHeader
          icon={Factory}
          tone="production"
          title="لوحة الإنتاج"
          description={`${format(new Date(selectedDate), "EEEE، dd MMMM yyyy", { locale: ar })}${lastUpdated ? ` • ${formatLastUpdated()}` : ""}`}
          actions={
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <Select value={selectedBranch} onValueChange={setSelectedBranch} disabled={!canSelectBranch}>
                <SelectTrigger className="w-[130px] sm:w-[160px] h-11 sm:h-10" data-testid="select-branch">
                  <SelectValue placeholder="كل الفروع" />
                </SelectTrigger>
                <SelectContent>
                  {canSelectBranch && <SelectItem value="all">كل الفروع</SelectItem>}
                  {branches?.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-[120px] sm:w-[140px] h-11 sm:h-10"
                data-testid="input-date"
              />

              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={autoRefresh ? "default" : "outline"}
                      size="icon"
                      onClick={() => setAutoRefresh(!autoRefresh)}
                      data-testid="btn-auto-refresh"
                      className="h-11 w-11 sm:h-10 sm:w-10"
                    >
                      <Activity className={`h-4 w-4 ${autoRefresh ? "animate-pulse" : ""}`} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>{autoRefresh ? "التحديث التلقائي مفعّل (كل دقيقة)" : "تفعيل التحديث التلقائي"}</p>
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>

              <Button variant="outline" size="icon" onClick={handleRefresh} data-testid="btn-refresh" className="h-11 w-11 sm:h-10 sm:w-10">
                <RefreshCw className={`h-4 w-4 ${dailyLoading ? "animate-spin" : ""}`} />
              </Button>

              <Link href="/advanced-production-orders/new">
                <Button data-testid="btn-new-order" className="h-11 sm:h-10 text-sm">
                  <Plus className="h-4 w-4 ml-1" />
                  <span className="hidden sm:inline">أمر جديد</span>
                  <span className="sm:hidden">جديد</span>
                </Button>
              </Link>
            </div>
          }
        />

        {/* Main KPI grid — unified KpiCard, Royal Violet tones */}
        <div className="kpi-grid">
          {dailyLoading && !dailyStats ? (
            <>
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[110px] rounded-2xl" />)}
            </>
          ) : (
            <>
              <KpiCard
                label="إنتاج اليوم"
                value={dailyStats?.totalQuantity || 0}
                icon={Activity}
                tone="money"
                trend={qtyTrend}
                trendLabel={`أمس: ${prevDayStats?.totalQuantity || 0}`}
                data-testid="card-daily-qty"
              />
              <KpiCard
                label="الدفعات"
                value={dailyStats?.totalBatches || 0}
                icon={Package}
                tone="inventory"
                trend={batchTrend}
                trendLabel={`أمس: ${prevDayStats?.totalBatches || 0}`}
                data-testid="card-daily-batches"
              />
              <KpiCard
                label="بار العرض"
                value={dailyStats?.byDestination?.display_bar || 0}
                icon={ShoppingCart}
                tone="production"
                subLabel="القطع المعروضة"
                data-testid="card-display"
              />
              <KpiCard
                label="أوامر نشطة"
                value={hubData?.activeOrders ?? (stats ? stats.pending + stats.approved + stats.inProgress : 0)}
                icon={Clock}
                tone="violet"
                subLabel="قيد التنفيذ / المعتمدة"
                data-testid="card-active-orders"
              />
            </>
          )}
        </div>

        {/* Target vs Actual — clean unified card */}
        <Card data-testid="card-target-vs-actual" className="border-border">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Target className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-foreground">الهدف مقابل الإنتاج الفعلي</h3>
                  <p className="text-[11px] sm:text-xs text-muted-foreground">متابعة تحقيق الأهداف اليومية</p>
                </div>
              </div>
              {hasTarget && (
                <div className="sm:mr-auto">
                  <Badge className={`text-[10px] sm:text-xs ${targetBadge.cls}`}>{targetBadge.label}</Badge>
                </div>
              )}
            </div>

            {hasTarget ? (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-4">
                  <div className="rounded-xl p-3 text-center bg-muted/40 border border-border">
                    <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">الهدف</p>
                    <p className="text-lg sm:text-2xl font-bold text-foreground tabular-nums">{target!.totalTarget}</p>
                  </div>
                  <div className="rounded-xl p-3 text-center bg-primary/5 border border-primary/20">
                    <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">المُنتَج</p>
                    <p className="text-lg sm:text-2xl font-bold text-primary tabular-nums">{target!.totalProduced}</p>
                  </div>
                  <div className="rounded-xl p-3 text-center bg-muted/40 border border-border">
                    <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">الفرق</p>
                    <p className={`text-lg sm:text-2xl font-bold tabular-nums ${
                      target!.gap > 0 ? "text-rose-600 dark:text-rose-400" :
                      target!.gap === 0 ? "text-foreground" : "text-emerald-600 dark:text-emerald-400"
                    }`}>
                      {target!.gap > 0 ? `-${target!.gap}` : target!.gap === 0 ? "0" : `+${Math.abs(target!.gap)}`}
                    </p>
                  </div>
                  <div className="rounded-xl p-3 text-center bg-muted/40 border border-border">
                    <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">نسبة الإنجاز</p>
                    <p className={`text-lg sm:text-2xl font-bold tabular-nums ${
                      targetState === "achieved" ? "text-emerald-600 dark:text-emerald-400" :
                      targetState === "near"     ? "text-amber-600 dark:text-amber-400" :
                                                   "text-rose-600 dark:text-rose-400"
                    }`}>
                      {target!.completionRate}%
                    </p>
                  </div>
                </div>

                <Progress
                  value={Math.min(target!.completionRate, 100)}
                  className="h-3 rounded-full bg-muted [&>div]:bg-primary"
                  data-testid="progress-target"
                />
                <div className="flex justify-between text-[10px] sm:text-xs text-muted-foreground mt-2">
                  <span>0%</span>
                  <span className="tabular-nums">{target!.totalTarget} قطعة</span>
                  <span>100%</span>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Target className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">لا توجد أهداف إنتاج مُعدّة لهذا التاريخ</p>
                <p className="text-xs mt-1">يمكنك إنشاء أمر إنتاج جديد لتحديد الأهداف</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Left — Command Center + Comparison Chart */}
          <div className="lg:col-span-2 space-y-4 md:space-y-6">
            {/* Command Center */}
            <Card className="border-border" data-testid="card-command-center">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <LayoutDashboard className="h-5 w-5 text-primary" />
                  مركز القيادة الموحد
                </CardTitle>
                <CardDescription>نظرة شاملة على الهدر والمقارنات</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  {/* Waste */}
                  <Link href="/display-bar-waste" className="block group" data-testid="card-waste-kpi">
                    <div className="rounded-xl border border-border bg-card p-4 hover:border-rose-300 dark:hover:border-rose-700 hover:shadow-sm transition-all cursor-pointer h-full">
                      <div className="flex items-center justify-between mb-3">
                        <div className="h-10 w-10 rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 flex items-center justify-center">
                          <Trash2 className="h-5 w-5" />
                        </div>
                        <h4 className="text-sm font-semibold text-foreground">الهدر</h4>
                      </div>
                      {commandCenterLoading ? (
                        <Skeleton className="h-12 w-full" />
                      ) : (
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">التقارير</span>
                            <span className="font-bold text-foreground tabular-nums">{commandCenterData?.waste?.totalReports || 0}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">الكمية</span>
                            <span className="font-medium text-foreground tabular-nums">{commandCenterData?.waste?.totalWastedQuantity || 0}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">القيمة</span>
                            <span className="font-medium text-rose-600 dark:text-rose-400 tabular-nums">{formatCurrency(commandCenterData?.waste?.totalWastedValue || 0)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </Link>

                  {/* Comparison */}
                  <Link href="/production-comparisons" className="block group" data-testid="card-comparison-kpi">
                    <div className="rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer h-full">
                      <div className="flex items-center justify-between mb-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                          <BarChart3 className="h-5 w-5" />
                        </div>
                        <h4 className="text-sm font-semibold text-foreground">المقارنات</h4>
                      </div>
                      {commandCenterLoading ? (
                        <Skeleton className="h-12 w-full" />
                      ) : (
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">الإنتاج vs أمس</span>
                            <span className={`font-bold tabular-nums ${(commandCenterData?.comparison?.productionVsYesterday || 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                              {(commandCenterData?.comparison?.productionVsYesterday || 0) >= 0 ? "+" : ""}{(commandCenterData?.comparison?.productionVsYesterday || 0).toFixed(0)}%
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">المبيعات vs أمس</span>
                            <span className={`font-bold tabular-nums ${(commandCenterData?.comparison?.salesVsYesterday || 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                              {(commandCenterData?.comparison?.salesVsYesterday || 0) >= 0 ? "+" : ""}{(commandCenterData?.comparison?.salesVsYesterday || 0).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Comparison Chart — Royal Violet palette */}
            <Card className="border-border" data-testid="card-comparison-chart">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Layers className="h-5 w-5 text-primary" />
                  مقارنة الإنتاج
                </CardTitle>
                <CardDescription>اليوم مقابل أمس والهدف</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={comparisonData} margin={{ top: 16, right: 16, left: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="name" tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} stroke="var(--color-border)" />
                    <YAxis tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} stroke="var(--color-border)" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--color-popover)",
                        color: "var(--color-popover-foreground)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "10px",
                        boxShadow: "0 4px 12px -2px rgb(0 0 0 / 0.08)",
                      }}
                      cursor={{ fill: "var(--color-muted)", opacity: 0.4 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, color: "var(--color-muted-foreground)" }} />
                    <Bar dataKey="اليوم" fill={CHART_PRIMARY} radius={[6, 6, 0, 0]} />
                    <Bar dataKey="أمس"   fill={CHART_MUTED}   radius={[6, 6, 0, 0]} />
                    <Bar dataKey="الهدف" fill={CHART_GOLD}    radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Right — Quick Actions + Order Status + Order Types */}
          <div className="space-y-4 md:space-y-6">
            {/* Quick Actions — unified Exact Flow style */}
            <Card className="border-border" data-testid="card-quick-actions">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Zap className="h-5 w-5 text-primary" />
                  الوصول السريع
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  {QUICK_ACTIONS.map((action, index) => (
                    <Link key={index} href={action.href}>
                      <div
                        className="group relative p-3 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer h-full"
                        data-testid={`quick-action-${index}`}
                      >
                        <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-2 group-hover:bg-primary/15 transition-colors">
                          <action.icon className="h-4 w-4" />
                        </div>
                        <h4 className="text-xs font-semibold text-foreground mb-0.5">{action.title}</h4>
                        <p className="text-[10px] text-muted-foreground line-clamp-1">{action.description}</p>
                        {action.badge && (
                          <Badge className="absolute top-2 left-2 text-[9px] px-1.5 py-0 bg-primary/15 text-primary border-0 hover:bg-primary/15">
                            {action.badge}
                          </Badge>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Order Status — single stacked bar + compact list */}
            <Card className="border-border" data-testid="card-order-status">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Settings2 className="h-5 w-5 text-primary" />
                  حالة الأوامر
                </CardTitle>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
                  </div>
                ) : totalOrders === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <ClipboardList className="h-10 w-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">لا توجد أوامر إنتاج حالياً</p>
                  </div>
                ) : (
                  <>
                    {/* Stacked horizontal bar */}
                    <div className="h-3 w-full rounded-full overflow-hidden bg-muted flex mb-3" data-testid="status-stacked-bar">
                      {orderStatusRows.filter(r => r.value > 0).map((row) => (
                        <div
                          key={row.key}
                          style={{ width: `${(row.value / totalOrders) * 100}%`, backgroundColor: row.color }}
                          title={`${row.label}: ${row.value}`}
                        />
                      ))}
                    </div>

                    {/* Compact list */}
                    <div className="space-y-1.5">
                      {orderStatusRows.map((row) => {
                        const Icon = row.icon;
                        const pct = totalOrders ? Math.round((row.value / totalOrders) * 100) : 0;
                        return (
                          <div key={row.key} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-muted/40 transition-colors" data-testid={`status-row-${row.key}`}>
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: row.color }} />
                              <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="text-sm text-foreground truncate">{row.label}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-end">{pct}%</span>
                              <Badge variant="secondary" className="tabular-nums min-w-[2rem] justify-center">{row.value}</Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Summary */}
                    <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-2 sm:gap-3">
                      <div className="text-center p-3 rounded-xl bg-muted/40">
                        <p className="text-[10px] sm:text-xs text-muted-foreground">إجمالي الأوامر</p>
                        <p className="text-lg sm:text-xl font-bold text-foreground tabular-nums">{stats?.total || 0}</p>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-primary/5">
                        <p className="text-[10px] sm:text-xs text-muted-foreground">نسبة الإنجاز</p>
                        <p className="text-lg sm:text-xl font-bold text-primary tabular-nums">{completionRate}%</p>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Order Types */}
            <Card className="border-border" data-testid="card-order-types">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Calendar className="h-5 w-5 text-primary" />
                  أنواع الأوامر
                </CardTitle>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border" data-testid="type-daily">
                      <span className="text-sm font-medium text-foreground">يومي</span>
                      <Badge className="bg-primary/10 text-primary border-0 hover:bg-primary/10 tabular-nums">{stats?.daily || 0}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border" data-testid="type-weekly">
                      <span className="text-sm font-medium text-foreground">أسبوعي</span>
                      <Badge className="bg-primary/10 text-primary border-0 hover:bg-primary/10 tabular-nums">{stats?.weekly || 0}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border" data-testid="type-longterm">
                      <span className="text-sm font-medium text-foreground">طويل المدى</span>
                      <Badge className="bg-primary/10 text-primary border-0 hover:bg-primary/10 tabular-nums">{stats?.longTerm || 0}</Badge>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
