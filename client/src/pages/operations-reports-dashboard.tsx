import { useState, useEffect, useMemo, useCallback } from "react";
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
  Gift, Trophy, User, ChevronDown, ArrowRight
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area
} from "recharts";
import type { Branch, CashierSalesJournal, JournalAttachment } from "@shared/schema";
import * as XLSX from "xlsx";
import { printHtmlContent } from "@/lib/print-utils";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "نقداً",
  card: "بطاقة ائتمان",
  mada: "مدى",
  apple_pay: "Apple Pay",
  stc_pay: "STC Pay",
  hunger_station: "هنقرستيشن",
  toyou: "ToYou",
  jahez: "جاهز",
  marsool: "مرسول",
  keeta: "كيتا",
  the_chefs: "ذا شيفز",
  talabat: "طلبات",
  other: "أخرى",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  submitted: "مقدمة",
  posted: "مرحّلة",
  approved: "معتمدة",
  rejected: "مرفوضة",
  pending: "قيد الانتظار",
  in_progress: "قيد التنفيذ",
  completed: "مكتملة",
  cancelled: "ملغاة",
  passed: "ناجح",
  failed: "فاشل",
  needs_improvement: "يحتاج تحسين",
};

const DISCREPANCY_STATUS_LABELS: Record<string, string> = {
  balanced: "متوازن",
  shortage: "عجز",
  surplus: "فائض",
};

const SHIFT_LABELS: Record<string, string> = {
  morning: "الصباحية",
  evening: "المسائية",
  night: "الليلية",
  full_day: "يوم كامل",
  split: "مقسمة",
};

const REPORT_TYPES = [
  { value: "all", label: "جميع التقارير", icon: BarChart3 },
  { value: "cashier", label: "تقارير الكاشير", icon: Wallet },
  { value: "sales", label: "تقارير المبيعات", icon: DollarSign },
  { value: "shifts", label: "تقارير الورديات", icon: Clock },
  { value: "production", label: "تقارير الإنتاج", icon: Factory },
  { value: "quality", label: "تقارير الجودة", icon: CheckCircle },
];

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
  color = "text-primary",
  bgColor = "bg-primary/10",
  onClick,
  subtitle,
  progress
}: { 
  title: string; 
  value: string | number; 
  icon: React.ElementType;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  color?: string;
  bgColor?: string;
  onClick?: () => void;
  subtitle?: string;
  progress?: number;
}) {
  return (
    <Card 
      data-testid={`kpi-card-${title.replace(/\s+/g, '-')}`}
      className={`relative overflow-hidden transition-all duration-200 ${onClick ? "cursor-pointer hover:shadow-lg hover:-translate-y-0.5" : "hover:shadow-sm"}`}
      onClick={onClick}
    >
      {progress !== undefined && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200">
          <div className={`h-full transition-all duration-500 ${color?.includes('green') ? 'bg-green-500' : color?.includes('red') ? 'bg-red-500' : color?.includes('amber') ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(progress, 100)}%` }} />
        </div>
      )}
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-0.5">{title}</p>
            <p className={`text-xl font-bold ${color}`}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
            {trendLabel && (
              <div className="flex items-center gap-1 mt-1 text-xs">
                {trend === "up" && <TrendingUp className="w-3 h-3 text-green-500" />}
                {trend === "down" && <TrendingDown className="w-3 h-3 text-red-500" />}
                <span className={trend === "up" ? "text-green-500" : trend === "down" ? "text-red-500" : "text-muted-foreground"}>
                  {trendLabel}
                </span>
              </div>
            )}
          </div>
          <div className={`p-2.5 rounded-xl ${bgColor} shadow-sm`}>
            <Icon className={`w-5 h-5 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
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
            alert.type === 'danger' ? 'bg-red-50 border-red-200 text-red-800' :
            alert.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' :
            'bg-blue-50 border-blue-200 text-blue-800'
          }`}
        >
          {alert.type === 'danger' && <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />}
          {alert.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />}
          {alert.type === 'info' && <Activity className="w-5 h-5 text-blue-600 flex-shrink-0" />}
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

function QuickStatsRow({ report, cashierJournals }: { report: OperationsReport; cashierJournals: CashierSalesJournal[] }) {
  const shortageCount = cashierJournals.filter(j => j.discrepancyStatus === 'shortage').length;
  const pendingApproval = cashierJournals.filter(j => j.status === 'submitted').length;
  
  const formatCurrency = (amount: number) => new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(amount);
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-3 p-4 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 text-white">
      <div className="text-center">
        <p className="text-2xl font-bold text-green-400">{formatCurrency(report.salesReport.totalSales)}</p>
        <p className="text-xs text-slate-400">إجمالي المبيعات</p>
      </div>
      <div className="text-center">
        <p className="text-2xl font-bold text-blue-400">{report.salesReport.totalTransactions}</p>
        <p className="text-xs text-slate-400">العمليات</p>
      </div>
      <div className="text-center">
        <p className={`text-2xl font-bold ${report.productionReport.qualityPassRate >= 90 ? 'text-green-400' : 'text-amber-400'}`}>
          {report.productionReport.qualityPassRate.toFixed(0)}%
        </p>
        <p className="text-xs text-slate-400">نسبة الجودة</p>
      </div>
      <div className="text-center">
        <p className={`text-2xl font-bold ${shortageCount > 0 ? 'text-red-400' : 'text-green-400'}`}>{shortageCount}</p>
        <p className="text-xs text-slate-400">حالات عجز</p>
      </div>
      <div className="text-center">
        <p className={`text-2xl font-bold ${pendingApproval > 0 ? 'text-amber-400' : 'text-green-400'}`}>{pendingApproval}</p>
        <p className="text-xs text-slate-400">بانتظار الموافقة</p>
      </div>
      <div className="text-center">
        <p className="text-2xl font-bold text-purple-400">{cashierJournals.length}</p>
        <p className="text-xs text-slate-400">يوميات الكاشير</p>
      </div>
    </div>
  );
}

function JournalDetailsDialog({ journal, branches }: { journal: CashierSalesJournal; branches?: Branch[] }) {
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
      return date.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    };

    const SHIFT_LABELS: Record<string, string> = {
      morning: "صباحي",
      evening: "مسائي", 
      night: "ليلي",
    };

    const cashierSig = journalDetails?.signatures?.find(s => s.signatureType === 'cashier');
    const supervisorSig = journalDetails?.signatures?.find(s => s.signatureType === 'supervisor' || s.signatureType === 'manager');

    const htmlContent = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>ملخص اليومية - ${journal.journalDate}</title>
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
  <div class="loading-msg" id="loadingMsg">جاري تحميل التقرير...</div>
  <button class="print-btn" id="printBtn" style="display:none;" onclick="window.print()">طباعة</button>
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
        <div class="title">ملخص يومية الكاشير</div>
        <div class="info">${branchName} | ${SHIFT_LABELS[journal.shiftType || ''] || journal.shiftType} | ${formatDate(journal.journalDate)}</div>
      </div>
      <div style="text-align:left;">
        <div style="font-size:10px;color:#666;">رقم اليومية</div>
        <div style="font-size:14px;font-weight:bold;">#${journal.id}</div>
      </div>
    </div>
    
    <div class="main-grid">
      <div>
        <div class="section">
          <div class="section-title">ملخص المبيعات</div>
          <div class="row"><span class="label">إجمالي المبيعات</span><span class="value big">${(journal.totalSales || 0).toLocaleString('en', {minimumFractionDigits: 2})} ر.س</span></div>
          <div class="row"><span class="label">عدد الفواتير</span><span class="value">${journal.transactionCount || 0}</span></div>
          <div class="row"><span class="label">عدد العملاء</span><span class="value">${journal.customerCount || 0}</span></div>
          <div class="row"><span class="label">متوسط الفاتورة</span><span class="value">${(journal.averageTicket || 0).toFixed(2)} ر.س</span></div>
        </div>
        
        <div class="section">
          <div class="section-title">تسوية النقدي</div>
          <div class="recon-box">
            <div class="recon-row"><span>رصيد الافتتاح</span><span>${(journal.openingBalance || 0).toLocaleString('en', {minimumFractionDigits: 2})} ر.س</span></div>
            <div class="recon-row"><span>المبيعات النقدية</span><span>${(journal.cashTotal || 0).toLocaleString('en', {minimumFractionDigits: 2})} ر.س</span></div>
            <div class="recon-row"><span>المتوقع في الصندوق</span><span>${(journal.expectedCash || 0).toLocaleString('en', {minimumFractionDigits: 2})} ر.س</span></div>
            <div class="recon-row"><span>الفعلي في الصندوق</span><span>${(journal.actualCashDrawer || 0).toLocaleString('en', {minimumFractionDigits: 2})} ر.س</span></div>
          </div>
          <div class="diff-display ${(journal.discrepancyAmount || 0) === 0 ? 'balanced' : (journal.discrepancyAmount || 0) < 0 ? 'shortage' : 'surplus'}">
            <div class="amount ${(journal.discrepancyAmount || 0) < 0 ? 'negative' : (journal.discrepancyAmount || 0) > 0 ? 'positive' : ''}">${(journal.discrepancyAmount || 0).toLocaleString('en', {minimumFractionDigits: 2})} ر.س</div>
            <div class="status">${(journal.discrepancyAmount || 0) === 0 ? 'مطابق ✓' : (journal.discrepancyAmount || 0) < 0 ? 'عجز مُسجّل على الكاشير' : 'فائض مُسجّل'}</div>
          </div>
        </div>
      </div>
      
      <div>
        <div class="section">
          <div class="section-title">تصنيف المبيعات</div>
          
          <div class="category-header cash"><span>💵 نقدي</span><span>${(journal.cashTotal || 0).toLocaleString('en', {minimumFractionDigits: 2})} ر.س</span></div>
          
          <div class="category-header cards"><span>💳 بطاقات وشبكة</span><span>${(journal.networkTotal || 0).toLocaleString('en', {minimumFractionDigits: 2})} ر.س</span></div>
          ${paymentBreakdowns ? paymentBreakdowns.filter(p => p.amount > 0 && ['card', 'mada', 'apple_pay', 'stc_pay'].includes(p.paymentMethod)).map(p => `
          <div class="sub-row"><span>• ${PAYMENT_METHOD_LABELS[p.paymentMethod] || p.paymentMethod}</span><span>${(p.amount || 0).toLocaleString('en', {minimumFractionDigits: 2})} ر.س</span></div>
          `).join('') : ''}
          
          <div class="category-header apps"><span>🚗 تطبيقات التوصيل</span><span>${(journal.deliveryTotal || 0).toLocaleString('en', {minimumFractionDigits: 2})} ر.س</span></div>
          ${paymentBreakdowns ? paymentBreakdowns.filter(p => p.amount > 0 && ['hunger_station', 'toyou', 'jahez', 'marsool', 'keeta', 'the_chefs', 'talabat'].includes(p.paymentMethod)).map(p => `
          <div class="sub-row"><span>• ${PAYMENT_METHOD_LABELS[p.paymentMethod] || p.paymentMethod}</span><span>${(p.amount || 0).toLocaleString('en', {minimumFractionDigits: 2})} ر.س</span></div>
          `).join('') : ''}
        </div>
        
        ${journal.notes ? `<div class="section"><div class="section-title">ملاحظات</div><div style="font-size:10px;color:#666;padding:5px;background:#fffbeb;border-radius:4px;">${journal.notes}</div></div>` : ''}
      </div>
    </div>
    
    <div class="signature-section">
      <div style="font-size:11px;font-weight:bold;margin-bottom:8px;text-align:center;">التوقيعات والاعتماد</div>
      <div class="sig-grid">
        <div class="sig-box">
          <div class="role">توقيع الكاشير</div>
          ${cashierSig?.signatureData ? `<img class="sig-img" src="${cashierSig.signatureData}" />` : '<div class="placeholder">لم يوقع بعد</div>'}
          <div class="name">${journal.cashierName}</div>
        </div>
        <div class="sig-box">
          <div class="role">توقيع المشرف</div>
          ${supervisorSig?.signatureData ? `<img class="sig-img" src="${supervisorSig.signatureData}" /><div class="name">${supervisorSig.signerName}</div>` : '<div class="placeholder">لم يوقع بعد</div><div class="name">________________</div>'}
        </div>
        <div class="sig-box">
          <div class="role">اعتماد المدير</div>
          ${journal.approvedBy ? `<div class="name" style="margin-top:15px;">${journal.approvedBy}</div>` : '<div class="placeholder">لم يُعتمد بعد</div><div class="name">________________</div>'}
        </div>
      </div>
    </div>
    
    <div class="footer">
      <span>بتر بيكري - Butter Bakery</span>
      <span>تم الإنشاء: ${new Date().toLocaleDateString('en-GB')}</span>
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
            عرض
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-amber-600" />
                تفاصيل يومية الكاشير - {journal.journalDate}
              </DialogTitle>
              <Button onClick={handleExportJournalPDF} className="gap-2 bg-amber-600 hover:bg-amber-700" data-testid={`export-journal-pdf-${journal.id}`}>
                <FileDown className="w-4 h-4" />
                تصدير PDF
              </Button>
            </div>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            <div className="space-y-6 p-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg border border-amber-200">
                  <p className="text-xs text-muted-foreground">الفرع</p>
                  <p className="font-semibold">{branchName}</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
                  <p className="text-xs text-muted-foreground">اسم الكاشير</p>
                  <p className="font-semibold">{journal.cashierName}</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border border-purple-200">
                  <p className="text-xs text-muted-foreground">الوردية</p>
                  <p className="font-semibold">{journal.shiftType || "-"}</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200">
                  <p className="text-xs text-muted-foreground">الحالة</p>
                  <Badge variant={journal.status === "approved" ? "default" : journal.status === "rejected" ? "destructive" : "secondary"}>
                    {STATUS_LABELS[journal.status] || journal.status}
                  </Badge>
                </div>
              </div>

              <Card className="border-green-200">
                <CardHeader className="pb-2 bg-gradient-to-r from-green-50 to-white">
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-green-600" />
                    ملخص المبيعات
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                      <span className="text-muted-foreground">إجمالي المبيعات</span>
                      <span className="font-bold text-green-600 text-lg">{journal.totalSales?.toLocaleString('en')} ر.س</span>
                    </div>
                    <div className="flex justify-between items-center p-2 border-b">
                      <span className="text-muted-foreground">المبيعات النقدية</span>
                      <span className="font-semibold">{journal.cashTotal?.toLocaleString('en')} ر.س</span>
                    </div>
                    <div className="flex justify-between items-center p-2 border-b">
                      <span className="text-muted-foreground">مبيعات الشبكة</span>
                      <span className="font-semibold">{journal.networkTotal?.toLocaleString('en')} ر.س</span>
                    </div>
                    <div className="flex justify-between items-center p-2 border-b">
                      <span className="text-muted-foreground">مبيعات التوصيل</span>
                      <span className="font-semibold">{journal.deliveryTotal?.toLocaleString('en')} ر.س</span>
                    </div>
                    <div className="flex justify-between items-center p-2 border-b">
                      <span className="text-muted-foreground">عدد العمليات</span>
                      <span className="font-semibold">{journal.transactionCount}</span>
                    </div>
                    <div className="flex justify-between items-center p-2 border-b">
                      <span className="text-muted-foreground">متوسط الفاتورة</span>
                      <span className="font-semibold">{journal.averageTicket?.toFixed(2)} ر.س</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-blue-200">
                <CardHeader className="pb-2 bg-gradient-to-r from-blue-50 to-white">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-blue-600" />
                    مطابقة الصندوق
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex flex-col p-3 bg-gray-50 rounded-lg">
                      <span className="text-xs text-muted-foreground">رصيد الافتتاح</span>
                      <span className="font-semibold">{journal.openingBalance?.toLocaleString('en')} ر.س</span>
                    </div>
                    <div className="flex flex-col p-3 bg-gray-50 rounded-lg">
                      <span className="text-xs text-muted-foreground">المتوقع في الصندوق</span>
                      <span className="font-semibold">{journal.expectedCash?.toLocaleString('en')} ر.س</span>
                    </div>
                    <div className="flex flex-col p-3 bg-gray-50 rounded-lg">
                      <span className="text-xs text-muted-foreground">الفعلي في الصندوق</span>
                      <span className="font-semibold">{journal.actualCashDrawer?.toLocaleString('en')} ر.س</span>
                    </div>
                    <div className={`flex flex-col p-3 rounded-lg ${journal.discrepancyStatus === 'balanced' ? 'bg-green-50 border border-green-200' : journal.discrepancyStatus === 'shortage' ? 'bg-red-50 border border-red-200' : 'bg-blue-50 border border-blue-200'}`}>
                      <span className="text-xs text-muted-foreground">الفرق</span>
                      <span className={`font-bold ${journal.discrepancyAmount && journal.discrepancyAmount < 0 ? 'text-red-600' : journal.discrepancyAmount && journal.discrepancyAmount > 0 ? 'text-green-600' : ''}`}>
                        {journal.discrepancyAmount?.toLocaleString('en')} ر.س
                      </span>
                      <Badge variant={journal.discrepancyStatus === 'balanced' ? 'default' : journal.discrepancyStatus === 'shortage' ? 'destructive' : 'secondary'} className="mt-1 w-fit">
                        {DISCREPANCY_STATUS_LABELS[journal.discrepancyStatus || 'balanced']}
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
                      المرفقات والصور ({attachments.length})
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
                      ملاحظات
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
                عرض الصورة
              </DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-center bg-black/5 rounded-lg p-2">
              <img 
                src={selectedImage} 
                alt="صورة مكبرة"
                className="max-w-full max-h-[80vh] object-contain rounded-lg"
              />
            </div>
            <div className="flex justify-center gap-2 mt-2">
              <Button variant="outline" onClick={() => setSelectedImage(null)}>
                إغلاق
              </Button>
              <Button onClick={() => {
                const link = document.createElement('a');
                link.href = selectedImage;
                link.download = `مرفق_${journal.journalDate}.png`;
                link.click();
              }} className="gap-2">
                <Download className="w-4 h-4" />
                تحميل الصورة
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

  const [activeTab, setActiveTab] = useState("overview");
  const [cashierPage, setCashierPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const cashierPageSize = 15;

  const { branches, userBranchId, canSelectBranch } = useBranches();

  useEffect(() => {
    if (userBranchId && !filters.branchId) {
      setFilters(prev => ({ ...prev, branchId: userBranchId }));
    }
  }, [userBranchId, filters.branchId]);

  // Query for users (cashiers)
  const { data: users } = useQuery<{ id: string; username: string; firstName: string | null; lastName: string | null }[]>({
    queryKey: ["/api/users"],
  });

  const queryString = new URLSearchParams({
    ...(filters.branchId && { branchId: filters.branchId }),
    ...(filters.startDate && { startDate: filters.startDate }),
    ...(filters.endDate && { endDate: filters.endDate }),
  }).toString();

  const { data: report, isLoading, refetch } = useQuery<OperationsReport>({
    queryKey: [`/api/operations/reports?${queryString}`],
    staleTime: 5 * 60 * 1000,
  });

  const cashierQueryString = new URLSearchParams({
    ...(filters.branchId && { branchId: filters.branchId }),
    ...(filters.startDate && { startDate: filters.startDate }),
    ...(filters.endDate && { endDate: filters.endDate }),
  }).toString();

  const { data: cashierJournals, isLoading: cashierJournalsLoading } = useQuery<CashierSalesJournal[]>({
    queryKey: [`/api/cashier-journals?${cashierQueryString}`],
    enabled: activeTab === 'cashier' || activeTab === 'overview' || activeTab === 'returns' || activeTab === 'discrepancies',
    staleTime: 5 * 60 * 1000,
  });

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
      if (!res.ok) return [];
      return res.json();
    },
    enabled: activeTab === 'targets',
    staleTime: 5 * 60 * 1000,
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
      if (!res.ok) return null;
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
      if (!res.ok) return null;
      return res.json();
    },
    enabled: activeTab === 'payment-mismatch',
    staleTime: 5 * 60 * 1000,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-SA", {
      style: "currency",
      currency: "SAR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("en").format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const handleExportExcel = () => {
    if (!report) return;

    const wb = XLSX.utils.book_new();

    const salesData = [
      ["تقرير المبيعات - " + filters.startDate + " إلى " + filters.endDate],
      [],
      ["البند", "القيمة"],
      ["إجمالي المبيعات", report.salesReport.totalSales],
      ["المبيعات النقدية", report.salesReport.cashSales],
      ["مبيعات الشبكة", report.salesReport.networkSales],
      ["مبيعات التوصيل", report.salesReport.deliverySales],
      ["إجمالي العمليات", report.salesReport.totalTransactions],
      ["متوسط قيمة الفاتورة", report.salesReport.averageTicket],
      ["عدد حالات العجز", report.salesReport.totalShortages],
      ["إجمالي العجز", report.salesReport.shortageAmount],
      ["عدد حالات الفائض", report.salesReport.totalSurpluses],
      ["إجمالي الفائض", report.salesReport.surplusAmount],
    ];
    const salesSheet = XLSX.utils.aoa_to_sheet(salesData);
    XLSX.utils.book_append_sheet(wb, salesSheet, "المبيعات");

    const productionData = [
      ["تقرير الإنتاج - " + filters.startDate + " إلى " + filters.endDate],
      [],
      ["البند", "القيمة"],
      ["إجمالي الأوامر", report.productionReport.totalOrders],
      ["قيد الانتظار", report.productionReport.pendingOrders],
      ["قيد التنفيذ", report.productionReport.inProgressOrders],
      ["مكتملة", report.productionReport.completedOrders],
      ["ملغاة", report.productionReport.cancelledOrders],
      ["الكمية المنتجة", report.productionReport.totalQuantityProduced],
      ["نسبة النجاح في الجودة", `${report.productionReport.qualityPassRate.toFixed(1)}%`],
    ];
    const productionSheet = XLSX.utils.aoa_to_sheet(productionData);
    XLSX.utils.book_append_sheet(wb, productionSheet, "الإنتاج");

    const shiftsData = [
      ["تقرير الورديات - " + filters.startDate + " إلى " + filters.endDate],
      [],
      ["البند", "القيمة"],
      ["إجمالي الورديات", report.shiftsReport.totalShifts],
      ["الورديات مع موظفين", report.shiftsReport.shiftsWithEmployees],
      ["إجمالي التكليفات", report.shiftsReport.totalEmployeeAssignments],
    ];
    const shiftsSheet = XLSX.utils.aoa_to_sheet(shiftsData);
    XLSX.utils.book_append_sheet(wb, shiftsSheet, "الورديات");

    const branchData = [
      ["مقارنة الفروع - " + filters.startDate + " إلى " + filters.endDate],
      [],
      ["الفرع", "المبيعات", "الأوامر", "نسبة الجودة", "متوسط الفاتورة"],
      ...report.branchComparison.map(b => [
        b.branchName,
        b.totalSales,
        b.totalOrders,
        `${b.qualityPassRate.toFixed(1)}%`,
        b.averageTicket.toFixed(2),
      ]),
    ];
    const branchSheet = XLSX.utils.aoa_to_sheet(branchData);
    XLSX.utils.book_append_sheet(wb, branchSheet, "مقارنة الفروع");

    if (cashierJournals && cashierJournals.length > 0) {
      const journalData = [
        ["يوميات الكاشير - " + filters.startDate + " إلى " + filters.endDate],
        [],
        ["التاريخ", "الفرع", "الكاشير", "الوردية", "إجمالي المبيعات", "نقداً", "شبكة", "توصيل", "العجز/الفائض", "الحالة"],
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
          STATUS_LABELS[j.status] || j.status,
        ]),
      ];
      const journalSheet = XLSX.utils.aoa_to_sheet(journalData);
      XLSX.utils.book_append_sheet(wb, journalSheet, "يوميات الكاشير");
    }

    XLSX.writeFile(wb, `تقارير_التشغيل_${filters.startDate}_${filters.endDate}.xlsx`);
  };

  const handleExportPDF = () => {
    if (!report) return;

    const selectedBranch = filters.branchId ? branches?.find(b => b.id === filters.branchId)?.name : 'جميع الفروع';

    const htmlContent = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>تقرير التشغيل - ${filters.startDate}</title>
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
  <div class="loading-msg" id="loadingMsg">جاري تحميل التقرير...</div>
  <button class="print-btn" id="printBtn" style="display:none;" onclick="window.print()">طباعة</button>
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
      <div class="title">تقرير التشغيل الشامل</div>
      <div class="info">${selectedBranch} | ${filters.startDate} إلى ${filters.endDate}</div>
    </div>
    <div style="font-size:10px;font-weight:bold;color:#d4a853;">بتر بيكري</div>
  </div>

  <div class="summary-row">
    <div class="summary-card"><div class="value">${formatCurrency(report.salesReport.totalSales)}</div><div class="label">إجمالي المبيعات</div></div>
    <div class="summary-card"><div class="value">${formatNumber(report.salesReport.totalTransactions)}</div><div class="label">العمليات</div></div>
    <div class="summary-card"><div class="value">${formatNumber(report.productionReport.totalOrders)}</div><div class="label">أوامر الإنتاج</div></div>
    <div class="summary-card"><div class="value">${formatPercent(report.productionReport.qualityPassRate)}</div><div class="label">الجودة</div></div>
  </div>

  <div class="main-grid">
    <div>
      <div class="section">
        <div class="section-title">المبيعات</div>
        <div class="kpi-row">
          <div class="kpi-item"><div class="value">${formatCurrency(report.salesReport.cashSales)}</div><div class="label">نقدي</div></div>
          <div class="kpi-item"><div class="value">${formatCurrency(report.salesReport.networkSales)}</div><div class="label">شبكة</div></div>
          <div class="kpi-item"><div class="value">${formatCurrency(report.salesReport.deliverySales)}</div><div class="label">توصيل</div></div>
        </div>
        <table>
          <tr><td>متوسط الفاتورة</td><td>${formatCurrency(report.salesReport.averageTicket)}</td></tr>
          <tr><td>العجز (${report.salesReport.totalShortages})</td><td style="color:#dc3545;">${formatCurrency(report.salesReport.shortageAmount)}</td></tr>
          <tr><td>الفائض (${report.salesReport.totalSurpluses})</td><td style="color:#28a745;">${formatCurrency(report.salesReport.surplusAmount)}</td></tr>
        </table>
      </div>
      
      <div class="section">
        <div class="section-title">الإنتاج</div>
        <div class="kpi-row">
          <div class="kpi-item"><div class="value">${formatNumber(report.productionReport.pendingOrders)}</div><div class="label">انتظار</div></div>
          <div class="kpi-item"><div class="value">${formatNumber(report.productionReport.inProgressOrders)}</div><div class="label">تنفيذ</div></div>
          <div class="kpi-item"><div class="value">${formatNumber(report.productionReport.completedOrders)}</div><div class="label">مكتملة</div></div>
          <div class="kpi-item"><div class="value">${formatNumber(report.productionReport.totalQuantityProduced)}</div><div class="label">الكمية</div></div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">الورديات</div>
        <div class="kpi-row">
          <div class="kpi-item"><div class="value">${formatNumber(report.shiftsReport.totalShifts)}</div><div class="label">الورديات</div></div>
          <div class="kpi-item"><div class="value">${formatNumber(report.shiftsReport.totalEmployeeAssignments)}</div><div class="label">التكليفات</div></div>
          <div class="kpi-item"><div class="value">${report.shiftsReport.totalShifts > 0 ? formatPercent((report.shiftsReport.shiftsWithEmployees / report.shiftsReport.totalShifts) * 100) : '100%'}</div><div class="label">التغطية</div></div>
        </div>
      </div>
    </div>
    
    <div>
      <div class="section">
        <div class="section-title">مقارنة الفروع</div>
        <table>
          <tr><th>الفرع</th><th>المبيعات</th><th>متوسط</th></tr>
          ${report.branchComparison.map(b => `<tr><td>${b.branchName}</td><td>${formatCurrency(b.totalSales)}</td><td>${formatCurrency(b.averageTicket)}</td></tr>`).join('')}
        </table>
      </div>

      ${cashierJournals && cashierJournals.length > 0 ? `
      <div class="section">
        <div class="section-title">يوميات الكاشير (${cashierJournals.length})</div>
        <table>
          <tr><th>التاريخ</th><th>الفرع</th><th>الكاشير</th><th>المبيعات</th><th>الفرق</th><th>الحالة</th></tr>
          ${cashierJournals.slice(0, 8).map(j => `
            <tr>
              <td>${j.journalDate}</td>
              <td>${branches?.find(b => b.id === j.branchId)?.name?.substring(0,10) || j.branchId}</td>
              <td>${j.cashierName?.substring(0,10) || '-'}</td>
              <td>${formatCurrency(j.totalSales || 0)}</td>
              <td style="color:${(j.discrepancyAmount || 0) < 0 ? '#dc3545' : '#28a745'};">${formatCurrency(j.discrepancyAmount || 0)}</td>
              <td><span class="status-badge status-${j.status === 'approved' ? 'approved' : j.status === 'rejected' ? 'rejected' : 'pending'}">${STATUS_LABELS[j.status]?.substring(0,6) || j.status}</span></td>
            </tr>
          `).join('')}
        </table>
      </div>
      ` : ''}
    </div>
  </div>

  <div class="footer">
    <span>بتر بيكري - Butter Bakery</span>
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
      : 'جميع الكاشير';
    const selectedBranch = filters.branchId 
      ? branches?.find(b => b.id === filters.branchId)?.name 
      : 'جميع الفروع';

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
  <title>كشف حساب الكاشير - ${cashierName}</title>
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
  <div class="loading-msg" id="loadingMsg">جاري تحميل التقرير...</div>
  <button class="print-btn" id="printBtn" style="display:none;" onclick="window.print()">طباعة كشف الحساب</button>
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
      <div class="title">كشف حساب الكاشير</div>
      <div class="subtitle">${cashierName}</div>
    </div>
    <div class="logo">بتر بيكري</div>
  </div>

  <div class="info-bar">
    <div class="info-item">
      <div class="label">الفرع</div>
      <div class="value">${selectedBranch}</div>
    </div>
    <div class="info-item">
      <div class="label">الفترة</div>
      <div class="value">${filters.startDate} إلى ${filters.endDate}</div>
    </div>
    <div class="info-item">
      <div class="label">عدد اليوميات</div>
      <div class="value">${filteredCashierJournals.length}</div>
    </div>
    <div class="info-item">
      <div class="label">تاريخ الطباعة</div>
      <div class="value">${new Date().toLocaleDateString('ar-SA')}</div>
    </div>
  </div>

  <div class="summary-grid">
    <div class="summary-card">
      <div class="value">${formatCurrency(totalSales)}</div>
      <div class="label">إجمالي المبيعات</div>
    </div>
    <div class="summary-card">
      <div class="value">${formatNumber(totalTransactions)}</div>
      <div class="label">عدد الفواتير</div>
    </div>
    <div class="summary-card">
      <div class="value">${formatCurrency(avgTicket)}</div>
      <div class="label">متوسط الفاتورة</div>
    </div>
    <div class="summary-card ${netDiscrepancy < 0 ? 'negative' : netDiscrepancy > 0 ? 'positive' : ''}">
      <div class="value">${formatCurrency(netDiscrepancy)}</div>
      <div class="label">صافي الفرق</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">تفاصيل طرق الدفع</div>
    <div class="breakdown-grid">
      <div class="breakdown-item">
        <div class="value">${formatCurrency(totalCash)}</div>
        <div class="label">نقداً</div>
      </div>
      <div class="breakdown-item">
        <div class="value">${formatCurrency(totalNetwork)}</div>
        <div class="label">شبكة وبطاقات</div>
      </div>
      <div class="breakdown-item">
        <div class="value">${formatCurrency(totalDelivery)}</div>
        <div class="label">تطبيقات التوصيل</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">ملخص العجز والفائض</div>
    <div class="breakdown-grid">
      <div class="breakdown-item">
        <div class="value" style="color:#dc3545;">${shortages.length} حالة</div>
        <div class="label">عدد حالات العجز</div>
      </div>
      <div class="breakdown-item">
        <div class="value" style="color:#dc3545;">${formatCurrency(totalShortageAmount)}</div>
        <div class="label">إجمالي العجز</div>
      </div>
      <div class="breakdown-item">
        <div class="value" style="color:#28a745;">${formatCurrency(totalSurplusAmount)}</div>
        <div class="label">إجمالي الفائض (${surpluses.length})</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">تفاصيل اليوميات (${filteredCashierJournals.length})</div>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>التاريخ</th>
          <th>الوردية</th>
          <th>المبيعات</th>
          <th>نقداً</th>
          <th>شبكة</th>
          <th>توصيل</th>
          <th>الفواتير</th>
          <th>الفرق</th>
          <th>الحالة</th>
        </tr>
      </thead>
      <tbody>
        ${filteredCashierJournals.map((j, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td>${j.journalDate}</td>
            <td>${j.shiftType === 'morning' ? 'صباحي' : j.shiftType === 'evening' ? 'مسائي' : j.shiftType === 'night' ? 'ليلي' : j.shiftType || '-'}</td>
            <td>${formatCurrency(j.totalSales || 0)}</td>
            <td>${formatCurrency(j.cashTotal || 0)}</td>
            <td>${formatCurrency(j.networkTotal || 0)}</td>
            <td>${formatCurrency(j.deliveryTotal || 0)}</td>
            <td>${j.transactionCount || 0}</td>
            <td class="${(j.discrepancyAmount || 0) < 0 ? 'discrepancy-shortage' : (j.discrepancyAmount || 0) > 0 ? 'discrepancy-surplus' : 'discrepancy-balanced'}">${formatCurrency(j.discrepancyAmount || 0)}</td>
            <td><span class="status-badge status-${j.status === 'approved' || j.status === 'posted' ? 'approved' : j.status === 'rejected' ? 'rejected' : 'pending'}">${STATUS_LABELS[j.status] || j.status}</span></td>
          </tr>
        `).join('')}
      </tbody>
      <tfoot>
        <tr style="background:#f0f0f0;font-weight:bold;">
          <td colspan="3">الإجمالي</td>
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
    <div class="signature-box">توقيع الكاشير</div>
    <div class="signature-box">توقيع المدير</div>
  </div>

  <div class="footer">
    <span>بتر بيكري - Butter Bakery</span>
    <span>تم الإنشاء: ${new Date().toLocaleString('ar-SA')}</span>
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
      const shift = j.shiftType || 'غير محدد';
      if (!acc[shift]) acc[shift] = { shift, sales: 0, count: 0, avgTicket: 0, shortages: 0 };
      acc[shift].sales += (j.totalSales || 0);
      acc[shift].count += 1;
      if (j.discrepancyStatus === 'shortage') acc[shift].shortages += 1;
      return acc;
    }, {} as Record<string, { shift: string; sales: number; count: number; avgTicket: number; shortages: number }>);
    
    return Object.values(shiftData).map(s => ({
      ...s,
      avgTicket: s.count > 0 ? s.sales / s.count : 0,
      shiftLabel: s.shift === 'morning' ? 'صباحي' : s.shift === 'evening' ? 'مسائي' : s.shift === 'night' ? 'ليلي' : s.shift,
    }));
  }, [filteredCashierJournals]);

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
      default:
        return ["overview", "sales", "targets", "production", "shifts", "cashier", "returns", "discrepancies", "payment-mismatch", "branches", "branch-overview", "executive"];
    }
  };

  const visibleTabs = getVisibleTabs();

  return (
    <Layout>
      <div className="p-4 md:p-8 lg:p-10 max-w-6xl mx-auto space-y-4" dir="rtl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/operations">
              <Button variant="ghost" size="icon" className="h-11 w-11 sm:h-8 sm:w-8" data-testid="btn-back">
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2" data-testid="page-title">
                <BarChart3 className="w-7 h-7 text-amber-600" />
                لوحة تقارير التشغيل الشاملة
              </h1>
              <p className="text-muted-foreground">تقارير تفصيلية لجميع عمليات التشغيل والإنتاج والمبيعات ويوميات الكاشير</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link href="/targets-dashboard">
              <Button variant="outline" className="h-11 sm:h-9 gap-2" data-testid="button-targets-dashboard">
                <Trophy className="w-4 h-4 text-amber-600" />
                لوحة الأهداف
              </Button>
            </Link>
            <Link href="/targets-planning">
              <Button variant="outline" className="h-11 sm:h-9 gap-2" data-testid="button-targets-planning">
                <Target className="w-4 h-4 text-amber-600" />
                تخطيط الأهداف
              </Button>
            </Link>
            <Link href="/incentives-management">
              <Button variant="outline" className="h-11 sm:h-9 gap-2" data-testid="button-incentives">
                <Gift className="w-4 h-4 text-amber-600" />
                الحوافز
              </Button>
            </Link>
            <Button variant="outline" className="h-11 sm:h-9 gap-2" onClick={() => refetch()} data-testid="button-refresh">
              <RefreshCw className="w-4 h-4" />
              تحديث
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
                    فلاتر التقارير المتقدمة
                  </CardTitle>
                  <CardDescription>فلاتر ديناميكية شاملة للتحكم في البيانات المعروضة</CardDescription>
                </div>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1" data-testid="toggle-filters">
                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${filtersOpen ? 'rotate-180' : ''}`} />
                    {filtersOpen ? 'إخفاء' : 'إظهار'}
                  </Button>
                </CollapsibleTrigger>
              </div>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-4 pt-0">
            {/* Quick Period Selection */}
            <div className="flex flex-wrap gap-2 pb-3 border-b">
              <span className="text-sm text-muted-foreground ml-2">الفترة السريعة:</span>
              <Button
                variant={filters.periodType === "daily" ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriodDates("daily")}
                className="gap-1"
                data-testid="period-daily"
              >
                <Calendar className="w-3 h-3" />
                اليوم
              </Button>
              <Button
                variant={filters.periodType === "weekly" ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriodDates("weekly")}
                className="gap-1"
                data-testid="period-weekly"
              >
                <Calendar className="w-3 h-3" />
                هذا الأسبوع
              </Button>
              <Button
                variant={filters.periodType === "monthly" ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriodDates("monthly")}
                className="gap-1"
                data-testid="period-monthly"
              >
                <Calendar className="w-3 h-3" />
                هذا الشهر
              </Button>
              <Button
                variant={filters.periodType === "custom" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilters({ ...filters, periodType: "custom" })}
                className="gap-1"
                data-testid="period-custom"
              >
                <Calendar className="w-3 h-3" />
                مخصص
              </Button>
            </div>

            {/* Main Filters Row */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <ClipboardList className="w-4 h-4" />
                  نوع التقرير
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
                    <SelectValue placeholder="اختر نوع التقرير" />
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
                  الفرع
                </Label>
                <Select value={filters.branchId || "all"} onValueChange={(v) => setFilters({ ...filters, branchId: v === "all" ? "" : v })} disabled={!canSelectBranch}>
                  <SelectTrigger className="h-11 sm:h-10" data-testid="select-branch">
                    <SelectValue placeholder="جميع الفروع" />
                  </SelectTrigger>
                  <SelectContent>
                    {canSelectBranch && <SelectItem value="all">جميع الفروع</SelectItem>}
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
                  من تاريخ
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
                  إلى تاريخ
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
                  الوردية
                </Label>
                <Select value={filters.shiftType} onValueChange={(v: any) => setFilters({ ...filters, shiftType: v })}>
                  <SelectTrigger className="h-11 sm:h-10" data-testid="select-shift-type">
                    <SelectValue placeholder="جميع الورديات" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الورديات</SelectItem>
                    <SelectItem value="morning">صباحي</SelectItem>
                    <SelectItem value="evening">مسائي</SelectItem>
                    <SelectItem value="night">ليلي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Advanced Cashier Filters Row */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 pt-3 border-t">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  الكاشير
                </Label>
                <Select value={filters.cashierId || "all"} onValueChange={(v) => setFilters({ ...filters, cashierId: v === "all" ? "" : v })}>
                  <SelectTrigger className="h-11 sm:h-10" data-testid="select-cashier">
                    <SelectValue placeholder="جميع الكاشير" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الكاشير</SelectItem>
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
                  حالة اليومية
                </Label>
                <Select value={filters.journalStatus} onValueChange={(v: any) => setFilters({ ...filters, journalStatus: v })}>
                  <SelectTrigger className="h-11 sm:h-10" data-testid="select-journal-status">
                    <SelectValue placeholder="جميع الحالات" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الحالات</SelectItem>
                    <SelectItem value="draft">مسودة</SelectItem>
                    <SelectItem value="submitted">مقدمة للمراجعة</SelectItem>
                    <SelectItem value="approved">معتمدة</SelectItem>
                    <SelectItem value="posted">مرحّلة</SelectItem>
                    <SelectItem value="rejected">مرفوضة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  حالة المطابقة
                </Label>
                <Select value={filters.discrepancyFilter} onValueChange={(v: any) => setFilters({ ...filters, discrepancyFilter: v })}>
                  <SelectTrigger className="h-11 sm:h-10" data-testid="select-discrepancy">
                    <SelectValue placeholder="الكل" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    <SelectItem value="balanced">متوازن (بدون عجز)</SelectItem>
                    <SelectItem value="shortage">عجز</SelectItem>
                    <SelectItem value="surplus">فائض</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <CreditCard className="w-4 h-4" />
                  فئة الدفع
                </Label>
                <Select value={filters.paymentCategory} onValueChange={(v: any) => setFilters({ ...filters, paymentCategory: v })}>
                  <SelectTrigger className="h-11 sm:h-10" data-testid="select-payment-category">
                    <SelectValue placeholder="جميع الفئات" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع فئات الدفع</SelectItem>
                    <SelectItem value="cash">نقدي فقط</SelectItem>
                    <SelectItem value="cards">شبكة وبطاقات</SelectItem>
                    <SelectItem value="delivery">تطبيقات التوصيل</SelectItem>
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
                  إعادة تعيين الكل
                </Button>
              </div>
            </div>

            {/* Active Filters Summary */}
            {(filters.cashierId || filters.journalStatus !== "all" || filters.discrepancyFilter !== "all" || filters.shiftType !== "all" || filters.paymentCategory !== "all") && (
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                <span className="text-xs text-muted-foreground">الفلاتر النشطة:</span>
                {filters.cashierId && (
                  <Badge variant="default" className="text-xs bg-amber-600">
                    الكاشير: {users?.find(u => u.id === filters.cashierId)?.firstName || users?.find(u => u.id === filters.cashierId)?.username || filters.cashierId}
                  </Badge>
                )}
                {filters.journalStatus !== "all" && (
                  <Badge variant="secondary" className="text-xs">
                    الحالة: {filters.journalStatus === "draft" ? "مسودة" : filters.journalStatus === "submitted" ? "مقدمة" : filters.journalStatus === "approved" ? "معتمدة" : filters.journalStatus === "posted" ? "مرحّلة" : "مرفوضة"}
                  </Badge>
                )}
                {filters.discrepancyFilter !== "all" && (
                  <Badge variant="secondary" className="text-xs">
                    المطابقة: {filters.discrepancyFilter === "balanced" ? "متوازن" : filters.discrepancyFilter === "shortage" ? "عجز" : "فائض"}
                  </Badge>
                )}
                {filters.shiftType !== "all" && (
                  <Badge variant="secondary" className="text-xs">
                    الوردية: {filters.shiftType === "morning" ? "صباحي" : filters.shiftType === "evening" ? "مسائي" : "ليلي"}
                  </Badge>
                )}
                {filters.paymentCategory !== "all" && (
                  <Badge variant="secondary" className="text-xs">
                    الدفع: {filters.paymentCategory === "cash" ? "نقدي" : filters.paymentCategory === "cards" ? "شبكة" : "توصيل"}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground mr-2">
                  ({filteredCashierJournals.length} يومية)
                </span>
              </div>
            )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : report ? (
          <>
            <QuickStatsRow report={report} cashierJournals={filteredCashierJournals} />
            
            <AlertBanner alerts={[
              ...(filteredCashierJournals.filter(j => j.discrepancyStatus === 'shortage').length > 0 
                ? [{ type: 'danger' as const, message: 'يوميات بها حالات عجز تحتاج مراجعة', count: filteredCashierJournals.filter(j => j.discrepancyStatus === 'shortage').length }] 
                : []),
              ...(filteredCashierJournals.filter(j => j.status === 'submitted').length > 0 
                ? [{ type: 'warning' as const, message: 'يوميات بانتظار الموافقة', count: filteredCashierJournals.filter(j => j.status === 'submitted').length }] 
                : []),
              ...(report.productionReport.qualityPassRate < 90 
                ? [{ type: 'warning' as const, message: `نسبة الجودة ${report.productionReport.qualityPassRate.toFixed(0)}% أقل من المستهدف 90%` }] 
                : []),
            ]} />
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className={`grid w-full max-w-4xl`} style={{ gridTemplateColumns: `repeat(${Math.min(visibleTabs.length, 6)}, 1fr)` }}>
              {visibleTabs.includes("overview") && (
                <TabsTrigger value="overview" data-testid="tab-overview" className="gap-1">
                  <PieChartIcon className="w-4 h-4" />
                  نظرة عامة
                </TabsTrigger>
              )}
              {visibleTabs.includes("sales") && (
                <TabsTrigger value="sales" data-testid="tab-sales" className="gap-1">
                  <DollarSign className="w-4 h-4" />
                  المبيعات
                </TabsTrigger>
              )}
              {visibleTabs.includes("targets") && (
                <TabsTrigger value="targets" data-testid="tab-targets" className="gap-1">
                  <Target className="w-4 h-4" />
                  الأهداف
                </TabsTrigger>
              )}
              {visibleTabs.includes("production") && (
                <TabsTrigger value="production" data-testid="tab-production" className="gap-1">
                  <Factory className="w-4 h-4" />
                  الإنتاج
                </TabsTrigger>
              )}
              {visibleTabs.includes("shifts") && (
                <TabsTrigger value="shifts" data-testid="tab-shifts" className="gap-1">
                  <Clock className="w-4 h-4" />
                  الورديات
                </TabsTrigger>
              )}
              {visibleTabs.includes("cashier") && (
                <TabsTrigger value="cashier" data-testid="tab-cashier" className="gap-1">
                  <Wallet className="w-4 h-4" />
                  الكاشير
                </TabsTrigger>
              )}
              {visibleTabs.includes("branches") && (
                <TabsTrigger value="branches" data-testid="tab-branches" className="gap-1">
                  <Building2 className="w-4 h-4" />
                  الفروع
                </TabsTrigger>
              )}
              {visibleTabs.includes("branch-overview") && (
                <TabsTrigger value="branch-overview" data-testid="tab-branch-overview" className="gap-1">
                  <Package className="w-4 h-4" />
                  نظرة عامة
                </TabsTrigger>
              )}
              {visibleTabs.includes("returns") && (
                <TabsTrigger value="returns" data-testid="tab-returns" className="gap-1">
                  <Truck className="w-4 h-4" />
                  المرتجعات
                </TabsTrigger>
              )}
              {visibleTabs.includes("discrepancies") && (
                <TabsTrigger value="discrepancies" data-testid="tab-discrepancies" className="gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  الفروقات
                </TabsTrigger>
              )}
              {visibleTabs.includes("payment-mismatch") && (
                <TabsTrigger value="payment-mismatch" data-testid="tab-payment-mismatch" className="gap-1">
                  <CreditCard className="w-4 h-4" />
                  مطابقة الدفع
                </TabsTrigger>
              )}
              {visibleTabs.includes("executive") && (
                <TabsTrigger value="executive" data-testid="tab-executive" className="gap-1">
                  <FileText className="w-4 h-4" />
                  تنفيذي
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <KPICard
                  title="إجمالي المبيعات"
                  value={formatCurrency(report.salesReport.totalSales)}
                  icon={DollarSign}
                  color="text-green-600"
                  bgColor="bg-green-100"
                  onClick={() => setActiveTab("sales")}
                />
                <KPICard
                  title="عمليات اليوم"
                  value={formatNumber(report.salesReport.totalTransactions)}
                  icon={ShoppingCart}
                  color="text-blue-600"
                  bgColor="bg-blue-100"
                />
                <KPICard
                  title="أوامر الإنتاج"
                  value={formatNumber(report.productionReport.totalOrders)}
                  icon={Package}
                  color="text-purple-600"
                  bgColor="bg-purple-100"
                  onClick={() => setActiveTab("production")}
                />
                <KPICard
                  title="نسبة الجودة"
                  value={formatPercent(report.productionReport.qualityPassRate)}
                  icon={CheckCircle}
                  color="text-emerald-600"
                  bgColor="bg-emerald-100"
                />
                <KPICard
                  title="الورديات"
                  value={formatNumber(report.shiftsReport.totalShifts)}
                  icon={Clock}
                  color="text-orange-600"
                  bgColor="bg-orange-100"
                  onClick={() => setActiveTab("shifts")}
                />
                <KPICard
                  title="يوميات الكاشير"
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
                      المبيعات اليومية
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
                          <Area type="monotone" dataKey="sales" name="المبيعات" stroke="#10B981" fillOpacity={1} fill="url(#colorSales)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <PieChartIcon className="w-5 h-5 text-blue-600" />
                      توزيع طرق الدفع
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={report.salesReport.paymentMethodBreakdown}
                            dataKey="amount"
                            nameKey="method"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            label={({ method, percent }) => 
                              `${PAYMENT_METHOD_LABELS[method] || method}: ${(percent * 100).toFixed(0)}%`
                            }
                          >
                            {report.salesReport.paymentMethodBreakdown.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => formatCurrency(value)} />
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
                    أداء الفروع
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
                        <Bar dataKey="totalSales" name="المبيعات" fill="#10B981" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sales" className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KPICard title="إجمالي المبيعات" value={formatCurrency(report.salesReport.totalSales)} icon={DollarSign} color="text-green-600" bgColor="bg-green-100" />
                <KPICard title="المبيعات النقدية" value={formatCurrency(report.salesReport.cashSales)} icon={Wallet} color="text-emerald-600" bgColor="bg-emerald-100" />
                <KPICard title="مبيعات الشبكة" value={formatCurrency(report.salesReport.networkSales)} icon={CreditCard} color="text-blue-600" bgColor="bg-blue-100" />
                <KPICard title="مبيعات التوصيل" value={formatCurrency(report.salesReport.deliverySales)} icon={Truck} color="text-purple-600" bgColor="bg-purple-100" />
                <KPICard title="إجمالي العمليات" value={formatNumber(report.salesReport.totalTransactions)} icon={ShoppingCart} color="text-indigo-600" bgColor="bg-indigo-100" />
                <KPICard title="متوسط قيمة الفاتورة" value={formatCurrency(report.salesReport.averageTicket)} icon={Target} color="text-cyan-600" bgColor="bg-cyan-100" />
                <KPICard title="إجمالي العجز" value={formatCurrency(report.salesReport.shortageAmount)} icon={TrendingDown} color="text-red-600" bgColor="bg-red-100" trendLabel={`${report.salesReport.totalShortages} حالة`} />
                <KPICard title="إجمالي الفائض" value={formatCurrency(report.salesReport.surplusAmount)} icon={TrendingUp} color="text-amber-600" bgColor="bg-amber-100" trendLabel={`${report.salesReport.totalSurpluses} حالة`} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader><CardTitle className="text-lg">المبيعات اليومية</CardTitle></CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={report.salesReport.dailySales}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" fontSize={12} />
                          <YAxis fontSize={12} />
                          <Tooltip formatter={(value: number) => formatCurrency(value)} labelFormatter={(label) => `التاريخ: ${label}`} />
                          <Legend />
                          <Line type="monotone" dataKey="sales" name="المبيعات" stroke="#10B981" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-lg">توزيع طرق الدفع</CardTitle></CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={report.salesReport.paymentMethodBreakdown} dataKey="amount" nameKey="method" cx="50%" cy="50%" outerRadius={100}
                            label={({ method, percent }) => `${PAYMENT_METHOD_LABELS[method] || method}: ${(percent * 100).toFixed(0)}%`}>
                            {report.salesReport.paymentMethodBreakdown.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader><CardTitle className="text-lg">حالة اليوميات</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={report.salesReport.journalsByStatus}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="status" fontSize={12} tickFormatter={(value) => STATUS_LABELS[value] || value} />
                        <YAxis fontSize={12} />
                        <Tooltip labelFormatter={(label) => STATUS_LABELS[label] || label} />
                        <Bar dataKey="count" name="العدد" fill="#3B82F6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="production" className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KPICard title="إجمالي الأوامر" value={formatNumber(report.productionReport.totalOrders)} icon={Package} color="text-blue-600" bgColor="bg-blue-100" />
                <KPICard title="قيد الانتظار" value={formatNumber(report.productionReport.pendingOrders)} icon={Clock} color="text-yellow-600" bgColor="bg-yellow-100" />
                <KPICard title="قيد التنفيذ" value={formatNumber(report.productionReport.inProgressOrders)} icon={Activity} color="text-orange-600" bgColor="bg-orange-100" />
                <KPICard title="مكتملة" value={formatNumber(report.productionReport.completedOrders)} icon={CheckCircle} color="text-green-600" bgColor="bg-green-100" />
                <KPICard title="ملغاة" value={formatNumber(report.productionReport.cancelledOrders)} icon={XCircle} color="text-red-600" bgColor="bg-red-100" />
                <KPICard title="الكمية المنتجة" value={formatNumber(report.productionReport.totalQuantityProduced)} icon={Factory} color="text-indigo-600" bgColor="bg-indigo-100" />
                <KPICard title="نسبة نجاح الجودة" value={formatPercent(report.productionReport.qualityPassRate)}
                  icon={report.productionReport.qualityPassRate >= 90 ? CheckCircle : AlertTriangle}
                  color={report.productionReport.qualityPassRate >= 90 ? "text-green-600" : "text-yellow-600"}
                  bgColor={report.productionReport.qualityPassRate >= 90 ? "bg-green-100" : "bg-yellow-100"} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader><CardTitle className="text-lg">الإنتاج اليومي</CardTitle></CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={report.productionReport.dailyProduction}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" fontSize={12} />
                          <YAxis fontSize={12} />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="quantity" name="الكمية" fill="#10B981" />
                          <Bar dataKey="orders" name="الأوامر" fill="#3B82F6" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-lg">نتائج فحوصات الجودة</CardTitle></CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={report.productionReport.qualityChecks} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={100}
                            label={({ status, percent }) => `${STATUS_LABELS[status] || status}: ${(percent * 100).toFixed(0)}%`}>
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
              </div>

              <Card>
                <CardHeader><CardTitle className="text-lg">الإنتاج حسب المنتج</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={report.productionReport.ordersByProduct.slice(0, 10)} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" fontSize={12} />
                        <YAxis type="category" dataKey="productName" fontSize={12} width={150} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="quantity" name="الكمية" fill="#10B981" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="shifts" className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KPICard title="إجمالي الورديات" value={formatNumber(report.shiftsReport.totalShifts)} icon={Clock} color="text-blue-600" bgColor="bg-blue-100" />
                <KPICard title="الورديات مع موظفين" value={formatNumber(report.shiftsReport.shiftsWithEmployees)} icon={Users} color="text-green-600" bgColor="bg-green-100" />
                <KPICard title="إجمالي التكليفات" value={formatNumber(report.shiftsReport.totalEmployeeAssignments)} icon={Users} color="text-indigo-600" bgColor="bg-indigo-100" />
                <KPICard title="نسبة التغطية"
                  value={report.shiftsReport.totalShifts > 0 ? formatPercent((report.shiftsReport.shiftsWithEmployees / report.shiftsReport.totalShifts) * 100) : "100%"}
                  icon={Target} color="text-purple-600" bgColor="bg-purple-100" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader><CardTitle className="text-lg">الورديات حسب النوع</CardTitle></CardHeader>
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
                  <CardHeader><CardTitle className="text-lg">الموظفين حسب الدور</CardTitle></CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={report.shiftsReport.employeesByRole}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="role" fontSize={12} />
                          <YAxis fontSize={12} />
                          <Tooltip />
                          <Bar dataKey="count" name="العدد" fill="#8B5CF6" />
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
                  يوميات الكاشير والصندوق
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
                    كشف حساب PDF
                  </Button>
                  <Button variant="outline" onClick={() => setLocation("/cashier-journals")} className="gap-2" data-testid="link-cashier-journals">
                    <ExternalLink className="w-4 h-4" />
                    عرض الكل
                  </Button>
                  <Button onClick={() => setLocation("/cashier-journals/new")} className="gap-2 bg-amber-600 hover:bg-amber-700" data-testid="link-new-journal">
                    <Receipt className="w-4 h-4" />
                    يومية جديدة
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                <KPICard title="إجمالي اليوميات" value={formatNumber(filteredCashierJournals.length)} icon={Receipt} color="text-blue-600" bgColor="bg-blue-100" />
                <KPICard title="إجمالي المبيعات" value={formatCurrency(filteredCashierJournals.reduce((sum, j) => sum + (j.totalSales || 0), 0))}
                  icon={DollarSign} color="text-green-600" bgColor="bg-green-100" />
                <KPICard title="النقدي" value={formatCurrency(filteredCashierJournals.reduce((sum, j) => sum + (j.cashTotal || 0), 0))}
                  icon={Wallet} color="text-emerald-600" bgColor="bg-emerald-100" />
                <KPICard title="الشبكة" value={formatCurrency(filteredCashierJournals.reduce((sum, j) => sum + (j.networkTotal || 0), 0))}
                  icon={CreditCard} color="text-indigo-600" bgColor="bg-indigo-100" />
                <KPICard title="حالات العجز"
                  value={formatNumber(filteredCashierJournals.filter(j => j.discrepancyStatus === 'shortage').length)}
                  icon={TrendingDown} color="text-red-600" bgColor="bg-red-100" 
                  subtitle={formatCurrency(filteredCashierJournals.filter(j => j.discrepancyStatus === 'shortage').reduce((sum, j) => sum + Math.abs(j.discrepancyAmount || 0), 0))} />
                <KPICard title="حالات الفائض"
                  value={formatNumber(filteredCashierJournals.filter(j => j.discrepancyStatus === 'surplus').length)}
                  icon={TrendingUp} color="text-amber-600" bgColor="bg-amber-100"
                  subtitle={formatCurrency(filteredCashierJournals.filter(j => j.discrepancyStatus === 'surplus').reduce((sum, j) => sum + (j.discrepancyAmount || 0), 0))} />
                <KPICard title="بانتظار الموافقة"
                  value={formatNumber(filteredCashierJournals.filter(j => j.status === 'submitted').length)}
                  icon={Clock} color="text-yellow-600" bgColor="bg-yellow-100" />
                <KPICard title="معتمدة"
                  value={formatNumber(filteredCashierJournals.filter(j => j.status === 'approved').length)}
                  icon={CheckCircle} color="text-green-600" bgColor="bg-green-100"
                  progress={filteredCashierJournals.length > 0 ? (filteredCashierJournals.filter(j => j.status === 'approved').length / filteredCashierJournals.length) * 100 : 0} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="w-4 h-4 text-green-600" />
                      أفضل الكاشيرين (حسب المبيعات)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {(() => {
                        const cashierStats = filteredCashierJournals.reduce((acc, j) => {
                          const name = j.cashierName || 'غير معروف';
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
                                <Badge variant="secondary" className="text-xs">{c.count} يومية</Badge>
                              </div>
                              <span className="text-sm font-bold text-green-600">{formatCurrency(c.sales)}</span>
                            </div>
                          ));
                      })()}
                      {filteredCashierJournals.length === 0 && <p className="text-center text-muted-foreground py-4">لا توجد بيانات</p>}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Clock className="w-4 h-4 text-purple-600" />
                      أداء الورديات
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {(() => {
                        const shiftStats = filteredCashierJournals.reduce((acc, j) => {
                          const shift = j.shiftType || 'غير محدد';
                          const label = shift === 'morning' ? 'صباحي' : shift === 'evening' ? 'مسائي' : shift === 'night' ? 'ليلي' : shift;
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
                                <Badge variant="secondary" className="text-xs">{s.count} يومية</Badge>
                              </div>
                              <span className="text-sm font-bold text-purple-600">{formatCurrency(s.sales)}</span>
                            </div>
                          ));
                      })()}
                      {filteredCashierJournals.length === 0 && <p className="text-center text-muted-foreground py-4">لا توجد بيانات</p>}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                      كاشيرين يحتاجون مراجعة
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {(() => {
                        const cashierIssues = filteredCashierJournals.reduce((acc, j) => {
                          const name = j.cashierName || 'غير معروف';
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
                                <Badge variant="destructive" className="text-xs">{c.shortages} عجز</Badge>
                              </div>
                              <span className="text-sm font-bold text-red-600">-{formatCurrency(c.shortageAmount)}</span>
                            </div>
                          ));
                      })()}
                      {filteredCashierJournals.filter(j => j.discrepancyStatus === 'shortage').length === 0 && 
                        <div className="text-center py-4">
                          <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">لا يوجد عجز في الفترة المحددة</p>
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
                      <TrendingUp className="w-4 h-4 text-blue-600" />
                      تحليل المبيعات الأسبوعي
                    </CardTitle>
                    <CardDescription>مقارنة المبيعات على مدار الأسابيع</CardDescription>
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
                            name === 'sales' ? 'المبيعات' : name === 'transactions' ? 'العمليات' : 'اليوميات'
                          ]} />
                          <Legend />
                          <Bar dataKey="sales" name="المبيعات" fill="#10B981" />
                          <Bar dataKey="journals" name="اليوميات" fill="#3B82F6" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Payment Category Breakdown */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-indigo-600" />
                      توزيع طرق الدفع
                    </CardTitle>
                    <CardDescription>تحليل المبيعات حسب فئة الدفع</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'نقدي', value: paymentCategoryStats.cash, color: '#10B981' },
                              { name: 'شبكة وبطاقات', value: paymentCategoryStats.cards, color: '#3B82F6' },
                              { name: 'تطبيقات التوصيل', value: paymentCategoryStats.delivery, color: '#F59E0B' },
                            ].filter(d => d.value > 0)}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          >
                            {[
                              { name: 'نقدي', value: paymentCategoryStats.cash, color: '#10B981' },
                              { name: 'شبكة وبطاقات', value: paymentCategoryStats.cards, color: '#3B82F6' },
                              { name: 'تطبيقات التوصيل', value: paymentCategoryStats.delivery, color: '#F59E0B' },
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
                        <span className="text-muted-foreground">نقدي: </span>
                        <span className="font-semibold">{formatCurrency(paymentCategoryStats.cash)}</span>
                      </div>
                      <div className="text-center">
                        <span className="inline-block w-3 h-3 rounded-full bg-blue-500 ml-1"></span>
                        <span className="text-muted-foreground">شبكة: </span>
                        <span className="font-semibold">{formatCurrency(paymentCategoryStats.cards)}</span>
                      </div>
                      <div className="text-center">
                        <span className="inline-block w-3 h-3 rounded-full bg-amber-500 ml-1"></span>
                        <span className="text-muted-foreground">توصيل: </span>
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
                    <Clock className="w-4 h-4 text-purple-600" />
                    مقارنة أداء الورديات
                  </CardTitle>
                  <CardDescription>تحليل شامل للمبيعات والعجز حسب الوردية</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={shiftPerformance} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" fontSize={10} />
                        <YAxis type="category" dataKey="shiftLabel" fontSize={12} width={60} />
                        <Tooltip formatter={(value: number, name: string) => [
                          name === 'المبيعات' ? formatCurrency(value) : value,
                          name
                        ]} />
                        <Legend />
                        <Bar dataKey="sales" name="المبيعات" fill="#10B981" />
                        <Bar dataKey="count" name="عدد اليوميات" fill="#3B82F6" />
                        <Bar dataKey="shortages" name="حالات العجز" fill="#EF4444" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <CardTitle className="text-lg">قائمة يوميات الكاشير</CardTitle>
                      <CardDescription>عرض وإدارة يوميات الكاشير مع إمكانية الاطلاع على التفاصيل والمرفقات</CardDescription>
                    </div>
                    <Badge variant="secondary" className="text-sm">
                      {filteredCashierJournals.length} يومية
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-right py-3 px-4">التاريخ</th>
                          <th className="text-right py-3 px-4">الفرع</th>
                          <th className="text-right py-3 px-4">الكاشير</th>
                          <th className="text-right py-3 px-4">الوردية</th>
                          <th className="text-right py-3 px-4">إجمالي المبيعات</th>
                          <th className="text-right py-3 px-4">العجز/الفائض</th>
                          <th className="text-right py-3 px-4">الحالة</th>
                          <th className="text-right py-3 px-4">الإجراءات</th>
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
                                  {DISCREPANCY_STATUS_LABELS[journal.discrepancyStatus || 'balanced']}
                                </Badge>
                              </td>
                              <td className="py-3 px-4">
                                <Badge variant={journal.status === 'approved' ? 'default' : journal.status === 'rejected' ? 'destructive' : 'secondary'}>
                                  {STATUS_LABELS[journal.status] || journal.status}
                                </Badge>
                              </td>
                              <td className="py-3 px-4">
                                <JournalDetailsDialog journal={journal} branches={branches} />
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={8} className="py-8 text-center text-muted-foreground">
                              لا توجد يوميات كاشير في الفترة المحددة
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  
                  {filteredCashierJournals.length > cashierPageSize && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <div className="text-sm text-muted-foreground">
                        عرض {((cashierPage - 1) * cashierPageSize) + 1} - {Math.min(cashierPage * cashierPageSize, filteredCashierJournals.length)} من {filteredCashierJournals.length}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCashierPage(1)}
                          disabled={cashierPage === 1}
                          data-testid="cashier-page-first"
                        >
                          الأولى
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCashierPage(p => Math.max(1, p - 1))}
                          disabled={cashierPage === 1}
                          data-testid="cashier-page-prev"
                        >
                          السابق
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
                        >
                          التالي
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCashierPage(Math.ceil(filteredCashierJournals.length / cashierPageSize))}
                          disabled={cashierPage >= Math.ceil(filteredCashierJournals.length / cashierPageSize)}
                          data-testid="cashier-page-last"
                        >
                          الأخيرة
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
                  <Target className="w-5 h-5 text-amber-600" />
                  تقرير المبيعات مقابل الأهداف - {currentYearMonth}
                </h2>
                <div className="flex gap-2">
                  <Link href="/targets-dashboard">
                    <Button variant="outline" className="gap-2" data-testid="link-targets-full">
                      <ExternalLink className="w-4 h-4" />
                      لوحة الأهداف الكاملة
                    </Button>
                  </Link>
                  <Link href="/targets-planning">
                    <Button className="gap-2 bg-amber-600 hover:bg-amber-700" data-testid="link-targets-planning">
                      <Target className="w-4 h-4" />
                      تخطيط الأهداف
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
                    <KPICard title="الهدف الإجمالي" value={formatCurrency(totalTarget)} icon={Target} color="text-blue-600" bgColor="bg-blue-100" />
                    <KPICard title="المتحقق" value={formatCurrency(totalAchieved)} icon={DollarSign} color="text-green-600" bgColor="bg-green-100" />
                    <KPICard title="نسبة التحقيق" value={formatPercent(overallPercent)} icon={TrendingUp} 
                      color={overallPercent >= 100 ? "text-green-600" : overallPercent >= 80 ? "text-amber-600" : "text-red-600"} 
                      bgColor={overallPercent >= 100 ? "bg-green-100" : overallPercent >= 80 ? "bg-amber-100" : "bg-red-100"} />
                    <KPICard title="المتبقي" value={formatCurrency(Math.max(0, totalRemaining))} icon={Target} color="text-orange-600" bgColor="bg-orange-100" />
                    <KPICard title="الأيام المتبقية" value={formatNumber(daysRemaining)} icon={Clock} color="text-purple-600" bgColor="bg-purple-100" />
                    <KPICard title="المطلوب يومياً" value={formatCurrency(Math.max(0, requiredDaily))} icon={TrendingUp} color="text-indigo-600" bgColor="bg-indigo-100" />
                    <KPICard title="فروع فوق الهدف" value={formatNumber(branchesAboveTarget)} icon={Trophy} color="text-green-600" bgColor="bg-green-100" />
                    <KPICard title="فروع تحت 80%" value={formatNumber(branchesBelowTarget)} icon={AlertTriangle} color="text-red-600" bgColor="bg-red-100" />
                  </div>
                );
              })()}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Branch Performance Comparison Chart */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-blue-600" />
                      أداء الفروع مقابل الأهداف
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
                          <Bar dataKey="target" name="الهدف" fill="#94A3B8" />
                          <Bar dataKey="achieved" name="المتحقق" fill="#10B981" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Achievement Percentage Chart */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-600" />
                      نسبة تحقيق الأهداف
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
                          <Bar dataKey="percent" name="نسبة التحقيق">
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
                      <Trophy className="w-4 h-4 text-amber-500" />
                      ترتيب الفروع
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
                              <p className="text-xs text-muted-foreground">الهدف: {formatCurrency(branch.target)}</p>
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
                        <p className="text-center text-muted-foreground py-4">لا توجد بيانات أهداف للشهر الحالي</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Projection & Forecast */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="w-4 h-4 text-purple-600" />
                      التوقعات لنهاية الشهر
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
                            <span>المتحقق: {formatCurrency(branch.achievedAmount)}</span>
                            <span>المتوقع: {formatCurrency(branch.projectedTotal)}</span>
                          </div>
                        </div>
                      ))}
                      {(!targetsProgress || targetsProgress.length === 0) && (
                        <p className="text-center text-muted-foreground py-4">لا توجد بيانات أهداف</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Details Table */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">تفاصيل أداء الفروع</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-right py-3 px-4">الفرع</th>
                          <th className="text-right py-3 px-4">الهدف</th>
                          <th className="text-right py-3 px-4">المتحقق</th>
                          <th className="text-right py-3 px-4">النسبة</th>
                          <th className="text-right py-3 px-4">المتبقي</th>
                          <th className="text-right py-3 px-4">متوسط يومي</th>
                          <th className="text-right py-3 px-4">المتوقع</th>
                          <th className="text-right py-3 px-4">الاتجاه</th>
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
                                  <TrendingUp className="w-3 h-3 ml-1" /> صاعد
                                </Badge>
                              ) : branch.trend === 'down' ? (
                                <Badge variant="destructive" className="bg-red-100 text-red-700">
                                  <TrendingDown className="w-3 h-3 ml-1" /> هابط
                                </Badge>
                              ) : (
                                <Badge variant="secondary">مستقر</Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                        {(!targetsProgress || targetsProgress.length === 0) && (
                          <tr>
                            <td colSpan={8} className="py-8 text-center text-muted-foreground">
                              لا توجد أهداف محددة للشهر الحالي
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
                <CardHeader><CardTitle className="text-lg">مقارنة المبيعات بين الفروع</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={report.branchComparison}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="branchName" fontSize={12} />
                        <YAxis fontSize={12} />
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        <Legend />
                        <Bar dataKey="totalSales" name="المبيعات" fill="#10B981" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-lg">تفاصيل أداء الفروع</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-right py-3 px-4">الفرع</th>
                          <th className="text-right py-3 px-4">المبيعات</th>
                          <th className="text-right py-3 px-4">الأوامر</th>
                          <th className="text-right py-3 px-4">نسبة الجودة</th>
                          <th className="text-right py-3 px-4">متوسط الفاتورة</th>
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
                  <Package className="w-5 h-5 text-blue-600" />
                  تقرير نظرة عامة على الفروع
                </h2>
              </div>

              {branchOverviewLoading && (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
                    <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
                    <p className="text-muted-foreground">جاري تحميل بيانات الفروع...</p>
                  </CardContent>
                </Card>
              )}

              {!branchOverviewLoading && branchOverview?.summary && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    <KPICard title="إجمالي الفروع" value={formatNumber(branchOverview.summary.totalBranches || 0)} icon={Building2} color="text-blue-600" bgColor="bg-blue-100" />
                    <KPICard title="إجمالي الأصول" value={formatNumber(branchOverview.summary.totalAssets || 0)} icon={Package} color="text-purple-600" bgColor="bg-purple-100" />
                    <KPICard title="أصول جاهزة" value={formatNumber(branchOverview.summary.totalGoodAssets || 0)} icon={CheckCircle} color="text-green-600" bgColor="bg-green-100" />
                    <KPICard title="تحتاج صيانة" value={formatNumber(branchOverview.summary.totalMaintenanceNeeded || 0)} icon={AlertTriangle} color="text-orange-600" bgColor="bg-orange-100" />
                    <KPICard title="فحص متأخر" value={formatNumber(branchOverview.summary.totalOverdueInspection || 0)} icon={Clock} color="text-red-600" bgColor="bg-red-100" />
                    <KPICard title="نسبة الجاهزية" value={formatPercent(branchOverview.summary.overallReadinessPercent || 0)} icon={Target} 
                      color={branchOverview.summary.overallReadinessPercent >= 90 ? "text-green-600" : branchOverview.summary.overallReadinessPercent >= 75 ? "text-amber-600" : "text-red-600"} 
                      bgColor={branchOverview.summary.overallReadinessPercent >= 90 ? "bg-green-100" : branchOverview.summary.overallReadinessPercent >= 75 ? "bg-amber-100" : "bg-red-100"} />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <PieChartIcon className="w-4 h-4 text-blue-600" />
                          حالة التشغيل بالفروع
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[250px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={[
                                  { name: 'ممتاز', value: branchOverview.summary.branchesExcellent || 0, fill: '#10B981' },
                                  { name: 'جيد', value: branchOverview.summary.branchesGood || 0, fill: '#3B82F6' },
                                  { name: 'يحتاج اهتمام', value: branchOverview.summary.branchesNeedAttention || 0, fill: '#F59E0B' },
                                  { name: 'حرج', value: branchOverview.summary.branchesCritical || 0, fill: '#EF4444' },
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
                          <BarChart3 className="w-4 h-4 text-green-600" />
                          جاهزية الأصول بالفروع
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[250px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={branchOverview.branches?.map(b => ({
                              name: b.branchName,
                              جاهز: b.assetReadiness.good,
                              صيانة: b.assetReadiness.maintenance,
                              تالف: b.assetReadiness.damaged,
                            })) || []} layout="vertical">
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis type="number" fontSize={10} />
                              <YAxis type="category" dataKey="name" fontSize={10} width={80} />
                              <Tooltip />
                              <Legend />
                              <Bar dataKey="جاهز" stackId="a" fill="#10B981" />
                              <Bar dataKey="صيانة" stackId="a" fill="#F59E0B" />
                              <Bar dataKey="تالف" stackId="a" fill="#EF4444" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">تفاصيل حالة الفروع</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              <th className="text-right py-3 px-4">الفرع</th>
                              <th className="text-right py-3 px-4">الحالة</th>
                              <th className="text-right py-3 px-4">الأصول</th>
                              <th className="text-right py-3 px-4">جاهز</th>
                              <th className="text-right py-3 px-4">صيانة</th>
                              <th className="text-right py-3 px-4">نسبة الجاهزية</th>
                              <th className="text-right py-3 px-4">فحص متأخر</th>
                              <th className="text-right py-3 px-4">قيمة المخزون</th>
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
                                    {branch.operationalStatus === 'excellent' ? 'ممتاز' :
                                     branch.operationalStatus === 'good' ? 'جيد' :
                                     branch.operationalStatus === 'needs_attention' ? 'يحتاج اهتمام' : 'حرج'}
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
                                <td colSpan={8} className="py-8 text-center text-muted-foreground">
                                  لا توجد بيانات فروع
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
                  const shift = j.shiftType || 'غير محدد';
                  if (!acc[shift]) acc[shift] = { count: 0, amount: 0 };
                  acc[shift].count++;
                  acc[shift].amount += j.returnAmount || 0;
                  return acc;
                }, {} as Record<string, { count: number; amount: number }>);
                
                // Group by payment method
                const returnsByPaymentMethod = journalsWithReturns.reduce((acc, j) => {
                  const method = j.returnPaymentMethod || 'غير محدد';
                  if (!acc[method]) acc[method] = { count: 0, amount: 0 };
                  acc[method].count++;
                  acc[method].amount += j.returnAmount || 0;
                  return acc;
                }, {} as Record<string, { count: number; amount: number }>);
                
                // Group by reason
                const returnsByReason = journalsWithReturns.reduce((acc, j) => {
                  const reason = j.returnReason || 'غير محدد';
                  if (!acc[reason]) acc[reason] = { count: 0, amount: 0 };
                  acc[reason].count++;
                  acc[reason].amount += j.returnAmount || 0;
                  return acc;
                }, {} as Record<string, { count: number; amount: number }>);
                
                const SHIFT_LABELS: Record<string, string> = {
                  morning: "صباحي",
                  evening: "مسائي",
                  night: "ليلي",
                  "غير محدد": "غير محدد"
                };

                // Excel export for returns
                const handleExportReturnsExcel = () => {
                  const wb = XLSX.utils.book_new();
                  
                  // Summary sheet
                  const summaryData = [
                    ["تقرير المرتجعات التحليلي - بتر بيكري"],
                    ["الفترة:", `${filters.startDate} إلى ${filters.endDate}`],
                    [],
                    ["الملخص"],
                    ["عدد عمليات المرتجع", returnsCount],
                    ["إجمالي المرتجعات", totalReturnAmount],
                    ["الفروع المتأثرة", Object.keys(returnsByBranch).length],
                    ["متوسط المرتجع", returnsCount > 0 ? totalReturnAmount / returnsCount : 0],
                  ];
                  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
                  XLSX.utils.book_append_sheet(wb, summarySheet, "الملخص");
                  
                  // By Branch sheet
                  const branchData = [
                    ["المرتجعات حسب الفرع"],
                    ["الفرع", "العدد", "المبلغ", "النسبة"],
                    ...Object.entries(returnsByBranch).map(([branch, data]) => [
                      branch, data.count, data.amount, totalReturnAmount > 0 ? `${((data.amount / totalReturnAmount) * 100).toFixed(1)}%` : "0%"
                    ])
                  ];
                  const branchSheet = XLSX.utils.aoa_to_sheet(branchData);
                  XLSX.utils.book_append_sheet(wb, branchSheet, "حسب الفرع");
                  
                  // By Shift sheet
                  const shiftData = [
                    ["المرتجعات حسب الوردية"],
                    ["الوردية", "العدد", "المبلغ"],
                    ...Object.entries(returnsByShift).map(([shift, data]) => [
                      SHIFT_LABELS[shift] || shift, data.count, data.amount
                    ])
                  ];
                  const shiftSheet = XLSX.utils.aoa_to_sheet(shiftData);
                  XLSX.utils.book_append_sheet(wb, shiftSheet, "حسب الوردية");
                  
                  // By Payment Method sheet
                  const paymentData = [
                    ["المرتجعات حسب طريقة الدفع"],
                    ["طريقة الدفع", "العدد", "المبلغ"],
                    ...Object.entries(returnsByPaymentMethod).map(([method, data]) => [
                      PAYMENT_METHOD_LABELS[method] || method, data.count, data.amount
                    ])
                  ];
                  const paymentSheet = XLSX.utils.aoa_to_sheet(paymentData);
                  XLSX.utils.book_append_sheet(wb, paymentSheet, "حسب طريقة الدفع");
                  
                  // By Reason sheet
                  const reasonData = [
                    ["المرتجعات حسب السبب"],
                    ["السبب", "العدد", "المبلغ"],
                    ...Object.entries(returnsByReason).map(([reason, data]) => [
                      reason, data.count, data.amount
                    ])
                  ];
                  const reasonSheet = XLSX.utils.aoa_to_sheet(reasonData);
                  XLSX.utils.book_append_sheet(wb, reasonSheet, "حسب السبب");
                  
                  // Details sheet
                  const detailsData = [
                    ["تفاصيل المرتجعات"],
                    ["التاريخ", "الفرع", "الكاشير", "الوردية", "مبلغ المرتجع", "طريقة الدفع", "السبب", "رقم الفاتورة"],
                    ...journalsWithReturns.map(j => [
                      j.journalDate,
                      branches?.find(b => b.id === j.branchId)?.name || j.branchId,
                      j.cashierName || '-',
                      SHIFT_LABELS[j.shiftType || ''] || j.shiftType || '-',
                      j.returnAmount || 0,
                      PAYMENT_METHOD_LABELS[j.returnPaymentMethod || ''] || j.returnPaymentMethod || '-',
                      j.returnReason || '-',
                      j.returnReference || '-'
                    ])
                  ];
                  const detailsSheet = XLSX.utils.aoa_to_sheet(detailsData);
                  XLSX.utils.book_append_sheet(wb, detailsSheet, "التفاصيل");
                  
                  XLSX.writeFile(wb, `تقرير_المرتجعات_${filters.startDate}_${filters.endDate}.xlsx`);
                };

                return (
                  <>
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Truck className="w-5 h-5 text-orange-600" />
                        تقرير المرتجعات التحليلي
                      </h2>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline"
                          className="gap-2 border-green-600 text-green-600 hover:bg-green-50" 
                          data-testid="button-export-returns-excel"
                          onClick={handleExportReturnsExcel}
                        >
                          <Download className="w-4 h-4" />
                          تصدير Excel
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
  <title>تقرير المرتجعات</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    @page { size: A4; margin: 10mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Cairo', Arial, sans-serif; direction: rtl; padding: 15px; background: white; color: #333; font-size: 10px; }
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
  <button class="print-btn" onclick="window.print()">طباعة</button>
  <div class="header">
    <div class="header-logo">
      <div class="logo-circle"><span class="logo-text">B</span></div>
      <div>
        <div class="brand">BUTTER BAKERY</div>
        <div class="title">تقرير المرتجعات التحليلي</div>
      </div>
    </div>
    <div style="text-align: left; font-size: 11px;">
      <div style="color: #8B6914; font-weight: bold;">CEO COMMAND CENTER</div>
      <div>${filters.startDate} إلى ${filters.endDate}</div>
    </div>
  </div>
  <div class="summary-grid">
    <div class="summary-card"><div class="value">${returnsCount}</div><div class="label">عدد عمليات المرتجع</div></div>
    <div class="summary-card"><div class="value amount-red">${formatCurrency(totalReturnAmount)}</div><div class="label">إجمالي المرتجعات</div></div>
    <div class="summary-card"><div class="value">${Object.keys(returnsByBranch).length}</div><div class="label">الفروع المتأثرة</div></div>
    <div class="summary-card"><div class="value">${returnsCount > 0 ? formatCurrency(totalReturnAmount / returnsCount) : formatCurrency(0)}</div><div class="label">متوسط المرتجع</div></div>
  </div>
  <div class="section">
    <div class="section-title">المرتجعات حسب الفرع</div>
    <table><thead><tr><th>الفرع</th><th>العدد</th><th>المبلغ</th><th>النسبة</th></tr></thead><tbody>
    ${Object.entries(returnsByBranch).map(([branch, data]) => `<tr><td>${branch}</td><td>${data.count}</td><td class="amount-red">${formatCurrency(data.amount)}</td><td>${totalReturnAmount > 0 ? ((data.amount / totalReturnAmount) * 100).toFixed(1) : 0}%</td></tr>`).join('')}
    </tbody></table>
  </div>
  <div class="section">
    <div class="section-title">المرتجعات حسب الوردية</div>
    <table><thead><tr><th>الوردية</th><th>العدد</th><th>المبلغ</th></tr></thead><tbody>
    ${Object.entries(returnsByShift).map(([shift, data]) => `<tr><td>${SHIFT_LABELS[shift] || shift}</td><td>${data.count}</td><td class="amount-red">${formatCurrency(data.amount)}</td></tr>`).join('')}
    </tbody></table>
  </div>
  <div class="section">
    <div class="section-title">المرتجعات حسب طريقة الدفع</div>
    <table><thead><tr><th>طريقة الدفع</th><th>العدد</th><th>المبلغ</th></tr></thead><tbody>
    ${Object.entries(returnsByPaymentMethod).map(([method, data]) => `<tr><td>${PAYMENT_METHOD_LABELS[method] || method}</td><td>${data.count}</td><td class="amount-red">${formatCurrency(data.amount)}</td></tr>`).join('')}
    </tbody></table>
  </div>
  <div class="section">
    <div class="section-title">أسباب المرتجعات</div>
    <table><thead><tr><th>السبب</th><th>العدد</th><th>المبلغ</th></tr></thead><tbody>
    ${Object.entries(returnsByReason).map(([reason, data]) => `<tr><td>${reason}</td><td>${data.count}</td><td class="amount-red">${formatCurrency(data.amount)}</td></tr>`).join('')}
    </tbody></table>
  </div>
  <div class="section">
    <div class="section-title">تفاصيل المرتجعات (${returnsCount})</div>
    <table><thead><tr><th>التاريخ</th><th>الفرع</th><th>الكاشير</th><th>الوردية</th><th>المبلغ</th><th>طريقة الدفع</th><th>السبب</th></tr></thead><tbody>
    ${journalsWithReturns.map(j => `<tr><td>${j.journalDate}</td><td>${branches?.find(b => b.id === j.branchId)?.name || j.branchId}</td><td>${j.cashierName || '-'}</td><td>${SHIFT_LABELS[j.shiftType || ''] || j.shiftType || '-'}</td><td class="amount-red">${formatCurrency(j.returnAmount || 0)}</td><td>${PAYMENT_METHOD_LABELS[j.returnPaymentMethod || ''] || j.returnPaymentMethod || '-'}</td><td>${j.returnReason || '-'}</td></tr>`).join('')}
    </tbody></table>
  </div>
  <div class="footer"><span class="brand">بتر بيكري - BUTTER BAKERY | CEO COMMAND CENTER</span><span>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-SA')}</span></div>
</body>
</html>`;
                            printHtmlContent(htmlContent);
                          }}
                        >
                          <FileDown className="w-4 h-4" />
                          تصدير PDF
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
                              <p className="text-xs text-orange-700">عدد عمليات المرتجع</p>
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
                              <p className="text-xs text-red-700">إجمالي المرتجعات</p>
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
                              <p className="text-xs text-amber-700">الفروع المتأثرة</p>
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
                              <p className="text-xs text-purple-700">متوسط المرتجع</p>
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
                              المرتجعات حسب الفرع
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
                                  <Bar dataKey="amount" name="المبلغ" fill="#ea580c" radius={[4, 4, 0, 0]} />
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
                              المرتجعات حسب الوردية
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="h-[280px]">
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie
                                    data={Object.entries(returnsByShift).map(([shift, data]) => ({ 
                                      name: SHIFT_LABELS[shift] || shift, 
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
                              المرتجعات حسب طريقة الدفع
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              {Object.entries(returnsByPaymentMethod).map(([method, data]) => (
                                <div key={method} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline">{PAYMENT_METHOD_LABELS[method] || method}</Badge>
                                    <span className="text-sm text-muted-foreground">({data.count} عملية)</span>
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
                              أسباب المرتجعات
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
                          <p className="text-muted-foreground">لا توجد مرتجعات في الفترة المحددة</p>
                        </CardContent>
                      </Card>
                    )}

                    {/* Detailed Returns Table */}
                    {returnsCount > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <FileText className="w-5 h-5 text-orange-600" />
                            تفاصيل المرتجعات ({returnsCount})
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b bg-muted/50">
                                  <th className="text-right py-3 px-4">التاريخ</th>
                                  <th className="text-right py-3 px-4">الفرع</th>
                                  <th className="text-right py-3 px-4">الكاشير</th>
                                  <th className="text-right py-3 px-4">الوردية</th>
                                  <th className="text-right py-3 px-4">مبلغ المرتجع</th>
                                  <th className="text-right py-3 px-4">طريقة الدفع</th>
                                  <th className="text-right py-3 px-4">السبب</th>
                                </tr>
                              </thead>
                              <tbody>
                                {journalsWithReturns.map((journal) => (
                                  <tr key={journal.id} className="border-b hover:bg-muted/50">
                                    <td className="py-3 px-4">{journal.journalDate}</td>
                                    <td className="py-3 px-4">{branches?.find(b => b.id === journal.branchId)?.name || journal.branchId}</td>
                                    <td className="py-3 px-4">{journal.cashierName || '-'}</td>
                                    <td className="py-3 px-4">
                                      <Badge variant="outline">{SHIFT_LABELS[journal.shiftType || ''] || journal.shiftType || '-'}</Badge>
                                    </td>
                                    <td className="py-3 px-4 font-semibold text-red-600">{formatCurrency(journal.returnAmount || 0)}</td>
                                    <td className="py-3 px-4">{PAYMENT_METHOD_LABELS[journal.returnPaymentMethod || ''] || journal.returnPaymentMethod || '-'}</td>
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
                  const cashierName = j.cashierName || 'غير محدد';
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
                  const shift = j.shiftType || 'غير محدد';
                  if (!acc[shift]) acc[shift] = { shortage: 0, surplus: 0, count: 0 };
                  acc[shift].count++;
                  if ((j.discrepancyAmount || 0) < 0) {
                    acc[shift].shortage += Math.abs(j.discrepancyAmount || 0);
                  } else {
                    acc[shift].surplus += (j.discrepancyAmount || 0);
                  }
                  return acc;
                }, {} as Record<string, { shortage: number; surplus: number; count: number }>);
                
                const SHIFT_LABELS: Record<string, string> = {
                  morning: "صباحي",
                  evening: "مسائي",
                  night: "ليلي",
                  "غير محدد": "غير محدد"
                };

                // Excel export for discrepancies
                const handleExportDiscrepanciesExcel = () => {
                  const wb = XLSX.utils.book_new();
                  
                  // Summary sheet
                  const summaryData = [
                    ["تقرير فروقات المدفوعات التحليلي - بتر بيكري"],
                    ["الفترة:", `${filters.startDate} إلى ${filters.endDate}`],
                    [],
                    ["الملخص"],
                    ["حالات العجز", shortages.length],
                    ["إجمالي العجز", totalShortageAmount],
                    ["حالات الفائض", surpluses.length],
                    ["إجمالي الفائض", totalSurplusAmount],
                    ["صافي الفروقات", netDiscrepancy],
                  ];
                  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
                  XLSX.utils.book_append_sheet(wb, summarySheet, "الملخص");
                  
                  // By Cashier sheet
                  const cashierData = [
                    ["الفروقات حسب الكاشير"],
                    ["الكاشير", "عدد الحالات", "إجمالي العجز", "إجمالي الفائض", "الصافي"],
                    ...Object.entries(discrepanciesByCashier).map(([cashier, data]) => [
                      cashier, data.count, data.shortage, data.surplus, data.surplus - data.shortage
                    ])
                  ];
                  const cashierSheet = XLSX.utils.aoa_to_sheet(cashierData);
                  XLSX.utils.book_append_sheet(wb, cashierSheet, "حسب الكاشير");
                  
                  // By Branch sheet
                  const branchData = [
                    ["الفروقات حسب الفرع"],
                    ["الفرع", "عدد الحالات", "إجمالي العجز", "إجمالي الفائض", "الصافي"],
                    ...Object.entries(discrepanciesByBranch).map(([branch, data]) => [
                      branch, data.count, data.shortage, data.surplus, data.surplus - data.shortage
                    ])
                  ];
                  const branchSheet = XLSX.utils.aoa_to_sheet(branchData);
                  XLSX.utils.book_append_sheet(wb, branchSheet, "حسب الفرع");
                  
                  // By Shift sheet
                  const shiftData = [
                    ["الفروقات حسب الوردية"],
                    ["الوردية", "عدد الحالات", "إجمالي العجز", "إجمالي الفائض", "الصافي"],
                    ...Object.entries(discrepanciesByShift).map(([shift, data]) => [
                      SHIFT_LABELS[shift] || shift, data.count, data.shortage, data.surplus, data.surplus - data.shortage
                    ])
                  ];
                  const shiftSheet = XLSX.utils.aoa_to_sheet(shiftData);
                  XLSX.utils.book_append_sheet(wb, shiftSheet, "حسب الوردية");
                  
                  // Details sheet
                  const detailsData = [
                    ["تفاصيل الفروقات"],
                    ["التاريخ", "الفرع", "الكاشير", "الوردية", "إجمالي المبيعات", "مبلغ الفرق", "الحالة", "ملاحظات"],
                    ...journalsWithDiscrepancies.map(j => [
                      j.journalDate,
                      branches?.find(b => b.id === j.branchId)?.name || j.branchId,
                      j.cashierName || '-',
                      SHIFT_LABELS[j.shiftType || ''] || j.shiftType || '-',
                      j.totalSales || 0,
                      j.discrepancyAmount || 0,
                      j.discrepancyStatus === 'shortage' ? 'عجز' : j.discrepancyStatus === 'surplus' ? 'فائض' : 'متوازن',
                      j.notes || '-'
                    ])
                  ];
                  const detailsSheet = XLSX.utils.aoa_to_sheet(detailsData);
                  XLSX.utils.book_append_sheet(wb, detailsSheet, "التفاصيل");
                  
                  XLSX.writeFile(wb, `تقرير_الفروقات_${filters.startDate}_${filters.endDate}.xlsx`);
                };

                return (
                  <>
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-red-600" />
                        تقرير فروقات المدفوعات التحليلي
                      </h2>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline"
                          className="gap-2 border-green-600 text-green-600 hover:bg-green-50" 
                          data-testid="button-export-discrepancies-excel"
                          onClick={handleExportDiscrepanciesExcel}
                        >
                          <Download className="w-4 h-4" />
                          تصدير Excel
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
  <title>تقرير فروقات المدفوعات</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    @page { size: A4; margin: 10mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Cairo', Arial, sans-serif; direction: rtl; padding: 15px; background: white; color: #333; font-size: 10px; }
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
  <button class="print-btn" onclick="window.print()">طباعة</button>
  <div class="header">
    <div class="header-logo">
      <div class="logo-circle"><span class="logo-text">B</span></div>
      <div>
        <div class="brand">BUTTER BAKERY</div>
        <div class="title">تقرير فروقات المدفوعات التحليلي</div>
      </div>
    </div>
    <div style="text-align: left; font-size: 11px;">
      <div style="color: #8B6914; font-weight: bold;">CEO COMMAND CENTER</div>
      <div style="background: #fef3c7; padding: 4px 8px; border-radius: 4px; margin-top: 4px;">
        <strong>الفترة:</strong> ${filters.startDate} إلى ${filters.endDate}
        <br/><span style="font-size: 9px; color: #92400e;">${Math.ceil((new Date(filters.endDate).getTime() - new Date(filters.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} يوم</span>
      </div>
    </div>
  </div>
  
  <!-- ملخص تحليلي شامل -->
  <div style="background: linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%); color: white; padding: 15px; border-radius: 10px; margin-bottom: 15px;">
    <div style="text-align: center; margin-bottom: 10px;">
      <span style="font-size: 14px; font-weight: bold;">📊 الملخص التحليلي الشامل</span>
    </div>
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; text-align: center;">
      <div>
        <div style="font-size: 22px; font-weight: bold; color: #fbbf24;">${journalsWithDiscrepancies.length}</div>
        <div style="font-size: 9px; opacity: 0.8;">إجمالي حالات الفروقات</div>
      </div>
      <div>
        <div style="font-size: 22px; font-weight: bold; color: #f87171;">${formatCurrency(totalShortageAmount)}</div>
        <div style="font-size: 9px; opacity: 0.8;">إجمالي العجز</div>
      </div>
      <div>
        <div style="font-size: 22px; font-weight: bold; color: #4ade80;">${formatCurrency(totalSurplusAmount)}</div>
        <div style="font-size: 9px; opacity: 0.8;">إجمالي الفائض</div>
      </div>
      <div>
        <div style="font-size: 22px; font-weight: bold; color: ${netDiscrepancy < 0 ? '#f87171' : '#4ade80'};">${formatCurrency(netDiscrepancy)}</div>
        <div style="font-size: 9px; opacity: 0.8;">صافي الفروقات</div>
      </div>
    </div>
  </div>

  <!-- مؤشرات الأداء الرئيسية -->
  <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 15px;">
    <div style="background: #fef2f2; border: 2px solid #dc2626; border-radius: 8px; padding: 12px; text-align: center;">
      <div style="font-size: 10px; color: #991b1b;">📉 متوسط العجز اليومي</div>
      <div style="font-size: 16px; font-weight: bold; color: #dc2626;">${formatCurrency(totalShortageAmount / Math.max(1, Math.ceil((new Date(filters.endDate).getTime() - new Date(filters.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1))}</div>
    </div>
    <div style="background: #dcfce7; border: 2px solid #166534; border-radius: 8px; padding: 12px; text-align: center;">
      <div style="font-size: 10px; color: #166534;">📈 متوسط الفائض اليومي</div>
      <div style="font-size: 16px; font-weight: bold; color: #166534;">${formatCurrency(totalSurplusAmount / Math.max(1, Math.ceil((new Date(filters.endDate).getTime() - new Date(filters.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1))}</div>
    </div>
    <div style="background: #fef3c7; border: 2px solid #d97706; border-radius: 8px; padding: 12px; text-align: center;">
      <div style="font-size: 10px; color: #92400e;">⚖️ نسبة العجز للفائض</div>
      <div style="font-size: 16px; font-weight: bold; color: #d97706;">${totalSurplusAmount > 0 ? (totalShortageAmount / totalSurplusAmount * 100).toFixed(0) : 0}%</div>
    </div>
  </div>

  <div class="summary-grid">
    <div class="summary-card shortage"><div class="value shortage">${shortages.length}</div><div class="label">حالات العجز</div></div>
    <div class="summary-card shortage"><div class="value shortage">${formatCurrency(totalShortageAmount)}</div><div class="label">إجمالي العجز</div></div>
    <div class="summary-card surplus"><div class="value surplus">${surpluses.length}</div><div class="label">حالات الفائض</div></div>
    <div class="summary-card surplus"><div class="value surplus">${formatCurrency(totalSurplusAmount)}</div><div class="label">إجمالي الفائض</div></div>
    <div class="summary-card ${netDiscrepancy < 0 ? 'shortage' : 'surplus'}"><div class="value ${netDiscrepancy < 0 ? 'shortage' : 'surplus'}">${formatCurrency(netDiscrepancy)}</div><div class="label">صافي الفروقات</div></div>
  </div>

  <!-- أكبر الفروقات -->
  ${journalsWithDiscrepancies.length > 0 ? `
  <div style="background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 10px; margin-bottom: 15px;">
    <div style="font-size: 11px; font-weight: bold; color: #991b1b; margin-bottom: 8px;">⚠️ أكبر 3 فروقات في الفترة:</div>
    ${[...journalsWithDiscrepancies].sort((a, b) => Math.abs(b.discrepancyAmount || 0) - Math.abs(a.discrepancyAmount || 0)).slice(0, 3).map((j, i) => `
      <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed #fca5a5; font-size: 9px;">
        <span>#${i + 1} ${j.journalDate} - ${j.cashierName || 'غير محدد'} (${branches?.find(b => b.id === j.branchId)?.name || j.branchId})</span>
        <span style="font-weight: bold; color: ${(j.discrepancyAmount || 0) < 0 ? '#dc2626' : '#166534'};">${formatCurrency(j.discrepancyAmount || 0)}</span>
      </div>
    `).join('')}
  </div>
  ` : ''}

  <div class="section">
    <div class="section-title">الفروقات حسب الكاشير</div>
    <table><thead><tr><th>الكاشير</th><th>عدد الحالات</th><th>إجمالي العجز</th><th>إجمالي الفائض</th><th>الصافي</th></tr></thead><tbody>
    ${Object.entries(discrepanciesByCashier).map(([cashier, data]) => `<tr><td>${cashier}</td><td>${data.count}</td><td class="shortage">${formatCurrency(data.shortage)}</td><td class="surplus">${formatCurrency(data.surplus)}</td><td class="${data.surplus - data.shortage < 0 ? 'shortage' : 'surplus'}">${formatCurrency(data.surplus - data.shortage)}</td></tr>`).join('')}
    </tbody></table>
  </div>
  <div class="section">
    <div class="section-title">الفروقات حسب الفرع</div>
    <table><thead><tr><th>الفرع</th><th>عدد الحالات</th><th>إجمالي العجز</th><th>إجمالي الفائض</th><th>الصافي</th></tr></thead><tbody>
    ${Object.entries(discrepanciesByBranch).map(([branch, data]) => `<tr><td>${branch}</td><td>${data.count}</td><td class="shortage">${formatCurrency(data.shortage)}</td><td class="surplus">${formatCurrency(data.surplus)}</td><td class="${data.surplus - data.shortage < 0 ? 'shortage' : 'surplus'}">${formatCurrency(data.surplus - data.shortage)}</td></tr>`).join('')}
    </tbody></table>
  </div>
  <div class="section">
    <div class="section-title">الفروقات حسب الوردية</div>
    <table><thead><tr><th>الوردية</th><th>عدد الحالات</th><th>إجمالي العجز</th><th>إجمالي الفائض</th><th>الصافي</th></tr></thead><tbody>
    ${Object.entries(discrepanciesByShift).map(([shift, data]) => `<tr><td>${SHIFT_LABELS[shift] || shift}</td><td>${data.count}</td><td class="shortage">${formatCurrency(data.shortage)}</td><td class="surplus">${formatCurrency(data.surplus)}</td><td class="${data.surplus - data.shortage < 0 ? 'shortage' : 'surplus'}">${formatCurrency(data.surplus - data.shortage)}</td></tr>`).join('')}
    </tbody></table>
  </div>
  <div class="section">
    <div class="section-title">تفاصيل الفروقات (${journalsWithDiscrepancies.length})</div>
    <table><thead><tr><th>التاريخ</th><th>الفرع</th><th>الكاشير</th><th>الوردية</th><th>المبيعات</th><th>مبلغ الفرق</th><th>الحالة</th></tr></thead><tbody>
    ${journalsWithDiscrepancies.map(j => `<tr><td>${j.journalDate}</td><td>${branches?.find(b => b.id === j.branchId)?.name || j.branchId}</td><td>${j.cashierName || '-'}</td><td>${SHIFT_LABELS[j.shiftType || ''] || j.shiftType || '-'}</td><td>${formatCurrency(j.totalSales || 0)}</td><td class="${(j.discrepancyAmount || 0) < 0 ? 'shortage' : 'surplus'}">${formatCurrency(j.discrepancyAmount || 0)}</td><td>${j.discrepancyStatus === 'shortage' ? 'عجز' : j.discrepancyStatus === 'surplus' ? 'فائض' : 'متوازن'}</td></tr>`).join('')}
    </tbody></table>
  </div>
  <div class="footer"><span class="brand">بتر بيكري - BUTTER BAKERY | CEO COMMAND CENTER</span><span>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-SA')}</span></div>
</body>
</html>`;
                            printHtmlContent(htmlContent);
                          }}
                        >
                          <FileDown className="w-4 h-4" />
                          تصدير PDF
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
                              <p className="text-xs text-red-700">حالات العجز</p>
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
                              <p className="text-xs text-red-700">إجمالي العجز</p>
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
                              <p className="text-xs text-green-700">حالات الفائض</p>
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
                              <p className="text-xs text-green-700">إجمالي الفائض</p>
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
                              <p className="text-sm font-medium">صافي الفروقات</p>
                              <p className="text-xs text-muted-foreground">الفائض - العجز = الصافي</p>
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
                              الفروقات حسب الكاشير
                            </CardTitle>
                            <CardDescription>تحليل أداء كل كاشير من حيث العجز والفائض</CardDescription>
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
                                        <Badge variant="outline" className="text-xs">{data.count} حالة</Badge>
                                      </div>
                                      <span className={`font-bold ${data.surplus - data.shortage < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        {formatCurrency(data.surplus - data.shortage)}
                                      </span>
                                    </div>
                                    <div className="flex gap-4 text-xs">
                                      <span className="text-red-600">عجز: {formatCurrency(data.shortage)}</span>
                                      <span className="text-green-600">فائض: {formatCurrency(data.surplus)}</span>
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
                              الفروقات حسب الفرع
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
                                  <Bar dataKey="shortage" name="عجز" fill="#dc2626" stackId="a" />
                                  <Bar dataKey="surplus" name="فائض" fill="#16a34a" stackId="b" />
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
                              الفروقات حسب الوردية
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="h-[250px]">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={Object.entries(discrepanciesByShift).map(([shift, data]) => ({ 
                                  shift: SHIFT_LABELS[shift] || shift, 
                                  shortage: data.shortage,
                                  surplus: data.surplus,
                                  net: data.surplus - data.shortage
                                }))}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="shift" fontSize={10} />
                                  <YAxis fontSize={10} />
                                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                  <Legend />
                                  <Bar dataKey="shortage" name="عجز" fill="#dc2626" />
                                  <Bar dataKey="surplus" name="فائض" fill="#16a34a" />
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
                              أكبر حالات الفروقات
                            </CardTitle>
                            <CardDescription>الحالات التي تحتاج متابعة فورية</CardDescription>
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
                                        {DISCREPANCY_STATUS_LABELS[journal.discrepancyStatus || 'balanced']}
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
                          <p className="text-green-700 font-medium">لا توجد فروقات في الفترة المحددة - أداء ممتاز!</p>
                        </CardContent>
                      </Card>
                    )}

                    {/* Detailed Discrepancies Table */}
                    {journalsWithDiscrepancies.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <FileText className="w-5 h-5 text-red-600" />
                            تفاصيل الفروقات ({journalsWithDiscrepancies.length})
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b bg-muted/50">
                                  <th className="text-right py-3 px-4">التاريخ</th>
                                  <th className="text-right py-3 px-4">الفرع</th>
                                  <th className="text-right py-3 px-4">الكاشير</th>
                                  <th className="text-right py-3 px-4">الوردية</th>
                                  <th className="text-right py-3 px-4">المبيعات</th>
                                  <th className="text-right py-3 px-4">مبلغ الفرق</th>
                                  <th className="text-right py-3 px-4">الحالة</th>
                                </tr>
                              </thead>
                              <tbody>
                                {journalsWithDiscrepancies.map((journal) => (
                                  <tr key={journal.id} className="border-b hover:bg-muted/50">
                                    <td className="py-3 px-4">{journal.journalDate}</td>
                                    <td className="py-3 px-4">{branches?.find(b => b.id === journal.branchId)?.name || journal.branchId}</td>
                                    <td className="py-3 px-4 font-medium">{journal.cashierName || '-'}</td>
                                    <td className="py-3 px-4">
                                      <Badge variant="outline">{SHIFT_LABELS[journal.shiftType || ''] || journal.shiftType || '-'}</Badge>
                                    </td>
                                    <td className="py-3 px-4">{formatCurrency(journal.totalSales || 0)}</td>
                                    <td className={`py-3 px-4 font-bold ${journal.discrepancyStatus === 'shortage' ? 'text-red-600' : journal.discrepancyStatus === 'surplus' ? 'text-green-600' : 'text-gray-600'}`}>
                                      {journal.discrepancyStatus === 'shortage' ? '-' : ''}{formatCurrency(Math.abs(journal.discrepancyAmount || 0))}
                                    </td>
                                    <td className="py-3 px-4">
                                      <Badge variant={journal.discrepancyStatus === 'shortage' ? 'destructive' : journal.discrepancyStatus === 'surplus' ? 'default' : 'secondary'}>
                                        {DISCREPANCY_STATUS_LABELS[journal.discrepancyStatus || 'balanced']}
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
                      تحليل مطابقة طرق الدفع (POS vs Terminal)
                    </h2>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline"
                        className="gap-2 border-red-600 text-red-600 hover:bg-red-50" 
                        data-testid="button-export-payment-mismatch-pdf"
                        onClick={() => {
                          const formatCurrencyLocal = (v: number) => new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
                          const html = `
                            <div dir="rtl" style="font-family: Cairo, sans-serif; padding: 20px;">
                              <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #6366f1; padding-bottom: 15px; margin-bottom: 20px;">
                                <div style="display: flex; align-items: center; gap: 12px;">
                                  <div style="width: 50px; height: 50px; background: linear-gradient(135deg, #D4A574 0%, #8B6914 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                                    <span style="font-size: 20px; font-weight: bold; color: #fff;">B</span>
                                  </div>
                                  <div>
                                    <div style="font-size: 14px; font-weight: bold; color: #8B6914;">BUTTER BAKERY</div>
                                    <h1 style="color: #6366f1; font-size: 18px; font-weight: bold; margin: 0;">تقرير مطابقة طرق الدفع (POS vs Terminal)</h1>
                                  </div>
                                </div>
                                <div style="text-align: left; font-size: 11px;">
                                  <div style="color: #8B6914; font-weight: bold;">CEO COMMAND CENTER</div>
                                  <div style="background: #e0e7ff; padding: 4px 8px; border-radius: 4px; margin-top: 4px;">
                                    <strong>الفترة:</strong> ${filters.startDate} إلى ${filters.endDate}
                                    <br/><span style="font-size: 9px; color: #4338ca;">${Math.ceil((new Date(filters.endDate).getTime() - new Date(filters.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} يوم</span>
                                  </div>
                                  <div style="color: #888; font-size: 10px; margin-top: 4px;">⚙️ حد الفرق المقبول: 0.50 ريال</div>
                                </div>
                              </div>

                              <!-- الملخص التحليلي الشامل -->
                              <div style="background: linear-gradient(135deg, #312e81 0%, #1e1b4b 100%); color: white; padding: 15px; border-radius: 10px; margin-bottom: 15px;">
                                <div style="text-align: center; margin-bottom: 10px;">
                                  <span style="font-size: 14px; font-weight: bold;">📊 الملخص التحليلي الشامل لمطابقة طرق الدفع</span>
                                </div>
                                <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; text-align: center;">
                                  <div>
                                    <div style="font-size: 20px; font-weight: bold; color: #a5b4fc;">${paymentMismatchData.summary.totalJournals}</div>
                                    <div style="font-size: 8px; opacity: 0.8;">إجمالي اليوميات</div>
                                  </div>
                                  <div>
                                    <div style="font-size: 20px; font-weight: bold; color: #fbbf24;">${paymentMismatchData.summary.journalsWithMismatch}</div>
                                    <div style="font-size: 8px; opacity: 0.8;">يوميات بها فروقات</div>
                                  </div>
                                  <div>
                                    <div style="font-size: 20px; font-weight: bold; color: #f87171;">${paymentMismatchData.summary.mismatchRate.toFixed(1)}%</div>
                                    <div style="font-size: 8px; opacity: 0.8;">نسبة الخطأ</div>
                                  </div>
                                  <div>
                                    <div style="font-size: 20px; font-weight: bold; color: #c084fc;">${formatCurrencyLocal(paymentMismatchData.summary.totalMismatchAmount)}</div>
                                    <div style="font-size: 8px; opacity: 0.8;">إجمالي الفروقات</div>
                                  </div>
                                  <div>
                                    <div style="font-size: 20px; font-weight: bold; color: ${paymentMismatchData.summary.journalsWithMismatch > 0 ? '#f87171' : '#4ade80'};">${paymentMismatchData.summary.journalsWithMismatch > 0 ? '⚠️' : '✅'}</div>
                                    <div style="font-size: 8px; opacity: 0.8;">الحالة</div>
                                  </div>
                                </div>
                              </div>

                              <!-- مؤشرات الأداء -->
                              <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 15px;">
                                <div style="background: #eff6ff; border: 2px solid #2563eb; border-radius: 8px; padding: 10px; text-align: center;">
                                  <div style="font-size: 9px; color: #1e40af;">💰 إجمالي POS</div>
                                  <div style="font-size: 14px; font-weight: bold; color: #1e40af;">${formatCurrencyLocal(paymentMismatchData.summary.totalPosAmount)}</div>
                                </div>
                                <div style="background: #dcfce7; border: 2px solid #166534; border-radius: 8px; padding: 10px; text-align: center;">
                                  <div style="font-size: 9px; color: #166534;">🏦 إجمالي Terminal</div>
                                  <div style="font-size: 14px; font-weight: bold; color: #166534;">${formatCurrencyLocal(paymentMismatchData.summary.totalTerminalAmount)}</div>
                                </div>
                                <div style="background: #fef2f2; border: 2px solid #dc2626; border-radius: 8px; padding: 10px; text-align: center;">
                                  <div style="font-size: 9px; color: #991b1b;">📉 الفرق الكلي</div>
                                  <div style="font-size: 14px; font-weight: bold; color: #dc2626;">${formatCurrencyLocal(Math.abs(paymentMismatchData.summary.totalPosAmount - paymentMismatchData.summary.totalTerminalAmount))}</div>
                                </div>
                                <div style="background: #fef3c7; border: 2px solid #d97706; border-radius: 8px; padding: 10px; text-align: center;">
                                  <div style="font-size: 9px; color: #92400e;">📊 متوسط الخطأ/يومية</div>
                                  <div style="font-size: 14px; font-weight: bold; color: #d97706;">${paymentMismatchData.summary.journalsWithMismatch > 0 ? formatCurrencyLocal(paymentMismatchData.summary.totalMismatchAmount / paymentMismatchData.summary.journalsWithMismatch) : '0'}</div>
                                </div>
                              </div>

                              <!-- مقارنة POS vs Terminal -->
                              <div style="background: linear-gradient(90deg, #eff6ff 0%, #dcfce7 100%); padding: 12px; border-radius: 8px; margin-bottom: 15px; display: flex; justify-content: space-around; align-items: center; border: 1px solid #94a3b8;">
                                <div style="text-align: center; flex: 1;">
                                  <div style="font-size: 10px; color: #1e40af; font-weight: bold;">💳 نظام نقاط البيع (POS)</div>
                                  <div style="font-size: 22px; font-weight: bold; color: #1e40af;">${formatCurrencyLocal(paymentMismatchData.summary.totalPosAmount)}</div>
                                </div>
                                <div style="text-align: center; padding: 0 20px;">
                                  <div style="font-size: 28px; color: #dc2626;">⚡</div>
                                  <div style="font-size: 10px; color: #dc2626; font-weight: bold;">الفرق</div>
                                  <div style="font-size: 14px; font-weight: bold; color: #dc2626;">${formatCurrencyLocal(Math.abs(paymentMismatchData.summary.totalPosAmount - paymentMismatchData.summary.totalTerminalAmount))}</div>
                                </div>
                                <div style="text-align: center; flex: 1;">
                                  <div style="font-size: 10px; color: #166534; font-weight: bold;">🏦 جهاز الدفع (Terminal)</div>
                                  <div style="font-size: 22px; font-weight: bold; color: #166534;">${formatCurrencyLocal(paymentMismatchData.summary.totalTerminalAmount)}</div>
                                </div>
                              </div>

                              ${paymentMismatchData.byCashier.length > 0 ? `
                              <!-- أكثر الكاشيرين أخطاء -->
                              <div style="background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 10px; margin-bottom: 15px;">
                                <div style="font-size: 11px; font-weight: bold; color: #991b1b; margin-bottom: 8px;">⚠️ أعلى 3 كاشيرين في أخطاء الإدخال:</div>
                                ${paymentMismatchData.byCashier.slice(0, 3).map((c, i) => `
                                  <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed #fca5a5; font-size: 9px;">
                                    <span>#${i + 1} ${c.cashierName} (${c.mismatchCount} خطأ)</span>
                                    <span style="font-weight: bold; color: #dc2626;">${formatCurrencyLocal(c.totalMismatchAmount)} | نسبة الخطأ: ${c.errorRate.toFixed(1)}%</span>
                                  </div>
                                `).join('')}
                              </div>
                              <h3 style="color: #1e3a5f; margin: 15px 0 10px; font-size: 12px; background: #f1f5f9; padding: 6px 10px; border-radius: 4px;">📋 جدول الكاشيرين الأكثر فروقات</h3>
                              <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px;">
                                <thead>
                                  <tr style="background: #f1f5f9;">
                                    <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: right;">الكاشير</th>
                                    <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: right;">عدد الفروقات</th>
                                    <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: right;">إجمالي الفروقات</th>
                                    <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: right;">نسبة الخطأ</th>
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
                              <h3 style="color: #1e3a5f; margin: 20px 0 10px;">فروقات طرق الدفع</h3>
                              <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                                <thead>
                                  <tr style="background: #f1f5f9;">
                                    <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: right;">طريقة الدفع</th>
                                    <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: right;">POS</th>
                                    <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: right;">Terminal</th>
                                    <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: right;">الفرق</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  ${paymentMismatchData.byPaymentMethod.filter(m => m.discrepancy > 0).map(m => `
                                    <tr>
                                      <td style="padding: 8px; border: 1px solid #e2e8f0;">${PAYMENT_METHOD_LABELS[m.paymentMethod] || m.paymentMethod}</td>
                                      <td style="padding: 8px; border: 1px solid #e2e8f0; color: #1e40af;">${formatCurrencyLocal(m.posTotal)}</td>
                                      <td style="padding: 8px; border: 1px solid #e2e8f0; color: #166534;">${formatCurrencyLocal(m.terminalTotal)}</td>
                                      <td style="padding: 8px; border: 1px solid #e2e8f0; color: #dc2626; font-weight: bold;">${formatCurrencyLocal(m.discrepancy)}</td>
                                    </tr>
                                  `).join('')}
                                </tbody>
                              </table>
                              ` : ''}
                              <div style="margin-top: 30px; padding-top: 15px; border-top: 2px solid #D4A574; display: flex; justify-content: space-between; align-items: center; font-size: 10px;">
                                <span style="color: #8B6914; font-weight: bold;">بتر بيكري - BUTTER BAKERY | CEO COMMAND CENTER</span>
                                <span style="color: #666;">تم إنشاء التقرير: ${new Date().toLocaleString('ar-SA')}</span>
                              </div>
                              <div style="text-align: center; margin-top: 10px; font-size: 10px; color: #666;">
                                <span style="color: #b91c1c;">● أحمر = فروقات/أخطاء</span> | 
                                <span style="color: #1e40af;">● أزرق = POS</span> | 
                                <span style="color: #166534;">● أخضر = Terminal</span>
                              </div>
                            </div>
                          `;
                          printHtmlContent(html);
                        }}
                      >
                        <Printer className="w-4 h-4" />
                        طباعة PDF
                      </Button>
                      <Button 
                        variant="outline"
                        className="gap-2 border-green-600 text-green-600 hover:bg-green-50" 
                        data-testid="button-export-payment-mismatch-excel"
                        onClick={() => {
                          const wb = XLSX.utils.book_new();
                          
                          const summaryData = [
                            ["تقرير مطابقة طرق الدفع - بتر بيكري"],
                            ["الفترة:", `${filters.startDate} إلى ${filters.endDate}`],
                            ["حد الفرق المقبول:", "0.50 ريال"],
                            [],
                            ["الملخص"],
                            ["إجمالي اليوميات", paymentMismatchData.summary.totalJournals],
                            ["يوميات بها فروقات", paymentMismatchData.summary.journalsWithMismatch],
                            ["نسبة الخطأ", `${paymentMismatchData.summary.mismatchRate.toFixed(1)}%`],
                            ["إجمالي الفروقات", paymentMismatchData.summary.totalMismatchAmount],
                            ["إجمالي POS", paymentMismatchData.summary.totalPosAmount],
                            ["إجمالي Terminal", paymentMismatchData.summary.totalTerminalAmount],
                          ];
                          const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
                          XLSX.utils.book_append_sheet(wb, summarySheet, "الملخص");
                          
                          const cashierData = [
                            ["فروقات الكاشيرين"],
                            ["الكاشير", "عدد الفروقات", "إجمالي الفروقات", "إجمالي العمليات", "نسبة الخطأ"],
                            ...paymentMismatchData.byCashier.map(c => [
                              c.cashierName, c.mismatchCount, c.totalMismatchAmount, c.totalTransactions, `${c.errorRate.toFixed(1)}%`
                            ])
                          ];
                          const cashierSheet = XLSX.utils.aoa_to_sheet(cashierData);
                          XLSX.utils.book_append_sheet(wb, cashierSheet, "حسب الكاشير");
                          
                          const methodData = [
                            ["فروقات طرق الدفع"],
                            ["طريقة الدفع", "إجمالي POS", "إجمالي Terminal", "الفرق", "عدد الفروقات", "نسبة الفرق"],
                            ...paymentMismatchData.byPaymentMethod.map(m => [
                              PAYMENT_METHOD_LABELS[m.paymentMethod] || m.paymentMethod,
                              m.posTotal,
                              m.terminalTotal,
                              m.discrepancy,
                              m.discrepancyCount,
                              `${m.discrepancyPercent.toFixed(1)}%`
                            ])
                          ];
                          const methodSheet = XLSX.utils.aoa_to_sheet(methodData);
                          XLSX.utils.book_append_sheet(wb, methodSheet, "حسب طريقة الدفع");
                          
                          const detailsData = [
                            ["تفاصيل الفروقات"],
                            ["التاريخ", "الفرع", "الكاشير", "الوردية", "المبيعات", "إجمالي الفروقات", "التفاصيل"],
                            ...paymentMismatchData.detailedMismatches.map(d => [
                              d.journalDate,
                              d.branchName,
                              d.cashierName,
                              SHIFT_LABELS[d.shiftType] || d.shiftType,
                              d.totalSales,
                              d.totalMismatchAmount,
                              d.methodMismatches.map(m => `${PAYMENT_METHOD_LABELS[m.paymentMethod] || m.paymentMethod}: POS ${m.posAmount} vs Terminal ${m.terminalAmount}`).join('; ')
                            ])
                          ];
                          const detailsSheet = XLSX.utils.aoa_to_sheet(detailsData);
                          XLSX.utils.book_append_sheet(wb, detailsSheet, "التفاصيل");
                          
                          XLSX.writeFile(wb, `تقرير_مطابقة_الدفع_${filters.startDate}_${filters.endDate}.xlsx`);
                        }}
                      >
                        <Download className="w-4 h-4" />
                        تصدير Excel
                      </Button>
                    </div>
                  </div>

                  {/* Threshold Note */}
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2 text-sm text-amber-800">
                    <AlertTriangle className="w-4 h-4" />
                    <span>حد الفرق المقبول: <strong>0.50 ريال</strong> - يتم احتساب الفروقات الأكبر من هذا الحد فقط لتجنب مشاكل التقريب</span>
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
                            <p className="text-xs text-indigo-700">إجمالي اليوميات</p>
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
                            <p className="text-xs text-orange-700">يوميات بها فروقات</p>
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
                            <p className="text-xs text-red-700">نسبة الخطأ</p>
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
                            <p className="text-xs text-purple-700">إجمالي الفروقات</p>
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
                            <p className="text-sm text-muted-foreground">إجمالي POS</p>
                            <p className="text-2xl font-bold text-blue-600">{formatCurrency(paymentMismatchData.summary.totalPosAmount)}</p>
                          </div>
                          <div className="text-3xl text-gray-400">↔</div>
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground">إجمالي Terminal</p>
                            <p className="text-2xl font-bold text-green-600">{formatCurrency(paymentMismatchData.summary.totalTerminalAmount)}</p>
                          </div>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">الفرق الكلي</p>
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
                            الكاشيرين الأكثر أخطاءً في الإدخال
                          </CardTitle>
                          <CardDescription>فروقات بين POS والتيرمنال حسب الكاشير</CardDescription>
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
                                  <span>{cashier.mismatchCount} حالة خطأ</span>
                                  <span>من {cashier.totalTransactions} عملية</span>
                                  <span className="text-red-600">نسبة الخطأ: {cashier.errorRate.toFixed(1)}%</span>
                                </div>
                                {Object.keys(cashier.methodErrors).length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {Object.entries(cashier.methodErrors).map(([method, count]) => (
                                      <Badge key={method} variant="secondary" className="text-xs">
                                        {PAYMENT_METHOD_LABELS[method] || method}: {count}
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
                            فروقات طرق الدفع
                          </CardTitle>
                          <CardDescription>مقارنة POS vs Terminal لكل طريقة دفع</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {paymentMismatchData.byPaymentMethod.filter(m => m.discrepancy > 0).map((method) => (
                              <div key={method.paymentMethod} className="p-3 bg-gray-50 rounded-lg border">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-medium">{PAYMENT_METHOD_LABELS[method.paymentMethod] || method.paymentMethod}</span>
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
                                    <p className="text-muted-foreground">الفرق</p>
                                    <p className="font-medium text-red-600">{method.discrepancyPercent.toFixed(1)}%</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                            {paymentMismatchData.byPaymentMethod.filter(m => m.discrepancy > 0).length === 0 && (
                              <div className="text-center py-8 text-muted-foreground">
                                <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                                <p>لا توجد فروقات في طرق الدفع</p>
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
                            الفروقات حسب الفرع
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
                                <Bar dataKey="totalMismatchAmount" name="إجمالي الفروقات" fill="#ef4444" radius={[0, 4, 4, 0]} />
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
                            توزيع الفروقات حسب طريقة الدفع
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="h-[250px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={paymentMismatchData.byPaymentMethod.filter(m => m.discrepancy > 0).map(m => ({
                                    name: PAYMENT_METHOD_LABELS[m.paymentMethod] || m.paymentMethod,
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
                        <p className="text-green-700 font-medium">لا توجد فروقات في طرق الدفع - تطابق ممتاز بين POS والتيرمنال!</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Detailed Mismatches Table */}
                  {paymentMismatchData.detailedMismatches.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <FileText className="w-5 h-5 text-red-600" />
                          تفاصيل الفروقات ({paymentMismatchData.detailedMismatches.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b bg-muted/50">
                                <th className="text-right py-3 px-4">التاريخ</th>
                                <th className="text-right py-3 px-4">الفرع</th>
                                <th className="text-right py-3 px-4">الكاشير</th>
                                <th className="text-right py-3 px-4">الوردية</th>
                                <th className="text-right py-3 px-4">إجمالي الفرق</th>
                                <th className="text-right py-3 px-4">تفاصيل الفروقات</th>
                              </tr>
                            </thead>
                            <tbody>
                              {paymentMismatchData.detailedMismatches.map((mismatch) => (
                                <tr key={mismatch.journalId} className="border-b hover:bg-muted/50">
                                  <td className="py-3 px-4">{mismatch.journalDate}</td>
                                  <td className="py-3 px-4">{mismatch.branchName}</td>
                                  <td className="py-3 px-4 font-medium">{mismatch.cashierName}</td>
                                  <td className="py-3 px-4">
                                    <Badge variant="outline">{SHIFT_LABELS[mismatch.shiftType] || mismatch.shiftType || '-'}</Badge>
                                  </td>
                                  <td className="py-3 px-4 font-bold text-red-600">{formatCurrency(mismatch.totalMismatchAmount)}</td>
                                  <td className="py-3 px-4">
                                    <div className="flex flex-wrap gap-1">
                                      {mismatch.methodMismatches.map((mm, idx) => (
                                        <Badge key={idx} variant="secondary" className="text-xs">
                                          {PAYMENT_METHOD_LABELS[mm.paymentMethod] || mm.paymentMethod}: 
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
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
                    <CreditCard className="w-12 h-12 text-muted-foreground" />
                    <p className="text-muted-foreground">لا توجد بيانات متاحة</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="executive" className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <FileText className="w-5 h-5 text-purple-600" />
                  التقرير التنفيذي الشامل
                </h2>
                <div className="flex gap-2">
                  <Button variant="outline" className="gap-2" data-testid="button-export-executive-excel" onClick={() => {
                    if (!executiveSummary) return;
                    const wb = XLSX.utils.book_new();
                    
                    const summaryData = [
                      ['التقرير التنفيذي الشامل'],
                      ['تاريخ التقرير:', new Date(executiveSummary.reportDate).toLocaleDateString('ar-SA')],
                      ['الفترة:', `${executiveSummary.period.startDate} إلى ${executiveSummary.period.endDate}`],
                      [],
                      ['ملخص المبيعات'],
                      ['إجمالي المبيعات', executiveSummary.salesOverview.totalSales],
                      ['المبيعات النقدية', executiveSummary.salesOverview.cashSales],
                      ['مبيعات الشبكة', executiveSummary.salesOverview.networkSales],
                      ['مبيعات التوصيل', executiveSummary.salesOverview.deliverySales],
                      ['عدد العمليات', executiveSummary.salesOverview.totalTransactions],
                      ['متوسط الفاتورة', executiveSummary.salesOverview.averageTicket],
                      [],
                      ['ملخص الإنتاج'],
                      ['إجمالي الأوامر', executiveSummary.productionOverview.totalOrders],
                      ['أوامر مكتملة', executiveSummary.productionOverview.completedOrders],
                      ['نسبة الجودة', executiveSummary.productionOverview.qualityPassRate],
                      [],
                      ['ملخص الأصول'],
                      ['إجمالي الأصول', executiveSummary.assetsOverview.totalAssets],
                      ['أصول جاهزة', executiveSummary.assetsOverview.goodAssets],
                      ['تحتاج صيانة', executiveSummary.assetsOverview.maintenanceNeeded],
                      ['نسبة الجاهزية', executiveSummary.assetsOverview.assetReadinessPercent],
                      ['قيمة المخزون', executiveSummary.assetsOverview.totalInventoryValue],
                      [],
                      ['ملخص الأهداف'],
                      ['الهدف الإجمالي', executiveSummary.targetsOverview.totalTarget],
                      ['المتحقق', executiveSummary.targetsOverview.totalAchieved],
                      ['نسبة التحقيق', executiveSummary.targetsOverview.achievementPercent],
                    ];
                    
                    const ws = XLSX.utils.aoa_to_sheet(summaryData);
                    XLSX.utils.book_append_sheet(wb, ws, 'ملخص تنفيذي');
                    
                    const branchData = [
                      ['أداء الفروع'],
                      ['الفرع', 'المبيعات', 'الأوامر', 'نسبة الجودة', 'متوسط الفاتورة'],
                      ...executiveSummary.branchPerformance.map(b => [b.branchName, b.totalSales, b.totalOrders, b.qualityPassRate, b.averageTicket])
                    ];
                    const ws2 = XLSX.utils.aoa_to_sheet(branchData);
                    XLSX.utils.book_append_sheet(wb, ws2, 'أداء الفروع');
                    
                    XLSX.writeFile(wb, `التقرير_التنفيذي_${filters.startDate}_${filters.endDate}.xlsx`);
                  }}>
                    <Download className="w-4 h-4" />
                    تصدير Excel
                  </Button>
                  <Button className="gap-2 bg-red-600 hover:bg-red-700" data-testid="button-export-executive-pdf" onClick={() => {
                    if (!executiveSummary) return;
                    const htmlContent = `
                      <html dir="rtl">
                      <head>
                        <title>التقرير التنفيذي الشامل</title>
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
                        <h1>التقرير التنفيذي الشامل - باتر بيكري</h1>
                        <p>تاريخ التقرير: ${new Date(executiveSummary.reportDate).toLocaleDateString('ar-SA')}</p>
                        <p>الفترة: ${executiveSummary.period.startDate} إلى ${executiveSummary.period.endDate}</p>
                        
                        <div class="section">
                          <h2>ملخص المبيعات</h2>
                          <div class="grid">
                            <div class="metric"><div class="metric-title">إجمالي المبيعات</div><div class="metric-value">${formatCurrency(executiveSummary.salesOverview.totalSales)}</div></div>
                            <div class="metric"><div class="metric-title">عدد العمليات</div><div class="metric-value">${formatNumber(executiveSummary.salesOverview.totalTransactions)}</div></div>
                            <div class="metric"><div class="metric-title">متوسط الفاتورة</div><div class="metric-value">${formatCurrency(executiveSummary.salesOverview.averageTicket)}</div></div>
                          </div>
                        </div>
                        
                        <div class="section">
                          <h2>ملخص الإنتاج</h2>
                          <div class="grid">
                            <div class="metric"><div class="metric-title">إجمالي الأوامر</div><div class="metric-value">${formatNumber(executiveSummary.productionOverview.totalOrders)}</div></div>
                            <div class="metric"><div class="metric-title">أوامر مكتملة</div><div class="metric-value">${formatNumber(executiveSummary.productionOverview.completedOrders)}</div></div>
                            <div class="metric"><div class="metric-title">نسبة الجودة</div><div class="metric-value">${formatPercent(executiveSummary.productionOverview.qualityPassRate)}</div></div>
                          </div>
                        </div>
                        
                        <div class="section">
                          <h2>ملخص الأصول والمخزون</h2>
                          <div class="grid">
                            <div class="metric"><div class="metric-title">إجمالي الأصول</div><div class="metric-value">${formatNumber(executiveSummary.assetsOverview.totalAssets)}</div></div>
                            <div class="metric"><div class="metric-title">نسبة الجاهزية</div><div class="metric-value">${formatPercent(executiveSummary.assetsOverview.assetReadinessPercent)}</div></div>
                            <div class="metric"><div class="metric-title">قيمة المخزون</div><div class="metric-value">${formatCurrency(executiveSummary.assetsOverview.totalInventoryValue)}</div></div>
                          </div>
                        </div>
                        
                        <div class="section">
                          <h2>تحقيق الأهداف</h2>
                          <div class="grid">
                            <div class="metric"><div class="metric-title">الهدف الإجمالي</div><div class="metric-value">${formatCurrency(executiveSummary.targetsOverview.totalTarget)}</div></div>
                            <div class="metric"><div class="metric-title">المتحقق</div><div class="metric-value">${formatCurrency(executiveSummary.targetsOverview.totalAchieved)}</div></div>
                            <div class="metric"><div class="metric-title">نسبة التحقيق</div><div class="metric-value">${formatPercent(executiveSummary.targetsOverview.achievementPercent)}</div></div>
                          </div>
                        </div>
                        
                        <div class="section">
                          <h2>أداء الفروع</h2>
                          <table>
                            <thead>
                              <tr><th>الفرع</th><th>المبيعات</th><th>الأوامر</th><th>نسبة الجودة</th><th>متوسط الفاتورة</th></tr>
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
                    تصدير PDF
                  </Button>
                </div>
              </div>

              {executiveSummaryLoading && (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
                    <RefreshCw className="w-8 h-8 text-purple-600 animate-spin" />
                    <p className="text-muted-foreground">جاري تحميل التقرير التنفيذي...</p>
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
                            <p className="text-xs text-green-700">إجمالي المبيعات</p>
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
                            <p className="text-xs text-blue-700">أوامر الإنتاج</p>
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
                            <p className="text-xs text-purple-700">قيمة المخزون</p>
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
                            <p className="text-xs text-amber-700">تحقيق الأهداف</p>
                            <p className="text-xl font-bold text-amber-800">{formatPercent(executiveSummary.targetsOverview.achievementPercent)}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">توزيع المبيعات</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[200px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={[
                                  { name: 'نقداً', value: executiveSummary.salesOverview.cashSales },
                                  { name: 'شبكة', value: executiveSummary.salesOverview.networkSales },
                                  { name: 'توصيل', value: executiveSummary.salesOverview.deliverySales },
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
                        <CardTitle className="text-base">ملخص الأداء</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">نسبة الجودة</span>
                            <div className="flex items-center gap-2">
                              <div className="w-24 bg-gray-200 rounded-full h-2">
                                <div className="bg-green-500 h-2 rounded-full" style={{ width: `${Math.min(100, executiveSummary.productionOverview.qualityPassRate)}%` }} />
                              </div>
                              <span className="font-semibold">{formatPercent(executiveSummary.productionOverview.qualityPassRate)}</span>
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">جاهزية الأصول</span>
                            <div className="flex items-center gap-2">
                              <div className="w-24 bg-gray-200 rounded-full h-2">
                                <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.min(100, executiveSummary.assetsOverview.assetReadinessPercent)}%` }} />
                              </div>
                              <span className="font-semibold">{formatPercent(executiveSummary.assetsOverview.assetReadinessPercent)}</span>
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">تحقيق الأهداف</span>
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
                      <CardTitle className="text-base">أداء الفروع</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              <th className="text-right py-3 px-4">الفرع</th>
                              <th className="text-right py-3 px-4">المبيعات</th>
                              <th className="text-right py-3 px-4">الأوامر</th>
                              <th className="text-right py-3 px-4">نسبة الجودة</th>
                              <th className="text-right py-3 px-4">متوسط الفاتورة</th>
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
                          <p className="font-semibold text-amber-800">مؤشرات رئيسية</p>
                          <p className="text-sm text-amber-700">
                            عدد الفروع النشطة: {executiveSummary.keyMetrics.totalBranches} | 
                            الكاشيرين النشطين: {executiveSummary.keyMetrics.activeCashiers} | 
                            متوسط المبيعات اليومية: {formatCurrency(executiveSummary.keyMetrics.averageDailySales)}
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
                    <p className="text-muted-foreground">لا توجد بيانات تنفيذية متاحة</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
          </>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
              <BarChart3 className="w-12 h-12 text-muted-foreground" />
              <p className="text-muted-foreground">لا توجد بيانات متاحة</p>
              <p className="text-sm text-muted-foreground">قم بتسجيل الدخول وتأكد من وجود بيانات في النظام</p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
