import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLocation, Link } from "wouter";
import { useBranches } from "@/hooks/useBranches";
import { 
  BarChart3, TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users, Factory, 
  CheckCircle, XCircle, Clock, AlertTriangle, Download, Wallet, CreditCard, Truck,
  Building2, Activity, Target, Package, FileText, Eye, Image, FileDown, Filter,
  Calendar, RefreshCw, Printer, ExternalLink, Receipt, ClipboardList, PieChart as PieChartIcon,
  Gift, Trophy, User, ChevronDown, ArrowRight, Zap
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area
} from "recharts";
import type { Branch, CashierSalesJournal, JournalAttachment } from "@shared/schema";
import { printHtmlContent } from "@/lib/print-utils";
import { useTranslation } from "react-i18next";
import { KpiCard, type KpiTone, type KpiIcon } from "@/components/dashboard/kpi-card";

const TONE_FROM_BG: Array<[RegExp, KpiTone]> = [
  [/emerald|green/i, "money"],
  [/blue|sky|indigo/i, "production"],
  [/amber|yellow|orange/i, "inventory"],
  [/rose|red|pink/i, "alert"],
  [/violet|purple|fuchsia/i, "violet"],
  [/teal|cyan/i, "people"],
  [/gray|slate|zinc|neutral|stone/i, "neutral"],
];

function resolveTone(bgColor?: string, color?: string): KpiTone {
  const src = `${bgColor ?? ""} ${color ?? ""}`;
  for (const [re, tone] of TONE_FROM_BG) if (re.test(src)) return tone;
  return "primary";
}

const DELIVERY_APP_COLORS: Record<string, string> = {
  hunger_station: "#FF5A00",
  toyou: "#00B4D8",
  jahez: "#6366F1",
  marsool: "#10B981",
  keeta: "#F59E0B",
  the_chefs: "#EC4899",
};

const DELIVERY_APP_KEYS = ["hunger_station", "toyou", "jahez", "marsool", "keeta", "the_chefs"];

const REPORT_TYPE_ICONS: Record<string, React.ElementType> = {
  all: BarChart3,
  cashier: Wallet,
  sales: DollarSign,
  apps: Truck,
  shifts: Clock,
  production: Factory,
  quality: CheckCircle,
  "event-pos": Zap,
};

const REPORT_TYPE_KEYS = ["all", "cashier", "sales", "apps", "shifts", "production", "quality", "event-pos"];

const COLORS = ["#10B981", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16"];

interface OperationsReport {
  salesReport: {
    totalSales: number;
    cashSales: number;
    networkSales: number;
    deliverySales: number;
    totalTransactions: number;
    averageTicket: number;
    totalShortages: number;
    shortageAmount: number;
    totalSurpluses: number;
    surplusAmount: number;
    journalsByStatus: { status: string; count: number }[];
    paymentMethodBreakdown: { method: string; amount: number; count: number }[];
    dailySales: { date: string; sales: number; transactions: number }[];
  };
  productionReport: {
    totalOrders: number;
    pendingOrders: number;
    inProgressOrders: number;
    completedOrders: number;
    cancelledOrders: number;
    totalQuantityProduced: number;
    qualityPassRate: number;
    qualityChecks: { status: string; count: number }[];
    ordersByProduct: { productName: string; quantity: number; orderCount: number }[];
    dailyProduction: { date: string; quantity: number; orders: number }[];
    actualProduction?: {
      totalBatches: number;
      finishedBatches: number;
      inProgressBatches: number;
      totalQuantity: number;
      byDestination: { destination: string; count: number; quantity: number }[];
      byCategory: { category: string; count: number; quantity: number }[];
      byProduct: { productName: string; quantity: number; batchCount: number }[];
      dailyActual: { date: string; quantity: number; batches: number }[];
      byChef: { chefName: string; batchCount: number; totalQuantity: number }[];
    };
  };
  shiftsReport: {
    totalShifts: number;
    shiftsWithEmployees: number;
    totalEmployeeAssignments: number;
    shiftsByType: { type: string; count: number }[];
    employeesByRole: { role: string; count: number }[];
  };
  branchComparison: {
    branchId: string;
    branchName: string;
    totalSales: number;
    totalOrders: number;
    qualityPassRate: number;
    averageTicket: number;
  }[];
  cashierJournals?: CashierSalesJournal[];
}

function KPICard({
  title,
  value,
  icon: Icon,
  trend,
  trendLabel,
  color,
  bgColor,
  onClick,
  subtitle,
  progress,
}: {
  title: string;
  value: string | number;
  icon: KpiIcon;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  color?: string;
  bgColor?: string;
  onClick?: () => void;
  subtitle?: string;
  progress?: number;
}) {
  const tone = resolveTone(bgColor, color);
  const subLabel = subtitle || (trend ? undefined : trendLabel);
  const testId = `kpi-card-${title.replace(/\s+/g, "-")}`;

  return (
    <KpiCard
      label={title}
      value={value}
      icon={Icon}
      tone={tone}
      onClick={onClick}
      subLabel={subLabel}
      data-testid={testId}
    >
      {trend && trendLabel && (
        <div className="flex items-center gap-1 mt-1 text-xs">
          {trend === "up" && <TrendingUp className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />}
          {trend === "down" && <TrendingDown className="w-3 h-3 text-rose-500 dark:text-rose-400" />}
          <span
            className={
              trend === "up"
                ? "text-emerald-600 dark:text-emerald-400"
                : trend === "down"
                ? "text-rose-600 dark:text-rose-400"
                : "text-muted-foreground"
            }
          >
            {trendLabel}
          </span>
        </div>
      )}
      {progress !== undefined && (
        <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              tone === "money"
                ? "bg-emerald-500"
                : tone === "alert"
                ? "bg-rose-500"
                : tone === "inventory"
                ? "bg-amber-500"
                : tone === "violet"
                ? "bg-violet-500"
                : tone === "people"
                ? "bg-teal-500"
                : "bg-blue-500"
            }`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      )}
    </KpiCard>
  );
}

function AlertBanner({ alerts }: { alerts: { type: 'warning' | 'danger' | 'info'; message: string; count?: number }[] }) {
  if (!alerts || alerts.length === 0) return null;
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
      {alerts.map((alert, i) => (
        <div 
          key={i} 
          className={`flex items-center gap-3 p-3 rounded-lg border ${
            alert.type === 'danger' ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300' :
            alert.type === 'warning' ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300' :
            'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900 text-blue-800 dark:text-blue-300'
          }`}
        >
          {alert.type === 'danger' && <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0" />}
          {alert.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />}
          {alert.type === 'info' && <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{alert.message}</p>
          </div>
          {alert.count !== undefined && (
            <Badge variant={alert.type === 'danger' ? 'destructive' : 'secondary'} className="flex-shrink-0">
              {alert.count}
            </Badge>
          )}
        </div>
      ))}
    </div>
  );
}

function QuickStatsRow({ report, cashierJournals, hasActiveFilters }: { report: OperationsReport; cashierJournals: CashierSalesJournal[]; hasActiveFilters: boolean }) {
  const { t } = useTranslation('operations');
  const shortageCount = cashierJournals.filter(j => j.discrepancyStatus === 'shortage').length;
  const pendingApproval = cashierJournals.filter(j => j.status === 'submitted').length;
  
  const filteredTotalSales = hasActiveFilters
    ? cashierJournals.reduce((sum, j) => sum + (j.totalSales || 0), 0)
    : report.salesReport.totalSales;
  const filteredTransactions = hasActiveFilters
    ? cashierJournals.reduce((sum, j) => sum + (j.transactionCount || 0), 0)
    : report.salesReport.totalTransactions;
  
  const formatCurrency = (amount: number) => new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(amount);
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-3 p-4 rounded-xl bg-card border border-border">
      <div className="text-center">
        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(filteredTotalSales)}</p>
        <p className="text-xs text-muted-foreground">{t('quickStats.totalSales')}</p>
      </div>
      <div className="text-center">
        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{filteredTransactions}</p>
        <p className="text-xs text-muted-foreground">{t('quickStats.transactions')}</p>
      </div>
      <div className="text-center">
        <p className="text-2xl font-bold text-violet-600 dark:text-violet-400">
          {report.productionReport.actualProduction?.totalBatches || report.productionReport.totalOrders}
        </p>
        <p className="text-xs text-muted-foreground">{t('quickStats.productionBatches')}</p>
      </div>
      <div className="text-center">
        <p className={`text-2xl font-bold ${shortageCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{shortageCount}</p>
        <p className="text-xs text-muted-foreground">{t('quickStats.shortageCases')}</p>
      </div>
      <div className="text-center">
        <p className={`text-2xl font-bold ${pendingApproval > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{pendingApproval}</p>
        <p className="text-xs text-muted-foreground">{t('quickStats.pendingApproval')}</p>
      </div>
      <div className="text-center">
        <p className="text-2xl font-bold text-violet-600 dark:text-violet-400">{cashierJournals.length}</p>
        <p className="text-xs text-muted-foreground">{t('quickStats.cashierJournals')}</p>
      </div>
    </div>
  );
}

function JournalDetailsDialog({ journal, branches }: { journal: CashierSalesJournal; branches?: Branch[] }) {
  const { t } = useTranslation('operations');
  const branchName = branches?.find(b => b.id === journal.branchId)?.name || journal.branchId;
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  
  const { data: attachments } = useQuery<JournalAttachment[]>({
    queryKey: [`/api/cashier-journals/${journal.id}/attachments`],
    enabled: isOpen,
    staleTime: 5 * 60 * 1000,
  });

  const { data: paymentBreakdowns } = useQuery<{ paymentMethod: string; amount: number; transactionCount: number }[]>({
    queryKey: [`/api/cashier-journals/${journal.id}/payment-breakdowns`],
    enabled: isOpen,
    staleTime: 5 * 60 * 1000,
  });

  const { data: journalDetails } = useQuery<{ signatures?: { signatureType: string; signerName: string; signatureData: string }[] }>({
    queryKey: [`/api/cashier-journals/${journal.id}`],
    enabled: isOpen,
    staleTime: 5 * 60 * 1000,
  });

  const handleExportJournalPDF = () => {
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    };

    const cashierSig = journalDetails?.signatures?.find(s => s.signatureType === 'cashier');
    const supervisorSig = journalDetails?.signatures?.find(s => s.signatureType === 'supervisor' || s.signatureType === 'manager');

    const htmlContent = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>${t('pdf.journalSummary')} - ${journal.journalDate}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    @page { size: A4; margin: 10mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; background: white; color: #333; font-size: 11px; padding: 10px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .container { max-width: 100%; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #d4a853; padding-bottom: 8px; margin-bottom: 10px; }
    .header .title { font-size: 16px; font-weight: bold; }
    .header .info { font-size: 10px; color: #666; }
    .main-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 10px; }
    .section { background: #fafafa; padding: 10px; border-radius: 8px; border: 1px solid #eee; margin-bottom: 8px; }
    .section-title { font-size: 11px; font-weight: bold; color: #d4a853; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #d4a853; }
    .row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dotted #ddd; font-size: 10px; }
    .row:last-child { border-bottom: none; }
    .row .label { color: #666; }
    .row .value { font-weight: 600; }
    .row .value.big { font-size: 14px; color: #d4a853; }
    .recon-box { background: #f0f0f0; padding: 8px; border-radius: 6px; margin-bottom: 8px; }
    .recon-row { display: flex; justify-content: space-between; font-size: 9px; padding: 3px 0; }
    .diff-display { text-align: center; padding: 8px; border-radius: 6px; margin-top: 8px; }
    .diff-display.balanced { background: #d4edda; }
    .diff-display.shortage { background: #f8d7da; }
    .diff-display.surplus { background: #cce5ff; }
    .diff-display .amount { font-size: 14px; font-weight: bold; }
    .diff-display .amount.negative { color: #dc3545; }
    .diff-display .amount.positive { color: #28a745; }
    .diff-display .status { font-size: 9px; color: #666; margin-top: 3px; }
    .category-header { display: flex; justify-content: space-between; padding: 5px 8px; border-radius: 4px; margin-bottom: 4px; font-size: 10px; font-weight: 600; }
    .category-header.cash { background: #d4edda; color: #155724; }
    .category-header.cards { background: #cce5ff; color: #004085; }
    .category-header.apps { background: #fff3cd; color: #856404; }
    .sub-row { display: flex; justify-content: space-between; font-size: 9px; padding: 2px 12px; color: #666; }
    .signature-section { margin-top: 10px; padding: 10px; background: #fafafa; border-radius: 8px; border: 1px solid #eee; }
    .sig-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
    .sig-box { text-align: center; padding: 8px; border: 1px solid #ddd; border-radius: 6px; min-height: 80px; }
    .sig-box .role { font-size: 10px; font-weight: bold; color: #666; margin-bottom: 5px; }
    .sig-box .sig-img { max-width: 100px; max-height: 40px; margin: 5px auto; display: block; }
    .sig-box .name { font-size: 10px; font-weight: bold; margin-top: 5px; }
    .sig-box .placeholder { height: 40px; display: flex; align-items: center; justify-content: center; color: #ccc; font-size: 9px; }
    .footer { margin-top: 10px; padding-top: 8px; border-top: 1px solid #ddd; display: flex; justify-content: space-between; font-size: 9px; color: #666; }
    .print-btn { position: fixed; top: 10px; left: 10px; background: #d4a853; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-family: 'Cairo', sans-serif; font-size: 11px; z-index: 100; }
    .loading-msg { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #fff; padding: 20px 40px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-size: 14px; z-index: 200; }
    @media print { .print-btn, .loading-msg { display: none !important; } }
  </style>
</head>
<body>
  <div class="loading-msg" id="loadingMsg">${t('pdf.loading')}</div>
  <button class="print-btn" id="printBtn" style="display:none;" onclick="window.print()">${t('pdf.print')}</button>
  <script>
    document.fonts.ready.then(function() {
      document.getElementById('loadingMsg').style.display = 'none';
      document.getElementById('printBtn').style.display = 'block';
    });
    setTimeout(function() {
      document.getElementById('loadingMsg').style.display = 'none';
      document.getElementById('printBtn').style.display = 'block';
    }, 1500);
  </script>
  
  <div class="container">
    <div class="header">
      <div>
        <div class="title">${t('pdf.journalSummary')}</div>
        <div class="info">${branchName} | ${t(`shiftsShort.${journal.shiftType || 'unspecified'}`)} | ${formatDate(journal.journalDate)}</div>
      </div>
      <div style="text-align:left;">
        <div style="font-size:10px;color:#666;">${t('pdf.journalNumber')}</div>
        <div style="font-size:14px;font-weight:bold;">#${journal.id}</div>
      </div>
    </div>
    
    <div class="main-grid">
      <div>
        <div class="section">
          <div class="section-title">${t('pdf.salesSummary')}</div>
          <div class="row"><span class="label">${t('pdf.totalSales')}</span><span class="value big">${(journal.totalSales || 0).toLocaleString('en', {minimumFractionDigits: 2})} ${t('common.sar')}</span></div>
          <div class="row"><span class="label">${t('pdf.invoiceCount')}</span><span class="value">${journal.transactionCount || 0}</span></div>
          <div class="row"><span class="label">${t('pdf.customerCount')}</span><span class="value">${journal.customerCount || 0}</span></div>
          <div class="row"><span class="label">${t('pdf.avgTicket')}</span><span class="value">${(journal.averageTicket || 0).toFixed(2)} ${t('common.sar')}</span></div>
        </div>
        
        <div class="section">
          <div class="section-title">${t('pdf.cashReconciliation')}</div>
          <div class="recon-box">
            <div class="recon-row"><span>${t('pdf.openingBalance')}</span><span>${(journal.openingBalance || 0).toLocaleString('en', {minimumFractionDigits: 2})} ${t('common.sar')}</span></div>
            <div class="recon-row"><span>${t('pdf.cashSales')}</span><span>${(journal.cashTotal || 0).toLocaleString('en', {minimumFractionDigits: 2})} ${t('common.sar')}</span></div>
            <div class="recon-row"><span>${t('pdf.expectedInDrawer')}</span><span>${(journal.expectedCash || 0).toLocaleString('en', {minimumFractionDigits: 2})} ${t('common.sar')}</span></div>
            <div class="recon-row"><span>${t('pdf.actualInDrawer')}</span><span>${(journal.actualCashDrawer || 0).toLocaleString('en', {minimumFractionDigits: 2})} ${t('common.sar')}</span></div>
          </div>
          <div class="diff-display ${(journal.discrepancyAmount || 0) === 0 ? 'balanced' : (journal.discrepancyAmount || 0) < 0 ? 'shortage' : 'surplus'}">
            <div class="amount ${(journal.discrepancyAmount || 0) < 0 ? 'negative' : (journal.discrepancyAmount || 0) > 0 ? 'positive' : ''}">${(journal.discrepancyAmount || 0).toLocaleString('en', {minimumFractionDigits: 2})} ${t('common.sar')}</div>
            <div class="status">${(journal.discrepancyAmount || 0) === 0 ? t('pdf.matched') : (journal.discrepancyAmount || 0) < 0 ? t('pdf.shortageOnCashier') : t('pdf.surplusRecorded')}</div>
          </div>
        </div>
      </div>
      
      <div>
        <div class="section">
          <div class="section-title">${t('pdf.salesClassification')}</div>
          
          <div class="category-header cash"><span>${t('pdf.cashCategory')}</span><span>${(journal.cashTotal || 0).toLocaleString('en', {minimumFractionDigits: 2})} ${t('common.sar')}</span></div>
          
          <div class="category-header cards"><span>${t('pdf.cardsCategory')}</span><span>${(journal.networkTotal || 0).toLocaleString('en', {minimumFractionDigits: 2})} ${t('common.sar')}</span></div>
          ${paymentBreakdowns ? paymentBreakdowns.filter(p => p.amount > 0 && ['card', 'mada', 'apple_pay', 'stc_pay'].includes(p.paymentMethod)).map(p => `
          <div class="sub-row"><span>• ${t(`paymentMethods.${p.paymentMethod}`)}</span><span>${(p.amount || 0).toLocaleString('en', {minimumFractionDigits: 2})} ${t('common.sar')}</span></div>
          `).join('') : ''}
          
          <div class="category-header apps"><span>${t('pdf.deliveryAppsCategory')}</span><span>${(journal.deliveryTotal || 0).toLocaleString('en', {minimumFractionDigits: 2})} ${t('common.sar')}</span></div>
          ${paymentBreakdowns ? paymentBreakdowns.filter(p => p.amount > 0 && ['hunger_station', 'toyou', 'jahez', 'marsool', 'keeta', 'the_chefs'].includes(p.paymentMethod)).map(p => `
          <div class="sub-row"><span>• ${t(`paymentMethods.${p.paymentMethod}`)}</span><span>${(p.amount || 0).toLocaleString('en', {minimumFractionDigits: 2})} ${t('common.sar')}</span></div>
          `).join('') : ''}
        </div>
        
        ${journal.notes ? `<div class="section"><div class="section-title">${t('pdf.notesSection')}</div><div style="font-size:10px;color:#666;padding:5px;background:#fffbeb;border-radius:4px;">${journal.notes}</div></div>` : ''}
      </div>
    </div>
    
    <div class="signature-section">
      <div style="font-size:11px;font-weight:bold;margin-bottom:8px;text-align:center;">${t('pdf.signaturesSection')}</div>
      <div class="sig-grid">
        <div class="sig-box">
          <div class="role">${t('pdf.cashierSignature')}</div>
          ${cashierSig?.signatureData ? `<img class="sig-img" src="${cashierSig.signatureData}" />` : `<div class="placeholder">${t('pdf.notSignedYet')}</div>`}
          <div class="name">${journal.cashierName}</div>
        </div>
        <div class="sig-box">
          <div class="role">${t('pdf.supervisorSignature')}</div>
          ${supervisorSig?.signatureData ? `<img class="sig-img" src="${supervisorSig.signatureData}" /><div class="name">${supervisorSig.signerName}</div>` : `<div class="placeholder">${t('pdf.notSignedYet')}</div><div class="name">________________</div>`}
        </div>
        <div class="sig-box">
          <div class="role">${t('pdf.managerApproval')}</div>
          ${journal.approvedBy ? `<div class="name" style="margin-top:15px;">${journal.approvedBy}</div>` : `<div class="placeholder">${t('pdf.notApprovedYet')}</div><div class="name">________________</div>`}
        </div>
      </div>
    </div>
    
    <div class="footer">
      <span>BUTTER BAKERY SYSTEM - CEO COMMAND</span>
      <span>${t('pdf.created')} ${new Date().toLocaleDateString('en-GB')}</span>
    </div>
  </div>
</body>
</html>`;

    printHtmlContent(htmlContent);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1" data-testid={`view-journal-${journal.id}`}>
            <Eye className="w-4 h-4" />
            {t('journalDialog.view')}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-amber-600" />
                {t('journalDialog.title')} - {journal.journalDate}
              </DialogTitle>
              <Button onClick={handleExportJournalPDF} className="gap-2 bg-amber-600 hover:bg-amber-700" data-testid={`export-journal-pdf-${journal.id}`}>
                <FileDown className="w-4 h-4" />
                {t('journalDialog.exportPDF')}
              </Button>
            </div>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            <div className="space-y-6 p-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg border border-amber-200">
                  <p className="text-xs text-muted-foreground">{t('journalDialog.branch')}</p>
                  <p className="font-semibold">{branchName}</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
                  <p className="text-xs text-muted-foreground">{t('journalDialog.cashierName')}</p>
                  <p className="font-semibold">{journal.cashierName}</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border border-purple-200">
                  <p className="text-xs text-muted-foreground">{t('journalDialog.shift')}</p>
                  <p className="font-semibold">{journal.shiftType || "-"}</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200">
                  <p className="text-xs text-muted-foreground">{t('journalDialog.status')}</p>
                  <Badge variant={journal.status === "approved" ? "default" : journal.status === "rejected" ? "destructive" : "secondary"}>
                    {t(`statuses.${journal.status}`)}
                  </Badge>
                </div>
              </div>

              <Card className="border-green-200">
                <CardHeader className="pb-2 bg-gradient-to-r from-green-50 to-white">
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-green-600" />
                    {t('journalDialog.salesSummary')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                      <span className="text-muted-foreground">{t('journalDialog.totalSales')}</span>
                      <span className="font-bold text-green-600 text-lg">{journal.totalSales?.toLocaleString('en')} {t('common.sar')}</span>
                    </div>
                    <div className="flex justify-between items-center p-2 border-b">
                      <span className="text-muted-foreground">{t('journalDialog.cashSales')}</span>
                      <span className="font-semibold">{journal.cashTotal?.toLocaleString('en')} {t('common.sar')}</span>
                    </div>
                    <div className="flex justify-between items-center p-2 border-b">
                      <span className="text-muted-foreground">{t('journalDialog.networkSales')}</span>
                      <span className="font-semibold">{journal.networkTotal?.toLocaleString('en')} {t('common.sar')}</span>
                    </div>
                    <div className="flex justify-between items-center p-2 border-b">
                      <span className="text-muted-foreground">{t('journalDialog.deliverySales')}</span>
                      <span className="font-semibold">{journal.deliveryTotal?.toLocaleString('en')} {t('common.sar')}</span>
                    </div>
                    <div className="flex justify-between items-center p-2 border-b">
                      <span className="text-muted-foreground">{t('journalDialog.transactionCount')}</span>
                      <span className="font-semibold">{journal.transactionCount}</span>
                    </div>
                    <div className="flex justify-between items-center p-2 border-b">
                      <span className="text-muted-foreground">{t('journalDialog.avgTicket')}</span>
                      <span className="font-semibold">{journal.averageTicket?.toFixed(2)} {t('common.sar')}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-blue-200">
                <CardHeader className="pb-2 bg-gradient-to-r from-blue-50 to-white">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-blue-600" />
                    {t('journalDialog.cashReconciliation')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex flex-col p-3 bg-gray-50 rounded-lg">
                      <span className="text-xs text-muted-foreground">{t('journalDialog.openingBalance')}</span>
                      <span className="font-semibold">{journal.openingBalance?.toLocaleString('en')} {t('common.sar')}</span>
                    </div>
                    <div className="flex flex-col p-3 bg-gray-50 rounded-lg">
                      <span className="text-xs text-muted-foreground">{t('journalDialog.expectedCash')}</span>
                      <span className="font-semibold">{journal.expectedCash?.toLocaleString('en')} {t('common.sar')}</span>
                    </div>
                    <div className="flex flex-col p-3 bg-gray-50 rounded-lg">
                      <span className="text-xs text-muted-foreground">{t('journalDialog.actualCash')}</span>
                      <span className="font-semibold">{journal.actualCashDrawer?.toLocaleString('en')} {t('common.sar')}</span>
                    </div>
                    <div className={`flex flex-col p-3 rounded-lg ${journal.discrepancyStatus === 'balanced' ? 'bg-green-50 border border-green-200' : journal.discrepancyStatus === 'shortage' ? 'bg-red-50 border border-red-200' : 'bg-blue-50 border border-blue-200'}`}>
                      <span className="text-xs text-muted-foreground">{t('journalDialog.difference')}</span>
                      <span className={`font-bold ${journal.discrepancyAmount && journal.discrepancyAmount < 0 ? 'text-red-600' : journal.discrepancyAmount && journal.discrepancyAmount > 0 ? 'text-green-600' : ''}`}>
                        {journal.discrepancyAmount?.toLocaleString('en')} {t('common.sar')}
                      </span>
                      <Badge variant={journal.discrepancyStatus === 'balanced' ? 'default' : journal.discrepancyStatus === 'shortage' ? 'destructive' : 'secondary'} className="mt-1 w-fit">
                        {t(`discrepancyStatuses.${journal.discrepancyStatus || 'balanced'}`)}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {attachments && attachments.length > 0 && (
                <Card className="border-purple-200">
                  <CardHeader className="pb-2 bg-gradient-to-r from-purple-50 to-white">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Image className="w-4 h-4 text-purple-600" />
                      {t('journalDialog.attachments')} ({attachments.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {attachments.map((att) => (
                        <div 
                          key={att.id} 
                          className="border rounded-lg p-2 cursor-pointer hover:shadow-lg transition-shadow hover:border-purple-400"
                          onClick={() => att.fileData && setSelectedImage(att.fileData)}
                        >
                          <div className="aspect-video bg-muted rounded flex items-center justify-center overflow-hidden relative group">
                            {att.fileData ? (
                              <>
                                <img 
                                  src={att.fileData} 
                                  alt={att.fileName}
                                  className="object-cover w-full h-full"
                                />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <Eye className="w-8 h-8 text-white" />
                                </div>
                              </>
                            ) : (
                              <FileText className="w-8 h-8 text-muted-foreground" />
                            )}
                          </div>
                          <p className="text-xs mt-2 truncate font-medium">{att.fileName}</p>
                          <p className="text-xs text-muted-foreground">{att.attachmentType}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {journal.notes && (
                <Card className="border-amber-200">
                  <CardHeader className="pb-2 bg-gradient-to-r from-amber-50 to-white">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="w-4 h-4 text-amber-600" />
                      {t('journalDialog.notes')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground bg-amber-50 p-3 rounded-lg">{journal.notes}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {selectedImage && (
        <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
          <DialogContent className="max-w-5xl max-h-[95vh] p-2">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Image className="w-5 h-5" />
                {t('journalDialog.viewImage')}
              </DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-center bg-black/5 rounded-lg p-2">
              <img 
                src={selectedImage} 
                alt={t('journalDialog.enlargedImage')}
                className="max-w-full max-h-[80vh] object-contain rounded-lg"
              />
            </div>
            <div className="flex justify-center gap-2 mt-2">
              <Button variant="outline" onClick={() => setSelectedImage(null)}>
                {t('journalDialog.close')}
              </Button>
              <Button onClick={() => {
                const link = document.createElement('a');
                link.href = selectedImage;
                link.download = `attachment_${journal.journalDate}.png`;
                link.click();
              }} className="gap-2">
                <Download className="w-4 h-4" />
                {t('journalDialog.downloadImage')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

export default function OperationsReportsDashboardPage() {
  const [, setLocation] = useLocation();
  const today = new Date().toISOString().split("T")[0];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  
  const [filters, setFilters] = useState({
    branchId: "",
    startDate: sevenDaysAgo,
    endDate: today,
    reportType: "all",
    periodType: "weekly" as "daily" | "weekly" | "monthly" | "custom",
    journalStatus: "all" as "all" | "draft" | "submitted" | "approved" | "posted" | "rejected",
    discrepancyFilter: "all" as "all" | "balanced" | "shortage" | "surplus",
    shiftType: "all" as "all" | "morning" | "evening" | "night",
    paymentCategory: "all" as "all" | "cash" | "cards" | "delivery",
    cashierId: "" as string,
  });

  const formatLocalDate = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const setPeriodDates = (periodType: "daily" | "weekly" | "monthly" | "custom") => {
    const now = new Date();
    let start = new Date(now);
    let end = new Date(now);
    
    switch (periodType) {
      case "daily":
        break;
      case "weekly":
        const dayOfWeek = now.getDay();
        start.setDate(now.getDate() - dayOfWeek);
        break;
      case "monthly":
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        return;
    }
    
    setFilters({
      ...filters,
      periodType,
      startDate: formatLocalDate(start),
      endDate: formatLocalDate(end),
    });
  };

  const { t } = useTranslation('operations');

  const REPORT_TYPES = useMemo(() => REPORT_TYPE_KEYS.map(key => ({ value: key, label: t(`reportTypes.${key}`), icon: REPORT_TYPE_ICONS[key] })), [t]);
  const DELIVERY_APPS = useMemo(() => DELIVERY_APP_KEYS.map(key => ({ key, label: t(`deliveryApps.${key}`), color: DELIVERY_APP_COLORS[key] })), [t]);

  const [activeTab, setActiveTab] = useState("overview");
  const [cashierPage, setCashierPage] = useState(1);
  const [mismatchPage, setMismatchPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const cashierPageSize = 15;
  const mismatchPageSize = 10;

  const { branches, userBranchId, canSelectBranch } = useBranches();

  useEffect(() => {
    if (userBranchId && !filters.branchId) {
      setFilters(prev => ({ ...prev, branchId: userBranchId }));
    }
  }, [userBranchId, filters.branchId]);

  const queryString = new URLSearchParams({
    ...(filters.branchId && { branchId: filters.branchId }),
    ...(filters.startDate && { startDate: filters.startDate }),
    ...(filters.endDate && { endDate: filters.endDate }),
  }).toString();

  const bundleQueryString = `${queryString}${queryString ? '&' : ''}sections=report,cashierJournals,cashiers,paymentBreakdowns`;

  const { data: bundle, isLoading, isFetching, refetch } = useQuery<{
    report?: OperationsReport;
    cashierJournals?: CashierSalesJournal[];
    cashiers?: { id: string; username: string; firstName: string | null; lastName: string | null }[];
    paymentBreakdowns?: { paymentMethod: string; amount: number; transactionCount: number; branchId: string; journalDate: string }[];
  }>({
    queryKey: [`/api/operations/reports-bundle?${bundleQueryString}`],
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  });

  const report = bundle?.report;
  const cashierJournals = bundle?.cashierJournals;
  const users = bundle?.cashiers;
  const allPaymentBreakdowns = bundle?.paymentBreakdowns;
  const cashierJournalsLoading = isLoading;
  const paymentBreakdownsLoading = isLoading;

  // Get current month for targets
  const currentYearMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  // Query for targets progress summary - lazy load when targets tab is active
  const { data: targetsProgress, isLoading: targetsProgressLoading } = useQuery<{
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
  }[]>({
    queryKey: [`/api/targets/progress-summary?yearMonth=${currentYearMonth}`],
    queryFn: async () => {
      const res = await fetch(`/api/targets/progress-summary?yearMonth=${currentYearMonth}`);
      if (!res.ok) throw new Error(`${res.status}: request failed`);
      return res.json();
    },
    enabled: activeTab === 'targets',
    staleTime: 5 * 60 * 1000,
  });

  const { data: eventPosReport, isLoading: eventPosLoading } = useQuery<{
    totalSales: number;
    totalTransactions: number;
    cashTotal: number;
    networkTotal: number;
    splitTotal: number;
    voidedCount: number;
    voidedAmount: number;
    refundedCount: number;
    refundedAmount: number;
    discountTotal: number;
    vatTotal: number;
    dailySales: { date: string; sales: number; transactions: number }[];
    paymentBreakdown: { method: string; amount: number; count: number }[];
    productSales: { productId: number; productName: string; totalQuantity: number; totalRevenue: number; totalVat: number; invoiceCount: number; avgPrice: number }[];
  }>({
    queryKey: [`/api/pos/report/EVENT-BB?startDate=${filters.startDate || ''}&endDate=${filters.endDate || ''}`],
    enabled: activeTab === 'event-pos',
    staleTime: 2 * 60 * 1000,
  });

  // Query for targets leaderboard - lazy load when targets tab is active
  const { data: targetsLeaderboard, isLoading: targetsLeaderboardLoading } = useQuery<{
    branches: { branchId: string; branchName: string; target: number; achieved: number; percent: number; rank: number }[];
    cashiers: { cashierId: string; cashierName: string; branchId: string; target: number; achieved: number; percent: number; rank: number }[];
  }>({
    queryKey: [`/api/targets/leaderboard?yearMonth=${currentYearMonth}`],
    queryFn: async () => {
      const res = await fetch(`/api/targets/leaderboard?yearMonth=${currentYearMonth}`);
      if (!res.ok) return { branches: [], cashiers: [] };
      return res.json();
    },
    enabled: activeTab === 'targets',
    staleTime: 5 * 60 * 1000,
  });

  // Query for branch overview report - lazy load when tab is active
  const { data: branchOverview, isLoading: branchOverviewLoading } = useQuery<{
    summary: {
      totalBranches: number;
      totalAssets: number;
      totalGoodAssets: number;
      totalMaintenanceNeeded: number;
      totalOverdueInspection: number;
      totalInventoryValue: number;
      overallReadinessPercent: number;
      branchesExcellent: number;
      branchesGood: number;
      branchesNeedAttention: number;
      branchesCritical: number;
    };
    branches: {
      branchId: string;
      branchName: string;
      assetReadiness: {
        total: number;
        good: number;
        maintenance: number;
        damaged: number;
        missing: number;
        readinessPercent: number;
      };
      inventory: {
        totalItems: number;
        totalQuantity: number;
        totalValue: number;
        lowQuantityItems: number;
        categoryBreakdown: { category: string; count: number; value: number }[];
      };
      maintenance: {
        itemsNeedingMaintenance: number;
        overdueInspection: number;
        upcomingInspection: number;
      };
      operationalStatus: 'excellent' | 'good' | 'needs_attention' | 'critical';
    }[];
  }>({
    queryKey: [`/api/reports/branch-overview?${filters.branchId ? `branchId=${filters.branchId}` : ''}`],
    queryFn: async () => {
      const url = filters.branchId 
        ? `/api/reports/branch-overview?branchId=${filters.branchId}` 
        : '/api/reports/branch-overview';
      const res = await fetch(url);
      if (!res.ok) return { summary: {}, branches: [] };
      return res.json();
    },
    enabled: activeTab === 'branch-overview',
    staleTime: 5 * 60 * 1000,
  });

  // Query for executive summary - lazy load when tab is active
  const { data: executiveSummary, isLoading: executiveSummaryLoading } = useQuery<{
    reportDate: string;
    period: { startDate: string; endDate: string };
    salesOverview: {
      totalSales: number;
      cashSales: number;
      networkSales: number;
      deliverySales: number;
      totalTransactions: number;
      averageTicket: number;
      discrepancies: { shortages: number; shortageAmount: number; surpluses: number; surplusAmount: number };
    };
    productionOverview: {
      totalOrders: number;
      completedOrders: number;
      pendingOrders: number;
      inProgressOrders: number;
      totalQuantityProduced: number;
      qualityPassRate: number;
    };
    assetsOverview: {
      totalAssets: number;
      goodAssets: number;
      maintenanceNeeded: number;
      assetReadinessPercent: number;
      totalInventoryValue: number;
    };
    targetsOverview: {
      totalTarget: number;
      totalAchieved: number;
      achievementPercent: number;
      branchesAboveTarget: number;
      branchesBelowTarget: number;
    };
    branchPerformance: { branchId: string; branchName: string; totalSales: number; totalOrders: number; qualityPassRate: number; averageTicket: number }[];
    shiftsOverview: { totalShifts: number; totalEmployeeAssignments: number };
    keyMetrics: { totalBranches: number; activeCashiers: number; averageDailySales: number };
  }>({
    queryKey: [`/api/reports/executive-summary?${queryString}`],
    queryFn: async () => {
      const res = await fetch(`/api/reports/executive-summary?${queryString}`);
      if (!res.ok) throw new Error(`${res.status}: request failed`);
      return res.json();
    },
    enabled: activeTab === 'executive',
    staleTime: 5 * 60 * 1000,
  });

  // Query for payment mismatch analysis - lazy load when tab is active
  const { data: paymentMismatchData, isLoading: paymentMismatchLoading } = useQuery<{
    summary: {
      totalJournals: number;
      journalsWithMismatch: number;
      mismatchRate: number;
      totalMismatchAmount: number;
      totalPosAmount: number;
      totalTerminalAmount: number;
    };
    byCashier: {
      cashierId: string;
      cashierName: string;
      totalMismatchAmount: number;
      mismatchCount: number;
      totalTransactions: number;
      errorRate: number;
      methodErrors: Record<string, number>;
    }[];
    byBranch: {
      branchId: string;
      branchName: string;
      totalMismatchAmount: number;
      mismatchCount: number;
    }[];
    byPaymentMethod: {
      paymentMethod: string;
      posTotal: number;
      terminalTotal: number;
      discrepancy: number;
      discrepancyCount: number;
      discrepancyPercent: number;
    }[];
    detailedMismatches: {
      journalId: number;
      journalDate: string;
      branchId: string;
      branchName: string;
      cashierId: string;
      cashierName: string;
      shiftType: string;
      totalSales: number;
      totalMismatchAmount: number;
      methodMismatches: {
        paymentMethod: string;
        posAmount: number;
        terminalAmount: number;
        discrepancy: number;
        discrepancyType: string;
      }[];
    }[];
  }>({
    queryKey: [`/api/reports/payment-mismatch-analysis?${queryString}`],
    queryFn: async () => {
      const res = await fetch(`/api/reports/payment-mismatch-analysis?${queryString}`);
      if (!res.ok) throw new Error(`${res.status}: request failed`);
      return res.json();
    },
    enabled: activeTab === 'payment-mismatch',
    staleTime: 5 * 60 * 1000,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-SA", {
      style: "currency",
      currency: "SAR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("en").format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const handleExportExcel = async () => {
    if (!report) return;

    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();

    const salesData = [
      [t('excel.salesReport') + " - " + filters.startDate + " " + t('pdf.to') + " " + filters.endDate],
      [],
      [t('excel.item'), t('excel.value')],
      [t('excel.totalSales'), report.salesReport.totalSales],
      [t('excel.cashSales'), report.salesReport.cashSales],
      [t('excel.networkSales'), report.salesReport.networkSales],
      [t('excel.deliverySales'), report.salesReport.deliverySales],
      [t('excel.totalTransactions'), report.salesReport.totalTransactions],
      [t('excel.avgTicket'), report.salesReport.averageTicket],
      [t('excel.shortageCases'), report.salesReport.totalShortages],
      [t('excel.totalShortage'), report.salesReport.shortageAmount],
      [t('excel.surplusCases'), report.salesReport.totalSurpluses],
      [t('excel.totalSurplus'), report.salesReport.surplusAmount],
    ];
    const salesSheet = XLSX.utils.aoa_to_sheet(salesData);
    XLSX.utils.book_append_sheet(wb, salesSheet, t('excel.salesSheet'));

    const productionData = [
      [t('excel.productionReport') + " - " + filters.startDate + " " + t('pdf.to') + " " + filters.endDate],
      [],
      [t('excel.actualDailyProduction'), ""],
      [t('excel.item'), t('excel.value')],
      [t('excel.totalBatches'), report.productionReport.actualProduction?.totalBatches || 0],
      [t('excel.completedBatches'), report.productionReport.actualProduction?.finishedBatches || 0],
      [t('excel.inProgress'), report.productionReport.actualProduction?.inProgressBatches || 0],
      [t('excel.actualProducedQuantity'), report.productionReport.actualProduction?.totalQuantity || 0],
      [],
      ...(report.productionReport.actualProduction?.byProduct?.length ? [
        [t('excel.productionByProduct'), "", ""],
        [t('excel.product'), t('excel.quantity'), t('excel.batchCount')],
        ...report.productionReport.actualProduction.byProduct.map(p => [p.productName, p.quantity, p.batchCount]),
        [],
      ] : []),
      ...(report.productionReport.totalOrders > 0 ? [
        [t('excel.plannedOrders'), ""],
        [t('excel.totalOrders'), report.productionReport.totalOrders],
        [t('excel.completed'), report.productionReport.completedOrders],
        [t('excel.producedQuantity'), report.productionReport.totalQuantityProduced],
        [t('excel.qualityRate'), `${report.productionReport.qualityPassRate.toFixed(1)}%`],
      ] : []),
    ];
    const productionSheet = XLSX.utils.aoa_to_sheet(productionData);
    XLSX.utils.book_append_sheet(wb, productionSheet, t('excel.productionSheet'));

    const shiftsData = [
      [t('excel.shiftsReport') + " - " + filters.startDate + " " + t('pdf.to') + " " + filters.endDate],
      [],
      [t('excel.item'), t('excel.value')],
      [t('excel.totalShifts'), report.shiftsReport.totalShifts],
      [t('excel.shiftsWithEmployees'), report.shiftsReport.shiftsWithEmployees],
      [t('excel.totalAssignments'), report.shiftsReport.totalEmployeeAssignments],
    ];
    const shiftsSheet = XLSX.utils.aoa_to_sheet(shiftsData);
    XLSX.utils.book_append_sheet(wb, shiftsSheet, t('excel.shiftsSheet'));

    const branchData = [
      [t('excel.branchComparison') + " - " + filters.startDate + " " + t('pdf.to') + " " + filters.endDate],
      [],
      [t('excel.branch'), t('excel.sales'), t('excel.orders'), t('excel.qualityCol'), t('excel.avgTicketCol')],
      ...report.branchComparison.map(b => [
        b.branchName,
        b.totalSales,
        b.totalOrders,
        `${b.qualityPassRate.toFixed(1)}%`,
        b.averageTicket.toFixed(2),
      ]),
    ];
    const branchSheet = XLSX.utils.aoa_to_sheet(branchData);
    XLSX.utils.book_append_sheet(wb, branchSheet, t('excel.branchSheet'));

    if (cashierJournals && cashierJournals.length > 0) {
      const journalData = [
        [t('excel.cashierJournals') + " - " + filters.startDate + " " + t('pdf.to') + " " + filters.endDate],
        [],
        [t('excel.date'), t('excel.branch'), t('excel.cashier'), t('excel.shift'), t('excel.totalSales'), t('excel.cash'), t('excel.network'), t('excel.delivery'), t('excel.discrepancy'), t('excel.status')],
        ...cashierJournals.map(j => [
          j.journalDate,
          branches?.find(b => b.id === j.branchId)?.name || j.branchId,
          j.cashierName,
          j.shiftType || "-",
          j.totalSales,
          j.cashTotal,
          j.networkTotal,
          j.deliveryTotal,
          j.discrepancyAmount,
          t(`statuses.${j.status}`) || j.status,
        ]),
      ];
      const journalSheet = XLSX.utils.aoa_to_sheet(journalData);
      XLSX.utils.book_append_sheet(wb, journalSheet, t('excel.journalsSheet'));
    }

    XLSX.writeFile(wb, `${t('excel.fileName')}_${filters.startDate}_${filters.endDate}.xlsx`);
  };

  const handleExportPDF = () => {
    if (!report) return;

    const selectedBranch = filters.branchId ? branches?.find(b => b.id === filters.branchId)?.name : t('common.allBranches');

    const htmlContent = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>${t('pdf.operationsReport')} - ${filters.startDate}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    @page { size: A4; margin: 8mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; padding: 10px; background: white; color: #333; font-size: 9px; line-height: 1.3; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #d4a853; padding-bottom: 6px; margin-bottom: 8px; }
    .header .title { font-size: 14px; font-weight: bold; }
    .header .info { font-size: 9px; color: #666; }
    .summary-row { display: flex; gap: 8px; margin-bottom: 8px; }
    .summary-card { flex: 1; background: #f8f9fa; padding: 8px; border-radius: 6px; text-align: center; border: 1px solid #e9ecef; }
    .summary-card .value { font-size: 14px; font-weight: bold; color: #d4a853; }
    .summary-card .label { color: #666; font-size: 8px; }
    .main-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .section { margin-bottom: 8px; }
    .section-title { font-size: 10px; font-weight: bold; color: #333; padding: 4px 8px; background: #d4a853; color: white; border-radius: 4px; margin-bottom: 5px; }
    .kpi-row { display: flex; gap: 5px; margin-bottom: 6px; }
    .kpi-item { flex: 1; background: #f8f9fa; padding: 5px; border-radius: 4px; text-align: center; border-right: 3px solid #d4a853; }
    .kpi-item .value { font-size: 11px; font-weight: bold; }
    .kpi-item .label { font-size: 7px; color: #666; }
    table { width: 100%; border-collapse: collapse; font-size: 8px; }
    th, td { border: 1px solid #ddd; padding: 4px 5px; text-align: right; }
    th { background: #f0f0f0; font-weight: 600; }
    .status-badge { padding: 1px 5px; border-radius: 8px; font-size: 7px; font-weight: 600; }
    .status-approved { background: #d4edda; color: #155724; }
    .status-pending { background: #fff3cd; color: #856404; }
    .status-rejected { background: #f8d7da; color: #721c24; }
    .footer { margin-top: 8px; padding-top: 5px; border-top: 1px solid #ddd; display: flex; justify-content: space-between; font-size: 8px; color: #666; }
    .print-btn { position: fixed; top: 8px; left: 8px; background: #d4a853; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-family: 'Cairo', sans-serif; font-size: 10px; z-index: 100; }
    .loading-msg { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #fff; padding: 20px 40px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-size: 14px; z-index: 200; }
    @media print { .print-btn, .loading-msg { display: none !important; } }
  </style>
</head>
<body>
  <div class="loading-msg" id="loadingMsg">${t('pdf.loading')}</div>
  <button class="print-btn" id="printBtn" style="display:none;" onclick="window.print()">${t('pdf.print')}</button>
  <script>
    document.fonts.ready.then(function() {
      document.getElementById('loadingMsg').style.display = 'none';
      document.getElementById('printBtn').style.display = 'block';
    });
    setTimeout(function() {
      document.getElementById('loadingMsg').style.display = 'none';
      document.getElementById('printBtn').style.display = 'block';
    }, 1500);
  </script>
  
  <div class="header">
    <div>
      <div class="title">${t('pdf.operationsReport')}</div>
      <div class="info">${selectedBranch} | ${filters.startDate} ${t('pdf.to')} ${filters.endDate}</div>
    </div>
    <div style="font-size:10px;font-weight:bold;color:#d4a853;">BUTTER BAKERY</div>
  </div>

  <div class="summary-row">
    <div class="summary-card"><div class="value">${formatCurrency(report.salesReport.totalSales)}</div><div class="label">${t('pdf.totalSales')}</div></div>
    <div class="summary-card"><div class="value">${formatNumber(report.salesReport.totalTransactions)}</div><div class="label">${t('quickStats.transactions')}</div></div>
    <div class="summary-card"><div class="value">${formatNumber(report.productionReport.actualProduction?.totalBatches || report.productionReport.totalOrders)}</div><div class="label">${t('quickStats.productionBatches')}</div></div>
    <div class="summary-card"><div class="value">${formatNumber(report.productionReport.actualProduction?.totalQuantity || report.productionReport.totalQuantityProduced)}</div><div class="label">${t('overview.producedQuantity')}</div></div>
  </div>

  <div class="main-grid">
    <div>
      <div class="section">
        <div class="section-title">${t('pdf.salesSection')}</div>
        <div class="kpi-row">
          <div class="kpi-item"><div class="value">${formatCurrency(report.salesReport.cashSales)}</div><div class="label">${t('pdf.cashLabel')}</div></div>
          <div class="kpi-item"><div class="value">${formatCurrency(report.salesReport.networkSales)}</div><div class="label">${t('pdf.networkLabel')}</div></div>
          <div class="kpi-item"><div class="value">${formatCurrency(report.salesReport.deliverySales)}</div><div class="label">${t('pdf.deliveryLabel')}</div></div>
        </div>
        <table>
          <tr><td>${t('overview.avgTicket')}</td><td>${formatCurrency(report.salesReport.averageTicket)}</td></tr>
          <tr><td>${t('pdf.shortageLabel')} (${report.salesReport.totalShortages})</td><td style="color:#dc3545;">${formatCurrency(report.salesReport.shortageAmount)}</td></tr>
          <tr><td>${t('pdf.surplusLabel')} (${report.salesReport.totalSurpluses})</td><td style="color:#28a745;">${formatCurrency(report.salesReport.surplusAmount)}</td></tr>
        </table>
      </div>
      
      <div class="section">
        <div class="section-title">${t('pdf.actualProduction')}</div>
        <div class="kpi-row">
          <div class="kpi-item"><div class="value">${formatNumber(report.productionReport.actualProduction?.totalBatches || 0)}</div><div class="label">${t('pdf.batches')}</div></div>
          <div class="kpi-item"><div class="value">${formatNumber(report.productionReport.actualProduction?.finishedBatches || 0)}</div><div class="label">${t('pdf.completed')}</div></div>
          <div class="kpi-item"><div class="value">${formatNumber(report.productionReport.actualProduction?.inProgressBatches || 0)}</div><div class="label">${t('pdf.inProgress')}</div></div>
          <div class="kpi-item"><div class="value">${formatNumber(report.productionReport.actualProduction?.totalQuantity || 0)}</div><div class="label">${t('pdf.quantity')}</div></div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">${t('pdf.shiftsSection')}</div>
        <div class="kpi-row">
          <div class="kpi-item"><div class="value">${formatNumber(report.shiftsReport.totalShifts)}</div><div class="label">${t('pdf.shiftsSection')}</div></div>
          <div class="kpi-item"><div class="value">${formatNumber(report.shiftsReport.totalEmployeeAssignments)}</div><div class="label">${t('pdf.assignments')}</div></div>
          <div class="kpi-item"><div class="value">${report.shiftsReport.totalShifts > 0 ? formatPercent((report.shiftsReport.shiftsWithEmployees / report.shiftsReport.totalShifts) * 100) : '100%'}</div><div class="label">${t('pdf.coverageLabel')}</div></div>
        </div>
      </div>
    </div>
    
    <div>
      <div class="section">
        <div class="section-title">${t('pdf.branchComparison')}</div>
        <table>
          <tr><th>${t('pdf.branchCol')}</th><th>${t('pdf.salesCol')}</th><th>${t('pdf.averageCol')}</th></tr>
          ${report.branchComparison.map(b => `<tr><td>${b.branchName}</td><td>${formatCurrency(b.totalSales)}</td><td>${formatCurrency(b.averageTicket)}</td></tr>`).join('')}
        </table>
      </div>

      ${cashierJournals && cashierJournals.length > 0 ? `
      <div class="section">
        <div class="section-title">${t('pdf.cashierJournals')} (${cashierJournals.length})</div>
        <table>
          <tr><th>${t('pdf.dateCol')}</th><th>${t('pdf.branchCol')}</th><th>${t('pdf.cashierCol')}</th><th>${t('pdf.salesCol')}</th><th>${t('pdf.differenceCol')}</th><th>${t('pdf.statusCol')}</th></tr>
          ${cashierJournals.slice(0, 8).map(j => `
            <tr>
              <td>${j.journalDate}</td>
              <td>${branches?.find(b => b.id === j.branchId)?.name?.substring(0,10) || j.branchId}</td>
              <td>${j.cashierName?.substring(0,10) || '-'}</td>
              <td>${formatCurrency(j.totalSales || 0)}</td>
              <td style="color:${(j.discrepancyAmount || 0) < 0 ? '#dc3545' : '#28a745'};">${formatCurrency(j.discrepancyAmount || 0)}</td>
              <td><span class="status-badge status-${j.status === 'approved' ? 'approved' : j.status === 'rejected' ? 'rejected' : 'pending'}">${t(`statuses.${j.status}`)?.substring(0,6) || j.status}</span></td>
            </tr>
          `).join('')}
        </table>
      </div>
      ` : ''}
    </div>
  </div>

  <div class="footer">
    <span>BUTTER BAKERY SYSTEM - CEO COMMAND</span>
    <span>${new Date().toLocaleDateString('en-GB')}</span>
  </div>
</body>
</html>`;

    printHtmlContent(htmlContent);
  };

  // Export Cashier Account Statement PDF
  const handleExportCashierPDF = () => {
    if (filteredCashierJournals.length === 0) return;

    const selectedCashier = filters.cashierId 
      ? users?.find(u => u.id === filters.cashierId)
      : null;
    const cashierName = selectedCashier 
      ? `${selectedCashier.firstName || selectedCashier.username} ${selectedCashier.lastName || ''}`.trim()
      : t('common.allCashiers');
    const selectedBranch = filters.branchId 
      ? branches?.find(b => b.id === filters.branchId)?.name 
      : t('common.allBranches');

    // Calculate totals for cashier report
    const totalSales = filteredCashierJournals.reduce((sum, j) => sum + (j.totalSales || 0), 0);
    const totalCash = filteredCashierJournals.reduce((sum, j) => sum + (j.cashTotal || 0), 0);
    const totalNetwork = filteredCashierJournals.reduce((sum, j) => sum + (j.networkTotal || 0), 0);
    const totalDelivery = filteredCashierJournals.reduce((sum, j) => sum + (j.deliveryTotal || 0), 0);
    const totalTransactions = filteredCashierJournals.reduce((sum, j) => sum + (j.transactionCount || 0), 0);
    const shortages = filteredCashierJournals.filter(j => j.discrepancyStatus === 'shortage');
    const surpluses = filteredCashierJournals.filter(j => j.discrepancyStatus === 'surplus');
    const totalShortageAmount = shortages.reduce((sum, j) => sum + Math.abs(j.discrepancyAmount || 0), 0);
    const totalSurplusAmount = surpluses.reduce((sum, j) => sum + (j.discrepancyAmount || 0), 0);
    const netDiscrepancy = totalSurplusAmount - totalShortageAmount;
    const avgTicket = totalTransactions > 0 ? totalSales / totalTransactions : 0;

    const htmlContent = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>${t('pdf.cashierAccountStatement')} - ${cashierName}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    @page { size: A4; margin: 10mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; padding: 15px; background: white; color: #333; font-size: 10px; line-height: 1.4; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #d4a853; padding-bottom: 10px; margin-bottom: 15px; }
    .header .title { font-size: 18px; font-weight: bold; color: #333; }
    .header .subtitle { font-size: 11px; color: #666; margin-top: 3px; }
    .header .logo { font-size: 14px; font-weight: bold; color: #d4a853; }
    .info-bar { display: flex; justify-content: space-between; background: #f8f9fa; padding: 10px 15px; border-radius: 8px; margin-bottom: 15px; border: 1px solid #e9ecef; }
    .info-item { text-align: center; }
    .info-item .label { font-size: 9px; color: #666; }
    .info-item .value { font-size: 12px; font-weight: bold; color: #333; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 15px; }
    .summary-card { background: linear-gradient(135deg, #f8f9fa 0%, #fff 100%); padding: 12px; border-radius: 8px; text-align: center; border: 1px solid #e9ecef; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    .summary-card .value { font-size: 16px; font-weight: bold; color: #d4a853; }
    .summary-card .label { color: #666; font-size: 9px; margin-top: 3px; }
    .summary-card.negative .value { color: #dc3545; }
    .summary-card.positive .value { color: #28a745; }
    .section { margin-bottom: 15px; }
    .section-title { font-size: 12px; font-weight: bold; color: white; padding: 6px 12px; background: linear-gradient(90deg, #d4a853 0%, #c49a48 100%); border-radius: 6px; margin-bottom: 8px; }
    .breakdown-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 10px; }
    .breakdown-item { background: #f8f9fa; padding: 10px; border-radius: 6px; text-align: center; border-right: 3px solid #d4a853; }
    .breakdown-item .value { font-size: 14px; font-weight: bold; }
    .breakdown-item .label { font-size: 8px; color: #666; }
    table { width: 100%; border-collapse: collapse; font-size: 9px; margin-top: 8px; }
    th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: right; }
    th { background: linear-gradient(180deg, #f0f0f0 0%, #e5e5e5 100%); font-weight: 600; color: #333; }
    tr:nth-child(even) { background: #fafafa; }
    tr:hover { background: #f5f5f5; }
    .status-badge { padding: 2px 8px; border-radius: 10px; font-size: 8px; font-weight: 600; }
    .status-approved { background: #d4edda; color: #155724; }
    .status-pending { background: #fff3cd; color: #856404; }
    .status-rejected { background: #f8d7da; color: #721c24; }
    .discrepancy-shortage { color: #dc3545; font-weight: bold; }
    .discrepancy-surplus { color: #28a745; font-weight: bold; }
    .discrepancy-balanced { color: #6c757d; }
    .footer { margin-top: 15px; padding-top: 10px; border-top: 2px solid #e9ecef; display: flex; justify-content: space-between; font-size: 9px; color: #666; }
    .signature-area { margin-top: 20px; display: flex; justify-content: space-between; }
    .signature-box { width: 45%; border-top: 1px solid #333; padding-top: 5px; text-align: center; font-size: 9px; }
    .print-btn { position: fixed; top: 10px; left: 10px; background: #d4a853; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-family: 'Cairo', sans-serif; font-size: 11px; z-index: 100; box-shadow: 0 2px 6px rgba(0,0,0,0.2); }
    .print-btn:hover { background: #c49a48; }
    .loading-msg { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #fff; padding: 20px 40px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-size: 14px; z-index: 200; }
    @media print { .print-btn, .loading-msg { display: none !important; } }
  </style>
</head>
<body>
  <div class="loading-msg" id="loadingMsg">${t('pdf.loading')}</div>
  <button class="print-btn" id="printBtn" style="display:none;" onclick="window.print()">${t('pdf.printStatement')}</button>
  <script>
    document.fonts.ready.then(function() {
      document.getElementById('loadingMsg').style.display = 'none';
      document.getElementById('printBtn').style.display = 'block';
    });
    setTimeout(function() {
      document.getElementById('loadingMsg').style.display = 'none';
      document.getElementById('printBtn').style.display = 'block';
    }, 1500);
  </script>
  
  <div class="header">
    <div>
      <div class="title">${t('pdf.cashierAccountStatement')}</div>
      <div class="subtitle">${cashierName}</div>
    </div>
    <div class="logo">BUTTER BAKERY</div>
  </div>

  <div class="info-bar">
    <div class="info-item">
      <div class="label">${t('pdf.branchCol')}</div>
      <div class="value">${selectedBranch}</div>
    </div>
    <div class="info-item">
      <div class="label">${t('pdf.period')}</div>
      <div class="value">${filters.startDate} ${t('pdf.to')} ${filters.endDate}</div>
    </div>
    <div class="info-item">
      <div class="label">${t('pdf.journalCount')}</div>
      <div class="value">${filteredCashierJournals.length}</div>
    </div>
    <div class="info-item">
      <div class="label">${t('pdf.printDate')}</div>
      <div class="value">${new Date().toLocaleDateString('en-GB')}</div>
    </div>
  </div>

  <div class="summary-grid">
    <div class="summary-card">
      <div class="value">${formatCurrency(totalSales)}</div>
      <div class="label">${t('pdf.totalSales')}</div>
    </div>
    <div class="summary-card">
      <div class="value">${formatNumber(totalTransactions)}</div>
      <div class="label">${t('pdf.invoiceCount')}</div>
    </div>
    <div class="summary-card">
      <div class="value">${formatCurrency(avgTicket)}</div>
      <div class="label">${t('pdf.avgTicket')}</div>
    </div>
    <div class="summary-card ${netDiscrepancy < 0 ? 'negative' : netDiscrepancy > 0 ? 'positive' : ''}">
      <div class="value">${formatCurrency(netDiscrepancy)}</div>
      <div class="label">${t('pdf.netDifference')}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">${t('pdf.paymentDetails')}</div>
    <div class="breakdown-grid">
      <div class="breakdown-item">
        <div class="value">${formatCurrency(totalCash)}</div>
        <div class="label">${t('pdf.cash')}</div>
      </div>
      <div class="breakdown-item">
        <div class="value">${formatCurrency(totalNetwork)}</div>
        <div class="label">${t('pdf.networkAndCards')}</div>
      </div>
      <div class="breakdown-item">
        <div class="value">${formatCurrency(totalDelivery)}</div>
        <div class="label">${t('pdf.deliveryAppsCategory')}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">${t('pdf.shortageAndSurplus')}</div>
    <div class="breakdown-grid">
      <div class="breakdown-item">
        <div class="value" style="color:#dc3545;">${shortages.length} ${t('pdf.case')}</div>
        <div class="label">${t('pdf.shortageCasesCount')}</div>
      </div>
      <div class="breakdown-item">
        <div class="value" style="color:#dc3545;">${formatCurrency(totalShortageAmount)}</div>
        <div class="label">${t('pdf.totalShortage')}</div>
      </div>
      <div class="breakdown-item">
        <div class="value" style="color:#28a745;">${formatCurrency(totalSurplusAmount)}</div>
        <div class="label">${t('pdf.totalSurplusCount', { count: surpluses.length })}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">${t('pdf.journalDetails', { count: filteredCashierJournals.length })}</div>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>${t('pdf.dateCol')}</th>
          <th>${t('pdf.shiftCol')}</th>
          <th>${t('pdf.salesCol')}</th>
          <th>${t('pdf.cashCol')}</th>
          <th>${t('pdf.networkCol')}</th>
          <th>${t('pdf.deliveryCol')}</th>
          <th>${t('pdf.invoicesCol')}</th>
          <th>${t('pdf.diffCol')}</th>
          <th>${t('pdf.statusCol')}</th>
        </tr>
      </thead>
      <tbody>
        ${filteredCashierJournals.map((j, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td>${j.journalDate}</td>
            <td>${t(`shiftsShort.${j.shiftType || 'unspecified'}`)}</td>
            <td>${formatCurrency(j.totalSales || 0)}</td>
            <td>${formatCurrency(j.cashTotal || 0)}</td>
            <td>${formatCurrency(j.networkTotal || 0)}</td>
            <td>${formatCurrency(j.deliveryTotal || 0)}</td>
            <td>${j.transactionCount || 0}</td>
            <td class="${(j.discrepancyAmount || 0) < 0 ? 'discrepancy-shortage' : (j.discrepancyAmount || 0) > 0 ? 'discrepancy-surplus' : 'discrepancy-balanced'}">${formatCurrency(j.discrepancyAmount || 0)}</td>
            <td><span class="status-badge status-${j.status === 'approved' || j.status === 'posted' ? 'approved' : j.status === 'rejected' ? 'rejected' : 'pending'}">${t(`statuses.${j.status}`) || j.status}</span></td>
          </tr>
        `).join('')}
      </tbody>
      <tfoot>
        <tr style="background:#f0f0f0;font-weight:bold;">
          <td colspan="3">${t('pdf.grandTotal')}</td>
          <td>${formatCurrency(totalSales)}</td>
          <td>${formatCurrency(totalCash)}</td>
          <td>${formatCurrency(totalNetwork)}</td>
          <td>${formatCurrency(totalDelivery)}</td>
          <td>${totalTransactions}</td>
          <td class="${netDiscrepancy < 0 ? 'discrepancy-shortage' : netDiscrepancy > 0 ? 'discrepancy-surplus' : 'discrepancy-balanced'}">${formatCurrency(netDiscrepancy)}</td>
          <td>-</td>
        </tr>
      </tfoot>
    </table>
  </div>

  <div class="signature-area">
    <div class="signature-box">${t('pdf.cashierSignatureLabel')}</div>
    <div class="signature-box">${t('pdf.managerSignatureLabel')}</div>
  </div>

  <div class="footer">
    <span>BUTTER BAKERY SYSTEM - CEO COMMAND</span>
    <span>${t('pdf.created')} ${new Date().toLocaleString('en-GB')}</span>
  </div>
</body>
</html>`;

    printHtmlContent(htmlContent);
  };

  // OPTIMIZED: Apply additional client-side filters on cashier journals with useMemo
  const filteredCashierJournals = useMemo(() => {
    return (cashierJournals || []).filter(journal => {
      if (filters.cashierId && journal.cashierId !== filters.cashierId) return false;
      if (filters.journalStatus !== "all" && journal.status !== filters.journalStatus) return false;
      if (filters.discrepancyFilter !== "all" && journal.discrepancyStatus !== filters.discrepancyFilter) return false;
      if (filters.shiftType !== "all" && journal.shiftType !== filters.shiftType) return false;
      if (filters.paymentCategory !== "all") {
        const cashAmount = journal.cashTotal || 0;
        const cardsAmount = journal.networkTotal || 0;
        const deliveryAmount = journal.deliveryTotal || 0;
        if (filters.paymentCategory === "cash" && cashAmount <= 0) return false;
        if (filters.paymentCategory === "cards" && cardsAmount <= 0) return false;
        if (filters.paymentCategory === "delivery" && deliveryAmount <= 0) return false;
      }
      return true;
    });
  }, [cashierJournals, filters.cashierId, filters.journalStatus, filters.discrepancyFilter, filters.shiftType, filters.paymentCategory]);

  const hasActiveLocalFilters = !!(filters.cashierId || filters.journalStatus !== "all" || filters.discrepancyFilter !== "all" || filters.shiftType !== "all" || filters.paymentCategory !== "all");

  // OPTIMIZED: Calculate payment category totals with useMemo
  const paymentCategoryStats = useMemo(() => ({
    cash: filteredCashierJournals.reduce((sum, j) => sum + (j.cashTotal || 0), 0),
    cards: filteredCashierJournals.reduce((sum, j) => sum + (j.networkTotal || 0), 0),
    delivery: filteredCashierJournals.reduce((sum, j) => sum + (j.deliveryTotal || 0), 0),
  }), [filteredCashierJournals]);

  // OPTIMIZED: Calculate weekly comparison data with useMemo
  const weeklyData = useMemo(() => {
    const weeks: { week: string; sales: number; transactions: number; journals: number }[] = [];
    const journalsByWeek = new Map<string, CashierSalesJournal[]>();
    
    filteredCashierJournals.forEach(journal => {
      if (!journal.journalDate) return;
      try {
        const dateParts = journal.journalDate.split('-');
        if (dateParts.length !== 3) return;
        const date = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
        if (isNaN(date.getTime())) return;
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        const weekKey = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
        if (!journalsByWeek.has(weekKey)) journalsByWeek.set(weekKey, []);
        journalsByWeek.get(weekKey)!.push(journal);
      } catch { return; }
    });
    
    journalsByWeek.forEach((journals, weekKey) => {
      weeks.push({
        week: weekKey,
        sales: journals.reduce((sum, j) => sum + (j.totalSales || 0), 0),
        transactions: journals.reduce((sum, j) => sum + (j.transactionCount || 0), 0),
        journals: journals.length,
      });
    });
    return weeks.sort((a, b) => a.week.localeCompare(b.week));
  }, [filteredCashierJournals]);

  // OPTIMIZED: Calculate shift performance comparison with useMemo
  const shiftPerformance = useMemo(() => {
    const shiftData = filteredCashierJournals.reduce((acc, j) => {
      const shift = j.shiftType || 'unspecified';
      if (!acc[shift]) acc[shift] = { shift, sales: 0, count: 0, avgTicket: 0, shortages: 0 };
      acc[shift].sales += (j.totalSales || 0);
      acc[shift].count += 1;
      if (j.discrepancyStatus === 'shortage') acc[shift].shortages += 1;
      return acc;
    }, {} as Record<string, { shift: string; sales: number; count: number; avgTicket: number; shortages: number }>);
    
    return Object.values(shiftData).map(s => ({
      ...s,
      avgTicket: s.count > 0 ? s.sales / s.count : 0,
      shiftLabel: t(`shiftsShort.${s.shift}`, { defaultValue: s.shift }),
    }));
  }, [filteredCashierJournals]);

  // إحصائيات مبيعات التطبيقات التفصيلية
  const deliveryAppsStats = useMemo(() => {
    const appStats: Record<string, { totalSales: number; orderCount: number; branches: Record<string, number> }> = {};
    const branchAppStats: Record<string, Record<string, number>> = {};
    
    // تهيئة التطبيقات
    DELIVERY_APPS.forEach(app => {
      appStats[app.key] = { totalSales: 0, orderCount: 0, branches: {} };
    });
    
    // حساب مبيعات كل تطبيق من allPaymentBreakdowns
    if (allPaymentBreakdowns && allPaymentBreakdowns.length > 0) {
      allPaymentBreakdowns.forEach(pb => {
        const method = pb.paymentMethod;
        const branchId = pb.branchId;
        
        if (DELIVERY_APPS.some(app => app.key === method)) {
          if (!appStats[method]) {
            appStats[method] = { totalSales: 0, orderCount: 0, branches: {} };
          }
          const amount = parseFloat(String(pb.amount)) || 0;
          appStats[method].totalSales += amount;
          appStats[method].orderCount += (pb.transactionCount || 1);
          appStats[method].branches[branchId] = (appStats[method].branches[branchId] || 0) + amount;
          
          if (!branchAppStats[branchId]) branchAppStats[branchId] = {};
          branchAppStats[branchId][method] = (branchAppStats[branchId][method] || 0) + amount;
        }
      });
    }
    
    // حساب إجمالي التوصيل
    const totalDeliveryAmount = DELIVERY_APPS.reduce((sum, app) => sum + appStats[app.key].totalSales, 0);
    
    // تحويل إلى مصفوفة مرتبة
    const sortedApps = DELIVERY_APPS.map(app => ({
      ...app,
      ...appStats[app.key],
      percentage: totalDeliveryAmount > 0 
        ? (appStats[app.key].totalSales / totalDeliveryAmount) * 100 
        : 0,
    })).sort((a, b) => b.totalSales - a.totalSales);
    
    // إحصائيات الفروع
    const branchStats = Object.entries(branchAppStats).map(([branchId, apps]) => ({
      branchId,
      branchName: branches?.find(b => b.id === branchId)?.name || branchId,
      totalDelivery: Object.values(apps).reduce((sum, val) => sum + val, 0),
      apps,
    })).sort((a, b) => b.totalDelivery - a.totalDelivery);
    
    // استخدم إما البيانات المحسوبة أو من paymentCategoryStats
    const finalTotalDelivery = totalDeliveryAmount > 0 ? totalDeliveryAmount : paymentCategoryStats.delivery;
    
    return {
      apps: sortedApps,
      branches: branchStats,
      totalDelivery: finalTotalDelivery,
      topApp: sortedApps.find(a => a.totalSales > 0) || null,
      topBranch: branchStats[0] || null,
    };
  }, [allPaymentBreakdowns, paymentCategoryStats.delivery, branches]);

  const getVisibleTabs = () => {
    switch (filters.reportType) {
      case "cashier":
        return ["cashier"];
      case "sales":
        return ["sales", "targets"];
      case "shifts":
        return ["shifts"];
      case "production":
        return ["production"];
      case "quality":
        return ["production"];
      case "apps":
        return ["apps"];
      case "event-pos":
        return ["event-pos"];
      default:
        return ["overview", "sales", "targets", "production", "shifts", "cashier", "apps", "returns", "discrepancies", "payment-mismatch", "branches", "event-pos", "executive"];
    }
  };

  const visibleTabs = getVisibleTabs();

  return (
    <Layout>
      <div className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-6xl mx-auto space-y-4" dir="rtl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/operations">
              <Button variant="ghost" size="icon" className="h-11 w-11 sm:h-8 sm:w-8" data-testid="btn-back">
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold flex items-center gap-2" data-testid="page-title">
                <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-amber-600" />
                {t('page.title')}
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">{t('page.subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link href="/targets-dashboard">
              <Button variant="outline" className="h-11 sm:h-9 gap-2" data-testid="button-targets-dashboard">
                <Trophy className="w-4 h-4 text-amber-600" />
                {t('page.targetsDashboard')}
              </Button>
            </Link>
            <Link href="/targets-planning">
              <Button variant="outline" className="h-11 sm:h-9 gap-2" data-testid="button-targets-planning">
                <Target className="w-4 h-4 text-amber-600" />
                {t('page.targetsPlanning')}
              </Button>
            </Link>
            <Link href="/incentives-management">
              <Button variant="outline" className="h-11 sm:h-9 gap-2" data-testid="button-incentives">
                <Gift className="w-4 h-4 text-amber-600" />
                {t('page.incentives')}
              </Button>
            </Link>
            <Button variant="outline" className="h-11 sm:h-9 gap-2" onClick={() => refetch()} data-testid="button-refresh">
              <RefreshCw className="w-4 h-4" />
              {t('page.refresh')}
            </Button>
            <Button variant="outline" className="h-11 sm:h-9 gap-2" onClick={handleExportExcel} disabled={!report} data-testid="button-export-excel">
              <Download className="w-4 h-4" />
              Excel
            </Button>
            <Button className="h-11 sm:h-9 gap-2 bg-amber-600 hover:bg-amber-700" onClick={handleExportPDF} disabled={!report} data-testid="button-export-pdf">
              <FileDown className="w-4 h-4" />
              PDF
            </Button>
          </div>
        </div>

        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
          <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-white">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Filter className="w-5 h-5 text-amber-600" />
                    {t('filters.title')}
                  </CardTitle>
                  <CardDescription>{t('filters.description')}</CardDescription>
                </div>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1" data-testid="toggle-filters">
                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${filtersOpen ? 'rotate-180' : ''}`} />
                    {filtersOpen ? t('filters.hide') : t('filters.show')}
                  </Button>
                </CollapsibleTrigger>
              </div>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-4 pt-0">
            {/* Quick Period Selection */}
            <div className="flex flex-wrap gap-2 pb-3 border-b">
              <span className="text-sm text-muted-foreground ml-2">{t('filters.quickPeriod')}</span>
              <Button
                variant={filters.periodType === "daily" ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriodDates("daily")}
                className="gap-1"
                data-testid="period-daily"
              >
                <Calendar className="w-3 h-3" />
                {t('filters.today')}
              </Button>
              <Button
                variant={filters.periodType === "weekly" ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriodDates("weekly")}
                className="gap-1"
                data-testid="period-weekly"
              >
                <Calendar className="w-3 h-3" />
                {t('filters.thisWeek')}
              </Button>
              <Button
                variant={filters.periodType === "monthly" ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriodDates("monthly")}
                className="gap-1"
                data-testid="period-monthly"
              >
                <Calendar className="w-3 h-3" />
                {t('filters.thisMonth')}
              </Button>
              <Button
                variant={filters.periodType === "custom" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilters({ ...filters, periodType: "custom" })}
                className="gap-1"
                data-testid="period-custom"
              >
                <Calendar className="w-3 h-3" />
                {t('filters.custom')}
              </Button>
            </div>

            {/* Main Filters Row */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <ClipboardList className="w-4 h-4" />
                  {t('filters.reportType')}
                </Label>
                <Select value={filters.reportType} onValueChange={(v) => {
                  setFilters({ ...filters, reportType: v });
                  if (v !== "all") {
                    setActiveTab(v === "quality" ? "production" : v);
                  } else {
                    setActiveTab("overview");
                  }
                }}>
                  <SelectTrigger className="h-11 sm:h-10" data-testid="select-report-type">
                    <SelectValue placeholder={t('filters.selectReportType')} />
                  </SelectTrigger>
                  <SelectContent>
                    {REPORT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <type.icon className="w-4 h-4" />
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Building2 className="w-4 h-4" />
                  {t('filters.branch')}
                </Label>
                <Select value={filters.branchId || "all"} onValueChange={(v) => setFilters({ ...filters, branchId: v === "all" ? "" : v })} disabled={!canSelectBranch}>
                  <SelectTrigger className="h-11 sm:h-10" data-testid="select-branch">
                    <SelectValue placeholder={t('filters.allBranches')} />
                  </SelectTrigger>
                  <SelectContent>
                    {canSelectBranch && <SelectItem value="all">{t('filters.allBranches')}</SelectItem>}
                    {branches?.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {t('filters.startDate')}
                </Label>
                <Input
                  className="h-11 sm:h-10"
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value, periodType: "custom" })}
                  data-testid="input-start-date"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {t('filters.endDate')}
                </Label>
                <Input
                  className="h-11 sm:h-10"
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value, periodType: "custom" })}
                  data-testid="input-end-date"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {t('filters.shift')}
                </Label>
                <Select value={filters.shiftType} onValueChange={(v: any) => setFilters({ ...filters, shiftType: v })}>
                  <SelectTrigger className="h-11 sm:h-10" data-testid="select-shift-type">
                    <SelectValue placeholder={t('filters.allShifts')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('filters.allShifts')}</SelectItem>
                    <SelectItem value="morning">{t('shiftsShort.morning')}</SelectItem>
                    <SelectItem value="evening">{t('shiftsShort.evening')}</SelectItem>
                    <SelectItem value="night">{t('shiftsShort.night')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Advanced Cashier Filters Row */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 pt-3 border-t">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  {t('filters.cashier')}
                </Label>
                <Select value={filters.cashierId || "all"} onValueChange={(v) => setFilters({ ...filters, cashierId: v === "all" ? "" : v })}>
                  <SelectTrigger className="h-11 sm:h-10" data-testid="select-cashier">
                    <SelectValue placeholder={t('filters.allCashiers')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('filters.allCashiers')}</SelectItem>
                    {users?.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.firstName || user.username} {user.lastName || ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Receipt className="w-4 h-4" />
                  {t('filters.journalStatus')}
                </Label>
                <Select value={filters.journalStatus} onValueChange={(v: any) => setFilters({ ...filters, journalStatus: v })}>
                  <SelectTrigger className="h-11 sm:h-10" data-testid="select-journal-status">
                    <SelectValue placeholder={t('filters.allStatuses')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('filters.allStatuses')}</SelectItem>
                    <SelectItem value="draft">{t('statuses.draft')}</SelectItem>
                    <SelectItem value="submitted">{t('filters.submittedForReview')}</SelectItem>
                    <SelectItem value="approved">{t('statuses.approved')}</SelectItem>
                    <SelectItem value="posted">{t('statuses.posted')}</SelectItem>
                    <SelectItem value="rejected">{t('statuses.rejected')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  {t('filters.reconciliationStatus')}
                </Label>
                <Select value={filters.discrepancyFilter} onValueChange={(v: any) => setFilters({ ...filters, discrepancyFilter: v })}>
                  <SelectTrigger className="h-11 sm:h-10" data-testid="select-discrepancy">
                    <SelectValue placeholder={t('filters.all')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('filters.all')}</SelectItem>
                    <SelectItem value="balanced">{t('filters.balancedNoShortage')}</SelectItem>
                    <SelectItem value="shortage">{t('discrepancyStatuses.shortage')}</SelectItem>
                    <SelectItem value="surplus">{t('discrepancyStatuses.surplus')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <CreditCard className="w-4 h-4" />
                  {t('filters.paymentCategory')}
                </Label>
                <Select value={filters.paymentCategory} onValueChange={(v: any) => setFilters({ ...filters, paymentCategory: v })}>
                  <SelectTrigger className="h-11 sm:h-10" data-testid="select-payment-category">
                    <SelectValue placeholder={t('filters.allPaymentCategories')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('filters.allPaymentCategories')}</SelectItem>
                    <SelectItem value="cash">{t('filters.cashOnly')}</SelectItem>
                    <SelectItem value="cards">{t('filters.cardsAndNetwork')}</SelectItem>
                    <SelectItem value="delivery">{t('filters.deliveryApps')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => setFilters({ 
                    branchId: "", 
                    startDate: sevenDaysAgo, 
                    endDate: today, 
                    reportType: "all",
                    periodType: "weekly",
                    journalStatus: "all",
                    discrepancyFilter: "all",
                    shiftType: "all",
                    paymentCategory: "all",
                    cashierId: "",
                  })}
                  className="w-full"
                  data-testid="button-reset-filters"
                >
                  {t('filters.resetAll')}
                </Button>
              </div>
            </div>

            {/* Active Filters Summary */}
            {(filters.cashierId || filters.journalStatus !== "all" || filters.discrepancyFilter !== "all" || filters.shiftType !== "all" || filters.paymentCategory !== "all") && (
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                <span className="text-xs text-muted-foreground">{t('filters.activeFilters')}</span>
                {filters.cashierId && (
                  <Badge variant="default" className="text-xs bg-amber-600">
                    {t('filters.cashierLabel')} {users?.find(u => u.id === filters.cashierId)?.firstName || users?.find(u => u.id === filters.cashierId)?.username || filters.cashierId}
                  </Badge>
                )}
                {filters.journalStatus !== "all" && (
                  <Badge variant="secondary" className="text-xs">
                    {t('filters.statusLabel')} {t(`statuses.${filters.journalStatus}`)}
                  </Badge>
                )}
                {filters.discrepancyFilter !== "all" && (
                  <Badge variant="secondary" className="text-xs">
                    {t('filters.reconciliationLabel')} {t(`discrepancyStatuses.${filters.discrepancyFilter}`)}
                  </Badge>
                )}
                {filters.shiftType !== "all" && (
                  <Badge variant="secondary" className="text-xs">
                    {t('filters.shiftLabel')} {t(`shiftsShort.${filters.shiftType}`)}
                  </Badge>
                )}
                {filters.paymentCategory !== "all" && (
                  <Badge variant="secondary" className="text-xs">
                    {t('filters.paymentLabel')} {filters.paymentCategory === "cash" ? t('filters.cashLabel') : filters.paymentCategory === "cards" ? t('filters.networkLabel') : t('filters.deliveryLabel')}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground mr-2">
                  ({t('filters.journalCount', { count: filteredCashierJournals.length })})
                </span>
              </div>
            )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {isLoading && !bundle ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : report ? (
          <>{isFetching && <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 bg-amber-100 text-amber-800 px-4 py-1.5 rounded-full text-sm font-medium shadow-lg animate-pulse">{t('page.updatingData')}</div>}
            <QuickStatsRow report={report} cashierJournals={filteredCashierJournals} hasActiveFilters={hasActiveLocalFilters} />
            
            <AlertBanner alerts={[
              ...(filteredCashierJournals.filter(j => j.discrepancyStatus === 'shortage').length > 0 
                ? [{ type: 'danger' as const, message: t('alerts.shortageReview'), count: filteredCashierJournals.filter(j => j.discrepancyStatus === 'shortage').length }] 
                : []),
              ...(filteredCashierJournals.filter(j => j.status === 'submitted').length > 0 
                ? [{ type: 'warning' as const, message: t('alerts.pendingApproval'), count: filteredCashierJournals.filter(j => j.status === 'submitted').length }] 
                : []),
              ...(report.productionReport.qualityPassRate < 90 
                ? [{ type: 'warning' as const, message: t('alerts.qualityBelow', { rate: report.productionReport.qualityPassRate.toFixed(0) }) }] 
                : []),
            ]} />
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <div className="space-y-2">
              {/* الصف الأول: التقارير الرئيسية */}
              <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 h-auto gap-1 p-1 bg-muted/50">
                {visibleTabs.includes("overview") && (
                  <TabsTrigger value="overview" data-testid="tab-overview" className="gap-1.5 text-xs sm:text-sm py-2.5 data-[state=active]:bg-amber-100 data-[state=active]:text-amber-800">
                    <PieChartIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">{t('tabs.overview')}</span>
                    <span className="sm:hidden">{t('tabs.overviewShort')}</span>
                  </TabsTrigger>
                )}
                {visibleTabs.includes("sales") && (
                  <TabsTrigger value="sales" data-testid="tab-sales" className="gap-1.5 text-xs sm:text-sm py-2.5 data-[state=active]:bg-green-100 data-[state=active]:text-green-800">
                    <DollarSign className="w-4 h-4" />
                    {t('tabs.sales')}
                  </TabsTrigger>
                )}
                {visibleTabs.includes("targets") && (
                  <TabsTrigger value="targets" data-testid="tab-targets" className="gap-1.5 text-xs sm:text-sm py-2.5 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-800">
                    <Target className="w-4 h-4" />
                    {t('tabs.targets')}
                  </TabsTrigger>
                )}
                {visibleTabs.includes("production") && (
                  <TabsTrigger value="production" data-testid="tab-production" className="gap-1.5 text-xs sm:text-sm py-2.5 data-[state=active]:bg-purple-100 data-[state=active]:text-purple-800">
                    <Factory className="w-4 h-4" />
                    {t('tabs.production')}
                  </TabsTrigger>
                )}
                {visibleTabs.includes("shifts") && (
                  <TabsTrigger value="shifts" data-testid="tab-shifts" className="gap-1.5 text-xs sm:text-sm py-2.5 data-[state=active]:bg-orange-100 data-[state=active]:text-orange-800">
                    <Clock className="w-4 h-4" />
                    {t('tabs.shifts')}
                  </TabsTrigger>
                )}
                {visibleTabs.includes("cashier") && (
                  <TabsTrigger value="cashier" data-testid="tab-cashier" className="gap-1.5 text-xs sm:text-sm py-2.5 data-[state=active]:bg-teal-100 data-[state=active]:text-teal-800">
                    <Wallet className="w-4 h-4" />
                    {t('tabs.cashier')}
                  </TabsTrigger>
                )}
              </TabsList>

              {/* الصف الثاني: التقارير التفصيلية والتحليلية */}
              {visibleTabs.length > 6 && (
                <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 h-auto gap-1 p-1 bg-slate-100/50 border border-slate-200">
                  {visibleTabs.includes("apps") && (
                    <TabsTrigger value="apps" data-testid="tab-apps" className="gap-1.5 text-xs sm:text-sm py-2.5 data-[state=active]:bg-indigo-100 data-[state=active]:text-indigo-800">
                      <Truck className="w-4 h-4" />
                      <span className="hidden sm:inline">{t('tabs.apps')}</span>
                      <span className="sm:hidden">{t('tabs.appsShort')}</span>
                    </TabsTrigger>
                  )}
                  {visibleTabs.includes("returns") && (
                    <TabsTrigger value="returns" data-testid="tab-returns" className="gap-1.5 text-xs sm:text-sm py-2.5 data-[state=active]:bg-red-100 data-[state=active]:text-red-800">
                      <Receipt className="w-4 h-4" />
                      {t('tabs.returns')}
                    </TabsTrigger>
                  )}
                  {visibleTabs.includes("discrepancies") && (
                    <TabsTrigger value="discrepancies" data-testid="tab-discrepancies" className="gap-1.5 text-xs sm:text-sm py-2.5 data-[state=active]:bg-yellow-100 data-[state=active]:text-yellow-800">
                      <AlertTriangle className="w-4 h-4" />
                      {t('tabs.discrepancies')}
                    </TabsTrigger>
                  )}
                  {visibleTabs.includes("payment-mismatch") && (
                    <TabsTrigger value="payment-mismatch" data-testid="tab-payment-mismatch" className="gap-1.5 text-xs sm:text-sm py-2.5 data-[state=active]:bg-pink-100 data-[state=active]:text-pink-800">
                      <CreditCard className="w-4 h-4" />
                      <span className="hidden sm:inline">{t('tabs.paymentMismatch')}</span>
                      <span className="sm:hidden">{t('tabs.paymentMismatchShort')}</span>
                    </TabsTrigger>
                  )}
                  {visibleTabs.includes("branches") && (
                    <TabsTrigger value="branches" data-testid="tab-branches" className="gap-1.5 text-xs sm:text-sm py-2.5 data-[state=active]:bg-cyan-100 data-[state=active]:text-cyan-800">
                      <Building2 className="w-4 h-4" />
                      {t('tabs.branches')}
                    </TabsTrigger>
                  )}
                  {visibleTabs.includes("event-pos") && (
                    <TabsTrigger value="event-pos" data-testid="tab-event-pos" className="gap-1.5 text-xs sm:text-sm py-2.5 data-[state=active]:bg-orange-100 data-[state=active]:text-orange-800">
                      <Zap className="w-4 h-4" />
                      <span className="hidden sm:inline">{t('tabs.eventPos')}</span>
                      <span className="sm:hidden">{t('tabs.eventPosShort')}</span>
                    </TabsTrigger>
                  )}
                  {visibleTabs.includes("executive") && (
                    <TabsTrigger value="executive" data-testid="tab-executive" className="gap-1.5 text-xs sm:text-sm py-2.5 data-[state=active]:bg-slate-700 data-[state=active]:text-white">
                      <FileText className="w-4 h-4" />
                      <span className="hidden sm:inline">{t('tabs.executive')}</span>
                      <span className="sm:hidden">{t('tabs.executiveShort')}</span>
                    </TabsTrigger>
                  )}
                </TabsList>
              )}
            </div>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <KPICard
                  title={t('overview.totalSales')}
                  value={formatCurrency(report.salesReport.totalSales)}
                  icon={DollarSign}
                  color="text-green-600"
                  bgColor="bg-green-100"
                  onClick={() => setActiveTab("sales")}
                />
                <KPICard
                  title={t('overview.totalTransactions')}
                  value={formatNumber(report.salesReport.totalTransactions)}
                  icon={ShoppingCart}
                  color="text-blue-600"
                  bgColor="bg-blue-100"
                />
                <KPICard
                  title={t('overview.productionBatches')}
                  value={formatNumber(report.productionReport.actualProduction?.totalBatches || report.productionReport.totalOrders)}
                  icon={Package}
                  color="text-purple-600"
                  bgColor="bg-purple-100"
                  onClick={() => setActiveTab("production")}
                />
                <KPICard
                  title={t('overview.producedQuantity')}
                  value={formatNumber(report.productionReport.actualProduction?.totalQuantity || report.productionReport.totalQuantityProduced)}
                  icon={Factory}
                  color="text-emerald-600"
                  bgColor="bg-emerald-100"
                />
                <KPICard
                  title={t('overview.totalShifts')}
                  value={formatNumber(report.shiftsReport.totalShifts)}
                  icon={Clock}
                  color="text-orange-600"
                  bgColor="bg-orange-100"
                  onClick={() => setActiveTab("shifts")}
                />
                <KPICard
                  title={t('overview.cashierJournals')}
                  value={formatNumber(filteredCashierJournals.length)}
                  icon={Wallet}
                  color="text-amber-600"
                  bgColor="bg-amber-100"
                  onClick={() => setActiveTab("cashier")}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-green-600" />
                      {t('overview.salesTrend')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={report.salesReport.dailySales}>
                          <defs>
                            <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                              <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" fontSize={10} />
                          <YAxis fontSize={10} />
                          <Tooltip formatter={(value: number) => formatCurrency(value)} />
                          <Area type="monotone" dataKey="sales" name={t('overview.salesName')} stroke="#10B981" fillOpacity={1} fill="url(#colorSales)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <PieChartIcon className="w-5 h-5 text-blue-600" />
                      {t('overview.paymentDistribution')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={report.salesReport.paymentMethodBreakdown}
                            dataKey="amount"
                            nameKey="method"
                            cx="50%"
                            cy="45%"
                            innerRadius={50}
                            outerRadius={90}
                            paddingAngle={2}
                            label={({ percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
                            labelLine={false}
                          >
                            {report.salesReport.paymentMethodBreakdown.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value: number, name: string) => [formatCurrency(value), t(`paymentMethods.${name}`, { defaultValue: name })]} 
                            contentStyle={{ textAlign: 'right', direction: 'rtl' }}
                          />
                          <Legend 
                            layout="horizontal" 
                            align="center" 
                            verticalAlign="bottom"
                            formatter={(value: string) => t(`paymentMethods.${value}`, { defaultValue: value })}
                            wrapperStyle={{ paddingTop: '15px' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-amber-600" />
                    {t('overview.branchPerformance')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={report.branchComparison}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="branchName" fontSize={11} />
                        <YAxis fontSize={11} />
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        <Legend />
                        <Bar dataKey="totalSales" name={t('overview.salesName')} fill="#10B981" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sales" className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KPICard title={t('sales.totalSales')} value={formatCurrency(report.salesReport.totalSales)} icon={DollarSign} color="text-green-600" bgColor="bg-green-100" />
                <KPICard title={t('sales.cashSales')} value={formatCurrency(report.salesReport.cashSales)} icon={Wallet} color="text-emerald-600" bgColor="bg-emerald-100" />
                <KPICard title={t('sales.networkSales')} value={formatCurrency(report.salesReport.networkSales)} icon={CreditCard} color="text-blue-600" bgColor="bg-blue-100" />
                <KPICard title={t('sales.deliverySales')} value={formatCurrency(report.salesReport.deliverySales)} icon={Truck} color="text-purple-600" bgColor="bg-purple-100" />
                <KPICard title={t('sales.totalTransactions')} value={formatNumber(report.salesReport.totalTransactions)} icon={ShoppingCart} color="text-indigo-600" bgColor="bg-indigo-100" />
                <KPICard title={t('sales.avgTicket')} value={formatCurrency(report.salesReport.averageTicket)} icon={Target} color="text-cyan-600" bgColor="bg-cyan-100" />
                <KPICard title={t('sales.totalShortage')} value={formatCurrency(report.salesReport.shortageAmount)} icon={TrendingDown} color="text-red-600" bgColor="bg-red-100" trendLabel={t('sales.caseCount', { count: report.salesReport.totalShortages })} />
                <KPICard title={t('sales.totalSurplus')} value={formatCurrency(report.salesReport.surplusAmount)} icon={TrendingUp} color="text-amber-600" bgColor="bg-amber-100" trendLabel={t('sales.caseCount', { count: report.salesReport.totalSurpluses })} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader><CardTitle className="text-lg">{t('sales.dailySales')}</CardTitle></CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={report.salesReport.dailySales}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" fontSize={12} />
                          <YAxis fontSize={12} />
                          <Tooltip formatter={(value: number) => formatCurrency(value)} labelFormatter={(label) => `${t('sales.dateLabel')} ${label}`} />
                          <Legend />
                          <Line type="monotone" dataKey="sales" name={t('overview.salesName')} stroke="#10B981" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-lg">{t('sales.paymentDistribution')}</CardTitle></CardHeader>
                  <CardContent>
                    <div className="h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie 
                            data={report.salesReport.paymentMethodBreakdown} 
                            dataKey="amount" 
                            nameKey="method" 
                            cx="50%" 
                            cy="45%" 
                            innerRadius={50}
                            outerRadius={90}
                            paddingAngle={2}
                            label={({ percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
                            labelLine={false}
                          >
                            {report.salesReport.paymentMethodBreakdown.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value: number, name: string) => [formatCurrency(value), t(`paymentMethods.${name}`, { defaultValue: name })]}
                            contentStyle={{ textAlign: 'right', direction: 'rtl' }}
                          />
                          <Legend 
                            layout="horizontal" 
                            align="center" 
                            verticalAlign="bottom"
                            formatter={(value: string) => t(`paymentMethods.${value}`, { defaultValue: value })}
                            wrapperStyle={{ paddingTop: '15px' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader><CardTitle className="text-lg">{t('sales.journalStatus')}</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={report.salesReport.journalsByStatus}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="status" fontSize={12} tickFormatter={(value) => t(`statuses.${value}`, { defaultValue: value })} />
                        <YAxis fontSize={12} />
                        <Tooltip labelFormatter={(label) => t(`statuses.${label}`, { defaultValue: label })} />
                        <Bar dataKey="count" name={t('sales.countName')} fill="#3B82F6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="production" className="space-y-6">
              {(() => {
                const actual = report.productionReport.actualProduction;
                const hasActualData = actual && actual.totalBatches > 0;
                const hasPlannedData = report.productionReport.totalOrders > 0;
                const DEST_LABELS: Record<string, string> = {
                  display_bar: t('destinations.display_bar'),
                  branch: t('destinations.branch'),
                  warehouse: t('destinations.warehouse'),
                  catering: t('destinations.catering'),
                  other: t('destinations.other'),
                };
                const CAT_COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];
                return (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <KPICard title={t('production.totalBatches')} value={formatNumber(actual?.totalBatches || 0)} icon={Package} color="text-blue-600" bgColor="bg-blue-100" />
                      <KPICard title={t('production.completed')} value={formatNumber(actual?.finishedBatches || 0)} icon={CheckCircle} color="text-green-600" bgColor="bg-green-100" />
                      <KPICard title={t('production.inProgress')} value={formatNumber(actual?.inProgressBatches || 0)} icon={Activity} color="text-orange-600" bgColor="bg-orange-100" />
                      <KPICard title={t('production.producedQuantity')} value={formatNumber(actual?.totalQuantity || 0)} icon={Factory} color="text-indigo-600" bgColor="bg-indigo-100" />
                    </div>

                    {hasActualData && actual ? (
                      <>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <Card>
                            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Factory className="w-5 h-5 text-purple-600" />{t('production.dailyActualProduction')}</CardTitle></CardHeader>
                            <CardContent>
                              <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={actual.dailyActual}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" fontSize={12} />
                                    <YAxis fontSize={12} />
                                    <Tooltip formatter={(value: number, name: string) => [formatNumber(value), name]} />
                                    <Legend />
                                    <Bar dataKey="quantity" name={t('production.quantityName')} fill="#10B981" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="batches" name={t('production.batchesName')} fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                            </CardContent>
                          </Card>

                          <Card>
                            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Package className="w-5 h-5 text-emerald-600" />{t('production.distributionByDestination')}</CardTitle></CardHeader>
                            <CardContent>
                              <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                  <PieChart>
                                    <Pie data={actual.byDestination.map(d => ({ ...d, name: DEST_LABELS[d.destination] || d.destination }))} dataKey="quantity" nameKey="name" cx="50%" cy="50%" outerRadius={100}
                                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                                      {actual.byDestination.map((_, index) => (
                                        <Cell key={`dest-${index}`} fill={CAT_COLORS[index % CAT_COLORS.length]} />
                                      ))}
                                    </Pie>
                                    <Tooltip formatter={(value: number) => formatNumber(value)} />
                                  </PieChart>
                                </ResponsiveContainer>
                              </div>
                            </CardContent>
                          </Card>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <Card>
                            <CardHeader><CardTitle className="text-lg">{t('production.productionByProduct')}</CardTitle></CardHeader>
                            <CardContent>
                              <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={actual.byProduct.slice(0, 10)} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" fontSize={12} />
                                    <YAxis type="category" dataKey="productName" fontSize={11} width={120} />
                                    <Tooltip formatter={(value: number) => formatNumber(value)} />
                                    <Legend />
                                    <Bar dataKey="quantity" name={t('production.quantityName')} fill="#10B981" radius={[0, 4, 4, 0]} />
                                    <Bar dataKey="batchCount" name={t('production.batchesName')} fill="#8B5CF6" radius={[0, 4, 4, 0]} />
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                            </CardContent>
                          </Card>

                          <Card>
                            <CardHeader><CardTitle className="text-lg">{t('production.productionByCategory')}</CardTitle></CardHeader>
                            <CardContent>
                              <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                  <PieChart>
                                    <Pie data={actual.byCategory} dataKey="quantity" nameKey="category" cx="50%" cy="50%" outerRadius={100}
                                      label={({ category, percent }) => `${category}: ${(percent * 100).toFixed(0)}%`}>
                                      {actual.byCategory.map((_, index) => (
                                        <Cell key={`cat-${index}`} fill={CAT_COLORS[index % CAT_COLORS.length]} />
                                      ))}
                                    </Pie>
                                    <Tooltip formatter={(value: number) => formatNumber(value)} />
                                  </PieChart>
                                </ResponsiveContainer>
                              </div>
                            </CardContent>
                          </Card>
                        </div>

                        {actual.byChef.length > 0 && (
                          <Card>
                            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Users className="w-5 h-5 text-blue-600" />{t('production.chefProduction')}</CardTitle></CardHeader>
                            <CardContent>
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm" data-testid="table-chef-production">
                                  <thead>
                                    <tr className="border-b bg-muted/50">
                                      <th className="text-right p-3 font-medium">#</th>
                                      <th className="text-right p-3 font-medium">{t('production.chef')}</th>
                                      <th className="text-center p-3 font-medium">{t('production.batchCount')}</th>
                                      <th className="text-center p-3 font-medium">{t('production.totalQuantity')}</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {actual.byChef.map((chef, i) => (
                                      <tr key={i} className="border-b hover:bg-muted/30" data-testid={`row-chef-${i}`}>
                                        <td className="p-3 text-muted-foreground">{i + 1}</td>
                                        <td className="p-3 font-medium">{chef.chefName}</td>
                                        <td className="p-3 text-center">{formatNumber(chef.batchCount)}</td>
                                        <td className="p-3 text-center font-semibold text-green-600">{formatNumber(chef.totalQuantity)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </>
                    ) : !hasPlannedData ? (
                      <Card>
                        <CardContent className="py-12 text-center">
                          <Factory className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
                          <p className="text-muted-foreground text-lg">{t('production.noProductionData')}</p>
                          <p className="text-muted-foreground text-sm mt-2">{t('production.registerProduction')}</p>
                        </CardContent>
                      </Card>
                    ) : null}

                    {hasPlannedData && (
                      <>
                        <div className="flex items-center gap-2 mt-6">
                          <h3 className="text-lg font-semibold text-muted-foreground">{t('production.plannedOrders')}</h3>
                          <Badge variant="outline" className="text-xs">{t('production.planned')}</Badge>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <KPICard title={t('production.totalOrders')} value={formatNumber(report.productionReport.totalOrders)} icon={Package} color="text-blue-600" bgColor="bg-blue-100" />
                          <KPICard title={t('production.pending')} value={formatNumber(report.productionReport.pendingOrders)} icon={Clock} color="text-yellow-600" bgColor="bg-yellow-100" />
                          <KPICard title={t('production.completed')} value={formatNumber(report.productionReport.completedOrders)} icon={CheckCircle} color="text-green-600" bgColor="bg-green-100" />
                          <KPICard title={t('production.qualityPassRate')} value={formatPercent(report.productionReport.qualityPassRate)}
                            icon={report.productionReport.qualityPassRate >= 90 ? CheckCircle : AlertTriangle}
                            color={report.productionReport.qualityPassRate >= 90 ? "text-green-600" : "text-yellow-600"}
                            bgColor={report.productionReport.qualityPassRate >= 90 ? "bg-green-100" : "bg-yellow-100"} />
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <Card>
                            <CardHeader><CardTitle className="text-lg">{t('production.dailyPlanned')}</CardTitle></CardHeader>
                            <CardContent>
                              <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={report.productionReport.dailyProduction}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" fontSize={12} />
                                    <YAxis fontSize={12} />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="quantity" name={t('production.quantityName')} fill="#10B981" />
                                    <Bar dataKey="orders" name={t('production.ordersName')} fill="#3B82F6" />
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                            </CardContent>
                          </Card>
                          {report.productionReport.qualityChecks.length > 0 && (
                            <Card>
                              <CardHeader><CardTitle className="text-lg">{t('production.qualityResults')}</CardTitle></CardHeader>
                              <CardContent>
                                <div className="h-[300px]">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                      <Pie data={report.productionReport.qualityChecks} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={100}
                                        label={({ status, percent }) => `${t(`statuses.${status}`, { defaultValue: status })}: ${(percent * 100).toFixed(0)}%`}>
                                        {report.productionReport.qualityChecks.map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={entry.status === 'passed' ? '#10B981' : entry.status === 'failed' ? '#EF4444' : '#F59E0B'} />
                                        ))}
                                      </Pie>
                                      <Tooltip />
                                    </PieChart>
                                  </ResponsiveContainer>
                                </div>
                              </CardContent>
                            </Card>
                          )}
                        </div>
                      </>
                    )}
                  </>
                );
              })()}
            </TabsContent>

            <TabsContent value="shifts" className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KPICard title={t('shiftsTab.totalShifts')} value={formatNumber(report.shiftsReport.totalShifts)} icon={Clock} color="text-blue-600" bgColor="bg-blue-100" />
                <KPICard title={t('shiftsTab.shiftsWithEmployees')} value={formatNumber(report.shiftsReport.shiftsWithEmployees)} icon={Users} color="text-green-600" bgColor="bg-green-100" />
                <KPICard title={t('shiftsTab.totalAssignments')} value={formatNumber(report.shiftsReport.totalEmployeeAssignments)} icon={Users} color="text-indigo-600" bgColor="bg-indigo-100" />
                <KPICard title={t('shiftsTab.coverageRate')}
                  value={report.shiftsReport.totalShifts > 0 ? formatPercent((report.shiftsReport.shiftsWithEmployees / report.shiftsReport.totalShifts) * 100) : "100%"}
                  icon={Target} color="text-purple-600" bgColor="bg-purple-100" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader><CardTitle className="text-lg">{t('shiftsTab.shiftDistribution')}</CardTitle></CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={report.shiftsReport.shiftsByType} dataKey="count" nameKey="type" cx="50%" cy="50%" outerRadius={100}
                            label={({ type, percent }) => `${type}: ${(percent * 100).toFixed(0)}%`}>
                            {report.shiftsReport.shiftsByType.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-lg">{t('shiftsTab.employeeDistribution')}</CardTitle></CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={report.shiftsReport.employeesByRole}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="role" fontSize={12} />
                          <YAxis fontSize={12} />
                          <Tooltip />
                          <Bar dataKey="count" name={t('shiftsTab.countName')} fill="#8B5CF6" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="cashier" className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-amber-600" />
                  {t('cashierTab.journals')}
                  {filters.cashierId && (
                    <Badge variant="default" className="bg-amber-600 text-sm">
                      {users?.find(u => u.id === filters.cashierId)?.firstName || users?.find(u => u.id === filters.cashierId)?.username}
                    </Badge>
                  )}
                </h2>
                <div className="flex gap-2 flex-wrap">
                  <Button 
                    variant="outline" 
                    onClick={handleExportCashierPDF} 
                    disabled={filteredCashierJournals.length === 0}
                    className="gap-2" 
                    data-testid="button-export-cashier-pdf"
                  >
                    <FileDown className="w-4 h-4" />
                    {t('cashierTab.exportCashierStatement')}
                  </Button>
                  <Button variant="outline" onClick={() => setLocation("/cashier-journals")} className="gap-2" data-testid="link-cashier-journals">
                    <ExternalLink className="w-4 h-4" />
                    {t('cashierTab.viewAll')}
                  </Button>
                  <Button onClick={() => setLocation("/cashier-journals/new")} className="gap-2 bg-amber-600 hover:bg-amber-700" data-testid="link-new-journal">
                    <Receipt className="w-4 h-4" />
                    {t('cashierTab.newJournal')}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <KPICard title={t('cashierTab.journals')} value={formatNumber(filteredCashierJournals.length)} icon={Receipt} color="text-blue-600" bgColor="bg-blue-100" />
                <KPICard title={t('cashierTab.totalSales')} value={formatCurrency(filteredCashierJournals.reduce((sum, j) => sum + (j.totalSales || 0), 0))}
                  icon={DollarSign} color="text-green-600" bgColor="bg-green-100" />
                <KPICard title={t('cashierTab.cashSales')} value={formatCurrency(filteredCashierJournals.reduce((sum, j) => sum + (j.cashTotal || 0), 0))}
                  icon={Wallet} color="text-emerald-600" bgColor="bg-emerald-100" />
                <KPICard title={t('cashierTab.networkSales')} value={formatCurrency(filteredCashierJournals.reduce((sum, j) => sum + (j.networkTotal || 0), 0))}
                  icon={CreditCard} color="text-indigo-600" bgColor="bg-indigo-100" />
                <KPICard title={t('cashierTab.shortages')}
                  value={formatNumber(filteredCashierJournals.filter(j => j.discrepancyStatus === 'shortage').length)}
                  icon={TrendingDown} color="text-red-600" bgColor="bg-red-100" 
                  subtitle={formatCurrency(filteredCashierJournals.filter(j => j.discrepancyStatus === 'shortage').reduce((sum, j) => sum + Math.abs(j.discrepancyAmount || 0), 0))} />
                <KPICard title={t('cashierTab.surpluses')}
                  value={formatNumber(filteredCashierJournals.filter(j => j.discrepancyStatus === 'surplus').length)}
                  icon={TrendingUp} color="text-amber-600" bgColor="bg-amber-100"
                  subtitle={formatCurrency(filteredCashierJournals.filter(j => j.discrepancyStatus === 'surplus').reduce((sum, j) => sum + (j.discrepancyAmount || 0), 0))} />
                <KPICard title={t('quickStats.pendingApproval')}
                  value={formatNumber(filteredCashierJournals.filter(j => j.status === 'submitted').length)}
                  icon={Clock} color="text-yellow-600" bgColor="bg-yellow-100" />
                <KPICard title={t('statuses.approved')}
                  value={formatNumber(filteredCashierJournals.filter(j => j.status === 'approved').length)}
                  icon={CheckCircle} color="text-green-600" bgColor="bg-green-100"
                  progress={filteredCashierJournals.length > 0 ? (filteredCashierJournals.filter(j => j.status === 'approved').length / filteredCashierJournals.length) * 100 : 0} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="w-4 h-4 text-green-600" />
                      {t('cashierTab.topCashiers')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {(() => {
                        const cashierStats = filteredCashierJournals.reduce((acc, j) => {
                          const name = j.cashierName || t('common.unknown');
                          if (!acc[name]) acc[name] = { name, sales: 0, count: 0 };
                          acc[name].sales += (j.totalSales || 0);
                          acc[name].count += 1;
                          return acc;
                        }, {} as Record<string, { name: string; sales: number; count: number }>);
                        return Object.values(cashierStats)
                          .sort((a, b) => b.sales - a.sales)
                          .slice(0, 5)
                          .map((c, i) => (
                            <div key={c.name} className="flex items-center justify-between p-2 rounded-lg bg-gradient-to-l from-green-50 to-white">
                              <div className="flex items-center gap-2">
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-amber-400 text-white' : 'bg-gray-200 text-gray-600'}`}>{i + 1}</span>
                                <span className="font-medium text-sm">{c.name}</span>
                                <Badge variant="secondary" className="text-xs">{t('cashierTab.journalCountBadge', {count: c.count})}</Badge>
                              </div>
                              <span className="text-sm font-bold text-green-600">{formatCurrency(c.sales)}</span>
                            </div>
                          ));
                      })()}
                      {filteredCashierJournals.length === 0 && <p className="text-center text-muted-foreground py-4">{t('cashierTab.noData')}</p>}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Clock className="w-4 h-4 text-purple-600" />{t('cashierTab.shiftPerformance')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {(() => {
                        const shiftStats = filteredCashierJournals.reduce((acc, j) => {
                          const shift = j.shiftType || 'unspecified';
                          const label = t(`shiftsShort.${shift}`);
                          if (!acc[shift]) acc[shift] = { label, sales: 0, count: 0 };
                          acc[shift].sales += (j.totalSales || 0);
                          acc[shift].count += 1;
                          return acc;
                        }, {} as Record<string, { label: string; sales: number; count: number }>);
                        return Object.values(shiftStats)
                          .sort((a, b) => b.sales - a.sales)
                          .map((s, i) => (
                            <div key={s.label} className="flex items-center justify-between p-2 rounded-lg bg-gradient-to-l from-purple-50 to-white">
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-purple-500" />
                                <span className="font-medium text-sm">{s.label}</span>
                                <Badge variant="secondary" className="text-xs">{s.count} {t('common.journal')}</Badge>
                              </div>
                              <span className="text-sm font-bold text-purple-600">{formatCurrency(s.sales)}</span>
                            </div>
                          ));
                      })()}
                      {filteredCashierJournals.length === 0 && <p className="text-center text-muted-foreground py-4">{t('cashierTab.noData')}</p>}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-600" />{t('cashierTab.cashiersNeedReview')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {(() => {
                        const cashierIssues = filteredCashierJournals.reduce((acc, j) => {
                          const name = j.cashierName || t('common.unknown');
                          if (!acc[name]) acc[name] = { name, shortages: 0, shortageAmount: 0 };
                          if (j.discrepancyStatus === 'shortage') {
                            acc[name].shortages += 1;
                            acc[name].shortageAmount += Math.abs(j.discrepancyAmount || 0);
                          }
                          return acc;
                        }, {} as Record<string, { name: string; shortages: number; shortageAmount: number }>);
                        return Object.values(cashierIssues)
                          .filter(c => c.shortages > 0)
                          .sort((a, b) => b.shortageAmount - a.shortageAmount)
                          .slice(0, 5)
                          .map((c) => (
                            <div key={c.name} className="flex items-center justify-between p-2 rounded-lg bg-gradient-to-l from-red-50 to-white">
                              <div className="flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-red-500" />
                                <span className="font-medium text-sm">{c.name}</span>
                                <Badge variant="destructive" className="text-xs">{c.shortages} {t('common.shortage')}</Badge>
                              </div>
                              <span className="text-sm font-bold text-red-600">-{formatCurrency(c.shortageAmount)}</span>
                            </div>
                          ));
                      })()}
                      {filteredCashierJournals.filter(j => j.discrepancyStatus === 'shortage').length === 0 && 
                        <div className="text-center py-4">
                          <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">{t('cashierTab.noShortageInPeriod')}</p>
                        </div>
                      }
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Enhanced Analytics Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Weekly Sales Trend */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-blue-600" />{t('cashierTab.weeklyAnalysis')}
                    </CardTitle>
                    <CardDescription>{t('cashierTab.weeklyComparisonDesc')}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={weeklyData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="week" fontSize={10} />
                          <YAxis fontSize={10} />
                          <Tooltip formatter={(value: number, name: string) => [
                            name === 'sales' ? formatCurrency(value) : value,
                            name === 'sales' ? t('apps.salesName') : name === 'transactions' ? t('cashierTab.journalCountName') : t('cashierTab.journalCountName')
                          ]} />
                          <Legend />
                          <Bar dataKey="sales" name={t('apps.salesName')} fill="#10B981" />
                          <Bar dataKey="journals" name={t('cashierTab.journalCountName')} fill="#3B82F6" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Payment Category Breakdown */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-indigo-600" />{t('cashierTab.paymentDistribution')}
                    </CardTitle>
                    <CardDescription>{t('cashierTab.paymentAnalysisDesc')}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: t('cashierTab.cashCategory'), value: paymentCategoryStats.cash, color: '#10B981' },
                              { name: t('cashierTab.cardsCategory'), value: paymentCategoryStats.cards, color: '#3B82F6' },
                              { name: t('cashierTab.deliveryAppsCategory'), value: paymentCategoryStats.delivery, color: '#F59E0B' },
                            ].filter(d => d.value > 0)}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          >
                            {[
                              { name: t('cashierTab.cashCategory'), value: paymentCategoryStats.cash, color: '#10B981' },
                              { name: t('cashierTab.cardsCategory'), value: paymentCategoryStats.cards, color: '#3B82F6' },
                              { name: t('cashierTab.deliveryAppsCategory'), value: paymentCategoryStats.delivery, color: '#F59E0B' },
                            ].filter(d => d.value > 0).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex justify-around mt-2 text-sm">
                      <div className="text-center">
                        <span className="inline-block w-3 h-3 rounded-full bg-emerald-500 ml-1"></span>
                        <span className="text-muted-foreground">{t('cashierTab.cashCategory')}: </span>
                        <span className="font-semibold">{formatCurrency(paymentCategoryStats.cash)}</span>
                      </div>
                      <div className="text-center">
                        <span className="inline-block w-3 h-3 rounded-full bg-blue-500 ml-1"></span>
                        <span className="text-muted-foreground">{t('cashierTab.networkShort')}: </span>
                        <span className="font-semibold">{formatCurrency(paymentCategoryStats.cards)}</span>
                      </div>
                      <div className="text-center">
                        <span className="inline-block w-3 h-3 rounded-full bg-amber-500 ml-1"></span>
                        <span className="text-muted-foreground">{t('cashierTab.deliveryShort')}: </span>
                        <span className="font-semibold">{formatCurrency(paymentCategoryStats.delivery)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Shift Performance Chart */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="w-4 h-4 text-purple-600" />{t('cashierTab.shiftCompareTitle')}
                  </CardTitle>
                  <CardDescription>{t('cashierTab.shiftCompareDesc')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={shiftPerformance} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" fontSize={10} />
                        <YAxis type="category" dataKey="shiftLabel" fontSize={12} width={60} />
                        <Tooltip formatter={(value: number, name: string) => [
                          name === t('apps.salesName') ? formatCurrency(value) : value,
                          name
                        ]} />
                        <Legend />
                        <Bar dataKey="sales" name={t('apps.salesName')} fill="#10B981" />
                        <Bar dataKey="count" name={t('cashierTab.journals')} fill="#3B82F6" />
                        <Bar dataKey="shortages" name={t('cashierTab.shortages')} fill="#EF4444" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Delivery Apps Sales Report */}
              {(filters.reportType === "all" || filters.reportType === "apps") && (
                <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Truck className="w-5 h-5 text-orange-600" />{t('apps.title')}
                        </CardTitle>
                        <CardDescription>{t('apps.description')}</CardDescription>
                      </div>
                      <Badge variant="secondary" className="bg-orange-100 text-orange-700 text-sm">{t('apps.totalLabel')}: {formatCurrency(deliveryAppsStats.totalDelivery)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* KPI Cards for Apps */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <KPICard 
                        title={t('apps.totalAppSales')} 
                        value={formatCurrency(deliveryAppsStats.totalDelivery)} 
                        icon={Truck} 
                        color="text-orange-600" 
                        bgColor="bg-orange-100" 
                      />
                      <KPICard 
                        title={t('apps.topApp')} 
                        value={deliveryAppsStats.topApp?.label || "-"} 
                        icon={Trophy}
                        subtitle={deliveryAppsStats.topApp ? formatCurrency(deliveryAppsStats.topApp.totalSales) : ""}
                        color="text-amber-600" 
                        bgColor="bg-amber-100" 
                      />
                      <KPICard 
                        title={t('apps.activeApps')} 
                        value={deliveryAppsStats.apps.filter(a => a.totalSales > 0).length} 
                        icon={Activity}
                        color="text-blue-600" 
                        bgColor="bg-blue-100" 
                      />
                      <KPICard 
                        title={t('apps.topBranch')} 
                        value={deliveryAppsStats.topBranch?.branchName || "-"} 
                        icon={Building2}
                        subtitle={deliveryAppsStats.topBranch ? formatCurrency(deliveryAppsStats.topBranch.totalDelivery) : ""}
                        color="text-purple-600" 
                        bgColor="bg-purple-100" 
                      />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Apps Pie Chart */}
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">{t('apps.salesDistribution')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="h-[280px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={deliveryAppsStats.apps.filter(a => a.totalSales > 0)}
                                  dataKey="totalSales"
                                  nameKey="label"
                                  cx="50%"
                                  cy="50%"
                                  outerRadius={90}
                                  label={({ label, percentage }) => `${label}: ${percentage.toFixed(0)}%`}
                                >
                                  {deliveryAppsStats.apps.filter(a => a.totalSales > 0).map((app, index) => (
                                    <Cell key={`cell-${index}`} fill={app.color} />
                                  ))}
                                </Pie>
                                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Apps Bar Chart */}
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">{t('apps.salesComparison')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="h-[280px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={deliveryAppsStats.apps.filter(a => a.totalSales > 0)} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" fontSize={10} tickFormatter={(v) => formatCurrency(v)} />
                                <YAxis type="category" dataKey="label" fontSize={11} width={80} />
                                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                <Bar dataKey="totalSales" name={t('apps.salesName')}>
                                  {deliveryAppsStats.apps.filter(a => a.totalSales > 0).map((app, index) => (
                                    <Cell key={`bar-${index}`} fill={app.color} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Apps Details Table */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">{t('apps.appDetails')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b bg-muted/50">
                                <th className="text-right py-3 px-4">{t('apps.appCol')}</th>
                                <th className="text-right py-3 px-4">{t('apps.totalSalesCol')}</th>
                                <th className="text-right py-3 px-4">{t('apps.percentCol')}</th>
                                <th className="text-right py-3 px-4">{t('apps.rankCol')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {deliveryAppsStats.apps.map((app, index) => (
                                <tr key={app.key} className="border-b hover:bg-muted/50">
                                  <td className="py-3 px-4">
                                    <div className="flex items-center gap-2">
                                      <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: app.color }}></span>
                                      <span className="font-medium">{app.label}</span>
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 font-semibold" style={{ color: app.color }}>
                                    {formatCurrency(app.totalSales)}
                                  </td>
                                  <td className="py-3 px-4">
                                    <div className="flex items-center gap-2">
                                      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                        <div 
                                          className="h-full rounded-full" 
                                          style={{ width: `${app.percentage}%`, backgroundColor: app.color }}
                                        ></div>
                                      </div>
                                      <span className="text-xs text-muted-foreground">{app.percentage.toFixed(1)}%</span>
                                    </div>
                                  </td>
                                  <td className="py-3 px-4">
                                    {app.totalSales > 0 && (
                                      <Badge variant={index === 0 ? "default" : "secondary"} className="text-xs">
                                        #{index + 1}
                                      </Badge>
                                    )}
                                    {app.totalSales === 0 && <span className="text-muted-foreground">-</span>}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Branch Comparison for Apps */}
                    {deliveryAppsStats.branches.length > 0 && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">{t('apps.salesByBranch')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b bg-muted/50">
                                  <th className="text-right py-3 px-4">{t('apps.branchCol')}</th>
                                  <th className="text-right py-3 px-4">{t('apps.totalDeliveryCol')}</th>
                                  {DELIVERY_APPS.slice(0, 5).map(app => (
                                    <th key={app.key} className="text-right py-3 px-4">
                                      <span style={{ color: app.color }}>{app.label}</span>
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {deliveryAppsStats.branches.map((branch, index) => (
                                  <tr key={branch.branchId} className="border-b hover:bg-muted/50">
                                    <td className="py-3 px-4">
                                      <div className="flex items-center gap-2">
                                        <Building2 className="w-4 h-4 text-muted-foreground" />
                                        <span className="font-medium">{branch.branchName}</span>
                                        {index === 0 && <Badge className="text-xs bg-amber-500">{t('apps.highest')}</Badge>}
                                      </div>
                                    </td>
                                    <td className="py-3 px-4 font-semibold text-orange-600">
                                      {formatCurrency(branch.totalDelivery)}
                                    </td>
                                    {DELIVERY_APPS.slice(0, 5).map(app => (
                                      <td key={app.key} className="py-3 px-4" style={{ color: app.color }}>
                                        {formatCurrency(branch.apps[app.key] || 0)}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <CardTitle className="text-lg">{t('cashierTab.journalList')}</CardTitle>
                      <CardDescription>{t('cashierTab.journalListDesc')}</CardDescription>
                    </div>
                    <Badge variant="secondary" className="text-sm">
                      {filteredCashierJournals.length} {t('common.journal')}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-right py-3 px-4">{t('cashierTab.dateCol')}</th>
                          <th className="text-right py-3 px-4">{t('apps.branchCol')}</th>
                          <th className="text-right py-3 px-4">{t('cashierTab.cashierCol')}</th>
                          <th className="text-right py-3 px-4">{t('cashierTab.shiftCol')}</th>
                          <th className="text-right py-3 px-4">{t('apps.totalSalesCol')}</th>
                          <th className="text-right py-3 px-4">{t('cashierTab.discrepancyCol')}</th>
                          <th className="text-right py-3 px-4">{t('cashierTab.statusCol')}</th>
                          <th className="text-right py-3 px-4">{t('cashierTab.actionsCol')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCashierJournals.length > 0 ? (
                          filteredCashierJournals
                            .slice((cashierPage - 1) * cashierPageSize, cashierPage * cashierPageSize)
                            .map((journal) => (
                            <tr key={journal.id} className="border-b hover:bg-muted/50">
                              <td className="py-3 px-4">{journal.journalDate}</td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <Building2 className="w-4 h-4 text-muted-foreground" />
                                  {branches?.find(b => b.id === journal.branchId)?.name || journal.branchId}
                                </div>
                              </td>
                              <td className="py-3 px-4">{journal.cashierName}</td>
                              <td className="py-3 px-4">{journal.shiftType || "-"}</td>
                              <td className="py-3 px-4 font-semibold text-green-600">{formatCurrency(journal.totalSales || 0)}</td>
                              <td className="py-3 px-4">
                                <span className={`font-semibold ${(journal.discrepancyAmount || 0) < 0 ? 'text-red-600' : (journal.discrepancyAmount || 0) > 0 ? 'text-green-600' : ''}`}>
                                  {formatCurrency(journal.discrepancyAmount || 0)}
                                </span>
                                <Badge variant={journal.discrepancyStatus === 'balanced' ? 'default' : journal.discrepancyStatus === 'shortage' ? 'destructive' : 'secondary'} className="mr-2 text-xs">
                                  {t(`discrepancyStatuses.${journal.discrepancyStatus || 'balanced'}`)}
                                </Badge>
                              </td>
                              <td className="py-3 px-4">
                                <Badge variant={journal.status === 'approved' ? 'default' : journal.status === 'rejected' ? 'destructive' : 'secondary'}>
                                  {t(`statuses.${journal.status}`) || journal.status}
                                </Badge>
                              </td>
                              <td className="py-3 px-4">
                                <JournalDetailsDialog journal={journal} branches={branches} />
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={8} className="py-8 text-center text-muted-foreground">{t('cashierTab.noJournalsInPeriod')}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  
                  {filteredCashierJournals.length > cashierPageSize && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <div className="text-sm text-muted-foreground">
                        {t('pagination.showing')} {((cashierPage - 1) * cashierPageSize) + 1} - {Math.min(cashierPage * cashierPageSize, filteredCashierJournals.length)} {t('pagination.of')} {filteredCashierJournals.length}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCashierPage(1)}
                          disabled={cashierPage === 1}
                          data-testid="cashier-page-first"
                        >{t('pagination.first')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCashierPage(p => Math.max(1, p - 1))}
                          disabled={cashierPage === 1}
                          data-testid="cashier-page-prev"
                        >{t('pagination.previous')}
                        </Button>
                        <span className="px-3 py-1 bg-muted rounded-md text-sm font-medium">
                          {cashierPage} / {Math.ceil(filteredCashierJournals.length / cashierPageSize)}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCashierPage(p => Math.min(Math.ceil(filteredCashierJournals.length / cashierPageSize), p + 1))}
                          disabled={cashierPage >= Math.ceil(filteredCashierJournals.length / cashierPageSize)}
                          data-testid="cashier-page-next"
                        >{t('pagination.next')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCashierPage(Math.ceil(filteredCashierJournals.length / cashierPageSize))}
                          disabled={cashierPage >= Math.ceil(filteredCashierJournals.length / cashierPageSize)}
                          data-testid="cashier-page-last"
                        >{t('pagination.last')}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="targets" className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Target className="w-5 h-5 text-amber-600" />{t('targets.title')} - {currentYearMonth}
                </h2>
                <div className="flex gap-2">
                  <Link href="/targets-dashboard">
                    <Button variant="outline" className="gap-2" data-testid="link-targets-full">
                      <ExternalLink className="w-4 h-4" />{t('targets.fullDashboard')}
                    </Button>
                  </Link>
                  <Link href="/targets-planning">
                    <Button className="gap-2 bg-amber-600 hover:bg-amber-700" data-testid="link-targets-planning">
                      <Target className="w-4 h-4" />{t('targets.planning')}
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Summary KPIs */}
              {(() => {
                const totalTarget = targetsProgress?.reduce((sum, b) => sum + (b.targetAmount || 0), 0) || 0;
                const totalAchieved = targetsProgress?.reduce((sum, b) => sum + (b.achievedAmount || 0), 0) || 0;
                const overallPercent = totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : 0;
                const totalRemaining = totalTarget - totalAchieved;
                const now = new Date();
                const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                const daysRemaining = daysInMonth - now.getDate();
                const requiredDaily = daysRemaining > 0 ? totalRemaining / daysRemaining : 0;
                const branchesAboveTarget = targetsProgress?.filter(b => b.achievementPercent >= 100).length || 0;
                const branchesBelowTarget = targetsProgress?.filter(b => b.achievementPercent < 80).length || 0;
                
                return (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                    <KPICard title={t('targets.totalTarget')} value={formatCurrency(totalTarget)} icon={Target} color="text-blue-600" bgColor="bg-blue-100" />
                    <KPICard title={t('targets.achieved')} value={formatCurrency(totalAchieved)} icon={DollarSign} color="text-green-600" bgColor="bg-green-100" />
                    <KPICard title={t('targets.achievementRate')} value={formatPercent(overallPercent)} icon={TrendingUp} 
                      color={overallPercent >= 100 ? "text-green-600" : overallPercent >= 80 ? "text-amber-600" : "text-red-600"} 
                      bgColor={overallPercent >= 100 ? "bg-green-100" : overallPercent >= 80 ? "bg-amber-100" : "bg-red-100"} />
                    <KPICard title={t('targets.remaining')} value={formatCurrency(Math.max(0, totalRemaining))} icon={Target} color="text-orange-600" bgColor="bg-orange-100" />
                    <KPICard title={t('targets.daysRemaining')} value={formatNumber(daysRemaining)} icon={Clock} color="text-purple-600" bgColor="bg-purple-100" />
                    <KPICard title={t('targets.requiredDaily')} value={formatCurrency(Math.max(0, requiredDaily))} icon={TrendingUp} color="text-indigo-600" bgColor="bg-indigo-100" />
                    <KPICard title={t('targets.branchesAboveTarget')} value={formatNumber(branchesAboveTarget)} icon={Trophy} color="text-green-600" bgColor="bg-green-100" />
                    <KPICard title={t('targets.branchesBelow80')} value={formatNumber(branchesBelowTarget)} icon={AlertTriangle} color="text-red-600" bgColor="bg-red-100" />
                  </div>
                );
              })()}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Branch Performance Comparison Chart */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-blue-600" />{t('targets.branchVsTarget')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={targetsProgress?.map(b => ({
                          name: b.branchName,
                          target: b.targetAmount,
                          achieved: b.achievedAmount,
                          percent: b.achievementPercent
                        })) || []} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" fontSize={10} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                          <YAxis type="category" dataKey="name" fontSize={10} width={80} />
                          <Tooltip formatter={(value: number) => formatCurrency(value)} />
                          <Legend />
                          <Bar dataKey="target" name={t('targets.targetCol')} fill="#94A3B8" />
                          <Bar dataKey="achieved" name={t('targets.achievedCol')} fill="#10B981" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Achievement Percentage Chart */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-600" />{t('targets.achievementRate')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={targetsProgress?.map(b => ({
                          name: b.branchName,
                          percent: b.achievementPercent,
                          fill: b.achievementPercent >= 100 ? '#10B981' : b.achievementPercent >= 80 ? '#F59E0B' : '#EF4444'
                        })).sort((a, b) => b.percent - a.percent) || []}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" fontSize={10} />
                          <YAxis fontSize={10} domain={[0, 120]} tickFormatter={(v) => `${v}%`} />
                          <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                          <Bar dataKey="percent" name={t('targets.achievementRate')}>
                            {targetsProgress?.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.achievementPercent >= 100 ? '#10B981' : entry.achievementPercent >= 80 ? '#F59E0B' : '#EF4444'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Leaderboard */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-amber-500" />{t('targets.branchRanking')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {targetsLeaderboard?.branches?.slice(0, 5).map((branch, i) => (
                        <div key={branch.branchId} className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-l from-amber-50 to-white border">
                          <div className="flex items-center gap-3">
                            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                              i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-gray-300 text-gray-700' : i === 2 ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {i + 1}
                            </span>
                            <div>
                              <p className="font-medium text-sm">{branch.branchName}</p>
                              <p className="text-xs text-muted-foreground">{t('targets.targetCol')}: {formatCurrency(branch.target)}</p>
                            </div>
                          </div>
                          <div className="text-left">
                            <p className={`font-bold ${branch.percent >= 100 ? 'text-green-600' : branch.percent >= 80 ? 'text-amber-600' : 'text-red-600'}`}>
                              {branch.percent.toFixed(1)}%
                            </p>
                            <p className="text-xs text-muted-foreground">{formatCurrency(branch.achieved)}</p>
                          </div>
                        </div>
                      ))}
                      {(!targetsLeaderboard?.branches || targetsLeaderboard.branches.length === 0) && (
                        <p className="text-center text-muted-foreground py-4">{t('targets.noTargetsData')}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Projection & Forecast */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="w-4 h-4 text-purple-600" />{t('targets.endOfMonthForecast')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {targetsProgress?.filter(b => b.targetAmount > 0).sort((a, b) => b.projectedPercent - a.projectedPercent).slice(0, 5).map((branch) => (
                        <div key={branch.branchId} className="p-3 rounded-lg border">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-sm">{branch.branchName}</span>
                            <div className="flex items-center gap-2">
                              {branch.trend === 'up' ? (
                                <TrendingUp className="w-4 h-4 text-green-500" />
                              ) : branch.trend === 'down' ? (
                                <TrendingDown className="w-4 h-4 text-red-500" />
                              ) : null}
                              <span className={`font-bold text-sm ${branch.projectedPercent >= 100 ? 'text-green-600' : branch.projectedPercent >= 80 ? 'text-amber-600' : 'text-red-600'}`}>
                                {branch.projectedPercent.toFixed(0)}%
                              </span>
                            </div>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full transition-all ${branch.projectedPercent >= 100 ? 'bg-green-500' : branch.projectedPercent >= 80 ? 'bg-amber-500' : 'bg-red-500'}`}
                              style={{ width: `${Math.min(100, branch.projectedPercent)}%` }}
                            />
                          </div>
                          <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                            <span>{t('targets.achievedLabel')} {formatCurrency(branch.achievedAmount)}</span>
                            <span>{t('targets.projectedLabel')} {formatCurrency(branch.projectedTotal)}</span>
                          </div>
                        </div>
                      ))}
                      {(!targetsProgress || targetsProgress.length === 0) && (
                        <p className="text-center text-muted-foreground py-4">{t('targets.noTargetsShort')}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Details Table */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{t('targets.branchDetails')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-right py-3 px-4">{t('apps.branchCol')}</th>
                          <th className="text-right py-3 px-4">{t('targets.targetCol')}</th>
                          <th className="text-right py-3 px-4">{t('targets.achievedCol')}</th>
                          <th className="text-right py-3 px-4">{t('apps.percentCol')}</th>
                          <th className="text-right py-3 px-4">{t('targets.remainingCol')}</th>
                          <th className="text-right py-3 px-4">{t('targets.dailyAvgCol')}</th>
                          <th className="text-right py-3 px-4">{t('targets.projectedCol')}</th>
                          <th className="text-right py-3 px-4">{t('targets.trendCol')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {targetsProgress?.map((branch) => (
                          <tr key={branch.branchId} className="border-b hover:bg-muted/50">
                            <td className="py-3 px-4 font-medium">
                              <div className="flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-amber-600" />
                                {branch.branchName}
                              </div>
                            </td>
                            <td className="py-3 px-4">{formatCurrency(branch.targetAmount)}</td>
                            <td className="py-3 px-4 font-semibold text-green-600">{formatCurrency(branch.achievedAmount)}</td>
                            <td className="py-3 px-4">
                              <Badge variant={branch.achievementPercent >= 100 ? "default" : branch.achievementPercent >= 80 ? "secondary" : "destructive"}>
                                {branch.achievementPercent.toFixed(1)}%
                              </Badge>
                            </td>
                            <td className="py-3 px-4">{formatCurrency(Math.max(0, branch.remainingAmount))}</td>
                            <td className="py-3 px-4">{formatCurrency(branch.averageDailySales)}</td>
                            <td className="py-3 px-4">{formatCurrency(branch.projectedTotal)}</td>
                            <td className="py-3 px-4">
                              {branch.trend === 'up' ? (
                                <Badge variant="default" className="bg-green-100 text-green-700">
                                  <TrendingUp className="w-3 h-3 ml-1" /> {t('targets.trendUp')}
                                </Badge>
                              ) : branch.trend === 'down' ? (
                                <Badge variant="destructive" className="bg-red-100 text-red-700">
                                  <TrendingDown className="w-3 h-3 ml-1" /> {t('targets.trendDown')}
                                </Badge>
                              ) : (
                                <Badge variant="secondary">{t('targets.trendStable')}</Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                        {(!targetsProgress || targetsProgress.length === 0) && (
                          <tr>
                            <td colSpan={8} className="py-8 text-center text-muted-foreground">{t('targets.noTargetsData')}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="branches" className="space-y-6">
              <Card>
                <CardHeader><CardTitle className="text-lg">{t('branches.salesComparison')}</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={report.branchComparison}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="branchName" fontSize={12} />
                        <YAxis fontSize={12} />
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        <Legend />
                        <Bar dataKey="totalSales" name={t('branches.salesName')} fill="#10B981" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-lg">{t('branches.branchDetails')}</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-right py-3 px-4">{t('apps.branchCol')}</th>
                          <th className="text-right py-3 px-4">{t('branches.salesCol')}</th>
                          <th className="text-right py-3 px-4">{t('branches.ordersCol')}</th>
                          <th className="text-right py-3 px-4">{t('branches.qualityCol')}</th>
                          <th className="text-right py-3 px-4">{t('branches.avgTicketCol')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.branchComparison.map((branch) => (
                          <tr key={branch.branchId} className="border-b hover:bg-muted/50">
                            <td className="py-3 px-4 font-medium">
                              <div className="flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-amber-600" />
                                {branch.branchName}
                              </div>
                            </td>
                            <td className="py-3 px-4 font-semibold text-green-600">{formatCurrency(branch.totalSales)}</td>
                            <td className="py-3 px-4">{formatNumber(branch.totalOrders)}</td>
                            <td className="py-3 px-4">
                              <span className={branch.qualityPassRate >= 90 ? "text-green-600 font-semibold" : "text-yellow-600"}>
                                {formatPercent(branch.qualityPassRate)}
                              </span>
                            </td>
                            <td className="py-3 px-4">{formatCurrency(branch.averageTicket)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="branch-overview" className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-600" />{t('branchOverview.title')}
                </h2>
              </div>

              {branchOverviewLoading && (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
                    <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
                    <p className="text-muted-foreground">{t('branchOverview.loading')}</p>
                  </CardContent>
                </Card>
              )}

              {!branchOverviewLoading && branchOverview?.summary && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    <KPICard title={t('branchOverview.totalBranches')} value={formatNumber(branchOverview.summary.totalBranches || 0)} icon={Building2} color="text-blue-600" bgColor="bg-blue-100" />
                    <KPICard title={t('branchOverview.totalAssets')} value={formatNumber(branchOverview.summary.totalAssets || 0)} icon={Package} color="text-purple-600" bgColor="bg-purple-100" />
                    <KPICard title={t('branchOverview.goodAssets')} value={formatNumber(branchOverview.summary.totalGoodAssets || 0)} icon={CheckCircle} color="text-green-600" bgColor="bg-green-100" />
                    <KPICard title={t('branchOverview.maintenanceNeeded')} value={formatNumber(branchOverview.summary.totalMaintenanceNeeded || 0)} icon={AlertTriangle} color="text-orange-600" bgColor="bg-orange-100" />
                    <KPICard title={t('branchOverview.overdueInspection')} value={formatNumber(branchOverview.summary.totalOverdueInspection || 0)} icon={Clock} color="text-red-600" bgColor="bg-red-100" />
                    <KPICard title={t('branchOverview.readinessRate')} value={formatPercent(branchOverview.summary.overallReadinessPercent || 0)} icon={Target} 
                      color={branchOverview.summary.overallReadinessPercent >= 90 ? "text-green-600" : branchOverview.summary.overallReadinessPercent >= 75 ? "text-amber-600" : "text-red-600"} 
                      bgColor={branchOverview.summary.overallReadinessPercent >= 90 ? "bg-green-100" : branchOverview.summary.overallReadinessPercent >= 75 ? "bg-amber-100" : "bg-red-100"} />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <PieChartIcon className="w-4 h-4 text-blue-600" />{t('branchOverview.operationalStatusTitle')}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[250px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={[
                                  { name: t('branchOverview.excellent'), value: branchOverview.summary.branchesExcellent || 0, fill: '#10B981' },
                                  { name: t('branchOverview.good'), value: branchOverview.summary.branchesGood || 0, fill: '#3B82F6' },
                                  { name: t('branchOverview.needsAttention'), value: branchOverview.summary.branchesNeedAttention || 0, fill: '#F59E0B' },
                                  { name: t('branchOverview.critical'), value: branchOverview.summary.branchesCritical || 0, fill: '#EF4444' },
                                ]}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                                label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''}
                              >
                              </Pie>
                              <Tooltip />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-green-600" />{t('branchOverview.assetReadinessTitle')}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[250px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={branchOverview.branches?.map(b => ({
                              name: b.branchName,
                              [t('branchOverview.ready')]: b.assetReadiness.good,
                              [t('branchOverview.maintenance')]: b.assetReadiness.maintenance,
                              [t('branchOverview.damaged')]: b.assetReadiness.damaged,
                            })) || []} layout="vertical">
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis type="number" fontSize={10} />
                              <YAxis type="category" dataKey="name" fontSize={10} width={80} />
                              <Tooltip />
                              <Legend />
                              <Bar dataKey={t('branchOverview.ready')} stackId="a" fill="#10B981" />
                              <Bar dataKey={t('branchOverview.maintenance')} stackId="a" fill="#F59E0B" />
                              <Bar dataKey={t('branchOverview.damaged')} stackId="a" fill="#EF4444" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{t('branchOverview.branchDetailsTitle')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              <th className="text-right py-3 px-4">{t('apps.branchCol')}</th>
                              <th className="text-right py-3 px-4">{t('cashierTab.statusCol')}</th>
                              <th className="text-right py-3 px-4">{t('branchOverview.assetsCol')}</th>
                              <th className="text-right py-3 px-4">{t('branchOverview.readyCol')}</th>
                              <th className="text-right py-3 px-4">{t('branchOverview.maintenanceCol')}</th>
                              <th className="text-right py-3 px-4">{t('branchOverview.readinessCol')}</th>
                              <th className="text-right py-3 px-4">{t('branchOverview.overdueCol')}</th>
                              <th className="text-right py-3 px-4">{t('branchOverview.inventoryValueCol')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {branchOverview.branches?.map((branch) => (
                              <tr key={branch.branchId} className="border-b hover:bg-muted/50">
                                <td className="py-3 px-4 font-medium">
                                  <div className="flex items-center gap-2">
                                    <Building2 className="w-4 h-4 text-amber-600" />
                                    {branch.branchName}
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <Badge variant={
                                    branch.operationalStatus === 'excellent' ? 'default' :
                                    branch.operationalStatus === 'good' ? 'secondary' :
                                    branch.operationalStatus === 'needs_attention' ? 'outline' : 'destructive'
                                  } className={
                                    branch.operationalStatus === 'excellent' ? 'bg-green-100 text-green-700' :
                                    branch.operationalStatus === 'good' ? 'bg-blue-100 text-blue-700' :
                                    branch.operationalStatus === 'needs_attention' ? 'bg-amber-100 text-amber-700' : ''
                                  }>
                                    {branch.operationalStatus === 'excellent' ? t('branchOverview.excellent') : branch.operationalStatus === 'good' ? t('branchOverview.good') : branch.operationalStatus === 'needs_attention' ? t('branchOverview.needsAttention') : t('branchOverview.critical')}
                                  </Badge>
                                </td>
                                <td className="py-3 px-4">{formatNumber(branch.assetReadiness.total)}</td>
                                <td className="py-3 px-4 text-green-600 font-semibold">{formatNumber(branch.assetReadiness.good)}</td>
                                <td className="py-3 px-4 text-orange-600">{formatNumber(branch.assetReadiness.maintenance + branch.assetReadiness.damaged)}</td>
                                <td className="py-3 px-4">
                                  <span className={branch.assetReadiness.readinessPercent >= 90 ? 'text-green-600 font-semibold' : branch.assetReadiness.readinessPercent >= 75 ? 'text-amber-600' : 'text-red-600'}>
                                    {formatPercent(branch.assetReadiness.readinessPercent)}
                                  </span>
                                </td>
                                <td className="py-3 px-4">
                                  {branch.maintenance.overdueInspection > 0 ? (
                                    <Badge variant="destructive">{branch.maintenance.overdueInspection}</Badge>
                                  ) : (
                                    <span className="text-green-600">0</span>
                                  )}
                                </td>
                                <td className="py-3 px-4">{formatCurrency(branch.inventory.totalValue)}</td>
                              </tr>
                            ))}
                            {(!branchOverview.branches || branchOverview.branches.length === 0) && (
                              <tr>
                                <td colSpan={8} className="py-8 text-center text-muted-foreground">{t('branchOverview.noData')}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>

            {/* تقرير المرتجعات - Returns Report */}
            <TabsContent value="returns" className="space-y-6">
              {(() => {
                const journalsWithReturns = filteredCashierJournals.filter(j => j.hasReturn || (j.returnAmount && j.returnAmount > 0));
                const totalReturnAmount = journalsWithReturns.reduce((sum, j) => sum + (j.returnAmount || 0), 0);
                const returnsCount = journalsWithReturns.length;
                
                // Group by branch
                const returnsByBranch = journalsWithReturns.reduce((acc, j) => {
                  const branchName = branches?.find(b => b.id === j.branchId)?.name || j.branchId;
                  if (!acc[branchName]) acc[branchName] = { count: 0, amount: 0, journals: [] };
                  acc[branchName].count++;
                  acc[branchName].amount += j.returnAmount || 0;
                  acc[branchName].journals.push(j);
                  return acc;
                }, {} as Record<string, { count: number; amount: number; journals: typeof journalsWithReturns }>);
                
                // Group by shift
                const returnsByShift = journalsWithReturns.reduce((acc, j) => {
                  const shift = j.shiftType || 'unspecified';
                  if (!acc[shift]) acc[shift] = { count: 0, amount: 0 };
                  acc[shift].count++;
                  acc[shift].amount += j.returnAmount || 0;
                  return acc;
                }, {} as Record<string, { count: number; amount: number }>);
                
                // Group by payment method
                const returnsByPaymentMethod = journalsWithReturns.reduce((acc, j) => {
                  const method = j.returnPaymentMethod || 'unspecified';
                  if (!acc[method]) acc[method] = { count: 0, amount: 0 };
                  acc[method].count++;
                  acc[method].amount += j.returnAmount || 0;
                  return acc;
                }, {} as Record<string, { count: number; amount: number }>);
                
                // Group by reason
                const returnsByReason = journalsWithReturns.reduce((acc, j) => {
                  const reason = j.returnReason || 'unspecified';
                  if (!acc[reason]) acc[reason] = { count: 0, amount: 0 };
                  acc[reason].count++;
                  acc[reason].amount += j.returnAmount || 0;
                  return acc;
                }, {} as Record<string, { count: number; amount: number }>);
                // Excel export for returns
                const handleExportReturnsExcel = async () => {
                  const XLSX = await import("xlsx");
                  const wb = XLSX.utils.book_new();
                  
                  // Summary sheet
                  const summaryData = [
                    [`${t('returns.excelTitle')} - BUTTER BAKERY`],
                    [t('returns.periodLabel'), `${filters.startDate} - ${filters.endDate}`],
                    [],
                    [t('returns.summary')],
                    [t('returns.returnCount'), returnsCount],
                    [t('returns.totalReturns'), totalReturnAmount],
                    [t('returns.affectedBranches'), Object.keys(returnsByBranch).length],
                    [t('returns.avgReturn'), returnsCount > 0 ? totalReturnAmount / returnsCount : 0],
                  ];
                  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
                  XLSX.utils.book_append_sheet(wb, summarySheet, t('returns.summarySheet'));
                  
                  // By Branch sheet
                  const branchData = [
                    [t('returns.returnsByBranch')],
                    [t('returns.branchCol'), t('returns.countCol'), t('returns.amountCol'), t('returns.percentCol')],
                    ...Object.entries(returnsByBranch).map(([branch, data]) => [
                      branch, data.count, data.amount, totalReturnAmount > 0 ? `${((data.amount / totalReturnAmount) * 100).toFixed(1)}%` : "0%"
                    ])
                  ];
                  const branchSheet = XLSX.utils.aoa_to_sheet(branchData);
                  XLSX.utils.book_append_sheet(wb, branchSheet, t('returns.byBranchSheet'));
                  
                  // By Shift sheet
                  const shiftData = [
                    [t('returns.returnsByShift')],
                    [t('returns.shiftCol'), t('returns.countCol'), t('returns.amountCol')],
                    ...Object.entries(returnsByShift).map(([shift, data]) => [
                      t(`shiftsShort.${shift}`) || shift, data.count, data.amount
                    ])
                  ];
                  const shiftSheet = XLSX.utils.aoa_to_sheet(shiftData);
                  XLSX.utils.book_append_sheet(wb, shiftSheet, t('returns.byShiftSheet'));
                  
                  // By Payment Method sheet
                  const paymentData = [
                    [t('returns.returnsByPayment')],
                    [t('returns.paymentCol'), t('returns.countCol'), t('returns.amountCol')],
                    ...Object.entries(returnsByPaymentMethod).map(([method, data]) => [
                      t(`paymentMethods.${method}`) || method, data.count, data.amount
                    ])
                  ];
                  const paymentSheet = XLSX.utils.aoa_to_sheet(paymentData);
                  XLSX.utils.book_append_sheet(wb, paymentSheet, t('returns.byPaymentSheet'));
                  
                  // By Reason sheet
                  const reasonData = [
                    [t('returns.returnsByReason')],
                    [t('returns.reasonCol'), t('returns.countCol'), t('returns.amountCol')],
                    ...Object.entries(returnsByReason).map(([reason, data]) => [
                      reason, data.count, data.amount
                    ])
                  ];
                  const reasonSheet = XLSX.utils.aoa_to_sheet(reasonData);
                  XLSX.utils.book_append_sheet(wb, reasonSheet, t('returns.byReasonSheet'));
                  
                  // Details sheet
                  const detailsData = [
                    [t('returns.detailsTitle')],
                    [t('returns.dateCol'), t('returns.branchCol'), t('returns.cashierCol'), t('returns.shiftCol'), t('returns.returnAmountCol'), t('returns.paymentCol'), t('returns.reasonCol'), t('returns.invoiceCol')],
                    ...journalsWithReturns.map(j => [
                      j.journalDate,
                      branches?.find(b => b.id === j.branchId)?.name || j.branchId,
                      j.cashierName || '-',
                      t(`shiftsShort.${j.shiftType || ''}`) || j.shiftType || '-',
                      j.returnAmount || 0,
                      t(`paymentMethods.${j.returnPaymentMethod || ''}`) || j.returnPaymentMethod || '-',
                      j.returnReason || '-',
                      j.returnReference || '-'
                    ])
                  ];
                  const detailsSheet = XLSX.utils.aoa_to_sheet(detailsData);
                  XLSX.utils.book_append_sheet(wb, detailsSheet, t('returns.detailsSheet'));
                  
                  XLSX.writeFile(wb, `returns_report_${filters.startDate}_${filters.endDate}.xlsx`);
                };

                return (
                  <>
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Truck className="w-5 h-5 text-orange-600" />
                        {t('returns.title')}
                      </h2>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline"
                          className="gap-2 border-green-600 text-green-600 hover:bg-green-50" 
                          data-testid="button-export-returns-excel"
                          onClick={handleExportReturnsExcel}
                        >
                          <Download className="w-4 h-4" />
                          {t('returns.exportExcel')}
                        </Button>
                        <Button 
                          className="gap-2 bg-orange-600 hover:bg-orange-700" 
                          data-testid="button-export-returns-pdf"
                          onClick={() => {
                            const htmlContent = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>${t('returns.title')}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    @page { size: A4; margin: 10mm 10mm 20mm 10mm; }
    @media print {
      @page { margin-top: 10mm; margin-bottom: 20mm; }
      body::after { content: "${t('returns.pdfReportTitle')} | ${new Date().toLocaleDateString('en-GB')}"; position: fixed; bottom: 5mm; left: 0; right: 0; text-align: center; font-size: 8px; color: #666; }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Cairo', Arial, sans-serif; direction: rtl; padding: 15px; background: white; color: #333; font-size: 10px; }
    .page-footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: 8px; color: #666; padding: 5px; border-top: 1px solid #eee; background: white; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #ea580c; padding-bottom: 10px; margin-bottom: 15px; }
    .header-logo { display: flex; align-items: center; gap: 12px; }
    .header-logo .logo-circle { width: 50px; height: 50px; background: linear-gradient(135deg, #D4A574 0%, #8B6914 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; }
    .header-logo .logo-text { font-size: 20px; font-weight: bold; color: #fff; }
    .header .title { font-size: 18px; font-weight: bold; color: #ea580c; }
    .header .brand { font-size: 14px; font-weight: bold; color: #8B6914; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 15px; }
    .summary-card { background: #fff7ed; padding: 12px; border-radius: 8px; text-align: center; border: 1px solid #fdba74; }
    .summary-card .value { font-size: 16px; font-weight: bold; color: #ea580c; }
    .summary-card .label { color: #9a3412; font-size: 9px; }
    .section { margin-bottom: 15px; }
    .section-title { font-size: 12px; font-weight: bold; color: white; padding: 6px 12px; background: #ea580c; border-radius: 6px; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 9px; }
    th, td { border: 1px solid #ddd; padding: 6px; text-align: right; }
    th { background: #f0f0f0; }
    .amount-red { color: #dc2626; font-weight: bold; }
    .footer { margin-top: 15px; padding-top: 10px; border-top: 2px solid #D4A574; display: flex; justify-content: space-between; font-size: 9px; color: #666; }
    .footer .brand { color: #8B6914; font-weight: bold; }
    .print-btn { position: fixed; top: 10px; left: 10px; background: #ea580c; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-family: 'Cairo', sans-serif; }
    @media print { .print-btn { display: none !important; } }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">${t('pdf.print')}</button>
  <div class="header">
    <div class="header-logo">
      <div class="logo-circle"><span class="logo-text">B</span></div>
      <div>
        <div class="brand">BUTTER BAKERY</div>
        <div class="title">${t('returns.title')}</div>
      </div>
    </div>
    <div style="text-align: left; font-size: 11px;">
      <div style="color: #8B6914; font-weight: bold;">CEO COMMAND CENTER</div>
      <div style="background: #dbeafe; padding: 4px 8px; border-radius: 4px; margin-top: 4px; border: 1px solid #3b82f6;">
        <strong style="color: #1e40af;">🏢 ${t('common.branch')}</strong> <span style="color: #1e40af; font-weight: bold;">${filters.branchId ? (branches?.find(b => b.id === filters.branchId)?.name || filters.branchId) : t('common.allBranches')}</span>
      </div>
      <div style="background: #fff7ed; padding: 4px 8px; border-radius: 4px; margin-top: 4px;">
        <strong>${t('common.period')}</strong> ${filters.startDate} ${t('common.to')} ${filters.endDate}
        <br/><span style="font-size: 9px; color: #9a3412;">${Math.ceil((new Date(filters.endDate).getTime() - new Date(filters.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} ${t('common.day')}</span>
      </div>
    </div>
  </div>
  
  <!-- ملخص تحليلي للمرتجعات -->
  <div style="background: linear-gradient(135deg, #9a3412 0%, #7c2d12 100%); color: white; padding: 15px; border-radius: 10px; margin-bottom: 15px;">
    <div style="text-align: center; margin-bottom: 10px;">
      <span style="font-size: 14px; font-weight: bold;">📊 ${t('returns.analyticalSummary')}</span>
    </div>
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; text-align: center;">
      <div>
        <div style="font-size: 22px; font-weight: bold; color: #fbbf24;">${returnsCount}</div>
        <div style="font-size: 9px; opacity: 0.8;">${t('returns.returnOps')}</div>
      </div>
      <div>
        <div style="font-size: 22px; font-weight: bold; color: #f87171;">${formatCurrency(totalReturnAmount)}</div>
        <div style="font-size: 9px; opacity: 0.8;">${t('returns.totalReturns')}</div>
      </div>
      <div>
        <div style="font-size: 22px; font-weight: bold; color: #a5b4fc;">${Object.keys(returnsByBranch).length}</div>
        <div style="font-size: 9px; opacity: 0.8;">${t('returns.affectedBranches')}</div>
      </div>
      <div>
        <div style="font-size: 22px; font-weight: bold; color: #fcd34d;">${returnsCount > 0 ? formatCurrency(totalReturnAmount / returnsCount) : formatCurrency(0)}</div>
        <div style="font-size: 9px; opacity: 0.8;">${t('returns.avgReturn')}</div>
      </div>
    </div>
  </div>

  <!-- مؤشرات الأداء -->
  <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 15px;">
    <div style="background: #fef2f2; border: 2px solid #dc2626; border-radius: 8px; padding: 12px; text-align: center;">
      <div style="font-size: 10px; color: #991b1b;">📉 ${t('returns.dailyAvgReturn')}</div>
      <div style="font-size: 16px; font-weight: bold; color: #dc2626;">${formatCurrency(totalReturnAmount / Math.max(1, Math.ceil((new Date(filters.endDate).getTime() - new Date(filters.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1))}</div>
    </div>
    <div style="background: #fff7ed; border: 2px solid #ea580c; border-radius: 8px; padding: 12px; text-align: center;">
      <div style="font-size: 10px; color: #9a3412;">📊 ${t('returns.dailyReturnCount')}</div>
      <div style="font-size: 16px; font-weight: bold; color: #ea580c;">${(returnsCount / Math.max(1, Math.ceil((new Date(filters.endDate).getTime() - new Date(filters.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1)).toFixed(1)}</div>
    </div>
    <div style="background: #fef3c7; border: 2px solid #d97706; border-radius: 8px; padding: 12px; text-align: center;">
      <div style="font-size: 10px; color: #92400e;">🏢 ${t('returns.topReturnBranch')}</div>
      <div style="font-size: 14px; font-weight: bold; color: #d97706;">${Object.entries(returnsByBranch).sort((a, b) => b[1].amount - a[1].amount)[0]?.[0] || '-'}</div>
    </div>
  </div>

  <div class="summary-grid">
    <div class="summary-card"><div class="value">${returnsCount}</div><div class="label">${t('returns.returnOps')}</div></div>
    <div class="summary-card"><div class="value amount-red">${formatCurrency(totalReturnAmount)}</div><div class="label">${t('returns.totalReturns')}</div></div>
    <div class="summary-card"><div class="value">${Object.keys(returnsByBranch).length}</div><div class="label">${t('returns.affectedBranches')}</div></div>
    <div class="summary-card"><div class="value">${returnsCount > 0 ? formatCurrency(totalReturnAmount / returnsCount) : formatCurrency(0)}</div><div class="label">${t('returns.avgReturn')}</div></div>
  </div>
  <div class="section">
    <div class="section-title">${t('returns.byBranch')}</div>
    <table><thead><tr><th>${t('returns.branchCol')}</th><th>${t('returns.countCol')}</th><th>${t('returns.amountCol')}</th><th>${t('returns.percentCol')}</th></tr></thead><tbody>
    ${Object.entries(returnsByBranch).map(([branch, data]) => `<tr><td>${branch}</td><td>${data.count}</td><td class="amount-red">${formatCurrency(data.amount)}</td><td>${totalReturnAmount > 0 ? ((data.amount / totalReturnAmount) * 100).toFixed(1) : 0}%</td></tr>`).join('')}
    </tbody></table>
  </div>
  <div class="section">
    <div class="section-title">${t('returns.byShift')}</div>
    <table><thead><tr><th>${t('returns.shiftCol')}</th><th>${t('returns.countCol')}</th><th>${t('returns.amountCol')}</th></tr></thead><tbody>
    ${Object.entries(returnsByShift).map(([shift, data]) => `<tr><td>${t(`shiftsShort.${shift}`) || shift}</td><td>${data.count}</td><td class="amount-red">${formatCurrency(data.amount)}</td></tr>`).join('')}
    </tbody></table>
  </div>
  <div class="section">
    <div class="section-title">${t('returns.byPayment')}</div>
    <table><thead><tr><th>${t('returns.paymentMethodCol')}</th><th>${t('returns.countCol')}</th><th>${t('returns.amountCol')}</th></tr></thead><tbody>
    ${Object.entries(returnsByPaymentMethod).map(([method, data]) => `<tr><td>${t(`paymentMethods.${method}`) || method}</td><td>${data.count}</td><td class="amount-red">${formatCurrency(data.amount)}</td></tr>`).join('')}
    </tbody></table>
  </div>
  <div class="section">
    <div class="section-title">${t('returns.byReason')}</div>
    <table><thead><tr><th>${t('returns.reasonCol')}</th><th>${t('returns.countCol')}</th><th>${t('returns.amountCol')}</th></tr></thead><tbody>
    ${Object.entries(returnsByReason).map(([reason, data]) => `<tr><td>${reason}</td><td>${data.count}</td><td class="amount-red">${formatCurrency(data.amount)}</td></tr>`).join('')}
    </tbody></table>
  </div>
  <div class="section">
    <div class="section-title">${t('returns.detailsTitle', { count: returnsCount })}</div>
    <table><thead><tr><th>${t('returns.dateCol')}</th><th>${t('returns.branchCol')}</th><th>${t('returns.cashierCol')}</th><th>${t('returns.shiftCol')}</th><th>${t('returns.amountCol')}</th><th>${t('returns.paymentMethodCol')}</th><th>${t('returns.reasonCol')}</th></tr></thead><tbody>
    ${journalsWithReturns.map(j => `<tr><td>${j.journalDate}</td><td>${branches?.find(b => b.id === j.branchId)?.name || j.branchId}</td><td>${j.cashierName || '-'}</td><td>${t(`shiftsShort.${j.shiftType || ''}`) || j.shiftType || '-'}</td><td class="amount-red">${formatCurrency(j.returnAmount || 0)}</td><td>${t(`paymentMethods.${j.returnPaymentMethod || ''}`) || j.returnPaymentMethod || '-'}</td><td>${j.returnReason || '-'}</td></tr>`).join('')}
    </tbody></table>
  </div>
  <div class="footer"><span class="brand">BUTTER BAKERY SYSTEM - CEO COMMAND</span><span>${t('returns.printDate')} ${new Date().toLocaleDateString('en-GB')}</span></div>
</body>
</html>`;
                            printHtmlContent(htmlContent);
                          }}
                        >
                          <FileDown className="w-4 h-4" />
                          {t('returns.exportPDF')}
                        </Button>
                      </div>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-orange-500 rounded-lg">
                              <Truck className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <p className="text-xs text-orange-700">{t('returns.returnOps')}</p>
                              <p className="text-xl font-bold text-orange-800">{returnsCount}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-500 rounded-lg">
                              <DollarSign className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <p className="text-xs text-red-700">{t('returns.totalReturns')}</p>
                              <p className="text-xl font-bold text-red-800">{formatCurrency(totalReturnAmount)}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-500 rounded-lg">
                              <Building2 className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <p className="text-xs text-amber-700">{t('returns.affectedBranches')}</p>
                              <p className="text-xl font-bold text-amber-800">{Object.keys(returnsByBranch).length}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-500 rounded-lg">
                              <TrendingDown className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <p className="text-xs text-purple-700">{t('returns.avgReturn')}</p>
                              <p className="text-xl font-bold text-purple-800">{returnsCount > 0 ? formatCurrency(totalReturnAmount / returnsCount) : formatCurrency(0)}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {returnsCount > 0 ? (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Returns by Branch */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                              <Building2 className="w-5 h-5 text-orange-600" />
                              {t('returns.returnsByBranch')}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="h-[280px]">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={Object.entries(returnsByBranch).map(([branch, data]) => ({ branch, ...data }))}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="branch" fontSize={10} angle={-45} textAnchor="end" height={60} />
                                  <YAxis fontSize={10} />
                                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                  <Bar dataKey="amount" name={t('returns.amount')} fill="#ea580c" radius={[4, 4, 0, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Returns by Shift */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                              <Clock className="w-5 h-5 text-blue-600" />
                              {t('returns.returnsByShift')}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="h-[280px]">
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie
                                    data={Object.entries(returnsByShift).map(([shift, data]) => ({ 
                                      name: t(`shiftsShort.${shift}`) || shift, 
                                      value: data.amount 
                                    }))}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={90}
                                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                  >
                                    {Object.keys(returnsByShift).map((_, index) => (
                                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                  </Pie>
                                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                  <Legend />
                                </PieChart>
                              </ResponsiveContainer>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Returns by Payment Method */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                              <CreditCard className="w-5 h-5 text-green-600" />
                              {t('returns.returnsByPayment')}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              {Object.entries(returnsByPaymentMethod).map(([method, data]) => (
                                <div key={method} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline">{t(`paymentMethods.${method}`) || method}</Badge>
                                    <span className="text-sm text-muted-foreground">({data.count} {t('returns.operation')})</span>
                                  </div>
                                  <span className="font-semibold text-red-600">{formatCurrency(data.amount)}</span>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>

                        {/* Returns by Reason */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                              <ClipboardList className="w-5 h-5 text-purple-600" />
                              {t('returns.returnReasons')}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              {Object.entries(returnsByReason).map(([reason, data]) => (
                                <div key={reason} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                  <div className="flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                                    <span className="text-sm">{reason}</span>
                                    <span className="text-xs text-muted-foreground">({data.count})</span>
                                  </div>
                                  <span className="font-semibold text-red-600">{formatCurrency(data.amount)}</span>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    ) : (
                      <Card>
                        <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
                          <Truck className="w-12 h-12 text-muted-foreground" />
                          <p className="text-muted-foreground">{t('returns.noReturns')}</p>
                        </CardContent>
                      </Card>
                    )}

                    {/* Detailed Returns Table */}
                    {returnsCount > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <FileText className="w-5 h-5 text-orange-600" />
                            {t('returns.detailsTitle', { count: returnsCount })}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b bg-muted/50">
                                  <th className="text-right py-3 px-4">{t('returns.dateCol')}</th>
                                  <th className="text-right py-3 px-4">{t('returns.branchCol')}</th>
                                  <th className="text-right py-3 px-4">{t('returns.cashierCol')}</th>
                                  <th className="text-right py-3 px-4">{t('returns.shiftCol')}</th>
                                  <th className="text-right py-3 px-4">{t('returns.returnAmountCol')}</th>
                                  <th className="text-right py-3 px-4">{t('returns.paymentMethodCol')}</th>
                                  <th className="text-right py-3 px-4">{t('returns.reasonCol')}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {journalsWithReturns.map((journal) => (
                                  <tr key={journal.id} className="border-b hover:bg-muted/50">
                                    <td className="py-3 px-4">{journal.journalDate}</td>
                                    <td className="py-3 px-4">{branches?.find(b => b.id === journal.branchId)?.name || journal.branchId}</td>
                                    <td className="py-3 px-4">{journal.cashierName || '-'}</td>
                                    <td className="py-3 px-4">
                                      <Badge variant="outline">{t(`shiftsShort.${journal.shiftType || ''}`) || journal.shiftType || '-'}</Badge>
                                    </td>
                                    <td className="py-3 px-4 font-semibold text-red-600">{formatCurrency(journal.returnAmount || 0)}</td>
                                    <td className="py-3 px-4">{t(`paymentMethods.${journal.returnPaymentMethod || ''}`) || journal.returnPaymentMethod || '-'}</td>
                                    <td className="py-3 px-4 text-muted-foreground">{journal.returnReason || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </>
                );
              })()}
            </TabsContent>

            {/* تقرير فروقات المدفوعات - Payment Discrepancies Report */}
            <TabsContent value="discrepancies" className="space-y-6">
              {(() => {
                const journalsWithDiscrepancies = filteredCashierJournals.filter(j => 
                  j.discrepancyStatus !== 'balanced' || 
                  (j.discrepancyAmount && j.discrepancyAmount !== 0)
                );
                
                const shortages = journalsWithDiscrepancies.filter(j => j.discrepancyStatus === 'shortage' || (j.discrepancyAmount && j.discrepancyAmount < 0));
                const surpluses = journalsWithDiscrepancies.filter(j => j.discrepancyStatus === 'surplus' || (j.discrepancyAmount && j.discrepancyAmount > 0));
                const totalShortageAmount = shortages.reduce((sum, j) => sum + Math.abs(j.discrepancyAmount || 0), 0);
                const totalSurplusAmount = surpluses.reduce((sum, j) => sum + (j.discrepancyAmount || 0), 0);
                const netDiscrepancy = totalSurplusAmount - totalShortageAmount;
                
                // Group by Cashier
                const discrepanciesByCashier = journalsWithDiscrepancies.reduce((acc, j) => {
                  const cashierName = j.cashierName || 'unspecified';
                  if (!acc[cashierName]) acc[cashierName] = { shortage: 0, surplus: 0, count: 0, journals: [] };
                  acc[cashierName].count++;
                  if ((j.discrepancyAmount || 0) < 0) {
                    acc[cashierName].shortage += Math.abs(j.discrepancyAmount || 0);
                  } else {
                    acc[cashierName].surplus += (j.discrepancyAmount || 0);
                  }
                  acc[cashierName].journals.push(j);
                  return acc;
                }, {} as Record<string, { shortage: number; surplus: number; count: number; journals: typeof journalsWithDiscrepancies }>);
                
                // Group by Branch
                const discrepanciesByBranch = journalsWithDiscrepancies.reduce((acc, j) => {
                  const branchName = branches?.find(b => b.id === j.branchId)?.name || j.branchId;
                  if (!acc[branchName]) acc[branchName] = { shortage: 0, surplus: 0, count: 0 };
                  acc[branchName].count++;
                  if ((j.discrepancyAmount || 0) < 0) {
                    acc[branchName].shortage += Math.abs(j.discrepancyAmount || 0);
                  } else {
                    acc[branchName].surplus += (j.discrepancyAmount || 0);
                  }
                  return acc;
                }, {} as Record<string, { shortage: number; surplus: number; count: number }>);
                
                // Group by Shift
                const discrepanciesByShift = journalsWithDiscrepancies.reduce((acc, j) => {
                  const shift = j.shiftType || 'unspecified';
                  if (!acc[shift]) acc[shift] = { shortage: 0, surplus: 0, count: 0 };
                  acc[shift].count++;
                  if ((j.discrepancyAmount || 0) < 0) {
                    acc[shift].shortage += Math.abs(j.discrepancyAmount || 0);
                  } else {
                    acc[shift].surplus += (j.discrepancyAmount || 0);
                  }
                  return acc;
                }, {} as Record<string, { shortage: number; surplus: number; count: number }>);
                // Excel export for discrepancies
                const handleExportDiscrepanciesExcel = async () => {
                  const XLSX = await import("xlsx");
                  const wb = XLSX.utils.book_new();
                  
                  // Summary sheet
                  const summaryData = [
                    [t('discrepancies.reportTitle') + ' - BUTTER BAKERY'],
                    [t('returns.periodLabel'), `${filters.startDate} - ${filters.endDate}`],
                    [],
                    [t('returns.summary')],
                    [t('discrepancies.shortageCases'), shortages.length],
                    [t('discrepancies.totalShortage'), totalShortageAmount],
                    [t('discrepancies.surplusCases'), surpluses.length],
                    [t('discrepancies.totalSurplus'), totalSurplusAmount],
                    [t('discrepancies.netDiscrepancies'), netDiscrepancy],
                  ];
                  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
                  XLSX.utils.book_append_sheet(wb, summarySheet, t('returns.summarySheet'));
                  
                  // By Cashier sheet
                  const cashierData = [
                    [t('discrepancies.byCashierTitle')],
                    [t('discrepancies.cashierCol'), t('discrepancies.casesCountCol'), t('discrepancies.totalShortageCol'), t('discrepancies.totalSurplusCol'), t('discrepancies.netCol')],
                    ...Object.entries(discrepanciesByCashier).map(([cashier, data]) => [
                      cashier, data.count, data.shortage, data.surplus, data.surplus - data.shortage
                    ])
                  ];
                  const cashierSheet = XLSX.utils.aoa_to_sheet(cashierData);
                  XLSX.utils.book_append_sheet(wb, cashierSheet, t('discrepancies.byCashierSheetName'));
                  
                  // By Branch sheet
                  const branchData = [
                    [t('discrepancies.byBranchTitle')],
                    [t('discrepancies.branchCol'), t('discrepancies.casesCountCol'), t('discrepancies.totalShortageCol'), t('discrepancies.totalSurplusCol'), t('discrepancies.netCol')],
                    ...Object.entries(discrepanciesByBranch).map(([branch, data]) => [
                      branch, data.count, data.shortage, data.surplus, data.surplus - data.shortage
                    ])
                  ];
                  const branchSheet = XLSX.utils.aoa_to_sheet(branchData);
                  XLSX.utils.book_append_sheet(wb, branchSheet, t('returns.byBranchSheet'));
                  
                  // By Shift sheet
                  const shiftData = [
                    [t('discrepancies.byShiftTitle')],
                    [t('discrepancies.shiftCol'), t('discrepancies.casesCountCol'), t('discrepancies.totalShortageCol'), t('discrepancies.totalSurplusCol'), t('discrepancies.netCol')],
                    ...Object.entries(discrepanciesByShift).map(([shift, data]) => [
                      t(`shiftsShort.${shift}`) || shift, data.count, data.shortage, data.surplus, data.surplus - data.shortage
                    ])
                  ];
                  const shiftSheet = XLSX.utils.aoa_to_sheet(shiftData);
                  XLSX.utils.book_append_sheet(wb, shiftSheet, t('returns.byShiftSheet'));
                  
                  // Details sheet
                  const detailsData = [
                    [t('discrepancies.detailsExcelTitle')],
                    [t('discrepancies.dateCol'), t('discrepancies.branchCol'), t('discrepancies.cashierCol'), t('discrepancies.shiftCol'), t('discrepancies.totalSalesCol'), t('discrepancies.discrepancyAmount'), t('discrepancies.statusCol'), t('discrepancies.notesCol')],
                    ...journalsWithDiscrepancies.map(j => [
                      j.journalDate,
                      branches?.find(b => b.id === j.branchId)?.name || j.branchId,
                      j.cashierName || '-',
                      t(`shiftsShort.${j.shiftType || ''}`) || j.shiftType || '-',
                      j.totalSales || 0,
                      j.discrepancyAmount || 0,
                      t(`discrepancyStatuses.${j.discrepancyStatus || 'balanced'}`),
                      j.notes || '-'
                    ])
                  ];
                  const detailsSheet = XLSX.utils.aoa_to_sheet(detailsData);
                  XLSX.utils.book_append_sheet(wb, detailsSheet, t('returns.detailsSheet'));
                  
                  XLSX.writeFile(wb, `${t('discrepancies.excelFileName')}_${filters.startDate}_${filters.endDate}.xlsx`);
                };

                return (
                  <>
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-red-600" />
                        {t('discrepancies.reportTitle')}
                      </h2>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline"
                          className="gap-2 border-green-600 text-green-600 hover:bg-green-50" 
                          data-testid="button-export-discrepancies-excel"
                          onClick={handleExportDiscrepanciesExcel}
                        >
                          <Download className="w-4 h-4" />
                          {t('discrepancies.exportExcel')}
                        </Button>
                        <Button 
                          className="gap-2 bg-red-600 hover:bg-red-700" 
                          data-testid="button-export-discrepancies-pdf"
                          onClick={() => {
                            const htmlContent = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>${t('discrepancies.reportTitle')}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    @page { size: A4; margin: 10mm 10mm 20mm 10mm; }
    @media print {
      @page { margin-top: 10mm; margin-bottom: 20mm; }
      body::after { content: "${t('discrepancies.pdfFooterText')} - BUTTER BAKERY | ${new Date().toLocaleDateString('en-GB')}"; position: fixed; bottom: 5mm; left: 0; right: 0; text-align: center; font-size: 8px; color: #666; }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Cairo', Arial, sans-serif; direction: rtl; padding: 15px; background: white; color: #333; font-size: 10px; }
    .page-footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: 8px; color: #666; padding: 5px; border-top: 1px solid #eee; background: white; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #dc2626; padding-bottom: 10px; margin-bottom: 15px; }
    .header-logo { display: flex; align-items: center; gap: 12px; }
    .header-logo .logo-circle { width: 50px; height: 50px; background: linear-gradient(135deg, #D4A574 0%, #8B6914 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; }
    .header-logo .logo-text { font-size: 20px; font-weight: bold; color: #fff; }
    .header .title { font-size: 18px; font-weight: bold; color: #dc2626; }
    .header .brand { font-size: 14px; font-weight: bold; color: #8B6914; }
    .summary-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 15px; }
    .summary-card { padding: 12px; border-radius: 8px; text-align: center; border: 1px solid; }
    .summary-card.shortage { background: #fef2f2; border-color: #fca5a5; }
    .summary-card.surplus { background: #dcfce7; border-color: #166534; }
    .summary-card.neutral { background: #f3f4f6; border-color: #d1d5db; }
    .summary-card .value { font-size: 16px; font-weight: bold; }
    .summary-card .label { font-size: 9px; }
    .section { margin-bottom: 15px; }
    .section-title { font-size: 12px; font-weight: bold; color: white; padding: 6px 12px; background: #dc2626; border-radius: 6px; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 9px; }
    th, td { border: 1px solid #ddd; padding: 6px; text-align: right; }
    th { background: #f0f0f0; }
    .shortage { color: #dc2626; font-weight: bold; }
    .surplus { color: #166534; font-weight: bold; }
    .net-banner { padding: 15px; margin: 15px 0; border-radius: 8px; text-align: center; }
    .net-banner.negative { background: #fef2f2; border: 2px solid #dc2626; }
    .net-banner.positive { background: #dcfce7; border: 2px solid #166534; }
    .net-banner .amount { font-size: 24px; font-weight: bold; }
    .footer { margin-top: 15px; padding-top: 10px; border-top: 2px solid #D4A574; display: flex; justify-content: space-between; font-size: 9px; color: #666; }
    .footer .brand { color: #8B6914; font-weight: bold; }
    .print-btn { position: fixed; top: 10px; left: 10px; background: #dc2626; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-family: 'Cairo', sans-serif; }
    @media print { .print-btn { display: none !important; } }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">${t('pdf.print')}</button>
  <div class="header">
    <div class="header-logo">
      <div class="logo-circle"><span class="logo-text">B</span></div>
      <div>
        <div class="brand">BUTTER BAKERY</div>
        <div class="title">${t('discrepancies.reportTitle')}</div>
      </div>
    </div>
    <div style="text-align: left; font-size: 11px;">
      <div style="color: #8B6914; font-weight: bold;">CEO COMMAND CENTER</div>
      <div style="background: #dbeafe; padding: 4px 8px; border-radius: 4px; margin-top: 4px; border: 1px solid #3b82f6;">
        <strong style="color: #1e40af;">🏢 ${t('common.branch')}</strong> <span style="color: #1e40af; font-weight: bold;">${filters.branchId ? (branches?.find(b => b.id === filters.branchId)?.name || filters.branchId) : t('common.allBranches')}</span>
      </div>
      <div style="background: #fef3c7; padding: 4px 8px; border-radius: 4px; margin-top: 4px;">
        <strong>${t('common.period')}</strong> ${filters.startDate} ${t('common.to')} ${filters.endDate}
        <br/><span style="font-size: 9px; color: #92400e;">${Math.ceil((new Date(filters.endDate).getTime() - new Date(filters.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} ${t('common.day')}</span>
      </div>
    </div>
  </div>
  
  <!-- ملخص تحليلي شامل -->
  <div style="background: linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%); color: white; padding: 15px; border-radius: 10px; margin-bottom: 15px;">
    <div style="text-align: center; margin-bottom: 10px;">
      <span style="font-size: 14px; font-weight: bold;">📊 ${t('discrepancies.comprehensiveSummary')}</span>
    </div>
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; text-align: center;">
      <div>
        <div style="font-size: 22px; font-weight: bold; color: #fbbf24;">${journalsWithDiscrepancies.length}</div>
        <div style="font-size: 9px; opacity: 0.8;">${t('discrepancies.totalDiscrepancyCases')}</div>
      </div>
      <div>
        <div style="font-size: 22px; font-weight: bold; color: #f87171;">${formatCurrency(totalShortageAmount)}</div>
        <div style="font-size: 9px; opacity: 0.8;">${t('discrepancies.totalShortage')}</div>
      </div>
      <div>
        <div style="font-size: 22px; font-weight: bold; color: #4ade80;">${formatCurrency(totalSurplusAmount)}</div>
        <div style="font-size: 9px; opacity: 0.8;">${t('discrepancies.totalSurplus')}</div>
      </div>
      <div>
        <div style="font-size: 22px; font-weight: bold; color: ${netDiscrepancy < 0 ? '#f87171' : '#4ade80'};">${formatCurrency(netDiscrepancy)}</div>
        <div style="font-size: 9px; opacity: 0.8;">${t('discrepancies.netDiscrepancies')}</div>
      </div>
    </div>
  </div>

  <!-- مؤشرات الأداء الرئيسية -->
  <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 15px;">
    <div style="background: #fef2f2; border: 2px solid #dc2626; border-radius: 8px; padding: 12px; text-align: center;">
      <div style="font-size: 10px; color: #991b1b;">📉 ${t('discrepancies.dailyAvgShortage')}</div>
      <div style="font-size: 16px; font-weight: bold; color: #dc2626;">${formatCurrency(totalShortageAmount / Math.max(1, Math.ceil((new Date(filters.endDate).getTime() - new Date(filters.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1))}</div>
    </div>
    <div style="background: #dcfce7; border: 2px solid #166534; border-radius: 8px; padding: 12px; text-align: center;">
      <div style="font-size: 10px; color: #166534;">📈 ${t('discrepancies.dailyAvgSurplus')}</div>
      <div style="font-size: 16px; font-weight: bold; color: #166534;">${formatCurrency(totalSurplusAmount / Math.max(1, Math.ceil((new Date(filters.endDate).getTime() - new Date(filters.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1))}</div>
    </div>
    <div style="background: #fef3c7; border: 2px solid #d97706; border-radius: 8px; padding: 12px; text-align: center;">
      <div style="font-size: 10px; color: #92400e;">⚖️ ${t('discrepancies.shortageToSurplusRatio')}</div>
      <div style="font-size: 16px; font-weight: bold; color: #d97706;">${totalSurplusAmount > 0 ? (totalShortageAmount / totalSurplusAmount * 100).toFixed(0) : 0}%</div>
    </div>
  </div>

  <div class="summary-grid">
    <div class="summary-card shortage"><div class="value shortage">${shortages.length}</div><div class="label">${t('discrepancies.shortageCases')}</div></div>
    <div class="summary-card shortage"><div class="value shortage">${formatCurrency(totalShortageAmount)}</div><div class="label">${t('discrepancies.totalShortage')}</div></div>
    <div class="summary-card surplus"><div class="value surplus">${surpluses.length}</div><div class="label">${t('discrepancies.surplusCases')}</div></div>
    <div class="summary-card surplus"><div class="value surplus">${formatCurrency(totalSurplusAmount)}</div><div class="label">${t('discrepancies.totalSurplus')}</div></div>
    <div class="summary-card ${netDiscrepancy < 0 ? 'shortage' : 'surplus'}"><div class="value ${netDiscrepancy < 0 ? 'shortage' : 'surplus'}">${formatCurrency(netDiscrepancy)}</div><div class="label">${t('discrepancies.netDiscrepancies')}</div></div>
  </div>

  <!-- أكبر الفروقات -->
  ${journalsWithDiscrepancies.length > 0 ? `
  <div style="background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 10px; margin-bottom: 15px;">
    <div style="font-size: 11px; font-weight: bold; color: #991b1b; margin-bottom: 8px;">⚠️ ${t('discrepancies.topDiscrepancies')}</div>
    ${[...journalsWithDiscrepancies].sort((a, b) => Math.abs(b.discrepancyAmount || 0) - Math.abs(a.discrepancyAmount || 0)).slice(0, 3).map((j, i) => `
      <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed #fca5a5; font-size: 9px;">
        <span>#${i + 1} ${j.journalDate} - ${j.cashierName || 'unspecified'} (${branches?.find(b => b.id === j.branchId)?.name || j.branchId})</span>
        <span style="font-weight: bold; color: ${(j.discrepancyAmount || 0) < 0 ? '#dc2626' : '#166534'};">${formatCurrency(j.discrepancyAmount || 0)}</span>
      </div>
    `).join('')}
  </div>
  ` : ''}

  <div class="section">
    <div class="section-title">${t('discrepancies.byCashierTitle')}</div>
    <table><thead><tr><th>${t('discrepancies.cashierCol')}</th><th>${t('discrepancies.casesCountCol')}</th><th>${t('discrepancies.totalShortageCol')}</th><th>${t('discrepancies.totalSurplusCol')}</th><th>${t('discrepancies.netCol')}</th></tr></thead><tbody>
    ${Object.entries(discrepanciesByCashier).map(([cashier, data]) => `<tr><td>${cashier}</td><td>${data.count}</td><td class="shortage">${formatCurrency(data.shortage)}</td><td class="surplus">${formatCurrency(data.surplus)}</td><td class="${data.surplus - data.shortage < 0 ? 'shortage' : 'surplus'}">${formatCurrency(data.surplus - data.shortage)}</td></tr>`).join('')}
    </tbody></table>
  </div>
  <div class="section">
    <div class="section-title">${t('discrepancies.byBranchTitle')}</div>
    <table><thead><tr><th>${t('discrepancies.branchCol')}</th><th>${t('discrepancies.casesCountCol')}</th><th>${t('discrepancies.totalShortageCol')}</th><th>${t('discrepancies.totalSurplusCol')}</th><th>${t('discrepancies.netCol')}</th></tr></thead><tbody>
    ${Object.entries(discrepanciesByBranch).map(([branch, data]) => `<tr><td>${branch}</td><td>${data.count}</td><td class="shortage">${formatCurrency(data.shortage)}</td><td class="surplus">${formatCurrency(data.surplus)}</td><td class="${data.surplus - data.shortage < 0 ? 'shortage' : 'surplus'}">${formatCurrency(data.surplus - data.shortage)}</td></tr>`).join('')}
    </tbody></table>
  </div>
  <div class="section">
    <div class="section-title">${t('discrepancies.byShiftTitle')}</div>
    <table><thead><tr><th>${t('discrepancies.shiftCol')}</th><th>${t('discrepancies.casesCountCol')}</th><th>${t('discrepancies.totalShortageCol')}</th><th>${t('discrepancies.totalSurplusCol')}</th><th>${t('discrepancies.netCol')}</th></tr></thead><tbody>
    ${Object.entries(discrepanciesByShift).map(([shift, data]) => `<tr><td>${t(`shiftsShort.${shift}`) || shift}</td><td>${data.count}</td><td class="shortage">${formatCurrency(data.shortage)}</td><td class="surplus">${formatCurrency(data.surplus)}</td><td class="${data.surplus - data.shortage < 0 ? 'shortage' : 'surplus'}">${formatCurrency(data.surplus - data.shortage)}</td></tr>`).join('')}
    </tbody></table>
  </div>
  <div class="section">
    <div class="section-title">${t('discrepancies.detailsTitle', { count: journalsWithDiscrepancies.length })}</div>
    <table><thead><tr><th>${t('discrepancies.dateCol')}</th><th>${t('discrepancies.branchCol')}</th><th>${t('discrepancies.cashierCol')}</th><th>${t('discrepancies.shiftCol')}</th><th>${t('discrepancies.salesCol')}</th><th>${t('discrepancies.discrepancyAmount')}</th><th>${t('discrepancies.statusCol')}</th></tr></thead><tbody>
    ${journalsWithDiscrepancies.map(j => `<tr><td>${j.journalDate}</td><td>${branches?.find(b => b.id === j.branchId)?.name || j.branchId}</td><td>${j.cashierName || '-'}</td><td>${t(`shiftsShort.${j.shiftType || ''}`) || j.shiftType || '-'}</td><td>${formatCurrency(j.totalSales || 0)}</td><td class="${(j.discrepancyAmount || 0) < 0 ? 'shortage' : 'surplus'}">${formatCurrency(j.discrepancyAmount || 0)}</td><td>${t(`discrepancyStatuses.${j.discrepancyStatus || 'balanced'}`)}</td></tr>`).join('')}
    </tbody></table>
  </div>
  <div class="footer"><span class="brand">BUTTER BAKERY SYSTEM - CEO COMMAND</span><span>${t('returns.printDate')} ${new Date().toLocaleDateString('en-GB')}</span></div>
</body>
</html>`;
                            printHtmlContent(htmlContent);
                          }}
                        >
                          <FileDown className="w-4 h-4" />
                          {t('discrepancies.exportPDF')}
                        </Button>
                      </div>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-500 rounded-lg">
                              <TrendingDown className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <p className="text-xs text-red-700">{t('discrepancies.shortageCases')}</p>
                              <p className="text-xl font-bold text-red-800">{shortages.length}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-600 rounded-lg">
                              <DollarSign className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <p className="text-xs text-red-700">{t('discrepancies.totalShortage')}</p>
                              <p className="text-xl font-bold text-red-800">{formatCurrency(totalShortageAmount)}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-500 rounded-lg">
                              <TrendingUp className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <p className="text-xs text-green-700">{t('discrepancies.surplusCases')}</p>
                              <p className="text-xl font-bold text-green-800">{surpluses.length}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-600 rounded-lg">
                              <DollarSign className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <p className="text-xs text-green-700">{t('discrepancies.totalSurplus')}</p>
                              <p className="text-xl font-bold text-green-800">{formatCurrency(totalSurplusAmount)}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Net Discrepancy Banner */}
                    <Card className={`border-2 ${netDiscrepancy < 0 ? 'border-red-300 bg-red-50' : netDiscrepancy > 0 ? 'border-green-300 bg-green-50' : 'border-gray-300 bg-gray-50'}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <AlertTriangle className={`w-6 h-6 ${netDiscrepancy < 0 ? 'text-red-600' : netDiscrepancy > 0 ? 'text-green-600' : 'text-gray-600'}`} />
                            <div>
                              <p className="text-sm font-medium">{t('discrepancies.netDiscrepancies')}</p>
                              <p className="text-xs text-muted-foreground">{t('discrepancies.netFormula')}</p>
                            </div>
                          </div>
                          <div className={`text-2xl font-bold ${netDiscrepancy < 0 ? 'text-red-600' : netDiscrepancy > 0 ? 'text-green-600' : 'text-gray-600'}`}>
                            {formatCurrency(netDiscrepancy)}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {journalsWithDiscrepancies.length > 0 ? (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Discrepancies by Cashier */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                              <User className="w-5 h-5 text-blue-600" />
                              {t('discrepancies.byCashier')}
                            </CardTitle>
                            <CardDescription>{t('discrepancies.byCashierDesc')}</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              {Object.entries(discrepanciesByCashier)
                                .sort((a, b) => (b[1].shortage - b[1].surplus) - (a[1].shortage - a[1].surplus))
                                .slice(0, 10)
                                .map(([cashier, data]) => (
                                  <div key={cashier} className="p-3 bg-gray-50 rounded-lg border">
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        <User className="w-4 h-4 text-gray-500" />
                                        <span className="font-medium">{cashier}</span>
                                        <Badge variant="outline" className="text-xs">{t('discrepancies.caseCount', { count: data.count })}</Badge>
                                      </div>
                                      <span className={`font-bold ${data.surplus - data.shortage < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        {formatCurrency(data.surplus - data.shortage)}
                                      </span>
                                    </div>
                                    <div className="flex gap-4 text-xs">
                                      <span className="text-red-600">{t('discrepancies.shortage')}: {formatCurrency(data.shortage)}</span>
                                      <span className="text-green-600">{t('discrepancies.surplus')}: {formatCurrency(data.surplus)}</span>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </CardContent>
                        </Card>

                        {/* Discrepancies by Branch */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                              <Building2 className="w-5 h-5 text-amber-600" />
                              {t('discrepancies.byBranch')}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="h-[280px]">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart 
                                  data={Object.entries(discrepanciesByBranch).map(([branch, data]) => ({ 
                                    branch, 
                                    shortage: data.shortage,
                                    surplus: data.surplus
                                  }))}
                                  layout="vertical"
                                >
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis type="number" fontSize={10} />
                                  <YAxis dataKey="branch" type="category" fontSize={10} width={80} />
                                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                  <Legend />
                                  <Bar dataKey="shortage" name={t('discrepancies.shortage')} fill="#dc2626" stackId="a" />
                                  <Bar dataKey="surplus" name={t('discrepancies.surplus')} fill="#16a34a" stackId="b" />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Discrepancies by Shift */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                              <Clock className="w-5 h-5 text-purple-600" />
                              {t('discrepancies.byShift')}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="h-[250px]">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={Object.entries(discrepanciesByShift).map(([shift, data]) => ({ 
                                  shift: t(`shiftsShort.${shift}`) || shift, 
                                  shortage: data.shortage,
                                  surplus: data.surplus,
                                  net: data.surplus - data.shortage
                                }))}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="shift" fontSize={10} />
                                  <YAxis fontSize={10} />
                                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                  <Legend />
                                  <Bar dataKey="shortage" name={t('discrepancies.shortage')} fill="#dc2626" />
                                  <Bar dataKey="surplus" name={t('discrepancies.surplus')} fill="#16a34a" />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Top Discrepancy Cases */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                              <AlertTriangle className="w-5 h-5 text-red-600" />
                              {t('discrepancies.topCases')}
                            </CardTitle>
                            <CardDescription>{t('discrepancies.topCasesDesc')}</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              {journalsWithDiscrepancies
                                .sort((a, b) => Math.abs(b.discrepancyAmount || 0) - Math.abs(a.discrepancyAmount || 0))
                                .slice(0, 8)
                                .map((journal) => (
                                  <div key={journal.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
                                    <div className="flex items-center gap-2">
                                      <Badge variant={journal.discrepancyStatus === 'shortage' ? 'destructive' : 'default'} className="text-xs">
                                        {t(`discrepancyStatuses.${journal.discrepancyStatus || 'balanced'}`)}
                                      </Badge>
                                      <span className="text-sm">{journal.cashierName}</span>
                                      <span className="text-xs text-muted-foreground">{journal.journalDate}</span>
                                    </div>
                                    <span className={`font-bold ${journal.discrepancyStatus === 'shortage' ? 'text-red-600' : journal.discrepancyStatus === 'surplus' ? 'text-green-600' : 'text-gray-600'}`}>
                                      {journal.discrepancyStatus === 'shortage' ? '-' : ''}{formatCurrency(Math.abs(journal.discrepancyAmount || 0))}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    ) : (
                      <Card>
                        <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
                          <CheckCircle className="w-12 h-12 text-green-600" />
                          <p className="text-green-700 font-medium">{t('discrepancies.noDiscrepancies')}</p>
                        </CardContent>
                      </Card>
                    )}

                    {/* Detailed Discrepancies Table */}
                    {journalsWithDiscrepancies.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <FileText className="w-5 h-5 text-red-600" />
                            {t('discrepancies.detailsTitle', { count: journalsWithDiscrepancies.length })}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b bg-muted/50">
                                  <th className="text-right py-3 px-4">{t('discrepancies.dateCol')}</th>
                                  <th className="text-right py-3 px-4">{t('discrepancies.branchCol')}</th>
                                  <th className="text-right py-3 px-4">{t('discrepancies.cashierCol')}</th>
                                  <th className="text-right py-3 px-4">{t('discrepancies.shiftCol')}</th>
                                  <th className="text-right py-3 px-4">{t('discrepancies.salesCol')}</th>
                                  <th className="text-right py-3 px-4">{t('discrepancies.discrepancyAmount')}</th>
                                  <th className="text-right py-3 px-4">{t('discrepancies.statusCol')}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {journalsWithDiscrepancies.map((journal) => (
                                  <tr key={journal.id} className="border-b hover:bg-muted/50">
                                    <td className="py-3 px-4">{journal.journalDate}</td>
                                    <td className="py-3 px-4">{branches?.find(b => b.id === journal.branchId)?.name || journal.branchId}</td>
                                    <td className="py-3 px-4 font-medium">{journal.cashierName || '-'}</td>
                                    <td className="py-3 px-4">
                                      <Badge variant="outline">{t(`shiftsShort.${journal.shiftType || ''}`) || journal.shiftType || '-'}</Badge>
                                    </td>
                                    <td className="py-3 px-4">{formatCurrency(journal.totalSales || 0)}</td>
                                    <td className={`py-3 px-4 font-bold ${journal.discrepancyStatus === 'shortage' ? 'text-red-600' : journal.discrepancyStatus === 'surplus' ? 'text-green-600' : 'text-gray-600'}`}>
                                      {journal.discrepancyStatus === 'shortage' ? '-' : ''}{formatCurrency(Math.abs(journal.discrepancyAmount || 0))}
                                    </td>
                                    <td className="py-3 px-4">
                                      <Badge variant={journal.discrepancyStatus === 'shortage' ? 'destructive' : journal.discrepancyStatus === 'surplus' ? 'default' : 'secondary'}>
                                        {t(`discrepancyStatuses.${journal.discrepancyStatus || 'balanced'}`)}
                                      </Badge>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </>
                );
              })()}
            </TabsContent>

            {/* تقرير مطابقة طرق الدفع - Payment Method Mismatch Report */}
            <TabsContent value="payment-mismatch" className="space-y-6">
              {paymentMismatchLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-24" />
                  ))}
                </div>
              ) : paymentMismatchData ? (
                <>
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-indigo-600" />
                      {t('paymentMismatch.title')}
                    </h2>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline"
                        className="gap-2 border-red-600 text-red-600 hover:bg-red-50" 
                        data-testid="button-export-payment-mismatch-pdf"
                        onClick={() => {
                          const formatCurrencyLocal = (v: number) => new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
                          const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>${t('paymentMismatch.title')}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    @page { size: A4 portrait; margin: 10mm 10mm 20mm 10mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Cairo', Arial, sans-serif; direction: rtl; padding: 15px; background: white; color: #333; font-size: 10px; }
    .print-btn { position: fixed; top: 10px; left: 10px; background: #6366f1; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-family: 'Cairo', sans-serif; }
    .page-footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: 8px; color: #666; padding: 5px; border-top: 1px solid #eee; background: white; }
    @media print { 
      .print-btn { display: none !important; }
      body::after { content: "${t('paymentMismatch.title')} - BUTTER BAKERY | ${new Date().toLocaleDateString('en-GB')}"; position: fixed; bottom: 5mm; left: 0; right: 0; text-align: center; font-size: 8px; color: #666; }
    }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">${t('pdf.print')}</button>
  <div style="padding: 5px;">
                              <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #6366f1; padding-bottom: 15px; margin-bottom: 15px;">
                                <div style="display: flex; align-items: center; gap: 12px;">
                                  <div style="width: 45px; height: 45px; background: linear-gradient(135deg, #D4A574 0%, #8B6914 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                                    <span style="font-size: 18px; font-weight: bold; color: #fff;">B</span>
                                  </div>
                                  <div>
                                    <div style="font-size: 12px; font-weight: bold; color: #8B6914;">BUTTER BAKERY</div>
                                    <h1 style="color: #6366f1; font-size: 16px; font-weight: bold; margin: 0;">${t('paymentMismatch.title')}</h1>
                                  </div>
                                </div>
                                <div style="text-align: left; font-size: 10px;">
                                  <div style="color: #8B6914; font-weight: bold;">CEO COMMAND CENTER</div>
                                  <div style="background: #dbeafe; padding: 3px 6px; border-radius: 4px; margin-top: 3px; border: 1px solid #3b82f6;">
                                    <strong style="color: #1e40af;">🏢 ${t('common.branch')}</strong> <span style="color: #1e40af; font-weight: bold;">${filters.branchId ? (branches?.find(b => b.id === filters.branchId)?.name || filters.branchId) : t('common.allBranches')}</span>
                                  </div>
                                  <div style="background: #e0e7ff; padding: 3px 6px; border-radius: 4px; margin-top: 3px;">
                                    <strong>${t('common.period')}</strong> ${filters.startDate} ${t('common.to')} ${filters.endDate}
                                    <br/><span style="font-size: 8px; color: #4338ca;">${Math.ceil((new Date(filters.endDate).getTime() - new Date(filters.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} ${t('common.day')}</span>
                                  </div>
                                  <div style="color: #888; font-size: 9px; margin-top: 3px;">⚙️ ${t('paymentMismatch.acceptableThreshold')} ${t('paymentMismatch.thresholdAmount')}</div>
                                </div>
                              </div>

                              <!-- الملخص التحليلي الشامل -->
                              <div style="background: linear-gradient(135deg, #312e81 0%, #1e1b4b 100%); color: white; padding: 15px; border-radius: 10px; margin-bottom: 15px;">
                                <div style="text-align: center; margin-bottom: 10px;">
                                  <span style="font-size: 14px; font-weight: bold;">📊 ${t('paymentMismatch.summaryAnalysis')}</span>
                                </div>
                                <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; text-align: center;">
                                  <div>
                                    <div style="font-size: 20px; font-weight: bold; color: #a5b4fc;">${paymentMismatchData.summary.totalJournals}</div>
                                    <div style="font-size: 8px; opacity: 0.8;">${t('paymentMismatch.totalJournals')}</div>
                                  </div>
                                  <div>
                                    <div style="font-size: 20px; font-weight: bold; color: #fbbf24;">${paymentMismatchData.summary.journalsWithMismatch}</div>
                                    <div style="font-size: 8px; opacity: 0.8;">${t('paymentMismatch.journalsWithMismatch')}</div>
                                  </div>
                                  <div>
                                    <div style="font-size: 20px; font-weight: bold; color: #f87171;">${paymentMismatchData.summary.mismatchRate.toFixed(1)}%</div>
                                    <div style="font-size: 8px; opacity: 0.8;">${t('paymentMismatch.errorRate')}</div>
                                  </div>
                                  <div>
                                    <div style="font-size: 20px; font-weight: bold; color: #c084fc;">${formatCurrencyLocal(paymentMismatchData.summary.totalMismatchAmount)}</div>
                                    <div style="font-size: 8px; opacity: 0.8;">${t('paymentMismatch.totalMismatches')}</div>
                                  </div>
                                  <div>
                                    <div style="font-size: 20px; font-weight: bold; color: ${paymentMismatchData.summary.journalsWithMismatch > 0 ? '#f87171' : '#4ade80'};">${paymentMismatchData.summary.journalsWithMismatch > 0 ? '⚠️' : '✅'}</div>
                                    <div style="font-size: 8px; opacity: 0.8;">${t('paymentMismatch.statusLabel')}</div>
                                  </div>
                                </div>
                              </div>

                              <!-- مؤشرات الأداء -->
                              <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 15px;">
                                <div style="background: #eff6ff; border: 2px solid #2563eb; border-radius: 8px; padding: 10px; text-align: center;">
                                  <div style="font-size: 9px; color: #1e40af;">💰 ${t('paymentMismatch.posLabel')}</div>
                                  <div style="font-size: 14px; font-weight: bold; color: #1e40af;">${formatCurrencyLocal(paymentMismatchData.summary.totalPosAmount)}</div>
                                </div>
                                <div style="background: #dcfce7; border: 2px solid #166534; border-radius: 8px; padding: 10px; text-align: center;">
                                  <div style="font-size: 9px; color: #166534;">🏦 ${t('paymentMismatch.terminalLabel')}</div>
                                  <div style="font-size: 14px; font-weight: bold; color: #166534;">${formatCurrencyLocal(paymentMismatchData.summary.totalTerminalAmount)}</div>
                                </div>
                                <div style="background: #fef2f2; border: 2px solid #dc2626; border-radius: 8px; padding: 10px; text-align: center;">
                                  <div style="font-size: 9px; color: #991b1b;">📉 ${t('paymentMismatch.differenceLabel')}</div>
                                  <div style="font-size: 14px; font-weight: bold; color: #dc2626;">${formatCurrencyLocal(Math.abs(paymentMismatchData.summary.totalPosAmount - paymentMismatchData.summary.totalTerminalAmount))}</div>
                                </div>
                                <div style="background: #fef3c7; border: 2px solid #d97706; border-radius: 8px; padding: 10px; text-align: center;">
                                  <div style="font-size: 9px; color: #92400e;">📊 ${t('paymentMismatch.avgErrorPerJournal')}</div>
                                  <div style="font-size: 14px; font-weight: bold; color: #d97706;">${paymentMismatchData.summary.journalsWithMismatch > 0 ? formatCurrencyLocal(paymentMismatchData.summary.totalMismatchAmount / paymentMismatchData.summary.journalsWithMismatch) : '0'}</div>
                                </div>
                              </div>

                              <!-- مقارنة POS vs Terminal -->
                              <div style="background: linear-gradient(90deg, #eff6ff 0%, #dcfce7 100%); padding: 12px; border-radius: 8px; margin-bottom: 15px; display: flex; justify-content: space-around; align-items: center; border: 1px solid #94a3b8;">
                                <div style="text-align: center; flex: 1;">
                                  <div style="font-size: 10px; color: #1e40af; font-weight: bold;">💳 ${t('paymentMismatch.posSystem')}</div>
                                  <div style="font-size: 22px; font-weight: bold; color: #1e40af;">${formatCurrencyLocal(paymentMismatchData.summary.totalPosAmount)}</div>
                                </div>
                                <div style="text-align: center; padding: 0 20px;">
                                  <div style="font-size: 28px; color: #dc2626;">⚡</div>
                                  <div style="font-size: 10px; color: #dc2626; font-weight: bold;">${t('paymentMismatch.difference')}</div>
                                  <div style="font-size: 14px; font-weight: bold; color: #dc2626;">${formatCurrencyLocal(Math.abs(paymentMismatchData.summary.totalPosAmount - paymentMismatchData.summary.totalTerminalAmount))}</div>
                                </div>
                                <div style="text-align: center; flex: 1;">
                                  <div style="font-size: 10px; color: #166534; font-weight: bold;">🏦 ${t('paymentMismatch.terminalSystem')}</div>
                                  <div style="font-size: 22px; font-weight: bold; color: #166534;">${formatCurrencyLocal(paymentMismatchData.summary.totalTerminalAmount)}</div>
                                </div>
                              </div>

                              ${paymentMismatchData.byCashier.length > 0 ? `
                              <!-- أكثر الكاشيرين أخطاء -->
                              <div style="background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 10px; margin-bottom: 15px;">
                                <div style="font-size: 11px; font-weight: bold; color: #991b1b; margin-bottom: 8px;">⚠️ ${t('paymentMismatch.topCashierErrors')}</div>
                                ${paymentMismatchData.byCashier.slice(0, 3).map((c, i) => `
                                  <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed #fca5a5; font-size: 9px;">
                                    <span>#${i + 1} ${c.cashierName} (${c.mismatchCount} ${t('paymentMismatch.errorLabel')})</span>
                                    <span style="font-weight: bold; color: #dc2626;">${formatCurrencyLocal(c.totalMismatchAmount)} | ${t('paymentMismatch.errorRateLabel', { rate: c.errorRate.toFixed(1) })}</span>
                                  </div>
                                `).join('')}
                              </div>
                              <h3 style="color: #1e3a5f; margin: 15px 0 10px; font-size: 12px; background: #f1f5f9; padding: 6px 10px; border-radius: 4px;">📋 ${t('paymentMismatch.cashierMismatchTable')}</h3>
                              <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px;">
                                <thead>
                                  <tr style="background: #f1f5f9;">
                                    <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: right;">${t('paymentMismatch.cashierCol')}</th>
                                    <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: right;">${t('paymentMismatch.mismatchCountCol')}</th>
                                    <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: right;">${t('paymentMismatch.totalMismatchCol')}</th>
                                    <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: right;">${t('paymentMismatch.errorRateCol')}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  ${paymentMismatchData.byCashier.slice(0, 10).map((c, idx) => `
                                    <tr style="background: ${idx < 3 ? '#fef2f2' : '#fff'};">
                                      <td style="padding: 8px; border: 1px solid #e2e8f0;">${c.cashierName}</td>
                                      <td style="padding: 8px; border: 1px solid #e2e8f0;">${c.mismatchCount}</td>
                                      <td style="padding: 8px; border: 1px solid #e2e8f0; color: #dc2626; font-weight: bold;">${formatCurrencyLocal(c.totalMismatchAmount)}</td>
                                      <td style="padding: 8px; border: 1px solid #e2e8f0; color: #dc2626;">${c.errorRate.toFixed(1)}%</td>
                                    </tr>
                                  `).join('')}
                                </tbody>
                              </table>
                              ` : ''}
                              ${paymentMismatchData.byPaymentMethod.filter(m => m.discrepancy > 0).length > 0 ? `
                              <h3 style="color: #1e3a5f; margin: 20px 0 10px;">${t('paymentMismatch.paymentMethodDiscrepancies')}</h3>
                              <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                                <thead>
                                  <tr style="background: #f1f5f9;">
                                    <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: right;">${t('paymentMismatch.paymentMethodCol')}</th>
                                    <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: right;">POS</th>
                                    <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: right;">Terminal</th>
                                    <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: right;">${t('paymentMismatch.differenceCol')}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  ${paymentMismatchData.byPaymentMethod.filter(m => m.discrepancy > 0).map(m => `
                                    <tr>
                                      <td style="padding: 8px; border: 1px solid #e2e8f0;">${t(`paymentMethods.${m.paymentMethod}`) || m.paymentMethod}</td>
                                      <td style="padding: 8px; border: 1px solid #e2e8f0; color: #1e40af;">${formatCurrencyLocal(m.posTotal)}</td>
                                      <td style="padding: 8px; border: 1px solid #e2e8f0; color: #166534;">${formatCurrencyLocal(m.terminalTotal)}</td>
                                      <td style="padding: 8px; border: 1px solid #e2e8f0; color: #dc2626; font-weight: bold;">${formatCurrencyLocal(m.discrepancy)}</td>
                                    </tr>
                                  `).join('')}
                                </tbody>
                              </table>
                              ` : ''}
                              <div style="margin-top: 30px; padding-top: 15px; border-top: 2px solid #D4A574; display: flex; justify-content: space-between; align-items: center; font-size: 10px;">
                                <span style="color: #8B6914; font-weight: bold;">BUTTER BAKERY SYSTEM - CEO COMMAND</span>
                                <span style="color: #666;">${t('paymentMismatch.reportCreated')} ${new Date().toLocaleString('en-GB')}</span>
                              </div>
                              <div style="text-align: center; margin-top: 10px; font-size: 10px; color: #666;">
                                <span style="color: #b91c1c;">● ${t('paymentMismatch.colorLegendRed')}</span> | 
                                <span style="color: #1e40af;">● ${t('paymentMismatch.colorLegendBlue')}</span> | 
                                <span style="color: #166534;">● ${t('paymentMismatch.colorLegendGreen')}</span>
                              </div>
                            </div>
  </div>
</body>
</html>
                          `;
                          printHtmlContent(html);
                        }}
                      >
                        <Printer className="w-4 h-4" />
                        {t('paymentMismatch.printPDF')}
                      </Button>
                      <Button 
                        variant="outline"
                        className="gap-2 border-green-600 text-green-600 hover:bg-green-50" 
                        data-testid="button-export-payment-mismatch-excel"
                        onClick={async () => {
                          const XLSX = await import("xlsx");
                          const wb = XLSX.utils.book_new();
                          
                          const summaryData = [
                            [t('paymentMismatch.excelReportTitle')],
                            [t('returns.periodLabel'), `${filters.startDate} - ${filters.endDate}`],
                            [t('paymentMismatch.acceptableThreshold'), t('paymentMismatch.thresholdAmount')],
                            [],
                            [t('paymentMismatch.summaryTitle')],
                            [t('paymentMismatch.totalJournals'), paymentMismatchData.summary.totalJournals],
                            [t('paymentMismatch.journalsWithMismatch'), paymentMismatchData.summary.journalsWithMismatch],
                            [t('paymentMismatch.errorRate'), `${paymentMismatchData.summary.mismatchRate.toFixed(1)}%`],
                            [t('paymentMismatch.totalMismatches'), paymentMismatchData.summary.totalMismatchAmount],
                            [t('paymentMismatch.posLabel'), paymentMismatchData.summary.totalPosAmount],
                            [t('paymentMismatch.terminalLabel'), paymentMismatchData.summary.totalTerminalAmount],
                          ];
                          const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
                          XLSX.utils.book_append_sheet(wb, summarySheet, t('returns.summarySheet'));
                          
                          const cashierData = [
                            [t('paymentMismatch.cashierDiscrepancies')],
                            [t('paymentMismatch.cashierCol'), t('paymentMismatch.mismatchCountCol'), t('paymentMismatch.totalMismatchCol'), t('paymentMismatch.totalTransactionsCol'), t('paymentMismatch.errorRateCol')],
                            ...paymentMismatchData.byCashier.map(c => [
                              c.cashierName, c.mismatchCount, c.totalMismatchAmount, c.totalTransactions, `${c.errorRate.toFixed(1)}%`
                            ])
                          ];
                          const cashierSheet = XLSX.utils.aoa_to_sheet(cashierData);
                          XLSX.utils.book_append_sheet(wb, cashierSheet, t('paymentMismatch.cashierCol'));
                          
                          const methodData = [
                            [t('paymentMismatch.byPaymentMethodTitle')],
                            [t('paymentMismatch.paymentMethodCol'), t('paymentMismatch.posLabel'), t('paymentMismatch.terminalLabel'), t('paymentMismatch.differenceCol'), t('paymentMismatch.discrepancyCountCol'), t('paymentMismatch.discrepancyPercentCol')],
                            ...paymentMismatchData.byPaymentMethod.map(m => [
                              t(`paymentMethods.${m.paymentMethod}`) || m.paymentMethod,
                              m.posTotal,
                              m.terminalTotal,
                              m.discrepancy,
                              m.discrepancyCount,
                              `${m.discrepancyPercent.toFixed(1)}%`
                            ])
                          ];
                          const methodSheet = XLSX.utils.aoa_to_sheet(methodData);
                          XLSX.utils.book_append_sheet(wb, methodSheet, t('paymentMismatch.paymentMethodCol'));
                          
                          const detailsData = [
                            [t('paymentMismatch.detailsExcelTitle')],
                            [t('paymentMismatch.dateCol'), t('paymentMismatch.branchCol'), t('paymentMismatch.cashierCol'), t('paymentMismatch.shiftCol'), t('paymentMismatch.salesCol'), t('paymentMismatch.totalMismatchCol'), t('paymentMismatch.detailsText')],
                            ...paymentMismatchData.detailedMismatches.map(d => [
                              d.journalDate,
                              d.branchName,
                              d.cashierName,
                              t(`shiftsShort.${d.shiftType}`) || d.shiftType,
                              d.totalSales,
                              d.totalMismatchAmount,
                              d.methodMismatches.map(m => `${t(`paymentMethods.${m.paymentMethod}`) || m.paymentMethod}: POS ${m.posAmount} vs Terminal ${m.terminalAmount}`).join('; ')
                            ])
                          ];
                          const detailsSheet = XLSX.utils.aoa_to_sheet(detailsData);
                          XLSX.utils.book_append_sheet(wb, detailsSheet, t('returns.detailsSheet'));
                          
                          XLSX.writeFile(wb, `payment_mismatch_report_${filters.startDate}_${filters.endDate}.xlsx`);
                        }}
                      >
                        <Download className="w-4 h-4" />
                        {t('common.exportExcel')}
                      </Button>
                    </div>
                  </div>

                  {/* Threshold Note */}
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2 text-sm text-amber-800">
                    <AlertTriangle className="w-4 h-4" />
                    <span>{t('paymentMismatch.thresholdNote')} <strong>{t('paymentMismatch.thresholdAmount')}</strong> - {t('paymentMismatch.thresholdDesc')}</span>
                  </div>

                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="payment-mismatch-summary-cards">
                    <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200" data-testid="card-total-journals">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-indigo-500 rounded-lg">
                            <FileText className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="text-xs text-indigo-700">{t('paymentMismatch.totalJournals')}</p>
                            <p className="text-xl font-bold text-indigo-800" data-testid="text-total-journals">{paymentMismatchData.summary.totalJournals}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200" data-testid="card-journals-with-mismatch">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-orange-500 rounded-lg">
                            <AlertTriangle className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="text-xs text-orange-700">{t('paymentMismatch.journalsWithMismatch')}</p>
                            <p className="text-xl font-bold text-orange-800" data-testid="text-journals-with-mismatch">{paymentMismatchData.summary.journalsWithMismatch}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200" data-testid="card-error-rate">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-red-500 rounded-lg">
                            <TrendingDown className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="text-xs text-red-700">{t('paymentMismatch.errorRate')}</p>
                            <p className="text-xl font-bold text-red-800" data-testid="text-error-rate">{paymentMismatchData.summary.mismatchRate.toFixed(1)}%</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200" data-testid="card-total-mismatch">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-purple-500 rounded-lg">
                            <DollarSign className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="text-xs text-purple-700">{t('paymentMismatch.totalMismatches')}</p>
                            <p className="text-xl font-bold text-purple-800">{formatCurrency(paymentMismatchData.summary.totalMismatchAmount)}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* POS vs Terminal Comparison */}
                  <Card className="border-2 border-indigo-200 bg-indigo-50/50">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-6">
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground">{t('paymentMismatch.posLabel')}</p>
                            <p className="text-2xl font-bold text-blue-600">{formatCurrency(paymentMismatchData.summary.totalPosAmount)}</p>
                          </div>
                          <div className="text-3xl text-gray-400">↔</div>
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground">{t('paymentMismatch.terminalLabel')}</p>
                            <p className="text-2xl font-bold text-green-600">{formatCurrency(paymentMismatchData.summary.totalTerminalAmount)}</p>
                          </div>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">{t('paymentMismatch.differenceLabel')}</p>
                          <p className={`text-2xl font-bold ${Math.abs(paymentMismatchData.summary.totalPosAmount - paymentMismatchData.summary.totalTerminalAmount) > 0.5 ? 'text-red-600' : 'text-green-600'}`}>
                            {formatCurrency(Math.abs(paymentMismatchData.summary.totalPosAmount - paymentMismatchData.summary.totalTerminalAmount))}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {paymentMismatchData.byCashier.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Cashiers with Most Errors */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <User className="w-5 h-5 text-red-600" />
                            {t('paymentMismatch.cashiersWithErrors')}
                          </CardTitle>
                          <CardDescription>{t('paymentMismatch.cashiersWithErrorsDesc')}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {paymentMismatchData.byCashier.slice(0, 10).map((cashier, idx) => (
                              <div key={cashier.cashierId} className={`p-3 rounded-lg border ${idx < 3 ? 'bg-red-50 border-red-200' : 'bg-gray-50'}`}>
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <Badge variant={idx < 3 ? 'destructive' : 'outline'} className="text-xs">#{idx + 1}</Badge>
                                    <span className="font-medium">{cashier.cashierName}</span>
                                  </div>
                                  <span className="font-bold text-red-600">{formatCurrency(cashier.totalMismatchAmount)}</span>
                                </div>
                                <div className="flex gap-4 text-xs text-muted-foreground">
                                  <span>{t('paymentMismatch.errorCases', { count: cashier.mismatchCount })}</span>
                                  <span>{t('paymentMismatch.outOf', { count: cashier.totalTransactions })}</span>
                                  <span className="text-red-600">{t('paymentMismatch.errorRateLabel', { rate: cashier.errorRate.toFixed(1) })}</span>
                                </div>
                                {Object.keys(cashier.methodErrors).length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {Object.entries(cashier.methodErrors).map(([method, count]) => (
                                      <Badge key={method} variant="secondary" className="text-xs">
                                        {t(`paymentMethods.${method}`) || method}: {count}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Payment Method Breakdown */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <CreditCard className="w-5 h-5 text-indigo-600" />
                            {t('paymentMismatch.paymentMethodBreakdown')}
                          </CardTitle>
                          <CardDescription>{t('paymentMismatch.paymentMethodBreakdownDesc')}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {paymentMismatchData.byPaymentMethod.filter(m => m.discrepancy > 0).map((method) => (
                              <div key={method.paymentMethod} className="p-3 bg-gray-50 rounded-lg border">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-medium">{t(`paymentMethods.${method.paymentMethod}`) || method.paymentMethod}</span>
                                  <span className="font-bold text-red-600">{formatCurrency(method.discrepancy)}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-xs">
                                  <div className="text-center p-2 bg-blue-50 rounded">
                                    <p className="text-muted-foreground">POS</p>
                                    <p className="font-medium text-blue-600">{formatCurrency(method.posTotal)}</p>
                                  </div>
                                  <div className="text-center p-2 bg-green-50 rounded">
                                    <p className="text-muted-foreground">Terminal</p>
                                    <p className="font-medium text-green-600">{formatCurrency(method.terminalTotal)}</p>
                                  </div>
                                  <div className="text-center p-2 bg-red-50 rounded">
                                    <p className="text-muted-foreground">{t('paymentMismatch.difference')}</p>
                                    <p className="font-medium text-red-600">{method.discrepancyPercent.toFixed(1)}%</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                            {paymentMismatchData.byPaymentMethod.filter(m => m.discrepancy > 0).length === 0 && (
                              <div className="text-center py-8 text-muted-foreground">
                                <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                                <p>{t('paymentMismatch.noPaymentMismatches')}</p>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Branch Breakdown */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Building2 className="w-5 h-5 text-amber-600" />
                            {t('paymentMismatch.branchBreakdown')}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="h-[250px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={paymentMismatchData.byBranch} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" fontSize={10} />
                                <YAxis dataKey="branchName" type="category" fontSize={10} width={80} />
                                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                <Bar dataKey="totalMismatchAmount" name={t('paymentMismatch.totalMismatches')} fill="#ef4444" radius={[0, 4, 4, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Mismatch Distribution Chart */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <PieChartIcon className="w-5 h-5 text-purple-600" />
                            {t('paymentMismatch.mismatchDistribution')}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="h-[250px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={paymentMismatchData.byPaymentMethod.filter(m => m.discrepancy > 0).map(m => ({
                                    name: t(`paymentMethods.${m.paymentMethod}`) || m.paymentMethod,
                                    value: m.discrepancy
                                  }))}
                                  dataKey="value"
                                  nameKey="name"
                                  cx="50%"
                                  cy="50%"
                                  outerRadius={80}
                                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                >
                                  {paymentMismatchData.byPaymentMethod.filter(m => m.discrepancy > 0).map((_, index) => (
                                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                                  ))}
                                </Pie>
                                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  ) : (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
                        <CheckCircle className="w-12 h-12 text-green-600" />
                        <p className="text-green-700 font-medium">{t('paymentMismatch.noMismatchPerfect')}</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Detailed Mismatches Table with Pagination */}
                  {paymentMismatchData.detailedMismatches.length > 0 && (
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <FileText className="w-5 h-5 text-red-600" />
                          {t('paymentMismatch.detailsTitle', { count: paymentMismatchData.detailedMismatches.length })}
                        </CardTitle>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{t('paymentMismatch.showPerPage', { count: mismatchPageSize })}</span>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b bg-muted/50">
                                <th className="text-right py-3 px-4">{t('cashierTab.dateCol')}</th>
                                <th className="text-right py-3 px-4">{t('apps.branchCol')}</th>
                                <th className="text-right py-3 px-4">{t('cashierTab.cashierCol')}</th>
                                <th className="text-right py-3 px-4">{t('cashierTab.shiftCol')}</th>
                                <th className="text-right py-3 px-4">{t('paymentMismatch.totalDiffCol')}</th>
                                <th className="text-right py-3 px-4">{t('paymentMismatch.detailsCol')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {paymentMismatchData.detailedMismatches
                                .slice((mismatchPage - 1) * mismatchPageSize, mismatchPage * mismatchPageSize)
                                .map((mismatch) => (
                                <tr key={mismatch.journalId} className="border-b hover:bg-muted/50">
                                  <td className="py-3 px-4">{mismatch.journalDate}</td>
                                  <td className="py-3 px-4">{mismatch.branchName}</td>
                                  <td className="py-3 px-4 font-medium">{mismatch.cashierName}</td>
                                  <td className="py-3 px-4">
                                    <Badge variant="outline">{t(`shiftsShort.${mismatch.shiftType}`) || mismatch.shiftType || '-'}</Badge>
                                  </td>
                                  <td className="py-3 px-4 font-bold text-red-600">{formatCurrency(mismatch.totalMismatchAmount)}</td>
                                  <td className="py-3 px-4">
                                    <div className="flex flex-wrap gap-1">
                                      {mismatch.methodMismatches.map((mm, idx) => (
                                        <Badge key={idx} variant="secondary" className="text-xs">
                                          {t(`paymentMethods.${mm.paymentMethod}`) || mm.paymentMethod}: 
                                          <span className="text-blue-600 mx-1">POS {formatCurrency(mm.posAmount)}</span>
                                          vs
                                          <span className="text-green-600 mx-1">Terminal {formatCurrency(mm.terminalAmount)}</span>
                                        </Badge>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        
                        {/* Pagination Controls */}
                        {paymentMismatchData.detailedMismatches.length > mismatchPageSize && (
                          <div className="flex items-center justify-between mt-4 pt-4 border-t">
                            <div className="text-sm text-muted-foreground">
                              {t('pagination.showing', { from: ((mismatchPage - 1) * mismatchPageSize) + 1, to: Math.min(mismatchPage * mismatchPageSize, paymentMismatchData.detailedMismatches.length), total: paymentMismatchData.detailedMismatches.length })}
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setMismatchPage(1)}
                                disabled={mismatchPage === 1}
                                className="h-8 px-2"
                              >
                                {t('pagination.first')}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setMismatchPage(p => Math.max(1, p - 1))}
                                disabled={mismatchPage === 1}
                                className="h-8 px-3"
                              >
                                {t('pagination.previous')}
                              </Button>
                              <div className="flex items-center gap-1 mx-2">
                                {Array.from({ length: Math.min(5, Math.ceil(paymentMismatchData.detailedMismatches.length / mismatchPageSize)) }, (_, i) => {
                                  const totalPages = Math.ceil(paymentMismatchData.detailedMismatches.length / mismatchPageSize);
                                  let pageNum;
                                  if (totalPages <= 5) {
                                    pageNum = i + 1;
                                  } else if (mismatchPage <= 3) {
                                    pageNum = i + 1;
                                  } else if (mismatchPage >= totalPages - 2) {
                                    pageNum = totalPages - 4 + i;
                                  } else {
                                    pageNum = mismatchPage - 2 + i;
                                  }
                                  return (
                                    <Button
                                      key={pageNum}
                                      variant={mismatchPage === pageNum ? "default" : "outline"}
                                      size="sm"
                                      onClick={() => setMismatchPage(pageNum)}
                                      className="h-8 w-8 p-0"
                                    >
                                      {pageNum}
                                    </Button>
                                  );
                                })}
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setMismatchPage(p => Math.min(Math.ceil(paymentMismatchData.detailedMismatches.length / mismatchPageSize), p + 1))}
                                disabled={mismatchPage >= Math.ceil(paymentMismatchData.detailedMismatches.length / mismatchPageSize)}
                                className="h-8 px-3"
                              >
                                {t('pagination.next')}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setMismatchPage(Math.ceil(paymentMismatchData.detailedMismatches.length / mismatchPageSize))}
                                disabled={mismatchPage >= Math.ceil(paymentMismatchData.detailedMismatches.length / mismatchPageSize)}
                                className="h-8 px-2"
                              >
                                {t('pagination.last')}
                              </Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
                    <CreditCard className="w-12 h-12 text-muted-foreground" />
                    <p className="text-muted-foreground">{t('common.noDataAvailable')}</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Apps Sales Report Tab */}
            <TabsContent value="apps" className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Truck className="w-5 h-5 text-orange-600" />
                  {t('apps.title')}
                </h2>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    className="gap-2" 
                    data-testid="button-export-apps-pdf"
                    onClick={() => {
                      const branchName = filters.branchId 
                        ? branches?.find(b => b.id === filters.branchId)?.name || t('filters.allBranches')
                        : t('filters.allBranches');
                      const printWindow = window.open('', '_blank');
                      if (!printWindow) return;
                      
                      // حساب عدد الأيام في الفترة
                      const startD = new Date(filters.startDate);
                      const endD = new Date(filters.endDate);
                      const daysDiff = Math.ceil((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                      const avgDaily = deliveryAppsStats.totalDelivery / (daysDiff || 1);
                      
                      printWindow.document.write(`
                        <!DOCTYPE html>
                        <html dir="rtl" lang="ar">
                        <head>
                          <meta charset="UTF-8">
                          <title>${t('apps.title')}</title>
                          <style>
                            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
                            @page { 
                              size: A4 landscape; 
                              margin: 10mm;
                            }
                            * { margin: 0; padding: 0; box-sizing: border-box; }
                            body { 
                              font-family: 'Cairo', sans-serif; 
                              direction: rtl; 
                              padding: 15px;
                              background: white;
                              color: #333;
                              font-size: 11px;
                            }
                            .report-container {
                              max-width: 100%;
                            }
                            .header { 
                              display: flex;
                              justify-content: space-between;
                              align-items: center;
                              margin-bottom: 15px;
                              border-bottom: 3px solid #F59E0B;
                              padding-bottom: 10px;
                            }
                            .header-right { text-align: right; }
                            .header-center { text-align: center; flex: 1; }
                            .header-left { text-align: left; }
                            .header h1 { 
                              color: #F59E0B; 
                              font-size: 20px;
                              margin-bottom: 5px;
                            }
                            .header .subtitle {
                              color: #666;
                              font-size: 12px;
                            }
                            .company-logo {
                              font-size: 24px;
                              font-weight: bold;
                              color: #D97706;
                            }
                            .report-date {
                              font-size: 10px;
                              color: #666;
                            }
                            .meta-info {
                              display: grid;
                              grid-template-columns: repeat(6, 1fr);
                              gap: 10px;
                              background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%);
                              padding: 12px;
                              border-radius: 8px;
                              margin-bottom: 15px;
                              border: 1px solid #F59E0B;
                            }
                            .meta-item { text-align: center; }
                            .meta-label { font-size: 9px; color: #92400E; font-weight: 600; }
                            .meta-value { font-size: 12px; font-weight: bold; color: #D97706; }
                            .two-columns {
                              display: grid;
                              grid-template-columns: 1fr 1.5fr;
                              gap: 15px;
                              margin-bottom: 15px;
                            }
                            .kpi-grid {
                              display: grid;
                              grid-template-columns: repeat(2, 1fr);
                              gap: 8px;
                            }
                            .kpi-card {
                              background: linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%);
                              border: 1px solid #FDBA74;
                              border-radius: 6px;
                              padding: 10px;
                              text-align: center;
                            }
                            .kpi-value { font-size: 16px; font-weight: bold; color: #EA580C; }
                            .kpi-label { font-size: 9px; color: #9A3412; margin-top: 3px; }
                            .kpi-subtitle { font-size: 8px; color: #B45309; }
                            table {
                              width: 100%;
                              border-collapse: collapse;
                              font-size: 10px;
                            }
                            th, td {
                              border: 1px solid #E5E7EB;
                              padding: 6px 8px;
                              text-align: right;
                            }
                            th {
                              background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%);
                              color: white;
                              font-weight: 600;
                              font-size: 9px;
                            }
                            tr:nth-child(even) { background: #FEF3C7; }
                            tr:hover { background: #FDE68A; }
                            .section-title {
                              font-size: 13px;
                              color: #D97706;
                              margin: 12px 0 8px;
                              padding-bottom: 5px;
                              border-bottom: 2px solid #FED7AA;
                              display: flex;
                              align-items: center;
                              gap: 8px;
                            }
                            .app-color { 
                              display: inline-block; 
                              width: 10px; 
                              height: 10px; 
                              border-radius: 50%; 
                              margin-left: 5px;
                              vertical-align: middle;
                            }
                            .percentage-bar {
                              background: #E5E7EB;
                              border-radius: 3px;
                              height: 6px;
                              overflow: hidden;
                              width: 80px;
                              display: inline-block;
                              vertical-align: middle;
                            }
                            .percentage-fill {
                              height: 100%;
                              border-radius: 3px;
                            }
                            .badge {
                              background: #F59E0B;
                              color: white;
                              padding: 1px 4px;
                              border-radius: 3px;
                              font-size: 8px;
                              margin-right: 3px;
                            }
                            .footer {
                              margin-top: 15px;
                              display: flex;
                              justify-content: space-between;
                              align-items: center;
                              font-size: 9px;
                              color: #9CA3AF;
                              border-top: 1px solid #E5E7EB;
                              padding-top: 8px;
                            }
                            .watermark {
                              position: fixed;
                              bottom: 50%;
                              right: 50%;
                              transform: translate(50%, 50%) rotate(-45deg);
                              font-size: 80px;
                              color: rgba(249, 115, 22, 0.05);
                              font-weight: bold;
                              z-index: -1;
                            }
                            @media print {
                              body { padding: 5px; }
                              .no-print { display: none; }
                              .watermark { display: none; }
                            }
                          </style>
                        </head>
                        <body>
                          <div class="watermark">BUTTER</div>
                          <div class="report-container">
                            <div class="header">
                              <div class="header-right">
                                <img src="${window.location.origin}/logo-butter-bakery.png" alt="Butter Bakery" style="height: 50px; margin-bottom: 5px;" onerror="this.style.display='none'" />
                                <div class="report-date">${t('pdf.companyName')}</div>
                              </div>
                              <div class="header-center">
                                <h1>${t('apps.title')}</h1>
                                <div class="subtitle">${t('pdf.deliveryAppsSalesReportEn')}</div>
                              </div>
                              <div class="header-left">
                                <div class="report-date">${t('pdf.printDate')}</div>
                                <div style="font-weight: bold; color: #D97706;">${new Date().toLocaleDateString('en-GB')}</div>
                                <div style="font-size: 9px; color: #888;">${new Date().toLocaleTimeString('en-GB')}</div>
                              </div>
                            </div>
                            
                            <div class="meta-info">
                              <div class="meta-item">
                                <div class="meta-label">${t('pdf.branchCol')}</div>
                                <div class="meta-value">${branchName}</div>
                              </div>
                              <div class="meta-item">
                                <div class="meta-label">${t('pdf.fromDate')}</div>
                                <div class="meta-value">${filters.startDate}</div>
                              </div>
                              <div class="meta-item">
                                <div class="meta-label">${t('pdf.toDate')}</div>
                                <div class="meta-value">${filters.endDate}</div>
                              </div>
                              <div class="meta-item">
                                <div class="meta-label">${t('pdf.daysCount')}</div>
                                <div class="meta-value">${daysDiff} ${t('pdf.day')}</div>
                              </div>
                              <div class="meta-item">
                                <div class="meta-label">${t('pdf.totalSales')}</div>
                                <div class="meta-value">${formatCurrency(deliveryAppsStats.totalDelivery)}</div>
                              </div>
                              <div class="meta-item">
                                <div class="meta-label">${t('pdf.dailyAverage')}</div>
                                <div class="meta-value">${formatCurrency(avgDaily)}</div>
                              </div>
                            </div>
                            
                            <div class="two-columns">
                              <div>
                                <h3 class="section-title">${t('pdf.performanceSummary')}</h3>
                                <div class="kpi-grid">
                                  <div class="kpi-card">
                                    <div class="kpi-value">${formatCurrency(deliveryAppsStats.totalDelivery)}</div>
                                    <div class="kpi-label">${t('apps.totalAppSales')}</div>
                                  </div>
                                  <div class="kpi-card">
                                    <div class="kpi-value">${deliveryAppsStats.topApp?.label || '-'}</div>
                                    <div class="kpi-label">${t('apps.topSellingApp')}</div>
                                    <div class="kpi-subtitle">${deliveryAppsStats.topApp ? formatCurrency(deliveryAppsStats.topApp.totalSales) : ''}</div>
                                  </div>
                                  <div class="kpi-card">
                                    <div class="kpi-value">${deliveryAppsStats.apps.filter(a => a.totalSales > 0).length} / ${DELIVERY_APPS.length}</div>
                                    <div class="kpi-label">${t('pdf.activeApps')}</div>
                                  </div>
                                  <div class="kpi-card">
                                    <div class="kpi-value">${deliveryAppsStats.topBranch?.branchName || '-'}</div>
                                    <div class="kpi-label">${t('apps.topDeliveryBranch')}</div>
                                    <div class="kpi-subtitle">${deliveryAppsStats.topBranch ? formatCurrency(deliveryAppsStats.topBranch.totalDelivery) : ''}</div>
                                  </div>
                                </div>
                              </div>
                              
                              <div>
                                <h3 class="section-title">${t('pdf.appSalesDetails')}</h3>
                                <table>
                                  <thead>
                                    <tr>
                                      <th style="width: 25%;">${t('apps.app')}</th>
                                      <th style="width: 25%;">${t('apps.appTotalSales')}</th>
                                      <th style="width: 35%;">${t('apps.percentage')}</th>
                                      <th style="width: 15%;">${t('apps.rank')}</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    ${deliveryAppsStats.apps.map((app, index) => `
                                      <tr>
                                        <td>
                                          <span class="app-color" style="background: ${app.color}"></span>
                                          ${app.label}
                                        </td>
                                        <td style="color: ${app.color}; font-weight: bold;">${formatCurrency(app.totalSales)}</td>
                                        <td>
                                          <div class="percentage-bar">
                                            <div class="percentage-fill" style="width: ${app.percentage}%; background: ${app.color};"></div>
                                          </div>
                                          <span style="margin-right: 5px;">${app.percentage.toFixed(1)}%</span>
                                        </td>
                                        <td style="text-align: center;">${app.totalSales > 0 ? '<span class="badge">#' + (index + 1) + '</span>' : '-'}</td>
                                      </tr>
                                    `).join('')}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          
                          ${deliveryAppsStats.branches.length > 0 ? `
                            <h3 class="section-title">${t('pdf.appSalesByBranch')}</h3>
                            <table>
                              <thead>
                                <tr>
                                  <th>${t('pdf.branchCol')}</th>
                                  <th>${t('apps.totalDelivery')}</th>
                                  <th>${t('pdf.percentageOfTotal')}</th>
                                  ${DELIVERY_APPS.map(app => `<th><span class="app-color" style="background: ${app.color}"></span>${app.label}</th>`).join('')}
                                </tr>
                              </thead>
                              <tbody>
                                ${deliveryAppsStats.branches.map((branch, index) => `
                                  <tr>
                                    <td>
                                      ${index === 0 ? '<span class="badge">' + t('apps.highest') + '</span>' : ''}
                                      ${branch.branchName}
                                    </td>
                                    <td style="color: #EA580C; font-weight: bold;">${formatCurrency(branch.totalDelivery)}</td>
                                    <td>${deliveryAppsStats.totalDelivery > 0 ? ((branch.totalDelivery / deliveryAppsStats.totalDelivery) * 100).toFixed(1) : 0}%</td>
                                    ${DELIVERY_APPS.map(app => `
                                      <td style="color: ${app.color};">${formatCurrency(branch.apps[app.key] || 0)}</td>
                                    `).join('')}
                                  </tr>
                                `).join('')}
                              </tbody>
                            </table>
                          ` : ''}
                          
                          <div class="footer">
                            BUTTER BAKERY SYSTEM - CEO COMMAND | ${new Date().toLocaleString('en-GB')}
                          </div>
                          
                          <script>
                            window.onload = function() { window.print(); }
                          </script>
                        </body>
                        </html>
                      `);
                      printWindow.document.close();
                    }}
                  >
                    <FileText className="w-4 h-4" />
                    {t('apps.exportPDF')}
                  </Button>
                  <Badge variant="secondary" className="bg-orange-100 text-orange-700 text-sm">
                    {t('apps.total')} {formatCurrency(deliveryAppsStats.totalDelivery)}
                  </Badge>
                </div>
              </div>

              {deliveryAppsStats.totalDelivery > 0 || filteredCashierJournals.length > 0 ? (
                <div className="space-y-6">
                  {/* KPI Cards for Apps */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <KPICard 
                      title={t('apps.totalAppSales')} 
                      value={formatCurrency(deliveryAppsStats.totalDelivery)} 
                      icon={Truck} 
                      color="text-orange-600" 
                      bgColor="bg-orange-100" 
                    />
                    <KPICard 
                      title={t('apps.topApp')} 
                      value={deliveryAppsStats.topApp?.label || "-"} 
                      icon={Trophy}
                      subtitle={deliveryAppsStats.topApp ? formatCurrency(deliveryAppsStats.topApp.totalSales) : ""}
                      color="text-amber-600" 
                      bgColor="bg-amber-100" 
                    />
                    <KPICard 
                      title={t('apps.activeApps')} 
                      value={deliveryAppsStats.apps.filter(a => a.totalSales > 0).length} 
                      icon={Activity}
                      color="text-blue-600" 
                      bgColor="bg-blue-100" 
                    />
                    <KPICard 
                      title={t('apps.topBranch')} 
                      value={deliveryAppsStats.topBranch?.branchName || "-"} 
                      icon={Building2}
                      subtitle={deliveryAppsStats.topBranch ? formatCurrency(deliveryAppsStats.topBranch.totalDelivery) : ""}
                      color="text-purple-600" 
                      bgColor="bg-purple-100" 
                    />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Apps Pie Chart */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">{t('apps.salesDistribution')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[280px]">
                          {deliveryAppsStats.apps.filter(a => a.totalSales > 0).length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={deliveryAppsStats.apps.filter(a => a.totalSales > 0)}
                                  dataKey="totalSales"
                                  nameKey="label"
                                  cx="50%"
                                  cy="50%"
                                  outerRadius={90}
                                  label={({ label, percentage }) => `${label}: ${percentage.toFixed(0)}%`}
                                >
                                  {deliveryAppsStats.apps.filter(a => a.totalSales > 0).map((app, index) => (
                                    <Cell key={`cell-${index}`} fill={app.color} />
                                  ))}
                                </Pie>
                                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                              </PieChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                              <Truck className="w-12 h-12 mb-2" />
                              <p>{t('apps.noAppSales')}</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Apps Bar Chart */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">{t('apps.salesComparison')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[280px]">
                          {deliveryAppsStats.apps.filter(a => a.totalSales > 0).length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={deliveryAppsStats.apps.filter(a => a.totalSales > 0)} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" fontSize={10} tickFormatter={(v) => formatCurrency(v)} />
                                <YAxis type="category" dataKey="label" fontSize={11} width={80} />
                                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                <Bar dataKey="totalSales" name={t('apps.salesName')}>
                                  {deliveryAppsStats.apps.filter(a => a.totalSales > 0).map((app, index) => (
                                    <Cell key={`bar-${index}`} fill={app.color} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                              <BarChart3 className="w-12 h-12 mb-2" />
                              <p>{t('apps.noDataToShow')}</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Apps Details Table */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{t('apps.appDetails')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              <th className="text-right py-3 px-4">{t('apps.appCol')}</th>
                              <th className="text-right py-3 px-4">{t('apps.totalSalesCol')}</th>
                              <th className="text-right py-3 px-4">{t('apps.percentCol')}</th>
                              <th className="text-right py-3 px-4">{t('apps.rankCol')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {deliveryAppsStats.apps.map((app, index) => (
                              <tr key={app.key} className="border-b hover:bg-muted/50">
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2">
                                    <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: app.color }}></span>
                                    <span className="font-medium">{app.label}</span>
                                  </div>
                                </td>
                                <td className="py-3 px-4 font-semibold" style={{ color: app.color }}>
                                  {formatCurrency(app.totalSales)}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2">
                                    <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                      <div 
                                        className="h-full rounded-full" 
                                        style={{ width: `${app.percentage}%`, backgroundColor: app.color }}
                                      ></div>
                                    </div>
                                    <span className="text-xs text-muted-foreground">{app.percentage.toFixed(1)}%</span>
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  {app.totalSales > 0 && (
                                    <Badge variant={index === 0 ? "default" : "secondary"} className="text-xs">
                                      #{index + 1}
                                    </Badge>
                                  )}
                                  {app.totalSales === 0 && <span className="text-muted-foreground">-</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Branch Comparison for Apps */}
                  {deliveryAppsStats.branches.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">{t('apps.salesByBranch')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b bg-muted/50">
                                <th className="text-right py-3 px-4">{t('apps.branchCol')}</th>
                                <th className="text-right py-3 px-4">{t('apps.totalDeliveryCol')}</th>
                                {DELIVERY_APPS.slice(0, 5).map(app => (
                                  <th key={app.key} className="text-right py-3 px-4">
                                    <span style={{ color: app.color }}>{app.label}</span>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {deliveryAppsStats.branches.map((branch, index) => (
                                <tr key={branch.branchId} className="border-b hover:bg-muted/50">
                                  <td className="py-3 px-4">
                                    <div className="flex items-center gap-2">
                                      <Building2 className="w-4 h-4 text-muted-foreground" />
                                      <span className="font-medium">{branch.branchName}</span>
                                      {index === 0 && <Badge className="text-xs bg-amber-500">{t('apps.highest')}</Badge>}
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 font-semibold text-orange-600">
                                    {formatCurrency(branch.totalDelivery)}
                                  </td>
                                  {DELIVERY_APPS.slice(0, 5).map(app => (
                                    <td key={app.key} className="py-3 px-4" style={{ color: app.color }}>
                                      {formatCurrency(branch.apps[app.key] || 0)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
                    <Truck className="w-12 h-12 text-muted-foreground" />
                    <p className="text-muted-foreground">{t('apps.noCashierJournals')}</p>
                    <p className="text-sm text-muted-foreground">{t('apps.changeFilters')}</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="executive" className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <FileText className="w-5 h-5 text-purple-600" />
                  {t('executive.title')}
                </h2>
                <div className="flex gap-2">
                  <Button variant="outline" className="gap-2" data-testid="button-export-executive-excel" onClick={async () => {
                    if (!executiveSummary) return;
                    const XLSX = await import("xlsx");
                    const wb = XLSX.utils.book_new();
                    
                    const summaryData = [
                      [t('executive.title')],
                      [t('executive.reportDate'), new Date(executiveSummary.reportDate).toLocaleDateString('en-GB')],
                      [t('common.period'), `${executiveSummary.period.startDate} ${t('common.to')} ${executiveSummary.period.endDate}`],
                      [],
                      [t('executive.salesSummary')],
                      [t('executive.totalSales'), executiveSummary.salesOverview.totalSales],
                      [t('executive.cashSales'), executiveSummary.salesOverview.cashSales],
                      [t('executive.networkSales'), executiveSummary.salesOverview.networkSales],
                      [t('executive.deliverySales'), executiveSummary.salesOverview.deliverySales],
                      [t('executive.totalTransactions'), executiveSummary.salesOverview.totalTransactions],
                      [t('executive.avgTicket'), executiveSummary.salesOverview.averageTicket],
                      [],
                      [t('executive.productionSummary')],
                      [t('executive.totalOrders'), executiveSummary.productionOverview.totalOrders],
                      [t('executive.completedOrders'), executiveSummary.productionOverview.completedOrders],
                      [t('executive.qualityRateLabel'), executiveSummary.productionOverview.qualityPassRate],
                      [],
                      [t('executive.assetsSummary')],
                      [t('executive.totalAssets'), executiveSummary.assetsOverview.totalAssets],
                      [t('executive.goodAssets'), executiveSummary.assetsOverview.goodAssets],
                      [t('executive.maintenanceNeeded'), executiveSummary.assetsOverview.maintenanceNeeded],
                      [t('executive.readinessRate'), executiveSummary.assetsOverview.assetReadinessPercent],
                      [t('executive.inventoryValue'), executiveSummary.assetsOverview.totalInventoryValue],
                      [],
                      [t('executive.targetsSummary')],
                      [t('executive.totalTarget'), executiveSummary.targetsOverview.totalTarget],
                      [t('executive.achieved'), executiveSummary.targetsOverview.totalAchieved],
                      [t('executive.achievementRateLabel'), executiveSummary.targetsOverview.achievementPercent],
                    ];
                    
                    const ws = XLSX.utils.aoa_to_sheet(summaryData);
                    XLSX.utils.book_append_sheet(wb, ws, t('executive.executiveSummarySheet'));
                    
                    const branchData = [
                      [t('executive.branchPerformance')],
                      [t('executive.branchCol'), t('executive.salesCol'), t('executive.ordersCol'), t('executive.qualityCol'), t('executive.avgTicketCol')],
                      ...executiveSummary.branchPerformance.map(b => [b.branchName, b.totalSales, b.totalOrders, b.qualityPassRate, b.averageTicket])
                    ];
                    const ws2 = XLSX.utils.aoa_to_sheet(branchData);
                    XLSX.utils.book_append_sheet(wb, ws2, t('executive.branchPerformanceSheet'));
                    
                    XLSX.writeFile(wb, `executive_report_${filters.startDate}_${filters.endDate}.xlsx`);
                  }}>
                    <Download className="w-4 h-4" />
                    {t('executive.exportExcel')}
                  </Button>
                  <Button className="gap-2 bg-red-600 hover:bg-red-700" data-testid="button-export-executive-pdf" onClick={() => {
                    if (!executiveSummary) return;
                    const htmlContent = `
                      <html dir="rtl">
                      <head>
                        <title>${t('executive.title')}</title>
                        <style>
                          body { font-family: 'Cairo', Arial, sans-serif; padding: 20px; }
                          h1 { color: #b45309; border-bottom: 2px solid #b45309; padding-bottom: 10px; }
                          h2 { color: #1f2937; margin-top: 20px; }
                          .section { margin: 15px 0; padding: 15px; background: #f9fafb; border-radius: 8px; }
                          .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
                          .metric { padding: 10px; background: white; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
                          .metric-title { font-size: 12px; color: #6b7280; }
                          .metric-value { font-size: 18px; font-weight: bold; color: #1f2937; }
                          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                          th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: right; }
                          th { background: #f3f4f6; }
                        </style>
                      </head>
                      <body>
                        <h1>${t('executive.title')} - BUTTER BAKERY</h1>
                        <p>${t('executive.reportDate')} ${new Date(executiveSummary.reportDate).toLocaleDateString('en-GB')}</p>
                        <p>${t('common.period')} ${executiveSummary.period.startDate} ${t('common.to')} ${executiveSummary.period.endDate}</p>
                        
                        <div class="section">
                          <h2>${t('executive.salesSummary')}</h2>
                          <div class="grid">
                            <div class="metric"><div class="metric-title">${t('executive.totalSales')}</div><div class="metric-value">${formatCurrency(executiveSummary.salesOverview.totalSales)}</div></div>
                            <div class="metric"><div class="metric-title">${t('executive.totalTransactions')}</div><div class="metric-value">${formatNumber(executiveSummary.salesOverview.totalTransactions)}</div></div>
                            <div class="metric"><div class="metric-title">${t('executive.avgTicket')}</div><div class="metric-value">${formatCurrency(executiveSummary.salesOverview.averageTicket)}</div></div>
                          </div>
                        </div>
                        
                        <div class="section">
                          <h2>${t('executive.productionSummary')}</h2>
                          <div class="grid">
                            <div class="metric"><div class="metric-title">${t('executive.totalOrders')}</div><div class="metric-value">${formatNumber(executiveSummary.productionOverview.totalOrders)}</div></div>
                            <div class="metric"><div class="metric-title">${t('executive.completedOrders')}</div><div class="metric-value">${formatNumber(executiveSummary.productionOverview.completedOrders)}</div></div>
                            <div class="metric"><div class="metric-title">${t('executive.qualityRateLabel')}</div><div class="metric-value">${formatPercent(executiveSummary.productionOverview.qualityPassRate)}</div></div>
                          </div>
                        </div>
                        
                        <div class="section">
                          <h2>${t('executive.assetsSummary')}</h2>
                          <div class="grid">
                            <div class="metric"><div class="metric-title">${t('executive.totalAssets')}</div><div class="metric-value">${formatNumber(executiveSummary.assetsOverview.totalAssets)}</div></div>
                            <div class="metric"><div class="metric-title">${t('executive.readinessRate')}</div><div class="metric-value">${formatPercent(executiveSummary.assetsOverview.assetReadinessPercent)}</div></div>
                            <div class="metric"><div class="metric-title">${t('executive.inventoryValue')}</div><div class="metric-value">${formatCurrency(executiveSummary.assetsOverview.totalInventoryValue)}</div></div>
                          </div>
                        </div>
                        
                        <div class="section">
                          <h2>${t('executive.targetsSummary')}</h2>
                          <div class="grid">
                            <div class="metric"><div class="metric-title">${t('executive.totalTarget')}</div><div class="metric-value">${formatCurrency(executiveSummary.targetsOverview.totalTarget)}</div></div>
                            <div class="metric"><div class="metric-title">${t('executive.achieved')}</div><div class="metric-value">${formatCurrency(executiveSummary.targetsOverview.totalAchieved)}</div></div>
                            <div class="metric"><div class="metric-title">${t('executive.achievementRateLabel')}</div><div class="metric-value">${formatPercent(executiveSummary.targetsOverview.achievementPercent)}</div></div>
                          </div>
                        </div>
                        
                        <div class="section">
                          <h2>${t('executive.branchPerformance')}</h2>
                          <table>
                            <thead>
                              <tr><th>${t('executive.branchCol')}</th><th>${t('executive.salesCol')}</th><th>${t('executive.ordersCol')}</th><th>${t('executive.qualityCol')}</th><th>${t('executive.avgTicketCol')}</th></tr>
                            </thead>
                            <tbody>
                              ${executiveSummary.branchPerformance.map(b => `<tr><td>${b.branchName}</td><td>${formatCurrency(b.totalSales)}</td><td>${formatNumber(b.totalOrders)}</td><td>${formatPercent(b.qualityPassRate)}</td><td>${formatCurrency(b.averageTicket)}</td></tr>`).join('')}
                            </tbody>
                          </table>
                        </div>
                      </body>
                      </html>
                    `;
                    printHtmlContent(htmlContent);
                  }}>
                    <FileDown className="w-4 h-4" />
                    {t('executive.exportPDF')}
                  </Button>
                </div>
              </div>

              {executiveSummaryLoading && (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
                    <RefreshCw className="w-8 h-8 text-purple-600 animate-spin" />
                    <p className="text-muted-foreground">{t('executive.loading')}</p>
                  </CardContent>
                </Card>
              )}

              {!executiveSummaryLoading && executiveSummary && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-green-500 rounded-lg">
                            <DollarSign className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="text-xs text-green-700">{t('executive.totalSales')}</p>
                            <p className="text-xl font-bold text-green-800">{formatCurrency(executiveSummary.salesOverview.totalSales)}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-500 rounded-lg">
                            <Factory className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="text-xs text-blue-700">{t('executive.productionOrders')}</p>
                            <p className="text-xl font-bold text-blue-800">{formatNumber(executiveSummary.productionOverview.totalOrders)}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-purple-500 rounded-lg">
                            <Package className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="text-xs text-purple-700">{t('executive.inventoryValue')}</p>
                            <p className="text-xl font-bold text-purple-800">{formatCurrency(executiveSummary.assetsOverview.totalInventoryValue)}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-amber-500 rounded-lg">
                            <Target className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="text-xs text-amber-700">{t('executive.targetAchievement')}</p>
                            <p className="text-xl font-bold text-amber-800">{formatPercent(executiveSummary.targetsOverview.achievementPercent)}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">{t('executive.salesDistribution')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[200px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={[
                                  { name: t('executive.cashLabel'), value: executiveSummary.salesOverview.cashSales },
                                  { name: t('executive.networkLabel'), value: executiveSummary.salesOverview.networkSales },
                                  { name: t('executive.deliveryLabel'), value: executiveSummary.salesOverview.deliverySales },
                                ]}
                                cx="50%"
                                cy="50%"
                                innerRadius={50}
                                outerRadius={70}
                                paddingAngle={5}
                                dataKey="value"
                              >
                                <Cell fill="#10B981" />
                                <Cell fill="#3B82F6" />
                                <Cell fill="#F59E0B" />
                              </Pie>
                              <Tooltip formatter={(value: number) => formatCurrency(value)} />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">{t('executive.performanceSummary')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">{t('executive.qualityRate')}</span>
                            <div className="flex items-center gap-2">
                              <div className="w-24 bg-gray-200 rounded-full h-2">
                                <div className="bg-green-500 h-2 rounded-full" style={{ width: `${Math.min(100, executiveSummary.productionOverview.qualityPassRate)}%` }} />
                              </div>
                              <span className="font-semibold">{formatPercent(executiveSummary.productionOverview.qualityPassRate)}</span>
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">{t('executive.assetReadiness')}</span>
                            <div className="flex items-center gap-2">
                              <div className="w-24 bg-gray-200 rounded-full h-2">
                                <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.min(100, executiveSummary.assetsOverview.assetReadinessPercent)}%` }} />
                              </div>
                              <span className="font-semibold">{formatPercent(executiveSummary.assetsOverview.assetReadinessPercent)}</span>
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">{t('executive.targetAchievementLabel')}</span>
                            <div className="flex items-center gap-2">
                              <div className="w-24 bg-gray-200 rounded-full h-2">
                                <div className="bg-amber-500 h-2 rounded-full" style={{ width: `${Math.min(100, executiveSummary.targetsOverview.achievementPercent)}%` }} />
                              </div>
                              <span className="font-semibold">{formatPercent(executiveSummary.targetsOverview.achievementPercent)}</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{t('executive.branchPerformance')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              <th className="text-right py-3 px-4">{t('apps.branchCol')}</th>
                              <th className="text-right py-3 px-4">{t('branches.salesCol')}</th>
                              <th className="text-right py-3 px-4">{t('branches.ordersCol')}</th>
                              <th className="text-right py-3 px-4">{t('branches.qualityCol')}</th>
                              <th className="text-right py-3 px-4">{t('branches.avgTicketCol')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {executiveSummary.branchPerformance.map((branch) => (
                              <tr key={branch.branchId} className="border-b hover:bg-muted/50">
                                <td className="py-3 px-4 font-medium">
                                  <div className="flex items-center gap-2">
                                    <Building2 className="w-4 h-4 text-amber-600" />
                                    {branch.branchName}
                                  </div>
                                </td>
                                <td className="py-3 px-4 font-semibold text-green-600">{formatCurrency(branch.totalSales)}</td>
                                <td className="py-3 px-4">{formatNumber(branch.totalOrders)}</td>
                                <td className="py-3 px-4">
                                  <span className={branch.qualityPassRate >= 90 ? 'text-green-600 font-semibold' : 'text-amber-600'}>
                                    {formatPercent(branch.qualityPassRate)}
                                  </span>
                                </td>
                                <td className="py-3 px-4">{formatCurrency(branch.averageTicket)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-amber-200 bg-amber-50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <Trophy className="w-6 h-6 text-amber-600" />
                        <div>
                          <p className="font-semibold text-amber-800">{t('executive.keyIndicators')}</p>
                          <p className="text-sm text-amber-700">
                            {t('executive.activeBranches')} {executiveSummary.keyMetrics.totalBranches} | 
                            {t('executive.activeCashiers')} {executiveSummary.keyMetrics.activeCashiers} | 
                            {t('executive.avgDailySales')} {formatCurrency(executiveSummary.keyMetrics.averageDailySales)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}

              {!executiveSummaryLoading && !executiveSummary && (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
                    <FileText className="w-12 h-12 text-muted-foreground" />
                    <p className="text-muted-foreground">{t('executive.noExecutiveData')}</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="event-pos" className="space-y-6">
              {eventPosLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
                </div>
              ) : eventPosReport ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    <KPICard
                      title={t('eventPos.totalSales')}
                      value={`${eventPosReport.totalSales.toFixed(2)} ${t('common.sar')}`}
                      icon={DollarSign}
                      color="text-green-600"
                      bgColor="bg-green-100"
                    />
                    <KPICard
                      title={t('eventPos.invoiceCount')}
                      value={eventPosReport.totalTransactions}
                      icon={Receipt}
                      color="text-blue-600"
                      bgColor="bg-blue-100"
                    />
                    <KPICard
                      title={t('eventPos.cashSales')}
                      value={`${eventPosReport.cashTotal.toFixed(2)} ${t('common.sar')}`}
                      icon={Wallet}
                      color="text-emerald-600"
                      bgColor="bg-emerald-100"
                    />
                    <KPICard
                      title={t('eventPos.networkSales')}
                      value={`${eventPosReport.networkTotal.toFixed(2)} ${t('common.sar')}`}
                      icon={CreditCard}
                      color="text-blue-600"
                      bgColor="bg-blue-100"
                    />
                    <KPICard
                      title={t('eventPos.avgTicket')}
                      value={`${eventPosReport.totalTransactions > 0 ? (eventPosReport.totalSales / eventPosReport.totalTransactions).toFixed(2) : '0.00'} ${t('common.sar')}`}
                      icon={TrendingUp}
                      color="text-amber-600"
                      bgColor="bg-amber-100"
                    />
                    <KPICard
                      title={t('eventPos.vat')}
                      value={`${eventPosReport.vatTotal.toFixed(2)} ${t('common.sar')}`}
                      icon={FileText}
                      color="text-purple-600"
                      bgColor="bg-purple-100"
                    />
                  </div>

                  {(eventPosReport.voidedCount > 0 || eventPosReport.refundedCount > 0 || eventPosReport.discountTotal > 0) && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {eventPosReport.discountTotal > 0 && (
                        <KPICard title={t('eventPos.totalDiscounts')} value={`${eventPosReport.discountTotal.toFixed(2)} ${t('common.sar')}`} icon={Gift} color="text-red-600" bgColor="bg-red-100" />
                      )}
                      {eventPosReport.voidedCount > 0 && (
                        <KPICard title={t('eventPos.voidedInvoices')} value={`${eventPosReport.voidedCount} (${eventPosReport.voidedAmount.toFixed(2)} ${t('common.sar')})`} icon={XCircle} color="text-red-600" bgColor="bg-red-100" />
                      )}
                      {eventPosReport.refundedCount > 0 && (
                        <KPICard title={t('eventPos.refundedInvoices')} value={`${eventPosReport.refundedCount} (${eventPosReport.refundedAmount.toFixed(2)} ${t('common.sar')})`} icon={Receipt} color="text-amber-600" bgColor="bg-amber-100" />
                      )}
                      {eventPosReport.splitTotal > 0 && (
                        <KPICard title={t('eventPos.splitPayment')} value={`${eventPosReport.splitTotal.toFixed(2)} ${t('common.sar')}`} icon={Activity} color="text-purple-600" bgColor="bg-purple-100" />
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {eventPosReport.dailySales.length > 0 && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-orange-500" />
                            {t('eventPos.dailySales')}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={eventPosReport.dailySales}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} />
                              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                              <YAxis tick={{ fontSize: 10 }} />
                              <Tooltip formatter={(v: any) => `${Number(v).toFixed(2)} ${t('common.sar')}`} />
                              <Bar dataKey="sales" fill="#f97316" radius={[4, 4, 0, 0]} name={t('eventPos.salesChartName')} />
                            </BarChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    )}

                    {eventPosReport.paymentBreakdown.length > 0 && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <PieChartIcon className="w-4 h-4 text-orange-500" />
                            {t('eventPos.paymentDistribution')}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={280}>
                            <PieChart>
                              <Pie
                                data={eventPosReport.paymentBreakdown.map(p => ({
                                  ...p,
                                  name: p.method === 'cash' ? t('eventPos.cash') : p.method === 'network' ? t('eventPos.network') : t('eventPos.split')
                                }))}
                                dataKey="amount"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={100}
                                label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                              >
                                {eventPosReport.paymentBreakdown.map((_: any, index: number) => (
                                  <Cell key={`cell-${index}`} fill={["#10B981", "#3B82F6", "#8B5CF6"][index % 3]} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(v: any) => `${Number(v).toFixed(2)} ${t('common.sar')}`} />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  {eventPosReport.productSales && eventPosReport.productSales.length > 0 && (
                    <>
                      <Card>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <Package className="w-4 h-4 text-orange-500" />
                                {t('eventPos.salesByProduct')}
                              </CardTitle>
                              <CardDescription>{t('eventPos.salesByProductDesc')}</CardDescription>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              data-testid="button-export-event-products"
                              className="gap-1 text-xs"
                              onClick={async () => {
                                try {
                                  const res = await fetch(`/api/pos/report/EVENT-BB/product-details?startDate=${filters.startDate || ''}&endDate=${filters.endDate || ''}`);
                                  if (!res.ok) throw new Error(t('eventPos.failedFetch'));
                                  const details = await res.json();
                                  const XLSX = await import("xlsx");
                                  const paymentLabels: Record<string, string> = { cash: t('eventPos.cash'), network: t('eventPos.network'), split: t('eventPos.split') };
                                  const excelData = details.map((item: any, idx: number) => ({
                                    '#': idx + 1,
                                    [t('eventPos.product')]: item.productName,
                                    [t('eventPos.quantity')]: item.quantity,
                                    [t('eventPos.unitPrice')]: item.unitPrice,
                                    [t('eventPos.totalPrice')]: item.totalPrice,
                                    [t('eventPos.vatAmount')]: item.vatAmount,
                                    [t('eventPos.saleDate')]: item.saleDate,
                                    [t('eventPos.paymentMethod')]: paymentLabels[item.paymentMethod] || item.paymentMethod,
                                    [t('eventPos.invoiceNumber')]: item.invoiceNumber,
                                  }));
                                  const ws = XLSX.utils.json_to_sheet(excelData);
                                  ws['!cols'] = [
                                    { wch: 5 }, { wch: 25 }, { wch: 8 }, { wch: 12 },
                                    { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 18 }
                                  ];
                                  const wb = XLSX.utils.book_new();
                                  XLSX.utils.book_append_sheet(wb, ws, t('eventPos.productSheetName'));
                                  XLSX.writeFile(wb, `event_sales_${filters.startDate || 'all'}_${filters.endDate || 'all'}.xlsx`);
                                } catch (e) {
                                  console.error('Export error:', e);
                                }
                              }}
                            >
                              <FileDown className="w-4 h-4" />
                              {t('common.exportExcel')}
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm" dir="rtl">
                              <thead>
                                <tr className="border-b border-gray-200">
                                  <th className="text-right py-3 px-3 font-bold text-gray-600">#</th>
                                  <th className="text-right py-3 px-3 font-bold text-gray-600">{t('eventPos.product')}</th>
                                  <th className="text-center py-3 px-3 font-bold text-gray-600">{t('eventPos.quantitySold')}</th>
                                  <th className="text-center py-3 px-3 font-bold text-gray-600">{t('eventPos.invoices')}</th>
                                  <th className="text-center py-3 px-3 font-bold text-gray-600">{t('eventPos.avgPriceCol')}</th>
                                  <th className="text-center py-3 px-3 font-bold text-gray-600">{t('eventPos.vatAmount')}</th>
                                  <th className="text-left py-3 px-3 font-bold text-gray-600">{t('eventPos.totalSales')}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {eventPosReport.productSales.map((p, idx) => {
                                  const maxRevenue = Math.max(...eventPosReport.productSales.map(ps => ps.totalRevenue));
                                  const barWidth = maxRevenue > 0 ? (p.totalRevenue / maxRevenue) * 100 : 0;
                                  return (
                                    <tr key={p.productId} className="border-b border-gray-100 hover:bg-orange-50/50 transition-colors">
                                      <td className="py-2.5 px-3 text-gray-400 text-xs">{idx + 1}</td>
                                      <td className="py-2.5 px-3">
                                        <div className="font-bold text-gray-800">{p.productName}</div>
                                      </td>
                                      <td className="py-2.5 px-3 text-center">
                                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 font-bold">{p.totalQuantity}</Badge>
                                      </td>
                                      <td className="py-2.5 px-3 text-center text-gray-600">{p.invoiceCount}</td>
                                      <td className="py-2.5 px-3 text-center text-gray-600">{p.avgPrice.toFixed(2)} ${t('common.sar')}</td>
                                      <td className="py-2.5 px-3 text-center text-gray-500">{p.totalVat.toFixed(2)}</td>
                                      <td className="py-2.5 px-3 text-left">
                                        <div className="flex items-center gap-2">
                                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-gradient-to-l from-orange-500 to-amber-400 rounded-full" style={{ width: `${barWidth}%` }} />
                                          </div>
                                          <span className="font-black text-orange-600 whitespace-nowrap">{p.totalRevenue.toFixed(2)} {t('common.sar')}</span>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              <tfoot>
                                <tr className="border-t-2 border-gray-300 bg-gray-50">
                                  <td colSpan={2} className="py-3 px-3 font-black text-gray-700">{t('eventPos.totalRow')}</td>
                                  <td className="py-3 px-3 text-center font-black text-blue-700">
                                    {eventPosReport.productSales.reduce((s, p) => s + p.totalQuantity, 0)}
                                  </td>
                                  <td className="py-3 px-3 text-center font-bold text-gray-600">
                                    {eventPosReport.productSales.reduce((s, p) => s + p.invoiceCount, 0)}
                                  </td>
                                  <td className="py-3 px-3"></td>
                                  <td className="py-3 px-3 text-center font-bold text-gray-600">
                                    {eventPosReport.productSales.reduce((s, p) => s + p.totalVat, 0).toFixed(2)}
                                  </td>
                                  <td className="py-3 px-3 text-left font-black text-orange-600">
                                    {eventPosReport.productSales.reduce((s, p) => s + p.totalRevenue, 0).toFixed(2)} ${t('common.sar')}
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </CardContent>
                      </Card>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                              <BarChart3 className="w-4 h-4 text-orange-500" />
                              {t('eventPos.topProductsByRevenue')}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ResponsiveContainer width="100%" height={300}>
                              <BarChart data={eventPosReport.productSales.slice(0, 10)} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" tick={{ fontSize: 10 }} />
                                <YAxis dataKey="productName" type="category" width={100} tick={{ fontSize: 10 }} />
                                <Tooltip formatter={(v: any) => `${Number(v).toFixed(2)} ${t('common.sar')}`} />
                                <Bar dataKey="totalRevenue" fill="#f97316" radius={[0, 4, 4, 0]} name={t('eventPos.revenue')} />
                              </BarChart>
                            </ResponsiveContainer>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                              <PieChartIcon className="w-4 h-4 text-orange-500" />
                              {t('eventPos.productDistribution')}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ResponsiveContainer width="100%" height={300}>
                              <PieChart>
                                <Pie
                                  data={eventPosReport.productSales.slice(0, 8).map(p => ({ name: p.productName, value: p.totalRevenue }))}
                                  dataKey="value"
                                  nameKey="name"
                                  cx="50%"
                                  cy="50%"
                                  outerRadius={100}
                                  label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                                >
                                  {eventPosReport.productSales.slice(0, 8).map((_: any, index: number) => (
                                    <Cell key={`cell-prod-${index}`} fill={COLORS[index % COLORS.length]} />
                                  ))}
                                </Pie>
                                <Tooltip formatter={(v: any) => `${Number(v).toFixed(2)} ${t('common.sar')}`} />
                                <Legend />
                              </PieChart>
                            </ResponsiveContainer>
                          </CardContent>
                        </Card>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <Card className="p-12">
                  <div className="text-center text-muted-foreground">
                    <Zap className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="font-bold">{t('eventPos.noEventData')}</p>
                    <p className="text-sm mt-1">{t('eventPos.selectDateRange')}</p>
                  </div>
                </Card>
              )}
            </TabsContent>
          </Tabs>
          </>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
              <BarChart3 className="w-12 h-12 text-muted-foreground" />
              <p className="text-muted-foreground">{t('common.noDataAvailable')}</p>
              <p className="text-sm text-muted-foreground">{t('common.loginAndCheckData')}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
