import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { PageHeader } from "@/components/dashboard/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import {
  Plus, Search, Eye, Trash2, Calendar, DollarSign, Clock, CheckCircle, Factory,
  FileText, Play, XCircle, ClipboardList, ArrowRight, RefreshCw, Edit, Building2, Filter,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { TablePagination, usePagination } from "@/components/ui/pagination";
import { useBranches } from "@/hooks/useBranches";
import { useAuth } from "@/hooks/useAuth";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface AdvancedProductionOrder {
  id: number;
  orderNumber: string;
  title: string;
  sourceBranchId: string;
  targetBranchId?: string;
  orderType: "daily" | "weekly" | "long_term";
  status: "draft" | "pending" | "approved" | "in_progress" | "completed" | "cancelled";
  startDate: string;
  endDate: string;
  estimatedCost: number;
  actualCost?: number;
  completionPercentage: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface OrderStats {
  total: number;
  draft: number;
  pending: number;
  approved: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  daily: number;
  weekly: number;
  longTerm: number;
  totalEstimatedCost: number;
}

type StatusKey = "draft" | "pending" | "approved" | "in_progress" | "completed" | "cancelled";
const STATUS_CONFIG: Record<StatusKey, { label: string; icon: any; className: string }> = {
  draft:       { label: "مسودة",       icon: FileText,    className: "bg-muted text-muted-foreground border-border" },
  pending:     { label: "قيد الانتظار", icon: Clock,       className: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/40" },
  approved:    { label: "معتمد",        icon: CheckCircle, className: "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-900/40" },
  in_progress: { label: "قيد التنفيذ",  icon: Play,        className: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-900/40" },
  completed:   { label: "مكتمل",         icon: CheckCircle, className: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/40" },
  cancelled:   { label: "ملغي",          icon: XCircle,     className: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/40" },
};

type TypeKey = "daily" | "weekly" | "long_term";
const ORDER_TYPE_CONFIG: Record<TypeKey, { label: string; className: string }> = {
  daily:     { label: "يومي",       className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/40" },
  weekly:    { label: "أسبوعي",     className: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-900/40" },
  long_term: { label: "طويل الأمد", className: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/30 dark:text-teal-400 dark:border-teal-900/40" },
};

export default function AdvancedProductionOrdersPage() {
  const { branches, userBranchId, canSelectBranch } = useBranches();
  const { isAdmin } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [branchFilter, setBranchFilter] = useState<string>("");
  const [orderTypeFilter, setOrderTypeFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (userBranchId) {
      setBranchFilter(userBranchId);
    } else if (canSelectBranch) {
      setBranchFilter("all");
    }
  }, [userBranchId, canSelectBranch]);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { itemsPerPage, getPageItems } = usePagination(15);

  const ordersQueryUrl = (() => {
    const params = new URLSearchParams();
    if (branchFilter !== "all") params.append("branchId", branchFilter);
    if (statusFilter !== "all") params.append("status", statusFilter);
    if (orderTypeFilter !== "all") params.append("orderType", orderTypeFilter);
    const queryString = params.toString();
    return queryString ? `/api/advanced-production-orders?${queryString}` : "/api/advanced-production-orders";
  })();

  const { data: orders, isLoading } = useQuery<AdvancedProductionOrder[]>({
    queryKey: [ordersQueryUrl],
  });

  const { data: stats } = useQuery<OrderStats>({
    queryKey: ["/api/advanced-production-orders/stats"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/advanced-production-orders/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) =>
        Array.isArray(query.queryKey) &&
        typeof query.queryKey[0] === 'string' &&
        query.queryKey[0].startsWith("/api/advanced-production-orders")
      });
      toast({ title: "تم حذف الأمر بنجاح" });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في حذف الأمر", variant: "destructive" });
    },
  });

  const getBranchName = (branchId: string) => {
    const branch = branches?.find((b) => b.id === branchId);
    return branch?.name || branchId;
  };

  const filteredOrders = orders?.filter((order) => {
    const matchesSearch =
      order.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getBranchName(order.sourceBranchId).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    const matchesBranch = branchFilter === "all" || order.sourceBranchId === branchFilter;
    const matchesType = orderTypeFilter === "all" || order.orderType === orderTypeFilter;
    return matchesSearch && matchesStatus && matchesBranch && matchesType;
  });

  const paginatedOrders = getPageItems(filteredOrders || [], currentPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [branchFilter, statusFilter, orderTypeFilter, searchTerm]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR" }).format(amount);

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd/MM/yyyy");
    } catch {
      return dateStr;
    }
  };

  const hasActiveFilters =
    branchFilter !== "all" || statusFilter !== "all" || orderTypeFilter !== "all" || !!searchTerm;

  return (
    <Layout>
      <div className="page-container space-y-6" dir="rtl">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/production-dashboard">
            <Button variant="ghost" size="sm" className="gap-1 h-9" data-testid="btn-back-dashboard">
              <ArrowRight className="h-4 w-4" />
              لوحة الإنتاج
            </Button>
          </Link>
          <span>/</span>
          <span className="text-foreground">أوامر الإنتاج</span>
        </div>

        <PageHeader
          icon={ClipboardList}
          tone="production"
          title="أوامر الإنتاج"
          description="إدارة ومتابعة جميع أوامر الإنتاج اليومية والأسبوعية"
          actions={
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => queryClient.invalidateQueries({
                  predicate: (q) => Array.isArray(q.queryKey) && typeof q.queryKey[0] === 'string' && q.queryKey[0].includes('advanced-production')
                })}
                data-testid="btn-refresh"
              >
                <RefreshCw className="h-4 w-4 ml-2" />
                تحديث
              </Button>
              <Link href="/advanced-production-orders/new">
                <Button size="sm" data-testid="button-new-order">
                  <Plus className="w-4 h-4 ml-2" />
                  أمر جديد
                </Button>
              </Link>
            </div>
          }
        />

        {/* KPIs */}
        <div className="kpi-grid">
          <KpiCard
            label="إجمالي الأوامر"
            value={stats?.total || 0}
            icon={ClipboardList}
            tone="primary"
            subLabel="كل الأوامر المسجلة"
            data-testid="stat-total"
          />
          <KpiCard
            label="مسودة"
            value={stats?.draft || 0}
            icon={FileText}
            tone="neutral"
            subLabel="غير مُرسلة بعد"
            data-testid="stat-draft"
          />
          <KpiCard
            label="قيد الانتظار"
            value={stats?.pending || 0}
            icon={Clock}
            tone="inventory"
            subLabel="بانتظار الاعتماد"
            data-testid="stat-pending"
          />
          <KpiCard
            label="قيد التنفيذ"
            value={stats?.inProgress || 0}
            icon={Play}
            tone="violet"
            subLabel="جارٍ العمل عليها"
            data-testid="stat-in-progress"
          />
          <KpiCard
            label="مكتمل"
            value={stats?.completed || 0}
            icon={CheckCircle}
            tone="money"
            subLabel="أُنجزت بنجاح"
            data-testid="stat-completed"
          />
          <KpiCard
            label="التكلفة المتوقعة"
            value={formatCurrency(stats?.totalEstimatedCost || 0)}
            icon={DollarSign}
            tone="money"
            subLabel="مجموع التقديرات"
            data-testid="stat-cost"
          />
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">تصفية الأوامر</CardTitle>
              {hasActiveFilters && (
                <Badge variant="secondary" className="mr-auto">فلاتر نشطة</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="relative lg:col-span-2">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="بحث بالرقم أو العنوان..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10 h-10"
                  data-testid="input-search"
                />
              </div>
              <Select value={branchFilter} onValueChange={setBranchFilter}>
                <SelectTrigger className="h-10" data-testid="select-branch" disabled={!canSelectBranch}>
                  <Building2 className="h-4 w-4 ml-2 text-muted-foreground" />
                  <SelectValue placeholder="الفرع" />
                </SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto">
                  {canSelectBranch && <SelectItem value="all">جميع الفروع</SelectItem>}
                  {branches?.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-10" data-testid="select-status">
                  <SelectValue placeholder="الحالة" />
                </SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto">
                  <SelectItem value="all">جميع الحالات</SelectItem>
                  {Object.entries(STATUS_CONFIG).map(([value, { label }]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={orderTypeFilter} onValueChange={setOrderTypeFilter}>
                <SelectTrigger className="h-10" data-testid="select-order-type">
                  <SelectValue placeholder="نوع الأمر" />
                </SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto">
                  <SelectItem value="all">جميع الأنواع</SelectItem>
                  {Object.entries(ORDER_TYPE_CONFIG).map(([value, { label }]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {hasActiveFilters && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                <span className="text-sm text-muted-foreground">
                  النتائج: <span className="font-medium text-foreground">{filteredOrders?.length || 0}</span> أمر
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mr-auto text-primary hover:text-primary/80"
                  onClick={() => {
                    setBranchFilter(canSelectBranch ? "all" : (userBranchId ?? ""));
                    setStatusFilter("all");
                    setOrderTypeFilter("all");
                    setSearchTerm("");
                  }}
                  data-testid="btn-clear-filters"
                >
                  مسح الفلاتر
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Table / Empty / Loading */}
        {isLoading ? (
          <Card>
            <CardContent className="p-4">
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-10 flex-1" />
                    <Skeleton className="h-10 w-20" />
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-10 w-32" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : filteredOrders?.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Factory className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2 text-foreground">لا توجد أوامر إنتاج</h3>
              <p className="text-muted-foreground mb-4">لم يتم العثور على أوامر تطابق معايير البحث</p>
              <Link href="/advanced-production-orders/new">
                <Button>
                  <Plus className="w-4 h-4 ml-2" />
                  إنشاء أمر جديد
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <Table className="table-actions-sticky">
                <TableHeader className="bg-muted/50 sticky top-0">
                  <TableRow>
                    <TableHead className="text-right font-semibold w-[120px]">رقم الأمر</TableHead>
                    <TableHead className="text-right font-semibold">العنوان</TableHead>
                    <TableHead className="text-right font-semibold w-[120px]">الفرع</TableHead>
                    <TableHead className="text-right font-semibold w-[100px]">النوع</TableHead>
                    <TableHead className="text-right font-semibold w-[120px]">الحالة</TableHead>
                    <TableHead className="text-right font-semibold w-[180px]">الفترة</TableHead>
                    <TableHead className="text-right font-semibold w-[120px]">الإنجاز</TableHead>
                    <TableHead className="text-right font-semibold w-[120px]">التكلفة</TableHead>
                    <TableHead className="text-left font-semibold w-[140px]">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedOrders?.map((order) => {
                    const statusConfig = STATUS_CONFIG[order.status as StatusKey];
                    const typeConfig = ORDER_TYPE_CONFIG[order.orderType as TypeKey];
                    const StatusIcon = statusConfig?.icon;
                    return (
                      <TableRow
                        key={order.id}
                        className="hover:bg-muted/40 transition-colors"
                        data-testid={`row-order-${order.id}`}
                      >
                        <TableCell className="font-mono text-sm text-primary font-medium" data-testid={`text-order-number-${order.id}`}>
                          {order.orderNumber}
                        </TableCell>
                        <TableCell data-testid={`text-order-title-${order.id}`}>
                          <div className="font-medium truncate max-w-[220px] text-foreground" title={order.title}>
                            {order.title || "بدون عنوان"}
                          </div>
                        </TableCell>
                        <TableCell data-testid={`text-branch-${order.id}`}>
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm">{getBranchName(order.sourceBranchId)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`${typeConfig?.className || ""} text-xs`} data-testid={`badge-type-${order.id}`}>
                            {typeConfig?.label || order.orderType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`${statusConfig?.className || ""} text-xs gap-1`} data-testid={`badge-status-${order.id}`}>
                            {StatusIcon && <StatusIcon className="w-3 h-3" />}
                            {statusConfig?.label || order.status}
                          </Badge>
                        </TableCell>
                        <TableCell data-testid={`text-dates-${order.id}`}>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>{formatDate(order.startDate)}</span>
                            <span>←</span>
                            <span>{formatDate(order.endDate)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={order.completionPercentage} className="h-2 w-16" />
                            <span className="text-xs font-medium tabular-nums w-9 text-end" data-testid={`text-progress-${order.id}`}>
                              {order.completionPercentage}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-left font-medium text-foreground tabular-nums" data-testid={`text-cost-${order.id}`}>
                          {formatCurrency(order.estimatedCost)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 justify-start">
                            <Link href={`/advanced-production-orders/${order.id}`}>
                              <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-primary/10 hover:text-primary" data-testid={`button-view-${order.id}`}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Link href={`/advanced-production-orders/${order.id}/edit`}>
                              <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-primary/10 hover:text-primary" data-testid={`button-edit-${order.id}`}>
                                <Edit className="h-4 w-4" />
                              </Button>
                            </Link>
                            {isAdmin && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-destructive/10 hover:text-destructive" data-testid={`button-delete-${order.id}`}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent dir="rtl">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>هل أنت متأكد من الحذف؟</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      سيتم حذف الأمر "{order.title || order.orderNumber}" نهائياً. هذا الإجراء لا يمكن التراجع عنه.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter className="gap-2">
                                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteMutation.mutate(order.id)}
                                      className="bg-destructive hover:bg-destructive/90"
                                    >
                                      حذف
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

            {filteredOrders && filteredOrders.length > itemsPerPage && (
              <div className="p-4 border-t border-border">
                <TablePagination
                  currentPage={currentPage}
                  totalItems={filteredOrders.length}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </Card>
        )}
      </div>
    </Layout>
  );
}
