import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, TrendingUp, TrendingDown, DollarSign, Percent, Award, AlertTriangle, Building, Plus, Calculator, BarChart3, PieChart, RefreshCw, FileText, ArrowUp, ArrowDown, Minus, Target, Wallet, Receipt, ShoppingCart, Users, Home, Lightbulb, Package, Trash2, ChevronDown, ChevronUp, ChevronLeft, Download, Upload, FileSpreadsheet, History, Printer } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart as RePieChart, Pie, Cell, LineChart, Line, AreaChart, Area, ComposedChart } from "recharts";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { downloadArabicPdf, getArabicDefaultStyle, getArabicTableHeaderStyle } from "@/lib/pdfmake-arabic";

const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

const SALES_CHANNELS = [
  { id: "cash", label: "نقدي", icon: Wallet },
  { id: "card", label: "بطاقة", icon: Receipt },
  { id: "delivery_apps", label: "تطبيقات التوصيل", icon: ShoppingCart },
  { id: "corporate", label: "عملاء شركات", icon: Building },
];

const COGS_CATEGORIES = [
  { id: "raw_materials", label: "مواد خام" },
  { id: "production", label: "تكاليف إنتاج" },
  { id: "packaging", label: "تغليف" },
  { id: "waste", label: "هدر" },
];

const OPERATING_EXPENSE_TYPES = [
  { id: "salaries", label: "رواتب وأجور" },
  { id: "utilities", label: "مرافق (كهرباء، ماء)" },
  { id: "maintenance", label: "صيانة" },
  { id: "marketing", label: "تسويق" },
  { id: "supplies", label: "مستلزمات" },
  { id: "other", label: "أخرى" },
];

const FIXED_COST_TYPES = [
  { id: "rent", label: "إيجار" },
  { id: "licenses", label: "رخص وتصاريح" },
  { id: "insurance", label: "تأمين" },
  { id: "taxes", label: "ضرائب" },
  { id: "depreciation", label: "إهلاك" },
];

const RATING_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  excellent: { bg: "bg-green-100", text: "text-green-800", label: "ممتاز" },
  good: { bg: "bg-blue-100", text: "text-blue-800", label: "جيد" },
  average: { bg: "bg-yellow-100", text: "text-yellow-800", label: "متوسط" },
  poor: { bg: "bg-red-100", text: "text-red-800", label: "ضعيف" },
};

const CHART_COLORS = ["#4F46E5", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value) + " ريال";
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number): string {
  return formatNumber(value) + "%";
}

function generatePnLPdfReport(
  branchName: string,
  period: string,
  metrics: any,
  sales: any[],
  cogs: any[],
  opex: any[],
  fixedCosts: any[]
) {
  const getRatingLabel = (rating: string) => {
    const labels: Record<string, string> = {
      excellent: "ممتاز",
      good: "جيد",
      average: "متوسط",
      poor: "ضعيف",
    };
    return labels[rating] || rating;
  };

  const docDefinition = {
    pageSize: "A4",
    pageOrientation: "portrait",
    pageMargins: [40, 60, 40, 60],
    defaultStyle: getArabicDefaultStyle(),
    content: [
      {
        columns: [
          {
            width: "*",
            stack: [
              { text: "بتر بيكري", style: "companyName", alignment: "right" },
              { text: "Butter Bakery", style: "companyNameEn", alignment: "right" },
            ],
          },
          {
            width: "auto",
            stack: [
              { text: "تقرير الأرباح والخسائر", style: "reportTitle", alignment: "left" },
              { text: `الفرع: ${branchName}`, alignment: "left" },
              { text: `الفترة: ${period}`, alignment: "left" },
            ],
          },
        ],
      },
      { canvas: [{ type: "line", x1: 0, y1: 10, x2: 515, y2: 10, lineWidth: 1, lineColor: "#D4AF37" }] },
      { text: "", margin: [0, 20, 0, 0] },

      { text: "ملخص المؤشرات الرئيسية", style: "sectionHeader" },
      {
        table: {
          widths: ["*", "*", "*", "*"],
          body: [
            [
              { text: "التقييم", style: "tableHeader" },
              { text: "صافي الربح", style: "tableHeader" },
              { text: "إجمالي الربح", style: "tableHeader" },
              { text: "الإيرادات", style: "tableHeader" },
            ],
            [
              { text: getRatingLabel(metrics?.rating || "average"), alignment: "center" },
              { text: formatCurrency(metrics?.netProfit || 0), alignment: "center" },
              { text: formatCurrency(metrics?.grossProfit || 0), alignment: "center" },
              { text: formatCurrency(metrics?.totalRevenue || 0), alignment: "center" },
            ],
          ],
        },
        margin: [0, 10, 0, 20],
      },

      { text: "المبيعات حسب القناة", style: "sectionHeader" },
      {
        table: {
          widths: ["*", "*", "*"],
          body: [
            [
              { text: "عدد الفواتير", style: "tableHeader" },
              { text: "المبلغ", style: "tableHeader" },
              { text: "القناة", style: "tableHeader" },
            ],
            ...sales.map((s) => [
              { text: formatNumber(s.invoiceCount || 0), alignment: "center" },
              { text: formatCurrency(s.totalAmount || 0), alignment: "center" },
              { text: SALES_CHANNELS.find(c => c.id === s.channel)?.label || s.channel, alignment: "right" },
            ]),
          ],
        },
        margin: [0, 10, 0, 20],
      },

      { text: "تكاليف المبيعات (COGS)", style: "sectionHeader" },
      {
        table: {
          widths: ["*", "*", "*"],
          body: [
            [
              { text: "الهدر", style: "tableHeader" },
              { text: "المبلغ", style: "tableHeader" },
              { text: "البند", style: "tableHeader" },
            ],
            ...cogs.map((c) => [
              { text: formatCurrency(c.wasteAmount || 0), alignment: "center" },
              { text: formatCurrency(c.amount || 0), alignment: "center" },
              { text: COGS_CATEGORIES.find(cat => cat.id === c.itemType)?.label || c.itemType, alignment: "right" },
            ]),
          ],
        },
        margin: [0, 10, 0, 20],
      },

      { text: "المصروفات التشغيلية", style: "sectionHeader" },
      {
        table: {
          widths: ["*", "*"],
          body: [
            [
              { text: "المبلغ", style: "tableHeader" },
              { text: "البند", style: "tableHeader" },
            ],
            ...opex.map((e) => [
              { text: formatCurrency(e.amount || 0), alignment: "center" },
              { text: OPERATING_EXPENSE_TYPES.find(t => t.id === e.expenseType)?.label || e.expenseType, alignment: "right" },
            ]),
          ],
        },
        margin: [0, 10, 0, 20],
      },

      { text: "التكاليف الثابتة", style: "sectionHeader" },
      {
        table: {
          widths: ["*", "*"],
          body: [
            [
              { text: "المبلغ", style: "tableHeader" },
              { text: "البند", style: "tableHeader" },
            ],
            ...fixedCosts.map((c) => [
              { text: formatCurrency(c.amount || 0), alignment: "center" },
              { text: FIXED_COST_TYPES.find(t => t.id === c.costType)?.label || c.costType, alignment: "right" },
            ]),
          ],
        },
        margin: [0, 10, 0, 20],
      },

      { text: "المؤشرات المالية المتقدمة", style: "sectionHeader" },
      {
        table: {
          widths: ["*", "*"],
          body: [
            [
              { text: formatPercent(metrics?.grossMarginPct || 0), alignment: "center" },
              { text: "هامش الربح الإجمالي", alignment: "right" },
            ],
            [
              { text: formatPercent(metrics?.netMarginPct || 0), alignment: "center" },
              { text: "هامش الربح الصافي", alignment: "right" },
            ],
            [
              { text: formatCurrency(metrics?.operatingProfit || 0), alignment: "center" },
              { text: "الربح التشغيلي", alignment: "right" },
            ],
            [
              { text: formatPercent(metrics?.operatingMarginPct || 0), alignment: "center" },
              { text: "هامش الربح التشغيلي", alignment: "right" },
            ],
            [
              { text: formatCurrency(metrics?.ebitda || 0), alignment: "center" },
              { text: "EBITDA", alignment: "right" },
            ],
            [
              { text: formatPercent(metrics?.ebitdaMarginPct || 0), alignment: "center" },
              { text: "هامش EBITDA", alignment: "right" },
            ],
            [
              { text: formatCurrency(metrics?.contributionMargin || 0), alignment: "center" },
              { text: "هامش المساهمة", alignment: "right" },
            ],
            [
              { text: formatPercent(metrics?.contributionMarginPct || 0), alignment: "center" },
              { text: "نسبة هامش المساهمة", alignment: "right" },
            ],
            [
              { text: formatPercent(metrics?.salaryToSalesPct || 0), alignment: "center" },
              { text: "نسبة الرواتب للمبيعات", alignment: "right" },
            ],
            [
              { text: formatCurrency(metrics?.breakEvenSales || 0), alignment: "center" },
              { text: "نقطة التعادل", alignment: "right" },
            ],
            [
              { text: metrics?.employeeCount || 0, alignment: "center" },
              { text: "عدد الموظفين", alignment: "right" },
            ],
            [
              { text: formatCurrency(metrics?.revenuePerEmployee || 0), alignment: "center" },
              { text: "الإيراد لكل موظف", alignment: "right" },
            ],
            [
              { text: formatPercent(metrics?.laborProductivity || 0), alignment: "center" },
              { text: "إنتاجية العمالة", alignment: "right" },
            ],
          ],
        },
        margin: [0, 10, 0, 20],
      },

      { text: "", margin: [0, 20, 0, 0] },
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: "#cccccc" }] },
      { 
        text: `تم إنشاء هذا التقرير بواسطة نظام بتر بيكري - ${new Date().toLocaleDateString("ar-SA")}`, 
        style: "footer",
        margin: [0, 10, 0, 0],
      },
    ],
    styles: {
      companyName: { fontSize: 18, bold: true, color: "#D4AF37" },
      companyNameEn: { fontSize: 12, color: "#666666" },
      reportTitle: { fontSize: 16, bold: true, margin: [0, 0, 0, 5] },
      sectionHeader: { fontSize: 12, bold: true, color: "#D4AF37", margin: [0, 10, 0, 5] },
      tableHeader: { ...getArabicTableHeaderStyle(), fillColor: "#FEF9E7" },
      footer: { fontSize: 8, color: "#999999", alignment: "center" },
    },
  };

  return docDefinition;
}

function exportPnLToExcel(
  branchName: string,
  period: string,
  metrics: any,
  sales: any[],
  cogs: any[],
  opex: any[],
  fixedCosts: any[]
) {
  const wb = XLSX.utils.book_new();

  const summaryData = [
    { "المؤشر": "الإيرادات", "القيمة": metrics?.totalRevenue || 0 },
    { "المؤشر": "تكلفة المبيعات", "القيمة": metrics?.totalCOGS || 0 },
    { "المؤشر": "إجمالي الربح", "القيمة": metrics?.grossProfit || 0 },
    { "المؤشر": "هامش الربح الإجمالي %", "القيمة": metrics?.grossMarginPct || 0 },
    { "المؤشر": "المصروفات التشغيلية", "القيمة": metrics?.totalOperatingExpenses || 0 },
    { "المؤشر": "الربح التشغيلي", "القيمة": metrics?.operatingProfit || 0 },
    { "المؤشر": "هامش الربح التشغيلي %", "القيمة": metrics?.operatingMarginPct || 0 },
    { "المؤشر": "التكاليف الثابتة", "القيمة": metrics?.totalFixedCosts || 0 },
    { "المؤشر": "صافي الربح", "القيمة": metrics?.netProfit || 0 },
    { "المؤشر": "هامش الربح الصافي %", "القيمة": metrics?.netMarginPct || 0 },
    { "المؤشر": "EBITDA", "القيمة": metrics?.ebitda || 0 },
    { "المؤشر": "هامش EBITDA %", "القيمة": metrics?.ebitdaMarginPct || 0 },
    { "المؤشر": "هامش المساهمة", "القيمة": metrics?.contributionMargin || 0 },
    { "المؤشر": "نسبة هامش المساهمة %", "القيمة": metrics?.contributionMarginPct || 0 },
    { "المؤشر": "نقطة التعادل", "القيمة": metrics?.breakEvenSales || 0 },
    { "المؤشر": "نسبة الرواتب للمبيعات %", "القيمة": metrics?.salaryToSalesPct || 0 },
    { "المؤشر": "نسبة الإيجار للإيرادات %", "القيمة": metrics?.rentToRevenuePct || 0 },
    { "المؤشر": "نسبة الهدر %", "القيمة": metrics?.wastePct || 0 },
    { "المؤشر": "عدد الموظفين", "القيمة": metrics?.employeeCount || 0 },
    { "المؤشر": "الإيراد لكل موظف", "القيمة": metrics?.revenuePerEmployee || 0 },
    { "المؤشر": "إنتاجية العمالة %", "القيمة": metrics?.laborProductivity || 0 },
    { "المؤشر": "عدد الفواتير", "القيمة": metrics?.invoiceCount || 0 },
    { "المؤشر": "متوسط قيمة الفاتورة", "القيمة": metrics?.avgInvoiceValue || 0 },
  ];
  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, "ملخص المؤشرات");

  const salesData = sales.map(s => ({
    "القناة": SALES_CHANNELS.find(c => c.id === s.channel)?.label || s.channel,
    "المبلغ": s.totalAmount || 0,
    "عدد الفواتير": s.invoiceCount || 0,
  }));
  const wsSales = XLSX.utils.json_to_sheet(salesData);
  XLSX.utils.book_append_sheet(wb, wsSales, "المبيعات");

  const cogsData = cogs.map(c => ({
    "البند": COGS_CATEGORIES.find(cat => cat.id === c.itemType)?.label || c.itemType,
    "المبلغ": c.amount || 0,
    "الهدر": c.wasteAmount || 0,
  }));
  const wsCogs = XLSX.utils.json_to_sheet(cogsData);
  XLSX.utils.book_append_sheet(wb, wsCogs, "تكاليف المبيعات");

  const opexData = opex.map(e => ({
    "البند": OPERATING_EXPENSE_TYPES.find(t => t.id === e.expenseType)?.label || e.expenseType,
    "المبلغ": e.amount || 0,
  }));
  const wsOpex = XLSX.utils.json_to_sheet(opexData);
  XLSX.utils.book_append_sheet(wb, wsOpex, "المصروفات التشغيلية");

  const fixedData = fixedCosts.map(c => ({
    "البند": FIXED_COST_TYPES.find(t => t.id === c.costType)?.label || c.costType,
    "المبلغ": c.amount || 0,
  }));
  const wsFixed = XLSX.utils.json_to_sheet(fixedData);
  XLSX.utils.book_append_sheet(wb, wsFixed, "التكاليف الثابتة");

  XLSX.writeFile(wb, `تقرير_الأرباح_والخسائر_${branchName}_${period}.xlsx`);
}

interface Branch {
  id: string;
  name: string;
}

interface FinancialPeriod {
  id: number;
  branchId: string;
  year: number;
  month: number;
  periodType: string;
  status: string;
  targetRevenue: number;
  targetGrossMargin: number;
  targetNetMargin: number;
  notes?: string;
}

interface FinancialSales {
  id: number;
  periodId: number;
  date: string;
  channel: string;
  totalAmount: number;
  invoiceCount: number;
}

interface FinancialCOGS {
  id: number;
  periodId: number;
  itemType: string;
  notes?: string;
  amount: number;
  wasteAmount?: number;
}

interface FinancialOperatingExpense {
  id: number;
  periodId: number;
  expenseType: string;
  notes?: string;
  amount: number;
}

interface FinancialFixedCost {
  id: number;
  periodId: number;
  costType: string;
  notes?: string;
  amount: number;
}

interface FinancialMetrics {
  id: number;
  periodId: number;
  totalRevenue: number;
  totalCOGS: number;
  totalOperatingExpenses: number;
  totalFixedCosts: number;
  grossProfit: number;
  netProfit: number;
  grossMarginPct: number;
  netMarginPct: number;
  breakEvenSales: number;
  salaryToSalesPct: number;
  rentToRevenuePct: number;
  wastePct: number;
  invoiceCount: number;
  avgInvoiceValue: number;
  ebitda?: number;
  ebitdaMarginPct?: number;
  contributionMargin?: number;
  contributionMarginPct?: number;
  laborProductivity?: number;
  revenuePerEmployee?: number;
  employeeCount?: number;
  operatingProfit?: number;
  operatingMarginPct?: number;
  rating: string;
  ratingReasons: string[];
  recommendations: string[];
}

interface CompletePnLData {
  period: FinancialPeriod;
  sales: FinancialSales[];
  cogs: FinancialCOGS[];
  operatingExpenses: FinancialOperatingExpense[];
  fixedCosts: FinancialFixedCost[];
  metrics?: FinancialMetrics;
}

interface BranchRanking {
  branchId: string;
  branchName: string;
  periodId: number;
  value: number;
  rank: number;
}

interface CashierSummary {
  summary: {
    totalCash: number;
    totalCard: number;
    totalDelivery: number;
    totalSales: number;
    totalInvoices: number;
    journalsCount: number;
    daysWithData: number;
  };
  dailyBreakdown: Array<{
    date: string;
    cash: number;
    card: number;
    delivery: number;
    total: number;
    invoices: number;
  }>;
}

interface PeriodComparison {
  current: {
    revenue: number;
    grossProfit: number;
    netProfit: number;
    grossMargin: number;
    netMargin: number;
  } | null;
  previousMonth: {
    revenue: number;
    grossProfit: number;
    netProfit: number;
    grossMargin: number;
    netMargin: number;
    revenueChange: number;
    profitChange: number;
  } | null;
  lastYear: {
    revenue: number;
    grossProfit: number;
    netProfit: number;
    grossMargin: number;
    netMargin: number;
    revenueChange: number;
    profitChange: number;
  } | null;
}

export default function PnLDashboard() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [showDataEntry, setShowDataEntry] = useState(false);
  const [rankingMetric, setRankingMetric] = useState<"profit" | "revenue" | "margin">("profit");
  
  const [salesEntries, setSalesEntries] = useState<Array<{ channel: string; totalAmount: number; invoiceCount: number }>>([]);
  const [cogsEntries, setCogsEntries] = useState<Array<{ itemType: string; notes: string; amount: number; wasteAmount: number }>>([]);
  const [operatingExpensesEntries, setOperatingExpensesEntries] = useState<Array<{ expenseType: string; notes: string; amount: number }>>([]);
  const [fixedCostsEntries, setFixedCostsEntries] = useState<Array<{ costType: string; notes: string; amount: number }>>([]);

  const { data: branches = [], isLoading: loadingBranches } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const { data: periods = [], isLoading: loadingPeriods, refetch: refetchPeriods } = useQuery<FinancialPeriod[]>({
    queryKey: ["/api/financials/periods", { branchId: selectedBranchId, year: selectedYear }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBranchId) params.append("branchId", selectedBranchId);
      if (selectedYear) params.append("year", selectedYear.toString());
      const res = await fetch(`/api/financials/periods?${params}`);
      if (!res.ok) throw new Error("Failed to fetch periods");
      return res.json();
    },
  });

  const { data: completePnL, isLoading: loadingPnL, refetch: refetchPnL } = useQuery<CompletePnLData>({
    queryKey: ["/api/financials/periods", selectedPeriodId, "complete"],
    queryFn: async () => {
      if (!selectedPeriodId) return null;
      const res = await fetch(`/api/financials/periods/${selectedPeriodId}/complete`);
      if (!res.ok) throw new Error("Failed to fetch P&L data");
      return res.json();
    },
    enabled: !!selectedPeriodId,
  });

  const { data: branchRanking = [], isLoading: loadingRanking } = useQuery<BranchRanking[]>({
    queryKey: ["/api/financials/ranking", { year: selectedYear, month: selectedMonth, metric: rankingMetric }],
    queryFn: async () => {
      const params = new URLSearchParams({
        year: selectedYear.toString(),
        month: selectedMonth.toString(),
        metric: rankingMetric,
      });
      const res = await fetch(`/api/financials/ranking?${params}`);
      if (!res.ok) throw new Error("Failed to fetch ranking");
      return res.json();
    },
  });

  const createPeriodMutation = useMutation({
    mutationFn: async (data: { branchId: string; year: number; month: number }) => {
      const res = await fetch("/api/financials/periods/get-or-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create period");
      return res.json();
    },
    onSuccess: (period) => {
      setSelectedPeriodId(period.id);
      refetchPeriods();
      toast({ title: "تم إنشاء الفترة المالية بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في إنشاء الفترة المالية", variant: "destructive" });
    },
  });

  const saveSalesMutation = useMutation({
    mutationFn: async (data: { periodId: number; salesData: any[] }) => {
      const res = await fetch(`/api/financials/periods/${data.periodId}/sales`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ salesData: data.salesData }),
      });
      if (!res.ok) throw new Error("Failed to save sales");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم حفظ بيانات المبيعات" });
    },
  });

  const saveCogsMutation = useMutation({
    mutationFn: async (data: { periodId: number; cogsData: any[] }) => {
      const res = await fetch(`/api/financials/periods/${data.periodId}/cogs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cogsData: data.cogsData }),
      });
      if (!res.ok) throw new Error("Failed to save COGS");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم حفظ بيانات التكاليف" });
    },
  });

  const saveOperatingExpensesMutation = useMutation({
    mutationFn: async (data: { periodId: number; expensesData: any[] }) => {
      const res = await fetch(`/api/financials/periods/${data.periodId}/operating-expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expensesData: data.expensesData }),
      });
      if (!res.ok) throw new Error("Failed to save expenses");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم حفظ المصروفات التشغيلية" });
    },
  });

  const saveFixedCostsMutation = useMutation({
    mutationFn: async (data: { periodId: number; costsData: any[] }) => {
      const res = await fetch(`/api/financials/periods/${data.periodId}/fixed-costs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ costsData: data.costsData }),
      });
      if (!res.ok) throw new Error("Failed to save costs");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم حفظ التكاليف الثابتة" });
    },
  });

  const calculateMetricsMutation = useMutation({
    mutationFn: async (periodId: number) => {
      const res = await fetch(`/api/financials/periods/${periodId}/calculate-metrics`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to calculate metrics");
      return res.json();
    },
    onSuccess: () => {
      refetchPnL();
      queryClient.invalidateQueries({ queryKey: ["/api/financials/ranking"] });
      toast({ title: "تم حساب المؤشرات بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في حساب المؤشرات", variant: "destructive" });
    },
  });

  // Import sales from cashier journals
  const importSalesMutation = useMutation({
    mutationFn: async (periodId: number) => {
      const res = await fetch(`/api/financials/periods/${periodId}/import-sales`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to import sales");
      return res.json();
    },
    onSuccess: (data) => {
      refetchPnL();
      refetchCashierSummary();
      toast({ 
        title: "تم استيراد بيانات المبيعات", 
        description: `تم استيراد ${data.imported.journalsCount} سجل بإجمالي ${formatCurrency(data.imported.totalRevenue)}` 
      });
    },
    onError: () => {
      toast({ title: "فشل في استيراد بيانات المبيعات", variant: "destructive" });
    },
  });

  // Cashier summary for preview
  const { data: cashierSummary, refetch: refetchCashierSummary } = useQuery<CashierSummary>({
    queryKey: ["/api/financials/periods", selectedPeriodId, "cashier-summary"],
    queryFn: async () => {
      if (!selectedPeriodId) return null;
      const res = await fetch(`/api/financials/periods/${selectedPeriodId}/cashier-summary`);
      if (!res.ok) throw new Error("Failed to fetch cashier summary");
      return res.json();
    },
    enabled: !!selectedPeriodId,
  });

  // Period comparison
  const { data: comparison } = useQuery<PeriodComparison>({
    queryKey: ["/api/financials/periods", selectedPeriodId, "comparison"],
    queryFn: async () => {
      if (!selectedPeriodId) return null;
      const res = await fetch(`/api/financials/periods/${selectedPeriodId}/comparison`);
      if (!res.ok) throw new Error("Failed to fetch comparison");
      return res.json();
    },
    enabled: !!selectedPeriodId && !!completePnL?.metrics,
  });

  const handleSelectPeriod = (branchId: string, year: number, month: number) => {
    const existingPeriod = periods.find(
      p => p.branchId === branchId && p.year === year && p.month === month
    );
    if (existingPeriod) {
      setSelectedPeriodId(existingPeriod.id);
    } else {
      setSelectedPeriodId(null);
    }
  };

  const handleCreateOrLoadPeriod = () => {
    if (!selectedBranchId) {
      toast({ title: "يرجى اختيار الفرع أولاً", variant: "destructive" });
      return;
    }
    createPeriodMutation.mutate({
      branchId: selectedBranchId,
      year: selectedYear,
      month: selectedMonth,
    });
  };

  const handleSaveAllData = async () => {
    if (!selectedPeriodId) return;

    try {
      if (salesEntries.length > 0) {
        await saveSalesMutation.mutateAsync({ 
          periodId: selectedPeriodId, 
          salesData: salesEntries.map(s => ({
            ...s,
            date: `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`,
          }))
        });
      }
      if (cogsEntries.length > 0) {
        await saveCogsMutation.mutateAsync({ periodId: selectedPeriodId, cogsData: cogsEntries });
      }
      if (operatingExpensesEntries.length > 0) {
        await saveOperatingExpensesMutation.mutateAsync({ periodId: selectedPeriodId, expensesData: operatingExpensesEntries });
      }
      if (fixedCostsEntries.length > 0) {
        await saveFixedCostsMutation.mutateAsync({ periodId: selectedPeriodId, costsData: fixedCostsEntries });
      }
      
      await calculateMetricsMutation.mutateAsync(selectedPeriodId);
      setShowDataEntry(false);
    } catch (error) {
      toast({ title: "فشل في حفظ البيانات", variant: "destructive" });
    }
  };

  const loadExistingData = () => {
    if (completePnL) {
      setSalesEntries(completePnL.sales.map(s => ({
        channel: s.channel,
        totalAmount: s.totalAmount,
        invoiceCount: s.invoiceCount,
      })));
      setCogsEntries(completePnL.cogs.map(c => ({
        itemType: c.itemType,
        notes: c.notes || "",
        amount: c.amount,
        wasteAmount: c.wasteAmount || 0,
      })));
      setOperatingExpensesEntries(completePnL.operatingExpenses.map(e => ({
        expenseType: e.expenseType,
        notes: e.notes || "",
        amount: e.amount,
      })));
      setFixedCostsEntries(completePnL.fixedCosts.map(c => ({
        costType: c.costType,
        notes: c.notes || "",
        amount: c.amount,
      })));
    }
  };

  const metrics = completePnL?.metrics;
  const selectedBranch = branches.find(b => b.id === selectedBranchId);

  const salesByChannelData = useMemo(() => {
    if (!completePnL?.sales) return [];
    const grouped = completePnL.sales.reduce((acc, s) => {
      const channelInfo = SALES_CHANNELS.find(c => c.id === s.channel);
      acc[s.channel] = (acc[s.channel] || 0) + s.totalAmount;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(grouped).map(([channel, amount], i) => ({
      name: SALES_CHANNELS.find(c => c.id === channel)?.label || channel,
      value: amount,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));
  }, [completePnL?.sales]);

  const costBreakdownData = useMemo(() => {
    if (!metrics) return [];
    return [
      { name: "تكاليف المبيعات", value: metrics.totalCOGS, color: CHART_COLORS[0] },
      { name: "مصروفات تشغيلية", value: metrics.totalOperatingExpenses, color: CHART_COLORS[1] },
      { name: "تكاليف ثابتة", value: metrics.totalFixedCosts, color: CHART_COLORS[2] },
      { name: "صافي الربح", value: metrics.netProfit, color: metrics.netProfit >= 0 ? CHART_COLORS[3] : "#EF4444" },
    ].filter(item => item.value !== 0);
  }, [metrics]);

  const profitabilityData = useMemo(() => {
    if (!metrics) return [];
    return [
      { name: "الإيرادات", value: metrics.totalRevenue },
      { name: "إجمالي الربح", value: metrics.grossProfit },
      { name: "صافي الربح", value: metrics.netProfit },
    ];
  }, [metrics]);

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  if (loadingBranches) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-background p-6" dir="rtl">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/attendance-dashboard")}
                className="rounded-full hover:bg-muted"
                data-testid="button-back"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                  <BarChart3 className="h-8 w-8 text-primary" />
                  لوحة الأرباح والخسائر (P&L)
                </h1>
                <p className="text-muted-foreground mt-1">تحليل الأداء المالي للفروع</p>
              </div>
            </div>
            {selectedPeriodId && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => importSalesMutation.mutate(selectedPeriodId)}
                  disabled={importSalesMutation.isPending}
                  data-testid="button-import-sales"
                >
                  {importSalesMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  ) : (
                    <Download className="h-4 w-4 ml-2" />
                  )}
                  استيراد من الكاشير
                </Button>
                <Button
                  onClick={() => calculateMetricsMutation.mutate(selectedPeriodId)}
                  disabled={calculateMetricsMutation.isPending}
                  data-testid="button-calculate-metrics"
                >
                  {calculateMetricsMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  ) : (
                    <Calculator className="h-4 w-4 ml-2" />
                  )}
                  حساب المؤشرات
                </Button>
                {completePnL?.metrics && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (selectedBranch && completePnL) {
                          const period = `${MONTHS_AR[selectedMonth - 1]} ${selectedYear}`;
                          const docDef = generatePnLPdfReport(
                            selectedBranch.name,
                            period,
                            completePnL.metrics,
                            completePnL.sales,
                            completePnL.cogs,
                            completePnL.operatingExpenses,
                            completePnL.fixedCosts
                          );
                          downloadArabicPdf(docDef, `تقرير_PnL_${selectedBranch.name}_${period}.pdf`);
                        }
                      }}
                      data-testid="button-export-pdf"
                    >
                      <Printer className="h-4 w-4 ml-2" />
                      PDF
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (selectedBranch && completePnL) {
                          const period = `${MONTHS_AR[selectedMonth - 1]} ${selectedYear}`;
                          exportPnLToExcel(
                            selectedBranch.name,
                            period,
                            completePnL.metrics,
                            completePnL.sales,
                            completePnL.cogs,
                            completePnL.operatingExpenses,
                            completePnL.fixedCosts
                          );
                        }
                      }}
                      data-testid="button-export-excel"
                    >
                      <FileSpreadsheet className="h-4 w-4 ml-2" />
                      Excel
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              اختيار الفترة المالية
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label>الفرع</Label>
                <Select
                  value={selectedBranchId}
                  onValueChange={(value) => {
                    setSelectedBranchId(value);
                    handleSelectPeriod(value, selectedYear, selectedMonth);
                  }}
                >
                  <SelectTrigger data-testid="select-branch">
                    <SelectValue placeholder="اختر الفرع" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>السنة</Label>
                <Select
                  value={selectedYear.toString()}
                  onValueChange={(value) => {
                    const year = parseInt(value);
                    setSelectedYear(year);
                    handleSelectPeriod(selectedBranchId, year, selectedMonth);
                  }}
                >
                  <SelectTrigger data-testid="select-year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>الشهر</Label>
                <Select
                  value={selectedMonth.toString()}
                  onValueChange={(value) => {
                    const month = parseInt(value);
                    setSelectedMonth(month);
                    handleSelectPeriod(selectedBranchId, selectedYear, month);
                  }}
                >
                  <SelectTrigger data-testid="select-month">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS_AR.map((month, index) => (
                      <SelectItem key={index} value={(index + 1).toString()}>
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button
                  onClick={handleCreateOrLoadPeriod}
                  disabled={!selectedBranchId || createPeriodMutation.isPending}
                  className="w-full"
                  data-testid="button-load-period"
                >
                  {createPeriodMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  ) : (
                    <Plus className="h-4 w-4 ml-2" />
                  )}
                  تحميل / إنشاء الفترة
                </Button>
              </div>
            </div>

            {selectedPeriodId && selectedBranch && (
              <div className="mt-4 p-3 bg-primary/5 rounded-lg flex items-center justify-between">
                <span className="text-sm">
                  الفترة الحالية: <strong>{selectedBranch.name}</strong> - {MONTHS_AR[selectedMonth - 1]} {selectedYear}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    loadExistingData();
                    setShowDataEntry(true);
                  }}
                  data-testid="button-enter-data"
                >
                  <FileText className="h-4 w-4 ml-2" />
                  إدخال البيانات
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {selectedPeriodId && (
          <>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview" data-testid="tab-overview">
                  <BarChart3 className="h-4 w-4 ml-2" />
                  نظرة عامة
                </TabsTrigger>
                <TabsTrigger value="details" data-testid="tab-details">
                  <FileText className="h-4 w-4 ml-2" />
                  التفاصيل
                </TabsTrigger>
                <TabsTrigger value="charts" data-testid="tab-charts">
                  <PieChart className="h-4 w-4 ml-2" />
                  الرسوم البيانية
                </TabsTrigger>
                <TabsTrigger value="ranking" data-testid="tab-ranking">
                  <Award className="h-4 w-4 ml-2" />
                  ترتيب الفروع
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                {loadingPnL ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : metrics ? (
                  <>
                    <div className="flex items-center justify-between mb-6">
                      <Badge
                        className={`text-lg px-4 py-2 ${RATING_COLORS[metrics.rating]?.bg} ${RATING_COLORS[metrics.rating]?.text}`}
                      >
                        <Award className="h-5 w-5 ml-2" />
                        التقييم: {RATING_COLORS[metrics.rating]?.label}
                      </Badge>
                      
                      {comparison && (
                        <div className="flex gap-4">
                          {comparison.previousMonth && (
                            <div className="flex items-center gap-2 text-sm">
                              <History className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground">مقارنة بالشهر السابق:</span>
                              <Badge variant={comparison.previousMonth.revenueChange >= 0 ? "default" : "destructive"}>
                                {comparison.previousMonth.revenueChange >= 0 ? (
                                  <ArrowUp className="h-3 w-3 ml-1" />
                                ) : (
                                  <ArrowDown className="h-3 w-3 ml-1" />
                                )}
                                {formatPercent(Math.abs(comparison.previousMonth.revenueChange))}
                              </Badge>
                            </div>
                          )}
                          {comparison.lastYear && (
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-muted-foreground">سنوياً:</span>
                              <Badge variant={comparison.lastYear.revenueChange >= 0 ? "default" : "destructive"}>
                                {comparison.lastYear.revenueChange >= 0 ? (
                                  <ArrowUp className="h-3 w-3 ml-1" />
                                ) : (
                                  <ArrowDown className="h-3 w-3 ml-1" />
                                )}
                                {formatPercent(Math.abs(comparison.lastYear.revenueChange))}
                              </Badge>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Cashier Summary Preview */}
                    {cashierSummary && cashierSummary.summary.journalsCount > 0 && (
                      <Card className="mb-4 bg-blue-50 border-blue-200">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Receipt className="h-5 w-5 text-blue-600" />
                              <div>
                                <p className="font-medium text-blue-900">بيانات سجل الكاشير المتوفرة</p>
                                <p className="text-sm text-blue-700">
                                  {cashierSummary.summary.journalsCount} سجل - {cashierSummary.summary.daysWithData} يوم - 
                                  إجمالي {formatCurrency(cashierSummary.summary.totalSales)}
                                </p>
                              </div>
                            </div>
                            <Button 
                              size="sm" 
                              onClick={() => importSalesMutation.mutate(selectedPeriodId!)}
                              disabled={importSalesMutation.isPending}
                              data-testid="button-import-cashier-inline"
                            >
                              {importSalesMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin ml-2" />
                              ) : (
                                <Download className="h-4 w-4 ml-2" />
                              )}
                              استيراد
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <Card className="border-l-4 border-l-blue-500">
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-muted-foreground">إجمالي الإيرادات</p>
                              <p className="text-2xl font-bold">{formatCurrency(metrics.totalRevenue)}</p>
                            </div>
                            <DollarSign className="h-10 w-10 text-blue-500 opacity-50" />
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">
                            {metrics.invoiceCount} فاتورة - متوسط {formatCurrency(metrics.avgInvoiceValue)}
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border-l-4 border-l-green-500">
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-muted-foreground">إجمالي الربح</p>
                              <p className="text-2xl font-bold">{formatCurrency(metrics.grossProfit)}</p>
                            </div>
                            <TrendingUp className="h-10 w-10 text-green-500 opacity-50" />
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <Badge variant="secondary">{formatPercent(metrics.grossMarginPct)}</Badge>
                            <span className="text-xs text-muted-foreground">هامش إجمالي</span>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className={`border-l-4 ${metrics.netProfit >= 0 ? "border-l-emerald-500" : "border-l-red-500"}`}>
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-muted-foreground">صافي الربح</p>
                              <p className={`text-2xl font-bold ${metrics.netProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                {formatCurrency(metrics.netProfit)}
                              </p>
                            </div>
                            {metrics.netProfit >= 0 ? (
                              <TrendingUp className="h-10 w-10 text-emerald-500 opacity-50" />
                            ) : (
                              <TrendingDown className="h-10 w-10 text-red-500 opacity-50" />
                            )}
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <Badge variant={metrics.netProfit >= 0 ? "default" : "destructive"}>
                              {formatPercent(metrics.netMarginPct)}
                            </Badge>
                            <span className="text-xs text-muted-foreground">هامش صافي</span>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border-l-4 border-l-amber-500">
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-muted-foreground">نقطة التعادل</p>
                              <p className="text-2xl font-bold">{formatCurrency(metrics.breakEvenSales)}</p>
                            </div>
                            <Target className="h-10 w-10 text-amber-500 opacity-50" />
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">
                            {metrics.totalRevenue >= metrics.breakEvenSales ? (
                              <span className="text-green-600">✓ تم تجاوز نقطة التعادل</span>
                            ) : (
                              <span className="text-red-600">✗ لم يتم الوصول لنقطة التعادل</span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card>
                        <CardContent className="p-6">
                          <div className="flex items-center gap-2 mb-2">
                            <Users className="h-5 w-5 text-purple-500" />
                            <span className="font-medium">نسبة الرواتب للمبيعات</span>
                          </div>
                          <p className="text-3xl font-bold">{formatPercent(metrics.salaryToSalesPct)}</p>
                          <div className="mt-2">
                            {metrics.salaryToSalesPct <= 25 ? (
                              <Badge className="bg-green-100 text-green-800">ممتاز</Badge>
                            ) : metrics.salaryToSalesPct <= 35 ? (
                              <Badge className="bg-yellow-100 text-yellow-800">مقبول</Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-800">مرتفع</Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-6">
                          <div className="flex items-center gap-2 mb-2">
                            <Home className="h-5 w-5 text-orange-500" />
                            <span className="font-medium">نسبة الإيجار للإيرادات</span>
                          </div>
                          <p className="text-3xl font-bold">{formatPercent(metrics.rentToRevenuePct)}</p>
                          <div className="mt-2">
                            {metrics.rentToRevenuePct <= 10 ? (
                              <Badge className="bg-green-100 text-green-800">ممتاز</Badge>
                            ) : metrics.rentToRevenuePct <= 15 ? (
                              <Badge className="bg-yellow-100 text-yellow-800">مقبول</Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-800">مرتفع</Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-6">
                          <div className="flex items-center gap-2 mb-2">
                            <Package className="h-5 w-5 text-red-500" />
                            <span className="font-medium">نسبة الهدر</span>
                          </div>
                          <p className="text-3xl font-bold">{formatPercent(metrics.wastePct)}</p>
                          <div className="mt-2">
                            {metrics.wastePct <= 3 ? (
                              <Badge className="bg-green-100 text-green-800">ممتاز</Badge>
                            ) : metrics.wastePct <= 5 ? (
                              <Badge className="bg-yellow-100 text-yellow-800">مقبول</Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-800">مرتفع</Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Advanced Financial KPIs */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <Card className="border-l-4 border-l-indigo-500">
                        <CardContent className="p-6">
                          <div className="flex items-center gap-2 mb-2">
                            <BarChart3 className="h-5 w-5 text-indigo-500" />
                            <span className="font-medium">EBITDA</span>
                          </div>
                          <p className="text-2xl font-bold">{formatCurrency(metrics.ebitda || 0)}</p>
                          <div className="mt-2 flex items-center gap-2">
                            <Badge variant="secondary">{formatPercent(metrics.ebitdaMarginPct || 0)}</Badge>
                            <span className="text-xs text-muted-foreground">هامش EBITDA</span>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border-l-4 border-l-cyan-500">
                        <CardContent className="p-6">
                          <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="h-5 w-5 text-cyan-500" />
                            <span className="font-medium">هامش المساهمة</span>
                          </div>
                          <p className="text-2xl font-bold">{formatCurrency(metrics.contributionMargin || 0)}</p>
                          <div className="mt-2 flex items-center gap-2">
                            <Badge variant="secondary">{formatPercent(metrics.contributionMarginPct || 0)}</Badge>
                            <span className="text-xs text-muted-foreground">من الإيرادات</span>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border-l-4 border-l-pink-500">
                        <CardContent className="p-6">
                          <div className="flex items-center gap-2 mb-2">
                            <Calculator className="h-5 w-5 text-pink-500" />
                            <span className="font-medium">الربح التشغيلي</span>
                          </div>
                          <p className={`text-2xl font-bold ${(metrics.operatingProfit || 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                            {formatCurrency(metrics.operatingProfit || 0)}
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            <Badge variant={(metrics.operatingProfit || 0) >= 0 ? "default" : "destructive"}>
                              {formatPercent(metrics.operatingMarginPct || 0)}
                            </Badge>
                            <span className="text-xs text-muted-foreground">هامش تشغيلي</span>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border-l-4 border-l-violet-500">
                        <CardContent className="p-6">
                          <div className="flex items-center gap-2 mb-2">
                            <Users className="h-5 w-5 text-violet-500" />
                            <span className="font-medium">إنتاجية العمالة</span>
                          </div>
                          <p className="text-2xl font-bold">{formatCurrency(metrics.revenuePerEmployee || 0)}</p>
                          <div className="mt-2">
                            <span className="text-xs text-muted-foreground">
                              لكل موظف من {metrics.employeeCount || 0} موظف
                            </span>
                          </div>
                          {metrics.laborProductivity && metrics.laborProductivity > 0 && (
                            <div className="mt-1">
                              <Badge variant="outline">
                                {formatPercent(metrics.laborProductivity)} عائد للراتب
                              </Badge>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    {(metrics.ratingReasons?.length > 0 || metrics.recommendations?.length > 0) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {metrics.ratingReasons?.length > 0 && (
                          <Card>
                            <CardHeader>
                              <CardTitle className="flex items-center gap-2 text-lg">
                                <AlertTriangle className="h-5 w-5 text-amber-500" />
                                أسباب التقييم
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <ul className="space-y-2">
                                {metrics.ratingReasons.map((reason, index) => (
                                  <li key={index} className="flex items-start gap-2 text-sm">
                                    <span className="text-amber-500 mt-1">•</span>
                                    {reason}
                                  </li>
                                ))}
                              </ul>
                            </CardContent>
                          </Card>
                        )}

                        {metrics.recommendations?.length > 0 && (
                          <Card>
                            <CardHeader>
                              <CardTitle className="flex items-center gap-2 text-lg">
                                <Lightbulb className="h-5 w-5 text-blue-500" />
                                التوصيات
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <ul className="space-y-2">
                                {metrics.recommendations.map((rec, index) => (
                                  <li key={index} className="flex items-start gap-2 text-sm">
                                    <span className="text-blue-500 mt-1">•</span>
                                    {rec}
                                  </li>
                                ))}
                              </ul>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <Card>
                    <CardContent className="p-12 text-center">
                      <FileText className="h-16 w-16 mx-auto text-muted-foreground opacity-50 mb-4" />
                      <h3 className="text-xl font-semibold mb-2">لا توجد بيانات متاحة</h3>
                      <p className="text-muted-foreground mb-4">
                        يرجى إدخال البيانات المالية للفترة المحددة
                      </p>
                      <Button
                        onClick={() => {
                          loadExistingData();
                          setShowDataEntry(true);
                        }}
                      >
                        <Plus className="h-4 w-4 ml-2" />
                        إدخال البيانات
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="details" className="space-y-6">
                {completePnL && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Wallet className="h-5 w-5 text-blue-500" />
                          المبيعات حسب القناة
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {completePnL.sales.length > 0 ? (
                            completePnL.sales.map((sale, index) => (
                              <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                <span>{SALES_CHANNELS.find(c => c.id === sale.channel)?.label || sale.channel}</span>
                                <div className="text-left">
                                  <div className="font-semibold">{formatCurrency(sale.totalAmount)}</div>
                                  <div className="text-xs text-muted-foreground">{sale.invoiceCount} فاتورة</div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-center text-muted-foreground py-4">لا توجد بيانات مبيعات</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <ShoppingCart className="h-5 w-5 text-red-500" />
                          تكاليف المبيعات (COGS)
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {completePnL.cogs.length > 0 ? (
                            completePnL.cogs.map((cog, index) => (
                              <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                <div>
                                  <span>{COGS_CATEGORIES.find(c => c.id === cog.itemType)?.label || cog.itemType}</span>
                                  {cog.notes && <p className="text-xs text-muted-foreground">{cog.notes}</p>}
                                </div>
                                <div className="text-left">
                                  <div className="font-semibold">{formatCurrency(cog.amount)}</div>
                                  {(cog.wasteAmount || 0) > 0 && (
                                    <div className="text-xs text-red-500">هدر: {formatCurrency(cog.wasteAmount || 0)}</div>
                                  )}
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-center text-muted-foreground py-4">لا توجد بيانات تكاليف</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Receipt className="h-5 w-5 text-orange-500" />
                          المصروفات التشغيلية
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {completePnL.operatingExpenses.length > 0 ? (
                            completePnL.operatingExpenses.map((expense, index) => (
                              <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                <div>
                                  <span>{OPERATING_EXPENSE_TYPES.find(e => e.id === expense.expenseType)?.label || expense.expenseType}</span>
                                  {expense.notes && <p className="text-xs text-muted-foreground">{expense.notes}</p>}
                                </div>
                                <div className="font-semibold">{formatCurrency(expense.amount)}</div>
                              </div>
                            ))
                          ) : (
                            <p className="text-center text-muted-foreground py-4">لا توجد مصروفات تشغيلية</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Home className="h-5 w-5 text-purple-500" />
                          التكاليف الثابتة
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {completePnL.fixedCosts.length > 0 ? (
                            completePnL.fixedCosts.map((cost, index) => (
                              <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                <div>
                                  <span>{FIXED_COST_TYPES.find(c => c.id === cost.costType)?.label || cost.costType}</span>
                                  {cost.notes && <p className="text-xs text-muted-foreground">{cost.notes}</p>}
                                </div>
                                <div className="font-semibold">{formatCurrency(cost.amount)}</div>
                              </div>
                            ))
                          ) : (
                            <p className="text-center text-muted-foreground py-4">لا توجد تكاليف ثابتة</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="charts" className="space-y-6">
                {metrics && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>توزيع المبيعات حسب القناة</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {salesByChannelData.length > 0 ? (
                          <ResponsiveContainer width="100%" height={300}>
                            <RePieChart>
                              <Pie
                                data={salesByChannelData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                outerRadius={100}
                                fill="#8884d8"
                                dataKey="value"
                              >
                                {salesByChannelData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(value: number) => formatCurrency(value)} />
                            </RePieChart>
                          </ResponsiveContainer>
                        ) : (
                          <p className="text-center text-muted-foreground py-12">لا توجد بيانات مبيعات</p>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>تحليل التكاليف والأرباح</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={costBreakdownData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" tickFormatter={(v) => formatNumber(v)} />
                            <YAxis type="category" dataKey="name" width={120} />
                            <Tooltip formatter={(value: number) => formatCurrency(value)} />
                            <Bar dataKey="value" fill="#4F46E5">
                              {costBreakdownData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    <Card className="lg:col-span-2">
                      <CardHeader>
                        <CardTitle>قمع الربحية (Profitability Funnel)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={profitabilityData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis tickFormatter={(v) => formatNumber(v)} />
                            <Tooltip formatter={(value: number) => formatCurrency(value)} />
                            <Bar dataKey="value" fill="#4F46E5">
                              {profitabilityData.map((entry, index) => (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={index === 0 ? "#3B82F6" : index === 1 ? "#10B981" : entry.value >= 0 ? "#059669" : "#EF4444"}
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="ranking" className="space-y-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Award className="h-5 w-5 text-amber-500" />
                      ترتيب الفروع - {MONTHS_AR[selectedMonth - 1]} {selectedYear}
                    </CardTitle>
                    <Select value={rankingMetric} onValueChange={(v) => setRankingMetric(v as any)}>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="profit">صافي الربح</SelectItem>
                        <SelectItem value="revenue">الإيرادات</SelectItem>
                        <SelectItem value="margin">هامش الربح %</SelectItem>
                      </SelectContent>
                    </Select>
                  </CardHeader>
                  <CardContent>
                    {loadingRanking ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    ) : branchRanking.length > 0 ? (
                      <div className="space-y-3">
                        {branchRanking.map((branch, index) => (
                          <div
                            key={branch.branchId}
                            className={`flex items-center justify-between p-4 rounded-lg ${
                              index === 0 ? "bg-amber-50 border-2 border-amber-300" :
                              index === 1 ? "bg-gray-100 border border-gray-300" :
                              index === 2 ? "bg-orange-50 border border-orange-300" :
                              "bg-muted/50"
                            }`}
                          >
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                                index === 0 ? "bg-amber-500 text-white" :
                                index === 1 ? "bg-gray-400 text-white" :
                                index === 2 ? "bg-orange-500 text-white" :
                                "bg-muted text-muted-foreground"
                              }`}>
                                {branch.rank}
                              </div>
                              <span className="font-medium">{branch.branchName}</span>
                            </div>
                            <div className="text-left">
                              <div className="font-bold text-lg">
                                {rankingMetric === "margin" ? formatPercent(branch.value) : formatCurrency(branch.value)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-12">
                        لا توجد بيانات متاحة للفترة المحددة
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}

        <Dialog open={showDataEntry} onOpenChange={setShowDataEntry}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                إدخال البيانات المالية
                {selectedBranch && (
                  <Badge variant="outline" className="mr-2">
                    {selectedBranch.name} - {MONTHS_AR[selectedMonth - 1]} {selectedYear}
                  </Badge>
                )}
              </DialogTitle>
            </DialogHeader>

            {/* Summary Bar */}
            <div className="flex gap-4 p-3 bg-muted/50 rounded-lg text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">المبيعات:</span>
                <span className="font-bold text-green-600">
                  {formatCurrency(salesEntries.reduce((sum, e) => sum + (e.totalAmount || 0), 0))}
                </span>
              </div>
              <Separator orientation="vertical" className="h-5" />
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">التكاليف:</span>
                <span className="font-bold text-red-600">
                  {formatCurrency(cogsEntries.reduce((sum, e) => sum + (e.amount || 0), 0))}
                </span>
              </div>
              <Separator orientation="vertical" className="h-5" />
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">المصروفات:</span>
                <span className="font-bold text-orange-600">
                  {formatCurrency(operatingExpensesEntries.reduce((sum, e) => sum + (e.amount || 0), 0))}
                </span>
              </div>
              <Separator orientation="vertical" className="h-5" />
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">الثابتة:</span>
                <span className="font-bold text-blue-600">
                  {formatCurrency(fixedCostsEntries.reduce((sum, e) => sum + (e.amount || 0), 0))}
                </span>
              </div>
            </div>

            <Tabs defaultValue="sales" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="sales" className="flex items-center gap-2" data-testid="tab-data-sales">
                  <Wallet className="h-4 w-4" />
                  المبيعات ({salesEntries.length})
                </TabsTrigger>
                <TabsTrigger value="cogs" className="flex items-center gap-2" data-testid="tab-data-cogs">
                  <ShoppingCart className="h-4 w-4" />
                  التكاليف ({cogsEntries.length})
                </TabsTrigger>
                <TabsTrigger value="opex" className="flex items-center gap-2" data-testid="tab-data-opex">
                  <Receipt className="h-4 w-4" />
                  المصروفات ({operatingExpensesEntries.length})
                </TabsTrigger>
                <TabsTrigger value="fixed" className="flex items-center gap-2" data-testid="tab-data-fixed">
                  <Home className="h-4 w-4" />
                  الثابتة ({fixedCostsEntries.length})
                </TabsTrigger>
              </TabsList>

              <ScrollArea className="h-[50vh] mt-4 pl-4">
                <TabsContent value="sales" className="mt-0">
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="flex items-center justify-between text-base">
                        <div className="flex items-center gap-2">
                          <Wallet className="h-5 w-5 text-green-500" />
                          المبيعات حسب القناة
                        </div>
                        {cashierSummary && cashierSummary.summary.journalsCount > 0 && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => importSalesMutation.mutate(selectedPeriodId!)}
                            disabled={importSalesMutation.isPending}
                          >
                            {importSalesMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin ml-2" />
                            ) : (
                              <Download className="h-4 w-4 ml-2" />
                            )}
                            استيراد من الكاشير
                          </Button>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {salesEntries.map((entry, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 border rounded-lg hover:border-primary/50 transition-colors">
                          <Select
                            value={entry.channel}
                            onValueChange={(v) => {
                              const updated = [...salesEntries];
                              updated[index].channel = v;
                              setSalesEntries(updated);
                            }}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue placeholder="القناة" />
                            </SelectTrigger>
                            <SelectContent>
                              {SALES_CHANNELS.map((c) => (
                                <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            placeholder="المبلغ"
                            value={entry.totalAmount || ""}
                            onChange={(e) => {
                              const updated = [...salesEntries];
                              updated[index].totalAmount = parseFloat(e.target.value) || 0;
                              setSalesEntries(updated);
                            }}
                            className="flex-1"
                          />
                          <Input
                            type="number"
                            placeholder="عدد الفواتير"
                            value={entry.invoiceCount || ""}
                            onChange={(e) => {
                              const updated = [...salesEntries];
                              updated[index].invoiceCount = parseInt(e.target.value) || 0;
                              setSalesEntries(updated);
                            }}
                            className="w-32"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSalesEntries(salesEntries.filter((_, i) => i !== index))}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        onClick={() => setSalesEntries([...salesEntries, { channel: "", totalAmount: 0, invoiceCount: 0 }])}
                        className="w-full"
                      >
                        <Plus className="h-4 w-4 ml-2" />
                        إضافة قناة مبيعات
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="cogs" className="mt-0">
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <ShoppingCart className="h-5 w-5 text-red-500" />
                        تكاليف المبيعات (COGS)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {cogsEntries.map((entry, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 border rounded-lg hover:border-primary/50 transition-colors">
                          <Select
                            value={entry.itemType}
                            onValueChange={(v) => {
                              const updated = [...cogsEntries];
                              updated[index].itemType = v;
                              setCogsEntries(updated);
                            }}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue placeholder="التصنيف" />
                            </SelectTrigger>
                            <SelectContent>
                              {COGS_CATEGORIES.map((c) => (
                                <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            placeholder="الوصف"
                            value={entry.notes}
                            onChange={(e) => {
                              const updated = [...cogsEntries];
                              updated[index].notes = e.target.value;
                              setCogsEntries(updated);
                            }}
                            className="flex-1"
                          />
                          <Input
                            type="number"
                            placeholder="المبلغ"
                            value={entry.amount || ""}
                            onChange={(e) => {
                              const updated = [...cogsEntries];
                              updated[index].amount = parseFloat(e.target.value) || 0;
                              setCogsEntries(updated);
                            }}
                            className="w-32"
                          />
                          <Input
                            type="number"
                            placeholder="الهدر"
                            value={entry.wasteAmount || ""}
                            onChange={(e) => {
                              const updated = [...cogsEntries];
                              updated[index].wasteAmount = parseFloat(e.target.value) || 0;
                              setCogsEntries(updated);
                            }}
                            className="w-28"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setCogsEntries(cogsEntries.filter((_, i) => i !== index))}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        onClick={() => setCogsEntries([...cogsEntries, { itemType: "", notes: "", amount: 0, wasteAmount: 0 }])}
                        className="w-full"
                      >
                        <Plus className="h-4 w-4 ml-2" />
                        إضافة بند تكلفة
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="opex" className="mt-0">
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Receipt className="h-5 w-5 text-orange-500" />
                        المصروفات التشغيلية
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {operatingExpensesEntries.map((entry, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 border rounded-lg hover:border-primary/50 transition-colors">
                          <Select
                            value={entry.expenseType}
                            onValueChange={(v) => {
                              const updated = [...operatingExpensesEntries];
                              updated[index].expenseType = v;
                              setOperatingExpensesEntries(updated);
                            }}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue placeholder="النوع" />
                            </SelectTrigger>
                            <SelectContent>
                              {OPERATING_EXPENSE_TYPES.map((e) => (
                                <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            placeholder="الوصف"
                            value={entry.notes}
                            onChange={(e) => {
                              const updated = [...operatingExpensesEntries];
                              updated[index].notes = e.target.value;
                              setOperatingExpensesEntries(updated);
                            }}
                            className="flex-1"
                          />
                          <Input
                            type="number"
                            placeholder="المبلغ"
                            value={entry.amount || ""}
                            onChange={(e) => {
                              const updated = [...operatingExpensesEntries];
                              updated[index].amount = parseFloat(e.target.value) || 0;
                              setOperatingExpensesEntries(updated);
                            }}
                            className="w-32"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setOperatingExpensesEntries(operatingExpensesEntries.filter((_, i) => i !== index))}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        onClick={() => setOperatingExpensesEntries([...operatingExpensesEntries, { expenseType: "", notes: "", amount: 0 }])}
                        className="w-full"
                      >
                        <Plus className="h-4 w-4 ml-2" />
                        إضافة مصروف تشغيلي
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="fixed" className="mt-0">
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Home className="h-5 w-5 text-blue-500" />
                        التكاليف الثابتة
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {fixedCostsEntries.map((entry, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 border rounded-lg hover:border-primary/50 transition-colors">
                          <Select
                            value={entry.costType}
                            onValueChange={(v) => {
                              const updated = [...fixedCostsEntries];
                              updated[index].costType = v;
                              setFixedCostsEntries(updated);
                            }}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue placeholder="النوع" />
                            </SelectTrigger>
                            <SelectContent>
                              {FIXED_COST_TYPES.map((c) => (
                                <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            placeholder="الوصف"
                            value={entry.notes}
                            onChange={(e) => {
                              const updated = [...fixedCostsEntries];
                              updated[index].notes = e.target.value;
                              setFixedCostsEntries(updated);
                            }}
                            className="flex-1"
                          />
                          <Input
                            type="number"
                            placeholder="المبلغ"
                            value={entry.amount || ""}
                            onChange={(e) => {
                              const updated = [...fixedCostsEntries];
                              updated[index].amount = parseFloat(e.target.value) || 0;
                              setFixedCostsEntries(updated);
                            }}
                            className="w-32"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setFixedCostsEntries(fixedCostsEntries.filter((_, i) => i !== index))}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        onClick={() => setFixedCostsEntries([...fixedCostsEntries, { costType: "", notes: "", amount: 0 }])}
                        className="w-full"
                      >
                        <Plus className="h-4 w-4 ml-2" />
                        إضافة تكلفة ثابتة
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>
              </ScrollArea>
            </Tabs>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setShowDataEntry(false)}>
                إلغاء
              </Button>
              <Button
                onClick={handleSaveAllData}
                disabled={saveSalesMutation.isPending || calculateMetricsMutation.isPending}
              >
                {(saveSalesMutation.isPending || calculateMetricsMutation.isPending) && (
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                )}
                حفظ وحساب المؤشرات
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>
    </Layout>
  );
}
