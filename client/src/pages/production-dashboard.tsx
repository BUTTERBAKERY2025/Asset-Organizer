import { useEffect, useCallback } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useBranches } from "@/hooks/useBranches";
import { 
  Factory, 
  ClipboardList, 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  Upload, 
  Plus, 
  Calendar, 
  CheckCircle, 
  Clock, 
  ArrowUpRight,
  Package,
  Target,
  Zap,
  RefreshCw,
  ChefHat,
  ShoppingCart,
  Snowflake,
  Activity,
  Trash2,
  CreditCard,
  FileBarChart2,
  LayoutDashboard,
  Settings2,
  Layers
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
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

const QUICK_ACTIONS = [
  {
    title: "الإنتاج اليومي",
    description: "تسجيل دفعات الإنتاج",
    icon: ChefHat,
    href: "/daily-production",
    color: "bg-gradient-to-br from-amber-500 to-orange-600",
    badge: "جديد"
  },
  {
    title: "رفع المبيعات",
    description: "استيراد من Excel",
    icon: Upload,
    href: "/sales-data-uploads",
    color: "bg-gradient-to-br from-blue-500 to-cyan-600",
    badge: null
  },
  {
    title: "أوامر الإنتاج",
    description: "إدارة ومتابعة",
    icon: ClipboardList,
    href: "/advanced-production-orders",
    color: "bg-gradient-to-br from-slate-600 to-gray-700",
    badge: null
  },
  {
    title: "أمر جديد",
    description: "إنشاء أمر إنتاج",
    icon: Plus,
    href: "/advanced-production-orders/new",
    color: "bg-gradient-to-br from-green-500 to-emerald-600",
    badge: null
  },
  {
    title: "التقارير",
    description: "تقارير شاملة",
    icon: FileBarChart2,
    href: "/production-reports",
    color: "bg-gradient-to-br from-rose-500 to-pink-600",
    badge: "جديد"
  },
  {
    title: "تقارير التشغيل",
    description: "التحليلات",
    icon: BarChart3,
    href: "/operations-reports",
    color: "bg-gradient-to-br from-indigo-500 to-violet-600",
    badge: null
  },
  {
    title: "المنتجات",
    description: "كتالوج المنتجات",
    icon: Package,
    href: "/products",
    color: "bg-gradient-to-br from-teal-500 to-green-600",
    badge: null
  },
  {
    title: "مخزون الإنتاج النهائي",
    description: "متابعة المخزون النهائي",
    icon: Layers,
    href: "/finished-goods-inventory",
    color: "bg-gradient-to-br from-purple-500 to-fuchsia-600",
    badge: "جديد"
  }
];

const COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444'];

export default function ProductionDashboardPage() {
  const { 
    selectedBranch, setSelectedBranch, 
    selectedDate, setSelectedDate,
    autoRefresh, setAutoRefresh,
    lastUpdated,
    commandCenterData,
    isLoading: commandCenterLoading,
    refetch: refetchCommandCenter
  } = useProductionContext();
  
  useEffect(() => {
    if (!selectedBranch) {
      setSelectedBranch("all");
    }
  }, [selectedBranch, setSelectedBranch]);

  const { branches, userBranchId, canSelectBranch } = useBranches();

  useEffect(() => {
    if (userBranchId && !selectedBranch) {
      setSelectedBranch(userBranchId);
    }
  }, [userBranchId, selectedBranch, setSelectedBranch]);

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<OrderStats>({
    queryKey: ["/api/advanced-production-orders/stats", selectedBranch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBranch && selectedBranch !== "all") {
        params.set("branchId", selectedBranch);
      }
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
      if (!data.target) {
        data.target = { totalTarget: 0, totalProduced: 0, gap: 0, completionRate: 0 };
      }
      return data;
    },
    enabled: !!selectedBranch && !!selectedDate,
    staleTime: 1000 * 30,
    refetchInterval: autoRefresh ? 60000 : false,
    placeholderData: (prev) => prev,
  });

  const dailyStats = hubData?.today;
  const prevDayStats = hubData?.yesterday;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ar-SA", { style: "decimal", maximumFractionDigits: 0 }).format(amount || 0) + " ر.س";
  };

  const completionRate = stats ? 
    Math.round((stats.completed / Math.max(stats.total, 1)) * 100) : 0;

  const activeOrders = hubData?.activeOrders ?? (stats ? stats.pending + stats.approved + stats.inProgress : 0);

  const getDiff = (current: number, previous: number) => {
    if (!previous) return { value: current, percentage: 0, direction: "up" as const };
    const diff = current - previous;
    const percentage = Math.round(Math.abs(diff / previous) * 100);
    return { value: Math.abs(diff), percentage, direction: diff >= 0 ? "up" as const : "down" as const };
  };

  const qtyDiff = getDiff(dailyStats?.totalQuantity || 0, prevDayStats?.totalQuantity || 0);
  const batchDiff = getDiff(dailyStats?.totalBatches || 0, prevDayStats?.totalBatches || 0);

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

  const orderStatusData = stats ? [
    { name: 'مكتمل', value: stats.completed, color: '#10b981' },
    { name: 'قيد التنفيذ', value: stats.inProgress, color: '#8b5cf6' },
    { name: 'معتمد', value: stats.approved, color: '#3b82f6' },
    { name: 'قيد الانتظار', value: stats.pending, color: '#f59e0b' },
    { name: 'مسودة', value: stats.draft, color: '#6b7280' },
  ].filter(item => item.value > 0) : [];

  const comparisonData = [
    {
      name: "الإجمالي",
      اليوم: dailyStats?.totalQuantity || 0,
      أمس: prevDayStats?.totalQuantity || 0,
      الهدف: hubData?.target?.totalTarget || 0
    },
    {
      name: "بار العرض",
      اليوم: dailyStats?.byDestination?.display_bar || 0,
      أمس: prevDayStats?.byDestination?.display_bar || 0,
      الهدف: 0
    },
    {
      name: "التخزين",
      اليوم: (dailyStats?.byDestination?.freezer || 0) + (dailyStats?.byDestination?.refrigerator || 0),
      أمس: (prevDayStats?.byDestination?.freezer || 0) + (prevDayStats?.byDestination?.refrigerator || 0),
      الهدف: 0
    }
  ];

  return (
    <Layout>
      <div className="p-3 sm:p-4 md:p-6 max-w-6xl mx-auto space-y-4 md:space-y-6" dir="rtl">
          
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
                <Factory className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground" data-testid="page-title">
                  لوحة الإنتاج
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {format(new Date(selectedDate), "EEEE، dd MMMM yyyy", { locale: ar })}
                  {lastUpdated && <span className="mr-2 text-green-600">• {formatLastUpdated()}</span>}
                </p>
              </div>
            </div>
              
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <Select value={selectedBranch} onValueChange={setSelectedBranch} disabled={!canSelectBranch}>
                <SelectTrigger className="w-[130px] sm:w-[160px] h-11 sm:h-10">
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
              />
              
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant={autoRefresh ? "default" : "outline"} 
                      size="icon" 
                      onClick={() => setAutoRefresh(!autoRefresh)} 
                      data-testid="btn-auto-refresh" 
                      className={`h-11 w-11 sm:h-10 sm:w-10 ${autoRefresh ? 'bg-green-600 hover:bg-green-700' : ''}`}
                    >
                      <Activity className={`h-4 w-4 ${autoRefresh ? 'animate-pulse text-white' : ''}`} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>{autoRefresh ? 'التحديث التلقائي مفعّل (كل دقيقة)' : 'تفعيل التحديث التلقائي'}</p>
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
              
              <Button variant="outline" size="icon" onClick={handleRefresh} data-testid="btn-refresh" className="h-11 w-11 sm:h-10 sm:w-10">
                <RefreshCw className={`h-4 w-4 ${dailyLoading ? 'animate-spin' : ''}`} />
              </Button>
              
              <Link href="/advanced-production-orders/new">
                <Button data-testid="btn-new-order" className="h-11 sm:h-10 text-sm">
                  <Plus className="h-4 w-4 ml-1" />
                  <span className="hidden sm:inline">أمر جديد</span>
                  <span className="sm:hidden">جديد</span>
                </Button>
              </Link>
            </div>
          </div>

          {/* Main KPIs Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
            {/* Production Today */}
            <Card className="overflow-hidden" data-testid="card-daily-qty">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">إنتاج اليوم</p>
                    {dailyLoading ? (
                      <Skeleton className="h-6 sm:h-8 w-16 sm:w-20 mt-1" />
                    ) : (
                      <p className="text-xl sm:text-2xl font-bold">{dailyStats?.totalQuantity || 0}</p>
                    )}
                  </div>
                  <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl bg-green-100 flex items-center justify-center">
                    <Activity className="w-4 h-4 sm:w-6 sm:h-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Batches Today */}
            <Card className="overflow-hidden" data-testid="card-daily-batches">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">الدفعات</p>
                    {dailyLoading ? (
                      <Skeleton className="h-6 sm:h-8 w-12 sm:w-16 mt-1" />
                    ) : (
                      <p className="text-xl sm:text-2xl font-bold">{dailyStats?.totalBatches || 0}</p>
                    )}
                  </div>
                  <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                    <Package className="w-4 h-4 sm:w-6 sm:h-6 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Display Bar */}
            <Card className="overflow-hidden" data-testid="card-display">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">بار العرض</p>
                    {dailyLoading ? (
                      <Skeleton className="h-6 sm:h-8 w-12 sm:w-16 mt-1" />
                    ) : (
                      <p className="text-xl sm:text-2xl font-bold">{dailyStats?.byDestination?.display_bar || 0}</p>
                    )}
                  </div>
                  <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                    <ShoppingCart className="w-4 h-4 sm:w-6 sm:h-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Active Orders */}
            <Card className="overflow-hidden" data-testid="card-active-orders">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">أوامر نشطة</p>
                    {statsLoading ? (
                      <Skeleton className="h-6 sm:h-8 w-10 sm:w-12 mt-1" />
                    ) : (
                      <p className="text-xl sm:text-2xl font-bold">{hubData?.activeOrders || 0}</p>
                    )}
                  </div>
                  <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                    <Clock className="w-4 h-4 sm:w-6 sm:h-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Target Progress Card */}
          <Card data-testid="card-target-vs-actual">
            <CardContent className="p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="h-8 w-8 sm:h-10 sm:w-10 bg-amber-100 rounded-xl flex items-center justify-center">
                    <Target className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm sm:text-base text-slate-800">الهدف مقابل الإنتاج الفعلي</h3>
                    <p className="text-[10px] sm:text-xs text-slate-500">متابعة تحقيق الأهداف اليومية</p>
                  </div>
                </div>
                  <div className="sm:mr-auto">
                    {hubData?.target && hubData.target.totalTarget > 0 && hubData.target.completionRate >= 100 && (
                      <Badge className="bg-green-500 text-white text-[10px] sm:text-xs">تم تحقيق الهدف</Badge>
                    )}
                    {hubData?.target && hubData.target.totalTarget > 0 && hubData.target.completionRate >= 80 && hubData.target.completionRate < 100 && (
                      <Badge className="bg-amber-500 text-white text-[10px] sm:text-xs">قريب من الهدف</Badge>
                    )}
                    {hubData?.target && hubData.target.totalTarget > 0 && hubData.target.completionRate < 80 && hubData.target.completionRate > 0 && (
                      <Badge className="bg-red-500 text-white text-[10px] sm:text-xs">يحتاج متابعة</Badge>
                    )}
                  </div>
                </div>
                
                {hubData?.target && hubData.target.totalTarget > 0 ? (
                  <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
                      <div className="bg-white rounded-xl p-2 sm:p-4 text-center shadow-sm border border-slate-100">
                        <p className="text-[10px] sm:text-xs text-slate-500 mb-1">الهدف</p>
                        <p className="text-lg sm:text-2xl font-bold text-slate-800">{hubData.target.totalTarget}</p>
                      </div>
                      <div className="bg-white rounded-xl p-2 sm:p-4 text-center shadow-sm border border-green-100">
                        <p className="text-[10px] sm:text-xs text-slate-500 mb-1">المُنتَج</p>
                        <p className="text-lg sm:text-2xl font-bold text-green-600">{hubData.target.totalProduced}</p>
                      </div>
                      <div className="bg-white rounded-xl p-2 sm:p-4 text-center shadow-sm border border-slate-100">
                        <p className="text-[10px] sm:text-xs text-slate-500 mb-1">الفرق</p>
                        <p className={`text-lg sm:text-2xl font-bold ${hubData.target.gap > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {hubData.target.gap > 0 ? `-${hubData.target.gap}` : hubData.target.gap === 0 ? '0' : `+${Math.abs(hubData.target.gap)}`}
                        </p>
                      </div>
                      <div className="bg-white rounded-xl p-2 sm:p-4 text-center shadow-sm border border-amber-100">
                        <p className="text-[10px] sm:text-xs text-slate-500 mb-1">نسبة الإنجاز</p>
                        <p className={`text-lg sm:text-2xl font-bold ${
                          hubData.target.completionRate >= 100 ? 'text-green-600' : 
                          hubData.target.completionRate >= 80 ? 'text-amber-600' : 'text-red-600'
                        }`}>
                          {hubData.target.completionRate}%
                        </p>
                      </div>
                    </div>

                    <div className="relative">
                      <Progress 
                        value={Math.min(hubData.target.completionRate, 100)} 
                        className={`h-4 rounded-full ${
                          hubData.target.completionRate >= 100 ? '[&>div]:bg-gradient-to-r [&>div]:from-green-500 [&>div]:to-emerald-500' : 
                          hubData.target.completionRate >= 80 ? '[&>div]:bg-gradient-to-r [&>div]:from-amber-500 [&>div]:to-orange-500' : 
                          '[&>div]:bg-gradient-to-r [&>div]:from-red-500 [&>div]:to-rose-500'
                        }`}
                      />
                      <div className="flex justify-between text-xs text-slate-400 mt-2">
                        <span>0%</span>
                        <span>{hubData.target.totalTarget} قطعة</span>
                        <span>100%</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-6 text-slate-400">
                    <Target className="h-10 w-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">لا توجد أهداف إنتاج مُعدّة لهذا التاريخ</p>
                    <p className="text-xs mt-1">يمكنك إنشاء أمر إنتاج جديد لتحديد الأهداف</p>
                  </div>
                )}
              </CardContent>
            </Card>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Column - Charts & Command Center */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Command Center */}
              <Card className="border-0 shadow-md" data-testid="card-command-center">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <LayoutDashboard className="h-5 w-5 text-slate-600" />
                    مركز القيادة الموحد
                  </CardTitle>
                  <CardDescription>نظرة شاملة على جميع العمليات</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Waste KPI */}
                    <Link href="/display-bar-waste" className="block group" data-testid="card-waste-kpi">
                      <div className="rounded-xl border-2 border-red-100 bg-gradient-to-br from-red-50 to-white p-4 hover:border-red-300 hover:shadow-md transition-all cursor-pointer">
                        <div className="flex items-center justify-between mb-3">
                          <div className="h-10 w-10 bg-red-100 rounded-xl flex items-center justify-center">
                            <Trash2 className="h-5 w-5 text-red-600" />
                          </div>
                          <ArrowUpRight className="h-4 w-4 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <h4 className="font-semibold text-red-800 mb-2">الهدر</h4>
                        {commandCenterLoading ? (
                          <Skeleton className="h-12 w-full" />
                        ) : (
                          <div className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-500">التقارير</span>
                              <span className="font-bold text-red-700">{commandCenterData?.waste?.totalReports || 0}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-500">الكمية</span>
                              <span className="font-medium text-slate-700">{commandCenterData?.waste?.totalWastedQuantity || 0}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-500">القيمة</span>
                              <span className="font-medium text-red-600">{formatCurrency(commandCenterData?.waste?.totalWastedValue || 0)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </Link>

                    {/* Comparison KPI */}
                    <Link href="/production-comparisons">
                      <div className="rounded-xl border-2 border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-4 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer" data-testid="card-comparison-kpi">
                        <div className="flex items-center justify-between mb-3">
                          <div className="h-10 w-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                            <BarChart3 className="h-5 w-5 text-indigo-600" />
                          </div>
                          <ArrowUpRight className="h-4 w-4 text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <h4 className="font-semibold text-indigo-800 mb-2">المقارنات</h4>
                        {commandCenterLoading ? (
                          <Skeleton className="h-12 w-full" />
                        ) : (
                          <div className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-500">الإنتاج</span>
                              <span className={`font-bold ${(commandCenterData?.comparison?.productionVsYesterday || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {(commandCenterData?.comparison?.productionVsYesterday || 0) >= 0 ? '+' : ''}{(commandCenterData?.comparison?.productionVsYesterday || 0).toFixed(0)}%
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-500">المبيعات</span>
                              <span className={`font-bold ${(commandCenterData?.comparison?.salesVsYesterday || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {(commandCenterData?.comparison?.salesVsYesterday || 0) >= 0 ? '+' : ''}{(commandCenterData?.comparison?.salesVsYesterday || 0).toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </Link>
                  </div>
                </CardContent>
              </Card>

              {/* Comparison Chart */}
              <Card className="border-0 shadow-md" data-testid="card-comparison-chart">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Layers className="h-5 w-5 text-indigo-600" />
                    مقارنة الإنتاج
                  </CardTitle>
                  <CardDescription>اليوم مقابل أمس والهدف</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={comparisonData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'white', 
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                        }} 
                      />
                      <Legend />
                      <Bar dataKey="اليوم" fill="#10b981" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="أمس" fill="#94a3b8" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="الهدف" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Quick Actions & Order Status */}
            <div className="space-y-6">
              
              {/* Quick Actions */}
              <Card className="border-0 shadow-md" data-testid="card-quick-actions">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Zap className="h-5 w-5 text-amber-500" />
                    الوصول السريع
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    {QUICK_ACTIONS.map((action, index) => (
                      <Link key={index} href={action.href}>
                        <div 
                          className="group relative p-3 rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-md transition-all cursor-pointer bg-white"
                          data-testid={`quick-action-${index}`}
                        >
                          <div className={`h-9 w-9 ${action.color} rounded-lg flex items-center justify-center mb-2 group-hover:scale-110 transition-transform shadow-sm`}>
                            <action.icon className="h-4 w-4 text-white" />
                          </div>
                          <h4 className="text-xs font-semibold text-slate-700 mb-0.5">{action.title}</h4>
                          <p className="text-[10px] text-slate-400 line-clamp-1">{action.description}</p>
                          {action.badge && (
                            <Badge className="absolute top-2 left-2 text-[9px] px-1.5 py-0 bg-purple-100 text-purple-700 border-0">
                              {action.badge}
                            </Badge>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Order Status with Pie Chart */}
              <Card className="border-0 shadow-md" data-testid="card-order-status">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Settings2 className="h-5 w-5 text-slate-600" />
                    حالة الأوامر
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {statsLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-10 w-full" />
                      ))}
                    </div>
                  ) : stats?.total === 0 ? (
                    <div className="text-center py-6 text-slate-400">
                      <ClipboardList className="h-10 w-10 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">لا توجد أوامر إنتاج حالياً</p>
                    </div>
                  ) : (
                    <>
                      {orderStatusData.length > 0 && (
                        <div className="h-40 mb-4">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={orderStatusData}
                                cx="50%"
                                cy="50%"
                                innerRadius={40}
                                outerRadius={60}
                                paddingAngle={3}
                                dataKey="value"
                              >
                                {orderStatusData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-green-50 border border-green-100">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span className="text-sm text-slate-700">مكتمل</span>
                          </div>
                          <Badge className="bg-green-100 text-green-800 border-0">{stats?.completed || 0}</Badge>
                        </div>
                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-purple-50 border border-purple-100">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-purple-600" />
                            <span className="text-sm text-slate-700">قيد التنفيذ</span>
                          </div>
                          <Badge className="bg-purple-100 text-purple-800 border-0">{stats?.inProgress || 0}</Badge>
                        </div>
                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-blue-50 border border-blue-100">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-blue-600" />
                            <span className="text-sm text-slate-700">معتمد</span>
                          </div>
                          <Badge className="bg-blue-100 text-blue-800 border-0">{stats?.approved || 0}</Badge>
                        </div>
                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-50 border border-amber-100">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-amber-600" />
                            <span className="text-sm text-slate-700">قيد الانتظار</span>
                          </div>
                          <Badge className="bg-amber-100 text-amber-800 border-0">{stats?.pending || 0}</Badge>
                        </div>
                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                          <div className="flex items-center gap-2">
                            <div className="h-4 w-4 rounded-full bg-slate-400" />
                            <span className="text-sm text-slate-700">مسودة</span>
                          </div>
                          <Badge className="bg-slate-100 text-slate-800 border-0">{stats?.draft || 0}</Badge>
                        </div>
                      </div>
                      
                      {/* Summary Stats */}
                      <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3">
                        <div className="text-center p-3 bg-slate-50 rounded-xl">
                          <p className="text-xs text-slate-500">إجمالي الأوامر</p>
                          <p className="text-xl font-bold text-slate-800">{stats?.total || 0}</p>
                        </div>
                        <div className="text-center p-3 bg-amber-50 rounded-xl">
                          <p className="text-xs text-slate-500">نسبة الإنجاز</p>
                          <p className="text-xl font-bold text-amber-700">{completionRate}%</p>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Order Types */}
              <Card className="border-0 shadow-md" data-testid="card-order-types">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Calendar className="h-5 w-5 text-amber-500" />
                    أنواع الأوامر
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {statsLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-10 w-full" />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 border border-amber-100">
                        <span className="text-sm font-medium text-slate-700">يومي</span>
                        <Badge className="bg-amber-100 text-amber-800 border-0">{stats?.daily || 0}</Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-indigo-50 border border-indigo-100">
                        <span className="text-sm font-medium text-slate-700">أسبوعي</span>
                        <Badge className="bg-indigo-100 text-indigo-800 border-0">{stats?.weekly || 0}</Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-teal-50 border border-teal-100">
                        <span className="text-sm font-medium text-slate-700">طويل المدى</span>
                        <Badge className="bg-teal-100 text-teal-800 border-0">{stats?.longTerm || 0}</Badge>
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
