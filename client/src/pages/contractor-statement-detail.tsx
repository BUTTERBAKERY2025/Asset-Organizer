import { useMemo, useState } from "react";
import { Layout } from "@/components/layout";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowRight, Loader2, Printer, Download, FileText, DollarSign, Receipt, Wallet } from "lucide-react";
import type { Contractor, ConstructionContract } from "@shared/schema";
import * as XLSX from "xlsx";

interface Statement {
  contractor: Contractor;
  totals: {
    contractsTotal: number;
    contractPaymentsTotal: number;
    paymentRequestsPaidTotal: number;
    paymentRequestsPendingTotal: number;
    directExpensesTotal: number;
    totalPaid: number;
    balance: number;
  };
  contracts: ConstructionContract[];
  transactions: Array<{
    id: string;
    date: string;
    type: string;
    projectId: number | null;
    projectTitle?: string | null;
    contractId?: number | null;
    contractTitle?: string | null;
    description: string;
    amount: number;
    status?: string;
    reference?: string | null;
  }>;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

const TX_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  contract_payment: { label: "دفعة عقد", color: "bg-blue-500" },
  payment_request: { label: "طلب صرف", color: "bg-purple-500" },
  expense: { label: "مصروف مباشر", color: "bg-orange-500" },
};

export default function ContractorStatementDetailPage() {
  const params = useParams<{ id: string }>();
  const contractorId = parseInt(params.id || "0", 10);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const queryUrl = useMemo(() => {
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    const q = qs.toString();
    return `/api/construction/contractors/${contractorId}/statement${q ? "?" + q : ""}`;
  }, [contractorId, from, to]);

  const { data, isLoading } = useQuery<Statement>({
    queryKey: [queryUrl],
    enabled: !!contractorId,
  });

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    if (!data) return;
    const rows = data.transactions.map((t) => ({
      "التاريخ": t.date,
      "النوع": TX_TYPE_LABELS[t.type]?.label || t.type,
      "المشروع": t.projectTitle || "-",
      "العقد": t.contractTitle || "-",
      "الوصف": t.description,
      "المبلغ (ر.س)": Number(t.amount).toFixed(2),
      "الحالة": t.status || "-",
      "المرجع": t.reference || "-",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "كشف الحساب");
    XLSX.writeFile(wb, `كشف_حساب_${data.contractor.name}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!data || !data.contractor) {
    return (
      <Layout>
        <div className="container mx-auto p-6 text-center" dir="rtl">
          <p className="text-muted-foreground">المقاول غير موجود</p>
          <Link href="/contractor-statements">
            <Button variant="outline" className="mt-4">
              <ArrowRight className="h-4 w-4 ml-2" />
              العودة
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6 print:p-2" dir="rtl">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
          <div className="flex items-center gap-3">
            <Link href="/contractor-statements">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold" data-testid="text-contractor-name">
                {data.contractor.name}
              </h1>
              <p className="text-muted-foreground">كشف حساب تفصيلي</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExportExcel} data-testid="button-export-excel">
              <Download className="h-4 w-4 ml-1" />
              Excel
            </Button>
            <Button variant="outline" onClick={handlePrint} data-testid="button-print">
              <Printer className="h-4 w-4 ml-1" />
              طباعة
            </Button>
          </div>
        </div>

        {/* Print header (visible only when printing) */}
        <div className="hidden print:block text-center mb-4">
          <h1 className="text-2xl font-bold">كشف حساب: {data.contractor.name}</h1>
          <p className="text-sm">تاريخ الإصدار: {new Date().toLocaleDateString("ar-SA")}</p>
          {(from || to) && (
            <p className="text-sm">
              الفترة: {from || "البداية"} - {to || "الآن"}
            </p>
          )}
        </div>

        {/* Contractor info */}
        <Card>
          <CardHeader>
            <CardTitle>بيانات المقاول</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-muted-foreground text-xs">الجوال</Label>
                <p className="font-medium" data-testid="text-phone">
                  {data.contractor.phone || "-"}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">البريد الإلكتروني</Label>
                <p className="font-medium" data-testid="text-email">
                  {data.contractor.email || "-"}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">التخصص</Label>
                <p className="font-medium">{data.contractor.specialization || "-"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">التقييم</Label>
                <p className="font-medium">{data.contractor.rating ? `${data.contractor.rating}/5` : "-"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card className="print:hidden">
          <CardContent className="pt-6">
            <div className="flex items-end gap-4 flex-wrap">
              <div className="flex-1 min-w-[180px]">
                <Label htmlFor="from-date">من تاريخ</Label>
                <Input
                  id="from-date"
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  data-testid="input-from-date"
                />
              </div>
              <div className="flex-1 min-w-[180px]">
                <Label htmlFor="to-date">إلى تاريخ</Label>
                <Input
                  id="to-date"
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  data-testid="input-to-date"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setFrom("");
                  setTo("");
                }}
                data-testid="button-clear-filters"
              >
                إلغاء الفلتر
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Totals */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">قيمة العقود</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold" data-testid="text-contracts-total">
                {formatCurrency(data.totals.contractsTotal)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">دفعات العقود</CardTitle>
              <DollarSign className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-blue-600" data-testid="text-contract-payments-total">
                {formatCurrency(data.totals.contractPaymentsTotal)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">طلبات صرف مدفوعة</CardTitle>
              <Receipt className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-purple-600" data-testid="text-payment-requests-paid">
                {formatCurrency(data.totals.paymentRequestsPaidTotal)}
              </div>
              {data.totals.paymentRequestsPendingTotal > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  معلق: {formatCurrency(data.totals.paymentRequestsPendingTotal)}
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">مصروفات مباشرة</CardTitle>
              <Wallet className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-orange-600" data-testid="text-expenses-total">
                {formatCurrency(data.totals.directExpensesTotal)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Final balance */}
        <Card className="border-2 border-primary">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-sm text-muted-foreground">إجمالي قيمة الأعمال</p>
                <p className="text-2xl font-bold" data-testid="text-summary-contracts">
                  {formatCurrency(data.totals.contractsTotal)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي المدفوع للمقاول</p>
                <p className="text-2xl font-bold text-green-600" data-testid="text-summary-paid">
                  {formatCurrency(data.totals.totalPaid)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">الرصيد المستحق</p>
                <p
                  className={`text-2xl font-bold ${
                    data.totals.balance > 0 ? "text-orange-600" : "text-green-600"
                  }`}
                  data-testid="text-summary-balance"
                >
                  {formatCurrency(data.totals.balance)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contracts list */}
        {data.contracts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>العقود المرتبطة ({data.contracts.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">رقم العقد</TableHead>
                      <TableHead className="text-right">العنوان</TableHead>
                      <TableHead className="text-right">قيمة العقد</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-right">تاريخ البداية</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.contracts.map((c) => (
                      <TableRow key={c.id} data-testid={`row-contract-${c.id}`}>
                        <TableCell className="font-mono text-sm">
                          {c.contractNumber || `#${c.id}`}
                        </TableCell>
                        <TableCell className="font-medium">{c.title}</TableCell>
                        <TableCell>{formatCurrency(Number(c.totalAmount || 0))}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{c.status}</Badge>
                        </TableCell>
                        <TableCell>{c.startDate || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Transactions ledger */}
        <Card>
          <CardHeader>
            <CardTitle>سجل الحركات ({data.transactions.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {data.transactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                لا توجد حركات في الفترة المحددة
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">النوع</TableHead>
                      <TableHead className="text-right">المشروع</TableHead>
                      <TableHead className="text-right">الوصف</TableHead>
                      <TableHead className="text-right">المبلغ</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-right">المرجع</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.transactions.map((t) => {
                      const typeMeta = TX_TYPE_LABELS[t.type] || { label: t.type, color: "bg-gray-500" };
                      return (
                        <TableRow key={t.id} data-testid={`row-transaction-${t.id}`}>
                          <TableCell className="text-sm">{t.date}</TableCell>
                          <TableCell>
                            <Badge className={`${typeMeta.color} text-white`}>
                              {typeMeta.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {t.projectTitle || "-"}
                            {t.contractTitle && (
                              <div className="text-xs text-muted-foreground">{t.contractTitle}</div>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[300px] truncate" title={t.description}>
                            {t.description}
                          </TableCell>
                          <TableCell className="font-bold text-blue-600">
                            {formatCurrency(Number(t.amount))}
                          </TableCell>
                          <TableCell>
                            {t.status ? (
                              <Badge variant="outline" className="text-xs">
                                {t.status}
                              </Badge>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {t.reference || "-"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
