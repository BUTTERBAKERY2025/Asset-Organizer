import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useBranches } from "@/hooks/useBranches";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Plus, Search, Eye, CheckCircle, XCircle, Clock, AlertTriangle, TrendingUp, TrendingDown, Minus, Wallet, Calendar, DollarSign, Users, Printer, Filter, Trash2, RotateCcw, History, User as UserIcon, Paperclip } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import type { CashierSalesJournal, Branch } from "@shared/schema";
import { printHtmlContent } from "@/lib/print-utils";
import { TablePagination } from "@/components/ui/pagination";
import { ExportButtons } from "@/components/export-buttons";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Riyal } from "@/components/ui/riyal";

const STATUS_ICONS: Record<string, { variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { variant: "secondary" },
  submitted: { variant: "default" },
  approved: { variant: "outline" },
  rejected: { variant: "destructive" },
};

const DISCREPANCY_ICONS: Record<string, { color: string; icon: any }> = {
  balanced: { color: "text-emerald-600 dark:text-emerald-400", icon: Minus },
  shortage: { color: "text-rose-600 dark:text-rose-400", icon: TrendingDown },
  surplus: { color: "text-amber-600 dark:text-amber-400", icon: TrendingUp },
};

export default function CashierJournalsPage() {
  const { t } = useTranslation("cashierJournals");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isAdmin } = useAuth();
  const { branches, canSelectBranch, userBranchId } = useBranches();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [branchFilter, setBranchFilter] = useState<string>("");
  const [discrepancyFilter, setDiscrepancyFilter] = useState<string>("all");
  const [cashierFilter, setCashierFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);

  // Initialize the branch filter ONCE per mount. Previously this effect would
  // re-run any time userBranchId/canSelectBranch resolved (auth race) and
  // OVERWRITE a user's manual selection — silently hiding journals from the
  // branch they had explicitly picked. We now set it once, then never again.
  //
  // For users who CAN select branches (admins/multi-branch managers) we
  // default to "all" so a freshly-created journal for ANY branch is visible
  // immediately. This was the #1 root cause of the "saved but doesn't show
  // up" complaint: an admin would create a journal for branch B, but the
  // list defaulted to branch A (their primary) and the journal vanished.
  const branchFilterInitialized = useRef(false);
  useEffect(() => {
    if (branchFilterInitialized.current) return;
    if (canSelectBranch) {
      setBranchFilter("all");
      branchFilterInitialized.current = true;
    } else if (userBranchId) {
      setBranchFilter(userBranchId);
      branchFilterInitialized.current = true;
    }
  }, [userBranchId, canSelectBranch]);

  const { data: userPermissions } = useQuery<{ module: string; actions: string[] }[]>({
    queryKey: ["/api/my-permissions"],
    enabled: !!user,
  });

  const journalPerms = userPermissions?.find(p => p.module === 'cashier_journal');
  const perfPerms = userPermissions?.find(p => p.module === 'cashier_performance');
  const isManager = user?.role === 'admin' || user?.role === 'manager' 
    || journalPerms?.actions.includes('approve') || perfPerms?.actions.includes('approve');
  const canViewAllCashiers = isManager;

  const isBranchFilterReady = branchFilter !== "";

  // ===== Journals list: pass server-side filters (branch, status, discrepancy, dates) =====
  const { data: journals, isLoading } = useQuery<CashierSalesJournal[]>({
    queryKey: ["/api/cashier-journals", branchFilter, statusFilter, discrepancyFilter, dateFrom, dateTo],
    queryFn: async ({ queryKey }) => {
      const [, branch, status, discrepancy, from, to] = queryKey as string[];
      const params = new URLSearchParams();
      if (branch && branch !== "all") params.set("branchId", branch);
      if (status && status !== "all") params.set("status", status);
      if (discrepancy && discrepancy !== "all") params.set("discrepancyStatus", discrepancy);
      if (from) params.set("startDate", from);
      if (to) params.set("endDate", to);
      const qs = params.toString();
      const url = `/api/cashier-journals${qs ? `?${qs}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch cashier journals");
      const data = await res.json();
      return Array.isArray(data) ? data : (data.journals || []);
    },
    enabled: isBranchFilterReady,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
  
  const { data: stats, refetch: refetchStats } = useQuery<{
    totalJournals: number;
    totalSales: number;
    totalShortages: number;
    totalSurpluses: number;
    shortageAmount: number;
    surplusAmount: number;
    averageTicket: number;
  }>({
    queryKey: ["/api/cashier-journals/stats/summary", branchFilter, statusFilter, cashierFilter, dateFrom, dateTo],
    queryFn: async ({ queryKey }) => {
      const [, branch, status, cashier, from, to] = queryKey as string[];
      const params = new URLSearchParams();
      if (branch && branch !== "all") params.set("branchId", branch);
      if (status && status !== "all") params.set("status", status);
      if (cashier && cashier !== "all") params.set("cashierId", cashier);
      if (from) params.set("dateFrom", from);
      if (to) params.set("dateTo", to);
      params.set("_t", Date.now().toString());
      const queryString = params.toString();
      const url = `/api/cashier-journals/stats/summary?${queryString}`;
      const res = await fetch(url, { 
        credentials: "include",
        cache: "no-store"
      });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    staleTime: 15000,
    enabled: isBranchFilterReady,
  });

  const invalidateCashierQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/cashier-journals"] });
    queryClient.invalidateQueries({ queryKey: ["/api/cashier-journals/stats/summary"] });
    refetchStats();
  };
  
  const approveMutation = useMutation({
    mutationFn: async (id: number) => apiRequest(`/api/cashier-journals/${id}/approve`, "POST", {}),
    onSuccess: () => {
      invalidateCashierQueries();
      toast({ title: t("toasts.approved") });
    },
    onError: () => {
      toast({ title: t("toasts.error"), description: t("toasts.approveFailed"), variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: number; notes?: string }) =>
      apiRequest(`/api/cashier-journals/${id}/reject`, "POST", { notes }),
    onSuccess: () => {
      invalidateCashierQueries();
      toast({ title: t("toasts.rejected") });
    },
    onError: () => {
      toast({ title: t("toasts.error"), description: t("toasts.rejectFailed"), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/cashier-journals/${id}`),
    onSuccess: () => {
      invalidateCashierQueries();
      toast({ title: t("toasts.deleted") });
    },
    onError: (error: any) => {
      toast({ 
        title: t("toasts.error"), 
        description: error?.message || t("toasts.deleteFailed"), 
        variant: "destructive" 
      });
    },
  });

  // ===== Unpost (admin only) — revert posted/submitted back to draft =====
  const [unpostTarget, setUnpostTarget] = useState<{ id: number; cashierName: string; date: string } | null>(null);
  const [unpostReason, setUnpostReason] = useState("");
  const unpostMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason?: string }) =>
      apiRequest("POST", `/api/cashier-journals/${id}/unpost`, { reason }),
    onSuccess: () => {
      invalidateCashierQueries();
      setUnpostTarget(null);
      setUnpostReason("");
      toast({ title: "تم إلغاء الترحيل", description: "أصبحت اليومية مسودة قابلة للتعديل" });
    },
    onError: (error: any) => {
      toast({
        title: "تعذّر إلغاء الترحيل",
        description: error?.message || "حدث خطأ غير متوقع",
        variant: "destructive",
      });
    },
  });

  // ===== Audit log dialog (admin only) =====
  const [auditTarget, setAuditTarget] = useState<{ id: number; cashierName: string; date: string } | null>(null);
  const { data: auditLogs, isLoading: auditLoading } = useQuery<Array<{
    id: number; action: string; userName: string | null; description: string | null;
    details: string | null; createdAt: string;
  }>>({
    queryKey: [`/api/cashier-journals/${auditTarget?.id}/audit-logs`],
    enabled: !!auditTarget && isAdmin,
  });


  const getBranchName = (branchId: string) => {
    const branch = branches?.find((b) => b.id === branchId);
    return branch?.name || branchId;
  };

  const uniqueCashiers = journals ? Array.from(new Set(journals.map(j => j.cashierName))).filter(Boolean).sort() : [];
  
  const currentUserName = user?.firstName && user?.lastName 
    ? `${user.firstName} ${user.lastName}`.trim() 
    : user?.username || "";

  const dropdownCashiers = canViewAllCashiers 
    ? uniqueCashiers 
    : (uniqueCashiers.length > 0 ? uniqueCashiers : (currentUserName ? [currentUserName] : []));

  useEffect(() => {
    if (userPermissions !== undefined && !canViewAllCashiers && cashierFilter === "all" && dropdownCashiers.length > 0) {
      setCashierFilter(dropdownCashiers[0]);
    }
  }, [userPermissions, canViewAllCashiers, cashierFilter, dropdownCashiers]);

  // Server already filters by branch/status/discrepancy/dates.
  // Client only refines by free-text search and cashier-name (server filters by ID).
  const filteredJournals = journals?.filter((journal) => {
    const matchesSearch =
      !searchTerm ||
      journal.cashierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getBranchName(journal.branchId).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCashier = cashierFilter === "all" || journal.cashierName === cashierFilter;
    return matchesSearch && matchesCashier;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [branchFilter, statusFilter, discrepancyFilter, cashierFilter, dateFrom, dateTo, searchTerm]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR" }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), "dd MMMM yyyy", { locale: ar });
  };

  const exportColumns = [
    { header: t("export.date"), key: "journalDate", width: 12 },
    { header: t("export.cashier"), key: "cashierName", width: 20 },
    { header: t("export.branch"), key: "branchId", width: 15 },
    { header: t("export.shift"), key: "shiftType", width: 10 },
    { header: t("export.totalSales"), key: "totalSales", width: 15 },
    { header: t("export.cash"), key: "cashTotal", width: 12 },
    { header: t("export.network"), key: "networkTotal", width: 12 },
    { header: t("export.delivery"), key: "deliveryTotal", width: 12 },
    { header: t("export.customers"), key: "customerCount", width: 12 },
    { header: t("export.discrepancyStatus"), key: "discrepancyStatus", width: 12 },
    { header: t("export.discrepancyAmount"), key: "discrepancyAmount", width: 12 },
    { header: t("export.status"), key: "status", width: 10 },
  ];

  const handlePrintList = () => {
    if (!filteredJournals || filteredJournals.length === 0) {
      toast({ title: t("journalList.noPrintData"), variant: "destructive" });
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
  <title>${t("printTemplate.title")}</title>
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
  <div class="loading-msg" id="loadingMsg">${t("printTemplate.loading")}</div>
  <button class="print-btn" id="printBtn" style="display:none;" onclick="window.print()">${t("printTemplate.printBtn")}</button>
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
      <div class="title">${t("printTemplate.title")}</div>
      <div class="info">${branchFilter !== 'all' ? getBranchName(branchFilter) : t("filters.allBranches")} | ${filteredJournals.length} ${t("printTemplate.journal")}</div>
    </div>
    <div style="font-size:10px;font-weight:bold;color:#d4a853;">BUTTER BAKERY</div>
  </div>

  <div class="summary-row">
    <div class="summary-card"><div class="value">${formatCurrency(totalSales)}</div><div class="label">${t("printTemplate.totalSales")}</div></div>
    <div class="summary-card"><div class="value negative">-${formatCurrency(totalShortage)}</div><div class="label">${t("printTemplate.totalShortage")}</div></div>
    <div class="summary-card"><div class="value positive">+${formatCurrency(totalSurplus)}</div><div class="label">${t("printTemplate.totalSurplus")}</div></div>
    <div class="summary-card"><div class="value">${filteredJournals.length}</div><div class="label">${t("printTemplate.journalCount")}</div></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>${t("printTemplate.date")}</th>
        <th>${t("printTemplate.branch")}</th>
        <th>${t("printTemplate.cashier")}</th>
        <th>${t("printTemplate.shift")}</th>
        <th>${t("printTemplate.sales")}</th>
        <th>${t("printTemplate.cash")}</th>
        <th>${t("printTemplate.network")}</th>
        <th>${t("printTemplate.difference")}</th>
        <th>${t("printTemplate.status")}</th>
      </tr>
    </thead>
    <tbody>
      ${filteredJournals.map((j, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${j.journalDate}</td>
          <td>${getBranchName(j.branchId)}</td>
          <td>${j.cashierName || '-'}</td>
          <td>${j.shiftType ? t(`shifts.${j.shiftType}`) : '-'}</td>
          <td>${formatCurrency(j.totalSales || 0)}</td>
          <td>${formatCurrency(j.cashTotal || 0)}</td>
          <td>${formatCurrency(j.networkTotal || 0)}</td>
          <td class="discrepancy ${j.discrepancyStatus || 'balanced'}">${formatCurrency(j.discrepancyAmount || 0)}</td>
          <td><span class="status status-${j.status}">${t(`statuses.${j.status}`)}</span></td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="footer">
    <span>BUTTER BAKERY SYSTEM - CEO COMMAND</span>
    <span>${t("printTemplate.printDate")} ${new Date().toLocaleDateString('en-GB')}</span>
  </div>
</body>
</html>`;

    printHtmlContent(htmlContent);
  };

  return (
    <Layout>
      <div className="page-container space-y-3 sm:space-y-4" dir="rtl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-primary" data-testid="page-title">
              {t("pageTitle")}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 hidden sm:block">
              {t("pageSubtitle")}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePrintList} className="gap-2 h-11 sm:h-9 min-h-[44px] sm:min-h-0 text-sm px-3 sm:px-4" data-testid="button-print-list">
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">{t("printList")}</span>
              <span className="sm:hidden">{t("print")}</span>
            </Button>
            <Link href="/cashier-journals/new">
              <Button className="gap-2 h-11 sm:h-9 min-h-[44px] sm:min-h-0 text-sm px-3 sm:px-4" data-testid="button-new-journal">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">{t("newJournal")}</span>
                <span className="sm:hidden">{t("new")}</span>
              </Button>
            </Link>
          </div>
        </div>

        {stats && (
          <div className="kpi-grid">
            <KpiCard
              label={t("stats.totalSales")}
              value={stats.totalSales || 0}
              unit={<Riyal />}
              icon={DollarSign}
              tone="production"
              data-testid="stat-total-sales"
            />
            <KpiCard
              label={t("stats.totalShortage")}
              value={stats.shortageAmount || 0}
              unit={<Riyal />}
              icon={TrendingDown}
              tone="alert"
              subLabel={`${stats.totalShortages} ${t("stats.case")}`}
              data-testid="stat-shortage"
            />
            <KpiCard
              label={t("stats.totalSurplus")}
              value={stats.surplusAmount || 0}
              unit={<Riyal />}
              icon={TrendingUp}
              tone="inventory"
              subLabel={`${stats.totalSurpluses} ${t("stats.case")}`}
              data-testid="stat-surplus"
            />
            <KpiCard
              label={t("stats.avgSalesPerJournal")}
              value={stats.averageTicket || 0}
              unit={<Riyal />}
              icon={Users}
              tone="money"
              data-testid="stat-average-ticket"
            />
          </div>
        )}

        <Card>
          <CardHeader className="p-3 sm:p-6">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base sm:text-lg">{t("journalList.title")}</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    {t("journalList.total", { count: filteredJournals?.length || 0 })}
                  </CardDescription>
                </div>
                <ExportButtons
                  data={filteredJournals || []}
                  columns={exportColumns}
                  fileName={`${t("export.fileName")}-${new Date().toISOString().split('T')[0]}`}
                  title={t("export.reportTitle")}
                  subtitle={`${t("export.period")} ${branchFilter !== 'all' ? getBranchName(branchFilter) : t("filters.allBranches")}`}
                  sheetName={t("export.sheetName")}
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                <Select value={cashierFilter} onValueChange={setCashierFilter} disabled={!canViewAllCashiers && dropdownCashiers.length <= 1}>
                  <SelectTrigger className="h-11 sm:h-10 text-sm" data-testid="select-cashier">
                    <SelectValue placeholder={t("filters.cashier")} />
                  </SelectTrigger>
                  <SelectContent className="max-h-[320px] overflow-y-auto">
                    {canViewAllCashiers && <SelectItem value="all">{t("filters.allCashiers")}</SelectItem>}
                    {dropdownCashiers.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-11 sm:h-10 text-sm"
                  placeholder={t("filters.dateFrom")}
                  data-testid="input-date-from"
                />
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-11 sm:h-10 text-sm"
                  placeholder={t("filters.dateTo")}
                  data-testid="input-date-to"
                />
                <Select value={branchFilter} onValueChange={setBranchFilter} disabled={!canSelectBranch}>
                  <SelectTrigger className="h-11 sm:h-10 text-sm" data-testid="select-branch">
                    <SelectValue placeholder={t("filters.branch")} />
                  </SelectTrigger>
                  <SelectContent>
                    {canSelectBranch && <SelectItem value="all">{t("filters.allBranches")}</SelectItem>}
                    {branches?.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-11 sm:h-10 text-sm" data-testid="select-status">
                    <SelectValue placeholder={t("filters.status")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("filters.allStatuses")}</SelectItem>
                    <SelectItem value="draft">{t("statuses.draft")}</SelectItem>
                    <SelectItem value="submitted">{t("statuses.submittedShort")}</SelectItem>
                    <SelectItem value="approved">{t("statuses.approved")}</SelectItem>
                    <SelectItem value="rejected">{t("statuses.rejected")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 sm:h-20 w-full" />
                ))}
              </div>
            ) : filteredJournals?.length === 0 ? (
              <div className="text-center py-8 sm:py-12 text-muted-foreground">
                <Wallet className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 opacity-50" />
                <p className="text-sm sm:text-base">{t("journalList.noMatch")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-md border overflow-x-auto -mx-3 sm:mx-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-right w-24 sm:w-28 text-xs sm:text-sm">{t("table.date")}</TableHead>
                        <TableHead className="text-right text-xs sm:text-sm">{t("table.cashier")}</TableHead>
                        <TableHead className="text-right text-xs sm:text-sm hidden md:table-cell">{t("table.branch")}</TableHead>
                        <TableHead className="text-center w-16 sm:w-20 text-xs sm:text-sm hidden lg:table-cell">{t("table.shift")}</TableHead>
                        <TableHead className="text-left w-24 sm:w-28 text-xs sm:text-sm">{t("table.sales")}</TableHead>
                        <TableHead className="text-left w-20 sm:w-24 text-xs sm:text-sm hidden xl:table-cell">{t("table.customers")}</TableHead>
                        <TableHead className="text-center w-24 sm:w-28 text-xs sm:text-sm hidden sm:table-cell">{t("table.difference")}</TableHead>
                        <TableHead className="text-center w-20 sm:w-24 text-xs sm:text-sm">{t("table.status")}</TableHead>
                        <TableHead className="text-center w-16 sm:w-20 text-xs sm:text-sm hidden sm:table-cell">المرفقات</TableHead>
                        <TableHead className="text-center w-20 sm:w-24 text-xs sm:text-sm">{t("table.actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredJournals?.slice((currentPage - 1) * 20, currentPage * 20).map((journal) => {
                        const discrepancy = DISCREPANCY_ICONS[journal.discrepancyStatus];
                        const status = STATUS_ICONS[journal.status];
                        const DiscrepancyIcon = discrepancy?.icon || Minus;

                        return (
                          <TableRow 
                            key={journal.id} 
                            className="hover:bg-muted/30 cursor-pointer"
                            data-testid={`journal-row-${journal.id}`}
                          >
                            <TableCell className="text-xs sm:text-sm font-medium py-2 sm:py-3">
                              {journal.journalDate}
                            </TableCell>
                            <TableCell className="font-medium text-xs sm:text-sm py-2 sm:py-3">
                              <span className="line-clamp-1">{journal.cashierName}</span>
                            </TableCell>
                            <TableCell className="text-xs sm:text-sm text-muted-foreground hidden md:table-cell py-2 sm:py-3">
                              {getBranchName(journal.branchId)}
                            </TableCell>
                            <TableCell className="text-center text-xs sm:text-sm hidden lg:table-cell py-2 sm:py-3">
                              {journal.shiftType ? t(`shifts.${journal.shiftType}`) : '-'}
                            </TableCell>
                            <TableCell className="text-left font-medium text-xs sm:text-sm py-2 sm:py-3">
                              {formatCurrency(journal.totalSales)}
                            </TableCell>
                            <TableCell className="text-left text-xs sm:text-sm hidden xl:table-cell py-2 sm:py-3">
                              {journal.customerCount || 0}
                            </TableCell>
                            <TableCell className="text-center hidden sm:table-cell py-2 sm:py-3">
                              <div className={`flex items-center justify-center gap-1 text-[10px] sm:text-xs ${discrepancy?.color}`}>
                                <DiscrepancyIcon className="w-3 h-3" />
                                <span>{formatCurrency(Math.abs(journal.discrepancyAmount || 0))}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center py-2 sm:py-3">
                              <Badge variant={status?.variant || "secondary"} className="text-[10px] sm:text-xs px-1.5 sm:px-2">
                                {t(`statuses.${journal.status}`)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center py-2 sm:py-3 hidden sm:table-cell" data-testid={`attachment-count-${journal.id}`}>
                              {(() => {
                                const cnt = Number((journal as any).attachmentCount || 0);
                                return cnt > 0 ? (
                                  <Badge variant="outline" className="text-[10px] sm:text-xs px-1.5 sm:px-2 gap-1">
                                    <Paperclip className="w-3 h-3" />
                                    {cnt}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground text-[10px] sm:text-xs">—</span>
                                );
                              })()}
                            </TableCell>
                            <TableCell className="py-2 sm:py-3">
                              <div className="flex items-center justify-center gap-0.5 sm:gap-1">
                                <Link href={`/cashier-journals/${journal.id}`}>
                                  <Button variant="ghost" size="icon" className="h-11 w-11 sm:h-8 sm:w-8" data-testid={`button-view-${journal.id}`}>
                                    <Eye className="w-5 h-5 sm:w-4 sm:h-4" />
                                  </Button>
                                </Link>
                                {journal.status === "submitted" && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-11 w-11 sm:h-8 sm:w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                      onClick={() => approveMutation.mutate(journal.id)}
                                      data-testid={`button-approve-${journal.id}`}
                                    >
                                      <CheckCircle className="w-5 h-5 sm:w-4 sm:h-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-11 w-11 sm:h-8 sm:w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                      onClick={() => rejectMutation.mutate({ id: journal.id })}
                                      data-testid={`button-reject-${journal.id}`}
                                    >
                                      <XCircle className="w-5 h-5 sm:w-4 sm:h-4" />
                                    </Button>
                                  </>
                                )}
                                {isAdmin && (journal.status === "posted" || journal.status === "submitted") && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-11 w-11 sm:h-8 sm:w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                                    onClick={() => setUnpostTarget({ id: journal.id, cashierName: journal.cashierName, date: journal.journalDate })}
                                    data-testid={`button-unpost-${journal.id}`}
                                    title="إلغاء الترحيل"
                                  >
                                    <RotateCcw className="w-5 h-5 sm:w-4 sm:h-4" />
                                  </Button>
                                )}
                                {isAdmin && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-11 w-11 sm:h-8 sm:w-8 text-primary hover:bg-primary/10"
                                    onClick={() => setAuditTarget({ id: journal.id, cashierName: journal.cashierName, date: journal.journalDate })}
                                    data-testid={`button-audit-${journal.id}`}
                                    title="سجل التدقيق"
                                  >
                                    <History className="w-5 h-5 sm:w-4 sm:h-4" />
                                  </Button>
                                )}
                                {isAdmin && journal.status !== "approved" && (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-11 w-11 sm:h-8 sm:w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                        data-testid={`button-delete-${journal.id}`}
                                      >
                                        <Trash2 className="w-5 h-5 sm:w-4 sm:h-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="max-w-md" dir="rtl">
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>{t("deleteDialog.title")}</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          {t("deleteDialog.description", { cashier: journal.cashierName, date: journal.journalDate })}
                                          <br />
                                          <span className="text-red-500 font-medium">{t("deleteDialog.warning")}</span>
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter className="flex-row-reverse gap-2">
                                        <AlertDialogCancel>{t("deleteDialog.cancel")}</AlertDialogCancel>
                                        <AlertDialogAction
                                          className="bg-red-600 hover:bg-red-700"
                                          onClick={() => deleteMutation.mutate(journal.id)}
                                        >
                                          {t("deleteDialog.confirm")}
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <TablePagination
                  currentPage={currentPage}
                  totalItems={filteredJournals?.length || 0}
                  itemsPerPage={20}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Unpost confirmation dialog (admin only) */}
        <AlertDialog open={!!unpostTarget} onOpenChange={(open) => { if (!open) { setUnpostTarget(null); setUnpostReason(""); } }}>
          <AlertDialogContent className="max-w-md" dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-amber-600" />
                إلغاء ترحيل اليومية
              </AlertDialogTitle>
              <AlertDialogDescription>
                ستعود يومية <strong>{unpostTarget?.cashierName}</strong> بتاريخ <strong>{unpostTarget?.date}</strong> إلى حالة <strong>مسودة</strong> لتصبح قابلة للتعديل.
                <br />
                <span className="text-amber-600 font-medium">سيتم تسجيل هذا الإجراء في سجل التدقيق.</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-2">
              <label className="text-sm font-medium mb-2 block">سبب إلغاء الترحيل (اختياري)</label>
              <Textarea
                value={unpostReason}
                onChange={(e) => setUnpostReason(e.target.value)}
                placeholder="مثال: تصحيح خطأ في إجمالي المبيعات..."
                rows={3}
                data-testid="textarea-unpost-reason"
              />
            </div>
            <AlertDialogFooter className="flex-row-reverse gap-2">
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                className="bg-amber-600 hover:bg-amber-700"
                onClick={() => unpostTarget && unpostMutation.mutate({ id: unpostTarget.id, reason: unpostReason.trim() || undefined })}
                disabled={unpostMutation.isPending}
                data-testid="btn-confirm-unpost"
              >
                {unpostMutation.isPending ? "جارٍ التنفيذ..." : "تأكيد إلغاء الترحيل"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Audit log dialog (admin only) */}
        <Dialog open={!!auditTarget} onOpenChange={(open) => { if (!open) setAuditTarget(null); }}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                سجل التدقيق
              </DialogTitle>
              <DialogDescription>
                {auditTarget && (
                  <>يومية <strong>{auditTarget.cashierName}</strong> بتاريخ <strong>{auditTarget.date}</strong></>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-y-auto flex-1 -mx-6 px-6">
              {auditLoading ? (
                <div className="space-y-3 py-4">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : !auditLogs || auditLogs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <History className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p>لا توجد أحداث مسجّلة لهذه اليومية</p>
                </div>
              ) : (
                <div className="space-y-2 py-2">
                  {auditLogs.map((log) => {
                    const actionMap: Record<string, { label: string; className: string }> = {
                      create:   { label: "إنشاء",         className: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400" },
                      update:   { label: "تعديل",         className: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400" },
                      submit:   { label: "تقديم",         className: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" },
                      post:     { label: "ترحيل",         className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" },
                      unpost:   { label: "إلغاء ترحيل",   className: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" },
                      approve:  { label: "اعتماد",        className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" },
                      reject:   { label: "رفض",            className: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400" },
                      delete:   { label: "حذف",            className: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400" },
                    };
                    const meta = actionMap[log.action] || { label: log.action, className: "bg-muted text-muted-foreground" };
                    let details: any = null;
                    try { details = log.details ? JSON.parse(log.details) : null; } catch { /* ignore */ }
                    return (
                      <div key={log.id} className="border border-border rounded-lg p-3 hover:bg-muted/30 transition-colors" data-testid={`audit-row-${log.id}`}>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <Badge className={`${meta.className} text-xs`}>{meta.label}</Badge>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {format(new Date(log.createdAt), "yyyy-MM-dd HH:mm", { locale: ar })}
                          </span>
                        </div>
                        {log.description && (
                          <p className="text-sm text-foreground mb-1">{log.description}</p>
                        )}
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <UserIcon className="w-3 h-3" />
                          <span>{log.userName || "—"}</span>
                        </div>
                        {details && (details.reason || details.previousStatus) && (
                          <div className="mt-2 pt-2 border-t border-border/60 text-xs space-y-0.5">
                            {details.previousStatus && details.newStatus && (
                              <div className="text-muted-foreground">
                                الحالة: <span className="text-foreground">{details.previousStatus}</span>
                                {" → "}
                                <span className="text-foreground font-medium">{details.newStatus}</span>
                              </div>
                            )}
                            {details.reason && (
                              <div className="text-muted-foreground">
                                السبب: <span className="text-foreground">{details.reason}</span>
                              </div>
                            )}
                            {details.notes && (
                              <div className="text-muted-foreground">
                                ملاحظات: <span className="text-foreground">{details.notes}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
