import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Plus, Search, Eye, CheckCircle, XCircle, Clock, AlertTriangle, TrendingUp, TrendingDown, Minus, Wallet, Calendar, DollarSign, Users, Printer } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import type { CashierSalesJournal, Branch } from "@shared/schema";
import { printHtmlContent } from "@/lib/print-utils";
import { TablePagination } from "@/components/ui/pagination";
import { ExportButtons } from "@/components/export-buttons";

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "مسودة", variant: "secondary" },
  submitted: { label: "مُقدم للمراجعة", variant: "default" },
  approved: { label: "معتمد", variant: "outline" },
  rejected: { label: "مرفوض", variant: "destructive" },
};

const DISCREPANCY_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  balanced: { label: "متوازن", color: "text-green-600", icon: Minus },
  shortage: { label: "عجز", color: "text-red-600", icon: TrendingDown },
  surplus: { label: "زيادة", color: "text-amber-600", icon: TrendingUp },
};

const exportColumns = [
  { header: "التاريخ", key: "journalDate", width: 12 },
  { header: "الكاشير", key: "cashierName", width: 20 },
  { header: "الفرع", key: "branchId", width: 15 },
  { header: "الوردية", key: "shiftType", width: 10 },
  { header: "إجمالي المبيعات", key: "totalSales", width: 15 },
  { header: "النقدي", key: "cashTotal", width: 12 },
  { header: "الشبكة", key: "networkTotal", width: 12 },
  { header: "التوصيل", key: "deliveryTotal", width: 12 },
  { header: "عدد العملاء", key: "customerCount", width: 12 },
  { header: "حالة العجز", key: "discrepancyStatus", width: 12 },
  { header: "قيمة العجز", key: "discrepancyAmount", width: 12 },
  { header: "الحالة", key: "status", width: 10 },
];

export default function CashierJournalsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [discrepancyFilter, setDiscrepancyFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: journals, isLoading } = useQuery<CashierSalesJournal[]>({
    queryKey: ["/api/cashier-journals"],
  });

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const { data: stats } = useQuery<{
    totalJournals: number;
    totalSales: number;
    totalShortages: number;
    totalSurpluses: number;
    shortageAmount: number;
    surplusAmount: number;
    averageTicket: number;
  }>({
    queryKey: ["/api/cashier-journals/stats/summary"],
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => apiRequest(`/api/cashier-journals/${id}/approve`, "POST", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cashier-journals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashier-journals/stats/summary"] });
      toast({ title: "تم اعتماد اليومية بنجاح" });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في اعتماد اليومية", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: number; notes?: string }) =>
      apiRequest(`/api/cashier-journals/${id}/reject`, "POST", { notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cashier-journals"] });
      toast({ title: "تم رفض اليومية" });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في رفض اليومية", variant: "destructive" });
    },
  });

  const getBranchName = (branchId: string) => {
    const branch = branches?.find((b) => b.id === branchId);
    return branch?.name || branchId;
  };

  const filteredJournals = journals?.filter((journal) => {
    const matchesSearch =
      journal.cashierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getBranchName(journal.branchId).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || journal.status === statusFilter;
    const matchesBranch = branchFilter === "all" || journal.branchId === branchFilter;
    const matchesDiscrepancy = discrepancyFilter === "all" || journal.discrepancyStatus === discrepancyFilter;
    return matchesSearch && matchesStatus && matchesBranch && matchesDiscrepancy;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [branchFilter, statusFilter, discrepancyFilter, searchTerm]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR" }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), "dd MMMM yyyy", { locale: ar });
  };

  const handlePrintList = () => {
    if (!filteredJournals || filteredJournals.length === 0) {
      toast({ title: "لا توجد يوميات للطباعة", variant: "destructive" });
      return;
    }

    const totalSales = filteredJournals.reduce((sum, j) => sum + (j.totalSales || 0), 0);
    const totalShortage = filteredJournals.filter(j => j.discrepancyStatus === 'shortage').reduce((sum, j) => sum + Math.abs(j.discrepancyAmount || 0), 0);
    const totalSurplus = filteredJournals.filter(j => j.discrepancyStatus === 'surplus').reduce((sum, j) => sum + (j.discrepancyAmount || 0), 0);

    const htmlContent = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>قائمة يوميات الكاشير</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    @page { size: A4; margin: 8mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; padding: 10px; background: white; color: #333; font-size: 9px; line-height: 1.3; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #d4a853; padding-bottom: 6px; margin-bottom: 10px; }
    .header .title { font-size: 14px; font-weight: bold; }
    .header .info { font-size: 9px; color: #666; }
    .summary-row { display: flex; gap: 8px; margin-bottom: 10px; }
    .summary-card { flex: 1; background: #f8f9fa; padding: 8px; border-radius: 6px; text-align: center; border: 1px solid #e9ecef; }
    .summary-card .value { font-size: 12px; font-weight: bold; }
    .summary-card .value.negative { color: #dc3545; }
    .summary-card .value.positive { color: #28a745; }
    .summary-card .label { color: #666; font-size: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 8px; }
    th, td { border: 1px solid #ddd; padding: 5px 4px; text-align: right; }
    th { background: #d4a853; color: white; font-weight: 600; }
    tr:nth-child(even) { background: #fafafa; }
    .status { padding: 2px 6px; border-radius: 8px; font-size: 7px; font-weight: 600; }
    .status-approved { background: #d4edda; color: #155724; }
    .status-submitted { background: #fff3cd; color: #856404; }
    .status-draft { background: #e9ecef; color: #495057; }
    .status-rejected { background: #f8d7da; color: #721c24; }
    .discrepancy { font-weight: bold; }
    .discrepancy.shortage { color: #dc3545; }
    .discrepancy.surplus { color: #28a745; }
    .discrepancy.balanced { color: #666; }
    .footer { margin-top: 10px; padding-top: 5px; border-top: 1px solid #ddd; display: flex; justify-content: space-between; font-size: 8px; color: #666; }
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
      <div class="title">قائمة يوميات الكاشير</div>
      <div class="info">${branchFilter !== 'all' ? getBranchName(branchFilter) : 'جميع الفروع'} | ${filteredJournals.length} يومية</div>
    </div>
    <div style="font-size:10px;font-weight:bold;color:#d4a853;">بتر بيكري</div>
  </div>

  <div class="summary-row">
    <div class="summary-card"><div class="value">${formatCurrency(totalSales)}</div><div class="label">إجمالي المبيعات</div></div>
    <div class="summary-card"><div class="value negative">-${formatCurrency(totalShortage)}</div><div class="label">إجمالي العجز</div></div>
    <div class="summary-card"><div class="value positive">+${formatCurrency(totalSurplus)}</div><div class="label">إجمالي الفائض</div></div>
    <div class="summary-card"><div class="value">${filteredJournals.length}</div><div class="label">عدد اليوميات</div></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>التاريخ</th>
        <th>الفرع</th>
        <th>الكاشير</th>
        <th>الوردية</th>
        <th>المبيعات</th>
        <th>نقدي</th>
        <th>شبكة</th>
        <th>الفرق</th>
        <th>الحالة</th>
      </tr>
    </thead>
    <tbody>
      ${filteredJournals.map((j, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${j.journalDate}</td>
          <td>${getBranchName(j.branchId)}</td>
          <td>${j.cashierName || '-'}</td>
          <td>${j.shiftType === 'morning' ? 'صباحي' : j.shiftType === 'evening' ? 'مسائي' : j.shiftType === 'night' ? 'ليلي' : '-'}</td>
          <td>${formatCurrency(j.totalSales || 0)}</td>
          <td>${formatCurrency(j.cashTotal || 0)}</td>
          <td>${formatCurrency(j.networkTotal || 0)}</td>
          <td class="discrepancy ${j.discrepancyStatus || 'balanced'}">${formatCurrency(j.discrepancyAmount || 0)}</td>
          <td><span class="status status-${j.status}">${STATUS_LABELS[j.status]?.label || j.status}</span></td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="footer">
    <span>بتر بيكري - Butter Bakery</span>
    <span>تاريخ الطباعة: ${new Date().toLocaleDateString('en-GB')}</span>
  </div>
</body>
</html>`;

    printHtmlContent(htmlContent);
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-primary" data-testid="page-title">
              يومية مبيعات الكاشير
            </h1>
            <p className="text-muted-foreground mt-1">
              متابعة وإدارة يوميات المبيعات والتسويات النقدية
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePrintList} className="gap-2" data-testid="button-print-list">
              <Printer className="w-4 h-4" />
              طباعة القائمة
            </Button>
            <Link href="/cashier-journals/new">
              <Button className="gap-2" data-testid="button-new-journal">
                <Plus className="w-4 h-4" />
                يومية جديدة
              </Button>
            </Link>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100">
                    <DollarSign className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">إجمالي المبيعات</p>
                    <p className="text-xl font-bold" data-testid="stat-total-sales">{formatCurrency(stats.totalSales)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-100">
                    <TrendingDown className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">إجمالي العجز</p>
                    <p className="text-xl font-bold text-red-600" data-testid="stat-shortage">{formatCurrency(stats.shortageAmount)}</p>
                    <p className="text-xs text-muted-foreground">{stats.totalShortages} حالة</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-100">
                    <TrendingUp className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">إجمالي الزيادة</p>
                    <p className="text-xl font-bold text-amber-600" data-testid="stat-surplus">{formatCurrency(stats.surplusAmount)}</p>
                    <p className="text-xs text-muted-foreground">{stats.totalSurpluses} حالة</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100">
                    <Users className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">متوسط الفاتورة</p>
                    <p className="text-xl font-bold" data-testid="stat-average-ticket">{formatCurrency(stats.averageTicket)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <div>
                <CardTitle>قائمة اليوميات</CardTitle>
                <CardDescription>
                  إجمالي: {filteredJournals?.length || 0} يومية
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="بحث..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pr-10 w-48"
                    data-testid="input-search"
                  />
                </div>
                <Select value={branchFilter} onValueChange={setBranchFilter}>
                  <SelectTrigger className="w-40" data-testid="select-branch">
                    <SelectValue placeholder="الفرع" />
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
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-36" data-testid="select-status">
                    <SelectValue placeholder="الحالة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الحالات</SelectItem>
                    <SelectItem value="draft">مسودة</SelectItem>
                    <SelectItem value="submitted">مُقدم</SelectItem>
                    <SelectItem value="approved">معتمد</SelectItem>
                    <SelectItem value="rejected">مرفوض</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={discrepancyFilter} onValueChange={setDiscrepancyFilter}>
                  <SelectTrigger className="w-32" data-testid="select-discrepancy">
                    <SelectValue placeholder="الفارق" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    <SelectItem value="balanced">متوازن</SelectItem>
                    <SelectItem value="shortage">عجز</SelectItem>
                    <SelectItem value="surplus">زيادة</SelectItem>
                  </SelectContent>
                </Select>
                <ExportButtons
                  data={filteredJournals || []}
                  columns={exportColumns}
                  fileName={`يوميات-الكاشير-${new Date().toISOString().split('T')[0]}`}
                  title="تقرير يوميات الكاشير"
                  subtitle={`الفترة: ${branchFilter !== 'all' ? getBranchName(branchFilter) : 'جميع الفروع'}`}
                  sheetName="يوميات الكاشير"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : filteredJournals?.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Wallet className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>لا توجد يوميات مطابقة للبحث</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredJournals?.slice((currentPage - 1) * 10, currentPage * 10).map((journal) => {
                  const discrepancy = DISCREPANCY_LABELS[journal.discrepancyStatus];
                  const status = STATUS_LABELS[journal.status];
                  const DiscrepancyIcon = discrepancy?.icon || Minus;

                  return (
                    <div
                      key={journal.id}
                      className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                      data-testid={`journal-row-${journal.id}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="font-medium text-lg">{journal.cashierName}</span>
                            <Badge variant={status?.variant || "secondary"}>{status?.label}</Badge>
                            <div className={`flex items-center gap-1 text-sm ${discrepancy?.color}`}>
                              <DiscrepancyIcon className="w-4 h-4" />
                              <span>{discrepancy?.label}</span>
                              {journal.discrepancyAmount > 0 && (
                                <span className="font-medium">({formatCurrency(journal.discrepancyAmount)})</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {formatDate(journal.journalDate)}
                            </span>
                            <span>{getBranchName(journal.branchId)}</span>
                            <span>{journal.shiftType === "morning" ? "صباحي" : journal.shiftType === "evening" ? "مسائي" : "ليلي"}</span>
                          </div>
                          <div className="flex items-center gap-6 text-sm">
                            <span>
                              <span className="text-muted-foreground">المبيعات: </span>
                              <span className="font-medium">{formatCurrency(journal.totalSales)}</span>
                            </span>
                            <span>
                              <span className="text-muted-foreground">العملاء: </span>
                              <span className="font-medium">{journal.customerCount || 0}</span>
                            </span>
                            <span>
                              <span className="text-muted-foreground">متوسط الفاتورة: </span>
                              <span className="font-medium">{formatCurrency(journal.averageTicket || 0)}</span>
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Link href={`/cashier-journals/${journal.id}`}>
                            <Button variant="ghost" size="sm" data-testid={`button-view-${journal.id}`}>
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>
                          {journal.status === "submitted" && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => approveMutation.mutate(journal.id)}
                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                data-testid={`button-approve-${journal.id}`}
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => rejectMutation.mutate({ id: journal.id })}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                data-testid={`button-reject-${journal.id}`}
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <TablePagination
                  currentPage={currentPage}
                  totalItems={filteredJournals?.length || 0}
                  itemsPerPage={10}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
