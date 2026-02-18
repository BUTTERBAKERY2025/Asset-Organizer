import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useBranches } from "@/hooks/useBranches";
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
    ["  - رسوم غير السعوديين", totals.employeeCosts?.nonSaudiCosts || 0, "", "رخصة عمل + مقابل مالي + إقامة + تأمين"],
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

  // P&L Monthly Inputs (rent, utilities, COGS, etc.)
  const [showMonthlyInputs, setShowMonthlyInputs] = useState(false);
  const [monthlyInputsForm, setMonthlyInputsForm] = useState({
    electricityCost: 0,
    waterCost: 0,
    utilitiesOther: 0,
    cogsCost: 0,
    maintenanceCost: 0,
    marketingCost: 0,
    suppliesCost: 0,
    otherCosts: 0,
  });
  const [branchRentForm, setBranchRentForm] = useState(0);

  // Fetch branch settings (fixed rent)
  const { data: branchSettings, refetch: refetchBranchSettings } = useQuery({
    queryKey: ["/api/pnl/branch-settings", selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return null;
      const res = await fetch(`/api/pnl/branch-settings/${selectedBranchId}`);
      if (!res.ok) return null;
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
      if (!res.ok) return null;
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
        otherCosts: monthlyInputs.otherCosts || 0,
      });
    }
  }, [monthlyInputs]);

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
    
    // Save monthly inputs
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
        totalRevenue: enhanced.grossSales || 0,
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
        revenuePerEmployee: enhanced.employeeCount > 0 ? (enhanced.grossSales || 0) / enhanced.employeeCount : 0,
        employeeCount: enhanced.employeeCount || 0,
        rating: netMargin >= 20 ? "excellent" : netMargin >= 15 ? "good" : netMargin >= 10 ? "average" : "poor",
        wastePercentage: 0,
        wastePct: 0,
        rentToRevenuePct: rentToRevenue,
        salaryToRevenuePct: salaryToSales,
        salaryToSalesPct: salaryToSales,
        laborProductivity: enhanced.employeeCount > 0 ? (enhanced.grossSales || 0) / enhanced.employeeCount : 0,
        invoiceCount: enhanced.journalCount || 0,
        avgInvoiceValue: enhanced.journalCount > 0 ? (enhanced.grossSales || 0) / enhanced.journalCount : 0,
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
      <div className="p-4 md:p-8 lg:p-10 max-w-6xl mx-auto space-y-4" dir="rtl">
        <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2 sm:gap-4">
              <Button
                variant="ghost"
                onClick={() => navigate("/attendance-dashboard")}
                className="h-11 w-11 sm:h-8 sm:w-8 rounded-full hover:bg-muted p-0"
                data-testid="button-back"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2 sm:gap-3">
                  <BarChart3 className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
                  لوحة الأرباح والخسائر (P&L)
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground mt-1">تحليل الأداء المالي للفروع</p>
              </div>
            </div>
            {selectedPeriodId && (
              <div className="flex gap-2 flex-wrap">
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
            )}
          </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              اختيار الفترة المالية
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                      <Card className="border-l-4 border-l-blue-500">
                        <CardContent className="p-3 sm:p-4 md:p-6">
                          <div className="flex items-center justify-between">
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm text-muted-foreground">إجمالي الإيرادات</p>
                              <p className="text-lg sm:text-xl md:text-2xl font-bold truncate">{formatCurrency(metrics.totalRevenue)}</p>
                            </div>
                            <DollarSign className="h-8 w-8 sm:h-10 sm:w-10 text-blue-500 opacity-50 shrink-0" />
                          </div>
                          <div className="mt-2 text-[10px] sm:text-xs text-muted-foreground">
                            {metrics.invoiceCount} فاتورة - متوسط {formatCurrency(metrics.avgInvoiceValue)}
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border-l-4 border-l-green-500">
                        <CardContent className="p-3 sm:p-4 md:p-6">
                          <div className="flex items-center justify-between">
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm text-muted-foreground">إجمالي الربح</p>
                              <p className="text-lg sm:text-xl md:text-2xl font-bold truncate">{formatCurrency(metrics.grossProfit)}</p>
                            </div>
                            <TrendingUp className="h-8 w-8 sm:h-10 sm:w-10 text-green-500 opacity-50 shrink-0" />
                          </div>
                          <div className="mt-2 flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-2">
                            <Badge variant="secondary" className="text-[10px] sm:text-xs">{formatPercent(metrics.grossMarginPct)}</Badge>
                            <span className="text-[10px] sm:text-xs text-muted-foreground">هامش إجمالي</span>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className={`border-l-4 ${metrics.netMarginPct >= 20 ? "border-l-emerald-500" : metrics.netMarginPct >= 15 ? "border-l-blue-500" : metrics.netMarginPct >= 10 ? "border-l-yellow-500" : "border-l-red-500"}`}>
                        <CardContent className="p-3 sm:p-4 md:p-6">
                          <div className="flex items-center justify-between">
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm text-muted-foreground">صافي الربح</p>
                              <p className={`text-lg sm:text-xl md:text-2xl font-bold truncate ${metrics.netProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                {formatCurrency(metrics.netProfit)}
                              </p>
                            </div>
                            {metrics.netProfit >= 0 ? (
                              <TrendingUp className="h-8 w-8 sm:h-10 sm:w-10 text-emerald-500 opacity-50 shrink-0" />
                            ) : (
                              <TrendingDown className="h-8 w-8 sm:h-10 sm:w-10 text-red-500 opacity-50 shrink-0" />
                            )}
                          </div>
                          <div className="mt-2 flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] sm:text-xs text-muted-foreground">هامش صافي الربح:</span>
                              <Badge 
                                className={`text-[10px] sm:text-xs ${
                                  metrics.netMarginPct >= 20 ? "bg-green-100 text-green-800" : 
                                  metrics.netMarginPct >= 15 ? "bg-blue-100 text-blue-800" : 
                                  metrics.netMarginPct >= 10 ? "bg-yellow-100 text-yellow-800" : 
                                  "bg-red-100 text-red-800"
                                }`}
                              >
                                {formatPercent(metrics.netMarginPct)}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1">
                              {metrics.netMarginPct >= 20 ? (
                                <Badge className="bg-green-500 text-white text-[9px]">✓ ضمن الهدف (20-25%)</Badge>
                              ) : (
                                <Badge className="bg-orange-500 text-white text-[9px]">الهدف: 20-25%</Badge>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border-l-4 border-l-amber-500">
                        <CardContent className="p-3 sm:p-4 md:p-6">
                          <div className="flex items-center justify-between">
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm text-muted-foreground">نقطة التعادل</p>
                              <p className="text-lg sm:text-xl md:text-2xl font-bold truncate">{formatCurrency(metrics.breakEvenSales)}</p>
                            </div>
                            <Target className="h-8 w-8 sm:h-10 sm:w-10 text-amber-500 opacity-50 shrink-0" />
                          </div>
                          <div className="mt-2 text-[10px] sm:text-xs text-muted-foreground">
                            {metrics.totalRevenue >= metrics.breakEvenSales ? (
                              <span className="text-green-600">✓ تجاوز التعادل</span>
                            ) : (
                              <span className="text-red-600">✗ قبل التعادل</span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                      <Card>
                        <CardContent className="p-3 sm:p-4 md:p-6">
                          <div className="flex items-center gap-2 mb-2">
                            <Users className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500" />
                            <span className="font-medium text-xs sm:text-sm">نسبة الرواتب للمبيعات</span>
                          </div>
                          <p className="text-xl sm:text-2xl md:text-3xl font-bold">{formatPercent(metrics.salaryToSalesPct)}</p>
                          <div className="mt-2">
                            {metrics.salaryToSalesPct <= 25 ? (
                              <Badge className="bg-green-100 text-green-800 text-[10px] sm:text-xs">ممتاز</Badge>
                            ) : metrics.salaryToSalesPct <= 35 ? (
                              <Badge className="bg-yellow-100 text-yellow-800 text-[10px] sm:text-xs">مقبول</Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-800 text-[10px] sm:text-xs">مرتفع</Badge>
                            )}
                          </div>
                          <div className="mt-2 pt-2 border-t border-dashed">
                            <p className="text-[9px] sm:text-[10px] text-muted-foreground leading-relaxed">
                              <span className="font-semibold">طريقة الحساب:</span> (إجمالي تكاليف الموظفين ÷ صافي المبيعات) × 100
                            </p>
                            <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-1">
                              <span className="text-green-600">≤25% ممتاز</span> • <span className="text-yellow-600">25-35% مقبول</span> • <span className="text-red-600">&gt;35% مرتفع</span>
                            </p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-3 sm:p-4 md:p-6">
                          <div className="flex items-center gap-2 mb-2">
                            <Home className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />
                            <span className="font-medium text-xs sm:text-sm">نسبة الإيجار للإيرادات</span>
                          </div>
                          <p className="text-xl sm:text-2xl md:text-3xl font-bold">{formatPercent(metrics.rentToRevenuePct)}</p>
                          <div className="mt-2">
                            {metrics.rentToRevenuePct <= 10 ? (
                              <Badge className="bg-green-100 text-green-800 text-[10px] sm:text-xs">ممتاز</Badge>
                            ) : metrics.rentToRevenuePct <= 15 ? (
                              <Badge className="bg-yellow-100 text-yellow-800 text-[10px] sm:text-xs">مقبول</Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-800 text-[10px] sm:text-xs">مرتفع</Badge>
                            )}
                          </div>
                          <div className="mt-2 pt-2 border-t border-dashed">
                            <p className="text-[9px] sm:text-[10px] text-muted-foreground leading-relaxed">
                              <span className="font-semibold">طريقة الحساب:</span> (الإيجار الشهري ÷ صافي المبيعات) × 100
                            </p>
                            <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-1">
                              <span className="text-green-600">≤10% ممتاز</span> • <span className="text-yellow-600">10-15% مقبول</span> • <span className="text-red-600">&gt;15% مرتفع</span>
                            </p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-3 sm:p-4 md:p-6">
                          <div className="flex items-center gap-2 mb-2">
                            <Package className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />
                            <span className="font-medium text-xs sm:text-sm">نسبة الهدر</span>
                          </div>
                          <p className="text-xl sm:text-2xl md:text-3xl font-bold">{formatPercent(metrics.wastePct)}</p>
                          <div className="mt-2">
                            {metrics.wastePct <= 3 ? (
                              <Badge className="bg-green-100 text-green-800 text-[10px] sm:text-xs">ممتاز</Badge>
                            ) : metrics.wastePct <= 5 ? (
                              <Badge className="bg-yellow-100 text-yellow-800 text-[10px] sm:text-xs">مقبول</Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-800 text-[10px] sm:text-xs">مرتفع</Badge>
                            )}
                          </div>
                          <div className="mt-2 pt-2 border-t border-dashed">
                            <p className="text-[9px] sm:text-[10px] text-muted-foreground leading-relaxed">
                              <span className="font-semibold">طريقة الحساب:</span> (قيمة الهدر ÷ إجمالي المبيعات) × 100
                            </p>
                            <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-1">
                              <span className="text-green-600">≤3% ممتاز</span> • <span className="text-yellow-600">3-5% مقبول</span> • <span className="text-red-600">&gt;5% مرتفع</span>
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Advanced Financial KPIs */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                      <Card className="border-l-4 border-l-indigo-500">
                        <CardContent className="p-3 sm:p-4 md:p-6">
                          <div className="flex items-center gap-2 mb-2">
                            <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-500" />
                            <span className="font-medium text-xs sm:text-sm">EBITDA</span>
                          </div>
                          <p className="text-lg sm:text-xl md:text-2xl font-bold truncate">{formatCurrency(metrics.ebitda || 0)}</p>
                          <div className="mt-2 flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-2">
                            <Badge variant="secondary" className="text-[10px] sm:text-xs">{formatPercent(metrics.ebitdaMarginPct || 0)}</Badge>
                            <span className="text-[10px] sm:text-xs text-muted-foreground">هامش EBITDA</span>
                          </div>
                          <div className="mt-2 pt-2 border-t border-dashed">
                            <p className="text-[9px] sm:text-[10px] text-muted-foreground leading-relaxed">
                              <span className="font-semibold">طريقة الحساب:</span> صافي الربح + الإهلاك + الفوائد + الضرائب
                            </p>
                            <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-1">
                              <span className="font-semibold">هامش EBITDA:</span> (EBITDA ÷ صافي المبيعات) × 100
                            </p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border-l-4 border-l-cyan-500">
                        <CardContent className="p-3 sm:p-4 md:p-6">
                          <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-500" />
                            <span className="font-medium text-xs sm:text-sm">هامش المساهمة</span>
                          </div>
                          <p className="text-lg sm:text-xl md:text-2xl font-bold truncate">{formatCurrency(metrics.contributionMargin || 0)}</p>
                          <div className="mt-2 flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-2">
                            <Badge variant="secondary" className="text-[10px] sm:text-xs">{formatPercent(metrics.contributionMarginPct || 0)}</Badge>
                            <span className="text-[10px] sm:text-xs text-muted-foreground">من الإيرادات</span>
                          </div>
                          <div className="mt-2 pt-2 border-t border-dashed">
                            <p className="text-[9px] sm:text-[10px] text-muted-foreground leading-relaxed">
                              <span className="font-semibold">طريقة الحساب:</span> صافي المبيعات - التكاليف المتغيرة
                            </p>
                            <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-1">
                              <span className="font-semibold">النسبة:</span> (هامش المساهمة ÷ صافي المبيعات) × 100
                            </p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border-l-4 border-l-pink-500">
                        <CardContent className="p-3 sm:p-4 md:p-6">
                          <div className="flex items-center gap-2 mb-2">
                            <Calculator className="h-4 w-4 sm:h-5 sm:w-5 text-pink-500" />
                            <span className="font-medium text-xs sm:text-sm">الربح التشغيلي</span>
                          </div>
                          <p className={`text-lg sm:text-xl md:text-2xl font-bold truncate ${(metrics.operatingProfit || 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                            {formatCurrency(metrics.operatingProfit || 0)}
                          </p>
                          <div className="mt-2 flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-2">
                            <Badge variant={(metrics.operatingProfit || 0) >= 0 ? "default" : "destructive"} className="text-[10px] sm:text-xs">
                              {formatPercent(metrics.operatingMarginPct || 0)}
                            </Badge>
                            <span className="text-[10px] sm:text-xs text-muted-foreground">هامش تشغيلي</span>
                          </div>
                          <div className="mt-2 pt-2 border-t border-dashed">
                            <p className="text-[9px] sm:text-[10px] text-muted-foreground leading-relaxed">
                              <span className="font-semibold">طريقة الحساب:</span> إجمالي الربح - المصروفات التشغيلية
                            </p>
                            <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-1">
                              <span className="font-semibold">الهامش:</span> (الربح التشغيلي ÷ صافي المبيعات) × 100
                            </p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border-l-4 border-l-violet-500">
                        <CardContent className="p-3 sm:p-4 md:p-6">
                          <div className="flex items-center gap-2 mb-2">
                            <Users className="h-4 w-4 sm:h-5 sm:w-5 text-violet-500" />
                            <span className="font-medium text-xs sm:text-sm">إنتاجية العمالة</span>
                          </div>
                          <p className="text-lg sm:text-xl md:text-2xl font-bold truncate">{formatCurrency(metrics.revenuePerEmployee || 0)}</p>
                          <div className="mt-2">
                            <span className="text-[10px] sm:text-xs text-muted-foreground">
                              لكل موظف من {metrics.employeeCount || 0} موظف
                            </span>
                          </div>
                          {metrics.laborProductivity && metrics.laborProductivity > 0 && (
                            <div className="mt-1">
                              <Badge variant="outline" className="text-[10px] sm:text-xs">
                                {formatPercent(metrics.laborProductivity)} عائد للراتب
                              </Badge>
                            </div>
                          )}
                          <div className="mt-2 pt-2 border-t border-dashed">
                            <p className="text-[9px] sm:text-[10px] text-muted-foreground leading-relaxed">
                              <span className="font-semibold">طريقة الحساب:</span> إجمالي المبيعات ÷ عدد الموظفين
                            </p>
                            <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-1">
                              <span className="font-semibold">عائد الراتب:</span> (إجمالي المبيعات ÷ إجمالي الرواتب) × 100
                            </p>
                          </div>
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
                        يرجى إدخال بيانات التكاليف الشهرية للفترة المحددة
                      </p>
                      <Button
                        onClick={() => setShowMonthlyInputs(true)}
                      >
                        <Plus className="h-4 w-4 ml-2" />
                        إدخال بيانات التكاليف الشهرية
                      </Button>
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

        {/* Monthly Inputs Dialog - نموذج إدخال التكاليف الشهرية */}
        <Dialog open={showMonthlyInputs} onOpenChange={setShowMonthlyInputs}>
          <DialogContent className="max-w-2xl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Calculator className="h-5 w-5 text-amber-600" />
                إدخال بيانات التكاليف الشهرية - {MONTHS_AR[selectedMonth - 1]} {selectedYear}
              </DialogTitle>
              <CardDescription>
                أدخل بيانات الإيجار والمرافق وتكلفة البضاعة المباعة والتكاليف الأخرى
              </CardDescription>
            </DialogHeader>
            
            <div className="space-y-6 max-h-[60vh] overflow-y-auto py-4">
              {/* Branch Rent - Fixed */}
              <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                <div className="flex items-center gap-2 text-base font-medium text-blue-800 mb-3">
                  <Home className="h-5 w-5" />
                  الإيجار الشهري الثابت للفرع
                </div>
                <div className="flex items-center gap-3">
                  <Label className="w-32">الإيجار الشهري</Label>
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

              {/* Utilities - Variable */}
              <div className="p-4 rounded-lg bg-orange-50 border border-orange-200">
                <div className="flex items-center gap-2 text-base font-medium text-orange-800 mb-3">
                  <Lightbulb className="h-5 w-5" />
                  المرافق (متغيرة شهرياً)
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>الكهرباء</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={monthlyInputsForm.electricityCost || ""}
                      onChange={(e) => setMonthlyInputsForm({...monthlyInputsForm, electricityCost: parseFloat(e.target.value) || 0})}
                      data-testid="input-electricity"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>المياه</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={monthlyInputsForm.waterCost || ""}
                      onChange={(e) => setMonthlyInputsForm({...monthlyInputsForm, waterCost: parseFloat(e.target.value) || 0})}
                      data-testid="input-water"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>مرافق أخرى</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={monthlyInputsForm.utilitiesOther || ""}
                      onChange={(e) => setMonthlyInputsForm({...monthlyInputsForm, utilitiesOther: parseFloat(e.target.value) || 0})}
                      data-testid="input-utilities-other"
                    />
                  </div>
                </div>
              </div>

              {/* COGS - Cost of Goods Sold */}
              <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                <div className="flex items-center gap-2 text-base font-medium text-red-800 mb-3">
                  <Package className="h-5 w-5" />
                  تكلفة البضاعة المباعة (COGS)
                </div>
                <div className="flex items-center gap-3">
                  <Label className="w-32">إجمالي COGS</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={monthlyInputsForm.cogsCost || ""}
                    onChange={(e) => setMonthlyInputsForm({...monthlyInputsForm, cogsCost: parseFloat(e.target.value) || 0})}
                    className="flex-1"
                    data-testid="input-cogs"
                  />
                  <span className="text-muted-foreground">ريال</span>
                </div>
              </div>

              {/* Other Operating Costs */}
              <div className="p-4 rounded-lg bg-purple-50 border border-purple-200">
                <div className="flex items-center gap-2 text-base font-medium text-purple-800 mb-3">
                  <Receipt className="h-5 w-5" />
                  تكاليف تشغيلية أخرى
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>الصيانة</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={monthlyInputsForm.maintenanceCost || ""}
                      onChange={(e) => setMonthlyInputsForm({...monthlyInputsForm, maintenanceCost: parseFloat(e.target.value) || 0})}
                      data-testid="input-maintenance"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>التسويق</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={monthlyInputsForm.marketingCost || ""}
                      onChange={(e) => setMonthlyInputsForm({...monthlyInputsForm, marketingCost: parseFloat(e.target.value) || 0})}
                      data-testid="input-marketing"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>المستلزمات</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={monthlyInputsForm.suppliesCost || ""}
                      onChange={(e) => setMonthlyInputsForm({...monthlyInputsForm, suppliesCost: parseFloat(e.target.value) || 0})}
                      data-testid="input-supplies"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>تكاليف أخرى</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={monthlyInputsForm.otherCosts || ""}
                      onChange={(e) => setMonthlyInputsForm({...monthlyInputsForm, otherCosts: parseFloat(e.target.value) || 0})}
                      data-testid="input-other-costs"
                    />
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setShowMonthlyInputs(false)}>
                إلغاء
              </Button>
              <Button
                onClick={handleSaveMonthlyData}
                disabled={saveBranchSettingsMutation.isPending || saveMonthlyInputsMutation.isPending || !selectedBranchId}
                className="gap-2"
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
      </div>
    </Layout>
  );
}
