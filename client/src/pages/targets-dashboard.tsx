import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Target, TrendingUp, TrendingDown, Building2, Users, Trophy, ChevronLeft, Calendar, Award, AlertTriangle, Bell, Clock, CheckCircle2, FileSpreadsheet, FileText } from "lucide-react";
import { Link } from "wouter";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, PieChart, Pie, Cell } from "recharts";
import * as XLSX from "xlsx";
import type { Branch } from "@shared/schema";

interface BranchPerformance {
  branchId: string;
  branchName: string;
  target: number;
  achieved: number;
  percent: number;
  rank: number;
}

interface CashierPerformance {
  cashierId: string;
  cashierName: string;
  branchId: string;
  target: number;
  achieved: number;
  percent: number;
  rank: number;
}

interface Leaderboard {
  branches: BranchPerformance[];
  cashiers: CashierPerformance[];
}

interface DailyPerformance {
  date: string;
  target: number;
  achieved: number;
  percent: number;
}

interface PerformanceData {
  targetAmount: number;
  achievedAmount: number;
  achievementPercent: number;
  dailyPerformance: DailyPerformance[];
}

interface BranchProgress {
  branchId: string;
  branchName: string;
  yearMonth: string;
  targetAmount: number;
  achievedAmount: number;
  achievementPercent: number;
  remainingAmount: number;
  dailyTargetAverage: number;
  dailyProgress: {
    date: string;
    dayName: string;
    targetAmount: number;
    achievedAmount: number;
    achievementPercent: number;
    cumulativeTarget: number;
    cumulativeAchieved: number;
    cumulativePercent: number;
    variance: number;
    journalCount: number;
    journalIds: number[];
  }[];
}

interface ProgressSummary {
  branchId: string;
  branchName: string;
  targetAmount: number;
  achievedAmount: number;
  achievementPercent: number;
  remainingAmount: number;
  daysWithSales: number;
  averageDailySales: number;
  projectedTotal: number;
  projectedPercent: number;
  trend: 'up' | 'down' | 'stable';
}

interface TargetAlert {
  branchId: string;
  branchName: string;
  targetAmount: number;
  achievedAmount: number;
  achievementPercent: number;
  daysRemaining: number;
  projectedAchievement: number;
  alertLevel: 'critical' | 'warning' | 'on_track' | 'exceeding';
  message: string;
}

const ALERT_COLORS = {
  critical: { bg: "bg-red-100", border: "border-red-500", text: "text-red-700", icon: "text-red-500" },
  warning: { bg: "bg-amber-100", border: "border-amber-500", text: "text-amber-700", icon: "text-amber-500" },
  on_track: { bg: "bg-blue-100", border: "border-blue-500", text: "text-blue-700", icon: "text-blue-500" },
  exceeding: { bg: "bg-green-100", border: "border-green-500", text: "text-green-700", icon: "text-green-500" },
};

const ALERT_ICONS = {
  critical: AlertTriangle,
  warning: Bell,
  on_track: Clock,
  exceeding: CheckCircle2,
};

const MONTHS = [
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

const YEARS = Array.from({ length: 10 }, (_, i) => {
  const year = new Date().getFullYear() - 2 + i;
  return { value: year.toString(), label: year.toString() };
});

export default function TargetsDashboard() {
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear().toString());
  const [selectedMonthNum, setSelectedMonthNum] = useState(() => String(new Date().getMonth() + 1).padStart(2, '0'));
  const selectedMonth = `${selectedYear}-${selectedMonthNum}`;
  const [selectedBranch, setSelectedBranch] = useState<string>("all");

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const { data: leaderboard, isLoading: leaderboardLoading } = useQuery<Leaderboard>({
    queryKey: ["/api/targets/leaderboard", selectedMonth],
    queryFn: async () => {
      const res = await fetch(`/api/targets/leaderboard?yearMonth=${selectedMonth}`);
      if (!res.ok) throw new Error("Failed to fetch leaderboard");
      return res.json();
    }
  });

  const { data: branchPerformance, isLoading: performanceLoading } = useQuery<PerformanceData>({
    queryKey: ["/api/targets/performance", selectedBranch, selectedMonth],
    queryFn: async () => {
      if (selectedBranch === "all") return null;
      const res = await fetch(`/api/targets/performance/${selectedBranch}?yearMonth=${selectedMonth}`);
      if (!res.ok) throw new Error("Failed to fetch performance");
      return res.json();
    },
    enabled: selectedBranch !== "all"
  });

  const { data: alerts = [], isLoading: alertsLoading } = useQuery<TargetAlert[]>({
    queryKey: ["/api/targets/alerts", selectedMonth],
    queryFn: async () => {
      const res = await fetch(`/api/targets/alerts?yearMonth=${selectedMonth}`);
      if (!res.ok) throw new Error("Failed to fetch alerts");
      return res.json();
    }
  });

  const { data: progressSummary = [], isLoading: summaryLoading } = useQuery<ProgressSummary[]>({
    queryKey: ["/api/targets/progress-summary", selectedMonth],
    queryFn: async () => {
      const res = await fetch(`/api/targets/progress-summary?yearMonth=${selectedMonth}`);
      if (!res.ok) throw new Error("Failed to fetch progress summary");
      return res.json();
    }
  });

  const { data: branchProgress, isLoading: progressLoading } = useQuery<BranchProgress>({
    queryKey: ["/api/targets/progress", selectedBranch, selectedMonth],
    queryFn: async () => {
      if (selectedBranch === "all") return null;
      const res = await fetch(`/api/targets/progress/${selectedBranch}?yearMonth=${selectedMonth}`);
      if (!res.ok) throw new Error("Failed to fetch branch progress");
      return res.json();
    },
    enabled: selectedBranch !== "all"
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-SA', { 
      style: 'currency', 
      currency: 'SAR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0 
    }).format(amount);
  };

  const getPercentColor = (percent: number) => {
    if (percent >= 100) return "text-green-600";
    if (percent >= 80) return "text-amber-600";
    return "text-red-600";
  };

  const getProgressColor = (percent: number) => {
    if (percent >= 100) return "bg-green-500";
    if (percent >= 80) return "bg-amber-500";
    return "bg-red-500";
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <Badge className="bg-yellow-500 text-white">🥇 الأول</Badge>;
    if (rank === 2) return <Badge className="bg-gray-400 text-white">🥈 الثاني</Badge>;
    if (rank === 3) return <Badge className="bg-amber-700 text-white">🥉 الثالث</Badge>;
    return <Badge variant="outline">{rank}</Badge>;
  };

  const totalTarget = leaderboard?.branches.reduce((sum, b) => sum + b.target, 0) || 0;
  const totalAchieved = leaderboard?.branches.reduce((sum, b) => sum + b.achieved, 0) || 0;
  const overallPercent = totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : 0;

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    
    if (leaderboard?.branches?.length) {
      const branchData = leaderboard.branches.map(b => ({
        'الفرع': b.branchName,
        'الهدف': b.target,
        'المحقق': b.achieved,
        'النسبة': `${b.percent.toFixed(1)}%`,
        'الترتيب': b.rank
      }));
      const ws1 = XLSX.utils.json_to_sheet(branchData);
      XLSX.utils.book_append_sheet(wb, ws1, 'أداء الفروع');
    }
    
    if (leaderboard?.cashiers?.length) {
      const cashierData = leaderboard.cashiers.map(c => ({
        'الكاشير': c.cashierName,
        'الفرع': branches.find(br => br.id === c.branchId)?.name || c.branchId,
        'المحقق': c.achieved,
        'الترتيب': c.rank
      }));
      const ws2 = XLSX.utils.json_to_sheet(cashierData);
      XLSX.utils.book_append_sheet(wb, ws2, 'أداء الكاشير');
    }
    
    if (progressSummary?.length) {
      const summaryData = progressSummary.map(s => ({
        'الفرع': s.branchName,
        'الهدف': s.targetAmount,
        'المحقق': s.achievedAmount,
        'النسبة': `${s.achievementPercent.toFixed(1)}%`,
        'المتبقي': s.remainingAmount,
        'متوسط يومي': s.averageDailySales,
        'المتوقع': `${s.projectedPercent.toFixed(1)}%`,
        'الاتجاه': s.trend === 'up' ? 'صعود' : s.trend === 'down' ? 'هبوط' : 'مستقر'
      }));
      const ws3 = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, ws3, 'ملخص التقدم');
    }
    
    if (alerts?.length) {
      const alertsData = alerts.map(a => ({
        'الفرع': a.branchName,
        'النوع': a.alertLevel === 'critical' ? 'حرج' : a.alertLevel === 'warning' ? 'تحذير' : a.alertLevel === 'on_track' ? 'على المسار' : 'متجاوز',
        'الرسالة': a.message,
        'التقدم': `${a.achievementPercent.toFixed(1)}%`,
        'الأيام المتبقية': a.daysRemaining
      }));
      const ws4 = XLSX.utils.json_to_sheet(alertsData);
      XLSX.utils.book_append_sheet(wb, ws4, 'التنبيهات');
    }
    
    if (branchProgress?.dailyProgress?.length) {
      const dailyData = branchProgress.dailyProgress.map(d => ({
        'التاريخ': d.date,
        'اليوم': d.dayName,
        'الهدف اليومي': d.targetAmount,
        'المحقق': d.achievedAmount,
        'النسبة': `${d.achievementPercent.toFixed(1)}%`,
        'الفارق': d.variance,
        'عدد اليوميات': d.journalCount,
        'تراكمي الهدف': d.cumulativeTarget,
        'تراكمي المحقق': d.cumulativeAchieved,
        'تراكمي%': `${d.cumulativePercent.toFixed(1)}%`
      }));
      const ws5 = XLSX.utils.json_to_sheet(dailyData);
      XLSX.utils.book_append_sheet(wb, ws5, 'التقدم اليومي');
    }
    
    XLSX.writeFile(wb, `تقرير_الأهداف_${selectedMonth}.xlsx`);
  };

  const exportBranchReport = () => {
    if (selectedBranch === "all" || !branchProgress) {
      return;
    }
    
    const branchName = branches.find(b => b.id === selectedBranch)?.name || selectedBranch;
    const wb = XLSX.utils.book_new();
    
    // Branch summary sheet
    const summaryData = [{
      'الفرع': branchName,
      'الشهر': selectedMonth,
      'الهدف الشهري': branchProgress.targetAmount,
      'المحقق': branchProgress.achievedAmount,
      'نسبة التحقيق': `${branchProgress.achievementPercent.toFixed(1)}%`,
      'المتبقي': branchProgress.remainingAmount,
      'متوسط الهدف اليومي': branchProgress.dailyTargetAverage
    }];
    const ws1 = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws1, 'ملخص الفرع');
    
    // Daily progress sheet
    if (branchProgress.dailyProgress?.length) {
      const dailyData = branchProgress.dailyProgress.map(d => ({
        'التاريخ': d.date,
        'اليوم': d.dayName,
        'الهدف اليومي': d.targetAmount,
        'المحقق': d.achievedAmount,
        'النسبة': `${d.achievementPercent.toFixed(1)}%`,
        'الفارق': d.variance,
        'عدد اليوميات': d.journalCount,
        'تراكمي الهدف': d.cumulativeTarget,
        'تراكمي المحقق': d.cumulativeAchieved,
        'تراكمي%': `${d.cumulativePercent.toFixed(1)}%`
      }));
      const ws2 = XLSX.utils.json_to_sheet(dailyData);
      XLSX.utils.book_append_sheet(wb, ws2, 'التقدم اليومي');
    }
    
    XLSX.writeFile(wb, `تقرير_الأهداف_${branchName}_${selectedMonth}.xlsx`);
  };

  const exportBranchPDF = () => {
    if (selectedBranch === "all" || !branchProgress) {
      return;
    }
    
    const branchName = branches.find(b => b.id === selectedBranch)?.name || selectedBranch;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>تقرير الفرع - ${branchName}</title>
          <style>
            body { font-family: 'Cairo', sans-serif; padding: 20px; direction: rtl; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
            th { background-color: #f59e0b; color: white; }
            h1, h2 { color: #92400e; }
            .header { text-align: center; margin-bottom: 30px; }
            .summary { display: flex; justify-content: space-around; margin: 20px 0; flex-wrap: wrap; gap: 10px; }
            .card { border: 1px solid #ddd; padding: 15px; border-radius: 8px; text-align: center; min-width: 120px; }
            @media print { body { print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>تقرير أداء الفرع</h1>
            <h2>${branchName}</h2>
            <p>الشهر: ${selectedMonth}</p>
          </div>
          <div class="summary">
            <div class="card"><strong>الهدف الشهري:</strong><br/>${formatCurrency(branchProgress.targetAmount)}</div>
            <div class="card"><strong>المحقق:</strong><br/>${formatCurrency(branchProgress.achievedAmount)}</div>
            <div class="card"><strong>نسبة التحقيق:</strong><br/>${branchProgress.achievementPercent.toFixed(1)}%</div>
            <div class="card"><strong>المتبقي:</strong><br/>${formatCurrency(branchProgress.remainingAmount)}</div>
          </div>
          ${branchProgress.dailyProgress?.length ? `
            <h2>التقدم اليومي التفصيلي</h2>
            <table>
              <thead>
                <tr><th>التاريخ</th><th>اليوم</th><th>الهدف</th><th>المحقق</th><th>النسبة</th><th>الفارق</th><th>تراكمي%</th></tr>
              </thead>
              <tbody>
                ${branchProgress.dailyProgress.filter(d => d.achievedAmount > 0 || new Date(d.date) <= new Date()).map(d => `
                  <tr>
                    <td>${new Date(d.date).toLocaleDateString('en-GB')}</td>
                    <td>${d.dayName}</td>
                    <td>${formatCurrency(d.targetAmount)}</td>
                    <td>${formatCurrency(d.achievedAmount)}</td>
                    <td>${d.achievementPercent.toFixed(0)}%</td>
                    <td style="color: ${d.variance >= 0 ? 'green' : 'red'}">${d.variance >= 0 ? '+' : ''}${formatCurrency(d.variance)}</td>
                    <td>${d.cumulativePercent.toFixed(1)}%</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 500);
    }
  };

  const exportToPDF = () => {
    const printContent = document.getElementById('print-content');
    if (!printContent) {
      window.print();
      return;
    }
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>تقرير الأهداف - ${selectedMonth}</title>
          <style>
            body { font-family: 'Cairo', sans-serif; padding: 20px; direction: rtl; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
            th { background-color: #f59e0b; color: white; }
            h1, h2 { color: #92400e; }
            .header { text-align: center; margin-bottom: 30px; }
            .summary { display: flex; justify-content: space-around; margin: 20px 0; }
            .card { border: 1px solid #ddd; padding: 15px; border-radius: 8px; text-align: center; }
            @media print { body { print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>تقرير الأداء والأهداف</h1>
            <p>الشهر: ${selectedMonth}</p>
          </div>
          <div class="summary">
            <div class="card"><strong>إجمالي الهدف:</strong> ${formatCurrency(totalTarget)}</div>
            <div class="card"><strong>إجمالي المحقق:</strong> ${formatCurrency(totalAchieved)}</div>
            <div class="card"><strong>نسبة الإنجاز:</strong> ${overallPercent.toFixed(1)}%</div>
          </div>
          ${leaderboard?.branches?.length ? `
            <h2>أداء الفروع</h2>
            <table>
              <thead><tr><th>الترتيب</th><th>الفرع</th><th>الهدف</th><th>المحقق</th><th>النسبة</th></tr></thead>
              <tbody>${leaderboard.branches.map(b => `<tr><td>${b.rank}</td><td>${b.branchName}</td><td>${formatCurrency(b.target)}</td><td>${formatCurrency(b.achieved)}</td><td>${b.percent.toFixed(1)}%</td></tr>`).join('')}</tbody>
            </table>
          ` : ''}
          ${leaderboard?.cashiers?.length ? `
            <h2>أداء الكاشير</h2>
            <table>
              <thead><tr><th>الترتيب</th><th>الكاشير</th><th>الفرع</th><th>المحقق</th></tr></thead>
              <tbody>${leaderboard.cashiers.map(c => `<tr><td>${c.rank}</td><td>${c.cashierName}</td><td>${branches.find(br => br.id === c.branchId)?.name || c.branchId}</td><td>${formatCurrency(c.achieved)}</td></tr>`).join('')}</tbody>
            </table>
          ` : ''}
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 500);
    }
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-amber-900 flex items-center gap-3">
              <TrendingUp className="h-8 w-8" />
              لوحة الأداء والأهداف
            </h1>
            <p className="text-amber-700 mt-1">متابعة تحقيق الأهداف الشهرية ومقارنة أداء الفروع</p>
          </div>
          
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Label>السنة:</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-24" data-testid="select-year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map(y => (
                    <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label>الشهر:</Label>
              <Select value={selectedMonthNum} onValueChange={setSelectedMonthNum}>
                <SelectTrigger className="w-28" data-testid="select-month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Button variant="outline" onClick={exportToExcel} data-testid="button-export-excel">
              <FileSpreadsheet className="h-4 w-4 ml-2" />
              تصدير Excel
            </Button>
            
            <Button variant="outline" onClick={exportToPDF} data-testid="button-export-pdf">
              <FileText className="h-4 w-4 ml-2" />
              طباعة PDF
            </Button>
            
            <Link href="/targets-planning">
              <Button variant="outline" data-testid="button-goto-planning">
                <Target className="h-4 w-4 ml-2" />
                تخطيط الأهداف
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-amber-500 to-orange-500 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="h-5 w-5" />
                إجمالي الهدف
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono">{formatCurrency(totalTarget)}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-emerald-500 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                إجمالي المحقق
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono">{formatCurrency(totalAchieved)}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500 to-indigo-500 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Award className="h-5 w-5" />
                نسبة التحقيق
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{overallPercent.toFixed(1)}%</div>
              <Progress value={Math.min(overallPercent, 100)} className="mt-2 bg-white/30" />
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-pink-500 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                عدد الفروع
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{leaderboard?.branches.length || 0}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="alerts" className="space-y-4">
          <TabsList>
            <TabsTrigger value="alerts" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              التنبيهات
              {alerts.filter(a => a.alertLevel === 'critical' || a.alertLevel === 'warning').length > 0 && (
                <Badge variant="destructive" className="h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {alerts.filter(a => a.alertLevel === 'critical' || a.alertLevel === 'warning').length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="branches" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              ترتيب الفروع
            </TabsTrigger>
            <TabsTrigger value="cashiers" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              أفضل الكاشيرين
            </TabsTrigger>
            <TabsTrigger value="details" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              تفاصيل الفرع
            </TabsTrigger>
          </TabsList>

          <TabsContent value="alerts">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bell className="h-5 w-5 text-amber-600" />
                      تنبيهات تحقيق الأهداف
                    </CardTitle>
                    <CardDescription>
                      متابعة مباشرة لأداء الفروع مع التنبيه المبكر للمخاطر
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {alertsLoading ? (
                      <div className="text-center py-8 text-gray-500">جاري التحميل...</div>
                    ) : alerts.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">لا توجد أهداف مسجلة لهذا الشهر</div>
                    ) : (
                      <div className="space-y-3">
                        {alerts.map((alert) => {
                          const colors = ALERT_COLORS[alert.alertLevel];
                          const AlertIcon = ALERT_ICONS[alert.alertLevel];
                          return (
                            <div
                              key={alert.branchId}
                              className={`p-4 rounded-lg border-r-4 ${colors.bg} ${colors.border}`}
                              data-testid={`alert-${alert.branchId}`}
                            >
                              <div className="flex items-start gap-3">
                                <AlertIcon className={`h-5 w-5 mt-0.5 ${colors.icon}`} />
                                <div className="flex-1">
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold">{alert.branchName}</span>
                                    <Badge className={alert.alertLevel === 'exceeding' ? 'bg-green-500' : alert.alertLevel === 'critical' ? 'bg-red-500' : alert.alertLevel === 'warning' ? 'bg-amber-500' : 'bg-blue-500'}>
                                      {alert.achievementPercent.toFixed(1)}%
                                    </Badge>
                                  </div>
                                  <p className={`text-sm mt-1 ${colors.text}`}>{alert.message}</p>
                                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-600">
                                    <span>الهدف: {formatCurrency(alert.targetAmount)}</span>
                                    <span>المحقق: {formatCurrency(alert.achievedAmount)}</span>
                                    <span>الأيام المتبقية: {alert.daysRemaining}</span>
                                  </div>
                                  <Progress 
                                    value={Math.min(alert.achievementPercent, 100)} 
                                    className="mt-2 h-2"
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">ملخص التنبيهات</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-2 bg-red-50 rounded">
                        <span className="flex items-center gap-2 text-red-700">
                          <AlertTriangle className="h-4 w-4" />
                          حرجة
                        </span>
                        <Badge variant="destructive">{alerts.filter(a => a.alertLevel === 'critical').length}</Badge>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-amber-50 rounded">
                        <span className="flex items-center gap-2 text-amber-700">
                          <Bell className="h-4 w-4" />
                          تحذير
                        </span>
                        <Badge className="bg-amber-500">{alerts.filter(a => a.alertLevel === 'warning').length}</Badge>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-blue-50 rounded">
                        <span className="flex items-center gap-2 text-blue-700">
                          <Clock className="h-4 w-4" />
                          على المسار
                        </span>
                        <Badge className="bg-blue-500">{alerts.filter(a => a.alertLevel === 'on_track').length}</Badge>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-green-50 rounded">
                        <span className="flex items-center gap-2 text-green-700">
                          <CheckCircle2 className="h-4 w-4" />
                          تجاوز الهدف
                        </span>
                        <Badge className="bg-green-500">{alerts.filter(a => a.alertLevel === 'exceeding').length}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">متوسط التوقعات</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {alerts.length > 0 ? (
                      <div className="text-center">
                        <div className="text-3xl font-bold text-amber-600">
                          {(alerts.reduce((sum, a) => sum + a.projectedAchievement, 0) / alerts.length).toFixed(1)}%
                        </div>
                        <p className="text-sm text-gray-500 mt-1">التحقيق المتوقع نهاية الشهر</p>
                      </div>
                    ) : (
                      <div className="text-center text-gray-500">لا توجد بيانات</div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="branches">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-amber-600" />
                    ترتيب الفروع
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {leaderboardLoading ? (
                    <div className="text-center py-8 text-gray-500">جاري التحميل...</div>
                  ) : !leaderboard?.branches.length ? (
                    <div className="text-center py-8 text-gray-500">لا توجد بيانات</div>
                  ) : (
                    <div className="space-y-4">
                      {leaderboard.branches.map((branch) => (
                        <div key={branch.branchId} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg" data-testid={`branch-rank-${branch.branchId}`}>
                          <div className="w-16">{getRankBadge(branch.rank)}</div>
                          <div className="flex-1">
                            <div className="font-medium">{branch.branchName}</div>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              <span>الهدف: {formatCurrency(branch.target)}</span>
                              <span>|</span>
                              <span>المحقق: {formatCurrency(branch.achieved)}</span>
                            </div>
                          </div>
                          <div className={`text-2xl font-bold ${getPercentColor(branch.percent)}`}>
                            {branch.percent.toFixed(1)}%
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>مقارنة أداء الفروع</CardTitle>
                </CardHeader>
                <CardContent>
                  {leaderboard?.branches && leaderboard.branches.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={leaderboard.branches}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="branchName" />
                        <YAxis />
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        <Legend />
                        <Bar dataKey="target" fill="#f59e0b" name="الهدف" />
                        <Bar dataKey="achieved" fill="#22c55e" name="المحقق" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center py-8 text-gray-500">لا توجد بيانات</div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="cashiers">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-amber-600" />
                  أفضل 20 كاشير
                </CardTitle>
              </CardHeader>
              <CardContent>
                {leaderboardLoading ? (
                  <div className="text-center py-8 text-gray-500">جاري التحميل...</div>
                ) : !leaderboard?.cashiers.length ? (
                  <div className="text-center py-8 text-gray-500">لا توجد بيانات</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {leaderboard.cashiers.map((cashier) => (
                      <Card key={cashier.cashierId} className={`${cashier.rank <= 3 ? 'border-amber-400 border-2' : ''}`} data-testid={`cashier-rank-${cashier.cashierId}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            {getRankBadge(cashier.rank)}
                            <span className={`text-xl font-bold ${getPercentColor(cashier.percent)}`}>
                              {cashier.achieved > 0 ? formatCurrency(cashier.achieved) : "0"}
                            </span>
                          </div>
                          <div className="font-medium">{cashier.cashierName}</div>
                          <div className="text-sm text-gray-500">
                            {branches.find(b => b.id === cashier.branchId)?.name || cashier.branchId}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="details">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-amber-600" />
                    التقدم اليومي للمبيعات مقابل الأهداف
                  </CardTitle>
                  <div className="flex items-center gap-4 mt-4 flex-wrap">
                    <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                      <SelectTrigger className="w-48" data-testid="select-branch">
                        <SelectValue placeholder="اختر الفرع" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">اختر فرع</SelectItem>
                        {branches.map(b => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {selectedBranch !== "all" && branchProgress && (
                      <>
                        <Button variant="outline" size="sm" onClick={exportBranchReport} data-testid="button-export-branch-excel">
                          <FileSpreadsheet className="h-4 w-4 ml-2" />
                          تصدير تقرير الفرع (Excel)
                        </Button>
                        <Button variant="outline" size="sm" onClick={exportBranchPDF} data-testid="button-export-branch-pdf">
                          <FileText className="h-4 w-4 ml-2" />
                          طباعة تقرير الفرع (PDF)
                        </Button>
                      </>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {selectedBranch === "all" ? (
                    <div className="text-center py-8 text-gray-500">اختر فرعًا لعرض التقدم اليومي</div>
                  ) : progressLoading ? (
                    <div className="text-center py-8 text-gray-500">جاري التحميل...</div>
                  ) : !branchProgress ? (
                    <div className="text-center py-8 text-gray-500">لا توجد أهداف مسجلة لهذا الفرع</div>
                  ) : (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <Card className="bg-amber-50">
                          <CardContent className="p-4 text-center">
                            <div className="text-xs text-gray-500">الهدف الشهري</div>
                            <div className="text-xl font-bold text-amber-600">
                              {formatCurrency(branchProgress.targetAmount)}
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="bg-green-50">
                          <CardContent className="p-4 text-center">
                            <div className="text-xs text-gray-500">المحقق الفعلي</div>
                            <div className="text-xl font-bold text-green-600">
                              {formatCurrency(branchProgress.achievedAmount)}
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="bg-blue-50">
                          <CardContent className="p-4 text-center">
                            <div className="text-xs text-gray-500">نسبة التحقيق</div>
                            <div className={`text-xl font-bold ${getPercentColor(branchProgress.achievementPercent)}`}>
                              {branchProgress.achievementPercent.toFixed(1)}%
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="bg-red-50">
                          <CardContent className="p-4 text-center">
                            <div className="text-xs text-gray-500">المتبقي</div>
                            <div className="text-xl font-bold text-red-600">
                              {formatCurrency(branchProgress.remainingAmount)}
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="bg-purple-50">
                          <CardContent className="p-4 text-center">
                            <div className="text-xs text-gray-500">متوسط الهدف اليومي</div>
                            <div className="text-xl font-bold text-purple-600">
                              {formatCurrency(branchProgress.dailyTargetAverage)}
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {branchProgress.dailyProgress.length > 0 && (
                        <>
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <Card>
                              <CardHeader className="pb-2">
                                <CardTitle className="text-base">المبيعات اليومية مقابل الهدف</CardTitle>
                              </CardHeader>
                              <CardContent>
                                <ResponsiveContainer width="100%" height={250}>
                                  <BarChart data={branchProgress.dailyProgress.filter(d => d.achievedAmount > 0 || d.targetAmount > 0)}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" tickFormatter={(v) => new Date(v).getDate().toString()} />
                                    <YAxis />
                                    <Tooltip 
                                      formatter={(value: number) => formatCurrency(value)}
                                      labelFormatter={(v) => `${new Date(v).toLocaleDateString('en-GB')}`}
                                    />
                                    <Legend />
                                    <Bar dataKey="targetAmount" fill="#f59e0b" name="الهدف اليومي" />
                                    <Bar dataKey="achievedAmount" fill="#22c55e" name="المحقق" />
                                  </BarChart>
                                </ResponsiveContainer>
                              </CardContent>
                            </Card>
                            
                            <Card>
                              <CardHeader className="pb-2">
                                <CardTitle className="text-base">التقدم التراكمي</CardTitle>
                              </CardHeader>
                              <CardContent>
                                <ResponsiveContainer width="100%" height={250}>
                                  <LineChart data={branchProgress.dailyProgress.filter(d => d.cumulativeAchieved > 0)}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" tickFormatter={(v) => new Date(v).getDate().toString()} />
                                    <YAxis />
                                    <Tooltip 
                                      formatter={(value: number) => formatCurrency(value)}
                                      labelFormatter={(v) => new Date(v).toLocaleDateString('en-GB')}
                                    />
                                    <Legend />
                                    <Line type="monotone" dataKey="cumulativeTarget" stroke="#f59e0b" name="الهدف التراكمي" strokeWidth={2} />
                                    <Line type="monotone" dataKey="cumulativeAchieved" stroke="#22c55e" name="المحقق التراكمي" strokeWidth={2} />
                                  </LineChart>
                                </ResponsiveContainer>
                              </CardContent>
                            </Card>
                          </div>

                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-base">جدول التقدم اليومي التفصيلي</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="bg-gray-100">
                                      <th className="p-2 text-right">التاريخ</th>
                                      <th className="p-2 text-right">اليوم</th>
                                      <th className="p-2 text-right">الهدف</th>
                                      <th className="p-2 text-right">المحقق</th>
                                      <th className="p-2 text-right">النسبة</th>
                                      <th className="p-2 text-right">الفارق</th>
                                      <th className="p-2 text-right">يوميات</th>
                                      <th className="p-2 text-right">تراكمي%</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {branchProgress.dailyProgress
                                      .filter(d => d.achievedAmount > 0 || new Date(d.date) <= new Date())
                                      .map((day) => (
                                      <tr key={day.date} className={`border-b hover:bg-gray-50 ${day.achievedAmount > 0 ? '' : 'text-gray-400'}`}>
                                        <td className="p-2">{new Date(day.date).toLocaleDateString('en-GB')}</td>
                                        <td className="p-2">{day.dayName}</td>
                                        <td className="p-2 font-mono">{formatCurrency(day.targetAmount)}</td>
                                        <td className="p-2 font-mono font-bold">{formatCurrency(day.achievedAmount)}</td>
                                        <td className={`p-2 font-bold ${getPercentColor(day.achievementPercent)}`}>
                                          {day.achievementPercent.toFixed(0)}%
                                        </td>
                                        <td className={`p-2 font-mono ${day.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                          {day.variance >= 0 ? '+' : ''}{formatCurrency(day.variance)}
                                        </td>
                                        <td className="p-2">
                                          {day.journalCount > 0 && (
                                            <Badge variant="outline">{day.journalCount} يومية</Badge>
                                          )}
                                        </td>
                                        <td className={`p-2 font-bold ${getPercentColor(day.cumulativePercent)}`}>
                                          {day.cumulativePercent.toFixed(1)}%
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </CardContent>
                          </Card>
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {summaryLoading ? null : progressSummary.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">ملخص تقدم جميع الفروع</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="p-2 text-right">الفرع</th>
                            <th className="p-2 text-right">الهدف</th>
                            <th className="p-2 text-right">المحقق</th>
                            <th className="p-2 text-right">النسبة</th>
                            <th className="p-2 text-right">المتبقي</th>
                            <th className="p-2 text-right">متوسط يومي</th>
                            <th className="p-2 text-right">المتوقع</th>
                            <th className="p-2 text-right">الاتجاه</th>
                          </tr>
                        </thead>
                        <tbody>
                          {progressSummary.map((branch) => (
                            <tr key={branch.branchId} className="border-b hover:bg-gray-50">
                              <td className="p-2 font-medium">{branch.branchName}</td>
                              <td className="p-2 font-mono">{formatCurrency(branch.targetAmount)}</td>
                              <td className="p-2 font-mono font-bold text-green-600">{formatCurrency(branch.achievedAmount)}</td>
                              <td className={`p-2 font-bold ${getPercentColor(branch.achievementPercent)}`}>
                                {branch.achievementPercent.toFixed(1)}%
                              </td>
                              <td className="p-2 font-mono text-red-600">{formatCurrency(branch.remainingAmount)}</td>
                              <td className="p-2 font-mono">{formatCurrency(branch.averageDailySales)}</td>
                              <td className={`p-2 font-bold ${getPercentColor(branch.projectedPercent)}`}>
                                {branch.projectedPercent.toFixed(1)}%
                              </td>
                              <td className="p-2">
                                {branch.trend === 'up' && <Badge className="bg-green-500">↑ صعود</Badge>}
                                {branch.trend === 'down' && <Badge className="bg-red-500">↓ هبوط</Badge>}
                                {branch.trend === 'stable' && <Badge variant="outline">→ مستقر</Badge>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
