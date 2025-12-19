import { useState, useRef, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useParams, Link } from "wouter";
import { ArrowRight, Save, Send, Plus, Trash2, Wallet, CreditCard, Smartphone, Truck, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import type { Branch, CashierSalesJournal, CashierPaymentBreakdown } from "@shared/schema";

const PAYMENT_METHODS = [
  { value: "cash", label: "نقداً", icon: Wallet },
  { value: "card", label: "بطاقة ائتمان", icon: CreditCard },
  { value: "mada", label: "مدى", icon: CreditCard },
  { value: "apple_pay", label: "Apple Pay", icon: Smartphone },
  { value: "stc_pay", label: "STC Pay", icon: Smartphone },
  { value: "hunger_station", label: "هنقرستيشن", icon: Truck },
  { value: "toyou", label: "ToYou", icon: Truck },
  { value: "jahez", label: "جاهز", icon: Truck },
  { value: "other", label: "أخرى", icon: Wallet },
];

const SHIFT_TYPES = [
  { value: "morning", label: "صباحي" },
  { value: "evening", label: "مسائي" },
  { value: "night", label: "ليلي" },
];

interface PaymentBreakdownInput {
  paymentMethod: string;
  amount: number;
  transactionCount: number;
  notes?: string;
}

export default function CashierJournalFormPage() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const isEdit = !!id;

  const [formData, setFormData] = useState({
    branchId: "",
    journalDate: new Date().toISOString().split("T")[0],
    shiftType: "morning",
    cashierName: "",
    cashierId: "",
    openingBalance: 0,
    totalSales: 0,
    cashTotal: 0,
    actualCashDrawer: 0,
    customerCount: 0,
    notes: "",
  });

  const [paymentBreakdowns, setPaymentBreakdowns] = useState<PaymentBreakdownInput[]>([
    { paymentMethod: "cash", amount: 0, transactionCount: 0 },
  ]);

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const { data: existingJournal, isLoading: loadingJournal } = useQuery<CashierSalesJournal & { paymentBreakdowns: CashierPaymentBreakdown[] }>({
    queryKey: [`/api/cashier-journals/${id}`],
    enabled: isEdit,
  });

  useEffect(() => {
    if (existingJournal) {
      setFormData({
        branchId: existingJournal.branchId,
        journalDate: existingJournal.journalDate,
        shiftType: existingJournal.shiftType || "morning",
        cashierName: existingJournal.cashierName,
        cashierId: existingJournal.cashierId || "",
        openingBalance: existingJournal.openingBalance || 0,
        totalSales: existingJournal.totalSales,
        cashTotal: existingJournal.cashTotal,
        actualCashDrawer: existingJournal.actualCashDrawer,
        customerCount: existingJournal.customerCount || 0,
        notes: existingJournal.notes || "",
      });
      if (existingJournal.paymentBreakdowns?.length > 0) {
        setPaymentBreakdowns(
          existingJournal.paymentBreakdowns.map((b) => ({
            paymentMethod: b.paymentMethod,
            amount: b.amount,
            transactionCount: b.transactionCount || 0,
            notes: b.notes || "",
          }))
        );
      }
    }
  }, [existingJournal]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("/api/cashier-journals", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cashier-journals"] });
      toast({ title: "تم إنشاء اليومية بنجاح" });
      setLocation("/cashier-journals");
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في إنشاء اليومية", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => apiRequest(`/api/cashier-journals/${id}`, "PATCH", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cashier-journals"] });
      queryClient.invalidateQueries({ queryKey: [`/api/cashier-journals/${id}`] });
      toast({ title: "تم تحديث اليومية بنجاح" });
      setLocation("/cashier-journals");
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في تحديث اليومية", variant: "destructive" });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (data: { signatureData?: string; signerName?: string }) =>
      apiRequest(`/api/cashier-journals/${id}/submit`, "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cashier-journals"] });
      toast({ title: "تم تقديم اليومية للمراجعة" });
      setLocation("/cashier-journals");
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في تقديم اليومية", variant: "destructive" });
    },
  });

  const handleSave = () => {
    const data = {
      ...formData,
      paymentBreakdowns: paymentBreakdowns.filter((b) => b.amount > 0),
    };

    if (isEdit) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleSubmit = () => {
    const canvas = signatureCanvasRef.current;
    const signatureData = canvas ? canvas.toDataURL("image/png") : undefined;

    submitMutation.mutate({
      signatureData,
      signerName: formData.cashierName,
    });
  };

  const addPaymentBreakdown = () => {
    setPaymentBreakdowns([...paymentBreakdowns, { paymentMethod: "card", amount: 0, transactionCount: 0 }]);
  };

  const removePaymentBreakdown = (index: number) => {
    setPaymentBreakdowns(paymentBreakdowns.filter((_, i) => i !== index));
  };

  const updatePaymentBreakdown = (index: number, field: string, value: any) => {
    const updated = [...paymentBreakdowns];
    updated[index] = { ...updated[index], [field]: value };
    setPaymentBreakdowns(updated);

    if (field === "amount") {
      const cashBreakdown = updated.find((b) => b.paymentMethod === "cash");
      if (cashBreakdown) {
        setFormData((prev) => ({ ...prev, cashTotal: cashBreakdown.amount }));
      }
      const totalSales = updated.reduce((sum, b) => sum + b.amount, 0);
      setFormData((prev) => ({ ...prev, totalSales }));
    }
  };

  const calculateDiscrepancy = () => {
    return formData.actualCashDrawer - formData.cashTotal;
  };

  const getDiscrepancyStatus = () => {
    const diff = calculateDiscrepancy();
    if (diff === 0) return { label: "متوازن", color: "text-green-600 bg-green-50" };
    if (diff < 0) return { label: `عجز ${Math.abs(diff).toFixed(2)} ر.س`, color: "text-red-600 bg-red-50" };
    return { label: `زيادة ${diff.toFixed(2)} ر.س`, color: "text-amber-600 bg-amber-50" };
  };

  const initCanvas = () => {
    const canvas = signatureCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "#1e3a5f";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
      }
    }
  };

  useEffect(() => {
    initCanvas();
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      const rect = canvas.getBoundingClientRect();
      if (ctx) {
        ctx.beginPath();
        ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
        setIsDrawing(true);
      }
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = signatureCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      const rect = canvas.getBoundingClientRect();
      if (ctx) {
        ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
        ctx.stroke();
      }
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = signatureCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  const discrepancyStatus = getDiscrepancyStatus();

  if (isEdit && loadingJournal) {
    return (
      <Layout>
        <div className="p-6">
          <Skeleton className="h-12 w-48 mb-6" />
          <Skeleton className="h-96 w-full" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/cashier-journals">
            <Button variant="ghost" size="sm" data-testid="button-back">
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-primary" data-testid="page-title">
              {isEdit ? "تعديل يومية المبيعات" : "يومية مبيعات جديدة"}
            </h1>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>معلومات اليومية</CardTitle>
                <CardDescription>بيانات الوردية والكاشير</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>الفرع *</Label>
                    <Select value={formData.branchId} onValueChange={(v) => setFormData({ ...formData, branchId: v })}>
                      <SelectTrigger data-testid="select-branch">
                        <SelectValue placeholder="اختر الفرع" />
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
                    <Label>التاريخ *</Label>
                    <Input
                      type="date"
                      value={formData.journalDate}
                      onChange={(e) => setFormData({ ...formData, journalDate: e.target.value })}
                      data-testid="input-date"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>الوردية *</Label>
                    <Select value={formData.shiftType} onValueChange={(v) => setFormData({ ...formData, shiftType: v })}>
                      <SelectTrigger data-testid="select-shift">
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
                  <div className="space-y-2">
                    <Label>اسم الكاشير *</Label>
                    <Input
                      value={formData.cashierName}
                      onChange={(e) => setFormData({ ...formData, cashierName: e.target.value })}
                      placeholder="اسم الكاشير"
                      data-testid="input-cashier-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>رصيد الافتتاح (ر.س)</Label>
                    <Input
                      type="number"
                      value={formData.openingBalance}
                      onChange={(e) => setFormData({ ...formData, openingBalance: parseFloat(e.target.value) || 0 })}
                      data-testid="input-opening-balance"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>عدد العملاء</Label>
                    <Input
                      type="number"
                      value={formData.customerCount}
                      onChange={(e) => setFormData({ ...formData, customerCount: parseInt(e.target.value) || 0 })}
                      data-testid="input-customer-count"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row justify-between items-center">
                <div>
                  <CardTitle>تفصيل المبيعات حسب طريقة الدفع</CardTitle>
                  <CardDescription>أدخل المبيعات لكل طريقة دفع</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={addPaymentBreakdown} data-testid="button-add-payment">
                  <Plus className="w-4 h-4 mr-1" />
                  إضافة
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {paymentBreakdowns.map((breakdown, index) => {
                  const method = PAYMENT_METHODS.find((m) => m.value === breakdown.paymentMethod);
                  const Icon = method?.icon || Wallet;

                  return (
                    <div key={index} className="flex items-center gap-3 p-3 border rounded-lg" data-testid={`payment-row-${index}`}>
                      <Icon className="w-5 h-5 text-muted-foreground" />
                      <Select
                        value={breakdown.paymentMethod}
                        onValueChange={(v) => updatePaymentBreakdown(index, "paymentMethod", v)}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_METHODS.map((m) => (
                            <SelectItem key={m.value} value={m.value}>
                              {m.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex-1">
                        <Input
                          type="number"
                          placeholder="المبلغ"
                          value={breakdown.amount || ""}
                          onChange={(e) => updatePaymentBreakdown(index, "amount", parseFloat(e.target.value) || 0)}
                          data-testid={`input-payment-amount-${index}`}
                        />
                      </div>
                      <div className="w-24">
                        <Input
                          type="number"
                          placeholder="عدد"
                          value={breakdown.transactionCount || ""}
                          onChange={(e) => updatePaymentBreakdown(index, "transactionCount", parseInt(e.target.value) || 0)}
                          data-testid={`input-payment-count-${index}`}
                        />
                      </div>
                      {paymentBreakdowns.length > 1 && (
                        <Button variant="ghost" size="sm" onClick={() => removePaymentBreakdown(index)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  );
                })}
                <Separator />
                <div className="flex justify-between items-center text-lg font-medium">
                  <span>إجمالي المبيعات</span>
                  <span data-testid="text-total-sales">{formData.totalSales.toFixed(2)} ر.س</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>تسوية الصندوق النقدي</CardTitle>
                <CardDescription>مطابقة الرصيد الفعلي مع المتوقع</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>المبيعات النقدية المتوقعة (ر.س)</Label>
                    <Input type="number" value={formData.cashTotal} readOnly className="bg-muted" data-testid="input-expected-cash" />
                  </div>
                  <div className="space-y-2">
                    <Label>الرصيد الفعلي في الصندوق (ر.س) *</Label>
                    <Input
                      type="number"
                      value={formData.actualCashDrawer}
                      onChange={(e) => setFormData({ ...formData, actualCashDrawer: parseFloat(e.target.value) || 0 })}
                      data-testid="input-actual-cash"
                    />
                  </div>
                </div>
                <div className={`p-4 rounded-lg flex items-center gap-3 ${discrepancyStatus.color}`}>
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-medium" data-testid="text-discrepancy">{discrepancyStatus.label}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>ملاحظات</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="أي ملاحظات إضافية..."
                  rows={3}
                  data-testid="input-notes"
                />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>التوقيع الإلكتروني</CardTitle>
                <CardDescription>وقّع لتأكيد صحة البيانات</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border rounded-lg overflow-hidden">
                  <canvas
                    ref={signatureCanvasRef}
                    width={280}
                    height={150}
                    className="w-full cursor-crosshair"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    data-testid="canvas-signature"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={clearSignature} className="w-full" data-testid="button-clear-signature">
                  مسح التوقيع
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>ملخص</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">إجمالي المبيعات</span>
                  <span className="font-medium">{formData.totalSales.toFixed(2)} ر.س</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">المبيعات النقدية</span>
                  <span className="font-medium">{formData.cashTotal.toFixed(2)} ر.س</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">الرصيد الفعلي</span>
                  <span className="font-medium">{formData.actualCashDrawer.toFixed(2)} ر.س</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">الفارق</span>
                  <span className={`font-bold ${calculateDiscrepancy() === 0 ? "text-green-600" : calculateDiscrepancy() < 0 ? "text-red-600" : "text-amber-600"}`}>
                    {calculateDiscrepancy().toFixed(2)} ر.س
                  </span>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2">
              <Button
                className="w-full gap-2"
                onClick={handleSave}
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save"
              >
                <Save className="w-4 h-4" />
                {isEdit ? "حفظ التغييرات" : "حفظ كمسودة"}
              </Button>
              {isEdit && existingJournal?.status === "draft" && (
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={handleSubmit}
                  disabled={submitMutation.isPending}
                  data-testid="button-submit"
                >
                  <Send className="w-4 h-4" />
                  تقديم للمراجعة
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
