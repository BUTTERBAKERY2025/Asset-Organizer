import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useBranches } from "@/hooks/useBranches";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { Layout } from "@/components/layout";
import { PageHeader } from "@/components/dashboard/page-header";
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
import { downloadArabicPdf, downloadEnhancedPnLPdf, getArabicDefaultStyle, getArabicTableHeaderStyle } from "@/lib/pdfmake-arabic";

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
              { text: "BUTTER BAKERY SYSTEM", style: "companyName", alignment: "right" },
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
        text: `BUTTER BAKERY SYSTEM - CEO COMMAND | ${new Date().toLocaleDateString("en-GB")}`, 
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

async function exportPnLToExcel(
  branchName: string,
  period: string,
  metrics: any,
  sales: any[],
  cogs: any[],
  opex: any[],
  fixedCosts: any[]
) {
  const XLSX = await import("xlsx");
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

// دالة تصدير التقرير المحسن من البيانات الفعلية (enhanced-summary)
async function exportEnhancedPnLToExcel(
  branchName: string,
  period: string,
  enhancedData: any
) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const totals = enhancedData.totals;
  
  // ورقة الملخص الرئيسي
  const summaryData = [
    ["تقرير الأرباح والخسائر المحسن"],
    [`الفرع: ${branchName}`],
    [`الفترة: ${period}`],
    [`تاريخ التقرير: ${new Date().toLocaleDateString('ar-SA')}`],
    [""],
    ["المؤشر", "القيمة", "النسبة", "الملاحظات"],
    ["إجمالي المبيعات (شامل الضريبة)", totals.grossSales || 0, "", `${totals.journalCount || 0} يومية صندوق`],
    ["ضريبة القيمة المضافة (15%)", totals.vatAmount || 0, "15%", "محتسبة تلقائياً"],
    ["صافي المبيعات (بدون الضريبة)", totals.netSales || 0, "", ""],
    [""],
    ["تكلفة البضاعة المباعة (COGS)", totals.cogsCost || 0, totals.netSales > 0 ? `${((totals.cogsCost / totals.netSales) * 100).toFixed(1)}%` : "0%", ""],
    ["إجمالي الربح", totals.grossProfit || 0, `${(totals.grossMargin || 0).toFixed(1)}%`, ""],
    [""],
    ["تكاليف الموظفين", "", "", `${totals.employeeCount || 0} موظف`],
    ["  - الرواتب والبدلات", totals.employeeCosts?.salaries || 0, "", ""],
    ["  - التأمينات الاجتماعية (GOSI)", totals.employeeCosts?.gosi || 0, "12%", "للسعوديين"],
    ["  - رسوم غير السعوديين", totals.employeeCosts?.nonSaudiCosts || 0, "", "المقابل المالي (شامل رخصة العمل) + إقامة + تأمين 2%"],
    ["  - إجمالي تكاليف الموظفين", totals.employeeCosts?.total || 0, totals.netSales > 0 ? `${((totals.employeeCosts?.total / totals.netSales) * 100).toFixed(1)}%` : "0%", ""],
    [""],
    ["المصروفات الثابتة والمرافق", "", "", ""],
    ["  - الإيجار", totals.rent || 0, totals.netSales > 0 ? `${((totals.rent / totals.netSales) * 100).toFixed(1)}%` : "0%", ""],
    ["  - الكهرباء", totals.utilities?.electricity || 0, "", ""],
    ["  - المياه", totals.utilities?.water || 0, "", ""],
    ["  - مرافق أخرى", totals.utilities?.other || 0, "", ""],
    ["  - إجمالي المرافق", totals.utilities?.total || 0, "", ""],
    [""],
    ["تكاليف التشغيل الأخرى", "", "", ""],
    ["  - الصيانة", totals.operatingCosts?.maintenance || 0, "", ""],
    ["  - التسويق", totals.operatingCosts?.marketing || 0, "", ""],
    ["  - المستلزمات", totals.operatingCosts?.supplies || 0, "", ""],
    ["  - تكاليف أخرى", totals.operatingCosts?.other || 0, "", ""],
    [""],
    ["إجمالي تكاليف التشغيل", totals.totalOperatingCosts || 0, "", ""],
    [""],
    ["الربح التشغيلي", totals.operatingProfit || 0, totals.netSales > 0 ? `${((totals.operatingProfit / totals.netSales) * 100).toFixed(1)}%` : "0%", ""],
    ["صافي الربح", totals.netProfit || 0, `${(totals.netMargin || 0).toFixed(1)}%`, ""],
    [""],
    ["المؤشرات الإضافية", "", "", ""],
    ["  - نقطة التعادل", totals.rent && totals.utilities?.total && totals.grossMargin > 0 ? ((totals.rent + totals.utilities.total) / (totals.grossMargin / 100)).toFixed(0) : 0, "", "المبيعات اللازمة لتغطية التكاليف الثابتة"],
    ["  - الإيراد لكل موظف", totals.employeeCount > 0 ? (totals.grossSales / totals.employeeCount).toFixed(0) : 0, "", ""],
  ];
  
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary["!cols"] = [{ wch: 35 }, { wch: 20 }, { wch: 15 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "التقرير الشامل");
  
  // ورقة تفاصيل الفروع (إذا كان هناك أكثر من فرع)
  if (enhancedData.branches && enhancedData.branches.length > 0) {
    const branchesData = [
      ["مقارنة أداء الفروع"],
      [""],
      ["الفرع", "المبيعات", "صافي الربح", "الهامش %", "الموظفين", "الإيجار", "المرافق"],
      ...enhancedData.branches.map((b: any) => [
        b.branchName,
        b.grossSales || 0,
        b.netProfit || 0,
        `${(b.netMargin || 0).toFixed(1)}%`,
        b.employeeCount || 0,
        b.rent || 0,
        b.utilities?.total || 0
      ])
    ];
    
    const wsBranches = XLSX.utils.aoa_to_sheet(branchesData);
    wsBranches["!cols"] = [{ wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsBranches, "مقارنة الفروع");
  }
  
  // ورقة التحليل المالي - مع حماية من القسمة على صفر
  const salaryRatio = (totals.netSales || 0) > 0 ? ((totals.employeeCosts?.total || 0) / totals.netSales) * 100 : 0;
  const rentRatio = (totals.netSales || 0) > 0 ? ((totals.rent || 0) / totals.netSales) * 100 : 0;
  const cogsRatio = (totals.netSales || 0) > 0 ? ((totals.cogsCost || 0) / totals.netSales) * 100 : 0;
  
  const analysisData = [
    ["التحليل المالي"],
    [""],
    ["نسب الربحية", "", ""],
    ["هامش إجمالي الربح", `${(totals.grossMargin || 0).toFixed(2)}%`, totals.grossMargin >= 30 ? "ممتاز" : totals.grossMargin >= 20 ? "جيد" : "يحتاج تحسين"],
    ["هامش صافي الربح", `${(totals.netMargin || 0).toFixed(2)}%`, totals.netMargin >= 15 ? "ممتاز" : totals.netMargin >= 10 ? "جيد" : totals.netMargin >= 5 ? "متوسط" : "ضعيف"],
    [""],
    ["نسب التكاليف", "", ""],
    ["نسبة الرواتب للمبيعات", `${salaryRatio.toFixed(2)}%`, salaryRatio <= 25 ? "ممتاز" : salaryRatio <= 35 ? "مقبول" : "مرتفعة"],
    ["نسبة الإيجار للإيرادات", `${rentRatio.toFixed(2)}%`, rentRatio <= 10 ? "ممتاز" : rentRatio <= 15 ? "مقبول" : "مرتفعة"],
    ["نسبة COGS", `${cogsRatio.toFixed(2)}%`, cogsRatio <= 40 ? "ممتاز" : cogsRatio <= 50 ? "مقبول" : "مرتفعة"],
    [""],
    ["مؤشرات الإنتاجية", "", ""],
    ["عدد الموظفين", totals.employeeCount || 0, ""],
    ["الإيراد لكل موظف", (totals.employeeCount || 0) > 0 ? `${((totals.grossSales || 0) / totals.employeeCount).toFixed(0)} ريال` : "0", ""],
    ["عدد اليوميات", totals.journalCount || 0, ""],
  ];
  
  const wsAnalysis = XLSX.utils.aoa_to_sheet(analysisData);
  wsAnalysis["!cols"] = [{ wch: 30 }, { wch: 20 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsAnalysis, "التحليل المالي");
  
  XLSX.writeFile(wb, `تقرير_PnL_المحسن_${branchName}_${period}.xlsx`);
}

// دالة تصدير PDF المحسن
function generateEnhancedPnLPdfReport(
  branchName: string,
  period: string,
  enhancedData: any
) {
  const totals = enhancedData.totals;
  const getRatingLabel = (margin: number) => {
    if (margin >= 15) return "ممتاز";
    if (margin >= 10) return "جيد";
    if (margin >= 5) return "متوسط";
    return "ضعيف";
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
              { text: "شركة الزبد الأفضل التجارية", style: "companyName", alignment: "right" },
              { text: "Best Butter Trading Co.", style: "companyNameEn", alignment: "right" },
              { text: "سجل تجاري: 7026155296", style: "subText", alignment: "right" },
            ],
          },
          {
            width: "auto",
            stack: [
              { text: "تقرير الأرباح والخسائر", style: "reportTitle", alignment: "left" },
              { text: `الفرع: ${branchName}`, alignment: "left" },
              { text: `الفترة: ${period}`, alignment: "left" },
              { text: `تاريخ التقرير: ${new Date().toLocaleDateString('ar-SA')}`, alignment: "left", style: "subText" },
            ],
          },
        ],
      },
      { canvas: [{ type: "line", x1: 0, y1: 10, x2: 515, y2: 10, lineWidth: 2, lineColor: "#D4AF37" }] },
      { text: "", margin: [0, 15, 0, 0] },
      
      // ملخص الأداء
      { text: "ملخص الأداء المالي", style: "sectionHeader" },
      {
        table: {
          widths: ["*", "*", "*", "*"],
          body: [
            [
              { text: "التقييم", style: "tableHeader" },
              { text: "صافي الربح", style: "tableHeader" },
              { text: "صافي المبيعات", style: "tableHeader" },
              { text: "إجمالي المبيعات", style: "tableHeader" },
            ],
            [
              { text: getRatingLabel(totals.netMargin || 0), alignment: "center", fillColor: totals.netMargin >= 15 ? '#d4edda' : totals.netMargin >= 10 ? '#cce5ff' : totals.netMargin >= 5 ? '#fff3cd' : '#f8d7da' },
              { text: formatCurrency(totals.netProfit || 0), alignment: "center", color: totals.netProfit >= 0 ? '#28a745' : '#dc3545' },
              { text: formatCurrency(totals.netSales || 0), alignment: "center" },
              { text: formatCurrency(totals.grossSales || 0), alignment: "center" },
            ],
          ],
        },
        margin: [0, 10, 0, 15],
      },
      
      // تفاصيل الإيرادات
      { text: "تفاصيل الإيرادات", style: "sectionHeader" },
      {
        table: {
          widths: ["*", "*"],
          body: [
            [{ text: "القيمة", style: "tableHeader" }, { text: "البند", style: "tableHeader" }],
            [{ text: formatCurrency(totals.grossSales || 0), alignment: "center" }, { text: "إجمالي المبيعات (شامل الضريبة)", alignment: "right" }],
            [{ text: `- ${formatCurrency(totals.vatAmount || 0)}`, alignment: "center", color: "#dc3545" }, { text: "ضريبة القيمة المضافة (15%)", alignment: "right" }],
            [{ text: formatCurrency(totals.netSales || 0), alignment: "center", bold: true }, { text: "صافي المبيعات", alignment: "right", bold: true }],
          ],
        },
        margin: [0, 10, 0, 15],
      },
      
      // تكاليف الموظفين
      { text: `تكاليف الموظفين (${totals.employeeCount || 0} موظف)`, style: "sectionHeader" },
      {
        table: {
          widths: ["*", "*"],
          body: [
            [{ text: "القيمة", style: "tableHeader" }, { text: "البند", style: "tableHeader" }],
            [{ text: formatCurrency(totals.employeeCosts?.salaries || 0), alignment: "center" }, { text: "الرواتب والبدلات", alignment: "right" }],
            [{ text: formatCurrency(totals.employeeCosts?.gosi || 0), alignment: "center" }, { text: "التأمينات الاجتماعية (GOSI) - 12%", alignment: "right" }],
            [{ text: formatCurrency(totals.employeeCosts?.nonSaudiCosts || 0), alignment: "center" }, { text: "رسوم غير السعوديين", alignment: "right" }],
            [{ text: formatCurrency(totals.employeeCosts?.total || 0), alignment: "center", bold: true, color: "#dc3545" }, { text: "إجمالي تكاليف الموظفين", alignment: "right", bold: true }],
          ],
        },
        margin: [0, 10, 0, 15],
      },
      
      // المصروفات الثابتة
      { text: "المصروفات الثابتة والمرافق", style: "sectionHeader" },
      {
        table: {
          widths: ["*", "*"],
          body: [
            [{ text: "القيمة", style: "tableHeader" }, { text: "البند", style: "tableHeader" }],
            [{ text: formatCurrency(totals.rent || 0), alignment: "center" }, { text: "الإيجار الشهري", alignment: "right" }],
            [{ text: formatCurrency(totals.utilities?.electricity || 0), alignment: "center" }, { text: "الكهرباء", alignment: "right" }],
            [{ text: formatCurrency(totals.utilities?.water || 0), alignment: "center" }, { text: "المياه", alignment: "right" }],
            [{ text: formatCurrency(totals.utilities?.other || 0), alignment: "center" }, { text: "مرافق أخرى", alignment: "right" }],
            [{ text: formatCurrency((totals.rent || 0) + (totals.utilities?.total || 0)), alignment: "center", bold: true, color: "#fd7e14" }, { text: "الإجمالي", alignment: "right", bold: true }],
          ],
        },
        margin: [0, 10, 0, 15],
      },
      
      // تكاليف التشغيل
      { text: "تكاليف التشغيل", style: "sectionHeader" },
      {
        table: {
          widths: ["*", "*"],
          body: [
            [{ text: "القيمة", style: "tableHeader" }, { text: "البند", style: "tableHeader" }],
            [{ text: formatCurrency(totals.cogsCost || 0), alignment: "center" }, { text: "تكلفة البضاعة المباعة (COGS)", alignment: "right" }],
            [{ text: formatCurrency(totals.operatingCosts?.maintenance || 0), alignment: "center" }, { text: "الصيانة", alignment: "right" }],
            [{ text: formatCurrency(totals.operatingCosts?.marketing || 0), alignment: "center" }, { text: "التسويق", alignment: "right" }],
            [{ text: formatCurrency((totals.operatingCosts?.supplies || 0) + (totals.operatingCosts?.other || 0)), alignment: "center" }, { text: "مستلزمات وأخرى", alignment: "right" }],
            [{ text: formatCurrency(totals.totalOperatingCosts || 0), alignment: "center", bold: true, color: "#6f42c1" }, { text: "إجمالي تكاليف التشغيل (بدون COGS)", alignment: "right", bold: true }],
          ],
        },
        margin: [0, 10, 0, 15],
      },
      
      // صافي النتائج
      { text: "صافي النتائج", style: "sectionHeader" },
      {
        table: {
          widths: ["*", "*", "*"],
          body: [
            [{ text: "النسبة", style: "tableHeader" }, { text: "القيمة", style: "tableHeader" }, { text: "البند", style: "tableHeader" }],
            [{ text: formatPercent(totals.grossMargin || 0), alignment: "center" }, { text: formatCurrency(totals.grossProfit || 0), alignment: "center" }, { text: "إجمالي الربح", alignment: "right" }],
            [{ text: totals.netSales > 0 ? formatPercent((totals.operatingProfit / totals.netSales) * 100) : "0%", alignment: "center" }, { text: formatCurrency(totals.operatingProfit || 0), alignment: "center" }, { text: "الربح التشغيلي", alignment: "right" }],
            [{ text: formatPercent(totals.netMargin || 0), alignment: "center", bold: true }, { text: formatCurrency(totals.netProfit || 0), alignment: "center", bold: true, color: totals.netProfit >= 0 ? '#28a745' : '#dc3545' }, { text: "صافي الربح", alignment: "right", bold: true }],
          ],
        },
        margin: [0, 10, 0, 15],
      },
    ],
    styles: {
      companyName: { fontSize: 14, bold: true, color: "#D4AF37" },
      companyNameEn: { fontSize: 10, color: "#666" },
      subText: { fontSize: 8, color: "#888" },
      reportTitle: { fontSize: 16, bold: true },
      sectionHeader: { fontSize: 12, bold: true, margin: [0, 10, 0, 5], fillColor: "#f8f9fa" },
      tableHeader: { bold: true, fontSize: 9, fillColor: "#f3f4f6", alignment: "center" as const },
    },
  };
  
  return docDefinition;
}

async function generatePnLExcelTemplate() {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  // Sales Sheet
  const salesHeaders = [
    ["بيانات المبيعات - P&L Template"],
    [""],
    ["القناة", "المبلغ", "عدد الفواتير"],
    ["نقدي", "", ""],
    ["بطاقة", "", ""],
    ["تطبيقات التوصيل", "", ""],
    ["عملاء شركات", "", ""],
  ];
  const wsSales = XLSX.utils.aoa_to_sheet(salesHeaders);
  wsSales["!cols"] = [{ wch: 25 }, { wch: 20 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, wsSales, "المبيعات");

  // COGS Sheet
  const cogsHeaders = [
    ["تكلفة البضاعة المباعة - P&L Template"],
    [""],
    ["البند", "المبلغ", "الهدر"],
    ["مواد خام", "", ""],
    ["تكاليف إنتاج", "", ""],
    ["تغليف", "", ""],
    ["هدر", "", ""],
  ];
  const wsCogs = XLSX.utils.aoa_to_sheet(cogsHeaders);
  wsCogs["!cols"] = [{ wch: 25 }, { wch: 20 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, wsCogs, "تكاليف المبيعات");

  // Operating Expenses Sheet
  const opexHeaders = [
    ["المصروفات التشغيلية - P&L Template"],
    [""],
    ["البند", "المبلغ"],
    ["رواتب وأجور", ""],
    ["مرافق (كهرباء، ماء)", ""],
    ["صيانة", ""],
    ["تسويق", ""],
    ["مستلزمات", ""],
    ["أخرى", ""],
  ];
  const wsOpex = XLSX.utils.aoa_to_sheet(opexHeaders);
  wsOpex["!cols"] = [{ wch: 25 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsOpex, "المصروفات التشغيلية");

  // Fixed Costs Sheet
  const fixedHeaders = [
    ["التكاليف الثابتة - P&L Template"],
    [""],
    ["البند", "المبلغ"],
    ["إيجار", ""],
    ["رخص وتصاريح", ""],
    ["تأمين", ""],
    ["ضرائب", ""],
    ["إهلاك", ""],
  ];
  const wsFixed = XLSX.utils.aoa_to_sheet(fixedHeaders);
  wsFixed["!cols"] = [{ wch: 25 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsFixed, "التكاليف الثابتة");

  // Instructions Sheet
  const instructions = [
    ["تعليمات استخدام قالب P&L"],
    [""],
    ["1. قم بتعبئة البيانات في كل ورقة حسب الفئة"],
    ["2. أدخل المبالغ بالأرقام فقط (بدون ريال أو فواصل)"],
    ["3. لا تقم بتغيير أسماء الأوراق أو الأعمدة"],
    ["4. بعد الانتهاء، احفظ الملف وارفعه في النظام"],
    [""],
    ["ملاحظات:"],
    ["- المبيعات: أدخل إجمالي المبيعات لكل قناة مع عدد الفواتير"],
    ["- تكاليف المبيعات: أدخل تكاليف المواد والإنتاج مع قيمة الهدر"],
    ["- المصروفات التشغيلية: أدخل المصروفات المتغيرة"],
    ["- التكاليف الثابتة: أدخل التكاليف الثابتة الشهرية"],
  ];
  const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);
  wsInstructions["!cols"] = [{ wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsInstructions, "تعليمات");

  XLSX.writeFile(wb, "قالب_بيانات_PnL.xlsx");
}

interface ParseResult {
  sales: Array<{ channel: string; totalAmount: number; invoiceCount: number }>;
  cogs: Array<{ itemType: string; amount: number; wasteAmount: number }>;
  operatingExpenses: Array<{ expenseType: string; amount: number }>;
  fixedCosts: Array<{ costType: string; amount: number }>;
  unmappedLabels: { sheet: string; labels: string[] }[];
}

async function parseExcelPnLData(workbook: any): Promise<ParseResult> {
  const XLSX = await import("xlsx");
  const channelMap: Record<string, string> = {
    "نقدي": "cash",
    "بطاقة": "card",
    "تطبيقات التوصيل": "delivery_apps",
    "عملاء شركات": "corporate",
  };
  const cogsMap: Record<string, string> = {
    "مواد خام": "raw_materials",
    "تكاليف إنتاج": "production",
    "تغليف": "packaging",
    "هدر": "waste",
  };
  const opexMap: Record<string, string> = {
    "رواتب وأجور": "salaries",
    "مرافق (كهرباء، ماء)": "utilities",
    "صيانة": "maintenance",
    "تسويق": "marketing",
    "مستلزمات": "supplies",
    "أخرى": "other",
  };
  const fixedMap: Record<string, string> = {
    "إيجار": "rent",
    "رخص وتصاريح": "licenses",
    "تأمين": "insurance",
    "ضرائب": "taxes",
    "إهلاك": "depreciation",
  };

  const sales: Array<{ channel: string; totalAmount: number; invoiceCount: number }> = [];
  const cogs: Array<{ itemType: string; amount: number; wasteAmount: number }> = [];
  const operatingExpenses: Array<{ expenseType: string; amount: number }> = [];
  const fixedCosts: Array<{ costType: string; amount: number }> = [];
  const unmappedLabels: { sheet: string; labels: string[] }[] = [];

  // Parse Sales
  const salesSheet = workbook.Sheets["المبيعات"];
  if (salesSheet) {
    const data = XLSX.utils.sheet_to_json<any>(salesSheet, { range: 2 });
    const unmapped: string[] = [];
    data.forEach((row: any) => {
      const label = row["القناة"];
      if (!label) return;
      const channel = channelMap[label];
      if (channel) {
        const amount = parseFloat(row["المبلغ"]) || 0;
        const count = parseInt(row["عدد الفواتير"]) || 0;
        if (amount > 0) {
          sales.push({ channel, totalAmount: amount, invoiceCount: count });
        }
      } else {
        const amount = parseFloat(row["المبلغ"]) || 0;
        if (amount > 0) {
          unmapped.push(label);
        }
      }
    });
    if (unmapped.length > 0) {
      unmappedLabels.push({ sheet: "المبيعات", labels: unmapped });
    }
  }

  // Parse COGS
  const cogsSheet = workbook.Sheets["تكاليف المبيعات"];
  if (cogsSheet) {
    const data = XLSX.utils.sheet_to_json<any>(cogsSheet, { range: 2 });
    const unmapped: string[] = [];
    data.forEach((row: any) => {
      const label = row["البند"];
      if (!label) return;
      const itemType = cogsMap[label];
      if (itemType) {
        const amount = parseFloat(row["المبلغ"]) || 0;
        const waste = parseFloat(row["الهدر"]) || 0;
        if (amount > 0 || waste > 0) {
          cogs.push({ itemType, amount, wasteAmount: waste });
        }
      } else {
        const amount = parseFloat(row["المبلغ"]) || 0;
        const waste = parseFloat(row["الهدر"]) || 0;
        if (amount > 0 || waste > 0) {
          unmapped.push(label);
        }
      }
    });
    if (unmapped.length > 0) {
      unmappedLabels.push({ sheet: "تكاليف المبيعات", labels: unmapped });
    }
  }

  // Parse Operating Expenses
  const opexSheet = workbook.Sheets["المصروفات التشغيلية"];
  if (opexSheet) {
    const data = XLSX.utils.sheet_to_json<any>(opexSheet, { range: 2 });
    const unmapped: string[] = [];
    data.forEach((row: any) => {
      const label = row["البند"];
      if (!label) return;
      const expenseType = opexMap[label];
      if (expenseType) {
        const amount = parseFloat(row["المبلغ"]) || 0;
        if (amount > 0) {
          operatingExpenses.push({ expenseType, amount });
        }
      } else {
        const amount = parseFloat(row["المبلغ"]) || 0;
        if (amount > 0) {
          unmapped.push(label);
        }
      }
    });
    if (unmapped.length > 0) {
      unmappedLabels.push({ sheet: "المصروفات التشغيلية", labels: unmapped });
    }
  }

  // Parse Fixed Costs
  const fixedSheet = workbook.Sheets["التكاليف الثابتة"];
  if (fixedSheet) {
    const data = XLSX.utils.sheet_to_json<any>(fixedSheet, { range: 2 });
    const unmapped: string[] = [];
    data.forEach((row: any) => {
      const label = row["البند"];
      if (!label) return;
      const costType = fixedMap[label];
      if (costType) {
        const amount = parseFloat(row["المبلغ"]) || 0;
        if (amount > 0) {
          fixedCosts.push({ costType, amount });
        }
      } else {
        const amount = parseFloat(row["المبلغ"]) || 0;
        if (amount > 0) {
          unmapped.push(label);
        }
      }
    });
    if (unmapped.length > 0) {
      unmappedLabels.push({ sheet: "التكاليف الثابتة", labels: unmapped });
    }
  }

  return { sales, cogs, operatingExpenses, fixedCosts, unmappedLabels };
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

// =============================================================================
// ModernOverview — exactflow-inspired overview tab
// =============================================================================
// Rich KPI cards with MoM deltas, daily revenue chart, expense distribution
// donut, branch ranking, and per-employee payroll breakdown. All data comes
// straight from /api/pnl/enhanced-summary so the numbers always agree with
// the rest of the dashboard.
type ModernOverviewProps = {
  metrics: any;
  totals: any;
  branches: any[];
  selectedYear: number;
  selectedMonth: number;
  monthLabel: string;
};

function DeltaBadge({ value, invert = false }: { value: number; invert?: boolean }) {
  const positive = invert ? value < 0 : value > 0;
  const negative = invert ? value > 0 : value < 0;
  const Icon = value > 0 ? ArrowUp : value < 0 ? ArrowDown : Minus;
  const color = positive ? 'text-emerald-200 bg-emerald-500/20' : negative ? 'text-rose-200 bg-rose-500/20' : 'text-white/80 bg-white/10';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>
      <Icon className="h-3 w-3" />
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function HeroKpiCard({
  title, value, subtitle, delta, icon: Icon, tone = 'violet', kind = 'neutral', deltaInvert = false,
}: {
  title: string; value: string; subtitle?: string;
  delta?: number; icon: any;
  tone?: 'violet' | 'emerald' | 'amber' | 'rose' | 'sky';
  /**
   * kind:
   *  - 'income'  → الأرقام بلون أخضر (إيرادات/ربح)
   *  - 'expense' → الأرقام بلون أحمر/كهرماني حسب الشدة (مصروفات/خسارة)
   *  - 'metric'  → اللون يتبع الـ tone (مؤشرات نسبية)
   *  - 'neutral' → نص أسود عادي
   */
  kind?: 'income' | 'expense' | 'metric' | 'neutral';
  deltaInvert?: boolean;
}) {
  const toneStyles: Record<string, { iconBg: string; iconText: string; ring: string; valueText: string }> = {
    violet:  { iconBg: 'bg-violet-100',  iconText: 'text-violet-600',  ring: 'ring-violet-100',  valueText: 'text-violet-700' },
    emerald: { iconBg: 'bg-emerald-100', iconText: 'text-emerald-600', ring: 'ring-emerald-100', valueText: 'text-emerald-700' },
    amber:   { iconBg: 'bg-amber-100',   iconText: 'text-amber-600',   ring: 'ring-amber-100',   valueText: 'text-amber-700' },
    rose:    { iconBg: 'bg-rose-100',    iconText: 'text-rose-600',    ring: 'ring-rose-100',    valueText: 'text-rose-700' },
    sky:     { iconBg: 'bg-sky-100',     iconText: 'text-sky-600',     ring: 'ring-sky-100',     valueText: 'text-sky-700' },
  };
  const t = toneStyles[tone];
  // لون الرقم يعكس طبيعته المالية (إيراد/مصروف)
  const valueColor =
    kind === 'income'  ? 'text-emerald-700' :
    kind === 'expense' ? 'text-rose-700' :
    kind === 'metric'  ? t.valueText :
                         'text-foreground';
  return (
    <Card className="border border-border/60 bg-card shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${t.iconBg} ring-4 ${t.ring}`}>
            <Icon className={`h-5 w-5 ${t.iconText}`} />
          </div>
          {typeof delta === 'number' && <DeltaBadge value={delta} invert={deltaInvert} />}
        </div>
        <div className="mt-3">
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <p className={`mt-1 text-xl font-bold tracking-tight sm:text-2xl ${valueColor}`} dir="ltr">{value}</p>
          {subtitle && <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function RatingBar({ value, max = 100, label, color }: { value: number; max?: number; label: string; color: string }) {
  const pct = Math.min(100, (Math.abs(value) / max) * 100);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <span className="font-bold text-muted-foreground" dir="ltr">{value.toFixed(1)}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ModernOverview({ metrics, totals, branches, selectedYear, selectedMonth, monthLabel }: ModernOverviewProps) {
  const dailySeries: any[] = totals.dailySeries || [];
  const employeesList: any[] = totals.employeesList || [];
  const ratios = totals.ratios || {};
  const prev = totals.previousMonth || {};

  // Expense distribution for the donut chart
  const expenseSlices = useMemo(() => ([
    { name: 'تكاليف الموظفين', value: totals.employeeCosts?.total || 0, color: '#6366F1' },
    { name: 'تكلفة البضاعة', value: totals.cogsCost || 0, color: '#10B981' },
    { name: 'إيجار', value: totals.rent || 0, color: '#F59E0B' },
    { name: 'مرافق', value: totals.utilities?.total || 0, color: '#EF4444' },
    { name: 'صيانة', value: totals.operatingCosts?.maintenance || 0, color: '#8B5CF6' },
    { name: 'تسويق', value: totals.operatingCosts?.marketing || 0, color: '#EC4899' },
    { name: 'مستلزمات', value: totals.operatingCosts?.supplies || 0, color: '#14B8A6' },
    { name: 'أخرى', value: totals.operatingCosts?.other || 0, color: '#64748B' },
  ].filter(s => s.value > 0)), [totals]);

  const branchRanking = useMemo(() => {
    return [...(branches || [])]
      .map((b: any) => ({
        ...b,
        salaryRatio: b.ratios?.salaryToSales ?? (b.netSales > 0 ? ((b.employeeCosts?.total || 0) / b.netSales) * 100 : 0),
      }))
      .sort((a: any, b: any) => (b.netProfit || 0) - (a.netProfit || 0));
  }, [branches]);

  const maxBranchRevenue = Math.max(1, ...branchRanking.map((b: any) => b.netSales || 0));
  const totalPayrollCost = employeesList.reduce((s: number, e: any) => s + e.totalCost, 0) || 1;

  const profitTone: 'emerald' | 'rose' = (totals.netProfit || 0) >= 0 ? 'emerald' : 'rose';
  const salaryRatio = ratios.salaryToSales || 0;
  const salaryTone: 'emerald' | 'amber' | 'rose' = salaryRatio <= 25 ? 'emerald'
    : salaryRatio <= 35 ? 'amber'
    : 'rose';

  return (
    <div className="space-y-6">
      {/* Hero strip — light, ExactFlow style */}
      <div className="rounded-2xl border border-violet-100 bg-gradient-to-l from-violet-50 via-white to-amber-50 p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-violet-700">لوحة الأرباح والخسائر</p>
              <h2 className="mt-0.5 text-lg font-bold text-foreground">{monthLabel} {selectedYear}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {totals.branchName || 'جميع الفروع'} • {totals.journalCount || 0} يومية معتمدة • {totals.employeeCount || 0} موظف نشط
              </p>
            </div>
          </div>
          <div className="flex items-baseline gap-3 md:border-r md:border-violet-100 md:pr-4">
            <div className="text-right">
              <p className="text-[11px] text-muted-foreground">صافي المبيعات (بعد خصم الضريبة)</p>
              <p className="text-2xl font-bold tracking-tight text-foreground" dir="ltr">{formatCurrency(totals.netSales || 0)}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground" dir="ltr">
                إجمالي شامل الضريبة: {formatCurrency(totals.grossSales || 0)}
              </p>
            </div>
            {typeof prev.revenueChangePct === 'number' && <DeltaBadge value={prev.revenueChangePct} />}
          </div>
        </div>
      </div>

      {/* Hero KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <HeroKpiCard
          title="صافي المبيعات"
          value={formatCurrency(totals.netSales || 0)}
          subtitle={`بعد خصم ضريبة ${formatCurrency(totals.vatAmount || 0)}`}
          delta={prev.revenueChangePct}
          icon={DollarSign}
          tone="violet"
          kind="income"
        />
        <HeroKpiCard
          title="صافي الربح"
          value={formatCurrency(totals.netProfit || 0)}
          subtitle={`هامش ${formatPercent(totals.netMargin || 0)}`}
          delta={prev.profitChangePct}
          icon={TrendingUp}
          tone={profitTone}
          kind={(totals.netProfit || 0) >= 0 ? 'income' : 'expense'}
        />
        <HeroKpiCard
          title="نسبة الرواتب للمبيعات"
          value={`${(salaryRatio).toFixed(1)}%`}
          subtitle={`${formatCurrency(totals.employeeCosts?.total || 0)} تكلفة شهرية`}
          icon={Users}
          tone={salaryTone}
          kind="metric"
          deltaInvert
        />
        <HeroKpiCard
          title="إجمالي المصروفات"
          value={formatCurrency(totals.totalOperatingCosts || 0)}
          subtitle={`${formatPercent(ratios.opexToSales || 0)} من المبيعات`}
          icon={Wallet}
          tone="amber"
          kind="expense"
        />
      </div>

      {/* Daily revenue + total revenue card */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-base font-bold">حركة الإيرادات اليومية</CardTitle>
              <CardDescription className="text-xs">صافي المبيعات والضريبة لكل يوم خلال {monthLabel}</CardDescription>
            </div>
            <Badge variant="outline" className="font-mono text-xs">
              متوسط يومي (صافي): {formatCurrency((totals.netSales || 0) / Math.max(1, dailySeries.filter(d => d.gross > 0).length))}
            </Badge>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={dailySeries}>
                <defs>
                  <linearGradient id="netRevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366F1" stopOpacity={0.85} />
                    <stop offset="100%" stopColor="#6366F1" stopOpacity={0.35} />
                  </linearGradient>
                  <linearGradient id="vatGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.85} />
                    <stop offset="100%" stopColor="#F59E0B" stopOpacity={0.35} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `${Math.round(v / 1000)}k` : v} />
                <Tooltip
                  formatter={(v: any, name: string) => [formatCurrency(Number(v)), name]}
                  labelFormatter={(l) => `اليوم ${l}`}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', direction: 'rtl' }}
                />
                <Legend />
                <Bar dataKey="net" name="صافي المبيعات" stackId="rev" fill="url(#netRevGrad)" radius={[0, 0, 4, 4]} />
                <Bar dataKey="vat" name="الضريبة" stackId="rev" fill="url(#vatGrad)" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="gross" name="الإجمالي" stroke="#0EA5E9" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold">مؤشرات الكفاءة</CardTitle>
            <CardDescription className="text-xs">نسب المصروفات الرئيسية من المبيعات</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <RatingBar label="الرواتب / المبيعات" value={ratios.salaryToSales || 0} max={50} color="bg-gradient-to-l from-indigo-500 to-purple-500" />
            <RatingBar label="الإيجار / المبيعات" value={ratios.rentToSales || 0} max={25} color="bg-gradient-to-l from-amber-500 to-orange-500" />
            <RatingBar label="تكلفة البضاعة / المبيعات" value={ratios.cogsToSales || 0} max={60} color="bg-gradient-to-l from-emerald-500 to-teal-500" />
            <RatingBar label="المرافق / المبيعات" value={ratios.utilitiesToSales || 0} max={20} color="bg-gradient-to-l from-rose-500 to-red-500" />
            <RatingBar label="إجمالي التشغيل / المبيعات" value={ratios.opexToSales || 0} max={100} color="bg-gradient-to-l from-slate-600 to-slate-800" />
            <div className="mt-4 rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-xs text-muted-foreground">هامش الربح الصافي</p>
              <p className={`text-2xl font-bold ${(totals.netMargin || 0) >= 20 ? 'text-emerald-600' : (totals.netMargin || 0) >= 10 ? 'text-amber-600' : 'text-rose-600'}`}>
                {formatPercent(totals.netMargin || 0)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Salary-to-sales detailed breakdown — every payroll component as its
          own ratio of net sales, plus the combined total. Lets management see
          exactly which portion of payroll is eating margin. */}
      {(() => {
        const ns = totals.netSales || 0;
        const ec = totals.employeeCosts || {};
        const salaries = ec.salaries || 0;
        const gosi = ec.gosi || 0;
        const nonSaudi = ec.nonSaudiCosts || 0;
        const total = ec.total || (salaries + gosi + nonSaudi);
        const pct = (v: number) => ns > 0 ? (v / ns) * 100 : 0;
        const row = (
          label: string,
          amount: number,
          color: string,
          barColor: string,
          testId: string,
          hint?: string,
        ) => {
          const p = pct(amount);
          return (
            <div className="rounded-lg border bg-white p-3" data-testid={testId}>
              <div className="flex items-center justify-between mb-1">
                <div>
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
                </div>
                <div className="text-left">
                  <p className={`text-lg font-bold ${color}`} dir="ltr">{p.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground" dir="ltr">{formatCurrency(amount)}</p>
                </div>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${barColor} transition-all`}
                  style={{ width: `${Math.min(100, p * 2)}%` }}
                />
              </div>
            </div>
          );
        };
        const totalP = pct(total);
        const totalColor = totalP <= 25 ? 'from-emerald-500 to-teal-600'
          : totalP <= 35 ? 'from-amber-500 to-orange-600'
          : 'from-rose-500 to-red-600';
        return (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <Users className="h-5 w-5 text-indigo-500" />
                تفصيل نسبة الرواتب من المبيعات
              </CardTitle>
              <CardDescription className="text-xs">
                كل بند من تكاليف الموظفين كنسبة من صافي المبيعات ({formatCurrency(ns)})
                {typeof totals.employeeCount === 'number' && ` • ${totals.employeeCount} موظف نشط`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                {row(
                  'الرواتب والبدلات',
                  salaries,
                  'text-indigo-600',
                  'bg-gradient-to-l from-indigo-500 to-purple-500',
                  'card-ratio-salaries',
                  'راتب أساسي + بدل سكن + بدل نقل'
                )}
                {row(
                  'التأمينات الاجتماعية (GOSI)',
                  gosi,
                  'text-blue-600',
                  'bg-gradient-to-l from-blue-500 to-cyan-500',
                  'card-ratio-gosi',
                  '12% للسعوديين فقط'
                )}
                {row(
                  'رسوم غير السعوديين',
                  nonSaudi,
                  'text-orange-600',
                  'bg-gradient-to-l from-orange-500 to-amber-500',
                  'card-ratio-nonsaudi',
                  'المقابل المالي (شامل رخصة العمل) + إقامة + تأمين 2%'
                )}
              </div>
              <div
                className={`rounded-xl bg-gradient-to-l ${totalColor} p-4 text-white shadow-md`}
                data-testid="card-ratio-total-salary"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-white/80">إجمالي تكاليف الموظفين</p>
                    <p className="text-2xl font-bold mt-1" dir="ltr">{formatCurrency(total)}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-xs text-white/80">من المبيعات</p>
                    <p className="text-3xl font-extrabold mt-1" dir="ltr">{totalP.toFixed(1)}%</p>
                  </div>
                </div>
                <div className="mt-3 h-2 w-full rounded-full bg-white/20">
                  <div
                    className="h-full rounded-full bg-white/80 transition-all"
                    style={{ width: `${Math.min(100, totalP * 2)}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] text-white/70 text-center">
                  {totalP <= 25 ? '✓ ضمن النطاق الصحي (≤ 25%)'
                    : totalP <= 35 ? '⚠ نطاق متوسط — راقب التوظيف'
                    : '✗ مرتفع — راجع الهيكل الوظيفي'}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Expense distribution + Branch ranking */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold">توزيع المصروفات</CardTitle>
            <CardDescription className="text-xs">إجمالي {formatCurrency(totals.totalOperatingCosts || 0)}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <RePieChart>
                <Pie
                  data={expenseSlices}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {expenseSlices.map((s, i) => <Cell key={i} fill={s.color} />)}
                </Pie>
                <Tooltip
                  formatter={(v: any) => formatCurrency(Number(v))}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', direction: 'rtl' }}
                />
              </RePieChart>
            </ResponsiveContainer>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              {expenseSlices.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                  <span className="flex-1 truncate text-muted-foreground">{s.name}</span>
                  <span className="font-semibold" dir="ltr">{((s.value / (totals.totalOperatingCosts || 1)) * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold">ترتيب الفروع حسب الأداء</CardTitle>
            <CardDescription className="text-xs">صافي الربح والإيرادات لكل فرع</CardDescription>
          </CardHeader>
          <CardContent>
            {branchRanking.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">لا توجد فروع للمقارنة</p>
            ) : (
              <div className="space-y-3">
                {branchRanking.map((b: any, idx: number) => {
                  const widthPct = ((b.netSales || 0) / maxBranchRevenue) * 100;
                  const profitOk = (b.netProfit || 0) >= 0;
                  return (
                    <div key={b.branchId} data-testid={`row-branch-${b.branchId}`}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${idx === 0 ? 'bg-amber-100 text-amber-700' : idx === 1 ? 'bg-slate-100 text-slate-700' : idx === 2 ? 'bg-orange-100 text-orange-700' : 'bg-muted text-muted-foreground'}`}>
                            {idx + 1}
                          </span>
                          <span className="font-semibold">{b.branchName}</span>
                          <Badge variant="outline" className="text-[10px]">
                            رواتب {(b.salaryRatio || 0).toFixed(1)}%
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-muted-foreground" dir="ltr" title={`إجمالي شامل الضريبة: ${formatCurrency(b.grossSales || 0)}`}>
                            صافي {formatCurrency(b.netSales || 0)}
                          </span>
                          <span className={`font-bold ${profitOk ? 'text-emerald-600' : 'text-rose-600'}`} dir="ltr">
                            {profitOk ? '' : '-'}{formatCurrency(Math.abs(b.netProfit || 0))}
                          </span>
                        </div>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full ${profitOk ? 'bg-gradient-to-l from-emerald-500 to-teal-500' : 'bg-gradient-to-l from-rose-500 to-red-500'}`}
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Active employees panel */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Users className="h-4 w-4 text-indigo-500" />
              تكلفة الموظفين النشطين ({employeesList.length})
            </CardTitle>
            <CardDescription className="text-xs">
              إجمالي تكلفة الرواتب والمزايا والتأمينات الشهرية: {formatCurrency(totalPayrollCost)}
            </CardDescription>
          </div>
          <Badge variant="secondary" className="font-mono">
            نسبة من المبيعات: {(ratios.salaryToSales || 0).toFixed(1)}%
          </Badge>
        </CardHeader>
        <CardContent>
          {employeesList.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">لا يوجد موظفون نشطون</p>
          ) : (
            <ScrollArea className="h-[360px] pr-2">
              <table className="w-full text-sm" data-testid="table-active-employees">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b text-right text-xs text-muted-foreground">
                    <th className="py-2 font-medium">#</th>
                    <th className="py-2 font-medium">الاسم</th>
                    <th className="py-2 font-medium">الوظيفة</th>
                    {totals.branchId === 'all' && <th className="py-2 font-medium">الفرع</th>}
                    <th className="py-2 font-medium">الجنسية</th>
                    <th className="py-2 font-medium text-left">الراتب الأساسي</th>
                    <th className="py-2 font-medium text-left">البدلات</th>
                    <th className="py-2 font-medium text-left">تأمينات/تكاليف</th>
                    <th className="py-2 font-medium text-left">الإجمالي</th>
                    <th className="py-2 font-medium text-left">%</th>
                  </tr>
                </thead>
                <tbody>
                  {employeesList.map((e: any, idx: number) => {
                    const allowances = (e.housingAllowance || 0) + (e.transportAllowance || 0);
                    const overhead = (e.gosi || 0) + (e.nonSaudiOverhead || 0);
                    const pct = (e.totalCost / totalPayrollCost) * 100;
                    return (
                      <tr key={e.id || idx} className="border-b text-right last:border-0 hover:bg-muted/50" data-testid={`row-employee-${e.id}`}>
                        <td className="py-2 text-xs text-muted-foreground">{idx + 1}</td>
                        <td className="py-2 font-medium">{e.name}</td>
                        <td className="py-2 text-xs text-muted-foreground">{e.position || '—'}</td>
                        {totals.branchId === 'all' && <td className="py-2 text-xs text-muted-foreground">{e.branchName || '—'}</td>}
                        <td className="py-2 text-xs">
                          <Badge variant={e.isSaudi ? 'default' : 'secondary'} className="text-[10px]">
                            {e.nationality || (e.isSaudi ? 'سعودي' : 'غير سعودي')}
                          </Badge>
                        </td>
                        <td className="py-2 text-left" dir="ltr">{formatCurrency(e.baseSalary)}</td>
                        <td className="py-2 text-left text-muted-foreground" dir="ltr">{formatCurrency(allowances)}</td>
                        <td className="py-2 text-left text-muted-foreground" dir="ltr">{formatCurrency(overhead)}</td>
                        <td className="py-2 text-left font-bold text-indigo-600" dir="ltr">{formatCurrency(e.totalCost)}</td>
                        <td className="py-2 text-left">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
                              <div className="h-full bg-gradient-to-l from-indigo-500 to-purple-500" style={{ width: `${Math.min(100, pct)}%` }} />
                            </div>
                            <span className="text-xs font-semibold" dir="ltr">{pct.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
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
    const [rankingMetric, setRankingMetric] = useState<"profit" | "revenue" | "margin">("profit");
  
  const [salesEntries, setSalesEntries] = useState<Array<{ channel: string; totalAmount: number; invoiceCount: number }>>([]);
  const [cogsEntries, setCogsEntries] = useState<Array<{ itemType: string; notes: string; amount: number; wasteAmount: number }>>([]);
  const [operatingExpensesEntries, setOperatingExpensesEntries] = useState<Array<{ expenseType: string; notes: string; amount: number }>>([]);
  const [fixedCostsEntries, setFixedCostsEntries] = useState<Array<{ costType: string; notes: string; amount: number }>>([]);

  const { branches, canSelectBranch, userBranchId, isLoading: loadingBranches } = useBranches();
  const { isAdmin } = useAuth();

  // Admin-configurable COGS ratio (system-wide). Default 30%.
  const { data: globalSettings } = useQuery<{ cogsRatio: number }>({
    queryKey: ["/api/pnl/global-settings"],
    staleTime: 5 * 60 * 1000,
  });
  const cogsRatio = globalSettings?.cogsRatio ?? 0.30;

  // Admin-only inline edit for COGS ratio (shown inside expenses dialog).
  const [cogsRatioDraft, setCogsRatioDraft] = useState<string>("");
  const [editingCogsRatio, setEditingCogsRatio] = useState(false);
  const saveCogsRatioMutation = useMutation({
    mutationFn: async (pct: number) => {
      const res = await apiRequest("PUT", "/api/pnl/global-settings", { cogsRatio: pct });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pnl/global-settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pnl/enhanced-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pnl/expense-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financials/ranking"] });
      setEditingCogsRatio(false);
      toast({ title: "تم تحديث نسبة COGS بنجاح" });
    },
    onError: (e: any) => {
      toast({ title: "فشل التحديث", description: e?.message || "حدث خطأ", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (userBranchId && !canSelectBranch) {
      setSelectedBranchId(userBranchId);
    }
  }, [userBranchId, canSelectBranch]);

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

  // P&L Monthly Inputs (rent, utilities, COGS, etc.) — v2 includes the new
  // general expense columns. Rent is now read-only here (managed via the
  // dedicated rent-history page) but still editable as a quick override that
  // upserts the legacy pnl_branch_settings.monthlyRent fallback.
  const [showMonthlyInputs, setShowMonthlyInputs] = useState(false);
  const [monthlyInputsSection, setMonthlyInputsSection] = useState<"fixed" | "variable" | "operating">("fixed");
  const [monthlyInputsForm, setMonthlyInputsForm] = useState({
    electricityCost: 0,
    waterCost: 0,
    utilitiesOther: 0,
    cogsCost: 0,
    maintenanceCost: 0,
    marketingCost: 0,
    suppliesCost: 0,
    internetCost: 0,
    governmentFees: 0,
    insuranceCost: 0,
    subscriptionsCost: 0,
    securityCost: 0,
    bankFees: 0,
    fuelCost: 0,
    otherCosts: 0,
  });
  const [branchRentForm, setBranchRentForm] = useState(0);

  // Fetch branch settings (fixed rent)
  const { data: branchSettings, refetch: refetchBranchSettings } = useQuery({
    queryKey: ["/api/pnl/branch-settings", selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return null;
      const res = await fetch(`/api/pnl/branch-settings/${selectedBranchId}`);
      if (!res.ok) throw new Error(`${res.status}: request failed`);
      return res.json();
    },
    enabled: !!selectedBranchId,
  });

  // Fetch monthly inputs
  const { data: monthlyInputs, refetch: refetchMonthlyInputs } = useQuery({
    queryKey: ["/api/pnl/monthly-inputs", selectedBranchId, selectedYear, selectedMonth],
    queryFn: async () => {
      if (!selectedBranchId) return null;
      const res = await fetch(`/api/pnl/monthly-inputs/${selectedBranchId}/${selectedYear}/${selectedMonth}`);
      if (!res.ok) throw new Error(`${res.status}: request failed`);
      return res.json();
    },
    enabled: !!selectedBranchId && !!selectedYear && !!selectedMonth,
  });

  // Update form when data loads
  useEffect(() => {
    if (branchSettings) {
      setBranchRentForm(branchSettings.monthlyRent || 0);
    }
  }, [branchSettings]);

  useEffect(() => {
    if (monthlyInputs) {
      setMonthlyInputsForm({
        electricityCost: monthlyInputs.electricityCost || 0,
        waterCost: monthlyInputs.waterCost || 0,
        utilitiesOther: monthlyInputs.utilitiesOther || 0,
        cogsCost: monthlyInputs.cogsCost || 0,
        maintenanceCost: monthlyInputs.maintenanceCost || 0,
        marketingCost: monthlyInputs.marketingCost || 0,
        suppliesCost: monthlyInputs.suppliesCost || 0,
        internetCost: monthlyInputs.internetCost || 0,
        governmentFees: monthlyInputs.governmentFees || 0,
        insuranceCost: monthlyInputs.insuranceCost || 0,
        subscriptionsCost: monthlyInputs.subscriptionsCost || 0,
        securityCost: monthlyInputs.securityCost || 0,
        bankFees: monthlyInputs.bankFees || 0,
        fuelCost: monthlyInputs.fuelCost || 0,
        otherCosts: monthlyInputs.otherCosts || 0,
      });
    }
  }, [monthlyInputs]);

  // Expense ledger query — one row per (branch × month) for the selected year.
  // Used by the new "سجل المصاريف" tab. Only enabled when that tab is open
  // so it doesn't add load to other views.
  const { data: expenseLedger = [], isLoading: loadingLedger } = useQuery<any[]>({
    queryKey: ["/api/pnl/expense-ledger", selectedBranchId || 'all', selectedYear],
    queryFn: async () => {
      const params = new URLSearchParams({ year: String(selectedYear) });
      if (selectedBranchId) params.set("branchId", selectedBranchId);
      const res = await fetch(`/api/pnl/expense-ledger?${params}`);
      if (!res.ok) throw new Error("Failed to fetch expense ledger");
      return res.json();
    },
    enabled: activeTab === "expense-ledger",
    staleTime: 60_000,
  });

  // Copy monthly inputs from the previous month (uses the dedicated v2 API).
  // We compute the previous month from the *selected* period so the user
  // can be on Mar 2026 and copy from Feb 2026 without changing the view.
  const copyFromPrevMutation = useMutation({
    mutationFn: async (overwrite: boolean) => {
      if (!selectedBranchId) throw new Error("لم يتم اختيار فرع");
      const fromMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
      const fromYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
      const res = await fetch("/api/pnl/copy-monthly-inputs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: selectedBranchId,
          fromYear, fromMonth,
          toYear: selectedYear, toMonth: selectedMonth,
          overwrite,
        }),
      });
      if (res.status === 409) {
        const err = await res.json();
        throw Object.assign(new Error(err.error), { existing: true });
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "فشل النسخ" }));
        throw new Error(err.error || "فشل النسخ");
      }
      return res.json();
    },
    onSuccess: () => {
      refetchMonthlyInputs();
      refetchEnhancedPnL();
      toast({ title: "تم نسخ بيانات الشهر السابق بنجاح" });
    },
    onError: (err: any) => {
      if (err?.existing) {
        if (window.confirm("توجد بيانات بالفعل في هذا الشهر. هل تريد استبدالها؟")) {
          copyFromPrevMutation.mutate(true);
        }
      } else {
        toast({ title: err?.message || "فشل في نسخ البيانات", variant: "destructive" });
      }
    },
  });

  // Save branch settings mutation
  const saveBranchSettingsMutation = useMutation({
    mutationFn: async (data: { branchId: string; monthlyRent: number }) => {
      const res = await fetch("/api/pnl/branch-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save branch settings");
      return res.json();
    },
    onSuccess: () => {
      refetchBranchSettings();
      refetchEnhancedPnL();
      toast({ title: "تم حفظ إعدادات الإيجار" });
    },
    onError: () => {
      toast({ title: "فشل في حفظ إعدادات الإيجار", variant: "destructive" });
    },
  });

  // Save monthly inputs mutation
  const saveMonthlyInputsMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/pnl/monthly-inputs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save monthly inputs");
      return res.json();
    },
    onSuccess: () => {
      refetchMonthlyInputs();
      refetchEnhancedPnL();
      toast({ title: "تم حفظ البيانات الشهرية" });
      setShowMonthlyInputs(false);
    },
    onError: () => {
      toast({ title: "فشل في حفظ البيانات الشهرية", variant: "destructive" });
    },
  });

  const handleSaveMonthlyData = () => {
    if (!selectedBranchId) return;
    
    // Save branch settings (rent)
    saveBranchSettingsMutation.mutate({
      branchId: selectedBranchId,
      monthlyRent: branchRentForm,
    });
    
    // Save monthly inputs (includes the v2 expanded columns).
    saveMonthlyInputsMutation.mutate({
      branchId: selectedBranchId,
      year: selectedYear,
      month: selectedMonth,
      ...monthlyInputsForm,
    });
  };

  // Enhanced P&L Summary (automatic from cashier journals + employees)
  const { data: enhancedPnL, isLoading: loadingEnhancedPnL, refetch: refetchEnhancedPnL } = useQuery<{
    branches: any[];
    totals: any;
  }>({
    queryKey: ["/api/pnl/enhanced-summary", { branchId: selectedBranchId, year: selectedYear, month: selectedMonth }],
    queryFn: async () => {
      const params = new URLSearchParams({
        year: selectedYear.toString(),
        month: selectedMonth.toString(),
      });
      if (selectedBranchId) params.append("branchId", selectedBranchId);
      const res = await fetch(`/api/pnl/enhanced-summary?${params}`);
      if (!res.ok) throw new Error("Failed to fetch enhanced P&L");
      return res.json();
    },
    enabled: !!selectedYear && !!selectedMonth,
  });

  // Import Excel data
  const importExcelMutation = useMutation({
    mutationFn: async (data: { periodId: number; excelData: any }) => {
      const res = await fetch(`/api/financials/periods/${data.periodId}/import-excel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data.excelData),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to import Excel data");
      }
      return res.json();
    },
    onSuccess: (data) => {
      refetchPnL();
      queryClient.invalidateQueries({ queryKey: ["/api/financials/ranking"] });
      toast({ 
        title: "تم استيراد البيانات بنجاح", 
        description: `تم استيراد ${data.imported.sales} مبيعات، ${data.imported.cogs} تكاليف، ${data.imported.operatingExpenses} مصروفات، ${data.imported.fixedCosts} تكاليف ثابتة` 
      });
    },
    onError: (error: Error) => {
      toast({ title: error.message || "فشل في استيراد البيانات من الملف", variant: "destructive" });
    },
  });

  const handleExcelImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedPeriodId) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const XLSX = await import("xlsx");
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const parsedData = await parseExcelPnLData(workbook);
        
        // Check for unmapped labels - abort if any found
        if (parsedData.unmappedLabels.length > 0) {
          const errorDetails = parsedData.unmappedLabels
            .map(u => `${u.sheet}: ${u.labels.join(", ")}`)
            .join("\n");
          toast({ 
            title: "تم العثور على بنود غير معرّفة في الملف", 
            description: `يرجى تصحيح البنود التالية:\n${errorDetails}`,
            variant: "destructive",
            duration: 10000,
          });
          return;
        }
        
        if (parsedData.sales.length === 0 && parsedData.cogs.length === 0 && 
            parsedData.operatingExpenses.length === 0 && parsedData.fixedCosts.length === 0) {
          toast({ title: "الملف فارغ أو غير صالح", variant: "destructive" });
          return;
        }

        importExcelMutation.mutate({
          periodId: selectedPeriodId,
          excelData: {
            sales: parsedData.sales.map(s => ({
              ...s,
              date: `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`,
            })),
            cogs: parsedData.cogs,
            operatingExpenses: parsedData.operatingExpenses,
            fixedCosts: parsedData.fixedCosts,
          },
        });
      } catch (error) {
        toast({ title: "خطأ في قراءة الملف", variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = "";
  };

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

  // Merge metrics from both sources - prefer enhancedPnL (real-time) over completePnL (manual)
  const metrics = useMemo(() => {
    const enhanced = enhancedPnL?.totals;
    const manual = completePnL?.metrics;
    
    if (enhanced) {
      // Calculate additional metrics from enhanced data
      const totalOperatingExpenses = enhanced.totalOperatingCosts || 0;
      const depreciation = 0; // Could be added later
      const ebitda = (enhanced.operatingProfit || 0) + depreciation;
      const contributionMargin = (enhanced.netSales || 0) - (enhanced.cogsCost || 0);
      
      const netMargin = enhanced.netMargin || 0;
      const salaryToSales = enhanced.netSales > 0 ? ((enhanced.employeeCosts?.total || 0) / enhanced.netSales) * 100 : 0;
      const rentToRevenue = enhanced.netSales > 0 ? ((enhanced.rent || 0) / enhanced.netSales) * 100 : 0;
      
      // Generate rating reasons - Target net profit margin: 20-25%
      const ratingReasons: string[] = [];
      if (netMargin >= 25) ratingReasons.push("هامش ربح صافي متميز (أعلى من 25%) - فوق الهدف");
      else if (netMargin >= 20) ratingReasons.push("هامش ربح صافي ممتاز (20-25%) - ضمن الهدف المستهدف");
      else if (netMargin >= 15) ratingReasons.push("هامش ربح صافي جيد (15-20%) - قريب من الهدف");
      else if (netMargin >= 10) ratingReasons.push("هامش ربح صافي مقبول (10-15%) - أقل من الهدف");
      else if (netMargin >= 5) ratingReasons.push("هامش ربح صافي ضعيف (5-10%) - يحتاج تحسين");
      else ratingReasons.push("هامش ربح صافي منخفض جداً (أقل من 5%) - يحتاج مراجعة عاجلة");
      
      if (salaryToSales <= 25) ratingReasons.push("نسبة الرواتب للمبيعات ممتازة (أقل من 25%)");
      else if (salaryToSales <= 30) ratingReasons.push("نسبة الرواتب للمبيعات مقبولة (25-30%)");
      else if (salaryToSales <= 35) ratingReasons.push("نسبة الرواتب للمبيعات مرتفعة (30-35%)");
      else ratingReasons.push("نسبة الرواتب للمبيعات مرتفعة جداً (أكثر من 35%)");
      
      if (rentToRevenue <= 8) ratingReasons.push("نسبة الإيجار للإيرادات ممتازة (أقل من 8%)");
      else if (rentToRevenue <= 12) ratingReasons.push("نسبة الإيجار للإيرادات مقبولة (8-12%)");
      else if (rentToRevenue <= 15) ratingReasons.push("نسبة الإيجار للإيرادات مرتفعة (12-15%)");
      else ratingReasons.push("نسبة الإيجار للإيرادات مرتفعة جداً (أكثر من 15%)");
      
      // Generate recommendations - based on target 20-25%
      const recommendations: string[] = [];
      if (netMargin < 20) recommendations.push("العمل على رفع هامش الربح للوصول للهدف المستهدف (20-25%)");
      if (netMargin < 15) recommendations.push("مراجعة هيكل التكاليف وتحسين الكفاءة التشغيلية");
      if (salaryToSales > 30) recommendations.push("مراجعة تكاليف الموظفين وتحسين الإنتاجية");
      if (rentToRevenue > 15) recommendations.push("مراجعة تكاليف الإيجار مقارنة بالإيرادات");
      
      return {
        // كل المؤشرات والنسب تُحسب على صافي المبيعات (بعد خصم الضريبة)
        totalRevenue: enhanced.netSales || 0,
        netRevenue: enhanced.netSales || 0,
        totalCOGS: enhanced.cogsCost || 0,
        grossProfit: enhanced.grossProfit || 0,
        grossMarginPct: enhanced.grossMargin || 0,
        totalOperatingExpenses,
        operatingProfit: enhanced.operatingProfit || 0,
        operatingMarginPct: enhanced.netSales > 0 ? ((enhanced.operatingProfit || 0) / enhanced.netSales) * 100 : 0,
        totalFixedCosts: (enhanced.rent || 0) + (enhanced.utilities?.total || 0),
        netProfit: enhanced.netProfit || 0,
        netMarginPct: enhanced.netMargin || 0,
        ebitda,
        ebitdaMarginPct: enhanced.netSales > 0 ? (ebitda / enhanced.netSales) * 100 : 0,
        contributionMargin,
        contributionMarginPct: enhanced.netSales > 0 ? (contributionMargin / enhanced.netSales) * 100 : 0,
        breakEvenPoint: contributionMargin > 0 ? ((enhanced.rent || 0) + (enhanced.utilities?.total || 0)) / (contributionMargin / (enhanced.netSales || 1)) : 0,
        breakEvenSales: contributionMargin > 0 ? ((enhanced.rent || 0) + (enhanced.utilities?.total || 0)) / (contributionMargin / (enhanced.netSales || 1)) : 0,
        revenuePerEmployee: enhanced.employeeCount > 0 ? (enhanced.netSales || 0) / enhanced.employeeCount : 0,
        employeeCount: enhanced.employeeCount || 0,
        rating: netMargin >= 20 ? "excellent" : netMargin >= 15 ? "good" : netMargin >= 10 ? "average" : "poor",
        wastePercentage: 0,
        wastePct: 0,
        rentToRevenuePct: rentToRevenue,
        salaryToRevenuePct: salaryToSales,
        salaryToSalesPct: salaryToSales,
        laborProductivity: enhanced.employeeCount > 0 ? (enhanced.netSales || 0) / enhanced.employeeCount : 0,
        invoiceCount: enhanced.journalCount || 0,
        avgInvoiceValue: enhanced.journalCount > 0 ? (enhanced.netSales || 0) / enhanced.journalCount : 0,
        ratingReasons,
        recommendations,
      };
    }
    
    return manual;
  }, [enhancedPnL?.totals, completePnL?.metrics]);
  
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
      <div className="page-container space-y-4 sm:space-y-6" dir="rtl">
        <PageHeader
          icon={BarChart3}
          tone="money"
          title="لوحة الأرباح والخسائر (P&L)"
          description="تحليل الأداء المالي للفروع"
          backHref="/attendance-dashboard"
          actions={selectedPeriodId ? (
              <div className="flex gap-2 flex-wrap">
                {/* v2 prominent entry button — first action so users find it fast */}
                <Button
                  onClick={() => setShowMonthlyInputs(true)}
                  className="h-11 sm:h-9 bg-amber-500 hover:bg-amber-600 text-white"
                  data-testid="button-open-monthly-inputs"
                  disabled={!selectedBranchId}
                >
                  <Plus className="h-4 w-4 sm:ml-2" />
                  <span className="hidden sm:inline">إدخال مصاريف الشهر</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate("/pnl-recurring-expenses")}
                  className="h-11 sm:h-9"
                  data-testid="button-recurring-expenses"
                >
                  <RefreshCw className="h-4 w-4 sm:ml-2" />
                  <span className="hidden sm:inline">المصاريف المتكررة</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate("/pnl-rent-history")}
                  className="h-11 sm:h-9"
                  data-testid="button-rent-history"
                  disabled={!selectedBranchId}
                >
                  <History className="h-4 w-4 sm:ml-2" />
                  <span className="hidden sm:inline">سجل الإيجار</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => importSalesMutation.mutate(selectedPeriodId)}
                  disabled={importSalesMutation.isPending}
                  className="h-11 sm:h-9"
                  data-testid="button-import-sales"
                >
                  {importSalesMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin sm:ml-2" />
                  ) : (
                    <Download className="h-4 w-4 sm:ml-2" />
                  )}
                  <span className="hidden sm:inline">استيراد من الكاشير</span>
                </Button>
                <Button
                  onClick={() => calculateMetricsMutation.mutate(selectedPeriodId)}
                  disabled={calculateMetricsMutation.isPending}
                  className="h-11 sm:h-9"
                  data-testid="button-calculate-metrics"
                >
                  {calculateMetricsMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin sm:ml-2" />
                  ) : (
                    <Calculator className="h-4 w-4 sm:ml-2" />
                  )}
                  <span className="hidden sm:inline">حساب المؤشرات</span>
                </Button>
                {enhancedPnL && (
                  <>
                    <Button
                      variant="default"
                      className="h-11 sm:h-9 bg-amber-600 hover:bg-amber-700"
                      onClick={async () => {
                        if (!enhancedPnL?.totals?.grossSales && enhancedPnL?.totals?.grossSales !== 0) {
                          toast({ title: "لا توجد بيانات", description: "لا توجد يوميات صندوق معتمدة لهذه الفترة", variant: "destructive" });
                          return;
                        }
                        try {
                          const branchLabel = selectedBranch?.name || "جميع الفروع";
                          const period = `${MONTHS_AR[selectedMonth - 1]} ${selectedYear}`;
                          await downloadEnhancedPnLPdf(
                            branchLabel,
                            period,
                            enhancedPnL,
                            `تقرير_PnL_المحسن_${branchLabel}_${period}.pdf`
                          );
                          toast({ title: "تم التصدير", description: "تم تصدير التقرير بنجاح" });
                        } catch (error) {
                          console.error('PDF export error:', error);
                          toast({ title: "خطأ", description: "فشل في تصدير PDF", variant: "destructive" });
                        }
                      }}
                      data-testid="button-export-enhanced-pdf"
                    >
                      <Printer className="h-4 w-4 sm:ml-2" />
                      <span className="hidden sm:inline">PDF محسن</span>
                    </Button>
                    <Button
                      variant="default"
                      className="h-11 sm:h-9 bg-green-600 hover:bg-green-700"
                      onClick={async () => {
                        if (!enhancedPnL?.totals?.grossSales && enhancedPnL?.totals?.grossSales !== 0) {
                          toast({ title: "لا توجد بيانات", description: "لا توجد يوميات صندوق معتمدة لهذه الفترة", variant: "destructive" });
                          return;
                        }
                        const branchLabel = selectedBranch?.name || "جميع الفروع";
                        const period = `${MONTHS_AR[selectedMonth - 1]} ${selectedYear}`;
                        await exportEnhancedPnLToExcel(
                          branchLabel,
                          period,
                          enhancedPnL
                        );
                      }}
                      data-testid="button-export-enhanced-excel"
                    >
                      <FileSpreadsheet className="h-4 w-4 sm:ml-2" />
                      <span className="hidden sm:inline">Excel محسن</span>
                    </Button>
                  </>
                )}
                {completePnL?.metrics && (
                  <>
                    <Button
                      variant="outline"
                      className="h-11 sm:h-9"
                      onClick={async () => {
                        if (selectedBranch && completePnL) {
                          try {
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
                            await downloadArabicPdf(docDef, `تقرير_PnL_${selectedBranch.name}_${period}.pdf`);
                          } catch (error) {
                            console.error('PDF export error:', error);
                            toast({ title: "خطأ", description: "فشل في تصدير PDF", variant: "destructive" });
                          }
                        }
                      }}
                      data-testid="button-export-pdf"
                    >
                      <Printer className="h-4 w-4 sm:ml-2" />
                      <span className="hidden sm:inline">PDF</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-11 sm:h-9"
                      onClick={async () => {
                        if (selectedBranch && completePnL) {
                          const period = `${MONTHS_AR[selectedMonth - 1]} ${selectedYear}`;
                          await exportPnLToExcel(
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
                      <FileSpreadsheet className="h-4 w-4 sm:ml-2" />
                      <span className="hidden sm:inline">Excel</span>
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  onClick={generatePnLExcelTemplate}
                  className="h-11 sm:h-9"
                  data-testid="button-download-template"
                >
                  <Download className="h-4 w-4 sm:ml-2" />
                  <span className="hidden sm:inline">قالب الاستيراد</span>
                </Button>
                <div className="relative">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleExcelImport}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    data-testid="input-import-excel"
                  />
                  <Button
                    variant="outline"
                    disabled={importExcelMutation.isPending}
                    className="h-11 sm:h-9"
                  >
                    {importExcelMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin sm:ml-2" />
                    ) : (
                      <Upload className="h-4 w-4 sm:ml-2" />
                    )}
                    <span className="hidden sm:inline">استيراد Excel</span>
                  </Button>
                </div>
              </div>
            ) : null}
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              اختيار الفترة المالية
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-6">
            <div className="kpi-grid">
              <div>
                <Label className="text-xs sm:text-sm">الفرع</Label>
                <Select
                  value={selectedBranchId || userBranchId || ""}
                  onValueChange={(value) => {
                    setSelectedBranchId(value);
                    handleSelectPeriod(value, selectedYear, selectedMonth);
                  }}
                  disabled={!canSelectBranch}
                >
                  <SelectTrigger className="h-11 sm:h-10" data-testid="select-branch">
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
                <Label className="text-xs sm:text-sm">السنة</Label>
                <Select
                  value={selectedYear.toString()}
                  onValueChange={(value) => {
                    const year = parseInt(value);
                    setSelectedYear(year);
                    handleSelectPeriod(selectedBranchId, year, selectedMonth);
                  }}
                >
                  <SelectTrigger className="h-11 sm:h-10" data-testid="select-year">
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
                <Label className="text-xs sm:text-sm">الشهر</Label>
                <Select
                  value={selectedMonth.toString()}
                  onValueChange={(value) => {
                    const month = parseInt(value);
                    setSelectedMonth(month);
                    handleSelectPeriod(selectedBranchId, selectedYear, month);
                  }}
                >
                  <SelectTrigger className="h-11 sm:h-10" data-testid="select-month">
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
                  className="w-full h-11 sm:h-9"
                  data-testid="button-load-period"
                >
                  {createPeriodMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin sm:ml-2" />
                  ) : (
                    <Plus className="h-4 w-4 sm:ml-2" />
                  )}
                  <span className="hidden sm:inline">تحميل / إنشاء الفترة</span>
                  <span className="sm:hidden">تحميل</span>
                </Button>
              </div>
            </div>

            {selectedPeriodId && selectedBranch && (
              <div className="mt-4 p-3 bg-primary/5 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <span className="text-xs sm:text-sm">
                  الفترة الحالية: <strong>{selectedBranch.name}</strong> - {MONTHS_AR[selectedMonth - 1]} {selectedYear}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Enhanced Automatic P&L Summary - الملخص التلقائي للأرباح والخسائر */}
        {enhancedPnL && enhancedPnL.totals && (
          <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-200">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-amber-800">
                  <Calculator className="h-5 w-5" />
                  الملخص التلقائي - {MONTHS_AR[selectedMonth - 1]} {selectedYear}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => refetchEnhancedPnL()}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <CardDescription>
                بيانات محسوبة تلقائياً من يوميات الصندوق وبيانات الموظفين (شاملة ضريبة القيمة المضافة 15%)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingEnhancedPnL ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Main Metrics Row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3 rounded-lg bg-white border">
                      <div className="text-xs text-muted-foreground">إجمالي المبيعات (شامل الضريبة)</div>
                      <div className="text-lg font-bold text-blue-600">{formatCurrency(enhancedPnL.totals.grossSales)}</div>
                      <div className="text-xs text-muted-foreground">({enhancedPnL.totals.journalCount} يومية)</div>
                    </div>
                    <div className="p-3 rounded-lg bg-white border">
                      <div className="text-xs text-muted-foreground">ضريبة القيمة المضافة 15%</div>
                      <div className="text-lg font-bold text-red-500">- {formatCurrency(enhancedPnL.totals.vatAmount)}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-white border">
                      <div className="text-xs text-muted-foreground">صافي المبيعات (بعد الضريبة)</div>
                      <div className="text-lg font-bold text-green-600">{formatCurrency(enhancedPnL.totals.netSales)}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-white border">
                      <div className="text-xs text-muted-foreground">صافي الربح</div>
                      <div className={`text-lg font-bold ${enhancedPnL.totals.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {enhancedPnL.totals.netProfit >= 0 ? '' : '-'}{formatCurrency(Math.abs(enhancedPnL.totals.netProfit))}
                      </div>
                      <div className="text-xs text-muted-foreground">({formatPercent(enhancedPnL.totals.netMargin)} هامش)</div>
                    </div>
                  </div>

                  {/* Costs Breakdown */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Employee Costs */}
                    <div className="p-3 rounded-lg bg-red-50 border border-red-100">
                      <div className="flex items-center gap-2 text-sm font-medium text-red-800 mb-2">
                        <Users className="h-4 w-4" />
                        تكاليف الموظفين ({enhancedPnL.totals.employeeCount} موظف)
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>الرواتب والبدلات</span>
                          <span>{formatCurrency(enhancedPnL.totals.employeeCosts.salaries)}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>التأمينات الاجتماعية (GOSI)</span>
                          <span>{formatCurrency(enhancedPnL.totals.employeeCosts.gosi)}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>رسوم غير السعوديين</span>
                          <span>{formatCurrency(enhancedPnL.totals.employeeCosts.nonSaudiCosts)}</span>
                        </div>
                        <Separator className="my-1" />
                        <div className="flex justify-between font-bold">
                          <span>الإجمالي</span>
                          <span className="text-red-600">{formatCurrency(enhancedPnL.totals.employeeCosts.total)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Fixed & Utilities */}
                    <div className="p-3 rounded-lg bg-orange-50 border border-orange-100">
                      <div className="flex items-center gap-2 text-sm font-medium text-orange-800 mb-2">
                        <Home className="h-4 w-4" />
                        المصروفات الثابتة والمرافق
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>الإيجار</span>
                          <span>{formatCurrency(enhancedPnL.totals.rent)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>الكهرباء</span>
                          <span>{formatCurrency(enhancedPnL.totals.utilities.electricity)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>المياه</span>
                          <span>{formatCurrency(enhancedPnL.totals.utilities.water)}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>مرافق أخرى</span>
                          <span>{formatCurrency(enhancedPnL.totals.utilities.other)}</span>
                        </div>
                        <Separator className="my-1" />
                        <div className="flex justify-between font-bold">
                          <span>الإجمالي</span>
                          <span className="text-orange-600">{formatCurrency(enhancedPnL.totals.rent + enhancedPnL.totals.utilities.total)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Operating Costs */}
                    <div className="p-3 rounded-lg bg-purple-50 border border-purple-100">
                      <div className="flex items-center gap-2 text-sm font-medium text-purple-800 mb-2">
                        <Package className="h-4 w-4" />
                        تكاليف التشغيل
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>تكلفة البضاعة (COGS)</span>
                          <span>{formatCurrency(enhancedPnL.totals.cogsCost)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>الصيانة</span>
                          <span>{formatCurrency(enhancedPnL.totals.operatingCosts.maintenance)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>التسويق</span>
                          <span>{formatCurrency(enhancedPnL.totals.operatingCosts.marketing)}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>مستلزمات وأخرى</span>
                          <span>{formatCurrency(enhancedPnL.totals.operatingCosts.supplies + enhancedPnL.totals.operatingCosts.other)}</span>
                        </div>
                        <Separator className="my-1" />
                        <div className="flex justify-between font-bold">
                          <span>إجمالي التكاليف</span>
                          <span className="text-purple-600">{formatCurrency(enhancedPnL.totals.totalOperatingCosts + enhancedPnL.totals.cogsCost)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Data Entry Button */}
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowMonthlyInputs(true)}
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      إدخال بيانات التكاليف الشهرية
                    </Button>
                  </div>

                  {/* Data Entry Note */}
                  {!enhancedPnL.totals.hasMonthlyInputs && (
                    <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-200 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      <span className="text-sm text-yellow-800">
                        لم يتم إدخال بيانات الإيجار والمرافق والتكاليف لهذا الشهر. اضغط على "إدخال بيانات التكاليف الشهرية" لإضافتها.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {selectedPeriodId && (
          <>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="overview" data-testid="tab-overview">
                  <BarChart3 className="h-4 w-4 ml-2" />
                  نظرة عامة
                </TabsTrigger>
                <TabsTrigger value="details" data-testid="tab-details">
                  <FileText className="h-4 w-4 ml-2" />
                  التفاصيل
                </TabsTrigger>
                <TabsTrigger value="expense-ledger" data-testid="tab-expense-ledger">
                  <Receipt className="h-4 w-4 ml-2" />
                  سجل المصاريف
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
                  {loadingEnhancedPnL && !enhancedPnL ? (
                    <div className="flex items-center justify-center py-24">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : metrics && enhancedPnL?.totals ? (
                    <ModernOverview
                      metrics={metrics}
                      totals={enhancedPnL.totals}
                      branches={enhancedPnL.branches || []}
                      selectedYear={selectedYear}
                      selectedMonth={selectedMonth}
                      monthLabel={MONTHS_AR[selectedMonth - 1]}
                    />
                  ) : (
                    <Card>
                      <CardContent className="py-16 text-center text-muted-foreground">
                        <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-40" />
                        <p className="text-lg font-semibold mb-1">لا توجد بيانات لهذه الفترة</p>
                        <p className="text-sm">اختر فرعاً وشهراً لعرض لوحة الأرباح والخسائر.</p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
  

              <TabsContent value="details" className="space-y-6">
                {enhancedPnL && enhancedPnL.totals ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Wallet className="h-5 w-5 text-blue-500" />
                          الإيرادات من يوميات الصندوق المعتمدة
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                            <span>إجمالي المبيعات (شامل الضريبة)</span>
                            <div className="font-semibold text-green-600">{formatCurrency(enhancedPnL.totals.grossSales)}</div>
                          </div>
                          <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                            <span>ضريبة القيمة المضافة (15%)</span>
                            <div className="font-semibold text-red-600">- {formatCurrency(enhancedPnL.totals.vatAmount)}</div>
                          </div>
                          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border-2 border-blue-200">
                            <span className="font-bold">صافي المبيعات</span>
                            <div className="font-bold text-blue-600">{formatCurrency(enhancedPnL.totals.netSales)}</div>
                          </div>
                          <div className="text-xs text-muted-foreground text-center mt-2">
                            عدد اليوميات المعتمدة: {enhancedPnL.totals.journalCount}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Users className="h-5 w-5 text-purple-500" />
                          تكاليف الموظفين ({enhancedPnL.totals.employeeCount} موظف)
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <span>الرواتب والبدلات</span>
                            <div className="font-semibold">{formatCurrency(enhancedPnL.totals.employeeCosts.salaries)}</div>
                          </div>
                          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <span>التأمينات الاجتماعية (GOSI 12%)</span>
                            <div className="font-semibold">{formatCurrency(enhancedPnL.totals.employeeCosts.gosi)}</div>
                          </div>
                          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <span>رسوم غير السعوديين</span>
                            <div className="font-semibold">{formatCurrency(enhancedPnL.totals.employeeCosts.nonSaudiCosts)}</div>
                          </div>
                          <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border-2 border-purple-200">
                            <span className="font-bold">إجمالي تكاليف الموظفين</span>
                            <div className="font-bold text-purple-600">{formatCurrency(enhancedPnL.totals.employeeCosts.total)}</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Home className="h-5 w-5 text-orange-500" />
                          المصروفات الثابتة والمرافق
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <span>الإيجار الشهري</span>
                            <div className="font-semibold">{formatCurrency(enhancedPnL.totals.rent)}</div>
                          </div>
                          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <span>الكهرباء</span>
                            <div className="font-semibold">{formatCurrency(enhancedPnL.totals.utilities.electricity)}</div>
                          </div>
                          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <span>المياه</span>
                            <div className="font-semibold">{formatCurrency(enhancedPnL.totals.utilities.water)}</div>
                          </div>
                          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <span>مرافق أخرى</span>
                            <div className="font-semibold">{formatCurrency(enhancedPnL.totals.utilities.other)}</div>
                          </div>
                          <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border-2 border-orange-200">
                            <span className="font-bold">إجمالي المصروفات الثابتة</span>
                            <div className="font-bold text-orange-600">{formatCurrency(enhancedPnL.totals.rent + enhancedPnL.totals.utilities.total)}</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <ShoppingCart className="h-5 w-5 text-red-500" />
                          التكاليف التشغيلية
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <span>تكلفة البضاعة المباعة (COGS)</span>
                            <div className="font-semibold">{formatCurrency(enhancedPnL.totals.cogsCost)}</div>
                          </div>
                          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <span>الصيانة</span>
                            <div className="font-semibold">{formatCurrency(enhancedPnL.totals.operatingCosts.maintenance)}</div>
                          </div>
                          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <span>التسويق</span>
                            <div className="font-semibold">{formatCurrency(enhancedPnL.totals.operatingCosts.marketing)}</div>
                          </div>
                          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <span>المستلزمات والأخرى</span>
                            <div className="font-semibold">{formatCurrency(enhancedPnL.totals.operatingCosts.supplies + enhancedPnL.totals.operatingCosts.other)}</div>
                          </div>
                          <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border-2 border-red-200">
                            <span className="font-bold">إجمالي التكاليف التشغيلية</span>
                            <div className="font-bold text-red-600">{formatCurrency(enhancedPnL.totals.totalOperatingCosts + enhancedPnL.totals.cogsCost)}</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <Card>
                    <CardContent className="p-12 text-center">
                      <FileText className="h-16 w-16 mx-auto text-muted-foreground opacity-50 mb-4" />
                      <h3 className="text-xl font-semibold mb-2">لا توجد بيانات متاحة</h3>
                      <p className="text-muted-foreground mb-4">
                        يرجى التأكد من وجود يوميات صندوق معتمدة لهذه الفترة
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="expense-ledger" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Receipt className="h-5 w-5 text-amber-600" />
                      سجل المصاريف الشهري - {selectedYear}
                      {selectedBranch && <span className="text-sm text-muted-foreground">— {selectedBranch.name}</span>}
                    </CardTitle>
                    <CardDescription>
                      تفصيل كل بنود المصاريف لكل شهر (إيجار، تكلفة بضاعة، مرافق، عامة، تشغيلية، متكررة). انقر على شهر لتعديله.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loadingLedger ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    ) : expenseLedger.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <Receipt className="h-12 w-12 mx-auto mb-3 opacity-40" />
                        <p>لا توجد بيانات مصاريف مُدخلة لهذه السنة</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="text-right p-2">الشهر</th>
                              {!selectedBranchId && <th className="text-right p-2">الفرع</th>}
                              <th className="text-left p-2">الإيجار</th>
                              <th className="text-left p-2">تكلفة بضاعة</th>
                              <th className="text-left p-2">مرافق</th>
                              <th className="text-left p-2">عامة</th>
                              <th className="text-left p-2">تشغيلية</th>
                              <th className="text-left p-2">متكررة</th>
                              <th className="text-left p-2 font-bold">الإجمالي</th>
                            </tr>
                          </thead>
                          <tbody>
                            {expenseLedger.map((row, i) => (
                              <tr key={`${row.branchId}-${row.month}-${i}`} className="border-t hover:bg-muted/30">
                                <td className="p-2 font-medium">
                                  <button
                                    className="text-blue-600 hover:underline"
                                    onClick={() => {
                                      setSelectedMonth(row.month);
                                      if (row.branchId !== selectedBranchId) setSelectedBranchId(row.branchId);
                                      setTimeout(() => setShowMonthlyInputs(true), 300);
                                    }}
                                    data-testid={`btn-edit-ledger-${row.branchId}-${row.month}`}
                                  >
                                    {MONTHS_AR[row.month - 1]}
                                  </button>
                                </td>
                                {!selectedBranchId && <td className="p-2">{row.branchName}</td>}
                                <td className="p-2 text-left">{formatCurrency(row.rent)}</td>
                                <td className="p-2 text-left">{formatCurrency(row.cogs)}</td>
                                <td className="p-2 text-left">{formatCurrency(row.utilities)}</td>
                                <td className="p-2 text-left">{formatCurrency(row.general)}</td>
                                <td className="p-2 text-left">{formatCurrency(row.operating)}</td>
                                <td className="p-2 text-left">{formatCurrency(row.recurring)}</td>
                                <td className="p-2 text-left font-bold text-purple-700">{formatCurrency(row.total)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-muted/40 font-bold border-t-2">
                            <tr>
                              <td className="p-2" colSpan={selectedBranchId ? 1 : 2}>الإجمالي</td>
                              <td className="p-2 text-left">{formatCurrency(expenseLedger.reduce((s, r) => s + r.rent, 0))}</td>
                              <td className="p-2 text-left">{formatCurrency(expenseLedger.reduce((s, r) => s + r.cogs, 0))}</td>
                              <td className="p-2 text-left">{formatCurrency(expenseLedger.reduce((s, r) => s + r.utilities, 0))}</td>
                              <td className="p-2 text-left">{formatCurrency(expenseLedger.reduce((s, r) => s + r.general, 0))}</td>
                              <td className="p-2 text-left">{formatCurrency(expenseLedger.reduce((s, r) => s + r.operating, 0))}</td>
                              <td className="p-2 text-left">{formatCurrency(expenseLedger.reduce((s, r) => s + r.recurring, 0))}</td>
                              <td className="p-2 text-left text-purple-700">{formatCurrency(expenseLedger.reduce((s, r) => s + r.total, 0))}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
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

        {/* Monthly Inputs Dialog v2 — sectioned (ثابتة / متغيرة / تشغيلية) with
            copy-from-prev-month button and a live profit preview side panel. */}
        <Dialog open={showMonthlyInputs} onOpenChange={setShowMonthlyInputs}>
          <DialogContent className="max-w-5xl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Calculator className="h-5 w-5 text-amber-600" />
                إدخال مصاريف الشهر — {MONTHS_AR[selectedMonth - 1]} {selectedYear}
                {selectedBranch && <Badge variant="outline" className="mr-2">{selectedBranch.name}</Badge>}
              </DialogTitle>
              <CardDescription>
                أدخل مصاريف الشهر مقسّمة حسب طبيعتها. الإيجار يُحدّد من «سجل الإيجار»،
                والمصاريف المتكررة (اشتراكات، تأمين) تُضاف تلقائياً من «المصاريف المتكررة».
              </CardDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
              {/* Form side */}
              <div className="space-y-3">
                {/* Quick actions */}
                <div className="flex items-center gap-2 flex-wrap p-2 bg-amber-50 rounded-lg border border-amber-200">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyFromPrevMutation.mutate(false)}
                    disabled={copyFromPrevMutation.isPending || !selectedBranchId}
                    data-testid="button-copy-from-prev"
                  >
                    {copyFromPrevMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <RefreshCw className="h-4 w-4 ml-1" />}
                    نسخ من الشهر السابق
                  </Button>
                  <span className="text-xs text-amber-800">
                    يجلب قيم {MONTHS_AR[(selectedMonth === 1 ? 12 : selectedMonth - 1) - 1]} {selectedMonth === 1 ? selectedYear - 1 : selectedYear} كأساس.
                  </span>
                </div>

                {/* Section tabs */}
                <div className="flex gap-1 border-b">
                  {[
                    { key: "fixed",     label: "ثابتة",     icon: Home },
                    { key: "variable",  label: "متغيرة",    icon: Lightbulb },
                    { key: "operating", label: "تشغيلية",  icon: ShoppingCart },
                  ].map(s => {
                    const Icon = s.icon;
                    const active = monthlyInputsSection === s.key;
                    return (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => setMonthlyInputsSection(s.key as any)}
                        className={`flex items-center gap-2 px-4 py-2 text-sm border-b-2 transition-colors ${
                          active ? "border-amber-500 text-amber-700 font-semibold" : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                        data-testid={`section-${s.key}`}
                      >
                        <Icon className="h-4 w-4" />
                        {s.label}
                      </button>
                    );
                  })}
                </div>

                <div className="max-h-[55vh] overflow-y-auto py-2 px-1">
                  {monthlyInputsSection === "fixed" && (
                    <div className="space-y-4">
                      <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                        <div className="flex items-center gap-2 text-base font-medium text-blue-800 mb-2">
                          <Home className="h-5 w-5" />
                          الإيجار الشهري
                        </div>
                        <p className="text-xs text-blue-700 mb-3">
                          القيمة المعتمدة لهذا الشهر تأتي من «سجل الإيجار». التعديل هنا يحدّث القيمة الافتراضية
                          العامة للفرع فقط (لتوافق الإصدار السابق). للتغييرات بفترات صلاحية استخدم صفحة «سجل الإيجار».
                        </p>
                        <div className="flex items-center gap-3">
                          <Label className="w-40">الإيجار الافتراضي للفرع</Label>
                          <Input
                            type="number"
                            placeholder="0"
                            value={branchRentForm || ""}
                            onChange={(e) => setBranchRentForm(parseFloat(e.target.value) || 0)}
                            className="flex-1"
                            data-testid="input-monthly-rent"
                          />
                          <span className="text-muted-foreground">ريال</span>
                        </div>
                      </div>

                      <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 text-base font-medium text-red-800">
                            <Package className="h-5 w-5" />
                            تكلفة البضاعة المباعة (COGS)
                          </div>
                          {isAdmin && !editingCogsRatio && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setCogsRatioDraft(String(Math.round(cogsRatio * 10000) / 100));
                                setEditingCogsRatio(true);
                              }}
                              data-testid="button-edit-cogs-ratio"
                            >
                              تعديل النسبة
                            </Button>
                          )}
                        </div>

                        {editingCogsRatio ? (
                          <div className="bg-white rounded p-3 space-y-2 mb-3">
                            <Label className="text-xs">النسبة الجديدة (%)</Label>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                step="0.1"
                                min="0.1"
                                max="99.9"
                                value={cogsRatioDraft}
                                onChange={(e) => setCogsRatioDraft(e.target.value)}
                                className="flex-1"
                                data-testid="input-cogs-ratio"
                              />
                              <span className="text-muted-foreground">%</span>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => {
                                  const pct = parseFloat(cogsRatioDraft);
                                  if (!Number.isFinite(pct) || pct <= 0 || pct >= 100) {
                                    toast({ title: "أدخل نسبة بين 0 و 100", variant: "destructive" });
                                    return;
                                  }
                                  saveCogsRatioMutation.mutate(pct);
                                }}
                                disabled={saveCogsRatioMutation.isPending}
                                data-testid="button-save-cogs-ratio"
                              >
                                حفظ
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingCogsRatio(false)}
                              >
                                إلغاء
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              تطبيقها على كل الفروع وكل الشهور.
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs text-red-700 mb-3">
                            تُحتسب تلقائياً = <strong>{(cogsRatio * 100).toFixed(1)}% من صافي المبيعات</strong>
                            {isAdmin ? " (يمكن للأدمن تعديل النسبة)." : " (نسبة ثابتة يحددها الأدمن، لا تُدخل يدوياً)."}
                          </p>
                        )}

                        {(() => {
                          const ns = enhancedPnL?.totals?.netSales || 0;
                          const cogs = Math.round(ns * cogsRatio);
                          return (
                            <div className="flex items-center justify-between bg-white rounded p-2 text-sm">
                              <span className="text-muted-foreground">القيمة المحسوبة لهذا الشهر</span>
                              <span className="font-bold text-red-700" data-testid="text-cogs-auto">
                                {formatCurrency(cogs)}
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {monthlyInputsSection === "variable" && (
                    <div className="space-y-4">
                      <div className="p-4 rounded-lg bg-orange-50 border border-orange-200">
                        <div className="flex items-center gap-2 text-base font-medium text-orange-800 mb-3">
                          <Lightbulb className="h-5 w-5" />
                          المرافق (كهرباء، ماء، اتصالات)
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {([
                            ["electricityCost", "الكهرباء", "input-electricity"],
                            ["waterCost", "المياه", "input-water"],
                            ["utilitiesOther", "مرافق أخرى", "input-utilities-other"],
                            ["internetCost", "إنترنت واتصالات", "input-internet"],
                          ] as const).map(([key, label, tid]) => (
                            <div key={key} className="space-y-1">
                              <Label className="text-xs">{label}</Label>
                              <Input
                                type="number"
                                placeholder="0"
                                value={(monthlyInputsForm as any)[key] || ""}
                                onChange={(e) => setMonthlyInputsForm({...monthlyInputsForm, [key]: parseFloat(e.target.value) || 0})}
                                data-testid={tid}
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                        <div className="flex items-center gap-2 text-base font-medium text-amber-800 mb-3">
                          <Receipt className="h-5 w-5" />
                          مصاريف عامة شهرية
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {([
                            ["governmentFees", "رسوم حكومية (بلدية، رخص)", "input-government"],
                            ["insuranceCost", "تأمين عام/أصول", "input-insurance"],
                            ["subscriptionsCost", "اشتراكات يدوية (سوفتوير)", "input-subscriptions"],
                            ["securityCost", "حراسة ونظافة", "input-security"],
                            ["bankFees", "عمولات بنكية ونقاط بيع", "input-bank-fees"],
                            ["fuelCost", "وقود ومواصلات", "input-fuel"],
                          ] as const).map(([key, label, tid]) => (
                            <div key={key} className="space-y-1">
                              <Label className="text-xs">{label}</Label>
                              <Input
                                type="number"
                                placeholder="0"
                                value={(monthlyInputsForm as any)[key] || ""}
                                onChange={(e) => setMonthlyInputsForm({...monthlyInputsForm, [key]: parseFloat(e.target.value) || 0})}
                                data-testid={tid}
                              />
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-amber-700 mt-2">
                          هذه القيم تُدخل يدوياً لكل شهر. المصاريف المتكررة الثابتة قيمتها (مثل اشتراك نظام POS الشهري)
                          تُدار من <button type="button" onClick={() => { setShowMonthlyInputs(false); navigate("/pnl-recurring-expenses"); }} className="text-blue-600 underline">صفحة المصاريف المتكررة</button>.
                        </p>
                      </div>
                    </div>
                  )}

                  {monthlyInputsSection === "operating" && (
                    <div className="p-4 rounded-lg bg-purple-50 border border-purple-200">
                      <div className="flex items-center gap-2 text-base font-medium text-purple-800 mb-3">
                        <ShoppingCart className="h-5 w-5" />
                        تكاليف تشغيلية متفرقة
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {([
                          ["maintenanceCost", "الصيانة", "input-maintenance"],
                          ["marketingCost", "التسويق", "input-marketing"],
                          ["suppliesCost", "المستلزمات", "input-supplies"],
                          ["otherCosts", "تكاليف أخرى متفرقة", "input-other-costs"],
                        ] as const).map(([key, label, tid]) => (
                          <div key={key} className="space-y-1">
                            <Label className="text-xs">{label}</Label>
                            <Input
                              type="number"
                              placeholder="0"
                              value={(monthlyInputsForm as any)[key] || ""}
                              onChange={(e) => setMonthlyInputsForm({...monthlyInputsForm, [key]: parseFloat(e.target.value) || 0})}
                              data-testid={tid}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Live preview side */}
              {(() => {
                const f = monthlyInputsForm;
                const utilities = (f.electricityCost || 0) + (f.waterCost || 0) + (f.utilitiesOther || 0) + (f.internetCost || 0);
                const general = (f.governmentFees || 0) + (f.insuranceCost || 0) + (f.subscriptionsCost || 0)
                  + (f.securityCost || 0) + (f.bankFees || 0) + (f.fuelCost || 0);
                const operating = (f.maintenanceCost || 0) + (f.marketingCost || 0) + (f.suppliesCost || 0) + (f.otherCosts || 0);
                // Best-effort live preview using current enhancedPnL totals as
                // a baseline. Replaces only the editable bits (utilities, general,
                // operating, COGS, rent override) with the form values so the
                // user sees the impact in real time before saving.
                const baseline = enhancedPnL?.totals;
                const netSales = baseline?.netSales || 0;
                const employeeCosts = baseline?.employeeCosts?.total || 0;
                const recurring = baseline?.recurringExpenses?.total || 0;
                const rent = branchRentForm || baseline?.rent || 0;
                // COGS = admin-configured ratio × net sales (default 30%).
                const cogs = Math.round(netSales * cogsRatio);
                const totalOpex = employeeCosts + rent + utilities + general + operating + recurring;
                const netProfit = netSales - cogs - totalOpex;
                const margin = netSales > 0 ? (netProfit / netSales) * 100 : 0;
                return (
                  <div className="bg-gradient-to-b from-slate-50 to-white border rounded-lg p-4 space-y-2 text-sm self-start sticky top-0">
                    <div className="font-semibold text-base flex items-center gap-2 mb-2">
                      <Target className="h-4 w-4 text-amber-600" />
                      معاينة فورية
                    </div>
                    <div className="flex justify-between text-muted-foreground"><span>صافي المبيعات</span><span>{formatCurrency(netSales)}</span></div>
                    <div className="flex justify-between"><span>تكلفة البضاعة</span><span>- {formatCurrency(cogs)}</span></div>
                    <div className="flex justify-between"><span>رواتب وأجور</span><span>- {formatCurrency(employeeCosts)}</span></div>
                    <div className="flex justify-between"><span>الإيجار</span><span>- {formatCurrency(rent)}</span></div>
                    <div className="flex justify-between"><span>مرافق</span><span>- {formatCurrency(utilities)}</span></div>
                    <div className="flex justify-between"><span>عامة</span><span>- {formatCurrency(general)}</span></div>
                    <div className="flex justify-between"><span>تشغيلية</span><span>- {formatCurrency(operating)}</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>متكررة (تلقائي)</span><span>- {formatCurrency(recurring)}</span></div>
                    <Separator />
                    <div className={`flex justify-between font-bold text-lg ${netProfit >= 0 ? "text-green-700" : "text-red-700"}`}>
                      <span>صافي الربح</span>
                      <span data-testid="preview-net-profit">{formatCurrency(netProfit)}</span>
                    </div>
                    <div className={`flex justify-between text-xs ${netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                      <span>هامش الربح</span>
                      <span>{margin.toFixed(2)}%</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setShowMonthlyInputs(false)}>
                إلغاء
              </Button>
              <Button
                onClick={handleSaveMonthlyData}
                disabled={saveBranchSettingsMutation.isPending || saveMonthlyInputsMutation.isPending || !selectedBranchId}
                className="gap-2 bg-amber-600 hover:bg-amber-700"
                data-testid="button-save-monthly-inputs"
              >
                {(saveBranchSettingsMutation.isPending || saveMonthlyInputsMutation.isPending) && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                حفظ البيانات
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
