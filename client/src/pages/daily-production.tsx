import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { TablePagination, usePagination } from "@/components/ui/pagination";
import type { Branch, Product } from "@shared/schema";
import { 
  Factory, Plus, Clock, Package, Trash2, RefreshCw, Calendar,
  Refrigerator, ShoppingCart, Snowflake, ChefHat, ArrowLeft,
  BarChart3, TrendingUp, FileSpreadsheet
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { Link } from "wouter";
import * as XLSX from "xlsx";

interface DailyProductionBatch {
  id: number;
  branchId: string;
  productId: number | null;
  productName: string;
  productCategory: string | null;
  quantity: number;
  unit: string | null;
  destination: string;
  shiftId: number | null;
  productionOrderId: number | null;
  producedAt: string;
  recordedBy: string | null;
  recorderName: string | null;
  notes: string | null;
  createdAt: string;
}

interface DailyStats {
  totalBatches: number;
  totalQuantity: number;
  byDestination: Record<string, number>;
  byCategory: Record<string, number>;
  byHour: Record<string, number>;
}

const DESTINATIONS = [
  { value: "display_bar", label: "بار العرض", icon: ShoppingCart, color: "bg-green-100 text-green-800" },
  { value: "kitchen_trolley", label: "ترولي المطبخ", icon: ChefHat, color: "bg-amber-100 text-amber-800" },
  { value: "freezer", label: "الفريزر", icon: Snowflake, color: "bg-blue-100 text-blue-800" },
  { value: "refrigerator", label: "الثلاجة", icon: Refrigerator, color: "bg-cyan-100 text-cyan-800" },
];

const BAKERY_CATEGORIES = ["مخبوزات", "حلويات", "معجنات", "كيك", "خبز"];

export default function DailyProductionPage() {
  const [branchId, setBranchId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [productName, setProductName] = useState<string>("");
  const [productCategory, setProductCategory] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [destination, setDestination] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { itemsPerPage, getPageItems } = usePagination(15);

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: batches, isLoading: batchesLoading, refetch: refetchBatches } = useQuery<DailyProductionBatch[]>({
    queryKey: ["/api/daily-production/batches", branchId, selectedDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (branchId) params.set("branchId", branchId);
      if (selectedDate) params.set("date", selectedDate);
      const res = await fetch(`/api/daily-production/batches?${params}`);
      if (!res.ok) throw new Error("Failed to fetch batches");
      return res.json();
    },
    enabled: !!branchId,
  });

  const { data: stats, isLoading: statsLoading } = useQuery<DailyStats>({
    queryKey: ["/api/daily-production/stats", branchId, selectedDate],
    queryFn: async () => {
      const params = new URLSearchParams({ branchId, date: selectedDate });
      const res = await fetch(`/api/daily-production/stats?${params}`);
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    enabled: !!branchId && !!selectedDate,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/daily-production/batches", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/daily-production/batches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/daily-production/stats"] });
      setProductName("");
      setProductCategory("");
      setQuantity("");
      setDestination("");
      setNotes("");
      toast({ title: "تم تسجيل الدفعة بنجاح" });
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/daily-production/batches/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/daily-production/batches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/daily-production/stats"] });
      toast({ title: "تم حذف الدفعة" });
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId || !productName || !quantity || !destination) {
      toast({ title: "بيانات ناقصة", description: "يرجى ملء جميع الحقول المطلوبة", variant: "destructive" });
      return;
    }
    
    const numericQuantity = parseInt(quantity, 10);
    if (isNaN(numericQuantity) || numericQuantity <= 0) {
      toast({ title: "خطأ", description: "الكمية يجب أن تكون رقماً صحيحاً أكبر من صفر", variant: "destructive" });
      return;
    }
    
    const product = products?.find(p => p.name === productName);
    createMutation.mutate({
      branchId,
      productId: product?.id || null,
      productName,
      productCategory: productCategory || product?.category || null,
      quantity: numericQuantity,
      unit: product?.unit || "قطعة",
      destination,
      notes: notes || null,
    });
  };

  const getDestinationInfo = (dest: string) => {
    return DESTINATIONS.find(d => d.value === dest) || { label: dest, color: "bg-gray-100 text-gray-800", icon: Package };
  };

  const formatTime = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "HH:mm", { locale: ar });
    } catch {
      return "";
    }
  };

  const formatDateTime = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd/MM HH:mm", { locale: ar });
    } catch {
      return dateStr;
    }
  };

  const getBranchName = (id: string) => branches?.find(b => b.id === id)?.name || id;

  const paginatedBatches = getPageItems(batches || [], currentPage);

  const exportToExcel = () => {
    if (!batches || batches.length === 0) return;
    
    const data = batches.map(b => ({
      "الوقت": formatDateTime(b.producedAt),
      "المنتج": b.productName,
      "الفئة": b.productCategory || "-",
      "الكمية": b.quantity,
      "الوحدة": b.unit || "قطعة",
      "الوجهة": getDestinationInfo(b.destination).label,
      "المسجل": b.recorderName || "-",
      "ملاحظات": b.notes || "-",
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الإنتاج اليومي");
    XLSX.writeFile(wb, `انتاج-${selectedDate}-${getBranchName(branchId)}.xlsx`);
    toast({ title: "تم تصدير البيانات" });
  };

  const bakeryProducts = products?.filter(p => BAKERY_CATEGORIES.includes(p.category)) || [];

  return (
    <Layout>
      <div className="space-y-6" dir="rtl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/production-dashboard">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl">
              <Factory className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">الإنتاج الفعلي اليومي</h1>
              <p className="text-muted-foreground">تسجيل ومتابعة دفعات الإنتاج على مدار اليوم</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetchBatches()} data-testid="btn-refresh">
              <RefreshCw className="h-4 w-4 ml-2" />
              تحديث
            </Button>
            <Button variant="outline" size="sm" onClick={exportToExcel} disabled={!batches?.length} data-testid="btn-export">
              <FileSpreadsheet className="h-4 w-4 ml-2" />
              تصدير Excel
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-2 min-w-[200px]">
            <Label>الفرع *</Label>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger data-testid="select-branch">
                <SelectValue placeholder="اختر الفرع" />
              </SelectTrigger>
              <SelectContent>
                {branches?.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>التاريخ</Label>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-[160px]"
              data-testid="input-date"
            />
          </div>
        </div>

        {branchId && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-r-4 border-r-amber-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">إجمالي الدفعات</p>
                    <p className="text-2xl font-bold text-amber-700">{stats?.totalBatches || 0}</p>
                  </div>
                  <Package className="h-8 w-8 text-amber-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-r-4 border-r-green-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">إجمالي الكميات</p>
                    <p className="text-2xl font-bold text-green-700">{stats?.totalQuantity || 0}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-r-4 border-r-blue-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">بار العرض</p>
                    <p className="text-2xl font-bold text-blue-700">{stats?.byDestination?.display_bar || 0}</p>
                  </div>
                  <ShoppingCart className="h-8 w-8 text-blue-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-r-4 border-r-cyan-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">التخزين</p>
                    <p className="text-2xl font-bold text-cyan-700">
                      {(stats?.byDestination?.freezer || 0) + (stats?.byDestination?.refrigerator || 0)}
                    </p>
                  </div>
                  <Snowflake className="h-8 w-8 text-cyan-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Plus className="w-5 h-5 text-green-600" />
                تسجيل دفعة جديدة
              </CardTitle>
              <CardDescription>سجل الإنتاج فور خروجه من المطبخ</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>المنتج *</Label>
                  <Select value={productName} onValueChange={(val) => {
                    setProductName(val);
                    const prod = products?.find(p => p.name === val);
                    if (prod?.category) setProductCategory(prod.category);
                  }}>
                    <SelectTrigger data-testid="select-product">
                      <SelectValue placeholder="اختر المنتج" />
                    </SelectTrigger>
                    <SelectContent>
                      {bakeryProducts.map((product) => (
                        <SelectItem key={product.id} value={product.name}>
                          {product.name} ({product.category})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="أو اكتب اسم المنتج"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    data-testid="input-product-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label>الفئة</Label>
                  <Select value={productCategory} onValueChange={setProductCategory}>
                    <SelectTrigger data-testid="select-category">
                      <SelectValue placeholder="اختر الفئة" />
                    </SelectTrigger>
                    <SelectContent>
                      {BAKERY_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>الكمية *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="أدخل الكمية"
                    data-testid="input-quantity"
                  />
                </div>

                <div className="space-y-2">
                  <Label>الوجهة *</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {DESTINATIONS.map((dest) => {
                      const Icon = dest.icon;
                      return (
                        <Button
                          key={dest.value}
                          type="button"
                          variant={destination === dest.value ? "default" : "outline"}
                          className={`h-auto py-3 flex flex-col gap-1 ${destination === dest.value ? "" : ""}`}
                          onClick={() => setDestination(dest.value)}
                          data-testid={`btn-dest-${dest.value}`}
                        >
                          <Icon className="h-5 w-5" />
                          <span className="text-xs">{dest.label}</span>
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>ملاحظات</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="ملاحظات إضافية (اختياري)"
                    rows={2}
                    data-testid="input-notes"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
                  disabled={createMutation.isPending || !branchId}
                  data-testid="btn-submit"
                >
                  {createMutation.isPending ? "جاري التسجيل..." : "تسجيل الدفعة"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="w-5 h-5 text-blue-600" />
                سجل الإنتاج اليوم
              </CardTitle>
              <CardDescription>
                {batches?.length || 0} دفعة مسجلة في {selectedDate}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!branchId ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Factory className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>اختر الفرع لعرض سجل الإنتاج</p>
                </div>
              ) : batchesLoading ? (
                <div className="space-y-3">
                  {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : !batches?.length ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>لا توجد دفعات مسجلة لهذا اليوم</p>
                  <p className="text-sm">ابدأ بتسجيل الإنتاج من النموذج</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="text-right">الوقت</TableHead>
                          <TableHead className="text-right">المنتج</TableHead>
                          <TableHead className="text-right">الفئة</TableHead>
                          <TableHead className="text-center">الكمية</TableHead>
                          <TableHead className="text-right">الوجهة</TableHead>
                          <TableHead className="text-right">المسجل</TableHead>
                          <TableHead className="text-left">إجراء</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedBatches.map((batch) => {
                          const destInfo = getDestinationInfo(batch.destination);
                          const DestIcon = destInfo.icon;
                          return (
                            <TableRow key={batch.id} className="hover:bg-muted/30" data-testid={`row-batch-${batch.id}`}>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  <Clock className="h-3 w-3 text-muted-foreground" />
                                  {formatTime(batch.producedAt)}
                                </div>
                              </TableCell>
                              <TableCell className="font-medium">{batch.productName}</TableCell>
                              <TableCell>
                                {batch.productCategory && (
                                  <Badge variant="outline" className="text-xs">{batch.productCategory}</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-center font-bold">{batch.quantity}</TableCell>
                              <TableCell>
                                <Badge className={destInfo.color}>
                                  <DestIcon className="h-3 w-3 ml-1" />
                                  {destInfo.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">{batch.recorderName || "-"}</TableCell>
                              <TableCell>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>حذف الدفعة</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        هل أنت متأكد من حذف دفعة "{batch.productName}"؟
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                      <AlertDialogAction
                                        className="bg-red-600 hover:bg-red-700"
                                        onClick={() => deleteMutation.mutate(batch.id)}
                                      >
                                        حذف
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  {batches.length > itemsPerPage && (
                    <TablePagination
                      currentPage={currentPage}
                      totalItems={batches.length}
                      itemsPerPage={itemsPerPage}
                      onPageChange={setCurrentPage}
                    />
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {branchId && stats && Object.keys(stats.byHour).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-600" />
                توزيع الإنتاج على مدار الساعات
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {Object.entries(stats.byHour).sort(([a], [b]) => a.localeCompare(b)).map(([hour, qty]) => (
                  <div key={hour} className="text-center p-3 bg-indigo-50 rounded-lg min-w-[80px]">
                    <p className="text-lg font-bold text-indigo-700">{qty}</p>
                    <p className="text-xs text-indigo-600">{hour}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
