import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Target, TrendingUp, TrendingDown, Building2, Users, Trophy, Calendar, Award, AlertTriangle, Bell, Clock, CheckCircle2, FileSpreadsheet, FileText, Star, Gift, DollarSign, BarChart3, Activity, Minus } from "lucide-react";
import { Link } from "wouter";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";
import { useBranches } from "@/hooks/useBranches";

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
  critical:  { bg: "bg-rose-50/70",    border: "border-rose-400",    text: "text-rose-700",    icon: "text-rose-500",    chip: "bg-rose-100 text-rose-700",       bar: "from-rose-400 to-rose-600" },
  warning:   { bg: "bg-amber-50/70",   border: "border-amber-400",   text: "text-amber-700",   icon: "text-amber-500",   chip: "bg-amber-100 text-amber-700",     bar: "from-amber-400 to-amber-600" },
  on_track:  { bg: "bg-sky-50/70",     border: "border-sky-400",     text: "text-sky-700",     icon: "text-sky-500",     chip: "bg-sky-100 text-sky-700",         bar: "from-sky-400 to-sky-600" },
  exceeding: { bg: "bg-emerald-50/70", border: "border-emerald-400", text: "text-emerald-700", icon: "text-emerald-500", chip: "bg-emerald-100 text-emerald-700", bar: "from-emerald-400 to-emerald-600" },
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
  const { branches, userBranchId, canSelectBranch } = useBranches();
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear().toString());
  const [selectedMonthNum, setSelectedMonthNum] = useState(() => String(new Date().getMonth() + 1).padStart(2, '0'));
  const selectedMonth = `${selectedYear}-${selectedMonthNum}`;
  const [selectedBranch, setSelectedBranch] = useState<string>(userBranchId || "all");

  useEffect(() => {
    if (userBranchId) {
      setSelectedBranch(userBranchId);
    }
  }, [userBranchId]);

  const { data: leaderboard, isLoading: leaderboardLoading } = useQuery<Leaderboard>({
    queryKey: ["/api/targets/leaderboard", selectedMonth],
    queryFn: async () => {
      const res = await fetch(`/api/targets/leaderboard?yearMonth=${selectedMonth}`);
      if (!res.ok) throw new Error("Failed to fetch leaderboard");
      return res.json();
    }
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

  const { data: topCashiersByPoints = [], isLoading: pointsLeaderboardLoading } = useQuery<Array<{ cashierId: string; cashierName: string; branchId: string; branchName: string; totalPoints: number; totalAmount: number; challengeCount: number }>>({
    queryKey: ["/api/smart-incentives/top-cashiers", selectedMonth],
    queryFn: async () => {
      const res = await fetch(`/api/smart-incentives/top-cashiers?yearMonth=${selectedMonth}&limit=20`);
      if (!res.ok) throw new Error(`${res.status}: request failed`);
      return res.json();
    },
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
    if (percent >= 100) return "text-emerald-600";
    if (percent >= 80) return "text-amber-600";
    return "text-rose-600";
  };

  const getPercentBarClasses = (percent: number) => {
    if (percent >= 100) return "from-emerald-400 to-emerald-600";
    if (percent >= 80) return "from-amber-400 to-amber-600";
    return "from-rose-400 to-rose-600";
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <Badge className="bg-amber-400 text-amber-950 hover:bg-amber-400 border-0 shadow-sm">🥇 الأول</Badge>;
    if (rank === 2) return <Badge className="bg-slate-300 text-slate-800 hover:bg-slate-300 border-0 shadow-sm">🥈 الثاني</Badge>;
    if (rank === 3) return <Badge className="bg-orange-300 text-orange-950 hover:bg-orange-300 border-0 shadow-sm">🥉 الثالث</Badge>;
    return <Badge variant="outline" className="border-violet-200 text-violet-700 bg-violet-50">#{rank}</Badge>;
  };

  const totalTarget = leaderboard?.branches.reduce((sum, b) => sum + b.target, 0) || 0;
  const totalAchieved = leaderboard?.branches.reduce((sum, b) => sum + b.achieved, 0) || 0;
  const overallPercent = totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : 0;

  const exportToExcel = async () => {
    const XLSX = await import("xlsx");
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

  const exportBranchReport = async () => {
    if (selectedBranch === "all" || !branchProgress) {
      return;
    }
    
    const XLSX = await import("xlsx");
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
      <div className="page-container space-y-4" dir="rtl">
        <PageHeader
          icon={TrendingUp}
          tone="executive"
          title="لوحة الأداء والأهداف"
          description="متابعة تحقيق الأهداف الشهرية ومقارنة أداء الفروع"
          backHref="/cashier-journals"
          actions={
            <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Label className="hidden sm:inline">السنة:</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-24 h-11 sm:h-10" data-testid="select-year">
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
              <Label className="hidden sm:inline">الشهر:</Label>
              <Select value={selectedMonthNum} onValueChange={setSelectedMonthNum}>
                <SelectTrigger className="w-28 h-11 sm:h-10" data-testid="select-month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Button variant="outline" onClick={exportToExcel} className="h-11 sm:h-9" data-testid="button-export-excel">
              <FileSpreadsheet className="h-4 w-4 sm:ml-2" />
              <span className="hidden sm:inline">تصدير Excel</span>
            </Button>
            
            <Button variant="outline" onClick={exportToPDF} className="h-11 sm:h-9" data-testid="button-export-pdf">
              <FileText className="h-4 w-4 sm:ml-2" />
              <span className="hidden sm:inline">طباعة PDF</span>
            </Button>
            
            <Link href="/targets-planning">
              <Button variant="outline" className="h-11 sm:h-9" data-testid="button-goto-planning">
                <Target className="h-4 w-4 sm:ml-2" />
                <span className="hidden sm:inline">تخطيط الأهداف</span>
              </Button>
            </Link>
            
            <Link href="/cashier-shift-performance">
              <Button variant="default" className="h-11 sm:h-9 bg-amber-600 hover:bg-amber-700" data-testid="button-goto-shift-performance">
                <Users className="h-4 w-4 sm:ml-2" />
                <span className="hidden sm:inline">أداء الشفتات</span>
              </Button>
            </Link>

            <Link href="/incentives-management">
              <Button variant="default" className="h-11 sm:h-9 bg-emerald-600 hover:bg-emerald-700" data-testid="button-goto-incentives">
                <Award className="h-4 w-4 sm:ml-2" />
                <span className="hidden sm:inline">الحوافز الذكية</span>
              </Button>
            </Link>
            </div>
          }
        />

        {(() => {
          const remaining = Math.max(totalTarget - totalAchieved, 0);
          const branchCount = leaderboard?.branches.length || 0;
          const exceedingCount = alerts.filter(a => a.alertLevel === 'exceeding').length;
          const onTrackCount = alerts.filter(a => a.alertLevel === 'on_track').length;
          const healthy = exceedingCount + onTrackCount;
          type Kpi = { key: string; label: string; value: string; icon: typeof Target; tone: string; tint: string; ring: string; iconBg: string; chipText: string; chipCls: string; mono?: boolean; progress?: number };
          const kpis: Kpi[] = [
            { key: 'target',    label: 'إجمالي الهدف',   value: formatCurrency(totalTarget),     icon: Target,      tone: 'from-violet-500 to-fuchsia-500', tint: 'bg-violet-50',  ring: 'ring-violet-100',  iconBg: 'bg-violet-100 text-violet-700',   chipText: `${branchCount} فرع`,         chipCls: 'bg-violet-100 text-violet-700',  mono: true },
            { key: 'achieved',  label: 'إجمالي المحقق',  value: formatCurrency(totalAchieved),   icon: TrendingUp,  tone: 'from-emerald-500 to-teal-500',   tint: 'bg-emerald-50', ring: 'ring-emerald-100', iconBg: 'bg-emerald-100 text-emerald-700', chipText: `${overallPercent.toFixed(0)}% من الهدف`, chipCls: 'bg-emerald-100 text-emerald-700', mono: true },
            { key: 'percent',   label: 'نسبة التحقيق',  value: `${overallPercent.toFixed(1)}%`, icon: Award,       tone: 'from-sky-500 to-indigo-500',     tint: 'bg-sky-50',     ring: 'ring-sky-100',     iconBg: 'bg-sky-100 text-sky-700',         chipText: overallPercent >= 100 ? 'تجاوز الهدف' : overallPercent >= 80 ? 'على المسار' : 'يحتاج تركيز', chipCls: overallPercent >= 100 ? 'bg-emerald-100 text-emerald-700' : overallPercent >= 80 ? 'bg-sky-100 text-sky-700' : 'bg-rose-100 text-rose-700', progress: overallPercent },
            { key: 'remaining', label: 'المتبقي',        value: formatCurrency(remaining),       icon: AlertTriangle, tone: 'from-amber-500 to-rose-500',   tint: 'bg-amber-50',   ring: 'ring-amber-100',   iconBg: 'bg-amber-100 text-amber-700',     chipText: `${healthy}/${branchCount} فرع بمسار جيد`, chipCls: 'bg-amber-100 text-amber-700',   mono: true },
          ];
          return (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
              {kpis.map((k) => {
                const Icon = k.icon;
                return (
                  <Card key={k.key} className={`relative overflow-hidden border-0 ring-1 ${k.ring} ${k.tint} shadow-sm hover:shadow-md transition-shadow`} data-testid={`kpi-${k.key}`}>
                    <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-l ${k.tone}`} aria-hidden />
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] text-gray-600 truncate">{k.label}</div>
                          <div className={`text-lg sm:text-xl font-bold text-gray-900 truncate ${k.mono ? 'font-mono' : ''}`}>{k.value}</div>
                        </div>
                        <div className={`shrink-0 h-8 w-8 rounded-lg ${k.iconBg} flex items-center justify-center`}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                      </div>
                      {'progress' in k && k.progress !== undefined && (
                        <div className="mt-2 h-1.5 rounded-full bg-white/70 overflow-hidden" role="progressbar" aria-valuenow={Math.round(k.progress)} aria-valuemin={0} aria-valuemax={100} aria-label={k.label}>
                          <div className={`h-full bg-gradient-to-l ${getPercentBarClasses(k.progress)} transition-all`} style={{ width: `${Math.min(k.progress, 100)}%` }} />
                        </div>
                      )}
                      <div className={`mt-2 inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${k.chipCls}`}>
                        {k.chipText}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          );
        })()}

        <Tabs defaultValue="alerts" className="space-y-4">
          <TabsList className="flex flex-wrap gap-1 h-auto p-1 bg-violet-50/70 ring-1 ring-violet-100 rounded-xl">
            <TabsTrigger value="alerts" className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs md:text-sm px-2 sm:px-3 rounded-lg data-[state=active]:bg-white data-[state=active]:text-violet-700 data-[state=active]:shadow-sm">
              <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">التنبيهات</span>
              <span className="sm:hidden">تنبيهات</span>
              {alerts.filter(a => a.alertLevel === 'critical' || a.alertLevel === 'warning').length > 0 && (
                <Badge className="h-4 min-w-4 sm:h-5 sm:min-w-5 px-1 flex items-center justify-center text-[10px] sm:text-xs bg-rose-500 hover:bg-rose-500 border-0">
                  {alerts.filter(a => a.alertLevel === 'critical' || a.alertLevel === 'warning').length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="branches" className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs md:text-sm px-2 sm:px-3 rounded-lg data-[state=active]:bg-white data-[state=active]:text-violet-700 data-[state=active]:shadow-sm">
              <Building2 className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">ترتيب الفروع</span>
              <span className="sm:hidden">الفروع</span>
            </TabsTrigger>
            <TabsTrigger value="cashiers" className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs md:text-sm px-2 sm:px-3 rounded-lg data-[state=active]:bg-white data-[state=active]:text-violet-700 data-[state=active]:shadow-sm">
              <Users className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">أفضل الكاشيرين</span>
              <span className="sm:hidden">الكاشيرين</span>
            </TabsTrigger>
            <TabsTrigger value="details" className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs md:text-sm px-2 sm:px-3 rounded-lg data-[state=active]:bg-white data-[state=active]:text-violet-700 data-[state=active]:shadow-sm">
              <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">تفاصيل الفرع</span>
              <span className="sm:hidden">التفاصيل</span>
            </TabsTrigger>
            <TabsTrigger value="incentives" className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs md:text-sm px-2 sm:px-3 rounded-lg data-[state=active]:bg-white data-[state=active]:text-violet-700 data-[state=active]:shadow-sm">
              <Star className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">ترتيب الحوافز</span>
              <span className="sm:hidden">الحوافز</span>
              {topCashiersByPoints.length > 0 && (
                <Badge className="h-4 min-w-4 sm:h-5 sm:min-w-5 px-1 flex items-center justify-center text-[10px] sm:text-xs bg-emerald-500 hover:bg-emerald-500 border-0">
                  {topCashiersByPoints.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="alerts">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
              <div className="lg:col-span-2 space-y-4">
                <Card className="border-0 ring-1 ring-violet-100 shadow-sm overflow-hidden">
                  <CardHeader className="p-3 sm:p-4 md:p-5 bg-gradient-to-l from-violet-50 to-white border-b border-violet-100">
                    <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                      <div className="h-8 w-8 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center">
                        <Bell className="h-4 w-4" />
                      </div>
                      تنبيهات تحقيق الأهداف
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm">
                      متابعة مباشرة لأداء الفروع مع التنبيه المبكر للمخاطر
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4">
                    {alertsLoading ? (
                      <div className="space-y-2">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <div key={i} className="h-20 rounded-lg skeleton-pro" />
                        ))}
                      </div>
                    ) : alerts.length === 0 ? (
                      <div className="text-center py-10 text-gray-500 text-sm">لا توجد أهداف مسجلة لهذا الشهر</div>
                    ) : (
                      <div className="space-y-2.5">
                        {alerts.map((alert) => {
                          const colors = ALERT_COLORS[alert.alertLevel];
                          const AlertIcon = ALERT_ICONS[alert.alertLevel];
                          const pct = Math.min(alert.achievementPercent, 100);
                          return (
                            <div
                              key={alert.branchId}
                              className={`p-3 sm:p-4 rounded-xl border-r-4 ${colors.bg} ${colors.border} ring-1 ring-black/5`}
                              data-testid={`alert-${alert.branchId}`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`shrink-0 h-9 w-9 rounded-lg bg-white/70 flex items-center justify-center ${colors.icon}`}>
                                  <AlertIcon className="h-4 w-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-semibold text-gray-900 text-sm truncate">{alert.branchName}</span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${colors.chip} shrink-0`}>
                                      {alert.achievementPercent.toFixed(1)}%
                                    </span>
                                  </div>
                                  <p className={`text-xs sm:text-sm mt-1 ${colors.text}`}>{alert.message}</p>
                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[10px] sm:text-xs text-gray-600">
                                    <span>الهدف: <span className="font-mono">{formatCurrency(alert.targetAmount)}</span></span>
                                    <span className="text-gray-300">•</span>
                                    <span>المحقق: <span className="font-mono">{formatCurrency(alert.achievedAmount)}</span></span>
                                    <span className="text-gray-300">•</span>
                                    <span>المتبقي: {alert.daysRemaining} يوم</span>
                                  </div>
                                  <div className="mt-2 h-1.5 rounded-full bg-white/80 overflow-hidden" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`نسبة تحقيق ${alert.branchName}`}>
                                    <div className={`h-full bg-gradient-to-l ${colors.bar} transition-all`} style={{ width: `${pct}%` }} />
                                  </div>
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

              <div className="space-y-3 sm:space-y-4">
                <Card className="border-0 ring-1 ring-violet-100 shadow-sm overflow-hidden">
                  <CardHeader className="p-3 sm:p-4 bg-gradient-to-l from-violet-50 to-white border-b border-violet-100">
                    <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center">
                        <AlertTriangle className="h-3.5 w-3.5" />
                      </div>
                      ملخص التنبيهات
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4">
                    {(() => {
                      const total = alerts.length || 1;
                      const items = [
                        { key: 'critical',  label: 'حرجة',        icon: AlertTriangle, count: alerts.filter(a => a.alertLevel === 'critical').length,  color: 'rose'    },
                        { key: 'warning',   label: 'تحذير',       icon: Bell,          count: alerts.filter(a => a.alertLevel === 'warning').length,   color: 'amber'   },
                        { key: 'on_track',  label: 'على المسار',  icon: Clock,         count: alerts.filter(a => a.alertLevel === 'on_track').length,  color: 'sky'     },
                        { key: 'exceeding', label: 'تجاوز الهدف', icon: CheckCircle2,  count: alerts.filter(a => a.alertLevel === 'exceeding').length, color: 'emerald' },
                      ] as const;
                      const palette: Record<string, { dot: string; text: string; bar: string; chip: string }> = {
                        rose:    { dot: 'bg-rose-500',    text: 'text-rose-700',    bar: 'from-rose-400 to-rose-600',       chip: 'bg-rose-100 text-rose-700' },
                        amber:   { dot: 'bg-amber-500',   text: 'text-amber-700',   bar: 'from-amber-400 to-amber-600',     chip: 'bg-amber-100 text-amber-700' },
                        sky:     { dot: 'bg-sky-500',     text: 'text-sky-700',     bar: 'from-sky-400 to-sky-600',         chip: 'bg-sky-100 text-sky-700' },
                        emerald: { dot: 'bg-emerald-500', text: 'text-emerald-700', bar: 'from-emerald-400 to-emerald-600', chip: 'bg-emerald-100 text-emerald-700' },
                      };
                      return (
                        <div className="space-y-2.5">
                          {items.map(({ key, label, icon: Icon, count, color }) => {
                            const p = palette[color];
                            const ratio = (count / total) * 100;
                            return (
                              <div key={key} data-testid={`alert-summary-${key}`}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className={`flex items-center gap-2 text-xs sm:text-sm ${p.text}`}>
                                    <span className={`h-2 w-2 rounded-full ${p.dot}`} aria-hidden />
                                    <Icon className="h-3.5 w-3.5" />
                                    {label}
                                  </span>
                                  <span className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full ${p.chip}`}>{count}</span>
                                </div>
                                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden" role="progressbar" aria-valuenow={Math.round(ratio)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
                                  <div className={`h-full bg-gradient-to-l ${p.bar} transition-all`} style={{ width: `${ratio}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>

                <Card className="border-0 ring-1 ring-violet-100 shadow-sm overflow-hidden">
                  <CardHeader className="p-3 sm:p-4 bg-gradient-to-l from-violet-50 to-white border-b border-violet-100">
                    <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center">
                        <TrendingUp className="h-3.5 w-3.5" />
                      </div>
                      متوسط التوقعات
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4">
                    {alerts.length > 0 ? (() => {
                      const projected = alerts.reduce((sum, a) => sum + a.projectedAchievement, 0) / alerts.length;
                      const cap = Math.min(projected, 100);
                      return (
                        <div className="text-center">
                          <div className={`text-3xl font-bold ${getPercentColor(projected)}`}>{projected.toFixed(1)}%</div>
                          <p className="text-xs sm:text-sm text-gray-500 mt-1">التحقيق المتوقع نهاية الشهر</p>
                          <div className="mt-3 h-1.5 rounded-full bg-gray-100 overflow-hidden" role="progressbar" aria-valuenow={Math.round(cap)} aria-valuemin={0} aria-valuemax={100} aria-label="التحقيق المتوقع">
                            <div className={`h-full bg-gradient-to-l ${getPercentBarClasses(projected)} transition-all`} style={{ width: `${cap}%` }} />
                          </div>
                        </div>
                      );
                    })() : (
                      <div className="text-center text-gray-500 text-sm py-4">لا توجد بيانات</div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="branches">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
              <Card className="border-0 ring-1 ring-violet-100 shadow-sm overflow-hidden">
                <CardHeader className="p-3 sm:p-4 bg-gradient-to-l from-violet-50 to-white border-b border-violet-100">
                  <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                    <div className="h-8 w-8 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center">
                      <Trophy className="h-4 w-4" />
                    </div>
                    ترتيب الفروع
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-4">
                  {leaderboardLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-16 rounded-lg skeleton-pro" />
                      ))}
                    </div>
                  ) : !leaderboard?.branches.length ? (
                    <div className="text-center py-10 text-gray-500 text-sm">لا توجد بيانات</div>
                  ) : (
                    <div className="space-y-2">
                      {leaderboard.branches.map((branch) => {
                        const pct = Math.min(branch.percent, 100);
                        return (
                          <div key={branch.branchId} className="p-2.5 sm:p-3 bg-gray-50/70 hover:bg-violet-50/50 ring-1 ring-gray-100 rounded-xl transition-colors" data-testid={`branch-rank-${branch.branchId}`}>
                            <div className="flex items-center gap-3">
                              <div className="shrink-0">{getRankBadge(branch.rank)}</div>
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-sm text-gray-900 truncate">{branch.branchName}</div>
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] sm:text-xs text-gray-500 mt-0.5">
                                  <span>الهدف: <span className="font-mono">{formatCurrency(branch.target)}</span></span>
                                  <span className="text-gray-300">•</span>
                                  <span>المحقق: <span className="font-mono">{formatCurrency(branch.achieved)}</span></span>
                                </div>
                              </div>
                              <div className={`text-base sm:text-lg font-bold ${getPercentColor(branch.percent)} shrink-0`}>
                                {branch.percent.toFixed(1)}%
                              </div>
                            </div>
                            <div className="mt-2 h-1.5 rounded-full bg-white overflow-hidden ring-1 ring-gray-100" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`أداء ${branch.branchName}`}>
                              <div className={`h-full bg-gradient-to-l ${getPercentBarClasses(branch.percent)} transition-all`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-0 ring-1 ring-violet-100 shadow-sm overflow-hidden">
                <CardHeader className="p-3 sm:p-4 bg-gradient-to-l from-violet-50 to-white border-b border-violet-100">
                  <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                    <div className="h-8 w-8 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center">
                      <BarChart3 className="h-4 w-4" />
                    </div>
                    مقارنة أداء الفروع
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-4">
                  {leaderboard?.branches && leaderboard.branches.length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={leaderboard.branches} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                        <defs>
                          <linearGradient id="targetGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.95} />
                            <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.55} />
                          </linearGradient>
                          <linearGradient id="achievedGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity={0.95} />
                            <stop offset="100%" stopColor="#10b981" stopOpacity={0.55} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ede9fe" />
                        <XAxis dataKey="branchName" tick={{ fontSize: 10, fill: '#6b7280' }} stroke="#e5e7eb" />
                        <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} stroke="#e5e7eb" />
                        <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ borderRadius: 12, border: '1px solid #ede9fe', fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Bar dataKey="target" fill="url(#targetGradient)" name="الهدف" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="achieved" fill="url(#achievedGradient)" name="المحقق" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center py-10 text-gray-500 text-sm">لا توجد بيانات</div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="cashiers">
            <Card className="border-0 ring-1 ring-violet-100 shadow-sm overflow-hidden">
              <CardHeader className="p-3 sm:p-4 bg-gradient-to-l from-violet-50 to-white border-b border-violet-100">
                <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                  <div className="h-8 w-8 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center">
                    <Users className="h-4 w-4" />
                  </div>
                  أفضل 20 كاشير
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-4">
                {leaderboardLoading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="h-20 rounded-xl skeleton-pro" />
                    ))}
                  </div>
                ) : !leaderboard?.cashiers.length ? (
                  <div className="text-center py-10 text-gray-500 text-sm">لا توجد بيانات</div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
                    {leaderboard.cashiers.map((cashier) => (
                      <Card
                        key={cashier.cashierId}
                        className={`border-0 ring-1 shadow-sm hover:shadow-md transition-shadow ${cashier.rank <= 3 ? 'ring-amber-300 bg-gradient-to-br from-amber-50 to-white' : 'ring-violet-100 bg-white'}`}
                        data-testid={`cashier-rank-${cashier.cashierId}`}
                      >
                        <CardContent className="p-2.5 sm:p-3">
                          <div className="flex items-start justify-between mb-1.5">
                            {getRankBadge(cashier.rank)}
                          </div>
                          <div className="font-semibold text-xs sm:text-sm truncate text-gray-900">{cashier.cashierName}</div>
                          <div className="text-[10px] sm:text-xs text-gray-500 truncate">
                            {branches.find(b => b.id === cashier.branchId)?.name || cashier.branchId}
                          </div>
                          <div className={`mt-1.5 text-sm sm:text-base font-bold font-mono ${cashier.achieved > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                            {cashier.achieved > 0 ? formatCurrency(cashier.achieved) : '—'}
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
            <div className="space-y-4 sm:space-y-6">
              <Card className="border-0 ring-1 ring-violet-100 shadow-sm overflow-hidden">
                <CardHeader className="p-3 sm:p-4 bg-gradient-to-l from-violet-50 to-white border-b border-violet-100">
                  <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                    <div className="h-8 w-8 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center">
                      <Calendar className="h-4 w-4" />
                    </div>
                    التقدم اليومي للمبيعات مقابل الأهداف
                  </CardTitle>
                  <div className="flex items-center gap-2 sm:gap-3 mt-3 flex-wrap">
                    <Select value={selectedBranch} onValueChange={setSelectedBranch} disabled={!canSelectBranch}>
                      <SelectTrigger className="w-48 h-10 bg-white" data-testid="select-branch">
                        <SelectValue placeholder="اختر الفرع" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[320px] overflow-y-auto">
                        {canSelectBranch && <SelectItem value="all">اختر فرع</SelectItem>}
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
                <CardContent className="p-3 sm:p-4">
                  {selectedBranch === "all" ? (
                    <div className="text-center py-10 text-gray-500 text-sm">اختر فرعًا لعرض التقدم اليومي</div>
                  ) : progressLoading ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                        {Array.from({ length: 5 }).map((_, i) => (<div key={i} className="h-16 rounded-xl skeleton-pro" />))}
                      </div>
                      <div className="h-64 rounded-xl skeleton-pro" />
                    </div>
                  ) : !branchProgress ? (
                    <div className="text-center py-10 text-gray-500 text-sm">لا توجد أهداف مسجلة لهذا الفرع</div>
                  ) : (
                    <div className="space-y-4 sm:space-y-6">
                      {(() => {
                        const miniStats = [
                          { key: 'target',    label: 'الهدف الشهري',       value: formatCurrency(branchProgress.targetAmount),      tint: 'bg-violet-50',  ring: 'ring-violet-100',  icon: Target,      iconBg: 'bg-violet-100 text-violet-700' },
                          { key: 'achieved',  label: 'المحقق الفعلي',      value: formatCurrency(branchProgress.achievedAmount),    tint: 'bg-emerald-50', ring: 'ring-emerald-100', icon: TrendingUp,  iconBg: 'bg-emerald-100 text-emerald-700' },
                          { key: 'percent',   label: 'نسبة التحقيق',      value: `${branchProgress.achievementPercent.toFixed(1)}%`, tint: 'bg-sky-50',    ring: 'ring-sky-100',     icon: Award,       iconBg: 'bg-sky-100 text-sky-700',         valueClass: getPercentColor(branchProgress.achievementPercent) },
                          { key: 'remaining', label: 'المتبقي',            value: formatCurrency(branchProgress.remainingAmount),   tint: 'bg-rose-50',    ring: 'ring-rose-100',    icon: AlertTriangle, iconBg: 'bg-rose-100 text-rose-700' },
                          { key: 'daily',     label: 'متوسط الهدف اليومي', value: formatCurrency(branchProgress.dailyTargetAverage), tint: 'bg-fuchsia-50', ring: 'ring-fuchsia-100', icon: Calendar,    iconBg: 'bg-fuchsia-100 text-fuchsia-700' },
                        ] as const;
                        return (
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-3">
                            {miniStats.map((s) => {
                              const Icon = s.icon;
                              return (
                                <Card key={s.key} className={`border-0 ring-1 ${s.ring} ${s.tint} shadow-sm`}>
                                  <CardContent className="p-2.5 sm:p-3">
                                    <div className="flex items-start justify-between gap-1.5">
                                      <div className="min-w-0 flex-1">
                                        <div className="text-[10px] text-gray-600 truncate">{s.label}</div>
                                        <div className={`text-base sm:text-lg font-bold font-mono truncate ${('valueClass' in s && s.valueClass) || 'text-gray-900'}`}>{s.value}</div>
                                      </div>
                                      <div className={`shrink-0 h-7 w-7 rounded-lg ${s.iconBg} flex items-center justify-center`}>
                                        <Icon className="h-3.5 w-3.5" />
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              );
                            })}
                          </div>
                        );
                      })()}

                      {branchProgress.dailyProgress.length > 0 && (
                        <>
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                            <Card className="border-0 ring-1 ring-violet-100 shadow-sm overflow-hidden">
                              <CardHeader className="p-3 bg-gradient-to-l from-violet-50 to-white border-b border-violet-100">
                                <CardTitle className="text-sm flex items-center gap-2">
                                  <div className="h-7 w-7 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center"><BarChart3 className="h-3.5 w-3.5" /></div>
                                  المبيعات اليومية مقابل الهدف
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="p-2 sm:p-3">
                                <ResponsiveContainer width="100%" height={240}>
                                  <BarChart data={branchProgress.dailyProgress.filter(d => d.achievedAmount > 0 || d.targetAmount > 0)} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                                    <defs>
                                      <linearGradient id="dailyTargetGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.95} />
                                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.55} />
                                      </linearGradient>
                                      <linearGradient id="dailyAchievedGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.95} />
                                        <stop offset="100%" stopColor="#10b981" stopOpacity={0.55} />
                                      </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#ede9fe" />
                                    <XAxis dataKey="date" tickFormatter={(v) => new Date(v).getDate().toString()} tick={{ fontSize: 10, fill: '#6b7280' }} stroke="#e5e7eb" />
                                    <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} stroke="#e5e7eb" />
                                    <Tooltip formatter={(value: number) => formatCurrency(value)} labelFormatter={(v) => `${new Date(v).toLocaleDateString('en-GB')}`} contentStyle={{ borderRadius: 12, border: '1px solid #ede9fe', fontSize: 12 }} />
                                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                                    <Bar dataKey="targetAmount" fill="url(#dailyTargetGradient)" name="الهدف اليومي" radius={[4,4,0,0]} />
                                    <Bar dataKey="achievedAmount" fill="url(#dailyAchievedGradient)" name="المحقق" radius={[4,4,0,0]} />
                                  </BarChart>
                                </ResponsiveContainer>
                              </CardContent>
                            </Card>
                            
                            <Card className="border-0 ring-1 ring-violet-100 shadow-sm overflow-hidden">
                              <CardHeader className="p-3 bg-gradient-to-l from-violet-50 to-white border-b border-violet-100">
                                <CardTitle className="text-sm flex items-center gap-2">
                                  <div className="h-7 w-7 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center"><Activity className="h-3.5 w-3.5" /></div>
                                  التقدم التراكمي
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="p-2 sm:p-3">
                                <ResponsiveContainer width="100%" height={240}>
                                  <LineChart data={branchProgress.dailyProgress.filter(d => d.cumulativeAchieved > 0)} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#ede9fe" />
                                    <XAxis dataKey="date" tickFormatter={(v) => new Date(v).getDate().toString()} tick={{ fontSize: 10, fill: '#6b7280' }} stroke="#e5e7eb" />
                                    <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} stroke="#e5e7eb" />
                                    <Tooltip formatter={(value: number) => formatCurrency(value)} labelFormatter={(v) => new Date(v).toLocaleDateString('en-GB')} contentStyle={{ borderRadius: 12, border: '1px solid #ede9fe', fontSize: 12 }} />
                                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                                    <Line type="monotone" dataKey="cumulativeTarget" stroke="#8b5cf6" name="الهدف التراكمي" strokeWidth={2.5} dot={false} />
                                    <Line type="monotone" dataKey="cumulativeAchieved" stroke="#10b981" name="المحقق التراكمي" strokeWidth={2.5} dot={false} />
                                  </LineChart>
                                </ResponsiveContainer>
                              </CardContent>
                            </Card>
                          </div>

                          <Card className="border-0 ring-1 ring-violet-100 shadow-sm overflow-hidden">
                            <CardHeader className="p-3 bg-gradient-to-l from-violet-50 to-white border-b border-violet-100">
                              <CardTitle className="text-sm flex items-center gap-2">
                                <div className="h-7 w-7 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center"><Calendar className="h-3.5 w-3.5" /></div>
                                جدول التقدم اليومي التفصيلي
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs sm:text-sm min-w-[640px]">
                                  <thead>
                                    <tr className="bg-violet-50/60 text-violet-900">
                                      <th className="p-2.5 text-right font-semibold">التاريخ</th>
                                      <th className="p-2.5 text-right font-semibold hidden md:table-cell">اليوم</th>
                                      <th className="p-2.5 text-left font-semibold">الهدف</th>
                                      <th className="p-2.5 text-left font-semibold">المحقق</th>
                                      <th className="p-2.5 text-center font-semibold">النسبة</th>
                                      <th className="p-2.5 text-left font-semibold hidden sm:table-cell">الفارق</th>
                                      <th className="p-2.5 text-center font-semibold w-[80px]">يوميات</th>
                                      <th className="p-2.5 text-center font-semibold w-[80px]">تراكمي%</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {branchProgress.dailyProgress
                                      .filter(d => d.achievedAmount > 0 || new Date(d.date) <= new Date())
                                      .map((day) => (
                                      <tr key={day.date} className={`border-t border-gray-100 hover:bg-violet-50/40 transition-colors ${day.achievedAmount > 0 ? '' : 'text-gray-400'}`}>
                                        <td className="p-2.5 text-right">{new Date(day.date).toLocaleDateString('en-GB')}</td>
                                        <td className="p-2.5 text-right hidden md:table-cell">{day.dayName}</td>
                                        <td className="p-2.5 text-left font-mono">{formatCurrency(day.targetAmount)}</td>
                                        <td className="p-2.5 text-left font-mono font-bold">{formatCurrency(day.achievedAmount)}</td>
                                        <td className={`p-2.5 text-center font-bold ${getPercentColor(day.achievementPercent)}`}>
                                          {day.achievementPercent.toFixed(0)}%
                                        </td>
                                        <td className={`p-2.5 text-left font-mono hidden sm:table-cell ${day.variance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                          {day.variance >= 0 ? '+' : ''}{formatCurrency(day.variance)}
                                        </td>
                                        <td className="p-2.5 text-center">
                                          {day.journalCount > 0 && (
                                            <Badge variant="outline" className="border-violet-200 text-violet-700 bg-violet-50">{day.journalCount}</Badge>
                                          )}
                                        </td>
                                        <td className={`p-2.5 text-center font-bold ${getPercentColor(day.cumulativePercent)}`}>
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
                <Card className="border-0 ring-1 ring-violet-100 shadow-sm overflow-hidden">
                  <CardHeader className="p-3 sm:p-4 bg-gradient-to-l from-violet-50 to-white border-b border-violet-100">
                    <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center">
                        <Building2 className="h-4 w-4" />
                      </div>
                      ملخص تقدم جميع الفروع
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs sm:text-sm min-w-[760px]">
                        <thead>
                          <tr className="bg-violet-50/60 text-violet-900">
                            <th className="p-2.5 text-right font-semibold">الفرع</th>
                            <th className="p-2.5 text-right font-semibold">الهدف</th>
                            <th className="p-2.5 text-right font-semibold">المحقق</th>
                            <th className="p-2.5 text-right font-semibold">النسبة</th>
                            <th className="p-2.5 text-right font-semibold">المتبقي</th>
                            <th className="p-2.5 text-right font-semibold">متوسط يومي</th>
                            <th className="p-2.5 text-right font-semibold">المتوقع</th>
                            <th className="p-2.5 text-right font-semibold">الاتجاه</th>
                          </tr>
                        </thead>
                        <tbody>
                          {progressSummary.map((branch) => (
                            <tr key={branch.branchId} className="border-t border-gray-100 hover:bg-violet-50/40 transition-colors">
                              <td className="p-2.5 font-semibold text-gray-900">{branch.branchName}</td>
                              <td className="p-2.5 font-mono">{formatCurrency(branch.targetAmount)}</td>
                              <td className="p-2.5 font-mono font-bold text-emerald-600">{formatCurrency(branch.achievedAmount)}</td>
                              <td className={`p-2.5 font-bold ${getPercentColor(branch.achievementPercent)}`}>
                                {branch.achievementPercent.toFixed(1)}%
                              </td>
                              <td className="p-2.5 font-mono text-rose-600">{formatCurrency(branch.remainingAmount)}</td>
                              <td className="p-2.5 font-mono">{formatCurrency(branch.averageDailySales)}</td>
                              <td className={`p-2.5 font-bold ${getPercentColor(branch.projectedPercent)}`}>
                                {branch.projectedPercent.toFixed(1)}%
                              </td>
                              <td className="p-2.5">
                                {branch.trend === 'up' && (
                                  <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                    <TrendingUp className="h-3 w-3" /> صعود
                                  </span>
                                )}
                                {branch.trend === 'down' && (
                                  <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                                    <TrendingDown className="h-3 w-3" /> هبوط
                                  </span>
                                )}
                                {branch.trend === 'stable' && (
                                  <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                                    <Minus className="h-3 w-3" /> مستقر
                                  </span>
                                )}
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

          <TabsContent value="incentives">
            <Card className="border-0 ring-1 ring-violet-100 shadow-sm overflow-hidden">
              <CardHeader className="p-3 sm:p-4 bg-gradient-to-l from-violet-50 to-white border-b border-violet-100">
                <div className="flex items-start sm:items-center justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                      <div className="h-8 w-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                        <Star className="h-4 w-4" />
                      </div>
                      ترتيب الكاشيرين حسب نقاط الحوافز
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm mt-1">النقاط المكتسبة من التحديات اليومية والعمولات</CardDescription>
                  </div>
                  <Link href="/incentives-management">
                    <Button variant="outline" size="sm" className="text-xs border-violet-200 text-violet-700 hover:bg-violet-50" data-testid="btn-manage-incentives">
                      <Gift className="h-3 w-3 ml-1" />
                      إدارة الحوافز
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="p-3 sm:p-4">
                {pointsLeaderboardLoading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="h-24 rounded-xl skeleton-pro" />
                    ))}
                  </div>
                ) : topCashiersByPoints.length === 0 ? (
                  <div className="text-center py-10 text-gray-500">
                    <div className="h-12 w-12 mx-auto mb-2 rounded-full bg-violet-50 flex items-center justify-center">
                      <Star className="h-6 w-6 text-violet-300" />
                    </div>
                    <p className="text-xs sm:text-sm">لا توجد نقاط حوافز لهذا الشهر</p>
                    <Link href="/incentives-management">
                      <Button variant="link" size="sm" className="mt-2 text-violet-600">ابدأ بإعداد التحديات والحوافز</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(() => {
                      const mini = [
                        { key: 'pts',   label: 'إجمالي النقاط',  value: topCashiersByPoints.reduce((s, c) => s + c.totalPoints, 0).toLocaleString(), icon: Star,        tint: 'bg-amber-50',   ring: 'ring-amber-100',   iconBg: 'bg-amber-100 text-amber-700',   tid: 'text-incentives-total-points' },
                        { key: 'amt',   label: 'إجمالي المبالغ', value: formatCurrency(topCashiersByPoints.reduce((s, c) => s + c.totalAmount, 0)),  icon: DollarSign,  tint: 'bg-emerald-50', ring: 'ring-emerald-100', iconBg: 'bg-emerald-100 text-emerald-700', tid: 'text-incentives-total-amount', mono: true },
                        { key: 'count', label: 'عدد الكاشيرين',  value: topCashiersByPoints.length.toString(),                                       icon: Users,       tint: 'bg-violet-50',  ring: 'ring-violet-100',  iconBg: 'bg-violet-100 text-violet-700',  tid: 'text-incentives-cashier-count' },
                      ] as const;
                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                          {mini.map((m) => {
                            const Icon = m.icon;
                            return (
                              <Card key={m.key} className={`border-0 ring-1 ${m.ring} ${m.tint} shadow-sm`}>
                                <CardContent className="p-3">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <p className="text-[10px] text-gray-600 truncate">{m.label}</p>
                                      <p className={`text-base sm:text-lg font-bold text-gray-900 truncate ${('mono' in m && m.mono) ? 'font-mono' : ''}`} data-testid={m.tid}>{m.value}</p>
                                    </div>
                                    <div className={`shrink-0 h-7 w-7 rounded-lg ${m.iconBg} flex items-center justify-center`}>
                                      <Icon className="h-3.5 w-3.5" />
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {(() => {
                      const maxPoints = Math.max(...topCashiersByPoints.map(c => c.totalPoints), 1);
                      return (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
                          {topCashiersByPoints.map((cashier, index) => {
                            const ratio = (cashier.totalPoints / maxPoints) * 100;
                            return (
                              <Card
                                key={cashier.cashierId}
                                className={`border-0 ring-1 shadow-sm hover:shadow-md transition-shadow ${index < 3 ? 'ring-amber-300 bg-gradient-to-br from-amber-50 to-white' : 'ring-violet-100 bg-white'}`}
                                data-testid={`points-rank-${cashier.cashierId}`}
                              >
                                <CardContent className="p-2.5 sm:p-3">
                                  <div className="flex items-start justify-between mb-1.5">
                                    <div className="flex items-center gap-1">
                                      {index === 0 && <span className="text-lg">🥇</span>}
                                      {index === 1 && <span className="text-lg">🥈</span>}
                                      {index === 2 && <span className="text-lg">🥉</span>}
                                      {index > 2 && <Badge variant="outline" className="text-[10px] border-violet-200 text-violet-700 bg-violet-50">#{index + 1}</Badge>}
                                    </div>
                                    <div className="text-left">
                                      <span className="text-sm sm:text-base font-bold text-amber-600">{cashier.totalPoints}</span>
                                      <span className="text-[10px] text-amber-500 block leading-none">نقطة</span>
                                    </div>
                                  </div>
                                  <div className="font-semibold text-xs sm:text-sm truncate text-gray-900">{cashier.cashierName}</div>
                                  <div className="text-[10px] sm:text-xs text-gray-500 truncate">{cashier.branchName}</div>
                                  <div className="mt-1.5 h-1 rounded-full bg-gray-100 overflow-hidden" role="progressbar" aria-valuenow={Math.round(ratio)} aria-valuemin={0} aria-valuemax={100} aria-label={`نقاط ${cashier.cashierName}`}>
                                    <div className="h-full bg-gradient-to-l from-amber-400 to-amber-600 transition-all" style={{ width: `${ratio}%` }} />
                                  </div>
                                  <div className="mt-1.5 flex items-center justify-between text-[10px]">
                                    <span className="text-emerald-600 font-medium font-mono">{formatCurrency(cashier.totalAmount)}</span>
                                    <span className="text-gray-400">{cashier.challengeCount} تحدي</span>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
