import { useState, useEffect, useMemo } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useParams, Link } from "wouter";
import { ArrowRight, ArrowLeft, Save, Send, Plus, Trash2, Package, Calendar, CheckCircle, AlertCircle, Factory, ClipboardList, CalendarDays } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ProductSelector } from "@/components/product-selector";
import type { Branch, Product } from "@shared/schema";
import { format, addDays, eachDayOfInterval } from "date-fns";
import { ar } from "date-fns/locale";

const ORDER_TYPES = [
  { value: "daily", label: "يومي" },
  { value: "weekly", label: "أسبوعي" },
  { value: "long_term", label: "طويل الأمد" },
];

const PRIORITIES = [
  { value: "normal", label: "عادية" },
  { value: "high", label: "عالية" },
  { value: "urgent", label: "عاجلة" },
];

const SHIFT_TYPES = [
  { value: "morning", label: "صباحي" },
  { value: "evening", label: "مسائي" },
  { value: "night", label: "ليلي" },
];

interface ProductItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface ScheduleItem {
  date: string;
  shift: string;
  productId: string;
  productName: string;
  quantity: number;
}

interface AdvancedProductionOrder {
  id?: number;
  orderNumber?: string;
  title: string;
  description: string;
  branchId: string;
  targetBranchId: string;
  orderType: string;
  priority: string;
  status: string;
  startDate: string;
  endDate: string;
  estimatedCost: number;
  notes: string;
  items: ProductItem[];
  schedule: ScheduleItem[];
}

export default function AdvancedProductionOrderFormPage() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isEdit = !!id;
  const [currentStep, setCurrentStep] = useState("info");

  const [formData, setFormData] = useState<AdvancedProductionOrder>({
    title: "",
    description: "",
    branchId: "",
    targetBranchId: "",
    orderType: "daily",
    priority: "normal",
    status: "draft",
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
    estimatedCost: 0,
    notes: "",
    items: [],
    schedule: [],
  });

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const { data: products, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    enabled: currentStep === "products" || currentStep === "schedule" || currentStep === "review" || isEdit,
    retry: 2,
  });

  const { data: existingOrder, isLoading: loadingOrder } = useQuery<AdvancedProductionOrder>({
    queryKey: [`/api/advanced-production-orders/${id}`],
    enabled: isEdit,
  });

  useEffect(() => {
    if (existingOrder) {
      setFormData({
        ...existingOrder,
        branchId: (existingOrder as any).sourceBranchId || existingOrder.branchId || "",
        targetBranchId: (existingOrder as any).targetBranchId || existingOrder.targetBranchId || "",
        items: existingOrder.items || [],
        schedule: existingOrder.schedule || [],
      });
    }
  }, [existingOrder]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/advanced-production-orders", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/advanced-production-orders"] });
      toast({ title: "تم إنشاء أمر الإنتاج بنجاح" });
      setLocation("/advanced-production-orders");
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في إنشاء أمر الإنتاج", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", `/api/advanced-production-orders/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/advanced-production-orders"] });
      queryClient.invalidateQueries({ queryKey: [`/api/advanced-production-orders/${id}`] });
      toast({ title: "تم تحديث أمر الإنتاج بنجاح" });
      setLocation("/advanced-production-orders");
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في تحديث أمر الإنتاج", variant: "destructive" });
    },
  });

  const calculateTotals = useMemo(() => {
    const totalQuantity = formData.items.reduce((sum, item) => sum + item.quantity, 0);
    const totalCost = formData.items.reduce((sum, item) => sum + item.total, 0);
    return { totalQuantity, totalCost };
  }, [formData.items]);

  const orderDates = useMemo(() => {
    if (!formData.startDate || !formData.endDate) return [];
    try {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      if (start > end) return [];
      return eachDayOfInterval({ start, end });
    } catch {
      return [];
    }
  }, [formData.startDate, formData.endDate]);

  const addProduct = () => {
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { productId: "", productName: "", quantity: 1, unitPrice: 0, total: 0 },
      ],
    }));
  };

  const updateProduct = (index: number, field: string, value: any) => {
    const updated = [...formData.items];
    updated[index] = { ...updated[index], [field]: value };
    
    if (field === "quantity" || field === "unitPrice") {
      updated[index].total = updated[index].quantity * updated[index].unitPrice;
    }
    
    setFormData((prev) => ({
      ...prev,
      items: updated,
      estimatedCost: updated.reduce((sum, item) => sum + item.total, 0),
    }));
  };

  const removeProduct = (index: number) => {
    const updated = formData.items.filter((_, i) => i !== index);
    setFormData((prev) => ({
      ...prev,
      items: updated,
      estimatedCost: updated.reduce((sum, item) => sum + item.total, 0),
    }));
  };

  const handleProductSelect = (index: number, productId: string, product: Product) => {
    if (!product || !product.id) {
      updateProduct(index, "productId", "");
      updateProduct(index, "productName", "");
      updateProduct(index, "unitPrice", 0);
      return;
    }
    
    const updated = [...formData.items];
    updated[index] = {
      ...updated[index],
      productId,
      productName: product.name,
      unitPrice: product.basePrice || 0,
      total: (updated[index].quantity || 1) * (product.basePrice || 0),
    };
    
    setFormData((prev) => ({
      ...prev,
      items: updated,
      estimatedCost: updated.reduce((sum, item) => sum + item.total, 0),
    }));
  };

  const addScheduleItem = (date: string) => {
    setFormData((prev) => ({
      ...prev,
      schedule: [
        ...prev.schedule,
        { date, shift: "morning", productId: "", productName: "", quantity: 1 },
      ],
    }));
  };

  const updateScheduleItem = (index: number, field: string, value: any) => {
    const updated = [...formData.schedule];
    updated[index] = { ...updated[index], [field]: value };
    setFormData((prev) => ({ ...prev, schedule: updated }));
  };

  const removeScheduleItem = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      schedule: prev.schedule.filter((_, i) => i !== index),
    }));
  };

  const handleScheduleProductSelect = (index: number, productId: string, product: Product) => {
    if (!product || !product.id) {
      updateScheduleItem(index, "productId", "");
      updateScheduleItem(index, "productName", "");
      return;
    }
    
    const updated = [...formData.schedule];
    updated[index] = {
      ...updated[index],
      productId,
      productName: product.name,
    };
    setFormData((prev) => ({ ...prev, schedule: updated }));
  };

  const prepareOrderData = (status: string) => {
    const mappedItems = formData.items.map(item => ({
      productId: parseInt(item.productId, 10),
      productName: item.productName,
      productCategory: products?.find(p => p.id.toString() === item.productId)?.category || '',
      targetQuantity: item.quantity,
      unitPrice: item.unitPrice,
      totalValue: item.total,
      status: 'pending'
    }));
    
    const mappedSchedules = formData.schedule.map(s => ({
      scheduledDate: s.date,
      shift: s.shift,
      targetQuantity: s.quantity,
      assignedDepartment: 'production',
      status: 'pending'
    }));
    
    return {
      title: formData.title,
      description: formData.description,
      orderType: formData.orderType,
      sourceBranchId: formData.branchId,
      targetBranchId: formData.targetBranchId || formData.branchId,
      priority: formData.priority,
      startDate: formData.startDate,
      endDate: formData.endDate,
      notes: formData.notes,
      status,
      items: mappedItems,
      schedules: mappedSchedules
    };
  };

  const handleSaveAsDraft = () => {
    const data = prepareOrderData("draft");
    if (isEdit) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleSaveAndSubmit = () => {
    const data = prepareOrderData("pending");
    if (isEdit) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const steps = [
    { value: "info", label: "معلومات الأمر", icon: ClipboardList },
    { value: "products", label: "المنتجات", icon: Package },
    { value: "schedule", label: "الجدولة", icon: CalendarDays },
    { value: "review", label: "المراجعة والحفظ", icon: CheckCircle },
  ];

  const currentStepIndex = steps.findIndex((s) => s.value === currentStep);

  const goToNextStep = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStep(steps[currentStepIndex + 1].value);
    }
  };

  const goToPrevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStep(steps[currentStepIndex - 1].value);
    }
  };

  const canProceed = () => {
    console.log("canProceed check:", { currentStep, title: formData.title, branchId: formData.branchId, startDate: formData.startDate, itemsLen: formData.items.length });
    switch (currentStep) {
      case "info":
        const infoValid = !!(formData.title && formData.branchId && formData.startDate);
        console.log("info step valid:", infoValid);
        return infoValid;
      case "products":
        const productsValid = formData.items.length > 0 && formData.items.every((item) => (item.productId || item.productName) && item.quantity > 0);
        console.log("products step valid:", productsValid);
        return productsValid;
      case "schedule":
        return true;
      default:
        return true;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR" }).format(amount);
  };

  const getBranchName = (branchId: string) => {
    return branches?.find((b) => b.id === branchId)?.name || branchId;
  };

  if (isEdit && loadingOrder) {
    return (
      <Layout>
        <div className="space-y-6" dir="rtl">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-[600px]" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6" dir="rtl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">
              {isEdit ? "تعديل أمر الإنتاج" : "إنشاء أمر إنتاج جديد"}
            </h1>
            <p className="text-muted-foreground">
              {isEdit && formData.orderNumber
                ? `رقم الأمر: ${formData.orderNumber}`
                : "أدخل تفاصيل أمر الإنتاج"}
            </p>
          </div>
          <Link href="/advanced-production-orders">
            <Button variant="outline" data-testid="button-back">
              <ArrowRight className="w-4 h-4 ml-2" />
              العودة للقائمة
            </Button>
          </Link>
        </div>

        <div className="flex items-center justify-center gap-2 mb-6">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = step.value === currentStep;
            const isCompleted = index < currentStepIndex;
            
            return (
              <div key={step.value} className="flex items-center">
                {index > 0 && (
                  <div className={`w-12 h-0.5 mx-2 ${isCompleted ? "bg-primary" : "bg-muted"}`} />
                )}
                <button
                  onClick={() => setCurrentStep(step.value)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : isCompleted
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                  data-testid={`step-${step.value}`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden md:inline">{step.label}</span>
                </button>
              </div>
            );
          })}
        </div>

        <Card>
          <CardContent className="p-6">
            {currentStep === "info" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-primary" />
                    معلومات الأمر الأساسية
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="title">عنوان الأمر *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                      placeholder="أدخل عنوان الأمر"
                      data-testid="input-title"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="orderType">نوع الأمر *</Label>
                    <Select
                      value={formData.orderType}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, orderType: value }))}
                    >
                      <SelectTrigger id="orderType" data-testid="select-order-type">
                        <SelectValue placeholder="اختر نوع الأمر" />
                      </SelectTrigger>
                      <SelectContent>
                        {ORDER_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="branchId">الفرع المصدر *</Label>
                    <Select
                      value={formData.branchId}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, branchId: value }))}
                    >
                      <SelectTrigger id="branchId" data-testid="select-source-branch">
                        <SelectValue placeholder="اختر الفرع المصدر" />
                      </SelectTrigger>
                      <SelectContent>
                        {branches?.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="targetBranchId">الفرع المستهدف</Label>
                    <Select
                      value={formData.targetBranchId || "same_branch"}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, targetBranchId: value === "same_branch" ? "" : value }))}
                    >
                      <SelectTrigger id="targetBranchId" data-testid="select-target-branch">
                        <SelectValue placeholder="اختر الفرع المستهدف" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="same_branch">نفس الفرع</SelectItem>
                        {branches?.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="priority">الأولوية</Label>
                    <Select
                      value={formData.priority}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, priority: value }))}
                    >
                      <SelectTrigger id="priority" data-testid="select-priority">
                        <SelectValue placeholder="اختر الأولوية" />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map((priority) => (
                          <SelectItem key={priority.value} value={priority.value}>
                            {priority.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="startDate">تاريخ البداية *</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData((prev) => ({ ...prev, startDate: e.target.value }))}
                      data-testid="input-start-date"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="endDate">تاريخ النهاية</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData((prev) => ({ ...prev, endDate: e.target.value }))}
                      min={formData.startDate}
                      data-testid="input-end-date"
                    />
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="description">وصف الأمر</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                      placeholder="أدخل وصف تفصيلي للأمر"
                      rows={3}
                      data-testid="input-description"
                    />
                  </div>
                </div>
              </div>
            )}

            {currentStep === "products" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Package className="w-5 h-5 text-primary" />
                    اختيار المنتجات
                  </h2>
                  <Button onClick={addProduct} variant="outline" data-testid="button-add-product">
                    <Plus className="w-4 h-4 ml-2" />
                    إضافة منتج
                  </Button>
                </div>

                {formData.items.length === 0 ? (
                  <Alert>
                    <AlertCircle className="w-4 h-4" />
                    <AlertTitle>لا توجد منتجات</AlertTitle>
                    <AlertDescription>
                      اضغط على "إضافة منتج" لإضافة المنتجات المطلوبة لأمر الإنتاج
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-4">
                    {formData.items.map((item, index) => (
                      <Card key={index} className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                          <div className="md:col-span-5 space-y-2">
                            <Label>المنتج</Label>
                            <ProductSelector
                              products={products || []}
                              value={item.productId}
                              onSelect={(productId, product) =>
                                handleProductSelect(index, productId, product)
                              }
                              placeholder="اختر المنتج"
                            />
                          </div>
                          <div className="md:col-span-2 space-y-2">
                            <Label>الكمية المطلوبة</Label>
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) =>
                                updateProduct(index, "quantity", parseInt(e.target.value) || 1)
                              }
                              data-testid={`input-quantity-${index}`}
                            />
                          </div>
                          <div className="md:col-span-2 space-y-2">
                            <Label>السعر</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={item.unitPrice}
                              onChange={(e) =>
                                updateProduct(index, "unitPrice", parseFloat(e.target.value) || 0)
                              }
                              data-testid={`input-price-${index}`}
                            />
                          </div>
                          <div className="md:col-span-2 space-y-2">
                            <Label>الإجمالي</Label>
                            <div className="h-10 flex items-center px-3 bg-muted rounded-md font-medium">
                              {formatCurrency(item.total)}
                            </div>
                          </div>
                          <div className="md:col-span-1">
                            <Button
                              variant="destructive"
                              size="icon"
                              onClick={() => removeProduct(index)}
                              data-testid={`button-remove-product-${index}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}

                    <Separator />

                    <div className="flex justify-end gap-8 text-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">إجمالي الكميات:</span>
                        <Badge variant="secondary" className="text-lg px-3 py-1">
                          {calculateTotals.totalQuantity}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">الإجمالي:</span>
                        <Badge variant="default" className="text-lg px-3 py-1">
                          {formatCurrency(calculateTotals.totalCost)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {currentStep === "schedule" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <CalendarDays className="w-5 h-5 text-primary" />
                    الجدولة
                  </h2>
                </div>

                {orderDates.length === 0 ? (
                  <Alert>
                    <AlertCircle className="w-4 h-4" />
                    <AlertTitle>لا توجد تواريخ</AlertTitle>
                    <AlertDescription>
                      يرجى تحديد تاريخ البداية والنهاية في الخطوة الأولى
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-4">
                    {orderDates.map((date) => {
                      const dateStr = format(date, "yyyy-MM-dd");
                      const dateSchedules = formData.schedule.filter((s) => s.date === dateStr);

                      return (
                        <Card key={dateStr} className="p-4">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-5 h-5 text-primary" />
                              <span className="font-semibold">
                                {format(date, "EEEE, dd MMMM yyyy", { locale: ar })}
                              </span>
                              <Badge variant="secondary">{dateSchedules.length} مهمة</Badge>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => addScheduleItem(dateStr)}
                              data-testid={`button-add-schedule-${dateStr}`}
                            >
                              <Plus className="w-4 h-4 ml-1" />
                              إضافة مهمة
                            </Button>
                          </div>

                          {dateSchedules.length > 0 && (
                            <div className="space-y-3">
                              {formData.schedule.map((scheduleItem, index) => {
                                if (scheduleItem.date !== dateStr) return null;

                                return (
                                  <div
                                    key={index}
                                    className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end p-3 bg-muted/50 rounded-lg"
                                  >
                                    <div className="md:col-span-3 space-y-2">
                                      <Label>الوردية</Label>
                                      <Select
                                        value={scheduleItem.shift}
                                        onValueChange={(value) =>
                                          updateScheduleItem(index, "shift", value)
                                        }
                                      >
                                        <SelectTrigger data-testid={`select-shift-${index}`}>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {SHIFT_TYPES.map((shift) => (
                                            <SelectItem key={shift.value} value={shift.value}>
                                              {shift.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="md:col-span-5 space-y-2">
                                      <Label>المنتج</Label>
                                      <ProductSelector
                                        products={products || []}
                                        value={scheduleItem.productId}
                                        onSelect={(productId, product) =>
                                          handleScheduleProductSelect(index, productId, product)
                                        }
                                        placeholder="اختر المنتج"
                                        showPrice={false}
                                      />
                                    </div>
                                    <div className="md:col-span-3 space-y-2">
                                      <Label>الكمية</Label>
                                      <Input
                                        type="number"
                                        min="1"
                                        value={scheduleItem.quantity}
                                        onChange={(e) =>
                                          updateScheduleItem(
                                            index,
                                            "quantity",
                                            parseInt(e.target.value) || 1
                                          )
                                        }
                                        data-testid={`input-schedule-quantity-${index}`}
                                      />
                                    </div>
                                    <div className="md:col-span-1">
                                      <Button
                                        variant="destructive"
                                        size="icon"
                                        onClick={() => removeScheduleItem(index)}
                                        data-testid={`button-remove-schedule-${index}`}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {currentStep === "review" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-primary" />
                    المراجعة والحفظ
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="p-4">
                    <h3 className="font-semibold mb-3 text-primary">معلومات الأمر</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">عنوان الأمر:</span>
                        <span className="font-medium">{formData.title || "-"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">نوع الأمر:</span>
                        <Badge variant="outline">
                          {ORDER_TYPES.find((t) => t.value === formData.orderType)?.label}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">الأولوية:</span>
                        <Badge
                          variant={
                            formData.priority === "urgent"
                              ? "destructive"
                              : formData.priority === "high"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {PRIORITIES.find((p) => p.value === formData.priority)?.label}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">الفرع المصدر:</span>
                        <span className="font-medium">{getBranchName(formData.branchId)}</span>
                      </div>
                      {formData.targetBranchId && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">الفرع المستهدف:</span>
                          <span className="font-medium">{getBranchName(formData.targetBranchId)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">تاريخ البداية:</span>
                        <span>{formData.startDate}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">تاريخ النهاية:</span>
                        <span>{formData.endDate}</span>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <h3 className="font-semibold mb-3 text-primary">ملخص المنتجات</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">عدد المنتجات:</span>
                        <Badge variant="secondary">{formData.items.length}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">إجمالي الكميات:</span>
                        <Badge variant="secondary">{calculateTotals.totalQuantity}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">التكلفة التقديرية:</span>
                        <Badge variant="default">{formatCurrency(calculateTotals.totalCost)}</Badge>
                      </div>
                      <Separator className="my-2" />
                      <div className="max-h-32 overflow-y-auto">
                        {formData.items.map((item, index) => (
                          <div key={index} className="flex justify-between py-1">
                            <span>{item.productName || "-"}</span>
                            <span className="text-muted-foreground">
                              {item.quantity} × {formatCurrency(item.unitPrice)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Card>
                </div>

                {formData.schedule.length > 0 && (
                  <Card className="p-4">
                    <h3 className="font-semibold mb-3 text-primary">جدول الإنتاج</h3>
                    <div className="text-sm">
                      <div className="flex justify-between mb-2">
                        <span className="text-muted-foreground">عدد المهام المجدولة:</span>
                        <Badge variant="secondary">{formData.schedule.length}</Badge>
                      </div>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {formData.schedule.map((s, index) => (
                          <div key={index} className="flex justify-between py-1 border-b border-muted">
                            <span>{s.date}</span>
                            <span>{SHIFT_TYPES.find((t) => t.value === s.shift)?.label}</span>
                            <span>{s.productName || "-"}</span>
                            <span>{s.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Card>
                )}

                {formData.description && (
                  <Card className="p-4">
                    <h3 className="font-semibold mb-2 text-primary">الوصف</h3>
                    <p className="text-sm text-muted-foreground">{formData.description}</p>
                  </Card>
                )}
              </div>
            )}

            <Separator className="my-6" />

            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={goToPrevStep}
                disabled={currentStepIndex === 0}
                data-testid="button-previous"
              >
                <ArrowRight className="w-4 h-4 ml-2" />
                السابق
              </Button>

              <div className="flex items-center gap-2">
                {currentStep === "review" ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={handleSaveAsDraft}
                      disabled={createMutation.isPending || updateMutation.isPending}
                      data-testid="button-save-draft"
                    >
                      <Save className="w-4 h-4 ml-2" />
                      حفظ كمسودة
                    </Button>
                    <Button
                      onClick={handleSaveAndSubmit}
                      disabled={createMutation.isPending || updateMutation.isPending || !canProceed()}
                      data-testid="button-save-submit"
                    >
                      <Send className="w-4 h-4 ml-2" />
                      حفظ وإرسال
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={goToNextStep}
                    disabled={!canProceed()}
                    data-testid="button-next"
                  >
                    التالي
                    <ArrowLeft className="w-4 h-4 mr-2" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
