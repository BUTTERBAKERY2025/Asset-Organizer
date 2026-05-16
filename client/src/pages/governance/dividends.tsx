import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Banknote,
  Plus,
  ChevronLeft,
  Calendar,
  DollarSign,
  Users,
  CheckCircle,
  Clock,
  TrendingUp,
  Percent,
  CreditCard,
} from "lucide-react";
import type { DividendDistribution } from "@shared/schema";

const distributionTypes = [
  { value: "cash", label: "نقدي" },
  { value: "stock", label: "أسهم" },
  { value: "mixed", label: "مختلط" },
];

const distributionStatuses = [
  { value: "announced", label: "معلن", color: "bg-blue-100 text-blue-800" },
  { value: "approved", label: "معتمد", color: "bg-yellow-100 text-yellow-800" },
  { value: "in_progress", label: "جاري التوزيع", color: "bg-orange-100 text-orange-800" },
  { value: "completed", label: "مكتمل", color: "bg-green-100 text-green-800" },
  { value: "cancelled", label: "ملغي", color: "bg-red-100 text-red-800" },
];

export default function DividendsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: distributions = [], isLoading } = useQuery<DividendDistribution[]>({
    queryKey: ["/api/governance/dividends"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<DividendDistribution>) => {
      const res = await fetch("/api/governance/dividends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create distribution");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/dividends"] });
      setIsDialogOpen(false);
      toast({ title: "تم إنشاء التوزيع بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في إنشاء التوزيع", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const recordDateStr = formData.get("recordDate") as string;
    const paymentDateStr = formData.get("paymentDate") as string;
    const data = {
      fiscalYear: formData.get("fiscalYear") as string,
      distributionType: formData.get("distributionType") as string,
      description: formData.get("description") as string,
      totalAmount: formData.get("totalAmount") as string,
      amountPerShare: formData.get("amountPerShare") as string,
      eligibleShares: parseInt(formData.get("eligibleShares") as string),
      recordDate: recordDateStr || new Date().toISOString().split('T')[0],
      paymentDate: paymentDateStr || new Date().toISOString().split('T')[0],
      withholdingTaxRate: formData.get("withholdingTaxRate") as string || "0",
    };
    createMutation.mutate(data);
  };

  const totalDistributed = distributions
    .filter(d => d.status === 'completed')
    .reduce((sum, d) => sum + (Number(d.paidAmount) || 0), 0);

  const totalAnnounced = distributions
    .reduce((sum, d) => sum + (Number(d.totalAmount) || 0), 0);

  return (
    <Layout>
      <div className="max-w-screen-2xl mx-auto p-3 sm:p-4 md:p-6 space-y-4" dir="rtl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <Link href="/governance">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="p-2 sm:p-3 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl">
              <Banknote className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-orange-800" data-testid="page-title">
                توزيعات الأرباح
              </h1>
              <p className="text-xs sm:text-sm text-gray-600">إدارة توزيعات أرباح المساهمين</p>
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-orange-600 hover:bg-orange-700" data-testid="btn-add-distribution">
                <Plus className="h-4 w-4" />
                توزيع جديد
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>إنشاء توزيع أرباح</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fiscalYear">السنة المالية *</Label>
                    <Input id="fiscalYear" name="fiscalYear" defaultValue={new Date().getFullYear().toString()} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="distributionType">نوع التوزيع *</Label>
                    <Select name="distributionType" defaultValue="cash">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {distributionTypes.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="totalAmount">إجمالي المبلغ (ر.س) *</Label>
                    <Input id="totalAmount" name="totalAmount" type="number" step="0.01" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amountPerShare">المبلغ لكل سهم (ر.س) *</Label>
                    <Input id="amountPerShare" name="amountPerShare" type="number" step="0.0001" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="eligibleShares">عدد الأسهم المستحقة *</Label>
                    <Input id="eligibleShares" name="eligibleShares" type="number" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="withholdingTaxRate">نسبة الضريبة المستقطعة (%)</Label>
                    <Input id="withholdingTaxRate" name="withholdingTaxRate" type="number" step="0.01" defaultValue="0" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recordDate">تاريخ الأحقية *</Label>
                    <Input id="recordDate" name="recordDate" type="date" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="paymentDate">تاريخ الصرف *</Label>
                    <Input id="paymentDate" name="paymentDate" type="date" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">الوصف</Label>
                  <Textarea id="description" name="description" />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
                  <Button type="submit" className="bg-orange-600 hover:bg-orange-700">إنشاء التوزيع</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-orange-600">إجمالي التوزيعات</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-orange-800">{distributions.length}</p>
                </div>
                <Banknote className="h-6 w-6 sm:h-8 sm:w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-green-600">تم توزيعها</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-green-800">{totalDistributed.toLocaleString()} <span className="text-xs sm:text-sm">ر.س</span></p>
                </div>
                <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-blue-600">إجمالي معلن</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-blue-800">{totalAnnounced.toLocaleString()} <span className="text-xs sm:text-sm">ر.س</span></p>
                </div>
                <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-yellow-600">جاري التوزيع</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-yellow-800">
                    {distributions.filter(d => d.status === 'in_progress').length}
                  </p>
                </div>
                <Clock className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4">
          {isLoading ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                جاري التحميل...
              </CardContent>
            </Card>
          ) : distributions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                لا يوجد توزيعات أرباح
              </CardContent>
            </Card>
          ) : (
            distributions.map((distribution) => {
              const paidPercentage = distribution.totalAmount && Number(distribution.totalAmount) > 0
                ? ((Number(distribution.paidAmount) || 0) / Number(distribution.totalAmount)) * 100
                : 0;
              return (
                <Card key={distribution.id} className="hover:shadow-md transition-shadow" data-testid={`dividend-card-${distribution.id}`}>
                  <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-1 sm:gap-2 mb-2 flex-wrap">
                          <Badge variant="outline" className="font-mono text-[10px] sm:text-xs">
                            {distribution.distributionNumber}
                          </Badge>
                          <Badge className={`text-[10px] sm:text-xs ${distributionStatuses.find(s => s.value === distribution.status)?.color}`}>
                            {distributionStatuses.find(s => s.value === distribution.status)?.label}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] sm:text-xs">
                            {distributionTypes.find(t => t.value === distribution.distributionType)?.label}
                          </Badge>
                        </div>
                        <h3 className="font-semibold text-lg mb-2">
                          توزيع أرباح {distribution.fiscalYear}
                        </h3>
                        {distribution.description && (
                          <p className="text-sm text-gray-600 mb-3">{distribution.description}</p>
                        )}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-4">
                          <div className="bg-gray-50 p-2 sm:p-3 rounded-lg">
                            <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-gray-600 mb-1">
                              <DollarSign className="h-3 w-3 sm:h-4 sm:w-4" />
                              <span>إجمالي المبلغ</span>
                            </div>
                            <p className="font-semibold text-sm sm:text-base">{Number(distribution.totalAmount).toLocaleString()} ر.س</p>
                          </div>
                          <div className="bg-gray-50 p-2 sm:p-3 rounded-lg">
                            <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-gray-600 mb-1">
                              <CreditCard className="h-3 w-3 sm:h-4 sm:w-4" />
                              <span>لكل سهم</span>
                            </div>
                            <p className="font-semibold text-sm sm:text-base">{Number(distribution.amountPerShare).toFixed(4)} ر.س</p>
                          </div>
                          <div className="bg-gray-50 p-2 sm:p-3 rounded-lg">
                            <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-gray-600 mb-1">
                              <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                              <span>الأسهم المستحقة</span>
                            </div>
                            <p className="font-semibold text-sm sm:text-base">{distribution.eligibleShares?.toLocaleString()}</p>
                          </div>
                          <div className="bg-gray-50 p-2 sm:p-3 rounded-lg">
                            <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-gray-600 mb-1">
                              <Percent className="h-3 w-3 sm:h-4 sm:w-4" />
                              <span>نسبة الضريبة</span>
                            </div>
                            <p className="font-semibold text-sm sm:text-base">{Number(distribution.withholdingTaxRate)}%</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-3">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span>تاريخ الأحقية: {distribution.recordDate ? new Date(distribution.recordDate).toLocaleDateString('en-GB') : '-'}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span>تاريخ الصرف: {distribution.paymentDate ? new Date(distribution.paymentDate).toLocaleDateString('en-GB') : '-'}</span>
                          </div>
                        </div>
                        {distribution.status === 'in_progress' && (
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>نسبة الصرف</span>
                              <span>{paidPercentage.toFixed(1)}%</span>
                            </div>
                            <Progress value={paidPercentage} className="h-2" />
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </Layout>
  );
}
