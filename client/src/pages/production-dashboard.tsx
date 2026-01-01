import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Skeleton } from "@/components/ui/skeleton";
import { format, subDays } from "date-fns";
import { ar } from "date-fns/locale";
import type { Branch } from "@shared/schema";

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
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<OrderStats>({
    queryKey: ["/api/advanced-production-orders/stats"],
  });

  const { data: recentUploads, isLoading: uploadsLoading } = useQuery<SalesUpload[]>({
    queryKey: ["/api/sales-data-uploads?limit=5"],
  });

  // Daily production stats for selected branch
  const { data: dailyStats, isLoading: dailyLoading, refetch: refetchDaily } = useQuery<DailyStats>({
    queryKey: ["/api/daily-production/stats", selectedBranch, selectedDate],
    queryFn: async () => {
      if (selectedBranch === "all") {
        // Aggregate all branches
        const allStats: DailyStats = { totalBatches: 0, totalQuantity: 0, byDestination: {}, byCategory: {}, byHour: {} };
        if (!branches) return allStats;
        
        for (const branch of branches) {
          try {
            const params = new URLSearchParams({ branchId: branch.id, date: selectedDate });
            const res = await fetch(`/api/daily-production/stats?${params}`, { credentials: "include" });
            if (res.ok) {
              const branchStats: DailyStats = await res.json();
              allStats.totalBatches += branchStats.totalBatches || 0;
              allStats.totalQuantity += branchStats.totalQuantity || 0;
              for (const [k, v] of Object.entries(branchStats.byDestination || {})) {
                allStats.byDestination[k] = (allStats.byDestination[k] || 0) + v;
              }
            }
          } catch {}
        }
        return allStats;
      }
      const params = new URLSearchParams({ branchId: selectedBranch, date: selectedDate });
      const res = await fetch(`/api/daily-production/stats?${params}`, { credentials: "include" });
      if (!res.ok) return { totalBatches: 0, totalQuantity: 0, byDestination: {}, byCategory: {}, byHour: {} };
      return res.json();
    },
    enabled: true,
  });

  // Previous day stats for comparison
  const previousDate = format(subDays(new Date(selectedDate), 1), "yyyy-MM-dd");
  const { data: prevDayStats } = useQuery<DailyStats>({
    queryKey: ["/api/daily-production/stats", selectedBranch, previousDate],
    queryFn: async () => {
      if (selectedBranch === "all" && branches) {
        const allStats: DailyStats = { totalBatches: 0, totalQuantity: 0, byDestination: {}, byCategory: {}, byHour: {} };
        for (const branch of branches) {
          try {
            const params = new URLSearchParams({ branchId: branch.id, date: previousDate });
            const res = await fetch(`/api/daily-production/stats?${params}`, { credentials: "include" });
            if (res.ok) {
              const branchStats: DailyStats = await res.json();
              allStats.totalBatches += branchStats.totalBatches || 0;
              allStats.totalQuantity += branchStats.totalQuantity || 0;
            }
          } catch {}
        }
        return allStats;
      }
      if (selectedBranch === "all") return { totalBatches: 0, totalQuantity: 0, byDestination: {}, byCategory: {}, byHour: {} };
      const params = new URLSearchParams({ branchId: selectedBranch, date: previousDate });
      const res = await fetch(`/api/daily-production/stats?${params}`, { credentials: "include" });
      if (!res.ok) return { totalBatches: 0, totalQuantity: 0, byDestination: {}, byCategory: {}, byHour: {} };
      return res.json();
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR" }).format(amount || 0);
  };

  const completionRate = stats ? 
    Math.round((stats.completed / Math.max(stats.total, 1)) * 100) : 0;

  const activeOrders = stats ? stats.pending + stats.approved + stats.inProgress : 0;

  const getDiff = (current: number, previous: number) => {
    if (!previous) return { value: current, percentage: 100, direction: "up" as const };
    const diff = current - previous;
    const percentage = Math.round(Math.abs(diff / previous) * 100);
    return { value: Math.abs(diff), percentage, direction: diff >= 0 ? "up" as const : "down" as const };
  };

  const qtyDiff = getDiff(dailyStats?.totalQuantity || 0, prevDayStats?.totalQuantity || 0);
  const batchDiff = getDiff(dailyStats?.totalBatches || 0, prevDayStats?.totalBatches || 0);

  const handleRefresh = () => {
    refetchStats();
    refetchDaily();
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
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} data-testid="btn-refresh">
              <RefreshCw className="h-4 w-4 ml-2" />
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
