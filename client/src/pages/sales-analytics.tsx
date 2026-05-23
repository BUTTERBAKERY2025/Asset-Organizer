import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { useBranches } from "@/hooks/useBranches";
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
  Users, 
  Clock, 
  Target, 
  Award, 
  ArrowUp, 
  ArrowDown, 
  Sun,
  Sunset,
  Moon,
  Calendar,
  RefreshCw,
  Building2,
  Trophy,
  Gift,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowRight
} from "lucide-react";
import { Link } from "wouter";
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
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Riyal } from "@/components/ui/riyal";

export default function SalesAnalytics() {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((currentDate.getMonth() + 1).toString().padStart(2, "0"));
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [activeTab, setActiveTab] = useState("overview");
  const [journalStatus, setJournalStatus] = useState<string>("all");
  const [discrepancyType, setDiscrepancyType] = useState<string>("all");
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(false);
  
  // Pagination state
  const [dailyPerformancePage, setDailyPerformancePage] = useState(1);
  const [cashierLeaderboardPage, setCashierLeaderboardPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(() => {
        handleRefresh();
      }, 60000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  // Reset pagination when filters change
  useEffect(() => {
    setDailyPerformancePage(1);
    setCashierLeaderboardPage(1);
  }, [selectedBranch, selectedMonth, selectedYear, journalStatus, discrepancyType]);

  const yearMonth = `${selectedYear}-${selectedMonth}`;
  const daysInMonth = new Date(parseInt(selectedYear), parseInt(selectedMonth), 0).getDate();
  const fromDate = `${yearMonth}-01`;
  const toDate = `${yearMonth}-${daysInMonth.toString().padStart(2, "0")}`;

  const { branches, userBranchId, canSelectBranch } = useBranches();

  useEffect(() => {
    if (userBranchId) {
      setSelectedBranch(userBranchId);
    } else if (canSelectBranch) {
      setSelectedBranch("all");
    }
  }, [userBranchId, canSelectBranch]);

  const { data: targetsVsActuals = [], isLoading: loadingTargets, refetch: refetchTargets } = useQuery<any[]>({
    queryKey: ["/api/analytics/targets-vs-actuals", selectedBranch, fromDate, toDate, journalStatus, discrepancyType],
    queryFn: async () => {
      const params = new URLSearchParams({ fromDate, toDate });
      if (selectedBranch !== "all") params.append("branchId", selectedBranch);
      if (journalStatus !== "all") params.append("status", journalStatus);
      if (discrepancyType !== "all") params.append("discrepancyType", discrepancyType);
      const res = await fetch(`/api/analytics/targets-vs-actuals?${params}`);
      if (!res.ok) throw new Error("Failed to fetch targets vs actuals");
      return res.json();
    },
  });

  const { data: shiftAnalytics = [], isLoading: loadingShifts, refetch: refetchShifts } = useQuery<any[]>({
    queryKey: ["/api/analytics/shifts", selectedBranch, fromDate, toDate, journalStatus, discrepancyType],
    queryFn: async () => {
      const params = new URLSearchParams({ fromDate, toDate });
      if (selectedBranch !== "all") params.append("branchId", selectedBranch);
      if (journalStatus !== "all") params.append("status", journalStatus);
      if (discrepancyType !== "all") params.append("discrepancyType", discrepancyType);
      const res = await fetch(`/api/analytics/shifts?${params}`);
      if (!res.ok) throw new Error("Failed to fetch shift analytics");
      return res.json();
    },
  });

  const { data: cashierLeaderboard = [], isLoading: loadingLeaderboard, refetch: refetchLeaderboard } = useQuery<any[]>({
    queryKey: ["/api/analytics/cashier-leaderboard", selectedBranch, fromDate, toDate, journalStatus, discrepancyType],
    queryFn: async () => {
      const params = new URLSearchParams({ fromDate, toDate });
      if (selectedBranch !== "all") params.append("branchId", selectedBranch);
      if (journalStatus !== "all") params.append("status", journalStatus);
      if (discrepancyType !== "all") params.append("discrepancyType", discrepancyType);
      const res = await fetch(`/api/analytics/cashier-leaderboard?${params}`);
      if (!res.ok) throw new Error("Failed to fetch cashier leaderboard");
      return res.json();
    },
  });

  const { data: avgTicketByShift = [], isLoading: loadingAvgTicket, refetch: refetchAvgTicket } = useQuery<any[]>({
    queryKey: ["/api/analytics/average-ticket", selectedBranch, "shift", fromDate, toDate, journalStatus, discrepancyType],
    queryFn: async () => {
      const params = new URLSearchParams({ fromDate, toDate, groupBy: "shift" });
      if (selectedBranch !== "all") params.append("branchId", selectedBranch);
      if (journalStatus !== "all") params.append("status", journalStatus);
      if (discrepancyType !== "all") params.append("discrepancyType", discrepancyType);
      const res = await fetch(`/api/analytics/average-ticket?${params}`);
      if (!res.ok) throw new Error("Failed to fetch average ticket");
      return res.json();
    },
  });

  const { data: branchCompetition = [], isLoading: loadingBranches, refetch: refetchBranches } = useQuery<any[]>({
    queryKey: ["/api/analytics/branch-competition", selectedBranch, fromDate, toDate, journalStatus, discrepancyType],
    queryFn: async () => {
      const params = new URLSearchParams({ fromDate, toDate });
      if (selectedBranch && selectedBranch !== "all") params.append("branchId", selectedBranch);
      if (journalStatus !== "all") params.append("status", journalStatus);
      if (discrepancyType !== "all") params.append("discrepancyType", discrepancyType);
      const res = await fetch(`/api/analytics/branch-competition?${params}`);
      if (!res.ok) throw new Error("Failed to fetch branch competition");
      return res.json();
    },
  });

  const handleRefresh = () => {
    refetchTargets();
    refetchShifts();
    refetchLeaderboard();
    refetchAvgTicket();
    refetchBranches();
    setLastUpdated(new Date());
  };

  const exportToExcel = async (data: any[], sheetName: string, fileName: string) => {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  };

  const exportToCSV = (data: any[], fileName: string) => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(","),
      ...data.map(row => headers.map(h => `"${row[h] || ''}"`).join(","))
    ].join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileName}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const formatLastUpdated = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "الآن";
    if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
    const diffHours = Math.floor(diffMins / 60);
    return `منذ ${diffHours} ساعة`;
  };

  const holidaysAndSeasons: Record<string, { label: string; factor: number }> = {
    "01": { label: "موسم الشتاء", factor: 0.9 },
    "02": { label: "عادي", factor: 1.0 },
    "03": { label: "رمضان (تقريبي)", factor: 1.3 },
    "04": { label: "عيد الفطر (تقريبي)", factor: 1.5 },
    "05": { label: "عادي", factor: 1.0 },
    "06": { label: "موسم الصيف", factor: 0.85 },
    "07": { label: "موسم الصيف", factor: 0.85 },
    "08": { label: "موسم الصيف", factor: 0.85 },
    "09": { label: "عودة المدارس", factor: 1.1 },
    "10": { label: "عادي", factor: 1.0 },
    "11": { label: "عادي", factor: 1.0 },
    "12": { label: "نهاية السنة", factor: 1.15 },
  };

  const currentSeason = holidaysAndSeasons[selectedMonth] || { label: "عادي", factor: 1.0 };

  const exportCashierLeaderboard = () => {
    const exportData = cashierLeaderboard.map((c: any) => ({
      'الترتيب': c.rank,
      'الكاشير': c.cashierName,
      'الفرع': c.branchName,
      'إجمالي المبيعات': c.totalSales,
      'الهدف': c.targetAmount || 0,
      'نسبة الإنجاز': `${(c.achievementPercent || 0).toFixed(1)}%`,
      'متوسط اليوم': c.averageDailySales,
      'عدد اليوميات': c.journalCount,
      'متوسط الفاتورة': c.averageTicket,
      'المساهمة': `${c.contribution.toFixed(1)}%`,
      'مستوى الحافز': c.incentiveTier?.name || '-',
      'المكافأة المتوقعة': c.calculatedReward || 0
    }));
    exportToExcel(exportData, 'ترتيب الكاشيرين', `cashier-leaderboard-${yearMonth}`);
  };

  const exportBranchCompetition = () => {
    const exportData = branchCompetition.map((b: any) => ({
      'الترتيب': b.rank,
      'الفرع': b.branchName,
      'الهدف': b.targetAmount,
      'الفعلي': b.totalSales,
      'نسبة الإنجاز': `${b.achievementPercent.toFixed(1)}%`,
      'الفرق': b.variance,
      'عدد الكاشيرين': b.cashierCount,
      'عدد المعاملات': b.totalTransactions,
      'متوسط الفاتورة': b.averageTicket,
      'مستوى الحافز': b.incentiveTier?.name || '-',
      'المكافأة المتوقعة': b.calculatedReward || 0
    }));
    exportToExcel(exportData, 'منافسة الفروع', `branch-competition-${yearMonth}`);
  };

  const exportDailyPerformance = () => {
    const exportData = targetsVsActuals.map((d: any) => ({
      'التاريخ': d.date,
      'الهدف': d.targetAmount,
      'الفعلي': d.actualSales,
      'نسبة الإنجاز': `${d.achievementPercent.toFixed(1)}%`,
      'الفرق': d.variance
    }));
    exportToExcel(exportData, 'الأداء اليومي', `daily-performance-${yearMonth}`);
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
    exceeding: "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900",
    on_track: "bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-900",
    warning: "bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900",
    critical: "bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-900"
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
    return new Intl.NumberFormat("en-US", {
      style: "decimal",
      maximumFractionDigits: 0
    }).format(value) + " ر.س";
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  return (
    <Layout>
      <div className="page-container space-y-4" dir="rtl">
        <div className="space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <Link href="/cashier-journals">
                <Button variant="ghost" size="icon" className="h-11 w-11 sm:h-8 sm:w-8" data-testid="btn-back">
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <div>
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2 sm:gap-3">
                  <span className="inline-flex w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-primary/10 items-center justify-center">
                    <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                  </span>
                  تحليلات المبيعات
                </h1>
                <p className="text-xs sm:text-sm text-gray-600 mt-1">تحليل شامل للمبيعات مقارنة بالأهداف</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 flex-wrap w-full sm:w-auto">
              <Badge variant="outline" className="bg-white/80 text-[10px] sm:text-xs">
                <Clock className="h-3 w-3 ml-1" />
                آخر تحديث: {formatLastUpdated(lastUpdated)}
              </Badge>
              <Button 
                variant={autoRefresh ? "default" : "outline"} 
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`h-11 sm:h-9 text-xs sm:text-sm ${autoRefresh ? "bg-green-600 hover:bg-green-700" : ""}`}
                data-testid="button-auto-refresh"
              >
                <RefreshCw className={`h-4 w-4 ml-1 ${autoRefresh ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">{autoRefresh ? "تحديث تلقائي" : "تفعيل التحديث"}</span>
                <span className="sm:hidden">{autoRefresh ? "تلقائي" : "تحديث"}</span>
              </Button>
            </div>
          </div>

          <Card className="bg-white/80 backdrop-blur border-violet-100">
            <CardHeader className="pb-3 p-3 sm:p-4 md:p-6">
              <CardTitle className="text-xs sm:text-sm flex items-center gap-2">
                <Filter className="h-4 w-4 text-primary" />
                الفلاتر المتقدمة
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
              <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3 items-stretch sm:items-center">
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-3 w-full sm:w-auto">
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger className="w-full sm:w-24 h-11 sm:h-10 text-xs sm:text-sm" data-testid="select-year">
                      <SelectValue placeholder="السنة" />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((y) => (
                        <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="w-full sm:w-28 h-11 sm:h-10 text-xs sm:text-sm" data-testid="select-month">
                      <SelectValue placeholder="الشهر" />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                    <SelectTrigger className="w-full sm:w-36 h-11 sm:h-10 text-xs sm:text-sm" data-testid="select-branch" disabled={!canSelectBranch}>
                      <SelectValue placeholder="الفرع" />
                    </SelectTrigger>
                    <SelectContent>
                      {canSelectBranch && <SelectItem value="all">جميع الفروع</SelectItem>}
                      {branches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={journalStatus} onValueChange={setJournalStatus}>
                    <SelectTrigger className="w-full sm:w-36 h-11 sm:h-10 text-xs sm:text-sm" data-testid="select-journal-status">
                      <SelectValue placeholder="الحالة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل الحالات</SelectItem>
                      <SelectItem value="posted">مرحّلة</SelectItem>
                      <SelectItem value="approved">معتمدة</SelectItem>
                      <SelectItem value="submitted">مقدمة</SelectItem>
                      <SelectItem value="draft">مسودة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Select value={discrepancyType} onValueChange={setDiscrepancyType}>
                    <SelectTrigger className="flex-1 sm:w-36 h-11 sm:h-10 text-xs sm:text-sm" data-testid="select-discrepancy-type">
                      <SelectValue placeholder="الفرق" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">الكل</SelectItem>
                      <SelectItem value="balanced">متوازن</SelectItem>
                      <SelectItem value="shortage">عجز</SelectItem>
                      <SelectItem value="surplus">زيادة</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button variant="outline" onClick={handleRefresh} className="h-11 w-11 sm:h-10 sm:w-10 p-0 shrink-0" data-testid="button-refresh">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>

                <div className="w-full sm:w-auto sm:mr-auto flex items-center justify-center sm:justify-end gap-2">
                  <Badge className={`text-[10px] sm:text-xs ${
                    currentSeason.factor > 1.2 ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300" :
                    currentSeason.factor < 0.9 ? "bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300" :
                    "bg-muted text-foreground"
                  }`}>
                    <Sparkles className="h-3 w-3 ml-1" />
                    {currentSeason.label} ({currentSeason.factor > 1 ? "+" : ""}{((currentSeason.factor - 1) * 100).toFixed(0)}%)
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

        <div className="kpi-grid">
          <KpiCard
            label="إجمالي المبيعات"
            value={Number(totalActualSales) || 0}
            unit={<Riyal />}
            icon={TrendingUp}
            tone="violet"
            subLabel={`من اليوميات المعتمدة فقط • ${targetsVsActuals.length} يوم`}
            data-testid="text-total-sales"
          />
          <KpiCard
            label="الهدف الشهري"
            value={Number(totalTargetAmount) || 0}
            unit={<Riyal />}
            icon={Target}
            tone="production"
            subLabel={currentSeason.label}
            data-testid="text-total-target"
          />
          <KpiCard
            label="نسبة التحقيق"
            value={formatPercent(overallAchievement)}
            icon={Award}
            tone={overallAchievement >= 100 ? "money" : overallAchievement >= 80 ? "inventory" : "alert"}
            data-testid="text-achievement-percent"
          >
            <Progress value={Math.min(overallAchievement, 100)} className="mt-2 h-1.5 sm:h-2" />
          </KpiCard>
          <KpiCard
            label="الفارق"
            value={Number(totalVariance) || 0}
            unit={<Riyal />}
            icon={totalVariance >= 0 ? ArrowUp : ArrowDown}
            tone={totalVariance >= 0 ? "money" : "alert"}
            subLabel={totalVariance >= 0 ? "أعلى من الهدف" : "أقل من الهدف"}
            data-testid="text-variance"
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
            <TabsList className="bg-white/80 backdrop-blur border border-violet-100 inline-flex min-w-max">
              <TabsTrigger value="overview" data-testid="tab-overview" className="text-xs sm:text-sm">نظرة عامة</TabsTrigger>
              <TabsTrigger value="branches" data-testid="tab-branches" className="text-xs sm:text-sm">الفروع</TabsTrigger>
              <TabsTrigger value="cashiers" data-testid="tab-cashiers" className="text-xs sm:text-sm">الكاشيرين</TabsTrigger>
              <TabsTrigger value="shifts" data-testid="tab-shifts" className="text-xs sm:text-sm">الورديات</TabsTrigger>
              <TabsTrigger value="daily" data-testid="tab-daily" className="text-xs sm:text-sm">اليومي</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="space-y-4">
            {/* ===== Row 1: Sales Overview (donut + breakdown) | Sales Trend (branches pie) ===== */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Sales Overview – spans 2 cols */}
              <Card className="lg:col-span-2 bg-white border-violet-100 shadow-sm">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    نظرة عامة على المبيعات
                  </CardTitle>
                  <Badge variant="outline" className="text-[10px] border-violet-200 text-primary bg-primary/5">
                    {fromDate} → {toDate}
                  </Badge>
                </CardHeader>
                <CardContent>
                  {loadingShifts || loadingTargets ? (
                    <Skeleton className="h-64 w-full" />
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                      {/* Donut + center label */}
                      <div className="relative flex items-center justify-center">
                        <ResponsiveContainer width="100%" height={240}>
                          <PieChart>
                            <Pie
                              data={shiftAnalytics.length ? shiftAnalytics : [{ shiftLabel: "—", totalSales: 1, shiftType: "empty" }]}
                              dataKey="totalSales"
                              nameKey="shiftLabel"
                              cx="50%"
                              cy="50%"
                              innerRadius={70}
                              outerRadius={100}
                              paddingAngle={2}
                              stroke="none"
                            >
                              {(shiftAnalytics.length ? shiftAnalytics : [{ shiftType: "empty" }]).map((entry: any, idx: number) => (
                                <Cell key={`${entry.shiftType}-${idx}`} fill={shiftColors[entry.shiftType] || "#e5e7eb"} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value: number) => formatCurrency(value)} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-[10px] text-gray-500">إجمالي الفترة</span>
                          <span className="text-lg font-bold text-gray-900 tabular-nums" dir="ltr">
                            {formatCurrency(totalActualSales)}
                          </span>
                        </div>
                      </div>

                      {/* Breakdown grid */}
                      <div className="grid grid-cols-2 gap-3">
                        {(shiftAnalytics.length ? shiftAnalytics : []).map((s: any) => {
                          const Icon = shiftIcons[s.shiftType] || Clock;
                          return (
                            <div key={s.shiftType} className="rounded-xl border border-gray-100 p-3 hover:border-violet-200 transition-colors" data-testid={`overview-shift-${s.shiftType}`}>
                              <div className="flex items-center gap-2 mb-1">
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: shiftColors[s.shiftType] }}
                                />
                                <Icon className="h-3.5 w-3.5" style={{ color: shiftColors[s.shiftType] }} />
                                <span className="text-xs text-gray-600 truncate">{s.shiftLabel}</span>
                              </div>
                              <div className="font-bold text-sm text-gray-900 tabular-nums" dir="ltr">
                                {formatCurrency(s.totalSales)}
                              </div>
                              <div className="text-[10px] text-gray-500 mt-0.5">
                                {s.percentage?.toFixed(1)}% من الإجمالي
                              </div>
                            </div>
                          );
                        })}
                        <div className="rounded-xl bg-primary/5 border border-primary/20 p-3">
                          <div className="text-xs text-primary font-medium mb-1">نسبة التحقيق</div>
                          <div className="font-bold text-base text-primary tabular-nums" dir="ltr">
                            {formatPercent(overallAchievement)}
                          </div>
                          <Progress value={Math.min(overallAchievement, 100)} className="mt-1.5 h-1.5" />
                        </div>
                        <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
                          <div className="text-xs text-emerald-700 font-medium mb-1">عدد المعاملات</div>
                          <div className="font-bold text-base text-emerald-700 tabular-nums" dir="ltr">
                            {formatNumber(shiftAnalytics.reduce((s: number, x: any) => s + (x.transactionsCount || 0), 0))}
                          </div>
                          <div className="text-[10px] text-emerald-600/70 mt-0.5">للفترة المحددة</div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Sales Trend - branch competition pie */}
              <Card className="bg-white border-violet-100 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">توزيع المبيعات حسب الفرع</CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingBranches ? (
                    <Skeleton className="h-64 w-full" />
                  ) : branchCompetition.length === 0 ? (
                    <div className="h-64 flex items-center justify-center text-gray-500 text-sm">لا توجد بيانات</div>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={branchCompetition.slice(0, 6)}
                            dataKey="totalSales"
                            nameKey="branchName"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            stroke="#fff"
                            strokeWidth={2}
                          >
                            {branchCompetition.slice(0, 6).map((_: any, idx: number) => {
                              const palette = ["#8b5cf6", "#a78bfa", "#c4b5fd", "#ec4899", "#6366f1", "#fbbf24"];
                              return <Cell key={idx} fill={palette[idx % palette.length]} />;
                            })}
                          </Pie>
                          <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-2 mt-2 max-h-32 overflow-y-auto">
                        {branchCompetition.slice(0, 6).map((b: any, idx: number) => {
                          const palette = ["#8b5cf6", "#a78bfa", "#c4b5fd", "#ec4899", "#6366f1", "#fbbf24"];
                          return (
                            <div key={b.branchId} className="flex items-center gap-2 text-[11px]">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: palette[idx % palette.length] }} />
                              <span className="truncate text-gray-700">{b.branchName}</span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ===== Row 2: Daily Sales Bar | Top 5 Cashiers ===== */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Daily sales bar chart */}
              <Card className="lg:col-span-2 bg-white border-violet-100 shadow-sm">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-base">المبيعات اليومية</CardTitle>
                  <Badge variant="outline" className="text-[10px] border-violet-200 text-primary bg-primary/5">
                    {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
                  </Badge>
                </CardHeader>
                <CardContent>
                  {loadingTargets ? (
                    <Skeleton className="h-64 w-full" />
                  ) : targetsVsActuals.length === 0 ? (
                    <div className="h-64 flex items-center justify-center text-gray-500 text-sm">لا توجد بيانات</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={targetsVsActuals} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="dailySalesGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#8b5cf6" stopOpacity={1} />
                            <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.85} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                        <XAxis dataKey="date" tickFormatter={(d: string) => d.split("-")[2]} tick={{ fontSize: 10, fill: "#9ca3af" }} />
                        <YAxis tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} tick={{ fontSize: 10, fill: "#9ca3af" }} />
                        <Tooltip
                          formatter={(value: number) => formatCurrency(value)}
                          contentStyle={{ borderRadius: 8, border: "1px solid #ede9fe", fontSize: 12 }}
                        />
                        <Bar dataKey="actualSales" fill="url(#dailySalesGradient)" radius={[6, 6, 0, 0]} name="المبيعات" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Top 5 cashiers */}
              <Card className="bg-white border-violet-100 shadow-sm">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    أفضل 5 كاشيرين
                  </CardTitle>
                  <button
                    onClick={() => setActiveTab("cashiers")}
                    className="text-[11px] text-primary hover:underline"
                    data-testid="link-view-all-cashiers"
                  >
                    عرض الكل
                  </button>
                </CardHeader>
                <CardContent>
                  {loadingLeaderboard ? (
                    <div className="space-y-2">
                      {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                    </div>
                  ) : cashierLeaderboard.length === 0 ? (
                    <div className="h-32 flex items-center justify-center text-gray-500 text-sm">لا توجد بيانات</div>
                  ) : (
                    <div className="space-y-2">
                      {cashierLeaderboard.slice(0, 5).map((cashier: any) => (
                        <div key={cashier.cashierId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-violet-50/40 transition-colors" data-testid={`overview-cashier-${cashier.cashierId}`}>
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                            cashier.rank === 1 ? "bg-amber-400 text-white" :
                            cashier.rank === 2 ? "bg-gray-300 text-gray-700" :
                            cashier.rank === 3 ? "bg-amber-600 text-white" :
                            "bg-violet-100 text-primary"
                          }`}>
                            {cashier.rank === 1 ? <Trophy className="h-4 w-4" /> : cashier.rank}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-900 truncate">{cashier.cashierName}</p>
                            <p className="text-[10px] text-gray-500 truncate">{cashier.branchName}</p>
                          </div>
                          <div className="text-left shrink-0">
                            <p className="text-xs font-bold text-primary tabular-nums" dir="ltr">{formatCurrency(cashier.totalSales)}</p>
                            <p className="text-[10px] text-gray-500">{cashier.contribution.toFixed(1)}%</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ===== Row 3: Avg ticket by shift (compact) ===== */}
            <Card className="bg-white border-violet-100 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  متوسط الفاتورة حسب الوردية
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingAvgTicket ? (
                  <Skeleton className="h-44 w-full" />
                ) : avgTicketByShift.length === 0 ? (
                  <div className="h-32 flex items-center justify-center text-gray-500 text-sm">لا توجد بيانات</div>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={avgTicketByShift} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                      <XAxis type="number" tickFormatter={(v) => `${v.toFixed(0)}`} tick={{ fontSize: 10, fill: "#9ca3af" }} />
                      <YAxis dataKey="groupLabel" type="category" width={70} tick={{ fontSize: 11, fill: "#6b7280" }} />
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{ borderRadius: 8, border: "1px solid #ede9fe", fontSize: 12 }}
                      />
                      <Bar dataKey="averageTicket" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="branches" className="space-y-4">
            <Card className="bg-white/80 backdrop-blur border-violet-100">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    منافسة الفروع
                  </CardTitle>
                  <CardDescription>
                    ترتيب الفروع حسب نسبة تحقيق الهدف للفترة: {fromDate} إلى {toDate}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={exportBranchCompetition} data-testid="button-export-branches-excel">
                    <FileSpreadsheet className="h-4 w-4 ml-1" />
                    Excel
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => {
                    const exportData = branchCompetition.map((b: any) => ({
                      'الترتيب': b.rank,
                      'الفرع': b.branchName,
                      'الهدف': b.targetAmount,
                      'الفعلي': b.totalSales,
                      'نسبة الإنجاز': `${b.achievementPercent.toFixed(1)}%`
                    }));
                    exportToCSV(exportData, `branch-competition-${yearMonth}`);
                  }} data-testid="button-export-branches-csv">
                    <FileText className="h-4 w-4 ml-1" />
                    CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingBranches ? (
                  <div className="space-y-2">
                    {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
                  </div>
                ) : branchCompetition.length === 0 ? (
                  <div className="h-40 flex items-center justify-center text-gray-500">
                    لا توجد بيانات
                  </div>
                ) : (
                  <div className="space-y-4">
                    {branchCompetition.map((branch: any) => (
                      <div 
                        key={branch.branchId} 
                        className={`p-4 rounded-lg border-2 ${
                          branch.rank === 1 ? "bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-400" :
                          branch.rank === 2 ? "bg-gray-50 border-gray-300" :
                          branch.rank === 3 ? "bg-gradient-to-r from-amber-100 to-orange-50 border-amber-600" :
                          "bg-white border-gray-200"
                        }`}
                        data-testid={`card-branch-${branch.branchId}`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                              branch.rank === 1 ? "bg-amber-400 text-white" :
                              branch.rank === 2 ? "bg-gray-400 text-white" :
                              branch.rank === 3 ? "bg-amber-600 text-white" :
                              "bg-gray-200 text-gray-600"
                            }`}>
                              {branch.rank === 1 && <Trophy className="h-6 w-6" />}
                              {branch.rank !== 1 && branch.rank}
                            </div>
                            <div>
                              <h3 className="font-bold text-lg text-gray-900">{branch.branchName}</h3>
                              <p className="text-sm text-gray-500">{branch.cashierCount} كاشير</p>
                            </div>
                          </div>
                          <div className="text-left">
                            {branch.incentiveTier ? (
                              <Badge className="bg-green-100 text-green-800 border-green-200 mb-1">
                                <Gift className="h-3 w-3 ml-1" />
                                {branch.incentiveTier.name}
                              </Badge>
                            ) : null}
                            {branch.calculatedReward > 0 && (
                              <p className="text-sm font-medium text-green-600">
                                مكافأة: {formatCurrency(branch.calculatedReward)}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <div className="kpi-grid mb-3">
                          <div>
                            <p className="text-xs text-gray-500">الهدف</p>
                            <p className="font-medium">{formatCurrency(branch.targetAmount)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">الفعلي</p>
                            <p className="font-bold text-primary">{formatCurrency(branch.totalSales)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">الفارق</p>
                            <p className={`font-medium ${branch.variance >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {branch.variance >= 0 ? "+" : ""}{formatCurrency(branch.variance)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">متوسط الفاتورة</p>
                            <p className="font-medium">{formatCurrency(branch.averageTicket)}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <Progress value={Math.min(branch.achievementPercent, 100)} className="flex-1 h-3" />
                          <span className={`font-bold text-lg ${
                            branch.achievementPercent >= 100 ? "text-green-600" :
                            branch.achievementPercent >= 80 ? "text-amber-600" :
                            "text-red-600"
                          }`}>
                            {formatPercent(branch.achievementPercent)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="shifts" className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
              {shiftAnalytics.map((shift: any) => {
                const Icon = shiftIcons[shift.shiftType] || Clock;
                return (
                  <Card key={shift.shiftType} className="bg-white/80 backdrop-blur border-violet-100">
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
              <Card className="bg-white/80 backdrop-blur border-violet-100">
                <CardContent className="p-8 text-center text-gray-500">
                  لا توجد بيانات للفترة المحددة
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="cashiers" className="space-y-4">
            <Card className="bg-white/80 backdrop-blur border-violet-100">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-primary" />
                    ترتيب الكاشيرين حسب المبيعات
                  </CardTitle>
                  <CardDescription>
                    الفترة: {fromDate} إلى {toDate}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={exportCashierLeaderboard} data-testid="button-export-cashiers-excel">
                    <FileSpreadsheet className="h-4 w-4 ml-1" />
                    Excel
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => {
                    const exportData = cashierLeaderboard.map((c: any) => ({
                      'الترتيب': c.rank,
                      'الكاشير': c.cashierName,
                      'الفرع': c.branchName,
                      'إجمالي المبيعات': c.totalSales,
                      'نسبة الإنجاز': `${(c.achievementPercent || 0).toFixed(1)}%`,
                      'المساهمة': `${c.contribution.toFixed(1)}%`
                    }));
                    exportToCSV(exportData, `cashier-leaderboard-${yearMonth}`);
                  }} data-testid="button-export-cashiers-csv">
                    <FileText className="h-4 w-4 ml-1" />
                    CSV
                  </Button>
                </div>
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
                  <div className="overflow-x-auto -mx-3 sm:mx-0">
                    <table className="w-full min-w-[700px]">
                      <thead>
                        <tr className="border-b">
                          <th className="text-right py-2 sm:py-3 px-2 text-xs sm:text-sm">#</th>
                          <th className="text-right py-2 sm:py-3 px-2 text-xs sm:text-sm">الكاشير</th>
                          <th className="text-right py-2 sm:py-3 px-2 text-xs sm:text-sm hidden md:table-cell">الفرع</th>
                          <th className="text-right py-2 sm:py-3 px-2 text-xs sm:text-sm">المبيعات</th>
                          <th className="text-right py-2 sm:py-3 px-2 text-xs sm:text-sm hidden lg:table-cell">الإنجاز</th>
                          <th className="text-right py-2 sm:py-3 px-2 text-xs sm:text-sm hidden lg:table-cell">الحافز</th>
                          <th className="text-right py-2 sm:py-3 px-2 text-xs sm:text-sm hidden md:table-cell">المكافأة</th>
                          <th className="text-right py-2 sm:py-3 px-2 text-xs sm:text-sm hidden lg:table-cell">متوسط</th>
                          <th className="text-right py-2 sm:py-3 px-2 text-xs sm:text-sm">المساهمة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cashierLeaderboard.map((cashier: any) => (
                          <tr key={cashier.cashierId} className="border-b hover:bg-gray-50" data-testid={`row-cashier-${cashier.cashierId}`}>
                            <td className="py-2 sm:py-3 px-2">
                              <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm ${
                                cashier.rank === 1 ? "bg-amber-400 text-white" :
                                cashier.rank === 2 ? "bg-gray-300 text-gray-700" :
                                cashier.rank === 3 ? "bg-amber-600 text-white" :
                                "bg-gray-100 text-gray-600"
                              }`}>
                                {cashier.rank}
                              </div>
                            </td>
                            <td className="py-2 sm:py-3 px-2 font-medium text-xs sm:text-sm">{cashier.cashierName}</td>
                            <td className="py-2 sm:py-3 px-2 text-gray-600 text-xs sm:text-sm hidden md:table-cell">{cashier.branchName}</td>
                            <td className="py-2 sm:py-3 px-2 font-bold text-primary text-xs sm:text-sm">{formatCurrency(cashier.totalSales)}</td>
                            <td className="py-2 sm:py-3 px-2 hidden lg:table-cell">
                              <div className="flex items-center gap-2">
                                <Progress value={Math.min(cashier.achievementPercent || 0, 100)} className="h-1.5 sm:h-2 w-12 sm:w-16" />
                                <span className="text-xs sm:text-sm">{formatPercent(cashier.achievementPercent || 0)}</span>
                              </div>
                            </td>
                            <td className="py-2 sm:py-3 px-2 hidden lg:table-cell">
                              {cashier.incentiveTier ? (
                                <Badge className="bg-green-100 text-green-800 border-green-200 text-[10px] sm:text-xs">
                                  <Gift className="h-3 w-3 ml-1" />
                                  {cashier.incentiveTier.name}
                                </Badge>
                              ) : (
                                <span className="text-gray-400 text-xs sm:text-sm">-</span>
                              )}
                            </td>
                            <td className="py-2 sm:py-3 px-2 hidden md:table-cell">
                              {cashier.calculatedReward > 0 ? (
                                <span className="font-medium text-green-600 text-xs sm:text-sm">{formatCurrency(cashier.calculatedReward)}</span>
                              ) : (
                                <span className="text-gray-400 text-xs">-</span>
                              )}
                            </td>
                            <td className="py-2 sm:py-3 px-2 text-xs sm:text-sm hidden lg:table-cell">{formatCurrency(cashier.averageTicket)}</td>
                            <td className="py-2 sm:py-3 px-2">
                              <Badge variant="secondary" className="text-[10px] sm:text-xs">{cashier.contribution.toFixed(1)}%</Badge>
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
            <Card className="bg-white/80 backdrop-blur border-violet-100">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  الأداء اليومي - الأهداف مقابل الفعلي
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={exportDailyPerformance} data-testid="button-export-daily-excel">
                    <FileSpreadsheet className="h-4 w-4 ml-1" />
                    Excel
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => {
                    const exportData = targetsVsActuals.map((d: any) => ({
                      'التاريخ': d.date,
                      'الهدف': d.targetAmount,
                      'الفعلي': d.actualSales,
                      'نسبة الإنجاز': `${d.achievementPercent.toFixed(1)}%`
                    }));
                    exportToCSV(exportData, `daily-performance-${yearMonth}`);
                  }} data-testid="button-export-daily-csv">
                    <FileText className="h-4 w-4 ml-1" />
                    CSV
                  </Button>
                </div>
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
                      <Line type="monotone" dataKey="actualSales" stroke="#8b5cf6" strokeWidth={2} name="الفعلي" dot={{ fill: "#8b5cf6" }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur border-violet-100">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>تفاصيل الأداء اليومي</CardTitle>
                  {targetsVsActuals.length > 0 && (
                    <span className="text-sm text-gray-500">
                      إجمالي: {targetsVsActuals.length} سجل
                    </span>
                  )}
                </div>
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
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b bg-violet-50/50">
                            <th className="text-right py-3 px-2 font-semibold">التاريخ</th>
                            <th className="text-right py-3 px-2 font-semibold">الفرع</th>
                            <th className="text-right py-3 px-2 font-semibold">الهدف</th>
                            <th className="text-right py-3 px-2 font-semibold">الفعلي</th>
                            <th className="text-right py-3 px-2 font-semibold">الفارق</th>
                            <th className="text-right py-3 px-2 font-semibold">التحقيق</th>
                            <th className="text-right py-3 px-2 font-semibold">الحالة</th>
                          </tr>
                        </thead>
                        <tbody>
                          {targetsVsActuals
                            .slice((dailyPerformancePage - 1) * itemsPerPage, dailyPerformancePage * itemsPerPage)
                            .map((day: any, idx: number) => (
                            <tr key={`${day.date}-${day.branchId}`} className="border-b hover:bg-violet-50/30 transition-colors" data-testid={`row-daily-${idx}`}>
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
                    
                    {/* Pagination Controls */}
                    {targetsVsActuals.length > itemsPerPage && (
                      <div className="flex items-center justify-between mt-4 pt-4 border-t">
                        <div className="text-sm text-gray-600">
                          عرض {((dailyPerformancePage - 1) * itemsPerPage) + 1} - {Math.min(dailyPerformancePage * itemsPerPage, targetsVsActuals.length)} من {targetsVsActuals.length}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDailyPerformancePage(1)}
                            disabled={dailyPerformancePage === 1}
                            className="h-8 w-8 p-0"
                            data-testid="btn-first-page"
                          >
                            <ChevronsRight className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDailyPerformancePage(p => Math.max(1, p - 1))}
                            disabled={dailyPerformancePage === 1}
                            className="h-8 w-8 p-0"
                            data-testid="btn-prev-page"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                          
                          <div className="flex items-center gap-1 mx-2">
                            {Array.from({ length: Math.min(5, Math.ceil(targetsVsActuals.length / itemsPerPage)) }, (_, i) => {
                              const totalPages = Math.ceil(targetsVsActuals.length / itemsPerPage);
                              let pageNum;
                              if (totalPages <= 5) {
                                pageNum = i + 1;
                              } else if (dailyPerformancePage <= 3) {
                                pageNum = i + 1;
                              } else if (dailyPerformancePage >= totalPages - 2) {
                                pageNum = totalPages - 4 + i;
                              } else {
                                pageNum = dailyPerformancePage - 2 + i;
                              }
                              return (
                                <Button
                                  key={pageNum}
                                  variant={dailyPerformancePage === pageNum ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => setDailyPerformancePage(pageNum)}
                                  className={`h-8 w-8 p-0 ${dailyPerformancePage === pageNum ? 'bg-primary hover:bg-primary/90' : ''}`}
                                  data-testid={`btn-page-${pageNum}`}
                                >
                                  {pageNum}
                                </Button>
                              );
                            })}
                          </div>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDailyPerformancePage(p => Math.min(Math.ceil(targetsVsActuals.length / itemsPerPage), p + 1))}
                            disabled={dailyPerformancePage >= Math.ceil(targetsVsActuals.length / itemsPerPage)}
                            className="h-8 w-8 p-0"
                            data-testid="btn-next-page"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDailyPerformancePage(Math.ceil(targetsVsActuals.length / itemsPerPage))}
                            disabled={dailyPerformancePage >= Math.ceil(targetsVsActuals.length / itemsPerPage)}
                            className="h-8 w-8 p-0"
                            data-testid="btn-last-page"
                          >
                            <ChevronsLeft className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
}
