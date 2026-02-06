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
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
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
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [branchFilter, setBranchFilter] = useState<string>("");
  const [discrepancyFilter, setDiscrepancyFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { branches, userBranchId, canSelectBranch } = useBranches();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    if (userBranchId) {
      setBranchFilter(userBranchId);
    } else if (canSelectBranch) {
      setBranchFilter("all");
    }
  }, [userBranchId, canSelectBranch]);

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

  const { data, isLoading, isFetching } = useQuery<PaginatedResponse>({
    queryKey: ["/api/branch-daily-closures", queryParams],
    queryFn: async () => {
      const response = await fetch(`/api/branch-daily-closures?${queryParams}`, { credentials: 'include' });
      if (!response.ok) throw new Error("Failed to fetch");
      return response.json();
    },
    staleTime: 30000,
    placeholderData: (prev) => prev,
  });

  const closures = data?.closures || [];
  const pagination = data?.pagination || { page: 1, limit: 25, total: 0, totalPages: 0 };
  const totals = data?.totals || {
    totalSales: 0, cashTotal: 0, networkTotal: 0,
    totalCashDiscrepancy: 0, totalBankDiscrepancy: 0,
    totalCustomerCount: 0, journalsCount: 0,
  };

  const closeMutation = useMutation({
    mutationFn: async (id: number) => apiRequest(`/api/branch-daily-closures/${id}/close`, "POST", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch-daily-closures"] });
      toast({ title: "تم إغلاق اليومية بنجاح" });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في إغلاق اليومية", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest(`/api/branch-daily-closures/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch-daily-closures"] });
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
    if (canSelectBranch) setBranchFilter("all");
    setCurrentPage(1);
  };

  const hasActiveFilters = statusFilter !== "all" || discrepancyFilter !== "all" || dateFrom || dateTo || debouncedSearch;

  const startItem = (pagination.page - 1) * pagination.limit + 1;
  const endItem = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <Layout>
      <div className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-3 sm:space-y-4" dir="rtl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/cashier-journals">
              <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-8 sm:w-8" data-testid="btn-back">
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">الإغلاقات اليومية للفروع</h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                {pagination.total > 0 && <span className="font-medium text-amber-700">{pagination.total} إغلاق</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-9 w-9 p-0"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/branch-daily-closures"] })}
              disabled={isFetching}
              data-testid="button-refresh"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
            <Link href="/branch-daily-closing" className="flex-1 sm:flex-none">
              <Button className="gap-2 bg-amber-600 hover:bg-amber-700 w-full sm:w-auto h-9 text-xs sm:text-sm" data-testid="button-new-closure">
                <Plus className="h-4 w-4" />
                إغلاق يومي جديد
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
          <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-100">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 text-gray-500 text-[10px] sm:text-xs">
                <Receipt className="h-3.5 w-3.5" />
                الإغلاقات
              </div>
              <p className="text-lg sm:text-xl font-bold text-amber-700 mt-0.5">{pagination.total}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-white border-green-100">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 text-gray-500 text-[10px] sm:text-xs">
                <DollarSign className="h-3.5 w-3.5" />
                المبيعات
              </div>
              <p className="text-lg sm:text-xl font-bold text-green-700 mt-0.5">{formatCurrency(totals.totalSales)}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 text-gray-500 text-[10px] sm:text-xs">
                <Wallet className="h-3.5 w-3.5" />
                النقدي
              </div>
              <p className="text-lg sm:text-xl font-bold text-blue-700 mt-0.5">{formatCurrency(totals.cashTotal)}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-100">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 text-gray-500 text-[10px] sm:text-xs">
                <CreditCard className="h-3.5 w-3.5" />
                الشبكة
              </div>
              <p className="text-lg sm:text-xl font-bold text-purple-700 mt-0.5">{formatCurrency(totals.networkTotal)}</p>
            </CardContent>
          </Card>
          <Card className={`bg-gradient-to-br ${Number(totals.totalCashDiscrepancy) < -0.5 ? 'from-red-50 border-red-100' : Number(totals.totalCashDiscrepancy) > 0.5 ? 'from-amber-50 border-amber-100' : 'from-green-50 border-green-100'} to-white`}>
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 text-gray-500 text-[10px] sm:text-xs">
                <AlertTriangle className="h-3.5 w-3.5" />
                فرق النقدي
              </div>
              <p className={`text-lg sm:text-xl font-bold mt-0.5 ${Number(totals.totalCashDiscrepancy) < -0.5 ? 'text-red-700' : Number(totals.totalCashDiscrepancy) > 0.5 ? 'text-amber-700' : 'text-green-700'}`}>
                {formatCurrency(totals.totalCashDiscrepancy)}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-indigo-50 to-white border-indigo-100">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 text-gray-500 text-[10px] sm:text-xs">
                <Users className="h-3.5 w-3.5" />
                العملاء
              </div>
              <p className="text-lg sm:text-xl font-bold text-indigo-700 mt-0.5">{formatNumber(totals.totalCustomerCount)}</p>
            </CardContent>
          </Card>
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
                <Select value={branchFilter} onValueChange={handleFilterChange(setBranchFilter)}>
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
              {isLoading ? (
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
                          <TableRow className="bg-gray-50/50">
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
                                className="hover:bg-amber-50/30 transition-colors"
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
                                    <Link href={`/branch-daily-closures/${closure.id}`}>
                                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" data-testid={`button-view-${closure.id}`}>
                                        <Eye className="h-3.5 w-3.5" />
                                      </Button>
                                    </Link>
                                    {closure.status === 'open' && (
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
                                              onClick={() => closeMutation.mutate(closure.id)}
                                              className="bg-green-600 hover:bg-green-700"
                                            >
                                              تأكيد الإغلاق
                                            </AlertDialogAction>
                                            <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    )}
                                    {user?.role === 'admin' && closure.status === 'open' && (
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-600 hover:text-red-700" data-testid={`button-delete-${closure.id}`}>
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent dir="rtl">
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              هل أنت متأكد من حذف هذا الإغلاق اليومي؟ لا يمكن التراجع عن هذا الإجراء.
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter className="flex-row-reverse gap-2">
                                            <AlertDialogAction 
                                              onClick={() => deleteMutation.mutate(closure.id)}
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
