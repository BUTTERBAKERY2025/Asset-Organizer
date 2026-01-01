import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Plus, Search, Eye, Trash2, Calendar, DollarSign, Clock, CheckCircle, AlertTriangle, Factory, FileText, Play, Pause, XCircle, ClipboardList, ArrowRight, RefreshCw, Edit, Building2, Filter, Brain } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { TablePagination, usePagination } from "@/components/ui/pagination";
import type { Branch } from "@shared/schema";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any; color: string }> = {
  draft: { label: "مسودة", variant: "secondary", icon: FileText, color: "bg-gray-100 text-gray-800" },
  pending: { label: "قيد الانتظار", variant: "default", icon: Clock, color: "bg-yellow-100 text-yellow-800" },
  approved: { label: "معتمد", variant: "outline", icon: CheckCircle, color: "bg-blue-100 text-blue-800" },
  in_progress: { label: "قيد التنفيذ", variant: "default", icon: Play, color: "bg-purple-100 text-purple-800" },
  completed: { label: "مكتمل", variant: "outline", icon: CheckCircle, color: "bg-green-100 text-green-800" },
  cancelled: { label: "ملغي", variant: "destructive", icon: XCircle, color: "bg-red-100 text-red-800" },
};

const ORDER_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  daily: { label: "يومي", color: "bg-amber-100 text-amber-800" },
  weekly: { label: "أسبوعي", color: "bg-indigo-100 text-indigo-800" },
  long_term: { label: "طويل الأمد", color: "bg-teal-100 text-teal-800" },
};

export default function AdvancedProductionOrdersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [orderTypeFilter, setOrderTypeFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

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

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const { data: stats } = useQuery<OrderStats>({
    queryKey: ["/api/advanced-production-orders/stats"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest(`/api/advanced-production-orders/${id}`, "DELETE"),
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR" }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd/MM/yyyy", { locale: ar });
    } catch {
      return dateStr;
    }
  };

  const getStatusIcon = (status: string) => {
    const config = STATUS_CONFIG[status];
    if (!config) return null;
    const Icon = config.icon;
    return <Icon className="w-3 h-3" />;
  };

  return (
    <Layout>
      <div className="space-y-6 p-6" dir="rtl">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/production-dashboard">
              <Button variant="ghost" size="sm" className="gap-1 hover:text-amber-600" data-testid="btn-back-dashboard">
                <ArrowRight className="h-4 w-4" />
                لوحة الإنتاج
              </Button>
            </Link>
            <span>/</span>
            <span className="text-foreground">أوامر الإنتاج</span>
          </div>
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
                <ClipboardList className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">أوامر الإنتاج</h1>
                <p className="text-muted-foreground text-sm">إدارة ومتابعة جميع أوامر الإنتاج اليومية والأسبوعية</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && typeof q.queryKey[0] === 'string' && q.queryKey[0].includes('advanced-production') })} data-testid="btn-refresh">
                <RefreshCw className="h-4 w-4 ml-2" />
                تحديث
              </Button>
              <Link href="/ai-production-planner">
                <Button variant="outline" size="sm" className="border-purple-200 text-purple-700 hover:bg-purple-50" data-testid="btn-ai-planner">
                  <Brain className="h-4 w-4 ml-2" />
                  المخطط الذكي
                </Button>
              </Link>
              <Link href="/advanced-production-orders/new">
                <Button className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700" data-testid="button-new-order">
                  <Plus className="w-4 h-4 ml-2" />
                  أمر جديد
                </Button>
              </Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-4 text-center">
              <ClipboardList className="w-6 h-6 mx-auto mb-2 text-blue-600" />
              <p className="text-2xl font-bold text-blue-700" data-testid="stat-total">{stats?.total || 0}</p>
              <p className="text-xs text-blue-600">إجمالي الأوامر</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200">
            <CardContent className="p-4 text-center">
              <FileText className="w-6 h-6 mx-auto mb-2 text-gray-600" />
              <p className="text-2xl font-bold text-gray-700" data-testid="stat-draft">{stats?.draft || 0}</p>
              <p className="text-xs text-gray-600">مسودة</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
            <CardContent className="p-4 text-center">
              <Clock className="w-6 h-6 mx-auto mb-2 text-yellow-600" />
              <p className="text-2xl font-bold text-yellow-700" data-testid="stat-pending">{stats?.pending || 0}</p>
              <p className="text-xs text-yellow-600">قيد الانتظار</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-4 text-center">
              <Play className="w-6 h-6 mx-auto mb-2 text-purple-600" />
              <p className="text-2xl font-bold text-purple-700" data-testid="stat-in-progress">{stats?.inProgress || 0}</p>
              <p className="text-xs text-purple-600">قيد التنفيذ</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-4 text-center">
              <CheckCircle className="w-6 h-6 mx-auto mb-2 text-green-600" />
              <p className="text-2xl font-bold text-green-700" data-testid="stat-completed">{stats?.completed || 0}</p>
              <p className="text-xs text-green-600">مكتمل</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
            <CardContent className="p-4 text-center">
              <DollarSign className="w-6 h-6 mx-auto mb-2 text-amber-600" />
              <p className="text-lg font-bold text-amber-700" data-testid="stat-cost">{formatCurrency(stats?.totalEstimatedCost || 0)}</p>
              <p className="text-xs text-amber-600">التكلفة المتوقعة</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-0 shadow-sm bg-white/80 backdrop-blur">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-amber-600" />
              <CardTitle className="text-base">تصفية الأوامر</CardTitle>
              {(branchFilter !== "all" || statusFilter !== "all" || orderTypeFilter !== "all" || searchTerm) && (
                <Badge variant="secondary" className="mr-auto">
                  فلاتر نشطة
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="relative lg:col-span-2">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="بحث بالرقم أو العنوان..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10 bg-gray-50 border-gray-200 focus:bg-white"
                  data-testid="input-search"
                />
              </div>
              <Select value={branchFilter} onValueChange={setBranchFilter}>
                <SelectTrigger className="bg-gray-50 border-gray-200" data-testid="select-branch">
                  <Building2 className="h-4 w-4 ml-2 text-muted-foreground" />
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
                <SelectTrigger className="bg-gray-50 border-gray-200" data-testid="select-status">
                  <SelectValue placeholder="الحالة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الحالات</SelectItem>
                  {Object.entries(STATUS_CONFIG).map(([value, { label }]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={orderTypeFilter} onValueChange={setOrderTypeFilter}>
                <SelectTrigger className="bg-gray-50 border-gray-200" data-testid="select-order-type">
                  <SelectValue placeholder="نوع الأمر" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الأنواع</SelectItem>
                  {Object.entries(ORDER_TYPE_CONFIG).map(([value, { label }]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(branchFilter !== "all" || statusFilter !== "all" || orderTypeFilter !== "all" || searchTerm) && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                <span className="text-sm text-muted-foreground">النتائج: {filteredOrders?.length || 0} أمر</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="mr-auto text-amber-600 hover:text-amber-700"
                  onClick={() => {
                    setBranchFilter("all");
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
              <h3 className="text-lg font-semibold mb-2">لا توجد أوامر إنتاج</h3>
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
          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-gray-50/80 sticky top-0">
                  <TableRow>
                    <TableHead className="text-right font-semibold w-[120px]">رقم الأمر</TableHead>
                    <TableHead className="text-right font-semibold">العنوان</TableHead>
                    <TableHead className="text-right font-semibold w-[120px]">الفرع</TableHead>
                    <TableHead className="text-right font-semibold w-[100px]">النوع</TableHead>
                    <TableHead className="text-right font-semibold w-[100px]">الحالة</TableHead>
                    <TableHead className="text-right font-semibold w-[180px]">الفترة</TableHead>
                    <TableHead className="text-right font-semibold w-[80px]">الإنجاز</TableHead>
                    <TableHead className="text-right font-semibold w-[120px]">التكلفة</TableHead>
                    <TableHead className="text-left font-semibold w-[120px]">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedOrders?.map((order, index) => {
                    const statusConfig = STATUS_CONFIG[order.status];
                    const typeConfig = ORDER_TYPE_CONFIG[order.orderType];
                    return (
                      <TableRow 
                        key={order.id} 
                        className={`hover:bg-amber-50/50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}
                        data-testid={`row-order-${order.id}`}
                      >
                        <TableCell className="font-mono text-sm text-amber-700" data-testid={`text-order-number-${order.id}`}>
                          {order.orderNumber}
                        </TableCell>
                        <TableCell data-testid={`text-order-title-${order.id}`}>
                          <div className="font-medium truncate max-w-[200px]" title={order.title}>
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
                          <Badge variant="outline" className={`${typeConfig?.color || ""} text-xs`} data-testid={`badge-type-${order.id}`}>
                            {typeConfig?.label || order.orderType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${statusConfig?.color || ""} text-xs gap-1`} data-testid={`badge-status-${order.id}`}>
                            {getStatusIcon(order.status)}
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
                            <Progress value={order.completionPercentage} className="h-2 w-12" />
                            <span className="text-xs font-medium" data-testid={`text-progress-${order.id}`}>{order.completionPercentage}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-left font-medium text-amber-700" data-testid={`text-cost-${order.id}`}>
                          {formatCurrency(order.estimatedCost)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Link href={`/advanced-production-orders/${order.id}`}>
                              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-amber-100 hover:text-amber-700" data-testid={`button-view-${order.id}`}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Link href={`/advanced-production-orders/${order.id}/edit`}>
                              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-blue-100 hover:text-blue-700" data-testid={`button-edit-${order.id}`}>
                                <Edit className="h-4 w-4" />
                              </Button>
                            </Link>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-100 hover:text-red-700" data-testid={`button-delete-${order.id}`}>
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
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            
            {filteredOrders && filteredOrders.length > itemsPerPage && (
              <div className="p-4 border-t">
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
