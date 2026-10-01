import { useState, useEffect, useMemo, useCallback } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useBranches } from "@/hooks/useBranches";
import { useBranchNavigation } from "@/hooks/use-branch-navigation";
import { usePermissions } from "@/hooks/usePermissions";
import { canApproveDailyClosure, dailyClosureCenterLabel, dailyClosureDateRange, dailyClosureHref, dailyClosureIntent, dailyClosureScopeReady } from "@/lib/daily-closure-navigation";
import { operationsCenterReturnHref } from "@/lib/operations-center-navigation";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation, useSearch } from "wouter";
import { 
  Plus, 
  Search, 
  Eye, 
  Clock, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Wallet, 
  Calendar, 
  DollarSign, 
  Users, 
  Lock,
  Unlock,
  Trash2,
  Building2,
  CreditCard,
  Receipt,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RefreshCw,
  X
} from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import type { Branch } from "@shared/schema";
import { ExportButtons } from "@/components/export-buttons";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Riyal } from "@/components/ui/riyal";
import { PageHeader } from "@/components/dashboard/page-header";

const formatCurrency = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined) return "0";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(amount);
};

const formatNumber = (num: number | null | undefined) => {
  if (num === null || num === undefined) return "0";
  return new Intl.NumberFormat("en-US").format(num);
};

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  open: { label: "مفتوح", variant: "secondary", icon: Unlock },
  closed: { label: "مغلق", variant: "default", icon: Lock },
};

const DISCREPANCY_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  balanced: { label: "متوازن", color: "text-green-600", icon: Minus },
  shortage: { label: "عجز", color: "text-red-600", icon: TrendingDown },
  surplus: { label: "زيادة", color: "text-amber-600", icon: TrendingUp },
};

type BranchDailyClosure = {
  id: number;
  branchId: string;
  closureDate: string;
  totalSales: number;
  cashTotal: number;
  networkTotal: number;
  deliveryTotal: number;
  totalOpeningBalance: number;
  totalExpectedCash: number;
  totalActualCash: number;
  totalCashDiscrepancy: number;
  cashDiscrepancyStatus: string;
  totalBankPosAmount: number;
  totalBankTerminalAmount: number;
  totalBankDiscrepancy: number;
  bankDiscrepancyStatus: string;
  totalCustomerCount: number;
  totalTransactionCount: number;
  averageTicket: number;
  journalsCount: number;
  status: string;
  notes: string | null;
  createdBy: string;
  closedBy: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type PaginatedResponse = {
  scopeKey: string;
  closures: BranchDailyClosure[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  totals: {
    totalSales: number;
    cashTotal: number;
    networkTotal: number;
    totalCashDiscrepancy: number;
    totalBankDiscrepancy: number;
    totalCustomerCount: number;
    journalsCount: number;
  };
};

const exportColumns = [
  { header: "التاريخ", key: "closureDate", width: 12 },
  { header: "الفرع", key: "branchId", width: 15 },
  { header: "عدد اليوميات", key: "journalsCount", width: 10 },
  { header: "إجمالي المبيعات", key: "totalSales", width: 15 },
  { header: "النقدي", key: "cashTotal", width: 12 },
  { header: "الشبكة", key: "networkTotal", width: 12 },
  { header: "التوصيل", key: "deliveryTotal", width: 12 },
  { header: "عدد العملاء", key: "totalCustomerCount", width: 12 },
  { header: "فرق النقدي", key: "totalCashDiscrepancy", width: 12 },
  { header: "فرق البنوك", key: "totalBankDiscrepancy", width: 12 },
  { header: "الحالة", key: "status", width: 10 },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export default function BranchDailyClosuresPage() {
  const linkedSearch = useSearch();
  const [, navigate] = useLocation();
  const intent = dailyClosureIntent(linkedSearch);
  const initialRange = dailyClosureDateRange(linkedSearch);
  const [filterSearch, setFilterSearch] = useState(linkedSearch);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [branchFilter, setBranchFilter] = useState<string>("");
  const [discrepancyFilter, setDiscrepancyFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState(initialRange.startDate);
  const [dateTo, setDateTo] = useState(initialRange.endDate);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const permissions = usePermissions();
  const permissionState = useQuery({ queryKey: ["/api/my-permissions"], enabled: false });
  const permissionsReady = !permissions.isLoading && permissionState.isSuccess && !permissionState.isFetching && !permissionState.isError;
  const { branches, userBranchId, canSelectBranch, isLoading: loadingBranches, isError: branchesFailed, error: branchError, refetch: refetchBranches } = useBranches();
  const navigationBranch = useBranchNavigation(branches, loadingBranches, userBranchId);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    if (navigationBranch.hasBranchParam) {
      if (!navigationBranch.isResolving && navigationBranch.branchId) setBranchFilter(navigationBranch.branchId);
    } else if (userBranchId) {
      setBranchFilter(userBranchId);
    } else if (canSelectBranch) {
      setBranchFilter("all");
    }
  }, [userBranchId, canSelectBranch, navigationBranch.hasBranchParam, navigationBranch.branchId, navigationBranch.isResolving]);

  useEffect(() => {
    const range = dailyClosureDateRange(linkedSearch);
    setDateFrom(range.startDate);
    setDateTo(range.endDate);
    setFilterSearch(linkedSearch);
    setCurrentPage(1);
  }, [linkedSearch]);

  const allowedIds = branches.map(branch => branch.id);
  const requestedBranch = new URLSearchParams(linkedSearch).get("branchId");
  const scopeReady = filterSearch === linkedSearch && !intent.invalidDate
    && (requestedBranch === null || allowedIds.includes(requestedBranch)) && dailyClosureScopeReady(
    branchFilter, allowedIds, loadingBranches, navigationBranch.hasBranchParam,
    navigationBranch.isResolving, navigationBranch.branchId, canSelectBranch,
  );

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(currentPage));
    params.set("limit", String(pageSize));
    if (branchFilter && branchFilter !== "all") params.set("branchId", branchFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (discrepancyFilter !== "all") params.set("discrepancy", discrepancyFilter);
    if (dateFrom) params.set("startDate", dateFrom);
    if (dateTo) params.set("endDate", dateTo);
    if (debouncedSearch) params.set("search", debouncedSearch);
    return params.toString();
  }, [currentPage, pageSize, branchFilter, statusFilter, discrepancyFilter, dateFrom, dateTo, debouncedSearch]);

  const { data: responseData, isLoading, isFetching, isError, error, refetch } = useQuery<PaginatedResponse>({
    queryKey: ["/api/branch-daily-closures", user?.id, queryParams],
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/branch-daily-closures?${queryParams}`, { credentials: 'include', signal, cache: "no-store" });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || body?.message || `تعذر تحميل الإغلاقات (${response.status})`);
      }
      return { ...await response.json(), scopeKey: queryParams };
    },
    staleTime: 0,
    enabled: scopeReady,
  });

  const data = scopeReady && !isError && responseData?.scopeKey === queryParams ? responseData : undefined;
  const closures = (data?.closures || []).filter(closure => allowedIds.includes(closure.branchId)
    && (branchFilter === "all" || closure.branchId === branchFilter)
    && (!dateFrom || closure.closureDate >= dateFrom) && (!dateTo || closure.closureDate <= dateTo));
  const pagination = data?.pagination || { page: 1, limit: 25, total: 0, totalPages: 0 };
  const totals = data?.totals || {
    totalSales: 0, cashTotal: 0, networkTotal: 0,
    totalCashDiscrepancy: 0, totalBankDiscrepancy: 0,
    totalCustomerCount: 0, journalsCount: 0,
  };

  const closeMutation = useMutation({
    mutationFn: async (closure: BranchDailyClosure) => {
      if (!canClose(closure)) throw new Error("لم يعد الاعتماد متاحًا لهذا السجل أو لهذا الفرع.");
      return apiRequest("POST", `/api/branch-daily-closures/${closure.id}/close`, {});
    },
    onSuccess: (_result, closure) => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch-daily-closures"] });
      queryClient.invalidateQueries({ queryKey: [`/api/branch-daily-closures/${closure.id}`], exact: true });
      queryClient.invalidateQueries({ queryKey: ["/api/operations-center/month-workflow"] });
      queryClient.invalidateQueries({ queryKey: ["/api/operations-center"] });
      queryClient.invalidateQueries({ queryKey: ["/api/operations-center/sales"] });
      toast({ title: "تم إغلاق اليومية بنجاح" });
    },
    onError: (cause) => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch-daily-closures"] });
      queryClient.invalidateQueries({ queryKey: ["/api/branch-daily-closures/journals-preview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-permissions"] });
      toast({ title: "خطأ", description: cause.message || "فشل في إغلاق اليومية", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (closure: BranchDailyClosure) => {
      if (!canDelete(closure)) throw new Error("لم يعد الحذف متاحًا لهذا السجل.");
      return apiRequest("DELETE", `/api/branch-daily-closures/${closure.id}`);
    },
    onSuccess: (_result, closure) => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch-daily-closures"] });
      queryClient.invalidateQueries({ queryKey: ["/api/branch-daily-closures/journals-preview"] });
      queryClient.invalidateQueries({ queryKey: [`/api/branch-daily-closures/${closure.id}`], exact: true });
      queryClient.invalidateQueries({ queryKey: ["/api/operations-center/month-workflow"] });
      queryClient.invalidateQueries({ queryKey: ["/api/operations-center"] });
      queryClient.invalidateQueries({ queryKey: ["/api/operations-center/sales"] });
      toast({ title: "تم حذف الإغلاق اليومي بنجاح" });
    },
    onError: (error: any) => {
      toast({ 
        title: "خطأ", 
        description: error?.message || "فشل في حذف الإغلاق اليومي", 
        variant: "destructive" 
      });
    },
  });

  const canClose = (closure: BranchDailyClosure): boolean => {
    const current = closures.find(row => row.id === closure.id);
    return !!current && canApproveDailyClosure(current, {
      actorId: user?.id, actorRole: user?.role, permitted: permissionsReady && permissions.canApprove("daily_closures"),
      scopeReady, pending: closeMutation.isPending || deleteMutation.isPending, fetching: isFetching,
      allowedIds, branchId: branchFilter, startDate: dateFrom, endDate: dateTo,
    });
  };
  const canDelete = (closure: BranchDailyClosure): boolean => user?.role === "admin" && permissionsReady
    && permissions.canDelete("daily_closures") && scopeReady && !isFetching
    && !closeMutation.isPending && !deleteMutation.isPending
    && closure.status === "open" && closures.some(row => row.id === closure.id && row.status === "open");
  const selectedDay = dateFrom && dateFrom === dateTo ? dateFrom : "";
  const destination = (target: "list" | "create" | number, branch = branchFilter, day = selectedDay) =>
    dailyClosureHref(target, linkedSearch, branch, day,
      day && intent.month && !day.startsWith(`${intent.month}-`) ? day.slice(0, 7) : intent.month);
  const fromCenter = new URLSearchParams(linkedSearch).get("from") === "operations-center";

  const getBranchName = (branchId: string) => {
    return branches?.find(b => b.id === branchId)?.name || branchId;
  };

  const handleFilterChange = useCallback((setter: (val: string) => void) => {
    return (val: string) => {
      setter(val);
      setCurrentPage(1);
    };
  }, []);

  const clearAllFilters = () => {
    setSearchTerm("");
    setDebouncedSearch("");
    setStatusFilter("all");
    setDiscrepancyFilter("all");
    setDateFrom("");
    setDateTo("");
    if (canSelectBranch) {
      setBranchFilter("all");
    }
    navigate(dailyClosureHref("list", linkedSearch, canSelectBranch ? "all" : branchFilter, "", ""));
    setCurrentPage(1);
  };

  const hasActiveFilters = statusFilter !== "all" || discrepancyFilter !== "all" || dateFrom || dateTo || debouncedSearch;

  const startItem = (pagination.page - 1) * pagination.limit + 1;
  const endItem = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <Layout>
      <div className="page-container space-y-3 sm:space-y-4" dir="rtl">
        <PageHeader
          icon={Receipt}
          tone="inventory"
          title="الإغلاقات اليومية للفروع"
          description={pagination.total > 0 ? `${pagination.total} إغلاق` : undefined}
          backHref={fromCenter ? operationsCenterReturnHref(linkedSearch, allowedIds) : "/cashier-journals"}
          backLabel={fromCenter ? `العودة إلى ${dailyClosureCenterLabel(linkedSearch)}` : "العودة إلى يوميات الكاشير"}
          actions={
            <>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-9 w-9 p-0"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/branch-daily-closures"] })}
                disabled={isFetching}
                data-testid="button-refresh"
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              </Button>
              {scopeReady && permissionsReady && permissions.canCreate("daily_closures") && <Link href={destination("create", branchFilter, selectedDay || dateFrom)}>
                <Button size="sm" className="gap-2 bg-amber-600 hover:bg-amber-700 text-white h-9" data-testid="button-new-closure">
                  <Plus className="h-4 w-4" />
                  إغلاق يومي جديد
                </Button>
              </Link>}
            </>
          }
        />

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
          <KpiCard
            label="الإغلاقات"
            value={formatNumber(pagination.total)}
            icon={Receipt}
            tone="inventory"
            data-testid="kpi-closures-count"
          />
          <KpiCard
            label="المبيعات"
            value={Number(totals.totalSales) || 0}
            unit={<Riyal />}
            icon={DollarSign}
            tone="money"
            data-testid="kpi-total-sales"
          />
          <KpiCard
            label="النقدي"
            value={Number(totals.cashTotal) || 0}
            unit={<Riyal />}
            icon={Wallet}
            tone="production"
            data-testid="kpi-cash-total"
          />
          <KpiCard
            label="الشبكة"
            value={Number(totals.networkTotal) || 0}
            unit={<Riyal />}
            icon={CreditCard}
            tone="violet"
            data-testid="kpi-network-total"
          />
          <KpiCard
            label="فرق النقدي"
            value={Number(totals.totalCashDiscrepancy) || 0}
            unit={<Riyal />}
            icon={AlertTriangle}
            tone={Number(totals.totalCashDiscrepancy) < -0.5 ? "alert" : Number(totals.totalCashDiscrepancy) > 0.5 ? "inventory" : "money"}
            data-testid="kpi-cash-discrepancy"
          />
          <KpiCard
            label="العملاء"
            value={formatNumber(totals.totalCustomerCount)}
            icon={Users}
            tone="people"
            data-testid="kpi-customers-count"
          />
        </div>

        <Card>
          <CardHeader className="p-3 sm:p-4 pb-2 sm:pb-3">
            <div className="flex flex-col lg:flex-row justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" />
                قائمة الإغلاقات اليومية
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                <ExportButtons 
                  data={closures} 
                  columns={exportColumns} 
                  fileName="branch-daily-closures"
                  title="الإغلاقات اليومية للفروع"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="بحث سريع بالتاريخ أو اسم الفرع..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pr-9 h-9 text-xs sm:text-sm"
                    data-testid="input-search"
                  />
                  {searchTerm && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                      onClick={() => { setSearchTerm(""); setDebouncedSearch(""); }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-9 text-xs text-red-600 hover:text-red-700 gap-1">
                    <X className="h-3.5 w-3.5" />
                    مسح الفلاتر
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                <Select value={branchFilter} onValueChange={value => {
                  setBranchFilter(value);
                  setCurrentPage(1);
                  navigate(destination("list", value));
                }}>
                  <SelectTrigger disabled={!canSelectBranch} className="h-9 text-xs sm:text-sm">
                    <SelectValue placeholder="جميع الفروع" />
                  </SelectTrigger>
                  <SelectContent>
                    {canSelectBranch && <SelectItem value="all">جميع الفروع</SelectItem>}
                    {branches?.map(branch => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={handleFilterChange(setStatusFilter)}>
                  <SelectTrigger className="h-9 text-xs sm:text-sm">
                    <SelectValue placeholder="جميع الحالات" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الحالات</SelectItem>
                    <SelectItem value="open">مفتوح</SelectItem>
                    <SelectItem value="closed">مغلق</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={discrepancyFilter} onValueChange={handleFilterChange(setDiscrepancyFilter)}>
                  <SelectTrigger className="h-9 text-xs sm:text-sm">
                    <SelectValue placeholder="حالة العجز" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    <SelectItem value="shortage">عجز</SelectItem>
                    <SelectItem value="surplus">زيادة</SelectItem>
                    <SelectItem value="balanced">متوازن</SelectItem>
                  </SelectContent>
                </Select>
                <Input 
                  type="date" 
                  value={dateFrom} 
                  onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
                  placeholder="من تاريخ"
                  className="h-9 text-xs sm:text-sm"
                />
                <Input 
                  type="date" 
                  value={dateTo} 
                  onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
                  placeholder="إلى تاريخ"
                  className="h-9 text-xs sm:text-sm"
                />
              </div>
            </div>

            <div className="mt-3">
              {branchesFailed ? (
                <div role="alert" className="space-y-2 py-6 text-destructive"><p>{branchError?.message || "تعذر التحقق من الفروع المسموحة."}</p><Button variant="outline" onClick={() => refetchBranches()}>إعادة التحقق من الفروع</Button></div>
              ) : intent.invalidDate ? (
                <p role="alert" className="py-6 text-destructive">تاريخ الإغلاق في الرابط غير صالح أو لا يطابق الشهر المختار. افتح اليوم من ملف الشهر مجددًا.</p>
              ) : isError ? (
                <div role="alert" className="space-y-2 py-6 text-destructive"><p>{error.message}</p><Button variant="outline" onClick={() => refetch()}>إعادة المحاولة</Button></div>
              ) : !scopeReady && !loadingBranches && !navigationBranch.isResolving && filterSearch === linkedSearch && branchFilter ? (
                <p role="alert" className="py-6 text-destructive">الفرع المحدد غير متاح ضمن نطاقك الحالي. اختر فرعًا مسموحًا؛ لا يمكن تنفيذ إجراء على سجلات فرع سابق.</p>
              ) : isLoading || !scopeReady ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : closures.length === 0 ? (
                <div className="text-center py-10">
                  <Receipt className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-base font-medium text-gray-900 mb-1">لا توجد إغلاقات</h3>
                  <p className="text-sm text-gray-500">لم يتم العثور على إغلاقات يومية تطابق معايير البحث</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto -mx-3 sm:mx-0">
                    <div className="min-w-[800px] sm:min-w-0">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="text-right text-xs font-bold">التاريخ</TableHead>
                            <TableHead className="text-right text-xs font-bold">الفرع</TableHead>
                            <TableHead className="text-center text-xs font-bold">اليوميات</TableHead>
                            <TableHead className="text-left text-xs font-bold">المبيعات</TableHead>
                            <TableHead className="text-left text-xs font-bold">النقدي</TableHead>
                            <TableHead className="text-left text-xs font-bold">الشبكة</TableHead>
                            <TableHead className="text-center text-xs font-bold">العملاء</TableHead>
                            <TableHead className="text-center text-xs font-bold">فرق النقدي</TableHead>
                            <TableHead className="text-center text-xs font-bold">الحالة</TableHead>
                            <TableHead className="text-center text-xs font-bold">إجراءات</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {closures.map((closure) => {
                            const StatusIcon = STATUS_LABELS[closure.status]?.icon || Clock;
                            const DiscrepancyIcon = DISCREPANCY_LABELS[closure.cashDiscrepancyStatus]?.icon || Minus;
                            
                            return (
                              <TableRow 
                                key={closure.id} 
                                data-testid={`row-closure-${closure.id}`}
                                className="hover:bg-muted/30 transition-colors"
                              >
                                <TableCell className="font-medium text-xs sm:text-sm py-2.5">
                                  {format(new Date(closure.closureDate), "d MMMM yyyy", { locale: ar })}
                                </TableCell>
                                <TableCell className="py-2.5">
                                  <div className="flex items-center gap-1.5 text-xs sm:text-sm">
                                    <Building2 className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                                    <span className="truncate max-w-[120px]">{getBranchName(closure.branchId)}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center py-2.5">
                                  <Badge variant="outline" className="text-[10px] sm:text-xs">{closure.journalsCount}</Badge>
                                </TableCell>
                                <TableCell className="text-left font-semibold text-xs sm:text-sm py-2.5">
                                  {formatCurrency(closure.totalSales)} ريال
                                </TableCell>
                                <TableCell className="text-left text-xs sm:text-sm py-2.5">
                                  {formatCurrency(closure.cashTotal)} ريال
                                </TableCell>
                                <TableCell className="text-left text-xs sm:text-sm py-2.5">
                                  {formatCurrency(closure.networkTotal)} ريال
                                </TableCell>
                                <TableCell className="text-center text-xs sm:text-sm py-2.5">
                                  {formatNumber(closure.totalCustomerCount)}
                                </TableCell>
                                <TableCell className="text-center py-2.5">
                                  <div className={`flex items-center justify-center gap-1 text-xs sm:text-sm ${DISCREPANCY_LABELS[closure.cashDiscrepancyStatus]?.color}`}>
                                    <DiscrepancyIcon className="h-3.5 w-3.5" />
                                    <span>{formatCurrency(closure.totalCashDiscrepancy)}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center py-2.5">
                                  <Badge variant={STATUS_LABELS[closure.status]?.variant || "secondary"} className="text-[10px] sm:text-xs">
                                    <StatusIcon className="h-3 w-3 ml-1" />
                                    {STATUS_LABELS[closure.status]?.label || closure.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="py-2.5">
                                  <div className="flex items-center justify-center gap-0.5">
                                    <Link href={destination(closure.id, closure.branchId)}>
                                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" data-testid={`button-view-${closure.id}`}>
                                        <Eye className="h-3.5 w-3.5" />
                                      </Button>
                                    </Link>
                                    {canClose(closure) && (
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-green-600 hover:text-green-700" data-testid={`button-close-${closure.id}`}>
                                            <Lock className="h-3.5 w-3.5" />
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent dir="rtl">
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>تأكيد إغلاق اليومية</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              هل أنت متأكد من إغلاق هذه اليومية؟ لن يمكن التعديل عليها بعد الإغلاق.
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter className="flex-row-reverse gap-2">
                                            <AlertDialogAction 
                                              disabled={!canClose(closure)}
                                              onClick={() => { if (canClose(closure)) closeMutation.mutate(closure); }}
                                              className="bg-green-600 hover:bg-green-700"
                                            >
                                              تأكيد الإغلاق
                                            </AlertDialogAction>
                                            <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    )}
                                    {canDelete(closure) && (
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-600 hover:text-red-700" data-testid={`button-delete-${closure.id}`}>
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent dir="rtl">
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>إلغاء لقطة الإغلاق المفتوح</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              ستُحذف لقطة الإغلاق المفتوح وروابطها فقط، ولن تُحذف اليوميات أو تتغير حالتها. إن كان الهدف تصحيح يومية، صححها في مصدرها ثم أعد إنشاء الإغلاق. لا يمكن التراجع عن حذف اللقطة، ولا يمكن حذف إغلاق معتمد.
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter className="flex-row-reverse gap-2">
                                            <AlertDialogAction 
                                              disabled={!canDelete(closure)}
                                              onClick={() => { if (canDelete(closure)) deleteMutation.mutate(closure); }}
                                              className="bg-red-600 hover:bg-red-700"
                                            >
                                              حذف
                                            </AlertDialogAction>
                                            <AlertDialogCancel>إلغاء</AlertDialogCancel>
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
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-3 border-t">
                    <div className="flex items-center gap-3 text-xs sm:text-sm text-gray-600 w-full sm:w-auto justify-between sm:justify-start">
                      <span>
                        عرض {startItem} - {endItem} من {pagination.total}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-500">سجل/صفحة:</span>
                        <Select value={String(pageSize)} onValueChange={(val) => { setPageSize(Number(val)); setCurrentPage(1); }}>
                          <SelectTrigger className="h-7 w-[65px] text-xs" data-testid="select-page-size">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PAGE_SIZE_OPTIONS.map(size => (
                              <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage <= 1}
                        data-testid="button-first-page"
                      >
                        <ChevronsRight className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage <= 1}
                        data-testid="button-prev-page"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                      
                      <div className="flex items-center gap-1 mx-1">
                        {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                          let pageNum: number;
                          if (pagination.totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= pagination.totalPages - 2) {
                            pageNum = pagination.totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }
                          return (
                            <Button
                              key={pageNum}
                              variant={currentPage === pageNum ? "default" : "outline"}
                              size="sm"
                              className={`h-8 w-8 p-0 text-xs ${currentPage === pageNum ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
                              onClick={() => setCurrentPage(pageNum)}
                              data-testid={`button-page-${pageNum}`}
                            >
                              {pageNum}
                            </Button>
                          );
                        })}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                        disabled={currentPage >= pagination.totalPages}
                        data-testid="button-next-page"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setCurrentPage(pagination.totalPages)}
                        disabled={currentPage >= pagination.totalPages}
                        data-testid="button-last-page"
                      >
                        <ChevronsLeft className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
