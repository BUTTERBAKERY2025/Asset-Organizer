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
} from "lucide-react";

const formatCurrency = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined) return "0.00";
  return new Intl.NumberFormat("en-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
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
          <Badge variant={statusInfo.variant} className="text-sm gap-1 px-3 py-1" data-testid="badge-status">
            <StatusIcon className="w-4 h-4" />
            {statusInfo.label}
          </Badge>
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
                          <TableCell className="font-medium">{p.paymentMethod}</TableCell>
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

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">متوسط الفاتورة</p>
            <p className="text-lg font-bold">{formatCurrency(closure.averageTicket)} ر.س</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">عدد العمليات</p>
            <p className="text-lg font-bold">{closure.totalTransactionCount || 0}</p>
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
                      <TableHead className="text-right">الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {closure.journals.map((j: any) => {
                      const shiftLabel = j.shiftType === 'morning' ? 'صباحي' : j.shiftType === 'evening' ? 'مسائي' : j.shiftType === 'night' ? 'ليلي' : (j.shiftType || '-');
                      const disc = j.discrepancyAmount || 0;
                      return (
                        <TableRow key={j.id}>
                          <TableCell className="font-medium">{j.cashierName || '-'}</TableCell>
                          <TableCell>{shiftLabel}</TableCell>
                          <TableCell>{formatCurrency(j.totalSales)} ر.س</TableCell>
                          <TableCell>{formatCurrency(j.cashTotal)} ر.س</TableCell>
                          <TableCell>{formatCurrency(j.networkTotal)} ر.س</TableCell>
                          <TableCell>
                            <span className={disc > 0 ? 'text-amber-600' : disc < 0 ? 'text-red-600' : 'text-green-600'}>
                              {formatCurrency(disc)} ر.س
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={j.status === 'approved' ? 'default' : j.status === 'submitted' ? 'secondary' : 'outline'}>
                              {j.status === 'approved' ? 'معتمدة' : j.status === 'submitted' ? 'مقدمة' : j.status === 'draft' ? 'مسودة' : j.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
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
