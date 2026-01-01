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
import { Plus, Search, Eye, Trash2, Calendar, DollarSign, Clock, CheckCircle, AlertTriangle, Factory, FileText, Play, Pause, XCircle, ClipboardList } from "lucide-react";
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
  const { itemsPerPage, getPageItems } = usePagination(12);

  const { data: orders, isLoading } = useQuery<AdvancedProductionOrder[]>({
    queryKey: ["/api/advanced-production-orders", { branchId: branchFilter !== "all" ? branchFilter : undefined, status: statusFilter !== "all" ? statusFilter : undefined, orderType: orderTypeFilter !== "all" ? orderTypeFilter : undefined }],
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
      queryClient.invalidateQueries({ queryKey: ["/api/advanced-production-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/advanced-production-orders/stats"] });
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
      return format(new Date(dateStr), "dd MMM yyyy", { locale: ar });
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
      <div className="space-y-6" dir="rtl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">أوامر الإنتاج المتقدمة</h1>
            <p className="text-muted-foreground">إدارة أوامر الإنتاج اليومية والأسبوعية وطويلة الأمد</p>
          </div>
          <Link href="/advanced-production-orders/new">
            <Button data-testid="button-new-order">
              <Plus className="w-4 h-4 ml-2" />
              أمر جديد
            </Button>
          </Link>
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

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">تصفية الأوامر</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="بحث بالرقم أو العنوان..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                  data-testid="input-search"
                />
              </div>
              <Select value={branchFilter} onValueChange={setBranchFilter}>
                <SelectTrigger data-testid="select-branch">
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
                <SelectTrigger data-testid="select-status">
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
                <SelectTrigger data-testid="select-order-type">
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
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2 mb-4" />
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
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
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedOrders?.map((order) => {
                const statusConfig = STATUS_CONFIG[order.status];
                const typeConfig = ORDER_TYPE_CONFIG[order.orderType];
                return (
                  <Card key={order.id} className="hover:shadow-md transition-shadow" data-testid={`card-order-${order.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base truncate" data-testid={`text-order-title-${order.id}`}>
                            {order.title || order.orderNumber}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-mono">{order.orderNumber}</span>
                          </CardDescription>
                        </div>
                        <div className="flex flex-col gap-1 items-end">
                          <Badge className={statusConfig?.color || ""} data-testid={`badge-status-${order.id}`}>
                            {getStatusIcon(order.status)}
                            <span className="mr-1">{statusConfig?.label || order.status}</span>
                          </Badge>
                          <Badge variant="outline" className={typeConfig?.color || ""} data-testid={`badge-type-${order.id}`}>
                            {typeConfig?.label || order.orderType}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">الفرع:</span>
                        <span className="font-medium" data-testid={`text-branch-${order.id}`}>{getBranchName(order.sourceBranchId)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">من/إلى:</span>
                        <span className="font-medium text-xs" data-testid={`text-dates-${order.id}`}>
                          {formatDate(order.startDate)} - {formatDate(order.endDate)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">التكلفة المتوقعة:</span>
                        <span className="font-medium text-amber-600" data-testid={`text-cost-${order.id}`}>
                          {formatCurrency(order.estimatedCost)}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">نسبة الإنجاز:</span>
                          <span className="font-medium" data-testid={`text-progress-${order.id}`}>{order.completionPercentage}%</span>
                        </div>
                        <Progress value={order.completionPercentage} className="h-2" />
                      </div>
                      <div className="flex items-center gap-2 pt-2 border-t">
                        <Link href={`/advanced-production-orders/${order.id}`} className="flex-1">
                          <Button variant="outline" size="sm" className="w-full" data-testid={`button-view-${order.id}`}>
                            <Eye className="w-4 h-4 ml-1" />
                            عرض
                          </Button>
                        </Link>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" data-testid={`button-delete-${order.id}`}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>هل أنت متأكد من الحذف؟</AlertDialogTitle>
                              <AlertDialogDescription>
                                سيتم حذف الأمر "{order.title || order.orderNumber}" نهائياً. هذا الإجراء لا يمكن التراجع عنه.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
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
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <TablePagination
              currentPage={currentPage}
              totalItems={filteredOrders?.length || 0}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </div>
    </Layout>
  );
}
