# ملفات الترحيل لـ GitHub

## ملاحظة مهمة
- المرحلة 1 (SQL) تم تنفيذها في Supabase ✅
- الملفات التالية تُضاف/تُعدّل على GitHub

---

## الملف 1: إضافة إلى نهاية shared/schema.ts

\`\`\`typescript
// Daily Production Batches - دفعات الإنتاج الفعلي اليومي
export const dailyProductionBatches = pgTable("daily_production_batches", {
  id: serial("id").primaryKey(),
  branchId: varchar("branch_id").notNull().references(() => branches.id),
  productId: integer("product_id").references(() => products.id),
  productName: text("product_name").notNull(),
  productCategory: text("product_category"),
  quantity: integer("quantity").notNull(),
  unit: text("unit").default("قطعة"),
  destination: text("destination").notNull(),
  shiftId: integer("shift_id").references(() => shifts.id),
  productionOrderId: integer("production_order_id"),
  producedAt: timestamp("produced_at").defaultNow().notNull(),
  recordedBy: varchar("recorded_by").references(() => users.id),
  recorderName: text("recorder_name"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDailyProductionBatchSchema = createInsertSchema(dailyProductionBatches).omit({
  id: true,
  createdAt: true,
});

export type DailyProductionBatch = typeof dailyProductionBatches.$inferSelect;
export type InsertDailyProductionBatch = z.infer<typeof insertDailyProductionBatchSchema>;
\`\`\`

---

## الملف 2: client/src/contexts/ProductionContext.tsx (ملف جديد)

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";

interface CommandCenterData {
  production: {
    totalBatches: number;
    totalQuantity: number;
    targetQuantity: number;
    completionRate: number;
    gap: number;
    byDestination: Record<string, number>;
    activeOrders: number;
    completedOrders: number;
  };
  inventory: {
    totalItems: number;
    totalValue: number;
    lowStockCount: number;
    maintenanceNeeded: number;
    goodCondition: number;
    damaged: number;
  };
  cashier: {
    totalSales: number;
    totalJournals: number;
    shortages: number;
    surpluses: number;
    shortageAmount: number;
    surplusAmount: number;
    averageTicket: number;
  };
  waste: {
    totalReports: number;
    totalWastedQuantity: number;
    totalWastedValue: number;
    wasteByReason: Record<string, number>;
  };
  comparison: {
    productionVsYesterday: number;
    salesVsYesterday: number;
  };
  branchId: string;
  date: string;
  timestamp: string;
}

interface ProductionContextType {
  selectedBranch: string;
  setSelectedBranch: (branch: string) => void;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  selectedShift: string;
  setSelectedShift: (shift: string) => void;
  autoRefresh: boolean;
  setAutoRefresh: (value: boolean) => void;
  lastUpdated: Date | null;
  commandCenterData: CommandCenterData | null;
  isLoading: boolean;
  refetch: () => void;
}

const ProductionContext = createContext<ProductionContextType | undefined>(undefined);

export function ProductionProvider({ children }: { children: ReactNode }) {
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [selectedShift, setSelectedShift] = useState<string>("");
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Auto-detect current shift
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 14) setSelectedShift("morning");
    else if (hour >= 14 && hour < 22) setSelectedShift("evening");
    else setSelectedShift("night");
  }, []);

  // Fetch command center data
  const { data: commandCenterData, isLoading, refetch } = useQuery<CommandCenterData>({
    queryKey: ["/api/command-center", selectedBranch, selectedDate],
    queryFn: async () => {
      const params = new URLSearchParams({ branchId: selectedBranch, date: selectedDate });
      const res = await fetch(`/api/command-center?${params}`, { credentials: "include" });
      if (!res.ok) {
        throw new Error("Failed to fetch command center data");
      }
      setLastUpdated(new Date());
      return res.json();
    },
    refetchInterval: autoRefresh ? 60000 : false,
    staleTime: 30000,
  });

  const handleRefetch = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <ProductionContext.Provider
      value={{
        selectedBranch,
        setSelectedBranch,
        selectedDate,
        setSelectedDate,
        selectedShift,
        setSelectedShift,
        autoRefresh,
        setAutoRefresh,
        lastUpdated,
        commandCenterData: commandCenterData || null,
        isLoading,
        refetch: handleRefetch,
      }}
    >
      {children}
    </ProductionContext.Provider>
  );
}

export function useProductionContext() {
  const context = useContext(ProductionContext);
  if (context === undefined) {
    throw new Error("useProductionContext must be used within a ProductionProvider");
  }
  return context;
}


---

## الملف 3: client/src/pages/production-reports.tsx (ملف جديد)

```typescript
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
  wasteAnalysis: {
    totalReports: number;
    totalQuantity: number;
    totalValue: number;
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
    daily: Array<{ date: string; production: number; target: number }>;
    weekly: Array<{ week: string; production: number }>;
  };
}

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
            <Link href="/daily-production">
              <Button variant="outline" size="sm" className="h-8 text-xs" data-testid="link-daily-production">
                <Package className="h-3 w-3 ml-1" />
                الإنتاج اليومي
              </Button>
            </Link>
            <Link href="/advanced-production-orders">
              <Button variant="outline" size="sm" className="h-8 text-xs" data-testid="link-orders">
                <Target className="h-3 w-3 ml-1" />
                أوامر الإنتاج
              </Button>
            </Link>
            <Link href="/display-bar-waste">
              <Button variant="outline" size="sm" className="h-8 text-xs" data-testid="link-waste">
                <Trash2 className="h-3 w-3 ml-1" />
                الهدر
              </Button>
            </Link>
            <Link href="/quality-control">
              <Button variant="outline" size="sm" className="h-8 text-xs" data-testid="link-quality">
                <CheckCircle className="h-3 w-3 ml-1" />
                الجودة
              </Button>
            </Link>
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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
                  <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-200">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center">
                          <PieChart className="h-4 w-4 text-purple-600" />
                        </div>
                        <span className="text-xs text-gray-600">متوسط الدفعة</span>
                      </div>
                      <p className="text-2xl font-bold text-purple-700">{reportData?.dailySummary.avgBatchSize?.toFixed(0) || 0}</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm">التوزيع حسب الوجهة</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      {Object.entries(reportData?.dailySummary.byDestination || {}).length > 0 ? (
                        <div className="space-y-2">
                          {Object.entries(reportData?.dailySummary.byDestination || {}).map(([dest, qty]) => (
                            <div key={dest} className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">{dest}</span>
                              <Badge variant="outline">{qty}</Badge>
                            </div>
                          ))}
                        </div>
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
                        <div className="space-y-2">
                          {Object.entries(reportData?.dailySummary.byCategory || {}).map(([cat, qty]) => (
                            <div key={cat} className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">{cat}</span>
                              <Badge variant="outline">{qty}</Badge>
                            </div>
                          ))}
                        </div>
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                </div>
                <Card>
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm">التوزيع حسب السبب</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    {Object.entries(reportData?.wasteAnalysis.byReason || {}).length > 0 ? (
                      <div className="space-y-2">
                        {Object.entries(reportData?.wasteAnalysis.byReason || {}).map(([reason, qty]) => (
                          <div key={reason} className="flex justify-between items-center p-2 bg-red-50 rounded">
                            <span className="text-sm">{reason}</span>
                            <Badge variant="destructive">{qty}</Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 text-center py-4">لا توجد بيانات هدر</p>
                    )}
                  </CardContent>
                </Card>
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
```

---

## الملف 4: client/src/pages/daily-production.tsx (ملف جديد)

```typescript
import { useState, useEffect, useRef, useMemo } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Skeleton } from "@/components/ui/skeleton";
import { format, subDays } from "date-fns";
import { ar } from "date-fns/locale";
import { TablePagination, usePagination } from "@/components/ui/pagination";
import type { Branch, Product } from "@shared/schema";
import { useProductionContext } from "@/contexts/ProductionContext";
import { 
  Factory, Plus, Clock, Package, Trash2, RefreshCw, Calendar,
  Refrigerator, ShoppingCart, Snowflake, ChefHat, ArrowLeft,
  BarChart3, TrendingUp, FileSpreadsheet, User, Shield, FileText,
  Printer, AlertTriangle, Timer, Activity, PieChart, Search, Zap,
  Sun, Moon, Sunset, Edit2, X, Check, ArrowUpDown, TrendingDown
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link } from "wouter";
import * as XLSX from "xlsx";

interface DailyProductionBatch {
  id: number;
  branchId: string;
  productId: number | null;
  productName: string;
  productCategory: string | null;
  quantity: number;
  unit: string | null;
  destination: string;
  shiftId: number | null;
  productionOrderId: number | null;
  producedAt: string;
  recordedBy: string | null;
  recorderName: string | null;
  notes: string | null;
  createdAt: string;
}

interface DailyStats {
  totalBatches: number;
  totalQuantity: number;
  byDestination: Record<string, number>;
  byCategory: Record<string, number>;
  byHour: Record<string, number>;
}

const DESTINATIONS = [
  { value: "display_bar", label: "بار العرض", icon: ShoppingCart, color: "bg-green-100 text-green-800", bgClass: "from-green-500 to-emerald-600" },
  { value: "kitchen_trolley", label: "ترولي المطبخ", icon: ChefHat, color: "bg-amber-100 text-amber-800", bgClass: "from-amber-500 to-orange-600" },
  { value: "freezer", label: "الفريزر", icon: Snowflake, color: "bg-blue-100 text-blue-800", bgClass: "from-blue-500 to-indigo-600" },
  { value: "refrigerator", label: "الثلاجة", icon: Refrigerator, color: "bg-cyan-100 text-cyan-800", bgClass: "from-cyan-500 to-teal-600" },
];

const SHIFTS = [
  { value: "morning", label: "صباحي", icon: Sun, time: "6:00 - 14:00", color: "bg-amber-100 text-amber-800" },
  { value: "evening", label: "مسائي", icon: Sunset, time: "14:00 - 22:00", color: "bg-orange-100 text-orange-800" },
  { value: "night", label: "ليلي", icon: Moon, time: "22:00 - 6:00", color: "bg-indigo-100 text-indigo-800" },
];

const BAKERY_CATEGORIES = ["مخبوزات", "حلويات", "معجنات", "كيك", "خبز"];

const HOUR_LABELS: Record<string, string> = {
  "06": "6 صباحاً", "07": "7 صباحاً", "08": "8 صباحاً", "09": "9 صباحاً",
  "10": "10 صباحاً", "11": "11 صباحاً", "12": "12 ظهراً", "13": "1 مساءً",
  "14": "2 مساءً", "15": "3 مساءً", "16": "4 مساءً", "17": "5 مساءً",
  "18": "6 مساءً", "19": "7 مساءً", "20": "8 مساءً", "21": "9 مساءً",
  "22": "10 مساءً", "23": "11 مساءً", "00": "12 منتصف الليل",
};

const QUICK_QUANTITIES = [1, 2, 3, 5, 10, 12, 15, 20, 24, 30];

export default function DailyProductionPage() {
  // Use shared context for branch, date, and shift
  const { 
    selectedBranch: branchId, 
    setSelectedBranch: setBranchId, 
    selectedDate, 
    setSelectedDate,
    selectedShift,
    setSelectedShift 
  } = useProductionContext();
  
  const [productName, setProductName] = useState<string>("");
  const [productCategory, setProductCategory] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [destination, setDestination] = useState<string>("display_bar");
  const [notes, setNotes] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<string>("entry");
  const [productSearch, setProductSearch] = useState<string>("");
  const [batchSearch, setBatchSearch] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterDestination, setFilterDestination] = useState<string>("all");
  const [quickMode, setQuickMode] = useState<boolean>(false);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  const [editingBatch, setEditingBatch] = useState<DailyProductionBatch | null>(null);
  const [editQuantity, setEditQuantity] = useState<string>("");
  const [editDestination, setEditDestination] = useState<string>("");
  const [editNotes, setEditNotes] = useState<string>("");
  const printRef = useRef<HTMLDivElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const productInputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { itemsPerPage, getPageItems } = usePagination(15);
  const { user, isAdmin } = useAuth();
  const { canEdit, canDelete } = usePermissions();

  const canModifyRecords = isAdmin || canEdit("production");
  const canDeleteRecords = isAdmin || canDelete("production");

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  // Initialize branch from context or fallback to first branch
  useEffect(() => {
    if (branches && branches.length > 0 && (!branchId || branchId === "all")) {
      setBranchId(branches[0].id);
    }
  }, [branches, branchId, setBranchId]);

  const { data: batches, isLoading: batchesLoading, refetch: refetchBatches } = useQuery<DailyProductionBatch[]>({
    queryKey: ["/api/daily-production/batches", branchId, selectedDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (branchId) params.set("branchId", branchId);
      if (selectedDate) params.set("date", selectedDate);
      const res = await fetch(`/api/daily-production/batches?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch batches");
      return res.json();
    },
    enabled: !!branchId,
    refetchInterval: autoRefresh ? 60000 : false,
  });

  const { data: stats } = useQuery<DailyStats>({
    queryKey: ["/api/daily-production/stats", branchId, selectedDate],
    queryFn: async () => {
      const params = new URLSearchParams({ branchId, date: selectedDate });
      const res = await fetch(`/api/daily-production/stats?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    enabled: !!branchId && !!selectedDate,
    refetchInterval: autoRefresh ? 60000 : false,
  });

  // Previous day stats for comparison
  const previousDate = format(subDays(new Date(selectedDate), 1), "yyyy-MM-dd");
  const { data: prevStats } = useQuery<DailyStats>({
    queryKey: ["/api/daily-production/stats", branchId, previousDate],
    queryFn: async () => {
      const params = new URLSearchParams({ branchId, date: previousDate });
      const res = await fetch(`/api/daily-production/stats?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch prev stats");
      return res.json();
    },
    enabled: !!branchId && !!selectedDate,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/daily-production/batches", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/daily-production/batches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/daily-production/stats"] });
      if (!quickMode) {
        setProductName("");
        setProductCategory("");
        setQuantity("");
        setNotes("");
      } else {
        setQuantity("");
      }
      toast({ title: "تم تسجيل الدفعة بنجاح", description: `سجلها: ${user?.firstName || user?.username}` });
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/daily-production/batches/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/daily-production/batches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/daily-production/stats"] });
      setEditingBatch(null);
      toast({ title: "تم تحديث الدفعة بنجاح" });
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        // Allow Enter to submit form when in quantity field
        if (e.key === "Enter" && quantityInputRef.current === e.target) {
          return; // Let form handle submission
        }
        return;
      }
      
      // Alt+N: Focus on product name input (new entry)
      if (e.altKey && e.key === "n") {
        e.preventDefault();
        productInputRef.current?.focus();
        setActiveTab("entry");
      }
      
      // Alt+Q: Focus on quantity input
      if (e.altKey && e.key === "q") {
        e.preventDefault();
        quantityInputRef.current?.focus();
      }
      
      // Alt+R: Refresh data
      if (e.altKey && e.key === "r") {
        e.preventDefault();
        refetchBatches();
        toast({ title: "تم تحديث البيانات" });
      }
      
      // Alt+1-4: Quick destination select
      if (e.altKey && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        const destIndex = parseInt(e.key) - 1;
        if (DESTINATIONS[destIndex]) {
          setDestination(DESTINATIONS[destIndex].value);
          toast({ title: `الوجهة: ${DESTINATIONS[destIndex].label}` });
        }
      }
      
      // Escape: Clear entry form only (not batch filters)
      if (e.key === "Escape") {
        setProductName("");
        setQuantity("");
        setNotes("");
        setProductSearch("");
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [refetchBatches, toast]);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/daily-production/batches/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/daily-production/batches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/daily-production/stats"] });
      toast({ title: "تم حذف الدفعة" });
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId || !productName || !quantity || !destination) {
      toast({ title: "بيانات ناقصة", description: "يرجى ملء جميع الحقول المطلوبة", variant: "destructive" });
      return;
    }
    
    const numericQuantity = parseInt(quantity, 10);
    if (isNaN(numericQuantity) || numericQuantity <= 0) {
      toast({ title: "خطأ", description: "الكمية يجب أن تكون رقماً صحيحاً أكبر من صفر", variant: "destructive" });
      return;
    }
    
    const product = products?.find(p => p.name === productName);
    createMutation.mutate({
      branchId,
      productId: product?.id || null,
      productName,
      productCategory: productCategory || product?.category || null,
      quantity: numericQuantity,
      unit: product?.unit || "قطعة",
      destination,
      notes: notes || null,
    });
  };

  const handleQuickEntry = (product: Product, qty: number) => {
    createMutation.mutate({
      branchId,
      productId: product.id,
      productName: product.name,
      productCategory: product.category,
      quantity: qty,
      unit: product.unit || "قطعة",
      destination,
      notes: null,
    });
  };

  const handleEditSave = () => {
    if (!editingBatch) return;
    const qty = parseInt(editQuantity, 10);
    if (isNaN(qty) || qty <= 0) {
      toast({ title: "خطأ", description: "الكمية غير صحيحة", variant: "destructive" });
      return;
    }
    updateMutation.mutate({
      id: editingBatch.id,
      data: {
        quantity: qty,
        destination: editDestination,
        notes: editNotes || null,
      },
    });
  };

  const openEditDialog = (batch: DailyProductionBatch) => {
    setEditingBatch(batch);
    setEditQuantity(batch.quantity.toString());
    setEditDestination(batch.destination);
    setEditNotes(batch.notes || "");
  };

  const getDestinationInfo = (dest: string) => {
    return DESTINATIONS.find(d => d.value === dest) || { label: dest, color: "bg-gray-100 text-gray-800", icon: Package, bgClass: "from-gray-500 to-slate-600" };
  };

  const formatTime = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "HH:mm", { locale: ar });
    } catch {
      return "";
    }
  };

  const formatFullDateTime = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "yyyy/MM/dd HH:mm:ss", { locale: ar });
    } catch {
      return dateStr;
    }
  };

  const getBranchName = (id: string) => branches?.find(b => b.id === id)?.name || id;

  const batchesByHour = (batches || []).reduce((acc, batch) => {
    const hour = format(new Date(batch.producedAt), "HH");
    if (!acc[hour]) acc[hour] = [];
    acc[hour].push(batch);
    return acc;
  }, {} as Record<string, DailyProductionBatch[]>);

  const batchesByCategory = (batches || []).reduce((acc, batch) => {
    const cat = batch.productCategory || "غير مصنف";
    if (!acc[cat]) acc[cat] = { batches: [], totalQty: 0 };
    acc[cat].batches.push(batch);
    acc[cat].totalQty += batch.quantity;
    return acc;
  }, {} as Record<string, { batches: DailyProductionBatch[], totalQty: number }>);

  const batchesByDestination = (batches || []).reduce((acc, batch) => {
    if (!acc[batch.destination]) acc[batch.destination] = { batches: [], totalQty: 0 };
    acc[batch.destination].batches.push(batch);
    acc[batch.destination].totalQty += batch.quantity;
    return acc;
  }, {} as Record<string, { batches: DailyProductionBatch[], totalQty: number }>);

  const batchesByRecorder = (batches || []).reduce((acc, batch) => {
    const recorder = batch.recorderName || "غير معروف";
    if (!acc[recorder]) acc[recorder] = { batches: [], totalQty: 0 };
    acc[recorder].batches.push(batch);
    acc[recorder].totalQty += batch.quantity;
    return acc;
  }, {} as Record<string, { batches: DailyProductionBatch[], totalQty: number }>);

  // Filter products by search
  const bakeryProducts = useMemo(() => {
    const filtered = products?.filter(p => p.category && BAKERY_CATEGORIES.includes(p.category)) || [];
    if (!productSearch) return filtered;
    const search = productSearch.toLowerCase();
    return filtered.filter(p => 
      p.name.toLowerCase().includes(search) ||
      (p.category ?? "").toLowerCase().includes(search)
    );
  }, [products, productSearch]);

  // Filter batches by search, category, and destination
  const filteredBatches = useMemo(() => {
    if (!batches) return [];
    let result = [...batches];
    
    // Filter by search term
    if (batchSearch) {
      const search = batchSearch.toLowerCase();
      result = result.filter(b =>
        b.productName.toLowerCase().includes(search) ||
        (b.productCategory ?? "").toLowerCase().includes(search) ||
        (b.notes ?? "").toLowerCase().includes(search) ||
        (b.recorderName ?? "").toLowerCase().includes(search)
      );
    }
    
    // Filter by category
    if (filterCategory !== "all") {
      result = result.filter(b => b.productCategory === filterCategory);
    }
    
    // Filter by destination
    if (filterDestination !== "all") {
      result = result.filter(b => b.destination === filterDestination);
    }
    
    return result;
  }, [batches, batchSearch, filterCategory, filterDestination]);

  const paginatedBatches = getPageItems(filteredBatches, currentPage);

  // Reset to page 1 when filtered results change
  useEffect(() => {
    const totalPages = Math.ceil(filteredBatches.length / itemsPerPage);
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [filteredBatches.length, currentPage, itemsPerPage]);

  // Popular products (most used today)
  const popularProducts = useMemo(() => {
    if (!batches || !products) return [];
    const productCounts: Record<string, number> = {};
    batches.forEach(b => {
      productCounts[b.productName] = (productCounts[b.productName] || 0) + 1;
    });
    return products
      .filter(p => p.category && BAKERY_CATEGORIES.includes(p.category))
      .sort((a, b) => (productCounts[b.name] || 0) - (productCounts[a.name] || 0))
      .slice(0, 8);
  }, [batches, products]);

  const getDiff = (current: number, previous: number) => {
    if (!previous) return { value: current, direction: "up" };
    const diff = current - previous;
    return { value: Math.abs(diff), direction: diff >= 0 ? "up" : "down" };
  };

  const exportToExcel = () => {
    if (!batches || batches.length === 0) return;
    
    const data = batches.map(b => ({
      "الوقت": formatFullDateTime(b.producedAt),
      "المنتج": b.productName,
      "الفئة": b.productCategory || "-",
      "الكمية": b.quantity,
      "الوحدة": b.unit || "قطعة",
      "الوجهة": getDestinationInfo(b.destination).label,
      "المسجل": b.recorderName || "-",
      "ملاحظات": b.notes || "-",
    }));

    const summaryData = [
      { "البيان": "الفرع", "القيمة": getBranchName(branchId) },
      { "البيان": "التاريخ", "القيمة": selectedDate },
      { "البيان": "إجمالي الدفعات", "القيمة": stats?.totalBatches || 0 },
      { "البيان": "إجمالي الكميات", "القيمة": stats?.totalQuantity || 0 },
      { "البيان": "", "القيمة": "" },
      { "البيان": "توزيع حسب الوجهة", "القيمة": "" },
      ...DESTINATIONS.map(d => ({
        "البيان": `  ${d.label}`,
        "القيمة": stats?.byDestination?.[d.value] || 0
      })),
    ];
    
    const wb = XLSX.utils.book_new();
    const wsData = XLSX.utils.json_to_sheet(data);
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "ملخص اليوم");
    XLSX.utils.book_append_sheet(wb, wsData, "تفاصيل الإنتاج");
    XLSX.writeFile(wb, `يومية-الإنتاج-${selectedDate}-${getBranchName(branchId)}.xlsx`);
    toast({ title: "تم تصدير التقرير" });
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <title>يومية الإنتاج - ${selectedDate}</title>
        <style>
          * { font-family: 'Cairo', 'Segoe UI', sans-serif; }
          body { padding: 20px; direction: rtl; }
          h1 { text-align: center; color: #b45309; margin-bottom: 5px; }
          h2 { text-align: center; color: #666; margin-top: 0; font-weight: normal; }
          .header-info { display: flex; justify-content: space-between; margin-bottom: 20px; padding: 10px; background: #fef3c7; border-radius: 8px; }
          .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
          .stat-card { padding: 15px; background: #f8f9fa; border-radius: 8px; text-align: center; }
          .stat-value { font-size: 24px; font-weight: bold; color: #b45309; }
          .stat-label { font-size: 12px; color: #666; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
          th { background: #b45309; color: white; }
          tr:nth-child(even) { background: #f8f9fa; }
          .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; border-top: 1px solid #ddd; padding-top: 15px; }
          .section-title { background: #fef3c7; padding: 8px 15px; margin: 20px 0 10px; border-radius: 5px; font-weight: bold; }
          .recorder-badge { display: inline-block; background: #e0e7ff; color: #3730a3; padding: 2px 8px; border-radius: 12px; font-size: 11px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <h1>يومية الإنتاج الفعلي</h1>
        <h2>${getBranchName(branchId)} - ${format(new Date(selectedDate), "EEEE dd MMMM yyyy", { locale: ar })}</h2>
        
        <div class="header-info">
          <span>وقت الطباعة: ${format(new Date(), "HH:mm:ss yyyy/MM/dd", { locale: ar })}</span>
          <span>المستخدم: ${user?.firstName || user?.username || "-"}</span>
        </div>
        
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${stats?.totalBatches || 0}</div>
            <div class="stat-label">إجمالي الدفعات</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats?.totalQuantity || 0}</div>
            <div class="stat-label">إجمالي الكميات</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats?.byDestination?.display_bar || 0}</div>
            <div class="stat-label">بار العرض</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${(stats?.byDestination?.freezer || 0) + (stats?.byDestination?.refrigerator || 0)}</div>
            <div class="stat-label">التخزين</div>
          </div>
        </div>
        
        <div class="section-title">تفاصيل الإنتاج</div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>الوقت</th>
              <th>المنتج</th>
              <th>الفئة</th>
              <th>الكمية</th>
              <th>الوجهة</th>
              <th>المسجل</th>
              <th>ملاحظات</th>
            </tr>
          </thead>
          <tbody>
            ${(batches || []).map((b, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${formatTime(b.producedAt)}</td>
                <td>${b.productName}</td>
                <td>${b.productCategory || "-"}</td>
                <td style="text-align: center; font-weight: bold;">${b.quantity}</td>
                <td>${getDestinationInfo(b.destination).label}</td>
                <td><span class="recorder-badge">${b.recorderName || "-"}</span></td>
                <td>${b.notes || "-"}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="section-title">ملخص حسب المسجلين</div>
        <table>
          <thead>
            <tr><th>المسجل</th><th>عدد الدفعات</th><th>إجمالي الكمية</th></tr>
          </thead>
          <tbody>
            ${Object.entries(batchesByRecorder).map(([name, data]) => `
              <tr>
                <td>${name}</td>
                <td style="text-align: center;">${data.batches.length}</td>
                <td style="text-align: center; font-weight: bold;">${data.totalQty}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="footer">
          <p>نظام باتر لإدارة المخابز - يومية الإنتاج الفعلي</p>
          <p>تم إنشاء هذا التقرير تلقائياً</p>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const qtyDiff = getDiff(stats?.totalQuantity || 0, prevStats?.totalQuantity || 0);
  const batchDiff = getDiff(stats?.totalBatches || 0, prevStats?.totalBatches || 0);

  return (
    <Layout>
      <div className="space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/production-dashboard">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl">
              <Factory className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">الإنتاج الفعلي اليومي</h1>
              <p className="text-muted-foreground">تسجيل ومتابعة دفعات الإنتاج على مدار اليوم</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user && (
              <Badge variant="outline" className="gap-1 px-3 py-1.5">
                <User className="h-3 w-3" />
                {user.firstName || user.username}
                {isAdmin && <Shield className="h-3 w-3 text-amber-600 mr-1" />}
              </Badge>
            )}
          </div>
        </div>

        {/* Filters and Controls */}
        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-2 min-w-[200px]">
            <Label>الفرع *</Label>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger data-testid="select-branch">
                <SelectValue placeholder="اختر الفرع" />
              </SelectTrigger>
              <SelectContent>
                {branches?.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>التاريخ</Label>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-[160px]"
              data-testid="input-date"
            />
          </div>
          <div className="space-y-2">
            <Label>الوردية</Label>
            <Select value={selectedShift} onValueChange={setSelectedShift}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="الوردية" />
              </SelectTrigger>
              <SelectContent>
                {SHIFTS.map((shift) => {
                  const Icon = shift.icon;
                  return (
                    <SelectItem key={shift.value} value={shift.value}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {shift.label}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 bg-muted/50 px-3 py-2 rounded-lg">
            <Switch
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
              id="auto-refresh"
            />
            <Label htmlFor="auto-refresh" className="text-sm cursor-pointer">
              تحديث تلقائي
            </Label>
            {autoRefresh && (
              <Badge variant="secondary" className="text-xs">كل دقيقة</Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetchBatches()} data-testid="btn-refresh">
              <RefreshCw className="h-4 w-4 ml-2" />
              تحديث
            </Button>
            <Button variant="outline" size="sm" onClick={exportToExcel} disabled={!batches?.length} data-testid="btn-export">
              <FileSpreadsheet className="h-4 w-4 ml-2" />
              Excel
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} disabled={!batches?.length} data-testid="btn-print">
              <Printer className="h-4 w-4 ml-2" />
              طباعة
            </Button>
          </div>
        </div>

        {/* Stats Cards with Comparison */}
        {branchId && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-r-4 border-r-amber-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">إجمالي الدفعات</p>
                    <div className="flex items-center gap-2">
                      <p className="text-2xl font-bold text-amber-700">{stats?.totalBatches || 0}</p>
                      {prevStats && (
                        <Badge variant={batchDiff.direction === "up" ? "default" : "destructive"} className="text-xs gap-1">
                          {batchDiff.direction === "up" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {batchDiff.value}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Package className="h-8 w-8 text-amber-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-r-4 border-r-green-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">إجمالي الكميات</p>
                    <div className="flex items-center gap-2">
                      <p className="text-2xl font-bold text-green-700">{stats?.totalQuantity || 0}</p>
                      {prevStats && (
                        <Badge variant={qtyDiff.direction === "up" ? "default" : "destructive"} className="text-xs gap-1">
                          {qtyDiff.direction === "up" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {qtyDiff.value}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-r-4 border-r-blue-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">بار العرض</p>
                    <p className="text-2xl font-bold text-blue-700">{stats?.byDestination?.display_bar || 0}</p>
                  </div>
                  <ShoppingCart className="h-8 w-8 text-blue-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-r-4 border-r-cyan-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">التخزين</p>
                    <p className="text-2xl font-bold text-cyan-700">
                      {(stats?.byDestination?.freezer || 0) + (stats?.byDestination?.refrigerator || 0)}
                    </p>
                  </div>
                  <Snowflake className="h-8 w-8 text-cyan-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="entry" className="gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">تسجيل</span>
            </TabsTrigger>
            <TabsTrigger value="timeline" className="gap-2">
              <Timer className="h-4 w-4" />
              <span className="hidden sm:inline">الجدول الزمني</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">التقارير</span>
            </TabsTrigger>
            <TabsTrigger value="journal" className="gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">اليومية</span>
            </TabsTrigger>
          </TabsList>

          {/* Entry Tab */}
          <TabsContent value="entry" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Entry Form */}
              <Card className="lg:col-span-1">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Plus className="w-5 h-5 text-green-600" />
                      تسجيل دفعة جديدة
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={quickMode}
                        onCheckedChange={setQuickMode}
                        id="quick-mode"
                      />
                      <Label htmlFor="quick-mode" className="text-xs cursor-pointer flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        سريع
                      </Label>
                    </div>
                  </div>
                  <CardDescription>سجل الإنتاج فور خروجه من المطبخ</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label>المنتج *</Label>
                      <div className="relative">
                        <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="ابحث عن منتج..."
                          value={productSearch}
                          onChange={(e) => setProductSearch(e.target.value)}
                          className="pr-10"
                        />
                      </div>
                      <Select value={productName} onValueChange={(val) => {
                        setProductName(val);
                        const prod = products?.find(p => p.name === val);
                        if (prod?.category) setProductCategory(prod.category);
                      }}>
                        <SelectTrigger data-testid="select-product">
                          <SelectValue placeholder="اختر المنتج" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px] overflow-y-auto">
                          {bakeryProducts.map((product) => (
                            <SelectItem key={product.id} value={product.name}>
                              {product.name} ({product.category})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="أو اكتب اسم المنتج"
                        value={productName}
                        onChange={(e) => setProductName(e.target.value)}
                        data-testid="input-product-name"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>الفئة</Label>
                      <Select value={productCategory} onValueChange={setProductCategory}>
                        <SelectTrigger data-testid="select-category">
                          <SelectValue placeholder="اختر الفئة" />
                        </SelectTrigger>
                        <SelectContent>
                          {BAKERY_CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>الكمية *</Label>
                      <Input
                        type="number"
                        min="1"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder="أدخل الكمية"
                        ref={quantityInputRef}
                        data-testid="input-quantity"
                      />
                      <div className="flex flex-wrap gap-1">
                        {QUICK_QUANTITIES.map((q) => (
                          <Button
                            key={q}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => setQuantity(q.toString())}
                          >
                            {q}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>الوجهة *</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {DESTINATIONS.map((dest) => {
                          const Icon = dest.icon;
                          return (
                            <Button
                              key={dest.value}
                              type="button"
                              variant={destination === dest.value ? "default" : "outline"}
                              className="h-auto py-3 flex flex-col gap-1"
                              onClick={() => setDestination(dest.value)}
                              data-testid={`btn-dest-${dest.value}`}
                            >
                              <Icon className="h-5 w-5" />
                              <span className="text-xs">{dest.label}</span>
                            </Button>
                          );
                        })}
                      </div>
                    </div>

                    {!quickMode && (
                      <div className="space-y-2">
                        <Label>ملاحظات</Label>
                        <Textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="ملاحظات إضافية (اختياري)"
                          rows={2}
                          data-testid="input-notes"
                        />
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
                      disabled={createMutation.isPending || !branchId}
                      data-testid="btn-submit"
                    >
                      {createMutation.isPending ? "جاري التسجيل..." : "تسجيل الدفعة"}
                    </Button>
                  </form>

                  {/* Quick Entry Buttons */}
                  {quickMode && popularProducts.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <Label className="text-sm text-muted-foreground mb-2 block">تسجيل سريع:</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {popularProducts.slice(0, 6).map((product) => (
                          <Button
                            key={product.id}
                            variant="outline"
                            size="sm"
                            className="h-auto py-2 text-xs text-right justify-start"
                            onClick={() => handleQuickEntry(product, parseInt(quantity) || 1)}
                            disabled={createMutation.isPending || !branchId}
                          >
                            <span className="truncate">{product.name}</span>
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Batches Table */}
              <Card className="lg:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Clock className="w-5 h-5 text-blue-600" />
                    سجل الإنتاج اليوم
                  </CardTitle>
                  <CardDescription>
                    {batches?.length || 0} دفعة مسجلة في {selectedDate}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Filter Bar */}
                  {batches && batches.length > 0 && (
                    <div className="flex flex-wrap gap-3 mb-4 p-3 bg-muted/30 rounded-lg">
                      <div className="flex-1 min-w-[180px]">
                        <Input
                          placeholder="بحث في الدفعات..."
                          value={batchSearch}
                          onChange={(e) => { setBatchSearch(e.target.value); setCurrentPage(1); }}
                          className="h-9"
                          data-testid="input-batch-search"
                        />
                      </div>
                      <Select value={filterCategory} onValueChange={(v) => { setFilterCategory(v); setCurrentPage(1); }}>
                        <SelectTrigger className="w-[140px] h-9" data-testid="select-filter-category">
                          <SelectValue placeholder="الفئة" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">كل الفئات</SelectItem>
                          {BAKERY_CATEGORIES.map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={filterDestination} onValueChange={(v) => { setFilterDestination(v); setCurrentPage(1); }}>
                        <SelectTrigger className="w-[140px] h-9" data-testid="select-filter-destination">
                          <SelectValue placeholder="الوجهة" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">كل الوجهات</SelectItem>
                          {DESTINATIONS.map(d => (
                            <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {(batchSearch || filterCategory !== "all" || filterDestination !== "all") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9"
                          onClick={() => {
                            setBatchSearch("");
                            setFilterCategory("all");
                            setFilterDestination("all");
                            setCurrentPage(1);
                          }}
                          data-testid="btn-clear-filters"
                        >
                          <X className="h-4 w-4 ml-1" />
                          مسح
                        </Button>
                      )}
                      <Badge variant="secondary" className="h-9 px-3 flex items-center">
                        {filteredBatches.length} نتيجة
                      </Badge>
                    </div>
                  )}
                  
                  {!branchId ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Factory className="w-12 h-12 mx-auto mb-4 opacity-20" />
                      <p>اختر الفرع لعرض سجل الإنتاج</p>
                    </div>
                  ) : batchesLoading ? (
                    <div className="space-y-3">
                      {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                    </div>
                  ) : !batches?.length ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Package className="w-12 h-12 mx-auto mb-4 opacity-20" />
                      <p>لا توجد دفعات مسجلة لهذا اليوم</p>
                      <p className="text-sm">ابدأ بتسجيل الإنتاج من النموذج</p>
                    </div>
                  ) : filteredBatches.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Search className="w-12 h-12 mx-auto mb-4 opacity-20" />
                      <p>لا توجد نتائج مطابقة للفلترة</p>
                      <p className="text-sm">حاول تغيير معايير البحث</p>
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead className="text-right">الوقت</TableHead>
                              <TableHead className="text-right">المنتج</TableHead>
                              <TableHead className="text-right">الفئة</TableHead>
                              <TableHead className="text-center">الكمية</TableHead>
                              <TableHead className="text-right">الوجهة</TableHead>
                              <TableHead className="text-right">المسجل</TableHead>
                              <TableHead className="text-left">إجراء</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {paginatedBatches.map((batch) => {
                              const destInfo = getDestinationInfo(batch.destination);
                              const DestIcon = destInfo.icon;
                              return (
                                <TableRow key={batch.id} className="hover:bg-muted/30" data-testid={`row-batch-${batch.id}`}>
                                  <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                      <Clock className="h-3 w-3 text-muted-foreground" />
                                      {formatTime(batch.producedAt)}
                                    </div>
                                  </TableCell>
                                  <TableCell className="font-medium">{batch.productName}</TableCell>
                                  <TableCell>
                                    {batch.productCategory && (
                                      <Badge variant="outline" className="text-xs">{batch.productCategory}</Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-center font-bold">{batch.quantity}</TableCell>
                                  <TableCell>
                                    <Badge className={destInfo.color}>
                                      <DestIcon className="h-3 w-3 ml-1" />
                                      {destInfo.label}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="secondary" className="gap-1 text-xs">
                                      <User className="h-3 w-3" />
                                      {batch.recorderName || "-"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1">
                                      {canModifyRecords && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7 text-blue-500 hover:text-blue-700"
                                          onClick={() => openEditDialog(batch)}
                                        >
                                          <Edit2 className="h-4 w-4" />
                                        </Button>
                                      )}
                                      {canDeleteRecords ? (
                                        <AlertDialog>
                                          <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700">
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </AlertDialogTrigger>
                                          <AlertDialogContent>
                                            <AlertDialogHeader>
                                              <AlertDialogTitle>حذف الدفعة</AlertDialogTitle>
                                              <AlertDialogDescription>
                                                هل أنت متأكد من حذف دفعة "{batch.productName}"؟
                                                <br />
                                                <span className="text-xs text-muted-foreground">
                                                  سجلها: {batch.recorderName || "-"} في {formatTime(batch.producedAt)}
                                                </span>
                                              </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                              <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                              <AlertDialogAction
                                                className="bg-red-600 hover:bg-red-700"
                                                onClick={() => deleteMutation.mutate(batch.id)}
                                              >
                                                حذف
                                              </AlertDialogAction>
                                            </AlertDialogFooter>
                                          </AlertDialogContent>
                                        </AlertDialog>
                                      ) : (
                                        <Badge variant="outline" className="text-xs text-muted-foreground gap-1">
                                          <Shield className="h-3 w-3" />
                                          مقفل
                                        </Badge>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                      {batches.length > itemsPerPage && (
                        <TablePagination
                          currentPage={currentPage}
                          totalItems={batches.length}
                          itemsPerPage={itemsPerPage}
                          onPageChange={setCurrentPage}
                        />
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Timeline Tab */}
          <TabsContent value="timeline" className="mt-6">
            {!branchId ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Timer className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>اختر الفرع لعرض الجدول الزمني</p>
                </CardContent>
              </Card>
            ) : !batches?.length ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>لا توجد دفعات مسجلة لهذا اليوم</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Timer className="w-5 h-5 text-indigo-600" />
                      الجدول الزمني للإنتاج
                    </CardTitle>
                    <CardDescription>
                      عرض الإنتاج على مدار الساعات
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {Object.entries(batchesByHour)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([hour, hourBatches]) => (
                          <div key={hour} className="border-r-4 border-indigo-500 pr-4">
                            <div className="flex items-center gap-3 mb-2">
                              <Badge className="bg-indigo-100 text-indigo-800 text-sm px-3 py-1">
                                <Clock className="h-3 w-3 ml-1" />
                                {HOUR_LABELS[hour] || `${hour}:00`}
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                {hourBatches.length} دفعة - {hourBatches.reduce((s, b) => s + b.quantity, 0)} قطعة
                              </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                              {hourBatches.map((batch) => {
                                const destInfo = getDestinationInfo(batch.destination);
                                const DestIcon = destInfo.icon;
                                return (
                                  <div
                                    key={batch.id}
                                    className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg"
                                  >
                                    <div className={`p-2 rounded-lg bg-gradient-to-br ${destInfo.bgClass}`}>
                                      <DestIcon className="h-4 w-4 text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-sm truncate">{batch.productName}</p>
                                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <span>{formatTime(batch.producedAt)}</span>
                                        <span>•</span>
                                        <span className="font-bold text-foreground">{batch.quantity}</span>
                                        <span>•</span>
                                        <span className="flex items-center gap-1">
                                          <User className="h-3 w-3" />
                                          {batch.recorderName || "-"}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="mt-6">
            {!branchId ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>اختر الفرع لعرض التقارير</p>
                </CardContent>
              </Card>
            ) : !batches?.length ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>لا توجد بيانات لإنشاء التقارير</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Activity className="w-5 h-5 text-green-600" />
                      توزيع حسب الوجهة
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {DESTINATIONS.map((dest) => {
                        const data = batchesByDestination[dest.value];
                        const percentage = stats?.totalQuantity 
                          ? Math.round((data?.totalQty || 0) / stats.totalQuantity * 100) 
                          : 0;
                        const Icon = dest.icon;
                        return (
                          <div key={dest.value} className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg bg-gradient-to-br ${dest.bgClass}`}>
                              <Icon className="h-4 w-4 text-white" />
                            </div>
                            <div className="flex-1">
                              <div className="flex justify-between items-center mb-1">
                                <span className="font-medium text-sm">{dest.label}</span>
                                <span className="text-sm text-muted-foreground">
                                  {data?.totalQty || 0} قطعة ({percentage}%)
                                </span>
                              </div>
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className={`h-full bg-gradient-to-r ${dest.bgClass}`}
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <PieChart className="w-5 h-5 text-purple-600" />
                      توزيع حسب الفئة
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(batchesByCategory)
                        .sort(([, a], [, b]) => b.totalQty - a.totalQty)
                        .map(([category, data]) => {
                          const percentage = stats?.totalQuantity 
                            ? Math.round(data.totalQty / stats.totalQuantity * 100) 
                            : 0;
                          return (
                            <div key={category} className="flex items-center gap-3">
                              <Badge variant="outline" className="min-w-[80px] justify-center">
                                {category}
                              </Badge>
                              <div className="flex-1">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-sm text-muted-foreground">
                                    {data.batches.length} دفعة
                                  </span>
                                  <span className="font-medium">
                                    {data.totalQty} قطعة ({percentage}%)
                                  </span>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-gradient-to-r from-purple-500 to-pink-600"
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <User className="w-5 h-5 text-blue-600" />
                      الإنتاج حسب المسجل
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(batchesByRecorder)
                        .sort(([, a], [, b]) => b.totalQty - a.totalQty)
                        .map(([recorder, data]) => {
                          const percentage = stats?.totalQuantity 
                            ? Math.round(data.totalQty / stats.totalQuantity * 100) 
                            : 0;
                          return (
                            <div key={recorder} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                              <div className="p-2 bg-blue-100 rounded-full">
                                <User className="h-4 w-4 text-blue-600" />
                              </div>
                              <div className="flex-1">
                                <div className="flex justify-between items-center">
                                  <span className="font-medium">{recorder}</span>
                                  <Badge variant="secondary">{data.totalQty} قطعة</Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {data.batches.length} دفعة • {percentage}% من الإجمالي
                                </p>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Clock className="w-5 h-5 text-indigo-600" />
                      توزيع الإنتاج على الساعات
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(stats?.byHour || {})
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([hour, qty]) => (
                          <div key={hour} className="text-center p-3 bg-indigo-50 rounded-lg min-w-[70px]">
                            <p className="text-lg font-bold text-indigo-700">{qty}</p>
                            <p className="text-xs text-indigo-600">{HOUR_LABELS[hour] || `${hour}:00`}</p>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Daily Journal Tab */}
          <TabsContent value="journal" className="mt-6">
            {!branchId ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>اختر الفرع لعرض يومية الإنتاج</p>
                </CardContent>
              </Card>
            ) : !batches?.length ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>لا توجد بيانات لإنشاء اليومية</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6" ref={printRef}>
                <Card className="border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
                  <CardContent className="p-6">
                    <div className="text-center mb-4">
                      <h2 className="text-2xl font-bold text-amber-800">يومية الإنتاج الفعلي</h2>
                      <p className="text-amber-700">
                        {getBranchName(branchId)} - {format(new Date(selectedDate), "EEEE dd MMMM yyyy", { locale: ar })}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-3 bg-white/80 rounded-lg">
                        <p className="text-3xl font-bold text-amber-700">{stats?.totalBatches || 0}</p>
                        <p className="text-sm text-amber-600">إجمالي الدفعات</p>
                      </div>
                      <div className="text-center p-3 bg-white/80 rounded-lg">
                        <p className="text-3xl font-bold text-green-700">{stats?.totalQuantity || 0}</p>
                        <p className="text-sm text-green-600">إجمالي القطع</p>
                      </div>
                      <div className="text-center p-3 bg-white/80 rounded-lg">
                        <p className="text-3xl font-bold text-blue-700">{Object.keys(batchesByRecorder).length}</p>
                        <p className="text-sm text-blue-600">عدد المسجلين</p>
                      </div>
                      <div className="text-center p-3 bg-white/80 rounded-lg">
                        <p className="text-3xl font-bold text-purple-700">{Object.keys(batchesByHour).length}</p>
                        <p className="text-sm text-purple-600">ساعات العمل</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-amber-600" />
                        تفاصيل الإنتاج
                      </span>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={exportToExcel}>
                          <FileSpreadsheet className="h-4 w-4 ml-2" />
                          تصدير Excel
                        </Button>
                        <Button variant="outline" size="sm" onClick={handlePrint}>
                          <Printer className="h-4 w-4 ml-2" />
                          طباعة
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-amber-50">
                            <TableHead className="text-right font-bold">#</TableHead>
                            <TableHead className="text-right font-bold">الوقت</TableHead>
                            <TableHead className="text-right font-bold">المنتج</TableHead>
                            <TableHead className="text-right font-bold">الفئة</TableHead>
                            <TableHead className="text-center font-bold">الكمية</TableHead>
                            <TableHead className="text-right font-bold">الوجهة</TableHead>
                            <TableHead className="text-right font-bold">المسجل</TableHead>
                            <TableHead className="text-right font-bold">ملاحظات</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {batches.map((batch, index) => {
                            const destInfo = getDestinationInfo(batch.destination);
                            const DestIcon = destInfo.icon;
                            return (
                              <TableRow key={batch.id} className={index % 2 === 0 ? "bg-muted/20" : ""}>
                                <TableCell className="font-medium">{index + 1}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3 text-muted-foreground" />
                                    {formatTime(batch.producedAt)}
                                  </div>
                                </TableCell>
                                <TableCell className="font-medium">{batch.productName}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">
                                    {batch.productCategory || "-"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center font-bold text-lg">{batch.quantity}</TableCell>
                                <TableCell>
                                  <Badge className={destInfo.color}>
                                    <DestIcon className="h-3 w-3 ml-1" />
                                    {destInfo.label}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="secondary" className="gap-1">
                                    <User className="h-3 w-3" />
                                    {batch.recorderName || "-"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                                  {batch.notes || "-"}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="w-5 h-5 text-blue-600" />
                      ملخص حسب المسجلين
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-blue-50">
                          <TableHead className="text-right font-bold">المسجل</TableHead>
                          <TableHead className="text-center font-bold">عدد الدفعات</TableHead>
                          <TableHead className="text-center font-bold">إجمالي الكمية</TableHead>
                          <TableHead className="text-center font-bold">النسبة</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(batchesByRecorder)
                          .sort(([, a], [, b]) => b.totalQty - a.totalQty)
                          .map(([recorder, data]) => {
                            const percentage = stats?.totalQuantity 
                              ? Math.round(data.totalQty / stats.totalQuantity * 100) 
                              : 0;
                            return (
                              <TableRow key={recorder}>
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-2">
                                    <User className="h-4 w-4 text-blue-600" />
                                    {recorder}
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">{data.batches.length}</TableCell>
                                <TableCell className="text-center font-bold">{data.totalQty}</TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="outline">{percentage}%</Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {!canModifyRecords && (
                  <Card className="border-amber-200 bg-amber-50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                        <div>
                          <p className="font-medium text-amber-800">ملاحظة هامة</p>
                          <p className="text-sm text-amber-700">
                            لا يمكنك تعديل أو حذف السجلات بعد إدخالها. يرجى التواصل مع المشرف أو المدير للتعديلات.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingBatch} onOpenChange={() => setEditingBatch(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعديل الدفعة</DialogTitle>
            <DialogDescription>
              تعديل بيانات دفعة: {editingBatch?.productName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>الكمية</Label>
              <Input
                type="number"
                min="1"
                value={editQuantity}
                onChange={(e) => setEditQuantity(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>الوجهة</Label>
              <Select value={editDestination} onValueChange={setEditDestination}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DESTINATIONS.map((dest) => (
                    <SelectItem key={dest.value} value={dest.value}>{dest.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingBatch(null)}>
              <X className="h-4 w-4 ml-2" />
              إلغاء
            </Button>
            <Button onClick={handleEditSave} disabled={updateMutation.isPending}>
              <Check className="h-4 w-4 ml-2" />
              {updateMutation.isPending ? "جاري الحفظ..." : "حفظ التعديلات"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
```
