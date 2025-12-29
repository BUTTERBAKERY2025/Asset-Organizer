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
import { useLocation } from "wouter";
import { 
  BarChart3, TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users, Factory, 
  CheckCircle, XCircle, Clock, AlertTriangle, Download, Wallet, CreditCard, Truck,
  Building2, Activity, Target, Package, FileText, Eye, Image, FileDown, Filter,
  Calendar, RefreshCw, Printer, ExternalLink, Receipt, ClipboardList, PieChart as PieChartIcon
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area
} from "recharts";
import type { Branch, CashierSalesJournal, JournalAttachment } from "@shared/schema";
import * as XLSX from "xlsx";

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
  onClick
}: { 
  title: string; 
  value: string | number; 
  icon: React.ElementType;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  color?: string;
  bgColor?: string;
  onClick?: () => void;
}) {
  return (
    <Card 
      data-testid={`kpi-card-${title.replace(/\s+/g, '-')}`}
      className={onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground mb-1">{title}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
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
          <div className={`p-2 rounded-lg ${bgColor}`}>
            <Icon className={`w-5 h-5 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
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
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('يرجى السماح بفتح النوافذ المنبثقة لتحميل التقرير');
      return;
    }

    const logoUrl = '/attached_assets/logo_-5_1765206843638.png';
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    };

    const htmlContent = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>تقرير يومية الكاشير - ${journal.journalDate}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Cairo', sans-serif; direction: rtl; padding: 30px; background: white; color: #333; font-size: 13px; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #d4a853; padding-bottom: 20px; }
    .header .logo { max-height: 70px; margin-bottom: 10px; }
    .header h1 { font-size: 22px; color: #333; margin-bottom: 5px; }
    .header .subtitle { color: #666; font-size: 14px; }
    .header .journal-date { background: linear-gradient(135deg, #d4a853 0%, #c49843 100%); color: white; padding: 8px 20px; border-radius: 20px; display: inline-block; margin-top: 10px; font-weight: bold; }
    .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 25px; }
    .info-box { background: #f8f9fa; padding: 15px; border-radius: 10px; text-align: center; border: 1px solid #e9ecef; }
    .info-box .label { color: #666; font-size: 11px; margin-bottom: 5px; }
    .info-box .value { font-size: 16px; font-weight: bold; color: #333; }
    .section { margin-bottom: 25px; page-break-inside: avoid; }
    .section-title { font-size: 16px; font-weight: bold; color: #333; margin-bottom: 15px; padding: 10px 15px; background: linear-gradient(135deg, #d4a853 0%, #c49843 100%); color: white; border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
    th, td { border: 1px solid #ddd; padding: 12px 10px; text-align: right; }
    th { background: #f5f5f5; font-weight: 600; color: #333; }
    tr:nth-child(even) { background: #fafafa; }
    .amount { font-weight: bold; }
    .amount.positive { color: #28a745; }
    .amount.negative { color: #dc3545; }
    .status-badge { padding: 4px 12px; border-radius: 15px; font-size: 11px; font-weight: 600; display: inline-block; }
    .status-approved { background: #d4edda; color: #155724; }
    .status-pending { background: #fff3cd; color: #856404; }
    .status-rejected { background: #f8d7da; color: #721c24; }
    .status-balanced { background: #d4edda; color: #155724; }
    .status-shortage { background: #f8d7da; color: #721c24; }
    .status-surplus { background: #cce5ff; color: #004085; }
    .summary-row { background: #f8f9fa !important; font-weight: bold; }
    .reconciliation-box { background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 20px; border-radius: 10px; margin-top: 15px; }
    .reconciliation-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
    .reconciliation-item { display: flex; justify-content: space-between; padding: 10px; background: white; border-radius: 8px; border: 1px solid #dee2e6; }
    .reconciliation-item .label { color: #666; }
    .reconciliation-item .value { font-weight: bold; }
    .discrepancy-result { text-align: center; padding: 20px; background: white; border-radius: 10px; margin-top: 15px; border: 2px solid #d4a853; }
    .discrepancy-result .amount { font-size: 24px; }
    .notes-box { background: #fffbeb; padding: 15px; border-radius: 10px; border: 1px solid #fbbf24; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #d4a853; display: flex; justify-content: space-between; align-items: center; }
    .footer .company { font-weight: bold; color: #d4a853; }
    .footer .timestamp { color: #666; font-size: 11px; }
    .signature-area { margin-top: 30px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 30px; }
    .signature-box { border-top: 2px solid #333; padding-top: 10px; text-align: center; }
    .signature-box .title { font-weight: bold; margin-bottom: 40px; }
    .print-btn { position: fixed; top: 20px; left: 20px; background: #d4a853; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-family: 'Cairo', sans-serif; font-size: 14px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
    .print-btn:hover { background: #c49843; }
    @media print { .print-btn { display: none; } .signature-area { page-break-inside: avoid; } }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">طباعة / حفظ PDF</button>
  
  <div class="header">
    <img src="${logoUrl}" alt="Butter Bakery" class="logo" onerror="this.style.display='none'">
    <h1>تقرير يومية الكاشير</h1>
    <p class="subtitle">بتر بيكري - Butter Bakery</p>
    <div class="journal-date">${formatDate(journal.journalDate)}</div>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <div class="label">الفرع</div>
      <div class="value">${branchName}</div>
    </div>
    <div class="info-box">
      <div class="label">اسم الكاشير</div>
      <div class="value">${journal.cashierName}</div>
    </div>
    <div class="info-box">
      <div class="label">الوردية</div>
      <div class="value">${journal.shiftType || '-'}</div>
    </div>
    <div class="info-box">
      <div class="label">الحالة</div>
      <div class="value">
        <span class="status-badge status-${journal.status === 'approved' ? 'approved' : journal.status === 'rejected' ? 'rejected' : 'pending'}">
          ${STATUS_LABELS[journal.status] || journal.status}
        </span>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">ملخص المبيعات</div>
    <table>
      <tr>
        <th>البند</th>
        <th>المبلغ (ر.س)</th>
      </tr>
      <tr>
        <td>إجمالي المبيعات</td>
        <td class="amount positive">${(journal.totalSales || 0).toLocaleString('ar-SA')}</td>
      </tr>
      <tr>
        <td>المبيعات النقدية</td>
        <td class="amount">${(journal.cashTotal || 0).toLocaleString('ar-SA')}</td>
      </tr>
      <tr>
        <td>مبيعات الشبكة (بطاقات)</td>
        <td class="amount">${(journal.networkTotal || 0).toLocaleString('ar-SA')}</td>
      </tr>
      <tr>
        <td>مبيعات التوصيل</td>
        <td class="amount">${(journal.deliveryTotal || 0).toLocaleString('ar-SA')}</td>
      </tr>
      <tr class="summary-row">
        <td>عدد العمليات</td>
        <td>${journal.transactionCount || 0}</td>
      </tr>
      <tr class="summary-row">
        <td>عدد العملاء</td>
        <td>${journal.customerCount || 0}</td>
      </tr>
      <tr class="summary-row">
        <td>متوسط قيمة الفاتورة</td>
        <td>${(journal.averageTicket || 0).toFixed(2)} ر.س</td>
      </tr>
    </table>
  </div>

  ${paymentBreakdowns && paymentBreakdowns.length > 0 ? `
  <div class="section">
    <div class="section-title">تفصيل طرق الدفع</div>
    <table>
      <tr>
        <th>طريقة الدفع</th>
        <th>المبلغ (ر.س)</th>
        <th>عدد العمليات</th>
      </tr>
      ${paymentBreakdowns.map(p => `
        <tr>
          <td>${PAYMENT_METHOD_LABELS[p.paymentMethod] || p.paymentMethod}</td>
          <td class="amount">${(p.amount || 0).toLocaleString('ar-SA')}</td>
          <td>${p.transactionCount || 0}</td>
        </tr>
      `).join('')}
    </table>
  </div>
  ` : ''}

  <div class="section">
    <div class="section-title">مطابقة الصندوق</div>
    <div class="reconciliation-box">
      <div class="reconciliation-grid">
        <div class="reconciliation-item">
          <span class="label">رصيد الافتتاح</span>
          <span class="value">${(journal.openingBalance || 0).toLocaleString('ar-SA')} ر.س</span>
        </div>
        <div class="reconciliation-item">
          <span class="label">المبيعات النقدية</span>
          <span class="value">${(journal.cashTotal || 0).toLocaleString('ar-SA')} ر.س</span>
        </div>
        <div class="reconciliation-item">
          <span class="label">المتوقع في الصندوق</span>
          <span class="value">${(journal.expectedCash || 0).toLocaleString('ar-SA')} ر.س</span>
        </div>
        <div class="reconciliation-item">
          <span class="label">الفعلي في الصندوق</span>
          <span class="value">${(journal.actualCashDrawer || 0).toLocaleString('ar-SA')} ر.س</span>
        </div>
      </div>
      <div class="discrepancy-result">
        <p style="margin-bottom: 10px;">الفرق (العجز/الفائض)</p>
        <span class="amount ${(journal.discrepancyAmount || 0) < 0 ? 'negative' : (journal.discrepancyAmount || 0) > 0 ? 'positive' : ''}">
          ${(journal.discrepancyAmount || 0).toLocaleString('ar-SA')} ر.س
        </span>
        <span class="status-badge status-${journal.discrepancyStatus === 'balanced' ? 'balanced' : journal.discrepancyStatus === 'shortage' ? 'shortage' : 'surplus'}" style="margin-right: 10px;">
          ${DISCREPANCY_STATUS_LABELS[journal.discrepancyStatus || 'balanced']}
        </span>
      </div>
    </div>
  </div>

  ${journal.notes ? `
  <div class="section">
    <div class="section-title">ملاحظات</div>
    <div class="notes-box">
      <p>${journal.notes}</p>
    </div>
  </div>
  ` : ''}

  <div class="signature-area">
    <div class="signature-box">
      <div class="title">توقيع الكاشير</div>
      ${(() => {
        const cashierSig = journalDetails?.signatures?.find(s => s.signatureType === 'cashier');
        if (cashierSig?.signatureData) {
          return `<img src="${cashierSig.signatureData}" alt="توقيع الكاشير" style="max-width: 200px; max-height: 80px; margin: 10px auto; display: block;" />`;
        }
        return '<p style="margin-top: 40px;">________________</p>';
      })()}
      <p>${journal.cashierName}</p>
    </div>
    <div class="signature-box">
      <div class="title">توقيع المدير</div>
      ${(() => {
        const managerSig = journalDetails?.signatures?.find(s => s.signatureType === 'supervisor' || s.signatureType === 'manager');
        if (managerSig?.signatureData) {
          return `<img src="${managerSig.signatureData}" alt="توقيع المدير" style="max-width: 200px; max-height: 80px; margin: 10px auto; display: block;" /><p>${managerSig.signerName}</p>`;
        }
        return '<p style="margin-top: 40px;">________________</p>';
      })()}
    </div>
  </div>

  <div class="footer">
    <div class="company">بتر بيكري - Butter Bakery</div>
    <div class="timestamp">تم إنشاء هذا التقرير بتاريخ: ${new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
  </div>
</body>
</html>`;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
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
                      <span className="font-bold text-green-600 text-lg">{journal.totalSales?.toLocaleString('ar-SA')} ر.س</span>
                    </div>
                    <div className="flex justify-between items-center p-2 border-b">
                      <span className="text-muted-foreground">المبيعات النقدية</span>
                      <span className="font-semibold">{journal.cashTotal?.toLocaleString('ar-SA')} ر.س</span>
                    </div>
                    <div className="flex justify-between items-center p-2 border-b">
                      <span className="text-muted-foreground">مبيعات الشبكة</span>
                      <span className="font-semibold">{journal.networkTotal?.toLocaleString('ar-SA')} ر.س</span>
                    </div>
                    <div className="flex justify-between items-center p-2 border-b">
                      <span className="text-muted-foreground">مبيعات التوصيل</span>
                      <span className="font-semibold">{journal.deliveryTotal?.toLocaleString('ar-SA')} ر.س</span>
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
                      <span className="font-semibold">{journal.openingBalance?.toLocaleString('ar-SA')} ر.س</span>
                    </div>
                    <div className="flex flex-col p-3 bg-gray-50 rounded-lg">
                      <span className="text-xs text-muted-foreground">المتوقع في الصندوق</span>
                      <span className="font-semibold">{journal.expectedCash?.toLocaleString('ar-SA')} ر.س</span>
                    </div>
                    <div className="flex flex-col p-3 bg-gray-50 rounded-lg">
                      <span className="text-xs text-muted-foreground">الفعلي في الصندوق</span>
                      <span className="font-semibold">{journal.actualCashDrawer?.toLocaleString('ar-SA')} ر.س</span>
                    </div>
                    <div className={`flex flex-col p-3 rounded-lg ${journal.discrepancyStatus === 'balanced' ? 'bg-green-50 border border-green-200' : journal.discrepancyStatus === 'shortage' ? 'bg-red-50 border border-red-200' : 'bg-blue-50 border border-blue-200'}`}>
                      <span className="text-xs text-muted-foreground">الفرق</span>
                      <span className={`font-bold ${journal.discrepancyAmount && journal.discrepancyAmount < 0 ? 'text-red-600' : journal.discrepancyAmount && journal.discrepancyAmount > 0 ? 'text-green-600' : ''}`}>
                        {journal.discrepancyAmount?.toLocaleString('ar-SA')} ر.س
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
  });

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

  const { data: cashierJournals } = useQuery<CashierSalesJournal[]>({
    queryKey: ["/api/cashier-journals"],
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("ar-SA", {
      style: "currency",
      currency: "SAR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("ar-SA").format(value);
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

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('يرجى السماح بفتح النوافذ المنبثقة لتحميل التقرير');
      return;
    }

    const logoUrl = '/attached_assets/logo_-5_1765206843638.png';
    const selectedBranch = filters.branchId ? branches?.find(b => b.id === filters.branchId)?.name : 'جميع الفروع';

    const htmlContent = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>تقرير التشغيل الشامل - ${filters.startDate} إلى ${filters.endDate}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Cairo', sans-serif; direction: rtl; padding: 20px; background: white; color: #333; font-size: 12px; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #d4a853; padding-bottom: 20px; }
    .header .logo { max-height: 80px; margin-bottom: 15px; }
    .header h1 { font-size: 24px; color: #333; margin-bottom: 10px; }
    .header .subtitle { color: #666; font-size: 14px; }
    .header .date-range { background: #f5f5f5; padding: 8px 16px; border-radius: 20px; display: inline-block; margin-top: 10px; }
    .summary-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
    .summary-card { background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 15px; border-radius: 10px; text-align: center; border: 1px solid #dee2e6; }
    .summary-card .value { font-size: 20px; font-weight: bold; color: #d4a853; }
    .summary-card .label { color: #666; font-size: 11px; margin-top: 5px; }
    .section { margin-bottom: 25px; page-break-inside: avoid; }
    .section-title { font-size: 16px; font-weight: bold; color: #333; margin-bottom: 15px; padding-bottom: 8px; border-bottom: 2px solid #d4a853; display: flex; align-items: center; gap: 8px; }
    .section-title::before { content: ''; width: 4px; height: 20px; background: #d4a853; border-radius: 2px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th, td { border: 1px solid #ddd; padding: 10px 8px; text-align: right; font-size: 11px; }
    th { background: linear-gradient(135deg, #d4a853 0%, #c49843 100%); color: white; font-weight: 600; }
    tr:nth-child(even) { background: #fafafa; }
    tr:hover { background: #f5f5f5; }
    .status-badge { padding: 3px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; }
    .status-approved { background: #d4edda; color: #155724; }
    .status-pending { background: #fff3cd; color: #856404; }
    .status-rejected { background: #f8d7da; color: #721c24; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
    .kpi-item { background: #f8f9fa; padding: 12px; border-radius: 8px; border-right: 4px solid #d4a853; }
    .kpi-item .kpi-value { font-size: 18px; font-weight: bold; color: #333; }
    .kpi-item .kpi-label { font-size: 10px; color: #666; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 10px; }
    .footer .company { font-weight: bold; color: #d4a853; }
    .print-btn { position: fixed; top: 20px; left: 20px; background: #d4a853; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-family: 'Cairo', sans-serif; font-size: 14px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .print-btn:hover { background: #c49843; }
    @media print { .print-btn { display: none; } }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">طباعة / حفظ PDF</button>
  
  <div class="header">
    <img src="${logoUrl}" alt="Butter Bakery" class="logo" onerror="this.style.display='none'">
    <h1>تقرير التشغيل الشامل</h1>
    <p class="subtitle">منصة بتر بيكري لإدارة العمليات</p>
    <div class="date-range">
      <strong>الفترة:</strong> ${filters.startDate} إلى ${filters.endDate} | <strong>الفرع:</strong> ${selectedBranch}
    </div>
  </div>

  <div class="summary-cards">
    <div class="summary-card">
      <div class="value">${formatCurrency(report.salesReport.totalSales)}</div>
      <div class="label">إجمالي المبيعات</div>
    </div>
    <div class="summary-card">
      <div class="value">${formatNumber(report.salesReport.totalTransactions)}</div>
      <div class="label">إجمالي العمليات</div>
    </div>
    <div class="summary-card">
      <div class="value">${formatNumber(report.productionReport.totalOrders)}</div>
      <div class="label">أوامر الإنتاج</div>
    </div>
    <div class="summary-card">
      <div class="value">${formatPercent(report.productionReport.qualityPassRate)}</div>
      <div class="label">نسبة الجودة</div>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">تقرير المبيعات</h2>
    <div class="kpi-grid">
      <div class="kpi-item">
        <div class="kpi-value">${formatCurrency(report.salesReport.cashSales)}</div>
        <div class="kpi-label">المبيعات النقدية</div>
      </div>
      <div class="kpi-item">
        <div class="kpi-value">${formatCurrency(report.salesReport.networkSales)}</div>
        <div class="kpi-label">مبيعات الشبكة</div>
      </div>
      <div class="kpi-item">
        <div class="kpi-value">${formatCurrency(report.salesReport.deliverySales)}</div>
        <div class="kpi-label">مبيعات التوصيل</div>
      </div>
      <div class="kpi-item">
        <div class="kpi-value">${formatCurrency(report.salesReport.averageTicket)}</div>
        <div class="kpi-label">متوسط الفاتورة</div>
      </div>
    </div>
    <table>
      <tr>
        <th>البند</th>
        <th>العدد</th>
        <th>المبلغ</th>
      </tr>
      <tr>
        <td>حالات العجز</td>
        <td>${report.salesReport.totalShortages}</td>
        <td style="color: #dc3545;">${formatCurrency(report.salesReport.shortageAmount)}</td>
      </tr>
      <tr>
        <td>حالات الفائض</td>
        <td>${report.salesReport.totalSurpluses}</td>
        <td style="color: #28a745;">${formatCurrency(report.salesReport.surplusAmount)}</td>
      </tr>
    </table>
  </div>

  <div class="section">
    <h2 class="section-title">تقرير الإنتاج</h2>
    <div class="kpi-grid">
      <div class="kpi-item">
        <div class="kpi-value">${formatNumber(report.productionReport.pendingOrders)}</div>
        <div class="kpi-label">قيد الانتظار</div>
      </div>
      <div class="kpi-item">
        <div class="kpi-value">${formatNumber(report.productionReport.inProgressOrders)}</div>
        <div class="kpi-label">قيد التنفيذ</div>
      </div>
      <div class="kpi-item">
        <div class="kpi-value">${formatNumber(report.productionReport.completedOrders)}</div>
        <div class="kpi-label">مكتملة</div>
      </div>
      <div class="kpi-item">
        <div class="kpi-value">${formatNumber(report.productionReport.totalQuantityProduced)}</div>
        <div class="kpi-label">الكمية المنتجة</div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">تقرير الورديات</h2>
    <div class="kpi-grid">
      <div class="kpi-item">
        <div class="kpi-value">${formatNumber(report.shiftsReport.totalShifts)}</div>
        <div class="kpi-label">إجمالي الورديات</div>
      </div>
      <div class="kpi-item">
        <div class="kpi-value">${formatNumber(report.shiftsReport.shiftsWithEmployees)}</div>
        <div class="kpi-label">الورديات مع موظفين</div>
      </div>
      <div class="kpi-item">
        <div class="kpi-value">${formatNumber(report.shiftsReport.totalEmployeeAssignments)}</div>
        <div class="kpi-label">إجمالي التكليفات</div>
      </div>
      <div class="kpi-item">
        <div class="kpi-value">${report.shiftsReport.totalShifts > 0 ? formatPercent((report.shiftsReport.shiftsWithEmployees / report.shiftsReport.totalShifts) * 100) : '100%'}</div>
        <div class="kpi-label">نسبة التغطية</div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">مقارنة الفروع</h2>
    <table>
      <tr>
        <th>الفرع</th>
        <th>المبيعات</th>
        <th>الأوامر</th>
        <th>نسبة الجودة</th>
        <th>متوسط الفاتورة</th>
      </tr>
      ${report.branchComparison.map(b => `
        <tr>
          <td><strong>${b.branchName}</strong></td>
          <td>${formatCurrency(b.totalSales)}</td>
          <td>${formatNumber(b.totalOrders)}</td>
          <td>${formatPercent(b.qualityPassRate)}</td>
          <td>${formatCurrency(b.averageTicket)}</td>
        </tr>
      `).join('')}
    </table>
  </div>

  ${cashierJournals && cashierJournals.length > 0 ? `
  <div class="section">
    <h2 class="section-title">يوميات الكاشير الأخيرة</h2>
    <table>
      <tr>
        <th>التاريخ</th>
        <th>الفرع</th>
        <th>الكاشير</th>
        <th>إجمالي المبيعات</th>
        <th>العجز/الفائض</th>
        <th>الحالة</th>
      </tr>
      ${cashierJournals.slice(0, 10).map(j => `
        <tr>
          <td>${j.journalDate}</td>
          <td>${branches?.find(b => b.id === j.branchId)?.name || j.branchId}</td>
          <td>${j.cashierName}</td>
          <td>${formatCurrency(j.totalSales || 0)}</td>
          <td style="color: ${(j.discrepancyAmount || 0) < 0 ? '#dc3545' : (j.discrepancyAmount || 0) > 0 ? '#28a745' : 'inherit'};">
            ${formatCurrency(j.discrepancyAmount || 0)}
          </td>
          <td><span class="status-badge status-${j.status === 'approved' ? 'approved' : j.status === 'rejected' ? 'rejected' : 'pending'}">${STATUS_LABELS[j.status] || j.status}</span></td>
        </tr>
      `).join('')}
    </table>
  </div>
  ` : ''}

  <div class="footer">
    <p class="company">بتر بيكري - Butter Bakery</p>
    <p>تم إنشاء هذا التقرير بتاريخ: ${new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
  </div>
</body>
</html>`;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const filteredCashierJournals = cashierJournals?.filter(j => {
    if (filters.branchId && j.branchId !== filters.branchId) return false;
    if (filters.startDate && j.journalDate < filters.startDate) return false;
    if (filters.endDate && j.journalDate > filters.endDate) return false;
    return true;
  }) || [];

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
          <div className="flex items-center gap-2">
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
              فلاتر التقارير
            </CardTitle>
            <CardDescription>حدد نوع التقرير والفرع والفترة الزمنية</CardDescription>
          </CardHeader>
          <CardContent>
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
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
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
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  data-testid="input-end-date"
                />
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => setFilters({ branchId: "", startDate: thirtyDaysAgo, endDate: today, reportType: "all" })}
                  className="w-full"
                  data-testid="button-reset-filters"
                >
                  إعادة تعيين
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : report ? (
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

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KPICard title="إجمالي اليوميات" value={formatNumber(filteredCashierJournals.length)} icon={Receipt} color="text-blue-600" bgColor="bg-blue-100" />
                <KPICard title="إجمالي المبيعات" value={formatCurrency(filteredCashierJournals.reduce((sum, j) => sum + (j.totalSales || 0), 0))}
                  icon={DollarSign} color="text-green-600" bgColor="bg-green-100" />
                <KPICard title="حالات العجز"
                  value={formatNumber(filteredCashierJournals.filter(j => j.discrepancyStatus === 'shortage').length)}
                  icon={TrendingDown} color="text-red-600" bgColor="bg-red-100" />
                <KPICard title="حالات الفائض"
                  value={formatNumber(filteredCashierJournals.filter(j => j.discrepancyStatus === 'surplus').length)}
                  icon={TrendingUp} color="text-amber-600" bgColor="bg-amber-100" />
              </div>

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
