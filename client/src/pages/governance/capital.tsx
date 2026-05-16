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
import { useToast } from "@/hooks/use-toast";
import {
  Briefcase,
  Plus,
  ChevronLeft,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  FileText,
  CheckCircle,
  Clock,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import type { CapitalTransaction } from "@shared/schema";

const transactionTypes = [
  { value: "increase", label: "زيادة رأس المال", icon: TrendingUp, color: "text-green-600" },
  { value: "decrease", label: "تخفيض رأس المال", icon: TrendingDown, color: "text-red-600" },
  { value: "stock_split", label: "تجزئة الأسهم", icon: ArrowUp, color: "text-blue-600" },
  { value: "reverse_split", label: "تجميع الأسهم", icon: ArrowDown, color: "text-purple-600" },
];

const transactionStatuses = [
  { value: "pending", label: "قيد المراجعة", color: "bg-yellow-100 text-yellow-800" },
  { value: "approved", label: "معتمد", color: "bg-blue-100 text-blue-800" },
  { value: "registered", label: "مسجل", color: "bg-green-100 text-green-800" },
  { value: "rejected", label: "مرفوض", color: "bg-red-100 text-red-800" },
];

export default function CapitalPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: transactions = [], isLoading } = useQuery<CapitalTransaction[]>({
    queryKey: ["/api/governance/capital"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<CapitalTransaction>) => {
      const res = await fetch("/api/governance/capital", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create transaction");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/capital"] });
      setIsDialogOpen(false);
      toast({ title: "تم إنشاء معاملة رأس المال بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في إنشاء المعاملة", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const effectiveDateStr = formData.get("effectiveDate") as string;
    const data = {
      transactionType: formData.get("transactionType") as string,
      description: formData.get("description") as string,
      previousCapital: formData.get("previousCapital") as string,
      newCapital: formData.get("newCapital") as string,
      changeAmount: formData.get("changeAmount") as string,
      previousShares: parseInt(formData.get("previousShares") as string),
      newShares: parseInt(formData.get("newShares") as string),
      shareChange: parseInt(formData.get("shareChange") as string),
      pricePerShare: formData.get("pricePerShare") as string || null,
      effectiveDate: effectiveDateStr || new Date().toISOString().split('T')[0],
    };
    createMutation.mutate(data);
  };

  const latestTransaction = transactions[0];
  const currentCapital = latestTransaction ? Number(latestTransaction.newCapital) : 0;
  const currentShares = latestTransaction ? latestTransaction.newShares : 0;

  return (
    <Layout>
      <div className="page-container space-y-3 sm:space-y-4" dir="rtl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/governance">
              <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8">
                <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
            </Link>
            <div className="p-2 sm:p-3 bg-gradient-to-br from-purple-500 to-violet-600 rounded-lg sm:rounded-xl">
              <Briefcase className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-purple-800" data-testid="page-title">
                إدارة رأس المال
              </h1>
              <p className="text-xs sm:text-sm text-gray-600">زيادة وتخفيض رأس المال وإدارة الأسهم</p>
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1 sm:gap-2 text-xs sm:text-sm bg-purple-600 hover:bg-purple-700" data-testid="btn-add-transaction">
                <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                معاملة جديدة
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>إنشاء معاملة رأس مال</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="transactionType">نوع المعاملة *</Label>
                    <Select name="transactionType" defaultValue="increase">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {transactionTypes.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="previousCapital">رأس المال السابق (ر.س) *</Label>
                    <Input id="previousCapital" name="previousCapital" type="number" step="0.01" defaultValue={currentCapital} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newCapital">رأس المال الجديد (ر.س) *</Label>
                    <Input id="newCapital" name="newCapital" type="number" step="0.01" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="changeAmount">مبلغ التغيير (ر.س) *</Label>
                    <Input id="changeAmount" name="changeAmount" type="number" step="0.01" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pricePerShare">سعر السهم (ر.س)</Label>
                    <Input id="pricePerShare" name="pricePerShare" type="number" step="0.01" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="previousShares">عدد الأسهم السابق *</Label>
                    <Input id="previousShares" name="previousShares" type="number" defaultValue={currentShares || 0} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newShares">عدد الأسهم الجديد *</Label>
                    <Input id="newShares" name="newShares" type="number" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shareChange">التغيير في الأسهم *</Label>
                    <Input id="shareChange" name="shareChange" type="number" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="effectiveDate">تاريخ السريان *</Label>
                    <Input id="effectiveDate" name="effectiveDate" type="date" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">الوصف *</Label>
                  <Textarea id="description" name="description" required />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
                  <Button type="submit" className="bg-purple-600 hover:bg-purple-700">إنشاء المعاملة</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="kpi-grid">
          <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
            <CardContent className="p-2 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-sm text-purple-600">رأس المال الحالي</p>
                  <p className="text-sm sm:text-2xl font-bold text-purple-800">{currentCapital.toLocaleString()} <span className="text-[10px] sm:text-base">ر.س</span></p>
                </div>
                <DollarSign className="h-5 w-5 sm:h-8 sm:w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="p-2 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-sm text-blue-600">عدد الأسهم</p>
                  <p className="text-lg sm:text-2xl font-bold text-blue-800">{(currentShares || 0).toLocaleString()}</p>
                </div>
                <Briefcase className="h-5 w-5 sm:h-8 sm:w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-2 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-sm text-green-600">زيادات رأس المال</p>
                  <p className="text-lg sm:text-2xl font-bold text-green-800">
                    {transactions.filter(t => t.transactionType === 'increase').length}
                  </p>
                </div>
                <TrendingUp className="h-5 w-5 sm:h-8 sm:w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200">
            <CardContent className="p-2 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-sm text-yellow-600">قيد المراجعة</p>
                  <p className="text-lg sm:text-2xl font-bold text-yellow-800">
                    {transactions.filter(t => t.status === 'pending').length}
                  </p>
                </div>
                <Clock className="h-5 w-5 sm:h-8 sm:w-8 text-yellow-500" />
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
          ) : transactions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                لا يوجد معاملات رأس مال
              </CardContent>
            </Card>
          ) : (
            transactions.map((transaction) => {
              const typeInfo = transactionTypes.find(t => t.value === transaction.transactionType);
              const TypeIcon = typeInfo?.icon || Briefcase;
              return (
                <Card key={transaction.id} className="hover:shadow-md transition-shadow" data-testid={`capital-card-${transaction.id}`}>
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex flex-col gap-3 sm:gap-4">
                      <div className="flex items-start gap-2 sm:gap-4">
                        <div className={`p-2 sm:p-3 rounded-lg ${transaction.transactionType === 'increase' ? 'bg-green-100' : 'bg-red-100'}`}>
                          <TypeIcon className={`h-4 w-4 sm:h-6 sm:w-6 ${typeInfo?.color}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-1 sm:gap-2 mb-2 flex-wrap">
                            <Badge variant="outline" className="font-mono text-[10px] sm:text-xs">
                              {transaction.transactionNumber}
                            </Badge>
                            <Badge className={`${transactionStatuses.find(s => s.value === transaction.status)?.color} text-[10px] sm:text-xs`}>
                              {transactionStatuses.find(s => s.value === transaction.status)?.label}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] sm:text-xs hidden sm:inline-flex">{typeInfo?.label}</Badge>
                          </div>
                          <p className="text-xs sm:text-sm text-gray-600 mb-2 sm:mb-3 line-clamp-2">{transaction.description}</p>
                          <div className="kpi-grid">
                            <div className="bg-gray-50 p-2 sm:p-3 rounded-lg">
                              <p className="text-[10px] sm:text-sm text-gray-600">رأس المال السابق</p>
                              <p className="text-xs sm:text-base font-semibold">{Number(transaction.previousCapital).toLocaleString()} <span className="text-[10px] sm:text-xs">ر.س</span></p>
                            </div>
                            <div className="bg-gray-50 p-2 sm:p-3 rounded-lg">
                              <p className="text-[10px] sm:text-sm text-gray-600">رأس المال الجديد</p>
                              <p className="text-xs sm:text-base font-semibold">{Number(transaction.newCapital).toLocaleString()} <span className="text-[10px] sm:text-xs">ر.س</span></p>
                            </div>
                            <div className={`p-2 sm:p-3 rounded-lg ${transaction.transactionType === 'increase' ? 'bg-green-50' : 'bg-red-50'}`}>
                              <p className="text-[10px] sm:text-sm text-gray-600">التغيير</p>
                              <p className={`text-xs sm:text-base font-semibold ${transaction.transactionType === 'increase' ? 'text-green-600' : 'text-red-600'}`}>
                                {transaction.transactionType === 'increase' ? '+' : '-'}{Number(transaction.changeAmount).toLocaleString()} <span className="text-[10px] sm:text-xs">ر.س</span>
                              </p>
                            </div>
                            <div className="bg-gray-50 p-2 sm:p-3 rounded-lg">
                              <div className="flex items-center gap-1 text-[10px] sm:text-sm text-gray-600">
                                <Calendar className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                <span>تاريخ السريان</span>
                              </div>
                              <p className="text-xs sm:text-base font-semibold">
                                {transaction.effectiveDate ? new Date(transaction.effectiveDate).toLocaleDateString('en-GB') : '-'}
                              </p>
                            </div>
                          </div>
                        </div>
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
