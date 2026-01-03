import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { ar } from "date-fns/locale";
import {
  ArrowRight,
  FileSpreadsheet,
  FileText,
  Download,
  RefreshCw,
  Calendar,
  Building2,
  Clock,
  Package,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  AlertTriangle,
  CheckCircle,
  Target,
  Trash2,
  Users,
  Loader2,
  DollarSign,
  Percent,
  Factory,
  ClipboardCheck,
  Sparkles,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useProductionContext } from "@/contexts/ProductionContext";
import * as XLSX from "xlsx";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart as RechartsPie,
  Pie,
  Cell,
  ComposedChart,
  Area,
} from "recharts";

interface Branch {
  id: string;
  name: string;
}

interface ReportData {
  dailySummary: {
    totalBatches: number;
    totalQuantity: number;
    avgBatchSize: number;
    byDestination: Record<string, number>;
    byCategory: Record<string, number>;
    byHour: Record<string, number>;
  };
  targetComparison: {
    target: number;
    actual: number;
    completionRate: number;
    gap: number;
    status: string;
  };
  salesData?: {
    totalSales: number;
    journalCount: number;
  };
  wasteAnalysis: {
    totalReports: number;
    totalQuantity: number;
    totalValue: number;
    wastePercentage?: number;
    byReason: Record<string, number>;
    byProduct: Array<{ name: string; quantity: number; value: number }>;
  };
  qualityControl: {
    totalChecks: number;
    passed: number;
    failed: number;
    passRate: number;
    issues: Array<{ product: string; issue: string; date: string }>;
  };
  shiftPerformance: Array<{
    shift: string;
    production: number;
    target: number;
    efficiency: number;
  }>;
  productPerformance: Array<{
    productName: string;
    quantity: number;
    percentage: number;
    trend: number;
  }>;
  branchComparison: Array<{
    branchName: string;
    production: number;
    target: number;
    efficiency: number;
  }>;
  trends: {
    daily: Array<{ date: string; production: number; target: number; sales?: number; waste?: number }>;
    weekly: Array<{ week: string; production: number }>;
  };
}

const CHART_COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];

const DATE_PRESETS = [
  { label: "اليوم", getValue: () => ({ start: new Date(), end: new Date() }) },
  { label: "أمس", getValue: () => ({ start: subDays(new Date(), 1), end: subDays(new Date(), 1) }) },
  { label: "آخر 7 أيام", getValue: () => ({ start: subDays(new Date(), 6), end: new Date() }) },
  { label: "آخر 30 يوم", getValue: () => ({ start: subDays(new Date(), 29), end: new Date() }) },
  { label: "هذا الأسبوع", getValue: () => ({ start: startOfWeek(new Date(), { weekStartsOn: 0 }), end: endOfWeek(new Date(), { weekStartsOn: 0 }) }) },
  { label: "هذا الشهر", getValue: () => ({ start: startOfMonth(new Date()), end: endOfMonth(new Date()) }) },
];

export default function ProductionReportsPage() {
  const { selectedBranch, setSelectedBranch, selectedDate, setSelectedDate } = useProductionContext();
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [activeTab, setActiveTab] = useState("summary");
  const [isExporting, setIsExporting] = useState<string | null>(null);

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const { data: reportData, isLoading, isError, error, refetch } = useQuery<ReportData>({
    queryKey: ["/api/production/reports", selectedBranch, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        branchId: selectedBranch || "all",
        startDate,
        endDate,
      });
      const res = await fetch(`/api/production/reports?${params}`, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) throw new Error("يرجى تسجيل الدخول أولاً");
        throw new Error("فشل في جلب التقارير");
      }
      return res.json();
    },
    retry: 1,
    staleTime: 30000,
  });

  const applyDatePreset = (preset: typeof DATE_PRESETS[0]) => {
    const { start, end } = preset.getValue();
    setStartDate(format(start, "yyyy-MM-dd"));
    setEndDate(format(end, "yyyy-MM-dd"));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR" }).format(amount);
  };

  const exportToExcel = useCallback(async (reportType: string) => {
    if (!reportData) return;
    setIsExporting("excel");
    
    try {
      const wb = XLSX.utils.book_new();
      const branchName = branches?.find(b => b.id === selectedBranch)?.name || "جميع الفروع";
      
      if (reportType === "all" || reportType === "summary") {
        const summaryData = [
          ["تقرير الإنتاج اليومي"],
          ["الفرع", branchName],
          ["الفترة", `${startDate} - ${endDate}`],
          [""],
          ["إجمالي الدفعات", reportData.dailySummary.totalBatches],
          ["إجمالي الكمية", reportData.dailySummary.totalQuantity],
          ["متوسط حجم الدفعة", reportData.dailySummary.avgBatchSize.toFixed(1)],
          [""],
          ["التوزيع حسب الوجهة"],
          ...Object.entries(reportData.dailySummary.byDestination).map(([dest, qty]) => [dest, qty]),
        ];
        const ws = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, ws, "ملخص الإنتاج");
      }
      
      if (reportType === "all" || reportType === "targets") {
        const targetData = [
          ["تقرير الأهداف والإنجاز"],
          ["الهدف", reportData.targetComparison.target],
          ["الفعلي", reportData.targetComparison.actual],
          ["نسبة الإنجاز", `${reportData.targetComparison.completionRate.toFixed(1)}%`],
          ["الفجوة", reportData.targetComparison.gap],
          ["الحالة", reportData.targetComparison.status],
        ];
        const ws = XLSX.utils.aoa_to_sheet(targetData);
        XLSX.utils.book_append_sheet(wb, ws, "الأهداف");
      }
      
      if (reportType === "all" || reportType === "waste") {
        const wasteData = [
          ["تقرير الهدر"],
          ["إجمالي التقارير", reportData.wasteAnalysis.totalReports],
          ["إجمالي الكمية المهدرة", reportData.wasteAnalysis.totalQuantity],
          ["إجمالي القيمة المهدرة", reportData.wasteAnalysis.totalValue],
          [""],
          ["التوزيع حسب السبب"],
          ...Object.entries(reportData.wasteAnalysis.byReason).map(([reason, qty]) => [reason, qty]),
        ];
        const ws = XLSX.utils.aoa_to_sheet(wasteData);
        XLSX.utils.book_append_sheet(wb, ws, "الهدر");
      }

      if (reportType === "all" || reportType === "products") {
        const productData = [
          ["المنتج", "الكمية", "النسبة", "الاتجاه"],
          ...reportData.productPerformance.map(p => [
            p.productName, p.quantity, `${p.percentage.toFixed(1)}%`, `${p.trend >= 0 ? '+' : ''}${p.trend.toFixed(1)}%`
          ]),
        ];
        const ws = XLSX.utils.aoa_to_sheet(productData);
        XLSX.utils.book_append_sheet(wb, ws, "أداء المنتجات");
      }

      XLSX.writeFile(wb, `تقارير_الإنتاج_${startDate}_${endDate}.xlsx`);
    } catch (error) {
      console.error("Export error:", error);
    } finally {
      setIsExporting(null);
    }
  }, [reportData, branches, selectedBranch, startDate, endDate]);

  const exportToCSV = useCallback(async (reportType: string) => {
    if (!reportData) return;
    setIsExporting("csv");
    
    try {
      let csvContent = "";
      
      if (reportType === "summary") {
        csvContent = "النوع,القيمة\n";
        csvContent += `إجمالي الدفعات,${reportData.dailySummary.totalBatches}\n`;
        csvContent += `إجمالي الكمية,${reportData.dailySummary.totalQuantity}\n`;
        csvContent += `متوسط حجم الدفعة,${reportData.dailySummary.avgBatchSize.toFixed(1)}\n`;
      } else if (reportType === "products") {
        csvContent = "المنتج,الكمية,النسبة,الاتجاه\n";
        reportData.productPerformance.forEach(p => {
          csvContent += `${p.productName},${p.quantity},${p.percentage.toFixed(1)}%,${p.trend >= 0 ? '+' : ''}${p.trend.toFixed(1)}%\n`;
        });
      }
      
      const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `تقرير_${reportType}_${startDate}.csv`;
      link.click();
    } catch (error) {
      console.error("Export error:", error);
    } finally {
      setIsExporting(null);
    }
  }, [reportData, startDate]);

  const exportToPDF = useCallback(async () => {
    setIsExporting("pdf");
    try {
      const pdfMake = (await import("pdfmake/build/pdfmake")).default;
      const pdfFonts = (await import("pdfmake/build/vfs_fonts")).default;
      pdfMake.vfs = pdfFonts.vfs;

      const docDefinition: any = {
        content: [
          { text: "تقارير الإنتاج الشاملة", style: "header", alignment: "right" },
          { text: `الفترة: ${startDate} - ${endDate}`, alignment: "right", margin: [0, 10, 0, 20] },
          { text: "ملخص الإنتاج", style: "subheader", alignment: "right" },
          {
            table: {
              widths: ["*", "*"],
              body: [
                [{ text: "القيمة", alignment: "center" }, { text: "البند", alignment: "center" }],
                [reportData?.dailySummary.totalBatches || 0, "إجمالي الدفعات"],
                [reportData?.dailySummary.totalQuantity || 0, "إجمالي الكمية"],
                [`${reportData?.targetComparison.completionRate?.toFixed(1) || 0}%`, "نسبة الإنجاز"],
              ],
            },
            margin: [0, 10, 0, 20],
          },
        ],
        styles: {
          header: { fontSize: 18, bold: true },
          subheader: { fontSize: 14, bold: true, margin: [0, 10, 0, 5] },
        },
      };

      pdfMake.createPdf(docDefinition).download(`تقارير_الإنتاج_${startDate}.pdf`);
    } catch (error) {
      console.error("PDF export error:", error);
    } finally {
      setIsExporting(null);
    }
  }, [reportData, startDate, endDate]);

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <Link href="/production-dashboard">
              <Button variant="ghost" size="icon" data-testid="btn-back">
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">التقارير الشاملة للإنتاج</h1>
              <p className="text-sm text-gray-500">جميع تقارير الإنتاج والتحليلات</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
              data-testid="btn-refresh"
              className="h-8"
            >
              <RefreshCw className={`h-4 w-4 ml-1 ${isLoading ? 'animate-spin' : ''}`} />
              تحديث
            </Button>
          </div>
        </div>

        {/* Quick Links to Related Pages */}
        <Card className="bg-gradient-to-l from-amber-50 to-white border-amber-200">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-medium text-gray-700">روابط سريعة للصفحات ذات الصلة</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
              <Link href="/daily-production">
                <Button variant="outline" size="sm" className="w-full h-auto py-2 flex flex-col items-center gap-1 hover:bg-amber-50 hover:border-amber-300" data-testid="link-daily-production">
                  <Package className="h-4 w-4 text-amber-600" />
                  <span className="text-xs">الإنتاج اليومي</span>
                </Button>
              </Link>
              <Link href="/advanced-production-orders">
                <Button variant="outline" size="sm" className="w-full h-auto py-2 flex flex-col items-center gap-1 hover:bg-blue-50 hover:border-blue-300" data-testid="link-orders">
                  <Target className="h-4 w-4 text-blue-600" />
                  <span className="text-xs">أوامر الإنتاج</span>
                </Button>
              </Link>
              <Link href="/ai-production-planner">
                <Button variant="outline" size="sm" className="w-full h-auto py-2 flex flex-col items-center gap-1 hover:bg-purple-50 hover:border-purple-300" data-testid="link-ai-planner">
                  <Sparkles className="h-4 w-4 text-purple-600" />
                  <span className="text-xs">التخطيط الذكي</span>
                </Button>
              </Link>
              <Link href="/display-bar-waste">
                <Button variant="outline" size="sm" className="w-full h-auto py-2 flex flex-col items-center gap-1 hover:bg-red-50 hover:border-red-300" data-testid="link-waste">
                  <Trash2 className="h-4 w-4 text-red-600" />
                  <span className="text-xs">إدارة الهالك</span>
                </Button>
              </Link>
              <Link href="/quality-control">
                <Button variant="outline" size="sm" className="w-full h-auto py-2 flex flex-col items-center gap-1 hover:bg-green-50 hover:border-green-300" data-testid="link-quality">
                  <ClipboardCheck className="h-4 w-4 text-green-600" />
                  <span className="text-xs">مراقبة الجودة</span>
                </Button>
              </Link>
              <Link href="/cashier-journal">
                <Button variant="outline" size="sm" className="w-full h-auto py-2 flex flex-col items-center gap-1 hover:bg-emerald-50 hover:border-emerald-300" data-testid="link-cashier">
                  <DollarSign className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs">يوميات الكاشير</span>
                </Button>
              </Link>
              <Link href="/production-dashboard">
                <Button variant="outline" size="sm" className="w-full h-auto py-2 flex flex-col items-center gap-1 hover:bg-cyan-50 hover:border-cyan-300" data-testid="link-dashboard">
                  <Factory className="h-4 w-4 text-cyan-600" />
                  <span className="text-xs">لوحة الإنتاج</span>
                </Button>
              </Link>
              <Link href="/command-center">
                <Button variant="outline" size="sm" className="w-full h-auto py-2 flex flex-col items-center gap-1 hover:bg-orange-50 hover:border-orange-300" data-testid="link-command">
                  <BarChart3 className="h-4 w-4 text-orange-600" />
                  <span className="text-xs">مركز القيادة</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-200">
          <CardContent className="p-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-gray-500" />
                <Select value={selectedBranch || "all"} onValueChange={setSelectedBranch}>
                  <SelectTrigger className="w-[140px] h-8 text-sm" data-testid="select-branch">
                    <SelectValue placeholder="الفرع" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الفروع</SelectItem>
                    {branches?.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-[130px] h-8 text-sm"
                  data-testid="input-start-date"
                />
                <span className="text-gray-400">-</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-[130px] h-8 text-sm"
                  data-testid="input-end-date"
                />
              </div>

              <div className="flex gap-1">
                {DATE_PRESETS.slice(0, 4).map((preset, i) => (
                  <Button
                    key={i}
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={() => applyDatePreset(preset)}
                    data-testid={`btn-preset-${i}`}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>

              <div className="flex gap-1 mr-auto">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => exportToExcel("all")}
                  disabled={isExporting !== null || !reportData}
                  data-testid="btn-export-excel"
                >
                  {isExporting === "excel" ? <Loader2 className="h-3 w-3 animate-spin ml-1" /> : <FileSpreadsheet className="h-3 w-3 ml-1" />}
                  Excel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={exportToPDF}
                  disabled={isExporting !== null || !reportData}
                  data-testid="btn-export-pdf"
                >
                  {isExporting === "pdf" ? <Loader2 className="h-3 w-3 animate-spin ml-1" /> : <FileText className="h-3 w-3 ml-1" />}
                  PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => exportToCSV("summary")}
                  disabled={isExporting !== null || !reportData}
                  data-testid="btn-export-csv"
                >
                  {isExporting === "csv" ? <Loader2 className="h-3 w-3 animate-spin ml-1" /> : <Download className="h-3 w-3 ml-1" />}
                  CSV
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid grid-cols-4 md:grid-cols-8 gap-1 h-auto p-1">
            <TabsTrigger value="summary" className="text-xs py-1.5" data-testid="tab-summary">
              <BarChart3 className="h-3 w-3 ml-1" />
              الملخص
            </TabsTrigger>
            <TabsTrigger value="targets" className="text-xs py-1.5" data-testid="tab-targets">
              <Target className="h-3 w-3 ml-1" />
              الأهداف
            </TabsTrigger>
            <TabsTrigger value="products" className="text-xs py-1.5" data-testid="tab-products">
              <Package className="h-3 w-3 ml-1" />
              المنتجات
            </TabsTrigger>
            <TabsTrigger value="waste" className="text-xs py-1.5" data-testid="tab-waste">
              <Trash2 className="h-3 w-3 ml-1" />
              الهدر
            </TabsTrigger>
            <TabsTrigger value="quality" className="text-xs py-1.5" data-testid="tab-quality">
              <CheckCircle className="h-3 w-3 ml-1" />
              الجودة
            </TabsTrigger>
            <TabsTrigger value="shifts" className="text-xs py-1.5" data-testid="tab-shifts">
              <Clock className="h-3 w-3 ml-1" />
              الورديات
            </TabsTrigger>
            <TabsTrigger value="branches" className="text-xs py-1.5" data-testid="tab-branches">
              <Building2 className="h-3 w-3 ml-1" />
              الفروع
            </TabsTrigger>
            <TabsTrigger value="trends" className="text-xs py-1.5" data-testid="tab-trends">
              <TrendingUp className="h-3 w-3 ml-1" />
              الاتجاهات
            </TabsTrigger>
          </TabsList>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : isError ? (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-8 text-center">
                <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-red-700 mb-2">خطأ في جلب التقارير</h3>
                <p className="text-red-600 mb-4">{error?.message || "حدث خطأ غير متوقع"}</p>
                <div className="flex gap-2 justify-center">
                  <Button onClick={() => refetch()} variant="outline" data-testid="btn-retry">
                    <RefreshCw className="h-4 w-4 ml-2" />
                    إعادة المحاولة
                  </Button>
                  <Link href="/login">
                    <Button variant="default" data-testid="btn-login">
                      تسجيل الدخول
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <TabsContent value="summary" className="space-y-4">
                {/* KPI Cards Row */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <Package className="h-4 w-4 text-blue-600" />
                        </div>
                        <span className="text-xs text-gray-600">إجمالي الدفعات</span>
                      </div>
                      <p className="text-2xl font-bold text-blue-700">{reportData?.dailySummary.totalBatches || 0}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-green-50 to-white border-green-200">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                          <BarChart3 className="h-4 w-4 text-green-600" />
                        </div>
                        <span className="text-xs text-gray-600">إجمالي الكمية</span>
                      </div>
                      <p className="text-2xl font-bold text-green-700">{reportData?.dailySummary.totalQuantity || 0}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-200">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-8 w-8 bg-amber-100 rounded-full flex items-center justify-center">
                          <Target className="h-4 w-4 text-amber-600" />
                        </div>
                        <span className="text-xs text-gray-600">نسبة الإنجاز</span>
                      </div>
                      <p className="text-2xl font-bold text-amber-700">{reportData?.targetComparison.completionRate?.toFixed(0) || 0}%</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-200">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-8 w-8 bg-emerald-100 rounded-full flex items-center justify-center">
                          <DollarSign className="h-4 w-4 text-emerald-600" />
                        </div>
                        <span className="text-xs text-gray-600">إجمالي المبيعات</span>
                      </div>
                      <p className="text-xl font-bold text-emerald-700">{formatCurrency(reportData?.salesData?.totalSales || 0)}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-red-50 to-white border-red-200">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-8 w-8 bg-red-100 rounded-full flex items-center justify-center">
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </div>
                        <span className="text-xs text-gray-600">قيمة الهالك</span>
                      </div>
                      <p className="text-xl font-bold text-red-700">{formatCurrency(reportData?.wasteAnalysis.totalValue || 0)}</p>
                    </CardContent>
                  </Card>
                  <Card className={`bg-gradient-to-br ${(reportData?.wasteAnalysis.wastePercentage || 0) > 5 ? 'from-red-50 border-red-300' : (reportData?.wasteAnalysis.wastePercentage || 0) > 2 ? 'from-amber-50 border-amber-300' : 'from-green-50 border-green-300'} to-white`}>
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center ${(reportData?.wasteAnalysis.wastePercentage || 0) > 5 ? 'bg-red-100' : (reportData?.wasteAnalysis.wastePercentage || 0) > 2 ? 'bg-amber-100' : 'bg-green-100'}`}>
                          <Percent className={`h-4 w-4 ${(reportData?.wasteAnalysis.wastePercentage || 0) > 5 ? 'text-red-600' : (reportData?.wasteAnalysis.wastePercentage || 0) > 2 ? 'text-amber-600' : 'text-green-600'}`} />
                        </div>
                        <span className="text-xs text-gray-600">نسبة الهدر</span>
                      </div>
                      <p className={`text-xl font-bold ${(reportData?.wasteAnalysis.wastePercentage || 0) > 5 ? 'text-red-700' : (reportData?.wasteAnalysis.wastePercentage || 0) > 2 ? 'text-amber-700' : 'text-green-700'}`}>
                        {(reportData?.wasteAnalysis.wastePercentage || 0).toFixed(2)}%
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Production Trends Chart */}
                {reportData?.trends?.daily && reportData.trends.daily.length > 0 && (
                  <Card>
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        اتجاهات الإنتاج والمبيعات
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-2 pb-4">
                      <ResponsiveContainer width="100%" height={250}>
                        <ComposedChart data={reportData.trends.daily}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                          <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Legend />
                          <Bar yAxisId="left" dataKey="production" name="الإنتاج" fill="#f59e0b" />
                          <Bar yAxisId="left" dataKey="target" name="الهدف" fill="#3b82f6" />
                          <Line yAxisId="right" type="monotone" dataKey="sales" name="المبيعات" stroke="#10b981" strokeWidth={2} />
                          <Area yAxisId="left" type="monotone" dataKey="waste" name="الهدر" fill="#ef4444" fillOpacity={0.3} stroke="#ef4444" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm">التوزيع حسب الوجهة</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      {Object.entries(reportData?.dailySummary.byDestination || {}).length > 0 ? (
                        <>
                          <ResponsiveContainer width="100%" height={180}>
                            <RechartsPie>
                              <Pie
                                data={Object.entries(reportData?.dailySummary.byDestination || {}).map(([name, value]) => ({ name, value }))}
                                cx="50%"
                                cy="50%"
                                innerRadius={40}
                                outerRadius={70}
                                paddingAngle={2}
                                dataKey="value"
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                labelLine={false}
                              >
                                {Object.entries(reportData?.dailySummary.byDestination || {}).map((_, index) => (
                                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip />
                            </RechartsPie>
                          </ResponsiveContainer>
                          <div className="space-y-1 mt-2">
                            {Object.entries(reportData?.dailySummary.byDestination || {}).map(([dest, qty], i) => (
                              <div key={dest} className="flex justify-between items-center text-xs">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                                  <span className="text-gray-600">{dest}</span>
                                </div>
                                <Badge variant="outline" className="text-xs">{qty}</Badge>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-gray-400 text-center py-4">لا توجد بيانات</p>
                      )}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm">التوزيع حسب الفئة</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      {Object.entries(reportData?.dailySummary.byCategory || {}).length > 0 ? (
                        <>
                          <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={Object.entries(reportData?.dailySummary.byCategory || {}).map(([name, value]) => ({ name, value }))}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                              <YAxis tick={{ fontSize: 10 }} />
                              <Tooltip />
                              <Bar dataKey="value" fill="#f59e0b">
                                {Object.entries(reportData?.dailySummary.byCategory || {}).map((_, index) => (
                                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                          <div className="space-y-1 mt-2">
                            {Object.entries(reportData?.dailySummary.byCategory || {}).map(([cat, qty], i) => (
                              <div key={cat} className="flex justify-between items-center text-xs">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                                  <span className="text-gray-600">{cat}</span>
                                </div>
                                <Badge variant="outline" className="text-xs">{qty}</Badge>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-gray-400 text-center py-4">لا توجد بيانات</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="targets" className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">الهدف</p>
                      <p className="text-xl font-bold text-gray-700">{reportData?.targetComparison.target || 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">الفعلي</p>
                      <p className="text-xl font-bold text-green-600">{reportData?.targetComparison.actual || 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">الفجوة</p>
                      <p className={`text-xl font-bold ${(reportData?.targetComparison.gap || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {(reportData?.targetComparison.gap || 0) >= 0 ? '+' : ''}{reportData?.targetComparison.gap || 0}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className={`${(reportData?.targetComparison.completionRate || 0) >= 100 ? 'bg-green-50 border-green-200' : (reportData?.targetComparison.completionRate || 0) >= 80 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">نسبة الإنجاز</p>
                      <p className={`text-xl font-bold ${(reportData?.targetComparison.completionRate || 0) >= 100 ? 'text-green-600' : (reportData?.targetComparison.completionRate || 0) >= 80 ? 'text-amber-600' : 'text-red-600'}`}>
                        {reportData?.targetComparison.completionRate?.toFixed(1) || 0}%
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="products" className="space-y-4">
                <Card>
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      أداء المنتجات
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    {reportData?.productPerformance && reportData.productPerformance.length > 0 ? (
                      <div className="space-y-2">
                        {reportData.productPerformance.map((product, i) => (
                          <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{product.productName}</span>
                              <Badge variant="outline" className="text-xs">{product.quantity}</Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">{product.percentage.toFixed(1)}%</span>
                              <span className={`text-xs font-medium ${product.trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {product.trend >= 0 ? <TrendingUp className="h-3 w-3 inline" /> : <TrendingDown className="h-3 w-3 inline" />}
                                {Math.abs(product.trend).toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 text-center py-8">لا توجد بيانات منتجات</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="waste" className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card className="bg-red-50 border-red-200">
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">تقارير الهدر</p>
                      <p className="text-xl font-bold text-red-600">{reportData?.wasteAnalysis.totalReports || 0}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-red-50 border-red-200">
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">الكمية المهدرة</p>
                      <p className="text-xl font-bold text-red-600">{reportData?.wasteAnalysis.totalQuantity || 0}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-red-50 border-red-200">
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">قيمة الهدر</p>
                      <p className="text-xl font-bold text-red-600">{formatCurrency(reportData?.wasteAnalysis.totalValue || 0)}</p>
                    </CardContent>
                  </Card>
                  <Card className={`bg-gradient-to-br ${(reportData?.wasteAnalysis.wastePercentage || 0) > 5 ? 'from-red-100 border-red-300' : (reportData?.wasteAnalysis.wastePercentage || 0) > 2 ? 'from-amber-100 border-amber-300' : 'from-green-100 border-green-300'} to-white`}>
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">نسبة الهدر من المبيعات</p>
                      <p className={`text-xl font-bold ${(reportData?.wasteAnalysis.wastePercentage || 0) > 5 ? 'text-red-600' : (reportData?.wasteAnalysis.wastePercentage || 0) > 2 ? 'text-amber-600' : 'text-green-600'}`}>
                        {(reportData?.wasteAnalysis.wastePercentage || 0).toFixed(2)}%
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm">التوزيع حسب السبب</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      {Object.entries(reportData?.wasteAnalysis.byReason || {}).length > 0 ? (
                        <>
                          <ResponsiveContainer width="100%" height={180}>
                            <RechartsPie>
                              <Pie
                                data={Object.entries(reportData?.wasteAnalysis.byReason || {}).map(([name, value]) => ({ name, value }))}
                                cx="50%"
                                cy="50%"
                                innerRadius={40}
                                outerRadius={70}
                                paddingAngle={2}
                                dataKey="value"
                                label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                                labelLine={false}
                              >
                                {Object.entries(reportData?.wasteAnalysis.byReason || {}).map((_, index) => (
                                  <Cell key={`cell-${index}`} fill={['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16'][index % 5]} />
                                ))}
                              </Pie>
                              <Tooltip />
                              <Legend />
                            </RechartsPie>
                          </ResponsiveContainer>
                          <div className="space-y-2 mt-2">
                            {Object.entries(reportData?.wasteAnalysis.byReason || {}).map(([reason, qty], i) => (
                              <div key={reason} className="flex justify-between items-center p-2 bg-red-50 rounded text-sm">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded" style={{ backgroundColor: ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16'][i % 5] }} />
                                  <span>{reason}</span>
                                </div>
                                <Badge variant="destructive">{qty}</Badge>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-gray-400 text-center py-4">لا توجد بيانات هدر</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm">أكثر المنتجات هدرًا (Top 10)</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      {reportData?.wasteAnalysis.byProduct && reportData.wasteAnalysis.byProduct.length > 0 ? (
                        <>
                          <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={reportData.wasteAnalysis.byProduct.slice(0, 10)} layout="vertical">
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis type="number" tick={{ fontSize: 10 }} />
                              <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 9 }} />
                              <Tooltip formatter={(value, name) => name === 'value' ? formatCurrency(value as number) : value} />
                              <Bar dataKey="quantity" name="الكمية" fill="#ef4444" />
                            </BarChart>
                          </ResponsiveContainer>
                          <div className="space-y-1 mt-2 max-h-32 overflow-y-auto">
                            {reportData.wasteAnalysis.byProduct.slice(0, 10).map((product, i) => (
                              <div key={i} className="flex justify-between items-center text-xs p-1 hover:bg-red-50 rounded">
                                <span className="text-gray-600 truncate">{product.name}</span>
                                <div className="flex gap-2">
                                  <Badge variant="outline" className="text-xs">{product.quantity}</Badge>
                                  <Badge variant="destructive" className="text-xs">{formatCurrency(product.value)}</Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-gray-400 text-center py-4">لا توجد بيانات منتجات</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Link to Waste Management Page */}
                <div className="flex justify-center">
                  <Link href="/display-bar-waste">
                    <Button variant="outline" className="gap-2">
                      <Trash2 className="h-4 w-4" />
                      عرض صفحة إدارة الهالك الكاملة
                      <ArrowRight className="h-4 w-4 rotate-180" />
                    </Button>
                  </Link>
                </div>
              </TabsContent>

              <TabsContent value="quality" className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">إجمالي الفحوصات</p>
                      <p className="text-xl font-bold">{reportData?.qualityControl.totalChecks || 0}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-green-50 border-green-200">
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">ناجح</p>
                      <p className="text-xl font-bold text-green-600">{reportData?.qualityControl.passed || 0}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-red-50 border-red-200">
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">فاشل</p>
                      <p className="text-xl font-bold text-red-600">{reportData?.qualityControl.failed || 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">نسبة النجاح</p>
                      <p className="text-xl font-bold text-green-600">{reportData?.qualityControl.passRate?.toFixed(0) || 0}%</p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="shifts" className="space-y-4">
                <Card>
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      أداء الورديات
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    {reportData?.shiftPerformance && reportData.shiftPerformance.length > 0 ? (
                      <div className="space-y-3">
                        {reportData.shiftPerformance.map((shift, i) => (
                          <div key={i} className="p-3 bg-gray-50 rounded-lg">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-medium">{shift.shift}</span>
                              <Badge variant={shift.efficiency >= 100 ? "default" : shift.efficiency >= 80 ? "secondary" : "destructive"}>
                                {shift.efficiency.toFixed(0)}%
                              </Badge>
                            </div>
                            <div className="flex justify-between text-sm text-gray-500">
                              <span>الإنتاج: {shift.production}</span>
                              <span>الهدف: {shift.target}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 text-center py-8">لا توجد بيانات ورديات</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="branches" className="space-y-4">
                <Card>
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      مقارنة الفروع
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    {reportData?.branchComparison && reportData.branchComparison.length > 0 ? (
                      <div className="space-y-3">
                        {reportData.branchComparison.map((branch, i) => (
                          <div key={i} className="p-3 bg-gray-50 rounded-lg">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-medium">{branch.branchName}</span>
                              <Badge variant={branch.efficiency >= 100 ? "default" : branch.efficiency >= 80 ? "secondary" : "destructive"}>
                                {branch.efficiency.toFixed(0)}%
                              </Badge>
                            </div>
                            <div className="flex justify-between text-sm text-gray-500">
                              <span>الإنتاج: {branch.production}</span>
                              <span>الهدف: {branch.target}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 text-center py-8">لا توجد بيانات فروع</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="trends" className="space-y-4">
                <Card>
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      اتجاهات الإنتاج
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    {reportData?.trends.daily && reportData.trends.daily.length > 0 ? (
                      <div className="space-y-2">
                        {reportData.trends.daily.map((day, i) => (
                          <div key={i} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                            <span className="text-sm">{day.date}</span>
                            <div className="flex gap-4">
                              <span className="text-sm text-green-600">الإنتاج: {day.production}</span>
                              <span className="text-sm text-gray-500">الهدف: {day.target}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 text-center py-8">لا توجد بيانات اتجاهات</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </Layout>
  );
}
