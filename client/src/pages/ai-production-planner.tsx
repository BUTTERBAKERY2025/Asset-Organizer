import { useState } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { TablePagination, usePagination } from "@/components/ui/pagination";
import type { Branch } from "@shared/schema";
import { Brain, Calendar, DollarSign, Percent, Package, CheckCircle, Clock, Sparkles, TrendingUp, History, FileText, Loader2, AlertCircle, RefreshCw, ArrowLeft } from "lucide-react";

interface AIPlanProduct {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  estimatedCost: number;
}

interface AIProductionPlan {
  id: number;
  branchId: string;
  planDate: string;
  targetSales: number;
  confidenceScore: number;
  totalEstimatedValue: number;
  estimatedCost: number;
  profitMargin: number;
  status: "generated" | "applied";
  products: AIPlanProduct[];
  salesDataFileId?: number;
  appliedOrderId?: number;
  createdAt: string;
}

interface SalesDataFile {
  id: number;
  fileName: string;
  branchId: string;
  periodStart: string | null;
  periodEnd: string | null;
  status: string;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  generated: { label: "تم التوليد", color: "bg-blue-100 text-blue-800", icon: Sparkles },
  applied: { label: "تم التطبيق", color: "bg-green-100 text-green-800", icon: CheckCircle },
};

export default function AdvancedProductionPlannerPage() {
  const [branchId, setBranchId] = useState<string>("");
  const [targetSales, setTargetSales] = useState<string>("");
  const [planDate, setPlanDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [salesDataFileId, setSalesDataFileId] = useState<string>("");
  const [generatedPlan, setGeneratedPlan] = useState<AIProductionPlan | null>(null);
  const [historyPage, setHistoryPage] = useState(1);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { itemsPerPage, getPageItems } = usePagination(6);

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const { data: salesDataFiles } = useQuery<SalesDataFile[]>({
    queryKey: ["/api/sales-data-uploads"],
  });

  const { data: planHistory, isLoading: historyLoading } = useQuery<AIProductionPlan[]>({
    queryKey: ["/api/production-ai-plans"],
  });

  const generateMutation = useMutation({
    mutationFn: async (data: { branchId: string; targetSalesValue: number; planDate: string; uploadId?: number }): Promise<AIProductionPlan> => {
      const res = await apiRequest("POST", "/api/production-ai-plans/generate", data);
      return res.json();
    },
    onSuccess: (data: AIProductionPlan) => {
      setGeneratedPlan(data);
      queryClient.invalidateQueries({ queryKey: ["/api/production-ai-plans"] });
      toast({ title: "تم توليد الخطة بنجاح", description: `مستوى الثقة: ${(data.confidenceScore * 100).toFixed(0)}%` });
    },
    onError: (error: any) => {
      toast({ title: "خطأ في توليد الخطة", description: error.message || "حدث خطأ أثناء توليد خطة الإنتاج", variant: "destructive" });
    },
  });

  const applyMutation = useMutation({
    mutationFn: async (planId: number): Promise<void> => {
      await apiRequest("POST", `/api/production-ai-plans/${planId}/apply`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/production-ai-plans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/advanced-production-orders"] });
      setGeneratedPlan(null);
      setBranchId("");
      setTargetSales("");
      setPlanDate(format(new Date(), "yyyy-MM-dd"));
      setSalesDataFileId("");
      toast({ title: "تم تطبيق الخطة بنجاح", description: "تم إنشاء أمر إنتاج جديد بناءً على الخطة" });
    },
    onError: (error: any) => {
      toast({ title: "خطأ في تطبيق الخطة", description: error.message || "حدث خطأ أثناء تطبيق خطة الإنتاج", variant: "destructive" });
    },
  });

  const handleGenerate = () => {
    if (!branchId || !targetSales || !planDate) {
      toast({ title: "بيانات ناقصة", description: "يرجى تعبئة جميع الحقول المطلوبة", variant: "destructive" });
      return;
    }
    generateMutation.mutate({
      branchId,
      targetSalesValue: parseFloat(targetSales),
      planDate,
      uploadId: salesDataFileId ? parseInt(salesDataFileId) : undefined,
    });
  };

  const handleApply = (planId: number) => {
    applyMutation.mutate(planId);
  };

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

  const getBranchName = (branchId: string) => {
    return branches?.find((b) => b.id === branchId)?.name || branchId;
  };

  const paginatedHistory = getPageItems(planHistory || [], historyPage);

  return (
    <Layout>
      <div className="space-y-6" dir="rtl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">مخطط الإنتاج الذكي</h1>
              <p className="text-muted-foreground">توليد خطط إنتاج ذكية باستخدام الذكاء الاصطناعي</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-500" />
                توليد خطة إنتاج
              </CardTitle>
              <CardDescription>أدخل البيانات لتوليد خطة إنتاج ذكية</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="branch">الفرع *</Label>
                <Select value={branchId} onValueChange={setBranchId}>
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
                <Label htmlFor="targetSales">المبيعات المستهدفة بالريال *</Label>
                <div className="relative">
                  <DollarSign className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    id="targetSales"
                    type="number"
                    min="0"
                    step="100"
                    value={targetSales}
                    onChange={(e) => setTargetSales(e.target.value)}
                    placeholder="مثال: 50000"
                    className="pr-10"
                    data-testid="input-target-sales"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="planDate">تاريخ الخطة *</Label>
                <div className="relative">
                  <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    id="planDate"
                    type="date"
                    value={planDate}
                    onChange={(e) => setPlanDate(e.target.value)}
                    className="pr-10"
                    data-testid="input-plan-date"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="salesData">بيانات المبيعات السابقة (اختياري)</Label>
                <Select value={salesDataFileId || "none"} onValueChange={(val) => setSalesDataFileId(val === "none" ? "" : val)}>
                  <SelectTrigger data-testid="select-sales-data">
                    <SelectValue placeholder="اختر ملف بيانات المبيعات" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">بدون بيانات سابقة</SelectItem>
                    {salesDataFiles?.filter(f => f.status === 'completed').map((file) => (
                      <SelectItem key={file.id} value={file.id.toString()}>
                        {file.fileName} ({file.periodStart} - {file.periodEnd})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleGenerate}
                disabled={generateMutation.isPending || !branchId || !targetSales || !planDate}
                className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700"
                data-testid="button-generate-plan"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    جاري التوليد...
                  </>
                ) : (
                  <>
                    <Brain className="w-4 h-4 ml-2" />
                    توليد الخطة
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-500" />
                نتيجة الخطة
              </CardTitle>
              <CardDescription>تفاصيل خطة الإنتاج المولدة</CardDescription>
            </CardHeader>
            <CardContent>
              {generateMutation.isPending ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 animate-pulse" />
                    <Brain className="w-8 h-8 text-white absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                  </div>
                  <p className="text-muted-foreground">جاري تحليل البيانات وتوليد الخطة...</p>
                </div>
              ) : generatedPlan ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 text-center">
                      <Percent className="w-6 h-6 mx-auto mb-2 text-purple-600" />
                      <p className="text-2xl font-bold text-purple-700" data-testid="text-confidence">
                        {(generatedPlan.confidenceScore * 100).toFixed(0)}%
                      </p>
                      <p className="text-xs text-purple-600">مستوى الثقة</p>
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 text-center">
                      <TrendingUp className="w-6 h-6 mx-auto mb-2 text-green-600" />
                      <p className="text-lg font-bold text-green-700" data-testid="text-estimated-value">
                        {formatCurrency(generatedPlan.totalEstimatedValue)}
                      </p>
                      <p className="text-xs text-green-600">القيمة المتوقعة</p>
                    </div>
                    <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-4 text-center">
                      <DollarSign className="w-6 h-6 mx-auto mb-2 text-amber-600" />
                      <p className="text-lg font-bold text-amber-700" data-testid="text-estimated-cost">
                        {formatCurrency(generatedPlan.estimatedCost)}
                      </p>
                      <p className="text-xs text-amber-600">التكلفة المتوقعة</p>
                    </div>
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 text-center">
                      <Percent className="w-6 h-6 mx-auto mb-2 text-blue-600" />
                      <p className="text-2xl font-bold text-blue-700" data-testid="text-profit-margin">
                        {generatedPlan.profitMargin.toFixed(1)}%
                      </p>
                      <p className="text-xs text-blue-600">هامش الربح</p>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      المنتجات الموصى بها ({generatedPlan.products?.length || 0})
                    </h3>
                    {generatedPlan.products && generatedPlan.products.length > 0 ? (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {generatedPlan.products.map((product, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
                            data-testid={`product-row-${index}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                                <Package className="w-4 h-4 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium">{product.productName}</p>
                                <p className="text-xs text-muted-foreground">
                                  {product.quantity} وحدة × {formatCurrency(product.unitPrice)}
                                </p>
                              </div>
                            </div>
                            <div className="text-left">
                              <p className="font-semibold">{formatCurrency(product.totalPrice)}</p>
                              <p className="text-xs text-muted-foreground">
                                تكلفة: {formatCurrency(product.estimatedCost)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">
                        <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>لا توجد منتجات في هذه الخطة</p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <Button
                      onClick={() => handleApply(generatedPlan.id)}
                      disabled={applyMutation.isPending || generatedPlan.status === "applied"}
                      className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                      data-testid="button-apply-plan"
                    >
                      {applyMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                          جاري التطبيق...
                        </>
                      ) : generatedPlan.status === "applied" ? (
                        <>
                          <CheckCircle className="w-4 h-4 ml-2" />
                          تم التطبيق
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 ml-2" />
                          تطبيق الخطة
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setGeneratedPlan(null)}
                      data-testid="button-new-plan"
                    >
                      <RefreshCw className="w-4 h-4 ml-2" />
                      خطة جديدة
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Brain className="w-16 h-16 mb-4 opacity-20" />
                  <p className="text-lg">أدخل البيانات واضغط على "توليد الخطة"</p>
                  <p className="text-sm">سيتم تحليل البيانات وتوليد خطة إنتاج ذكية</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-gray-500" />
              تاريخ الخطط السابقة
            </CardTitle>
            <CardDescription>عرض جميع خطط الإنتاج الذكية السابقة</CardDescription>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(3)].map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <Skeleton className="h-6 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-1/2 mb-4" />
                      <Skeleton className="h-20 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : !planHistory || planHistory.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <History className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p className="text-lg">لا توجد خطط سابقة</p>
                <p className="text-sm">ابدأ بتوليد خطة إنتاج جديدة</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {paginatedHistory.map((plan) => {
                    const statusConfig = STATUS_CONFIG[plan.status];
                    return (
                      <Card key={plan.id} className="hover:shadow-md transition-shadow" data-testid={`card-plan-${plan.id}`}>
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium" data-testid={`text-plan-branch-${plan.id}`}>
                              {getBranchName(plan.branchId)}
                            </span>
                            <Badge className={statusConfig?.color || ""} data-testid={`badge-status-${plan.id}`}>
                              {statusConfig?.label || plan.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="w-4 h-4" />
                            <span data-testid={`text-plan-date-${plan.id}`}>{formatDate(plan.planDate)}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <p className="text-muted-foreground">المستهدف</p>
                              <p className="font-semibold" data-testid={`text-target-${plan.id}`}>
                                {formatCurrency(plan.targetSales)}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">مستوى الثقة</p>
                              <p className="font-semibold" data-testid={`text-confidence-${plan.id}`}>
                                {(plan.confidenceScore * 100).toFixed(0)}%
                              </p>
                            </div>
                          </div>
                          <Progress value={plan.confidenceScore * 100} className="h-2" />
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{plan.products?.length || 0} منتج</span>
                            <span>{formatDate(plan.createdAt)}</span>
                          </div>
                          {plan.status === "generated" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleApply(plan.id)}
                              disabled={applyMutation.isPending}
                              className="w-full"
                              data-testid={`button-apply-${plan.id}`}
                            >
                              <CheckCircle className="w-4 h-4 ml-1" />
                              تطبيق الخطة
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                <TablePagination
                  currentPage={historyPage}
                  totalItems={planHistory?.length || 0}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setHistoryPage}
                />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
