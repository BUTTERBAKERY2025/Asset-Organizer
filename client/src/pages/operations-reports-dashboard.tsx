import { useState } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLocation, Link } from "wouter";
import { 
  BarChart3, TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users, Factory, 
  CheckCircle, XCircle, Clock, AlertTriangle, Download, Wallet, CreditCard, Truck,
  Building2, Activity, Target, Package, FileText, Eye, Image, FileDown, Filter,
  Calendar, RefreshCw, Printer, ExternalLink, Receipt, ClipboardList, PieChart as PieChartIcon,
  Gift, Trophy
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
  
  const { data: attachments } = useQuery<JournalAttachment[]>({
    queryKey: [`/api/cashier-journals/${journal.id}/attachments`],
  });

  const { data: paymentBreakdowns } = useQuery<{ paymentMethod: string; amount: number; transactionCount: number }[]>({
    queryKey: [`/api/cashier-journals/${journal.id}/payment-breakdowns`],
  });

  const { data: journalDetails } = useQuery<{ signatures?: { signatureType: string; signerName: string; signatureData: string }[] }>({
    queryKey: [`/api/cashier-journals/${journal.id}`],
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
      <Dialog>
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
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  
  const [filters, setFilters] = useState({
    branchId: "",
    startDate: thirtyDaysAgo,
    endDate: today,
    reportType: "all",
    periodType: "custom" as "daily" | "weekly" | "monthly" | "custom",
    journalStatus: "all" as "all" | "draft" | "submitted" | "approved" | "posted" | "rejected",
    discrepancyFilter: "all" as "all" | "balanced" | "shortage" | "surplus",
    shiftType: "all" as "all" | "morning" | "evening" | "night",
    paymentCategory: "all" as "all" | "cash" | "cards" | "delivery",
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

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const queryString = new URLSearchParams({
    ...(filters.branchId && { branchId: filters.branchId }),
    ...(filters.startDate && { startDate: filters.startDate }),
    ...(filters.endDate && { endDate: filters.endDate }),
  }).toString();

  const { data: report, isLoading, refetch } = useQuery<OperationsReport>({
    queryKey: [`/api/operations/reports?${queryString}`],
  });

  const cashierQueryString = new URLSearchParams({
    ...(filters.branchId && { branchId: filters.branchId }),
    ...(filters.startDate && { startDate: filters.startDate }),
    ...(filters.endDate && { endDate: filters.endDate }),
  }).toString();

  const { data: cashierJournals } = useQuery<CashierSalesJournal[]>({
    queryKey: [`/api/cashier-journals?${cashierQueryString}`],
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

  // Apply additional client-side filters on cashier journals
  const filteredCashierJournals = (cashierJournals || []).filter(journal => {
    // Filter by journal status
    if (filters.journalStatus !== "all" && journal.status !== filters.journalStatus) {
      return false;
    }
    // Filter by discrepancy status
    if (filters.discrepancyFilter !== "all" && journal.discrepancyStatus !== filters.discrepancyFilter) {
      return false;
    }
    // Filter by shift type
    if (filters.shiftType !== "all" && journal.shiftType !== filters.shiftType) {
      return false;
    }
    // Filter by payment category - show journals that have transactions in selected category
    if (filters.paymentCategory !== "all") {
      const cashAmount = journal.cashTotal || 0;
      const cardsAmount = journal.networkTotal || 0;
      const deliveryAmount = journal.deliveryTotal || 0;
      
      if (filters.paymentCategory === "cash" && cashAmount <= 0) {
        return false;
      }
      if (filters.paymentCategory === "cards" && cardsAmount <= 0) {
        return false;
      }
      if (filters.paymentCategory === "delivery" && deliveryAmount <= 0) {
        return false;
      }
    }
    return true;
  });

  // Calculate payment category totals for filtered journals
  const paymentCategoryStats = {
    cash: filteredCashierJournals.reduce((sum, j) => sum + (j.cashTotal || 0), 0),
    cards: filteredCashierJournals.reduce((sum, j) => sum + (j.networkTotal || 0), 0),
    delivery: filteredCashierJournals.reduce((sum, j) => sum + (j.deliveryTotal || 0), 0),
  };

  // Calculate weekly comparison data with proper date handling
  const getWeeklyComparison = () => {
    const weeks: { week: string; sales: number; transactions: number; journals: number }[] = [];
    const journalsByWeek = new Map<string, typeof filteredCashierJournals>();
    
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
        
        if (!journalsByWeek.has(weekKey)) {
          journalsByWeek.set(weekKey, []);
        }
        journalsByWeek.get(weekKey)!.push(journal);
      } catch {
        return;
      }
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
  };

  // Calculate shift performance comparison
  const getShiftPerformance = () => {
    const shiftData = filteredCashierJournals.reduce((acc, j) => {
      const shift = j.shiftType || 'غير محدد';
      if (!acc[shift]) {
        acc[shift] = { shift, sales: 0, count: 0, avgTicket: 0, shortages: 0 };
      }
      acc[shift].sales += (j.totalSales || 0);
      acc[shift].count += 1;
      if (j.discrepancyStatus === 'shortage') {
        acc[shift].shortages += 1;
      }
      return acc;
    }, {} as Record<string, { shift: string; sales: number; count: number; avgTicket: number; shortages: number }>);
    
    return Object.values(shiftData).map(s => ({
      ...s,
      avgTicket: s.count > 0 ? s.sales / s.count : 0,
      shiftLabel: s.shift === 'morning' ? 'صباحي' : s.shift === 'evening' ? 'مسائي' : s.shift === 'night' ? 'ليلي' : s.shift,
    }));
  };

  const weeklyData = getWeeklyComparison();
  const shiftPerformance = getShiftPerformance();

  const getVisibleTabs = () => {
    switch (filters.reportType) {
      case "cashier":
        return ["cashier"];
      case "sales":
        return ["sales"];
      case "shifts":
        return ["shifts"];
      case "production":
        return ["production"];
      case "quality":
        return ["production"];
      default:
        return ["overview", "sales", "production", "shifts", "cashier", "branches"];
    }
  };

  const visibleTabs = getVisibleTabs();

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="page-title">
              <BarChart3 className="w-7 h-7 text-amber-600" />
              لوحة تقارير التشغيل الشاملة
            </h1>
            <p className="text-muted-foreground">تقارير تفصيلية لجميع عمليات التشغيل والإنتاج والمبيعات ويوميات الكاشير</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link href="/targets-dashboard">
              <Button variant="outline" className="gap-2" data-testid="button-targets-dashboard">
                <Trophy className="w-4 h-4 text-amber-600" />
                لوحة الأهداف
              </Button>
            </Link>
            <Link href="/targets-planning">
              <Button variant="outline" className="gap-2" data-testid="button-targets-planning">
                <Target className="w-4 h-4 text-amber-600" />
                تخطيط الأهداف
              </Button>
            </Link>
            <Link href="/incentives-management">
              <Button variant="outline" className="gap-2" data-testid="button-incentives">
                <Gift className="w-4 h-4 text-amber-600" />
                الحوافز
              </Button>
            </Link>
            <Button variant="outline" onClick={() => refetch()} className="gap-2" data-testid="button-refresh">
              <RefreshCw className="w-4 h-4" />
              تحديث
            </Button>
            <Button variant="outline" onClick={handleExportExcel} disabled={!report} className="gap-2" data-testid="button-export-excel">
              <Download className="w-4 h-4" />
              Excel
            </Button>
            <Button onClick={handleExportPDF} disabled={!report} className="gap-2 bg-amber-600 hover:bg-amber-700" data-testid="button-export-pdf">
              <FileDown className="w-4 h-4" />
              PDF
            </Button>
          </div>
        </div>

        <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="w-5 h-5 text-amber-600" />
              فلاتر التقارير المتقدمة
            </CardTitle>
            <CardDescription>فلاتر ديناميكية شاملة للتحكم في البيانات المعروضة</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
                  <SelectTrigger data-testid="select-report-type">
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
                <Select value={filters.branchId || "all"} onValueChange={(v) => setFilters({ ...filters, branchId: v === "all" ? "" : v })}>
                  <SelectTrigger data-testid="select-branch">
                    <SelectValue placeholder="جميع الفروع" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الفروع</SelectItem>
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
                  <SelectTrigger data-testid="select-shift-type">
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-3 border-t">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Receipt className="w-4 h-4" />
                  حالة اليومية
                </Label>
                <Select value={filters.journalStatus} onValueChange={(v: any) => setFilters({ ...filters, journalStatus: v })}>
                  <SelectTrigger data-testid="select-journal-status">
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
                  <SelectTrigger data-testid="select-discrepancy">
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
                  <SelectTrigger data-testid="select-payment-category">
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
                    startDate: thirtyDaysAgo, 
                    endDate: today, 
                    reportType: "all",
                    periodType: "custom",
                    journalStatus: "all",
                    discrepancyFilter: "all",
                    shiftType: "all",
                    paymentCategory: "all",
                  })}
                  className="w-full"
                  data-testid="button-reset-filters"
                >
                  إعادة تعيين الكل
                </Button>
              </div>
            </div>

            {/* Active Filters Summary */}
            {(filters.journalStatus !== "all" || filters.discrepancyFilter !== "all" || filters.shiftType !== "all" || filters.paymentCategory !== "all") && (
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                <span className="text-xs text-muted-foreground">الفلاتر النشطة:</span>
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
        </Card>

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
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-amber-600" />
                  يوميات الكاشير والصندوق
                </h2>
                <div className="flex gap-2">
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
                  <CardTitle className="text-lg">قائمة يوميات الكاشير</CardTitle>
                  <CardDescription>عرض وإدارة يوميات الكاشير مع إمكانية الاطلاع على التفاصيل والمرفقات</CardDescription>
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
                          filteredCashierJournals.slice(0, 20).map((journal) => (
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
