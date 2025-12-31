import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Edit, Trash2, Factory, Clock, Calendar, CheckCircle, AlertTriangle, Play, Pause } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { TablePagination } from "@/components/ui/pagination";
import type { ProductionOrder, Product, Branch } from "@shared/schema";

const ORDER_STATUS = {
  pending: { label: "في الانتظار", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  in_progress: { label: "قيد التنفيذ", color: "bg-blue-100 text-blue-800", icon: Play },
  completed: { label: "مكتمل", color: "bg-green-100 text-green-800", icon: CheckCircle },
  cancelled: { label: "ملغى", color: "bg-red-100 text-red-800", icon: AlertTriangle },
};

const PRIORITY = {
  urgent: { label: "عاجل", color: "bg-red-500 text-white" },
  high: { label: "مرتفع", color: "bg-orange-100 text-orange-800" },
  normal: { label: "عادي", color: "bg-gray-100 text-gray-800" },
  low: { label: "منخفض", color: "bg-blue-100 text-blue-800" },
};

export default function ProductionPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<ProductionOrder | null>(null);
  const [formData, setFormData] = useState({
    branchId: "",
    productId: "",
    targetQuantity: "",
    scheduledDate: new Date().toISOString().split('T')[0],
    scheduledTime: "",
    priority: "normal",
    assignedTo: "",
    notes: "",
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: orders, isLoading } = useQuery<ProductionOrder[]>({
    queryKey: ["/api/production-orders"],
  });

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("/api/production-orders", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/production-orders"] });
      toast({ title: "تم إنشاء أمر الإنتاج بنجاح" });
      resetForm();
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في إنشاء أمر الإنتاج", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => apiRequest(`/api/production-orders/${id}`, "PATCH", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/production-orders"] });
      toast({ title: "تم تحديث أمر الإنتاج بنجاح" });
      resetForm();
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في تحديث أمر الإنتاج", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest(`/api/production-orders/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/production-orders"] });
      toast({ title: "تم حذف أمر الإنتاج بنجاح" });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في حذف أمر الإنتاج", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      branchId: "",
      productId: "",
      targetQuantity: "",
      scheduledDate: new Date().toISOString().split('T')[0],
      scheduledTime: "",
      priority: "normal",
      assignedTo: "",
      notes: "",
    });
    setEditingOrder(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = () => {
    const data = {
      ...formData,
      productId: parseInt(formData.productId),
      targetQuantity: parseInt(formData.targetQuantity),
    };

    if (editingOrder) {
      updateMutation.mutate({ id: editingOrder.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleStatusChange = (order: ProductionOrder, newStatus: string) => {
    const updateData: any = { status: newStatus };
    if (newStatus === 'in_progress') {
      updateData.startedAt = new Date().toISOString();
    } else if (newStatus === 'completed') {
      updateData.completedAt = new Date().toISOString();
    }
    updateMutation.mutate({ id: order.id, data: updateData });
  };

  const getProductName = (productId: number) => products?.find(p => p.id === productId)?.name || `منتج ${productId}`;
  const getBranchName = (branchId: string) => branches?.find(b => b.id === branchId)?.name || branchId;

  const filteredOrders = orders?.filter(o =>
    getProductName(o.productId).toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  return (
    <Layout>
      <div className="space-y-6" dir="rtl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">إدارة الإنتاج</h1>
            <p className="text-muted-foreground">أوامر الإنتاج اليومية</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-order">
                <Plus className="w-4 h-4 ml-2" />
                أمر إنتاج جديد
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingOrder ? "تعديل أمر الإنتاج" : "أمر إنتاج جديد"}</DialogTitle>
                <DialogDescription>أدخل بيانات أمر الإنتاج</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>الفرع *</Label>
                  <Select value={formData.branchId} onValueChange={v => setFormData({ ...formData, branchId: v })}>
                    <SelectTrigger data-testid="select-branch">
                      <SelectValue placeholder="اختر الفرع" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches?.map(branch => (
                        <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>المنتج *</Label>
                  <Select value={formData.productId} onValueChange={v => setFormData({ ...formData, productId: v })}>
                    <SelectTrigger data-testid="select-product">
                      <SelectValue placeholder="اختر المنتج" />
                    </SelectTrigger>
                    <SelectContent>
                      {products?.filter(p => p.isActive === 'true').map(product => (
                        <SelectItem key={product.id} value={product.id.toString()}>{product.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>الكمية المطلوبة *</Label>
                  <Input
                    type="number"
                    value={formData.targetQuantity}
                    onChange={e => setFormData({ ...formData, targetQuantity: e.target.value })}
                    placeholder="مثال: 100"
                    data-testid="input-quantity"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>التاريخ *</Label>
                    <Input
                      type="date"
                      value={formData.scheduledDate}
                      onChange={e => setFormData({ ...formData, scheduledDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>الوقت</Label>
                    <Input
                      type="time"
                      value={formData.scheduledTime}
                      onChange={e => setFormData({ ...formData, scheduledTime: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label>الأولوية</Label>
                  <Select value={formData.priority} onValueChange={v => setFormData({ ...formData, priority: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PRIORITY).map(([value, { label }]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>الخباز المسؤول</Label>
                  <Input
                    value={formData.assignedTo}
                    onChange={e => setFormData({ ...formData, assignedTo: e.target.value })}
                    placeholder="اسم الخباز"
                  />
                </div>
                <div>
                  <Label>ملاحظات</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={resetForm}>إلغاء</Button>
                <Button 
                  onClick={handleSubmit} 
                  disabled={!formData.branchId || !formData.productId || !formData.targetQuantity}
                  data-testid="button-save-order"
                >
                  {editingOrder ? "تحديث" : "إنشاء"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="بحث عن أمر إنتاج..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pr-10"
              data-testid="input-search"
            />
          </div>
          <Badge variant="secondary">{orders?.length || 0} أمر</Badge>
        </div>

        {filteredOrders && filteredOrders.length > 0 && (
          <div className="text-sm text-muted-foreground">
            إجمالي: {filteredOrders.length} أمر إنتاج
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} className="h-52" />
            ))}
          </div>
        ) : filteredOrders?.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Factory className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">لا توجد أوامر إنتاج</p>
              <Button variant="outline" className="mt-4" onClick={() => setIsDialogOpen(true)}>
                إنشاء أول أمر إنتاج
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOrders?.slice((currentPage - 1) * 10, currentPage * 10).map(order => {
              const StatusIcon = ORDER_STATUS[order.status as keyof typeof ORDER_STATUS]?.icon || Clock;
              return (
                <Card key={order.id} data-testid={`order-card-${order.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Factory className="w-4 h-4" />
                          {getProductName(order.productId)}
                        </CardTitle>
                        <CardDescription className="text-xs mt-1">
                          {order.orderNumber}
                        </CardDescription>
                      </div>
                      <div className="flex flex-col gap-1 items-end">
                        <Badge className={ORDER_STATUS[order.status as keyof typeof ORDER_STATUS]?.color || "bg-gray-100"}>
                          <StatusIcon className="w-3 h-3 ml-1" />
                          {ORDER_STATUS[order.status as keyof typeof ORDER_STATUS]?.label || order.status}
                        </Badge>
                        {order.priority !== 'normal' && (
                          <Badge className={PRIORITY[order.priority as keyof typeof PRIORITY]?.color || "bg-gray-100"} variant="outline">
                            {PRIORITY[order.priority as keyof typeof PRIORITY]?.label}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-sm text-muted-foreground">
                      {getBranchName(order.branchId)}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-secondary/50 rounded p-2">
                        <div className="text-lg font-bold">{order.targetQuantity}</div>
                        <div className="text-xs text-muted-foreground">مطلوب</div>
                      </div>
                      <div className="bg-green-100 rounded p-2">
                        <div className="text-lg font-bold text-green-700">{order.producedQuantity || 0}</div>
                        <div className="text-xs text-muted-foreground">منتج</div>
                      </div>
                      <div className="bg-red-100 rounded p-2">
                        <div className="text-lg font-bold text-red-700">{order.wastedQuantity || 0}</div>
                        <div className="text-xs text-muted-foreground">هالك</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {order.scheduledDate}
                      </div>
                      {order.assignedTo && (
                        <span>الخباز: {order.assignedTo}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t">
                      {order.status === 'pending' && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleStatusChange(order, 'in_progress')}
                          className="text-blue-600"
                        >
                          <Play className="w-3 h-3 ml-1" />
                          بدء
                        </Button>
                      )}
                      {order.status === 'in_progress' && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleStatusChange(order, 'completed')}
                          className="text-green-600"
                        >
                          <CheckCircle className="w-3 h-3 ml-1" />
                          إكمال
                        </Button>
                      )}
                      <Button variant="outline" size="sm" className="text-destructive" onClick={() => deleteMutation.mutate(order.id)}>
                        <Trash2 className="w-3 h-3 ml-1" />
                        حذف
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <TablePagination
            currentPage={currentPage}
            totalItems={filteredOrders?.length || 0}
            itemsPerPage={10}
            onPageChange={setCurrentPage}
          />
          </>
        )}
      </div>
    </Layout>
  );
}
