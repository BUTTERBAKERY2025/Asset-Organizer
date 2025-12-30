import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Clock, 
  Target, 
  Award, 
  ArrowUp, 
  ArrowDown, 
  Minus,
  Sun,
  Sunset,
  Moon,
  Calendar,
  RefreshCw
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from "recharts";
import type { Branch } from "@shared/schema";

export default function SalesAnalytics() {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((currentDate.getMonth() + 1).toString().padStart(2, "0"));
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("overview");

  const yearMonth = `${selectedYear}-${selectedMonth}`;
  const daysInMonth = new Date(parseInt(selectedYear), parseInt(selectedMonth), 0).getDate();
  const fromDate = `${yearMonth}-01`;
  const toDate = `${yearMonth}-${daysInMonth.toString().padStart(2, "0")}`;

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const { data: targetsVsActuals = [], isLoading: loadingTargets, refetch: refetchTargets } = useQuery<any[]>({
    queryKey: ["/api/analytics/targets-vs-actuals", selectedBranch, fromDate, toDate],
    queryFn: async () => {
      const params = new URLSearchParams({ fromDate, toDate });
      if (selectedBranch !== "all") params.append("branchId", selectedBranch);
      const res = await fetch(`/api/analytics/targets-vs-actuals?${params}`);
      if (!res.ok) throw new Error("Failed to fetch targets vs actuals");
      return res.json();
    },
  });

  const { data: shiftAnalytics = [], isLoading: loadingShifts, refetch: refetchShifts } = useQuery<any[]>({
    queryKey: ["/api/analytics/shifts", selectedBranch, fromDate, toDate],
    queryFn: async () => {
      const params = new URLSearchParams({ fromDate, toDate });
      if (selectedBranch !== "all") params.append("branchId", selectedBranch);
      const res = await fetch(`/api/analytics/shifts?${params}`);
      if (!res.ok) throw new Error("Failed to fetch shift analytics");
      return res.json();
    },
  });

  const { data: cashierLeaderboard = [], isLoading: loadingLeaderboard, refetch: refetchLeaderboard } = useQuery<any[]>({
    queryKey: ["/api/analytics/cashier-leaderboard", selectedBranch, fromDate, toDate],
    queryFn: async () => {
      const params = new URLSearchParams({ fromDate, toDate });
      if (selectedBranch !== "all") params.append("branchId", selectedBranch);
      const res = await fetch(`/api/analytics/cashier-leaderboard?${params}`);
      if (!res.ok) throw new Error("Failed to fetch cashier leaderboard");
      return res.json();
    },
  });

  const { data: avgTicketByShift = [], refetch: refetchAvgTicket } = useQuery<any[]>({
    queryKey: ["/api/analytics/average-ticket", selectedBranch, "shift", fromDate, toDate],
    queryFn: async () => {
      const params = new URLSearchParams({ fromDate, toDate, groupBy: "shift" });
      if (selectedBranch !== "all") params.append("branchId", selectedBranch);
      const res = await fetch(`/api/analytics/average-ticket?${params}`);
      if (!res.ok) throw new Error("Failed to fetch average ticket");
      return res.json();
    },
  });

  const handleRefresh = () => {
    refetchTargets();
    refetchShifts();
    refetchLeaderboard();
    refetchAvgTicket();
  };

  const totalActualSales = targetsVsActuals.reduce((sum, d) => sum + d.actualSales, 0);
  const totalTargetAmount = targetsVsActuals.reduce((sum, d) => sum + d.targetAmount, 0);
  const overallAchievement = totalTargetAmount > 0 ? (totalActualSales / totalTargetAmount) * 100 : 0;
  const totalVariance = totalActualSales - totalTargetAmount;

  const shiftColors: Record<string, string> = {
    morning: "#22c55e",
    evening: "#f59e0b",
    night: "#6366f1"
  };

  const shiftIcons: Record<string, any> = {
    morning: Sun,
    evening: Sunset,
    night: Moon
  };

  const statusColors: Record<string, string> = {
    exceeding: "bg-green-100 text-green-800 border-green-200",
    on_track: "bg-blue-100 text-blue-800 border-blue-200",
    warning: "bg-amber-100 text-amber-800 border-amber-200",
    critical: "bg-red-100 text-red-800 border-red-200"
  };

  const statusLabels: Record<string, string> = {
    exceeding: "تجاوز الهدف",
    on_track: "على المسار",
    warning: "تحذير",
    critical: "خطير"
  };

  const months = [
    { value: "01", label: "يناير" },
    { value: "02", label: "فبراير" },
    { value: "03", label: "مارس" },
    { value: "04", label: "أبريل" },
    { value: "05", label: "مايو" },
    { value: "06", label: "يونيو" },
    { value: "07", label: "يوليو" },
    { value: "08", label: "أغسطس" },
    { value: "09", label: "سبتمبر" },
    { value: "10", label: "أكتوبر" },
    { value: "11", label: "نوفمبر" },
    { value: "12", label: "ديسمبر" },
  ];

  const years = Array.from({ length: 5 }, (_, i) => {
    const year = currentDate.getFullYear() - 2 + i;
    return { value: year.toString(), label: year.toString() };
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("ar-SA", {
      style: "currency",
      currency: "SAR",
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <BarChart3 className="h-8 w-8 text-amber-600" />
              تحليلات المبيعات
            </h1>
            <p className="text-gray-600 mt-1">تحليل شامل للمبيعات مقارنة بالأهداف</p>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-28" data-testid="select-year">
                <SelectValue placeholder="السنة" />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-32" data-testid="select-month">
                <SelectValue placeholder="الشهر" />
              </SelectTrigger>
              <SelectContent>
                {months.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-40" data-testid="select-branch">
                <SelectValue placeholder="الفرع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الفروع</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" size="icon" onClick={handleRefresh} data-testid="button-refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-white/80 backdrop-blur border-amber-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">إجمالي المبيعات</p>
                  <p className="text-2xl font-bold text-gray-900" data-testid="text-total-sales">
                    {formatCurrency(totalActualSales)}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur border-amber-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">الهدف الشهري</p>
                  <p className="text-2xl font-bold text-gray-900" data-testid="text-total-target">
                    {formatCurrency(totalTargetAmount)}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <Target className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur border-amber-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">نسبة التحقيق</p>
                  <p className="text-2xl font-bold text-gray-900" data-testid="text-achievement-percent">
                    {formatPercent(overallAchievement)}
                  </p>
                  <Progress value={Math.min(overallAchievement, 100)} className="mt-2 h-2" />
                </div>
                <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
                  overallAchievement >= 100 ? "bg-green-100" : overallAchievement >= 80 ? "bg-amber-100" : "bg-red-100"
                }`}>
                  <Award className={`h-6 w-6 ${
                    overallAchievement >= 100 ? "text-green-600" : overallAchievement >= 80 ? "text-amber-600" : "text-red-600"
                  }`} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur border-amber-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">الفارق</p>
                  <p className={`text-2xl font-bold ${totalVariance >= 0 ? "text-green-600" : "text-red-600"}`} data-testid="text-variance">
                    {formatCurrency(totalVariance)}
                  </p>
                </div>
                <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
                  totalVariance >= 0 ? "bg-green-100" : "bg-red-100"
                }`}>
                  {totalVariance >= 0 ? (
                    <ArrowUp className="h-6 w-6 text-green-600" />
                  ) : (
                    <ArrowDown className="h-6 w-6 text-red-600" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-white/80 backdrop-blur border border-amber-200">
            <TabsTrigger value="overview" data-testid="tab-overview">نظرة عامة</TabsTrigger>
            <TabsTrigger value="shifts" data-testid="tab-shifts">تحليل الورديات</TabsTrigger>
            <TabsTrigger value="cashiers" data-testid="tab-cashiers">ترتيب الكاشيرين</TabsTrigger>
            <TabsTrigger value="daily" data-testid="tab-daily">الأداء اليومي</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="bg-white/80 backdrop-blur border-amber-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-amber-600" />
                    توزيع المبيعات حسب الوردية
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingShifts ? (
                    <Skeleton className="h-64 w-full" />
                  ) : shiftAnalytics.length === 0 ? (
                    <div className="h-64 flex items-center justify-center text-gray-500">
                      لا توجد بيانات
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          data={shiftAnalytics}
                          dataKey="totalSales"
                          nameKey="shiftLabel"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label={({ shiftLabel, percentage }) => `${shiftLabel}: ${percentage.toFixed(1)}%`}
                        >
                          {shiftAnalytics.map((entry: any) => (
                            <Cell key={entry.shiftType} fill={shiftColors[entry.shiftType] || "#94a3b8"} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-white/80 backdrop-blur border-amber-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-amber-600" />
                    متوسط الفاتورة حسب الوردية
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingShifts ? (
                    <Skeleton className="h-64 w-full" />
                  ) : avgTicketByShift.length === 0 ? (
                    <div className="h-64 flex items-center justify-center text-gray-500">
                      لا توجد بيانات
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={avgTicketByShift} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" tickFormatter={(v) => `${v.toFixed(0)} ر.س`} />
                        <YAxis dataKey="groupLabel" type="category" width={60} />
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        <Bar dataKey="averageTicket" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="bg-white/80 backdrop-blur border-amber-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-amber-600" />
                  أفضل 5 كاشيرين
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingLeaderboard ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : cashierLeaderboard.length === 0 ? (
                  <div className="h-32 flex items-center justify-center text-gray-500">
                    لا توجد بيانات
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cashierLeaderboard.slice(0, 5).map((cashier: any) => (
                      <div key={cashier.cashierId} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                          cashier.rank === 1 ? "bg-amber-400 text-white" :
                          cashier.rank === 2 ? "bg-gray-300 text-gray-700" :
                          cashier.rank === 3 ? "bg-amber-600 text-white" :
                          "bg-gray-200 text-gray-600"
                        }`}>
                          {cashier.rank}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{cashier.cashierName}</p>
                          <p className="text-sm text-gray-500">{cashier.branchName}</p>
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-amber-600">{formatCurrency(cashier.totalSales)}</p>
                          <p className="text-xs text-gray-500">مساهمة: {cashier.contribution.toFixed(1)}%</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="shifts" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {shiftAnalytics.map((shift: any) => {
                const Icon = shiftIcons[shift.shiftType] || Clock;
                return (
                  <Card key={shift.shiftType} className="bg-white/80 backdrop-blur border-amber-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Icon className="h-5 w-5" style={{ color: shiftColors[shift.shiftType] }} />
                        {shift.shiftLabel}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-500">إجمالي المبيعات</span>
                        <span className="font-bold">{formatCurrency(shift.totalSales)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">متوسط المبيعات</span>
                        <span className="font-medium">{formatCurrency(shift.averageSales)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">عدد المعاملات</span>
                        <span className="font-medium">{shift.transactionsCount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">متوسط الفاتورة</span>
                        <span className="font-medium">{formatCurrency(shift.averageTicket)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">نسبة المساهمة</span>
                        <Badge variant="secondary">{shift.percentage.toFixed(1)}%</Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {shiftAnalytics.length === 0 && !loadingShifts && (
              <Card className="bg-white/80 backdrop-blur border-amber-200">
                <CardContent className="p-8 text-center text-gray-500">
                  لا توجد بيانات للفترة المحددة
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="cashiers" className="space-y-4">
            <Card className="bg-white/80 backdrop-blur border-amber-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-amber-600" />
                  ترتيب الكاشيرين حسب المبيعات
                </CardTitle>
                <CardDescription>
                  الفترة: {fromDate} إلى {toDate}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingLeaderboard ? (
                  <div className="space-y-2">
                    {[...Array(10)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                  </div>
                ) : cashierLeaderboard.length === 0 ? (
                  <div className="h-40 flex items-center justify-center text-gray-500">
                    لا توجد بيانات
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-right py-3 px-2">#</th>
                          <th className="text-right py-3 px-2">الكاشير</th>
                          <th className="text-right py-3 px-2">الفرع</th>
                          <th className="text-right py-3 px-2">إجمالي المبيعات</th>
                          <th className="text-right py-3 px-2">متوسط اليوم</th>
                          <th className="text-right py-3 px-2">عدد اليوميات</th>
                          <th className="text-right py-3 px-2">متوسط الفاتورة</th>
                          <th className="text-right py-3 px-2">المساهمة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cashierLeaderboard.map((cashier: any) => (
                          <tr key={cashier.cashierId} className="border-b hover:bg-gray-50" data-testid={`row-cashier-${cashier.cashierId}`}>
                            <td className="py-3 px-2">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                                cashier.rank === 1 ? "bg-amber-400 text-white" :
                                cashier.rank === 2 ? "bg-gray-300 text-gray-700" :
                                cashier.rank === 3 ? "bg-amber-600 text-white" :
                                "bg-gray-100 text-gray-600"
                              }`}>
                                {cashier.rank}
                              </div>
                            </td>
                            <td className="py-3 px-2 font-medium">{cashier.cashierName}</td>
                            <td className="py-3 px-2 text-gray-600">{cashier.branchName}</td>
                            <td className="py-3 px-2 font-bold text-amber-600">{formatCurrency(cashier.totalSales)}</td>
                            <td className="py-3 px-2">{formatCurrency(cashier.averageDailySales)}</td>
                            <td className="py-3 px-2">{cashier.journalCount}</td>
                            <td className="py-3 px-2">{formatCurrency(cashier.averageTicket)}</td>
                            <td className="py-3 px-2">
                              <Badge variant="secondary">{cashier.contribution.toFixed(1)}%</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="daily" className="space-y-4">
            <Card className="bg-white/80 backdrop-blur border-amber-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-amber-600" />
                  الأداء اليومي - الأهداف مقابل الفعلي
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingTargets ? (
                  <Skeleton className="h-80 w-full" />
                ) : targetsVsActuals.length === 0 ? (
                  <div className="h-80 flex items-center justify-center text-gray-500">
                    لا توجد بيانات
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={targetsVsActuals}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tickFormatter={(d) => d.split("-")[2]} />
                      <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip 
                        formatter={(value: number, name: string) => [formatCurrency(value), name === "actualSales" ? "الفعلي" : "الهدف"]}
                        labelFormatter={(label) => `التاريخ: ${label}`}
                      />
                      <Legend formatter={(value) => value === "actualSales" ? "المبيعات الفعلية" : "الهدف"} />
                      <Line type="monotone" dataKey="targetAmount" stroke="#94a3b8" strokeDasharray="5 5" strokeWidth={2} name="الهدف" />
                      <Line type="monotone" dataKey="actualSales" stroke="#f59e0b" strokeWidth={2} name="الفعلي" dot={{ fill: "#f59e0b" }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur border-amber-200">
              <CardHeader>
                <CardTitle>تفاصيل الأداء اليومي</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingTargets ? (
                  <div className="space-y-2">
                    {[...Array(7)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : targetsVsActuals.length === 0 ? (
                  <div className="h-32 flex items-center justify-center text-gray-500">
                    لا توجد بيانات
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-right py-3 px-2">التاريخ</th>
                          <th className="text-right py-3 px-2">الفرع</th>
                          <th className="text-right py-3 px-2">الهدف</th>
                          <th className="text-right py-3 px-2">الفعلي</th>
                          <th className="text-right py-3 px-2">الفارق</th>
                          <th className="text-right py-3 px-2">التحقيق</th>
                          <th className="text-right py-3 px-2">الحالة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {targetsVsActuals.slice(0, 15).map((day: any, idx: number) => (
                          <tr key={`${day.date}-${day.branchId}`} className="border-b hover:bg-gray-50" data-testid={`row-daily-${idx}`}>
                            <td className="py-3 px-2">{day.date}</td>
                            <td className="py-3 px-2">{day.branchName}</td>
                            <td className="py-3 px-2">{formatCurrency(day.targetAmount)}</td>
                            <td className="py-3 px-2 font-medium">{formatCurrency(day.actualSales)}</td>
                            <td className={`py-3 px-2 ${day.variance >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {day.variance >= 0 ? "+" : ""}{formatCurrency(day.variance)}
                            </td>
                            <td className="py-3 px-2">
                              <div className="flex items-center gap-2">
                                <Progress value={Math.min(day.achievementPercent, 100)} className="w-16 h-2" />
                                <span className="text-sm">{day.achievementPercent.toFixed(0)}%</span>
                              </div>
                            </td>
                            <td className="py-3 px-2">
                              <Badge className={statusColors[day.status]}>
                                {statusLabels[day.status]}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
