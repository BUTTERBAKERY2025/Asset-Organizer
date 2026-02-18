import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useBranches } from "@/hooks/useBranches";
import { useRoute, Link } from "wouter";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowRight,
  Calendar,
  DollarSign,
  Wallet,
  CreditCard,
  Truck,
  Users,
  Receipt,
  Lock,
  Unlock,
  TrendingDown,
  TrendingUp,
  Minus,
  AlertTriangle,
  CheckCircle,
  Building2,
  Landmark,
  Percent,
  Download,
} from "lucide-react";

const formatCurrency = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined) return "0.00";
  return new Intl.NumberFormat("en-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
};

const escapeHtml = (str: string | null | undefined): string => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary"; icon: any }> = {
  open: { label: "مفتوح", variant: "secondary", icon: Unlock },
  closed: { label: "مغلق", variant: "default", icon: Lock },
};

const DISCREPANCY_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  balanced: { label: "متوازن", color: "text-green-600 bg-green-50", icon: CheckCircle },
  shortage: { label: "عجز", color: "text-red-600 bg-red-50", icon: TrendingDown },
  surplus: { label: "زيادة", color: "text-amber-600 bg-amber-50", icon: TrendingUp },
};

const BANK_COMMISSION_RATES: Record<string, { label: string; rate: number }> = {
  mada: { label: "مدى (Mada)", rate: 0.728 },
  visa: { label: "فيزا (Visa)", rate: 1.8025 },
  mastercard: { label: "ماستركارد (MasterCard)", rate: 1.8025 },
  card: { label: "بطاقة ائتمان", rate: 1.8025 },
  apple_pay: { label: "Apple Pay", rate: 1.8025 },
  stc_pay: { label: "STC Pay", rate: 0.728 },
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "نقداً",
  card: "بطاقة ائتمان",
  mada: "مدى",
  visa: "فيزا",
  mastercard: "ماستركارد",
  apple_pay: "Apple Pay",
  stc_pay: "STC Pay",
  hunger_station: "هنقرستيشن",
  toyou: "ToYou",
  jahez: "جاهز",
  marsool: "مرسول",
  keeta: "كيتا",
  the_chefs: "ذا شيفز",
  other: "أخرى",
};

export default function BranchDailyClosureDetailPage() {
  const [, params] = useRoute("/branch-daily-closures/:id");
  const closureId = params?.id;
  const { user } = useAuth();
  const { branches } = useBranches();

  const { data: closure, isLoading } = useQuery<any>({
    queryKey: [`/api/branch-daily-closures/${closureId}`],
    enabled: !!closureId,
  });

  const branchName = branches?.find((b: any) => b.id === closure?.branchId)?.name || closure?.branchId;

  const exportBankCommissionExcel = async () => {
    const XLSX = await import("xlsx");
    if (!closure) return;

    const bankPayments = (closure.payments || []).filter((p: any) => BANK_COMMISSION_RATES[p.paymentMethod]);
    if (bankPayments.length === 0) return;

    const rows: any[][] = [];

    rows.push(["شركة الزبد الأفضل التجارية - BUTTER BAKERY"]);
    rows.push(["بيان عمولة البنك - القيد المحاسبي"]);
    rows.push([]);

    rows.push(["الفرع:", branchName || "", "", "تاريخ الإغلاق:", closure.closureDate]);
    rows.push(["تاريخ التصدير:", new Date().toLocaleDateString("en-GB"), "", "حالة الإغلاق:", closure.status === 'closed' ? 'مغلق' : 'مفتوح']);
    rows.push([]);

    rows.push(["تفاصيل عمولة البنك حسب طرق الدفع"]);
    rows.push([]);

    rows.push(["طريقة الدفع", "مبلغ Terminal البنك (ر.س)", "نسبة العمولة %", "مبلغ العمولة (ر.س)", "صافي المحصّل (ر.س)"]);

    let totalTerminal = 0;
    let totalComm = 0;
    let totalNet = 0;

    bankPayments.forEach((p: any) => {
      const config = BANK_COMMISSION_RATES[p.paymentMethod];
      const terminalAmount = p.totalTerminalAmount || 0;
      const commission = (terminalAmount * config.rate) / 100;
      const netAmount = terminalAmount - commission;
      totalTerminal += terminalAmount;
      totalComm += commission;
      totalNet += netAmount;
      rows.push([
        config.label,
        Math.round(terminalAmount * 100) / 100,
        config.rate + "%",
        Math.round(commission * 100) / 100,
        Math.round(netAmount * 100) / 100,
      ]);
    });

    rows.push([
      "الإجمالي",
      Math.round(totalTerminal * 100) / 100,
      "",
      Math.round(totalComm * 100) / 100,
      Math.round(totalNet * 100) / 100,
    ]);

    rows.push([]);
    rows.push([]);

    const accountingTitleRow = rows.length;
    rows.push(["ملخص القيد المحاسبي"]);
    rows.push([]);
    rows.push(["البيان", "مدين (ر.س)", "دائن (ر.س)"]);
    rows.push(["البنك (صافي المحصّل)", Math.round(totalNet * 100) / 100, ""]);
    rows.push(["عمولة البنك (مصروف)", Math.round(totalComm * 100) / 100, ""]);
    rows.push(["المبيعات (إجمالي Terminal البنك)", "", Math.round(totalTerminal * 100) / 100]);
    rows.push([]);
    rows.push(["إجمالي القيد", Math.round((totalNet + totalComm) * 100) / 100, Math.round(totalTerminal * 100) / 100]);

    const ws = XLSX.utils.aoa_to_sheet(rows);

    ws["!cols"] = [
      { wch: 35 },
      { wch: 25 },
      { wch: 18 },
      { wch: 22 },
      { wch: 22 },
    ];

    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
      { s: { r: 6, c: 0 }, e: { r: 6, c: 4 } },
      { s: { r: accountingTitleRow, c: 0 }, e: { r: accountingTitleRow, c: 4 } },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "عمولة البنك");

    const fileName = `بيان_عمولة_البنك_${branchName || closure.branchId}_${closure.closureDate}`;
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  };

  const exportClosurePdf = () => {
    if (!closure) return;
    const cardMethods = ['mada', 'visa', 'mastercard', 'amex', 'card_other', 'card', 'apple_pay', 'stc_pay'];
    const today = new Date().toLocaleDateString('en-GB');
    const closureDateFormatted = closure.closureDate;
    const statusLabel = closure.status === 'closed' ? 'مغلق' : 'مفتوح';
    const totalTx = closure.totalTransactionCount || 0;
    const avgTicket = totalTx > 0 ? (closure.totalSales || 0) / totalTx : 0;

    const journalRows = (closure.journals || []).map((j: any) => {
      const shiftLabel = j.shiftType === 'morning' ? 'صباحي' : j.shiftType === 'evening' ? 'مسائي' : j.shiftType === 'night' ? 'ليلي' : (j.shiftType || '-');
      const expectedCash = (j.expectedCash != null && j.expectedCash !== 0) ? j.expectedCash : ((j.openingBalance || 0) + (j.cashTotal || 0));
      const cashDisc = (j.actualCashDrawer || 0) - expectedCash;
      const bankDisc = j.computedBankDiscrepancy ?? j.bankDiscrepancyTotal ?? 0;
      const netDisc = cashDisc + bankDisc;
      const statusText = j.status === 'approved' ? 'معتمدة' : j.status === 'submitted' ? 'مقدمة' : j.status === 'draft' ? 'مسودة' : j.status === 'posted' ? 'مرحّلة' : (j.status || '-');
      return `<tr>
        <td>${escapeHtml(j.cashierName) || '-'}</td>
        <td>${escapeHtml(shiftLabel)}</td>
        <td>${formatCurrency(j.totalSales)}</td>
        <td>${formatCurrency(j.cashTotal)}</td>
        <td>${formatCurrency(j.networkTotal)}</td>
        <td class="${cashDisc > 0.5 ? 'text-orange' : cashDisc < -0.5 ? 'text-red' : 'text-green'}">${formatCurrency(cashDisc)}</td>
        <td class="${bankDisc > 0.5 ? 'text-orange' : bankDisc < -0.5 ? 'text-red' : 'text-green'}">${formatCurrency(bankDisc)}</td>
        <td class="bold ${netDisc > 0.5 ? 'text-orange' : netDisc < -0.5 ? 'text-red' : 'text-green'}">${formatCurrency(netDisc)}</td>
        <td>${escapeHtml(statusText)}</td>
      </tr>`;
    }).join('');

    const totalCashDisc = (closure.journals || []).reduce((s: number, j: any) => {
      const exp = (j.expectedCash != null && j.expectedCash !== 0) ? j.expectedCash : ((j.openingBalance || 0) + (j.cashTotal || 0));
      return s + ((j.actualCashDrawer || 0) - exp);
    }, 0);
    const totalBankDisc = (closure.journals || []).reduce((s: number, j: any) => s + (j.computedBankDiscrepancy ?? j.bankDiscrepancyTotal ?? 0), 0);
    const totalNetDisc = totalCashDisc + totalBankDisc;

    const paymentRows = (closure.payments || []).map((p: any) => {
      const methodLabel = PAYMENT_METHOD_LABELS[p.paymentMethod] || p.paymentMethod;
      const isCard = cardMethods.includes(p.paymentMethod);
      const posAmt = p.totalPosAmount || p.totalAmount || 0;
      const termAmt = p.totalTerminalAmount || 0;
      const disc = isCard ? (termAmt - posAmt) : 0;
      return `<tr>
        <td>${escapeHtml(methodLabel)}</td>
        <td>${formatCurrency(p.totalAmount || 0)}</td>
        <td>${isCard ? formatCurrency(posAmt) : '-'}</td>
        <td>${isCard ? formatCurrency(termAmt) : '-'}</td>
        <td class="${disc > 0.5 ? 'text-orange' : disc < -0.5 ? 'text-red' : 'text-green'}">${isCard ? formatCurrency(disc) : '-'}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>بيان الإغلاق اليومي - ${escapeHtml(branchName)} - ${escapeHtml(closureDateFormatted)}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
        * { font-family: 'Cairo', 'Arial', sans-serif; direction: rtl; box-sizing: border-box; margin: 0; padding: 0; }
        body { padding: 15px; font-size: 10px; background: white; color: #333; }
        .header { display: flex; justify-content: space-between; border-bottom: 3px solid #D4AF37; padding-bottom: 10px; margin-bottom: 12px; }
        .company-name { font-size: 16px; font-weight: bold; color: #D4AF37; }
        .company-name-en { font-size: 10px; color: #666; }
        .sub-text { font-size: 9px; color: #888; }
        .report-title { font-size: 14px; font-weight: bold; color: #333; }
        .section-header { background: #f8f9fa; padding: 6px 10px; font-weight: bold; font-size: 11px; margin: 10px 0 6px; border-right: 4px solid #D4AF37; }
        .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 10px; }
        .kpi-box { background: #f8f9fa; border-radius: 6px; padding: 6px; text-align: center; border: 1px solid #eee; }
        .kpi-label { font-size: 9px; color: #888; margin-bottom: 2px; }
        .kpi-value { font-size: 13px; font-weight: bold; }
        .kpi-green { color: #28a745; }
        .kpi-blue { color: #4f46e5; }
        .kpi-emerald { color: #059669; }
        .kpi-amber { color: #d97706; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 9px; }
        th { background: #f3f4f6; padding: 4px 3px; border: 1px solid #ddd; font-weight: bold; text-align: center; }
        td { padding: 3px 3px; border: 1px solid #ddd; text-align: center; }
        .text-right { text-align: right; }
        .text-green { color: #28a745; }
        .text-red { color: #dc3545; }
        .text-orange { color: #d97706; }
        .bold { font-weight: bold; }
        .totals-row { background: #f0f0f0; font-weight: bold; }
        .status-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 9px; font-weight: bold; }
        .status-open { background: #fff3cd; color: #856404; }
        .status-closed { background: #d4edda; color: #155724; }
        .footer { text-align: center; margin-top: 15px; font-size: 9px; color: #aaa; border-top: 1px solid #eee; padding-top: 6px; }
        .footer-line2 { font-size: 8px; color: #bbb; margin-top: 2px; }
        @media print { body { padding: 0; } @page { margin: 0.7cm; size: A4 landscape; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="company-name">شركة الزبد الأفضل التجارية</div>
          <div class="company-name-en">Best Butter Trading Co.</div>
          <div class="sub-text">سجل تجاري: 7026155296</div>
        </div>
        <div style="text-align: left;">
          <div class="report-title">بيان الإغلاق اليومي</div>
          <div>الفرع: ${escapeHtml(branchName)}</div>
          <div>التاريخ: ${escapeHtml(closureDateFormatted)}</div>
          <div>الحالة: <span class="status-badge ${closure.status === 'closed' ? 'status-closed' : 'status-open'}">${statusLabel}</span></div>
          <div class="sub-text">تاريخ التصدير: ${today}</div>
        </div>
      </div>

      <div class="section-header">ملخص الإغلاق اليومي</div>
      <div style="display:grid;grid-template-columns:repeat(8,1fr);gap:5px;margin-bottom:10px;">
        <div class="kpi-box">
          <div class="kpi-label">إجمالي المبيعات</div>
          <div class="kpi-value kpi-green" style="font-size:11px;">${formatCurrency(closure.totalSales)} ر.س</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-label">النقدي</div>
          <div class="kpi-value kpi-emerald" style="font-size:11px;">${formatCurrency(closure.cashTotal)} ر.س</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-label">الشبكة</div>
          <div class="kpi-value kpi-blue" style="font-size:11px;">${formatCurrency(closure.networkTotal)} ر.س</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-label">التوصيل</div>
          <div class="kpi-value kpi-amber" style="font-size:11px;">${formatCurrency(closure.deliveryTotal)} ر.س</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-label">عدد العمليات</div>
          <div class="kpi-value" style="font-size:11px;">${totalTx}</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-label">متوسط الفاتورة</div>
          <div class="kpi-value" style="font-size:11px;">${formatCurrency(avgTicket)} ر.س</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-label">عدد اليوميات</div>
          <div class="kpi-value" style="font-size:11px;">${closure.journalsCount || (closure.journals || []).length}</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-label">عدد العملاء</div>
          <div class="kpi-value" style="font-size:11px;">${closure.totalCustomerCount || 0}</div>
        </div>
      </div>

      <div class="section-header">فروقات النقدي والشبكة</div>
      <table>
        <tr>
          <th>البيان</th>
          <th>المتوقع</th>
          <th>الفعلي</th>
          <th>الفرق</th>
          <th>الحالة</th>
        </tr>
        <tr>
          <td class="text-right bold">النقدي</td>
          <td>${formatCurrency(closure.totalExpectedCash)}</td>
          <td>${formatCurrency(closure.totalActualCash)}</td>
          <td class="bold ${(closure.totalCashDiscrepancy || 0) > 0.5 ? 'text-orange' : (closure.totalCashDiscrepancy || 0) < -0.5 ? 'text-red' : 'text-green'}">${formatCurrency(closure.totalCashDiscrepancy)} ر.س</td>
          <td>${(closure.totalCashDiscrepancy || 0) > 0.5 ? 'زيادة' : (closure.totalCashDiscrepancy || 0) < -0.5 ? 'عجز' : 'مطابق'}</td>
        </tr>
        <tr>
          <td class="text-right bold">الشبكة (البنك)</td>
          <td>${formatCurrency(closure.totalBankPosAmount)}</td>
          <td>${formatCurrency(closure.totalBankTerminalAmount)}</td>
          <td class="bold ${(closure.totalBankDiscrepancy || 0) > 0.5 ? 'text-orange' : (closure.totalBankDiscrepancy || 0) < -0.5 ? 'text-red' : 'text-green'}">${formatCurrency(closure.totalBankDiscrepancy)} ر.س</td>
          <td>${(closure.totalBankDiscrepancy || 0) > 0.5 ? 'زيادة' : (closure.totalBankDiscrepancy || 0) < -0.5 ? 'عجز' : 'مطابق'}</td>
        </tr>
      </table>

      ${(closure.journals && closure.journals.length > 0) ? `
      <div class="section-header">اليوميات المرتبطة (${closure.journals.length})</div>
      <table>
        <tr>
          <th>الكاشير</th>
          <th>الوردية</th>
          <th>إجمالي المبيعات</th>
          <th>النقدي</th>
          <th>الشبكة</th>
          <th>فرق النقدي</th>
          <th>فرق الشبكة</th>
          <th>صافي الفرق</th>
          <th>الحالة</th>
        </tr>
        ${journalRows}
        <tr class="totals-row">
          <td colspan="3">الإجمالي</td>
          <td>${formatCurrency((closure.journals || []).reduce((s: number, j: any) => s + (j.cashTotal || 0), 0))}</td>
          <td>${formatCurrency((closure.journals || []).reduce((s: number, j: any) => s + (j.networkTotal || 0), 0))}</td>
          <td class="${totalCashDisc > 0.5 ? 'text-orange' : totalCashDisc < -0.5 ? 'text-red' : 'text-green'}">${formatCurrency(totalCashDisc)}</td>
          <td class="${totalBankDisc > 0.5 ? 'text-orange' : totalBankDisc < -0.5 ? 'text-red' : 'text-green'}">${formatCurrency(totalBankDisc)}</td>
          <td class="bold ${totalNetDisc > 0.5 ? 'text-orange' : totalNetDisc < -0.5 ? 'text-red' : 'text-green'}">${formatCurrency(totalNetDisc)} ${totalNetDisc > 0.5 ? '(زيادة)' : totalNetDisc < -0.5 ? '(عجز)' : '(مطابق)'}</td>
          <td></td>
        </tr>
      </table>` : ''}

      ${(closure.payments && closure.payments.length > 0) ? `
      <div class="section-header">تفصيل طرق الدفع</div>
      <table>
        <tr>
          <th>طريقة الدفع</th>
          <th>المبلغ (ر.س)</th>
          <th>مبلغ الكاشير</th>
          <th>مبلغ الجهاز</th>
          <th>الفرق</th>
        </tr>
        ${paymentRows}
      </table>` : ''}

      ${(() => {
        const bankPayments = (closure.payments || []).filter((p: any) => BANK_COMMISSION_RATES[p.paymentMethod]);
        if (bankPayments.length === 0) return '';
        let commTotalTerminal = 0, commTotalComm = 0, commTotalNet = 0;
        const commRows = bankPayments.map((p: any) => {
          const config = BANK_COMMISSION_RATES[p.paymentMethod];
          const terminalAmount = p.totalTerminalAmount || 0;
          const commission = (terminalAmount * config.rate) / 100;
          const netAmount = terminalAmount - commission;
          commTotalTerminal += terminalAmount;
          commTotalComm += commission;
          commTotalNet += netAmount;
          return '<tr><td>' + config.label + '</td><td>' + formatCurrency(terminalAmount) + '</td><td>' + config.rate + '%</td><td>' + formatCurrency(Math.round(commission * 100) / 100) + '</td><td>' + formatCurrency(Math.round(netAmount * 100) / 100) + '</td></tr>';
        }).join('');
        return '<div class="section-header">بيان عمولة البنك</div>' +
          '<table><tr><th>طريقة الدفع</th><th>مبلغ الجهاز (ر.س)</th><th>نسبة العمولة</th><th>مبلغ العمولة (ر.س)</th><th>صافي المحصّل (ر.س)</th></tr>' +
          commRows +
          '<tr class="totals-row"><td>الإجمالي</td><td>' + formatCurrency(Math.round(commTotalTerminal * 100) / 100) + '</td><td></td><td>' + formatCurrency(Math.round(commTotalComm * 100) / 100) + '</td><td>' + formatCurrency(Math.round(commTotalNet * 100) / 100) + '</td></tr></table>' +
          '<div class="section-header">ملخص القيد المحاسبي</div>' +
          '<table><tr><th>البيان</th><th>مدين (ر.س)</th><th>دائن (ر.س)</th></tr>' +
          '<tr><td class="text-right">البنك (صافي المحصّل)</td><td>' + formatCurrency(Math.round(commTotalNet * 100) / 100) + '</td><td>-</td></tr>' +
          '<tr><td class="text-right">عمولة البنك (مصروف)</td><td>' + formatCurrency(Math.round(commTotalComm * 100) / 100) + '</td><td>-</td></tr>' +
          '<tr><td class="text-right">المبيعات (إجمالي الجهاز)</td><td>-</td><td>' + formatCurrency(Math.round(commTotalTerminal * 100) / 100) + '</td></tr>' +
          '<tr class="totals-row"><td class="text-right">إجمالي القيد</td><td>' + formatCurrency(Math.round((commTotalNet + commTotalComm) * 100) / 100) + '</td><td>' + formatCurrency(Math.round(commTotalTerminal * 100) / 100) + '</td></tr></table>';
      })()}

      <div class="footer">
        تم انشاء هذا التقرير اليا من BUTTER BAKERY SYSTEM
        <div class="footer-line2">CEO COMMAND - ${today}</div>
      </div>

      <script>window.onload = function() { window.print(); };</script>
    </body>
    </html>`;

    const printWindow = window.open('', '_blank', 'width=1000,height=700');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    } else {
      alert('يرجى السماح بالنوافذ المنبثقة لتصدير التقرير');
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return format(d, "d MMMM yyyy", { locale: ar });
      }
      return dateStr;
    } catch { return dateStr; }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="p-6 space-y-4" dir="rtl">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}
          </div>
        </div>
      </Layout>
    );
  }

  if (!closure) {
    return (
      <Layout>
        <div className="p-6 text-center" dir="rtl">
          <AlertTriangle className="w-12 h-12 mx-auto text-amber-500 mb-4" />
          <h2 className="text-xl font-bold mb-2">الإغلاق غير موجود</h2>
          <Link href="/branch-daily-closures">
            <Button variant="outline" className="gap-2">
              <ArrowRight className="w-4 h-4" />
              العودة للقائمة
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const statusInfo = STATUS_LABELS[closure.status] || STATUS_LABELS.open;
  const StatusIcon = statusInfo.icon;
  const cashDiscrepancy = DISCREPANCY_LABELS[closure.cashDiscrepancyStatus] || DISCREPANCY_LABELS.balanced;
  const CashDiscIcon = cashDiscrepancy.icon;
  const bankDiscrepancy = DISCREPANCY_LABELS[closure.bankDiscrepancyStatus] || DISCREPANCY_LABELS.balanced;
  const BankDiscIcon = bankDiscrepancy.icon;

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6" dir="rtl">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Link href="/branch-daily-closures">
              <Button variant="ghost" size="sm" className="gap-1" data-testid="button-back-closures">
                <ArrowRight className="w-4 h-4" />
                العودة
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2" data-testid="text-closure-title">
                <Receipt className="w-5 h-5 text-amber-600" />
                بيان الإغلاق اليومي
              </h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <Building2 className="w-4 h-4" />
                <span data-testid="text-branch-name">{branchName}</span>
                <span>•</span>
                <Calendar className="w-4 h-4" />
                <span data-testid="text-closure-date">{formatDate(closure.closureDate)}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1" onClick={exportClosurePdf} data-testid="button-export-pdf">
              <Download className="w-4 h-4" />
              تصدير PDF
            </Button>
            <Badge variant={statusInfo.variant} className="text-sm gap-1 px-3 py-1" data-testid="badge-status">
              <StatusIcon className="w-4 h-4" />
              {statusInfo.label}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card data-testid="kpi-total-sales">
            <CardContent className="p-4 text-center">
              <DollarSign className="w-5 h-5 mx-auto text-green-600 mb-1" />
              <p className="text-lg font-bold text-green-600">{formatCurrency(closure.totalSales)}</p>
              <p className="text-xs text-muted-foreground">إجمالي المبيعات</p>
            </CardContent>
          </Card>
          <Card data-testid="kpi-cash-total">
            <CardContent className="p-4 text-center">
              <Wallet className="w-5 h-5 mx-auto text-emerald-600 mb-1" />
              <p className="text-lg font-bold text-emerald-600">{formatCurrency(closure.cashTotal)}</p>
              <p className="text-xs text-muted-foreground">النقدي</p>
            </CardContent>
          </Card>
          <Card data-testid="kpi-network-total">
            <CardContent className="p-4 text-center">
              <CreditCard className="w-5 h-5 mx-auto text-indigo-600 mb-1" />
              <p className="text-lg font-bold text-indigo-600">{formatCurrency(closure.networkTotal)}</p>
              <p className="text-xs text-muted-foreground">الشبكة</p>
            </CardContent>
          </Card>
          <Card data-testid="kpi-delivery-total">
            <CardContent className="p-4 text-center">
              <Truck className="w-5 h-5 mx-auto text-blue-600 mb-1" />
              <p className="text-lg font-bold text-blue-600">{formatCurrency(closure.deliveryTotal)}</p>
              <p className="text-xs text-muted-foreground">التوصيل</p>
            </CardContent>
          </Card>
          <Card data-testid="kpi-customers">
            <CardContent className="p-4 text-center">
              <Users className="w-5 h-5 mx-auto text-purple-600 mb-1" />
              <p className="text-lg font-bold text-purple-600">{closure.totalCustomerCount || 0}</p>
              <p className="text-xs text-muted-foreground">العملاء</p>
            </CardContent>
          </Card>
          <Card data-testid="kpi-journals">
            <CardContent className="p-4 text-center">
              <Receipt className="w-5 h-5 mx-auto text-amber-600 mb-1" />
              <p className="text-lg font-bold text-amber-600">{closure.journalsCount}</p>
              <p className="text-xs text-muted-foreground">اليوميات المجمعة</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-600" />
                تسوية الصندوق النقدي
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">الرصيد الافتتاحي</p>
                  <p className="text-base font-bold">{formatCurrency(closure.totalOpeningBalance)} ر.س</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">النقدي المتوقع</p>
                  <p className="text-base font-bold">{formatCurrency(closure.totalExpectedCash)} ر.س</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">النقدي الفعلي</p>
                  <p className="text-base font-bold">{formatCurrency(closure.totalActualCash)} ر.س</p>
                </div>
                <div className={`rounded-lg p-3 ${cashDiscrepancy.color}`}>
                  <p className="text-xs opacity-80">فرق النقدي</p>
                  <div className="flex items-center gap-1">
                    <CashDiscIcon className="w-4 h-4" />
                    <p className="text-base font-bold">{formatCurrency(closure.totalCashDiscrepancy)} ر.س</p>
                  </div>
                  <p className="text-xs mt-0.5">{cashDiscrepancy.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-indigo-600" />
                مطابقة البنك
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">إجمالي نقاط البيع</p>
                  <p className="text-base font-bold">{formatCurrency(closure.totalBankPosAmount)} ر.س</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">إجمالي كشف البنك</p>
                  <p className="text-base font-bold">{formatCurrency(closure.totalBankTerminalAmount)} ر.س</p>
                </div>
                <div className={`rounded-lg p-3 col-span-2 ${bankDiscrepancy.color}`}>
                  <p className="text-xs opacity-80">فرق البنك</p>
                  <div className="flex items-center gap-1">
                    <BankDiscIcon className="w-4 h-4" />
                    <p className="text-base font-bold">{formatCurrency(closure.totalBankDiscrepancy)} ر.س</p>
                  </div>
                  <p className="text-xs mt-0.5">{bankDiscrepancy.label}</p>
                </div>
              </div>

              {closure.payments && closure.payments.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm font-semibold mb-2">تفاصيل طرق الدفع</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">طريقة الدفع</TableHead>
                        <TableHead className="text-right">المبلغ</TableHead>
                        <TableHead className="text-right">العمليات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {closure.payments.map((p: any) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{PAYMENT_METHOD_LABELS[p.paymentMethod] || p.paymentMethod}</TableCell>
                          <TableCell>{formatCurrency(p.totalAmount)} ر.س</TableCell>
                          <TableCell>{p.totalTransactionCount || 0}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {(() => {
          const bankPayments = (closure.payments || []).filter((p: any) => BANK_COMMISSION_RATES[p.paymentMethod]);
          if (bankPayments.length === 0) return null;

          const commissionRows = bankPayments.map((p: any) => {
            const config = BANK_COMMISSION_RATES[p.paymentMethod];
            const terminalAmount = p.totalTerminalAmount || 0;
            const commission = (terminalAmount * config.rate) / 100;
            const netAmount = terminalAmount - commission;
            return { ...p, label: config.label, rate: config.rate, terminalAmount, commission, netAmount };
          });

          const totalTerminalSales = commissionRows.reduce((s: number, r: any) => s + r.terminalAmount, 0);
          const totalCommission = commissionRows.reduce((s: number, r: any) => s + r.commission, 0);
          const totalNetAmount = commissionRows.reduce((s: number, r: any) => s + r.netAmount, 0);

          return (
            <Card data-testid="card-bank-commission">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-rose-600" />
                    بيان عمولة البنك - القيد المحاسبي
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-green-700 border-green-300 hover:bg-green-50"
                    onClick={exportBankCommissionExcel}
                    data-testid="button-export-commission"
                  >
                    <Download className="w-4 h-4" />
                    تصدير Excel
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-indigo-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-indigo-600">إجمالي مبلغ Terminal البنك</p>
                    <p className="text-lg font-bold text-indigo-700">{formatCurrency(totalTerminalSales)} ر.س</p>
                  </div>
                  <div className="bg-rose-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-rose-600">إجمالي عمولة البنك</p>
                    <p className="text-lg font-bold text-rose-700">{formatCurrency(totalCommission)} ر.س</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-green-600">صافي المبلغ المحصّل</p>
                    <p className="text-lg font-bold text-green-700">{formatCurrency(totalNetAmount)} ر.س</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="text-right font-bold">طريقة الدفع</TableHead>
                        <TableHead className="text-right font-bold">مبلغ Terminal (ر.س)</TableHead>
                        <TableHead className="text-right font-bold">نسبة العمولة %</TableHead>
                        <TableHead className="text-right font-bold">مبلغ العمولة (ر.س)</TableHead>
                        <TableHead className="text-right font-bold">صافي المحصّل (ر.س)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {commissionRows.map((r: any) => (
                        <TableRow key={r.paymentMethod} data-testid={`row-commission-${r.paymentMethod}`}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <CreditCard className="w-4 h-4 text-indigo-500" />
                              {r.label}
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold">{formatCurrency(r.terminalAmount)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="gap-1">
                              <Percent className="w-3 h-3" />
                              {r.rate}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-rose-600 font-semibold">{formatCurrency(r.commission)}</TableCell>
                          <TableCell className="text-green-600 font-semibold">{formatCurrency(r.netAmount)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-slate-50 font-bold border-t-2">
                        <TableCell className="font-bold">الإجمالي</TableCell>
                        <TableCell className="font-bold">{formatCurrency(totalTerminalSales)}</TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-rose-700 font-bold">{formatCurrency(totalCommission)}</TableCell>
                        <TableCell className="text-green-700 font-bold">{formatCurrency(totalNetAmount)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-sm font-bold text-amber-800 mb-2 flex items-center gap-1">
                    <Receipt className="w-4 h-4" />
                    ملخص القيد المحاسبي
                  </p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between items-center py-1 border-b border-amber-200">
                      <span className="text-amber-900">مدين: البنك (صافي المحصّل)</span>
                      <span className="font-bold text-green-700">{formatCurrency(totalNetAmount)} ر.س</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-amber-200">
                      <span className="text-amber-900">مدين: عمولة البنك (مصروف)</span>
                      <span className="font-bold text-rose-700">{formatCurrency(totalCommission)} ر.س</span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-amber-900">دائن: المبيعات (إجمالي Terminal البنك)</span>
                      <span className="font-bold text-indigo-700">{formatCurrency(totalTerminalSales)} ر.س</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">إجمالي المبيعات</p>
            <p className="text-lg font-bold">{formatCurrency(closure.totalSales)} ر.س</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">عدد العمليات</p>
            <p className="text-lg font-bold">{closure.totalTransactionCount || 0}</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">متوسط الفاتورة</p>
            <p className="text-lg font-bold">
              {formatCurrency(
                (closure.totalTransactionCount && closure.totalTransactionCount > 0)
                  ? (closure.totalSales || 0) / closure.totalTransactionCount
                  : 0
              )} ر.س
            </p>
          </div>
          {closure.closedBy && (
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">أغلق بواسطة</p>
              <p className="text-sm font-semibold">{closure.closedBy}</p>
            </div>
          )}
          {closure.closedAt && (
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">تاريخ الإغلاق</p>
              <p className="text-sm font-semibold">{format(new Date(closure.closedAt), "d MMM yyyy HH:mm", { locale: ar })}</p>
            </div>
          )}
        </div>

        {closure.notes && (
          <Card>
            <CardContent className="p-4">
              <p className="text-sm font-semibold mb-1">ملاحظات</p>
              <p className="text-sm text-muted-foreground">{closure.notes}</p>
            </CardContent>
          </Card>
        )}

        {closure.journals && closure.journals.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="w-4 h-4 text-amber-600" />
                اليوميات المرتبطة ({closure.journals.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">الكاشير</TableHead>
                      <TableHead className="text-right">الوردية</TableHead>
                      <TableHead className="text-right">إجمالي المبيعات</TableHead>
                      <TableHead className="text-right">النقدي</TableHead>
                      <TableHead className="text-right">الشبكة</TableHead>
                      <TableHead className="text-right">فرق النقدي</TableHead>
                      <TableHead className="text-right">فرق الشبكة</TableHead>
                      <TableHead className="text-right">صافي الفرق</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {closure.journals.map((j: any) => {
                      const shiftLabel = j.shiftType === 'morning' ? 'صباحي' : j.shiftType === 'evening' ? 'مسائي' : j.shiftType === 'night' ? 'ليلي' : (j.shiftType || '-');
                      const expectedCash = (j.expectedCash != null && j.expectedCash !== 0) ? j.expectedCash : ((j.openingBalance || 0) + (j.cashTotal || 0));
                      const cashDisc = (j.actualCashDrawer || 0) - expectedCash;
                      const bankDisc = j.computedBankDiscrepancy ?? j.bankDiscrepancyTotal ?? 0;
                      const netDisc = cashDisc + bankDisc;
                      return (
                        <TableRow key={j.id} data-testid={`row-journal-${j.id}`}>
                          <TableCell className="font-medium">
                            <Link href={`/cashier-journals/${j.id}`}>
                              <span className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer" data-testid={`link-journal-${j.id}`}>
                                {j.cashierName || '-'}
                              </span>
                            </Link>
                          </TableCell>
                          <TableCell>{shiftLabel}</TableCell>
                          <TableCell>{formatCurrency(j.totalSales)} ر.س</TableCell>
                          <TableCell>{formatCurrency(j.cashTotal)} ر.س</TableCell>
                          <TableCell>{formatCurrency(j.networkTotal)} ر.س</TableCell>
                          <TableCell>
                            <span className={cashDisc > 0.5 ? 'text-amber-600 font-semibold' : cashDisc < -0.5 ? 'text-red-600 font-semibold' : 'text-green-600'}>
                              {formatCurrency(cashDisc)} ر.س
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={bankDisc > 0.5 ? 'text-amber-600 font-semibold' : bankDisc < -0.5 ? 'text-red-600 font-semibold' : 'text-green-600'}>
                              {formatCurrency(bankDisc)} ر.س
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={`font-bold ${netDisc > 0.5 ? 'text-amber-700 bg-amber-50 px-2 py-0.5 rounded' : netDisc < -0.5 ? 'text-red-700 bg-red-50 px-2 py-0.5 rounded' : 'text-green-700 bg-green-50 px-2 py-0.5 rounded'}`}>
                              {formatCurrency(netDisc)} ر.س
                              <span className="text-[10px] mr-1">
                                {netDisc > 0.5 ? 'زيادة' : netDisc < -0.5 ? 'عجز' : 'مطابق'}
                              </span>
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={j.status === 'approved' ? 'default' : j.status === 'submitted' ? 'secondary' : 'outline'}>
                              {j.status === 'approved' ? 'معتمدة' : j.status === 'submitted' ? 'مقدمة' : j.status === 'draft' ? 'مسودة' : j.status === 'posted' ? 'مرحّلة' : j.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="bg-slate-50 font-bold border-t-2">
                      <TableCell colSpan={3} className="font-bold">الإجمالي</TableCell>
                      <TableCell className="font-bold">{formatCurrency(closure.journals.reduce((s: number, j: any) => s + (j.cashTotal || 0), 0))} ر.س</TableCell>
                      <TableCell className="font-bold">{formatCurrency(closure.journals.reduce((s: number, j: any) => s + (j.networkTotal || 0), 0))} ر.س</TableCell>
                      <TableCell className="font-bold">
                        {(() => {
                          const totalCashDisc = closure.journals.reduce((s: number, j: any) => {
                            const exp = (j.expectedCash != null && j.expectedCash !== 0) ? j.expectedCash : ((j.openingBalance || 0) + (j.cashTotal || 0));
                            return s + ((j.actualCashDrawer || 0) - exp);
                          }, 0);
                          return (
                            <span className={totalCashDisc > 0.5 ? 'text-amber-600' : totalCashDisc < -0.5 ? 'text-red-600' : 'text-green-600'}>
                              {formatCurrency(totalCashDisc)} ر.س
                            </span>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="font-bold">
                        {(() => {
                          const totalBankDisc = closure.journals.reduce((s: number, j: any) => s + (j.computedBankDiscrepancy ?? j.bankDiscrepancyTotal ?? 0), 0);
                          return (
                            <span className={totalBankDisc > 0.5 ? 'text-amber-600' : totalBankDisc < -0.5 ? 'text-red-600' : 'text-green-600'}>
                              {formatCurrency(totalBankDisc)} ر.س
                            </span>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="font-bold">
                        {(() => {
                          const totalNet = closure.journals.reduce((s: number, j: any) => {
                            const exp = (j.expectedCash != null && j.expectedCash !== 0) ? j.expectedCash : ((j.openingBalance || 0) + (j.cashTotal || 0));
                            const cd = (j.actualCashDrawer || 0) - exp;
                            return s + cd + (j.computedBankDiscrepancy ?? j.bankDiscrepancyTotal ?? 0);
                          }, 0);
                          return (
                            <span className={`px-2 py-0.5 rounded ${totalNet > 0.5 ? 'text-amber-700 bg-amber-100' : totalNet < -0.5 ? 'text-red-700 bg-red-100' : 'text-green-700 bg-green-100'}`}>
                              {formatCurrency(totalNet)} ر.س
                              <span className="text-[10px] mr-1">
                                {totalNet > 0.5 ? 'زيادة' : totalNet < -0.5 ? 'عجز' : 'مطابق'}
                              </span>
                            </span>
                          );
                        })()}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
