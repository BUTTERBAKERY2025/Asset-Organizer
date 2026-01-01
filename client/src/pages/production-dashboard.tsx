import { useEffect, useState, useCallback } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  Factory, 
  FileSpreadsheet, 
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
  Brain,
  RefreshCw,
  ChefHat,
  ShoppingCart,
  Snowflake,
  Activity,
  AlertTriangle
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { format, subDays } from "date-fns";
import { ar } from "date-fns/locale";
import type { Branch } from "@shared/schema";
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

interface SalesUpload {
  id: number;
  fileName: string;
  uploadDate: string;
  branchId: string;
  status: string;
  createdAt?: string;
}

const QUICK_ACTIONS = [
  {
    title: "الإنتاج الفعلي اليومي",
    description: "تسجيل دفعات الإنتاج على مدار اليوم",
    icon: ChefHat,
    href: "/daily-production",
    color: "from-amber-500 to-orange-600",
    badge: "جديد"
  },
  {
    title: "مخطط الإنتاج الذكي",
    description: "تخطيط الإنتاج بناءً على البيانات والتوقعات",
    icon: Brain,
    href: "/ai-production-planner",
    color: "from-purple-500 to-indigo-600",
    badge: "ذكاء اصطناعي"
  },
  {
    title: "رفع بيانات المبيعات",
    description: "استيراد بيانات المبيعات من ملفات Excel",
    icon: Upload,
    href: "/sales-data-uploads",
    color: "from-blue-500 to-cyan-600",
    badge: null
  },
  {
    title: "أوامر الإنتاج",
    description: "إدارة ومتابعة جميع أوامر الإنتاج",
    icon: ClipboardList,
    href: "/advanced-production-orders",
    color: "from-slate-500 to-gray-600",
    badge: null
  },
  {
    title: "إنشاء أمر إنتاج جديد",
    description: "إنشاء أمر إنتاج يدوي أو من توقعات",
    icon: Plus,
    href: "/advanced-production-orders/new",
    color: "from-green-500 to-emerald-600",
    badge: null
  },
  {
    title: "تقارير التشغيل",
    description: "عرض التقارير والتحليلات",
    icon: BarChart3,
    href: "/operations-reports",
    color: "from-rose-500 to-pink-600",
    badge: null
  },
  {
    title: "المنتجات",
    description: "إدارة كتالوج المنتجات والأسعار",
    icon: Package,
    href: "/products",
    color: "from-teal-500 to-green-600",
    badge: null
  }
];

export default function ProductionDashboardPage() {
  const { selectedBranch, setSelectedBranch, selectedDate, setSelectedDate } = useProductionContext();
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  
  // Initialize branch to "all" for dashboard if empty
  useEffect(() => {
    if (!selectedBranch) {
      setSelectedBranch("all");
    }
  }, [selectedBranch, setSelectedBranch]);

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<OrderStats>({
    queryKey: ["/api/advanced-production-orders/stats"],
  });

  const { data: recentUploads, isLoading: uploadsLoading } = useQuery<SalesUpload[]>({
    queryKey: ["/api/sales-data-uploads?limit=5"],
  });

  // Production Hub - unified endpoint for dashboard (includes today, yesterday, deltas, activeOrders)
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
      // Ensure target object always exists
      if (!data.target) {
        data.target = { totalTarget: 0, totalProduced: 0, gap: 0, completionRate: 0 };
      }
      return data;
    },
  });

  const dailyStats = hubData?.today;
  const prevDayStats = hubData?.yesterday;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR" }).format(amount || 0);
  };

  const completionRate = stats ? 
    Math.round((stats.completed / Math.max(stats.total, 1)) * 100) : 0;

  // Use active orders from hub (includes branch filtering)
  const activeOrders = hubData?.activeOrders ?? (stats ? stats.pending + stats.approved + stats.inProgress : 0);

  const getDiff = (current: number, previous: number) => {
    if (!previous) return { value: current, percentage: 100, direction: "up" as const };
    const diff = current - previous;
    const percentage = Math.round(Math.abs(diff / previous) * 100);
    return { value: Math.abs(diff), percentage, direction: diff >= 0 ? "up" as const : "down" as const };
  };

  const qtyDiff = getDiff(dailyStats?.totalQuantity || 0, prevDayStats?.totalQuantity || 0);
  const batchDiff = getDiff(dailyStats?.totalBatches || 0, prevDayStats?.totalBatches || 0);

  const handleRefresh = useCallback(() => {
    refetchStats();
    refetchDaily();
    setLastUpdated(new Date());
  }, [refetchStats, refetchDaily]);

  // Auto-refresh every 60 seconds when enabled
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      handleRefresh();
    }, 60000);
    return () => clearInterval(interval);
  }, [autoRefresh, handleRefresh]);

  const formatLastUpdated = () => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - lastUpdated.getTime()) / 1000);
    if (diff < 60) return `منذ ${diff} ثانية`;
    const mins = Math.floor(diff / 60);
    return `منذ ${mins} دقيقة`;
  };

  return (
    <Layout>
      <div className="space-y-6 p-6" dir="rtl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3" data-testid="page-title">
              <Factory className="h-8 w-8 text-amber-600" />
              لوحة الإنتاج
            </h1>
            <p className="text-gray-600 mt-1">مركز التحكم الشامل لإدارة الإنتاج والتوقعات</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Auto-refresh toggle */}
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
              <Switch
                id="auto-refresh"
                checked={autoRefresh}
                onCheckedChange={setAutoRefresh}
                data-testid="switch-auto-refresh"
              />
              <Label htmlFor="auto-refresh" className="text-sm text-gray-600 cursor-pointer">
                تحديث تلقائي
              </Label>
              {autoRefresh && (
                <Badge variant="secondary" className="text-xs animate-pulse">
                  كل 60 ثانية
                </Badge>
              )}
            </div>
            
            {/* Last updated indicator */}
            <span className="text-xs text-gray-500" data-testid="text-last-updated">
              {formatLastUpdated()}
            </span>
            
            <Button variant="outline" size="sm" onClick={handleRefresh} data-testid="btn-refresh">
              <RefreshCw className={`h-4 w-4 ml-2 ${dailyLoading ? 'animate-spin' : ''}`} />
              تحديث
            </Button>
            <Link href="/advanced-production-orders/new">
              <Button className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700" data-testid="btn-new-order">
                <Plus className="h-4 w-4 ml-2" />
                أمر إنتاج جديد
              </Button>
            </Link>
          </div>
        </div>

        {/* Branch and Date Filters */}
        <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2 min-w-[180px]">
                <Label className="text-amber-800">الفرع</Label>
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger className="bg-white border-amber-200">
                    <SelectValue placeholder="كل الفروع" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الفروع</SelectItem>
                    {branches?.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-amber-800">التاريخ</Label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-[160px] bg-white border-amber-200"
                />
              </div>
              <div className="text-sm text-amber-700">
                {format(new Date(selectedDate), "EEEE dd MMMM yyyy", { locale: ar })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Daily Production Performance */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="border-r-4 border-r-green-500 bg-gradient-to-br from-green-50 to-white" data-testid="card-daily-qty">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">إنتاج اليوم</p>
                  {dailyLoading ? (
                    <Skeleton className="h-8 w-20 mt-1" />
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="text-3xl font-bold text-green-700">{dailyStats?.totalQuantity || 0}</p>
                      {prevDayStats && (prevDayStats.totalQuantity || 0) > 0 && (
                        <Badge variant={qtyDiff.direction === "up" ? "default" : "destructive"} className="text-xs gap-1">
                          {qtyDiff.direction === "up" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {qtyDiff.percentage}%
                        </Badge>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-gray-500">قطعة</p>
                </div>
                <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                  <Activity className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-r-4 border-r-amber-500 bg-gradient-to-br from-amber-50 to-white" data-testid="card-daily-batches">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">دفعات اليوم</p>
                  {dailyLoading ? (
                    <Skeleton className="h-8 w-16 mt-1" />
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="text-3xl font-bold text-amber-700">{dailyStats?.totalBatches || 0}</p>
                      {prevDayStats && (prevDayStats.totalBatches || 0) > 0 && (
                        <Badge variant={batchDiff.direction === "up" ? "default" : "destructive"} className="text-xs gap-1">
                          {batchDiff.direction === "up" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {batchDiff.percentage}%
                        </Badge>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-gray-500">دفعة</p>
                </div>
                <div className="h-12 w-12 bg-amber-100 rounded-full flex items-center justify-center">
                  <Package className="h-6 w-6 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-r-4 border-r-blue-500 bg-gradient-to-br from-blue-50 to-white" data-testid="card-display">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">بار العرض</p>
                  {dailyLoading ? (
                    <Skeleton className="h-8 w-16 mt-1" />
                  ) : (
                    <p className="text-3xl font-bold text-blue-700">{dailyStats?.byDestination?.display_bar || 0}</p>
                  )}
                  <p className="text-xs text-gray-500">قطعة</p>
                </div>
                <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <ShoppingCart className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-r-4 border-r-cyan-500 bg-gradient-to-br from-cyan-50 to-white" data-testid="card-storage">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">التخزين</p>
                  {dailyLoading ? (
                    <Skeleton className="h-8 w-16 mt-1" />
                  ) : (
                    <p className="text-3xl font-bold text-cyan-700">
                      {(dailyStats?.byDestination?.freezer || 0) + (dailyStats?.byDestination?.refrigerator || 0)}
                    </p>
                  )}
                  <p className="text-xs text-gray-500">قطعة</p>
                </div>
                <div className="h-12 w-12 bg-cyan-100 rounded-full flex items-center justify-center">
                  <Snowflake className="h-6 w-6 text-cyan-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-r-4 border-r-purple-500 bg-gradient-to-br from-purple-50 to-white" data-testid="card-active-orders">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">أوامر نشطة</p>
                  {statsLoading ? (
                    <Skeleton className="h-8 w-16 mt-1" />
                  ) : (
                    <p className="text-3xl font-bold text-purple-700">{activeOrders}</p>
                  )}
                  <p className="text-xs text-gray-500">أمر</p>
                </div>
                <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <Clock className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Smart Production Dashboard - Target vs Actual */}
        {hubData?.target && hubData.target.totalTarget > 0 && (
          <Card className="border-2 border-amber-200 bg-gradient-to-r from-amber-50 via-white to-orange-50" data-testid="card-target-vs-actual">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg text-amber-800">
                <Target className="h-5 w-5" />
                لوحة الإنتاج الموحدة
              </CardTitle>
              <CardDescription>الهدف مقابل الإنتاج الفعلي</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Main stats row */}
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div className="bg-white rounded-lg p-3 shadow-sm border">
                    <p className="text-xs text-gray-500 mb-1">الهدف</p>
                    <p className="text-2xl font-bold text-gray-800">{hubData.target.totalTarget}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 shadow-sm border">
                    <p className="text-xs text-gray-500 mb-1">المُنتَج</p>
                    <p className="text-2xl font-bold text-green-600">{hubData.target.totalProduced}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 shadow-sm border">
                    <p className="text-xs text-gray-500 mb-1">الفرق</p>
                    <p className={`text-2xl font-bold ${hubData.target.gap > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {hubData.target.gap > 0 ? `-${hubData.target.gap}` : hubData.target.gap === 0 ? '0' : `+${Math.abs(hubData.target.gap)}`}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-3 shadow-sm border">
                    <p className="text-xs text-gray-500 mb-1">نسبة الإنجاز</p>
                    <p className={`text-2xl font-bold ${hubData.target.completionRate >= 100 ? 'text-green-600' : hubData.target.completionRate >= 80 ? 'text-amber-600' : 'text-red-600'}`}>
                      {hubData.target.completionRate}%
                    </p>
                  </div>
                </div>

                {/* Enhanced Progress bar with color coding */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600 flex items-center gap-2">
                      التقدم نحو الهدف
                      {hubData.target.completionRate >= 100 && (
                        <Badge className="bg-green-100 text-green-700 text-xs">تم تحقيق الهدف</Badge>
                      )}
                      {hubData.target.completionRate >= 80 && hubData.target.completionRate < 100 && (
                        <Badge className="bg-amber-100 text-amber-700 text-xs">قريب من الهدف</Badge>
                      )}
                      {hubData.target.completionRate < 80 && hubData.target.completionRate > 0 && (
                        <Badge className="bg-red-100 text-red-700 text-xs">يحتاج متابعة</Badge>
                      )}
                    </span>
                    <span className={`font-bold text-lg ${
                      hubData.target.completionRate >= 100 ? 'text-green-600' : 
                      hubData.target.completionRate >= 80 ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {hubData.target.completionRate}%
                    </span>
                  </div>
                  <div className="relative">
                    <Progress 
                      value={Math.min(hubData.target.completionRate, 100)} 
                      className={`h-5 ${
                        hubData.target.completionRate >= 100 ? '[&>div]:bg-green-500' : 
                        hubData.target.completionRate >= 80 ? '[&>div]:bg-amber-500' : '[&>div]:bg-red-500'
                      }`}
                    />
                    {hubData.target.completionRate > 100 && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-medium text-white drop-shadow">
                          +{hubData.target.completionRate - 100}% إضافي
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>0</span>
                    <span>الهدف: {hubData.target.totalTarget} قطعة</span>
                    <span>100%</span>
                  </div>
                </div>

                {/* Comparison with yesterday */}
                <div className="flex items-center gap-4 pt-2 border-t">
                  <div className="flex items-center gap-2 text-sm">
                    {qtyDiff.direction === "up" ? (
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    )}
                    <span className="text-gray-600">مقارنة مع أمس:</span>
                    <span className={`font-medium ${qtyDiff.direction === "up" ? 'text-green-600' : 'text-red-600'}`}>
                      {qtyDiff.direction === "up" ? '+' : '-'}{qtyDiff.percentage}%
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Comparison Chart - Today vs Yesterday vs Target */}
        {hubData && (dailyStats?.totalQuantity || prevDayStats?.totalQuantity || (hubData.target && hubData.target.totalTarget > 0)) && (
          <Card className="border-indigo-200" data-testid="card-comparison-chart">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg text-indigo-800">
                <BarChart3 className="h-5 w-5" />
                مقارنة الإنتاج
              </CardTitle>
              <CardDescription>اليوم مقابل أمس والهدف</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart
                  data={[
                    {
                      name: "الإجمالي",
                      اليوم: dailyStats?.totalQuantity || 0,
                      أمس: prevDayStats?.totalQuantity || 0,
                      الهدف: hubData.target?.totalTarget || 0
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
                  ]}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="اليوم" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="أمس" fill="#6b7280" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="الهدف" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Orders Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-slate-50 to-white" data-testid="card-total-orders">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center">
                  <ClipboardList className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">إجمالي الأوامر</p>
                  {statsLoading ? <Skeleton className="h-6 w-12" /> : (
                    <p className="text-xl font-bold text-slate-700">{stats?.total || 0}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-white" data-testid="card-completed">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">مكتملة</p>
                  {statsLoading ? <Skeleton className="h-6 w-12" /> : (
                    <p className="text-xl font-bold text-green-700">{stats?.completed || 0}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-white" data-testid="card-estimated-cost">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-amber-100 rounded-full flex items-center justify-center">
                  <Target className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">التكلفة المتوقعة</p>
                  {statsLoading ? <Skeleton className="h-6 w-20" /> : (
                    <p className="text-lg font-bold text-amber-700">{formatCurrency(stats?.totalEstimatedCost || 0)}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-indigo-50 to-white" data-testid="card-completion-rate">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-indigo-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500">نسبة الإنجاز</p>
                  {statsLoading ? <Skeleton className="h-6 w-12" /> : (
                    <div className="flex items-center gap-2">
                      <p className="text-xl font-bold text-indigo-700">{completionRate}%</p>
                      <Progress value={completionRate} className="h-2 flex-1" />
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card data-testid="card-quick-actions">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-amber-500" />
                  الوصول السريع
                </CardTitle>
                <CardDescription>اختصارات لجميع وظائف الإنتاج</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {QUICK_ACTIONS.map((action, index) => (
                    <Link key={index} href={action.href}>
                      <Card 
                        className="cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-0 overflow-hidden group"
                        data-testid={`quick-action-${index}`}
                      >
                        <div className={`h-2 bg-gradient-to-r ${action.color}`} />
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className={`h-10 w-10 rounded-lg bg-gradient-to-r ${action.color} flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform`}>
                              <action.icon className="h-5 w-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-gray-900 text-sm truncate">{action.title}</h3>
                                {action.badge && (
                                  <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700">
                                    {action.badge}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{action.description}</p>
                            </div>
                            <ArrowUpRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card data-testid="card-order-status">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-5 w-5 text-amber-500" />
                  حالة الأوامر
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {statsLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-8 w-full" />
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-gray-400" />
                        <span className="text-sm">مسودة</span>
                      </div>
                      <Badge variant="secondary">{stats?.draft || 0}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-yellow-50">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-yellow-500" />
                        <span className="text-sm">قيد الانتظار</span>
                      </div>
                      <Badge className="bg-yellow-100 text-yellow-800">{stats?.pending || 0}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-blue-50">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-blue-500" />
                        <span className="text-sm">معتمد</span>
                      </div>
                      <Badge className="bg-blue-100 text-blue-800">{stats?.approved || 0}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-purple-50">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-purple-500" />
                        <span className="text-sm">قيد التنفيذ</span>
                      </div>
                      <Badge className="bg-purple-100 text-purple-800">{stats?.inProgress || 0}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-green-50">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-green-500" />
                        <span className="text-sm">مكتمل</span>
                      </div>
                      <Badge className="bg-green-100 text-green-800">{stats?.completed || 0}</Badge>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-order-types">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-amber-500" />
                  أنواع الأوامر
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {statsLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-8 w-full" />
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50">
                      <span className="text-sm">يومي</span>
                      <Badge className="bg-amber-100 text-amber-800">{stats?.daily || 0}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-indigo-50">
                      <span className="text-sm">أسبوعي</span>
                      <Badge className="bg-indigo-100 text-indigo-800">{stats?.weekly || 0}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-teal-50">
                      <span className="text-sm">طويل الأمد</span>
                      <Badge className="bg-teal-100 text-teal-800">{stats?.longTerm || 0}</Badge>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <Card data-testid="card-recent-uploads">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-amber-500" />
                  آخر عمليات رفع البيانات
                </CardTitle>
                <CardDescription>أحدث ملفات المبيعات المرفوعة</CardDescription>
              </div>
              <Link href="/sales-data-uploads">
                <Button variant="outline" size="sm" data-testid="btn-view-all-uploads">
                  عرض الكل
                  <ArrowUpRight className="h-4 w-4 mr-2" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {uploadsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : recentUploads && recentUploads.length > 0 ? (
              <div className="space-y-2">
                {recentUploads.slice(0, 5).map((upload) => (
                  <div key={upload.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 bg-green-100 rounded-lg flex items-center justify-center">
                        <FileSpreadsheet className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{upload.fileName}</p>
                        <p className="text-xs text-gray-500">{upload.branchId}</p>
                      </div>
                    </div>
                    <div className="text-left">
                      <Badge variant={upload.status === "processed" ? "default" : "secondary"}>
                        {upload.status === "processed" ? "تمت المعالجة" : upload.status}
                      </Badge>
                      <p className="text-xs text-gray-500 mt-1">
                        {upload.createdAt ? format(new Date(upload.createdAt), "dd/MM/yyyy") : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Upload className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p>لا توجد عمليات رفع حديثة</p>
                <Link href="/sales-data-uploads">
                  <Button variant="link" className="mt-2">رفع بيانات جديدة</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
