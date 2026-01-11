import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { 
  Plus, 
  Search, 
  Eye, 
  CheckCircle, 
  XCircle, 
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
  Receipt
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
import { TablePagination } from "@/components/ui/pagination";
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

export default function BranchDailyClosuresPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [discrepancyFilter, setDiscrepancyFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedClosure, setSelectedClosure] = useState<BranchDailyClosure | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: closures, isLoading } = useQuery<BranchDailyClosure[]>({
    queryKey: ["/api/branch-daily-closures"],
  });

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const filteredBranches = branches?.filter(branch => {
    if (user?.role === "admin") return true;
    return user?.branchId === branch.id;
  });

  useEffect(() => {
    if (user?.role !== "admin" && user?.branchId && branchFilter === "all") {
      setBranchFilter(user.branchId);
    }
  }, [user, branchFilter]);

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

  const filteredClosures = closures?.filter(closure => {
    if (branchFilter !== "all" && closure.branchId !== branchFilter) return false;
    if (statusFilter !== "all" && closure.status !== statusFilter) return false;
    if (discrepancyFilter !== "all") {
      if (discrepancyFilter === "shortage" && closure.cashDiscrepancyStatus !== "shortage") return false;
      if (discrepancyFilter === "surplus" && closure.cashDiscrepancyStatus !== "surplus") return false;
      if (discrepancyFilter === "balanced" && closure.cashDiscrepancyStatus !== "balanced") return false;
    }
    if (dateFrom && closure.closureDate < dateFrom) return false;
    if (dateTo && closure.closureDate > dateTo) return false;
    return true;
  }) || [];

  const itemsPerPage = 20;
  const paginatedClosures = filteredClosures.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totals = filteredClosures.reduce((acc, c) => ({
    totalSales: acc.totalSales + (c.totalSales || 0),
    cashTotal: acc.cashTotal + (c.cashTotal || 0),
    networkTotal: acc.networkTotal + (c.networkTotal || 0),
    totalCashDiscrepancy: acc.totalCashDiscrepancy + (c.totalCashDiscrepancy || 0),
    totalBankDiscrepancy: acc.totalBankDiscrepancy + (c.totalBankDiscrepancy || 0),
    totalCustomerCount: acc.totalCustomerCount + (c.totalCustomerCount || 0),
    journalsCount: acc.journalsCount + (c.journalsCount || 0),
  }), {
    totalSales: 0,
    cashTotal: 0,
    networkTotal: 0,
    totalCashDiscrepancy: 0,
    totalBankDiscrepancy: 0,
    totalCustomerCount: 0,
    journalsCount: 0,
  });

  return (
    <Layout>
      <div className="container mx-auto p-4 lg:p-6 space-y-6" dir="rtl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">الإغلاقات اليومية للفروع</h1>
            <p className="text-gray-500 mt-1">إدارة ومراجعة الإغلاقات اليومية المجمعة</p>
          </div>
          <Link href="/branch-daily-closing">
            <Button className="gap-2 bg-amber-600 hover:bg-amber-700" data-testid="button-new-closure">
              <Plus className="h-4 w-4" />
              إغلاق يومي جديد
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card className="bg-gradient-to-br from-amber-50 to-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <Receipt className="h-4 w-4" />
                إجمالي الإغلاقات
              </div>
              <p className="text-2xl font-bold text-amber-700">{filteredClosures.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <DollarSign className="h-4 w-4" />
                إجمالي المبيعات
              </div>
              <p className="text-2xl font-bold text-green-700">{formatCurrency(totals.totalSales)}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-50 to-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <Wallet className="h-4 w-4" />
                النقدي
              </div>
              <p className="text-2xl font-bold text-blue-700">{formatCurrency(totals.cashTotal)}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-50 to-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <CreditCard className="h-4 w-4" />
                الشبكة
              </div>
              <p className="text-2xl font-bold text-purple-700">{formatCurrency(totals.networkTotal)}</p>
            </CardContent>
          </Card>
          <Card className={`bg-gradient-to-br ${totals.totalCashDiscrepancy < -0.5 ? 'from-red-50' : totals.totalCashDiscrepancy > 0.5 ? 'from-amber-50' : 'from-green-50'} to-white`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <AlertTriangle className="h-4 w-4" />
                فرق النقدي
              </div>
              <p className={`text-2xl font-bold ${totals.totalCashDiscrepancy < -0.5 ? 'text-red-700' : totals.totalCashDiscrepancy > 0.5 ? 'text-amber-700' : 'text-green-700'}`}>
                {formatCurrency(totals.totalCashDiscrepancy)}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-indigo-50 to-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <Users className="h-4 w-4" />
                العملاء
              </div>
              <p className="text-2xl font-bold text-indigo-700">{formatNumber(totals.totalCustomerCount)}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col lg:flex-row justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-amber-600" />
                قائمة الإغلاقات اليومية
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                <ExportButtons 
                  data={filteredClosures} 
                  columns={exportColumns} 
                  fileName="branch-daily-closures"
                  title="الإغلاقات اليومية للفروع"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
              <Select value={branchFilter} onValueChange={setBranchFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="جميع الفروع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الفروع</SelectItem>
                  {filteredBranches?.map(branch => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="جميع الحالات" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الحالات</SelectItem>
                  <SelectItem value="open">مفتوح</SelectItem>
                  <SelectItem value="closed">مغلق</SelectItem>
                </SelectContent>
              </Select>
              <Select value={discrepancyFilter} onValueChange={setDiscrepancyFilter}>
                <SelectTrigger>
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
                onChange={(e) => setDateFrom(e.target.value)}
                placeholder="من تاريخ"
              />
              <Input 
                type="date" 
                value={dateTo} 
                onChange={(e) => setDateTo(e.target.value)}
                placeholder="إلى تاريخ"
              />
            </div>

            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredClosures.length === 0 ? (
              <div className="text-center py-12">
                <Receipt className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">لا توجد إغلاقات</h3>
                <p className="text-gray-500">لم يتم العثور على إغلاقات يومية تطابق معايير البحث</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">التاريخ</TableHead>
                        <TableHead className="text-right">الفرع</TableHead>
                        <TableHead className="text-center">اليوميات</TableHead>
                        <TableHead className="text-left">المبيعات</TableHead>
                        <TableHead className="text-left">النقدي</TableHead>
                        <TableHead className="text-left">الشبكة</TableHead>
                        <TableHead className="text-center">العملاء</TableHead>
                        <TableHead className="text-center">فرق النقدي</TableHead>
                        <TableHead className="text-center">الحالة</TableHead>
                        <TableHead className="text-center">إجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedClosures.map((closure) => {
                        const StatusIcon = STATUS_LABELS[closure.status]?.icon || Clock;
                        const DiscrepancyIcon = DISCREPANCY_LABELS[closure.cashDiscrepancyStatus]?.icon || Minus;
                        
                        return (
                          <TableRow key={closure.id} data-testid={`row-closure-${closure.id}`}>
                            <TableCell className="font-medium">
                              {format(new Date(closure.closureDate), "d MMMM yyyy", { locale: ar })}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-gray-400" />
                                {getBranchName(closure.branchId)}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline">{closure.journalsCount}</Badge>
                            </TableCell>
                            <TableCell className="text-left font-semibold">
                              {formatCurrency(closure.totalSales)} ريال
                            </TableCell>
                            <TableCell className="text-left">
                              {formatCurrency(closure.cashTotal)} ريال
                            </TableCell>
                            <TableCell className="text-left">
                              {formatCurrency(closure.networkTotal)} ريال
                            </TableCell>
                            <TableCell className="text-center">
                              {formatNumber(closure.totalCustomerCount)}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className={`flex items-center justify-center gap-1 ${DISCREPANCY_LABELS[closure.cashDiscrepancyStatus]?.color}`}>
                                <DiscrepancyIcon className="h-4 w-4" />
                                <span>{formatCurrency(closure.totalCashDiscrepancy)}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant={STATUS_LABELS[closure.status]?.variant || "secondary"}>
                                <StatusIcon className="h-3 w-3 ml-1" />
                                {STATUS_LABELS[closure.status]?.label || closure.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-center gap-1">
                                <Link href={`/branch-daily-closures/${closure.id}`}>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </Link>
                                {closure.status === 'open' && (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-green-600 hover:text-green-700">
                                        <Lock className="h-4 w-4" />
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
                                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-600 hover:text-red-700">
                                        <Trash2 className="h-4 w-4" />
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

                <div className="mt-4">
                  <TablePagination 
                    currentPage={currentPage}
                    totalItems={filteredClosures.length}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setCurrentPage}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
