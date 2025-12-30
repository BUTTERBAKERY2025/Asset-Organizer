import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Gift, Award, DollarSign, Settings, ChevronLeft, Calculator, Check, X, Plus, FileSpreadsheet, FileText } from "lucide-react";
import { Link } from "wouter";
import * as XLSX from "xlsx";
import type { Branch, IncentiveTier, IncentiveAward } from "@shared/schema";

const REWARD_TYPE_LABELS: Record<string, string> = {
  fixed: "مبلغ ثابت",
  percentage: "نسبة مئوية",
  both: "ثابت + نسبة",
};

const AWARD_STATUS_LABELS: Record<string, string> = {
  pending: "قيد الانتظار",
  approved: "معتمد",
  paid: "مدفوع",
  cancelled: "ملغى",
};

const AWARD_STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500",
  approved: "bg-blue-500",
  paid: "bg-green-500",
  cancelled: "bg-gray-500",
};

interface CalculatedAward {
  branchId: string;
  branchName: string;
  targetAmount: number;
  achievedAmount: number;
  achievementPercent: number;
  tierName: string;
  tierId: number;
  calculatedReward: number;
  status: string;
}

export default function IncentivesManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [showNewTierDialog, setShowNewTierDialog] = useState(false);
  const [calculatedAwards, setCalculatedAwards] = useState<CalculatedAward[]>([]);
  const [newTier, setNewTier] = useState({
    name: "",
    description: "",
    minAchievementPercent: "",
    maxAchievementPercent: "",
    rewardType: "fixed",
    fixedAmount: "",
    percentageRate: "",
    applicableTo: "all",
    sortOrder: "0"
  });

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const { data: tiers = [], isLoading: tiersLoading } = useQuery<IncentiveTier[]>({
    queryKey: ["/api/incentives/tiers"],
  });

  const { data: awards = [], isLoading: awardsLoading } = useQuery<IncentiveAward[]>({
    queryKey: ["/api/incentives/awards"],
  });

  const createTierMutation = useMutation({
    mutationFn: async (data: typeof newTier) => {
      const res = await fetch("/api/incentives/tiers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          minAchievementPercent: parseFloat(data.minAchievementPercent),
          maxAchievementPercent: data.maxAchievementPercent ? parseFloat(data.maxAchievementPercent) : null,
          rewardType: data.rewardType,
          fixedAmount: data.fixedAmount ? parseFloat(data.fixedAmount) : null,
          percentageRate: data.percentageRate ? parseFloat(data.percentageRate) : null,
          applicableTo: data.applicableTo,
          sortOrder: parseInt(data.sortOrder),
          isActive: true
        }),
      });
      if (!res.ok) throw new Error("Failed to create tier");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incentives/tiers"] });
      setShowNewTierDialog(false);
      setNewTier({
        name: "", description: "", minAchievementPercent: "", maxAchievementPercent: "",
        rewardType: "fixed", fixedAmount: "", percentageRate: "", applicableTo: "all", sortOrder: "0"
      });
      toast({ title: "تم إنشاء مستوى الحافز بنجاح" });
    },
    onError: () => {
      toast({ title: "خطأ في إنشاء مستوى الحافز", variant: "destructive" });
    }
  });

  const calculateIncentivesMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/incentives/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yearMonth: selectedMonth }),
      });
      if (!res.ok) throw new Error("Failed to calculate incentives");
      return res.json();
    },
    onSuccess: (data) => {
      setCalculatedAwards(data);
      toast({ title: "تم حساب الحوافز بنجاح" });
    },
    onError: () => {
      toast({ title: "خطأ في حساب الحوافز", variant: "destructive" });
    }
  });

  const approveAwardMutation = useMutation({
    mutationFn: async (awardId: number) => {
      const res = await fetch(`/api/incentives/awards/${awardId}/approve`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to approve award");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incentives/awards"] });
      toast({ title: "تم اعتماد الحافز بنجاح" });
    }
  });

  const payAwardMutation = useMutation({
    mutationFn: async (awardId: number) => {
      const res = await fetch(`/api/incentives/awards/${awardId}/pay`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to mark as paid");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incentives/awards"] });
      toast({ title: "تم تسجيل صرف الحافز بنجاح" });
    }
  });

  const saveCalculatedAwardsMutation = useMutation({
    mutationFn: async (awards: CalculatedAward[]) => {
      const promises = awards.map(award => 
        fetch("/api/incentives/awards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            awardType: "monthly",
            branchId: award.branchId,
            periodStart: `${selectedMonth}-01`,
            periodEnd: `${selectedMonth}-31`,
            targetAmount: award.targetAmount,
            achievedAmount: award.achievedAmount,
            achievementPercent: award.achievementPercent,
            tierId: award.tierId,
            calculatedReward: award.calculatedReward,
            finalReward: award.calculatedReward,
            status: "pending"
          }),
        })
      );
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incentives/awards"] });
      setCalculatedAwards([]);
      toast({ title: "تم حفظ سجلات الحوافز بنجاح" });
    }
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-SA', { 
      style: 'currency', 
      currency: 'SAR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0 
    }).format(amount);
  };

  const getBranchName = (branchId: string | null) => {
    if (!branchId) return "جميع الفروع";
    return branches.find(b => b.id === branchId)?.name || branchId;
  };

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    
    if (awards?.length) {
      const filteredAwards = awards.filter(a => a.periodStart?.startsWith(selectedMonth));
      const data = filteredAwards.map(a => ({
        'الفرع': getBranchName(a.branchId || ''),
        'الفترة من': a.periodStart,
        'الفترة إلى': a.periodEnd,
        'الهدف': a.targetAmount,
        'المحقق': a.achievedAmount,
        'النسبة': `${a.achievementPercent?.toFixed(1)}%`,
        'المكافأة': a.finalReward,
        'الحالة': AWARD_STATUS_LABELS[a.status] || a.status
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'سجل الحوافز');
    }
    
    if (calculatedAwards?.length) {
      const calcData = calculatedAwards.map(a => ({
        'الفرع': a.branchName,
        'الهدف': a.targetAmount,
        'المحقق': a.achievedAmount,
        'النسبة': `${a.achievementPercent.toFixed(1)}%`,
        'المستوى': a.tierName,
        'المكافأة المحسوبة': a.calculatedReward
      }));
      const ws2 = XLSX.utils.json_to_sheet(calcData);
      XLSX.utils.book_append_sheet(wb, ws2, 'الحوافز المحسوبة');
    }
    
    if (tiers?.length) {
      const tiersData = tiers.map(t => ({
        'المستوى': t.name,
        'الوصف': t.description || '',
        'من نسبة': `${t.minAchievementPercent}%`,
        'إلى نسبة': `${t.maxAchievementPercent}%`,
        'نوع المكافأة': REWARD_TYPE_LABELS[t.rewardType] || t.rewardType,
        'مبلغ ثابت': t.fixedAmount || 0,
        'نسبة مئوية': `${t.percentageRate || 0}%`
      }));
      const ws3 = XLSX.utils.json_to_sheet(tiersData);
      XLSX.utils.book_append_sheet(wb, ws3, 'مستويات الحوافز');
    }
    
    XLSX.writeFile(wb, `الحوافز_${selectedMonth}.xlsx`);
  };

  const exportToPDF = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>تقرير الحوافز - ${selectedMonth}</title>
          <style>
            body { font-family: 'Cairo', sans-serif; padding: 20px; direction: rtl; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
            th { background-color: #f59e0b; color: white; }
            h1, h2 { color: #92400e; }
            .header { text-align: center; margin-bottom: 30px; }
            @media print { body { print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>تقرير الحوافز والمكافآت</h1>
            <p>الشهر: ${selectedMonth}</p>
          </div>
          ${calculatedAwards?.length ? `
            <h2>الحوافز المحسوبة</h2>
            <table>
              <thead><tr><th>الفرع</th><th>الهدف</th><th>المحقق</th><th>النسبة</th><th>المستوى</th><th>المكافأة</th></tr></thead>
              <tbody>${calculatedAwards.map(a => `<tr><td>${a.branchName}</td><td>${formatCurrency(a.targetAmount)}</td><td>${formatCurrency(a.achievedAmount)}</td><td>${a.achievementPercent.toFixed(1)}%</td><td>${a.tierName}</td><td>${formatCurrency(a.calculatedReward)}</td></tr>`).join('')}</tbody>
            </table>
          ` : ''}
          ${tiers?.length ? `
            <h2>مستويات الحوافز</h2>
            <table>
              <thead><tr><th>المستوى</th><th>من %</th><th>إلى %</th><th>نوع المكافأة</th><th>المبلغ</th></tr></thead>
              <tbody>${tiers.map(t => `<tr><td>${t.name}</td><td>${t.minAchievementPercent}%</td><td>${t.maxAchievementPercent}%</td><td>${REWARD_TYPE_LABELS[t.rewardType] || t.rewardType}</td><td>${formatCurrency(t.fixedAmount || 0)}</td></tr>`).join('')}</tbody>
            </table>
          ` : ''}
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 500);
    }
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-amber-900 flex items-center gap-3">
              <Gift className="h-8 w-8" />
              إدارة الحوافز والمكافآت
            </h1>
            <p className="text-amber-700 mt-1">تعريف مستويات الحوافز وإدارة المكافآت</p>
          </div>
          
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Label>الشهر:</Label>
              <Input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-40"
                data-testid="input-month-selector"
              />
            </div>
            
            <Button variant="outline" onClick={exportToExcel} data-testid="button-export-excel">
              <FileSpreadsheet className="h-4 w-4 ml-2" />
              تصدير Excel
            </Button>
            
            <Button variant="outline" onClick={exportToPDF} data-testid="button-export-pdf">
              <FileText className="h-4 w-4 ml-2" />
              طباعة PDF
            </Button>
            
            <Button 
              onClick={() => calculateIncentivesMutation.mutate()}
              disabled={calculateIncentivesMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700"
              data-testid="button-calculate"
            >
              <Calculator className="h-4 w-4 ml-2" />
              {calculateIncentivesMutation.isPending ? "جاري الحساب..." : "احسب الحوافز"}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="awards" className="space-y-4">
          <TabsList>
            <TabsTrigger value="awards" className="flex items-center gap-2">
              <Award className="h-4 w-4" />
              سجل الحوافز
            </TabsTrigger>
            <TabsTrigger value="tiers" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              مستويات الحوافز
            </TabsTrigger>
            <TabsTrigger value="calculated" className="flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              الحوافز المحسوبة ({calculatedAwards.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="awards">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-amber-600" />
                  سجل الحوافز والمكافآت
                </CardTitle>
              </CardHeader>
              <CardContent>
                {awardsLoading ? (
                  <div className="text-center py-8 text-gray-500">جاري التحميل...</div>
                ) : awards.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">لا توجد سجلات حوافز</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الفرع</TableHead>
                        <TableHead>الفترة</TableHead>
                        <TableHead>الهدف</TableHead>
                        <TableHead>المحقق</TableHead>
                        <TableHead>النسبة</TableHead>
                        <TableHead>الحافز</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead>الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {awards.map((award) => (
                        <TableRow key={award.id} data-testid={`row-award-${award.id}`}>
                          <TableCell className="font-medium">{getBranchName(award.branchId)}</TableCell>
                          <TableCell className="text-sm">{award.periodStart} - {award.periodEnd}</TableCell>
                          <TableCell className="font-mono">{formatCurrency(award.targetAmount)}</TableCell>
                          <TableCell className="font-mono">{formatCurrency(award.achievedAmount)}</TableCell>
                          <TableCell className={`font-bold ${award.achievementPercent >= 100 ? 'text-green-600' : 'text-amber-600'}`}>
                            {award.achievementPercent.toFixed(1)}%
                          </TableCell>
                          <TableCell className="font-mono font-bold text-green-600">
                            {formatCurrency(award.finalReward)}
                          </TableCell>
                          <TableCell>
                            <Badge className={AWARD_STATUS_COLORS[award.status]}>
                              {AWARD_STATUS_LABELS[award.status]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {award.status === 'pending' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => approveAwardMutation.mutate(award.id)}
                                  data-testid={`button-approve-${award.id}`}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              )}
                              {award.status === 'approved' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-green-600"
                                  onClick={() => payAwardMutation.mutate(award.id)}
                                  data-testid={`button-pay-${award.id}`}
                                >
                                  <DollarSign className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tiers">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5 text-amber-600" />
                    مستويات الحوافز
                  </CardTitle>
                  <CardDescription>تعريف مستويات المكافآت حسب نسبة تحقيق الهدف</CardDescription>
                </div>
                <Dialog open={showNewTierDialog} onOpenChange={setShowNewTierDialog}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-tier">
                      <Plus className="h-4 w-4 ml-2" />
                      إضافة مستوى
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md" dir="rtl">
                    <DialogHeader>
                      <DialogTitle>إضافة مستوى حافز جديد</DialogTitle>
                    </DialogHeader>
                    
                    <div className="space-y-4">
                      <div>
                        <Label>اسم المستوى</Label>
                        <Input
                          value={newTier.name}
                          onChange={(e) => setNewTier({ ...newTier, name: e.target.value })}
                          placeholder="مثال: المستوى الذهبي"
                          data-testid="input-tier-name"
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>الحد الأدنى %</Label>
                          <Input
                            type="number"
                            value={newTier.minAchievementPercent}
                            onChange={(e) => setNewTier({ ...newTier, minAchievementPercent: e.target.value })}
                            placeholder="80"
                            data-testid="input-min-percent"
                          />
                        </div>
                        <div>
                          <Label>الحد الأقصى %</Label>
                          <Input
                            type="number"
                            value={newTier.maxAchievementPercent}
                            onChange={(e) => setNewTier({ ...newTier, maxAchievementPercent: e.target.value })}
                            placeholder="99"
                            data-testid="input-max-percent"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <Label>نوع المكافأة</Label>
                        <Select
                          value={newTier.rewardType}
                          onValueChange={(v) => setNewTier({ ...newTier, rewardType: v })}
                        >
                          <SelectTrigger data-testid="select-reward-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fixed">مبلغ ثابت</SelectItem>
                            <SelectItem value="percentage">نسبة من الزيادة</SelectItem>
                            <SelectItem value="both">ثابت + نسبة</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {(newTier.rewardType === 'fixed' || newTier.rewardType === 'both') && (
                        <div>
                          <Label>المبلغ الثابت (ريال)</Label>
                          <Input
                            type="number"
                            value={newTier.fixedAmount}
                            onChange={(e) => setNewTier({ ...newTier, fixedAmount: e.target.value })}
                            placeholder="500"
                            data-testid="input-fixed-amount"
                          />
                        </div>
                      )}
                      
                      {(newTier.rewardType === 'percentage' || newTier.rewardType === 'both') && (
                        <div>
                          <Label>نسبة من الزيادة %</Label>
                          <Input
                            type="number"
                            value={newTier.percentageRate}
                            onChange={(e) => setNewTier({ ...newTier, percentageRate: e.target.value })}
                            placeholder="5"
                            data-testid="input-percentage-rate"
                          />
                        </div>
                      )}
                    </div>
                    
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowNewTierDialog(false)}>إلغاء</Button>
                      <Button 
                        onClick={() => createTierMutation.mutate(newTier)}
                        disabled={!newTier.name || !newTier.minAchievementPercent || createTierMutation.isPending}
                        data-testid="button-save-tier"
                      >
                        {createTierMutation.isPending ? "جاري الحفظ..." : "حفظ"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {tiersLoading ? (
                  <div className="text-center py-8 text-gray-500">جاري التحميل...</div>
                ) : tiers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">لا توجد مستويات حوافز</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>اسم المستوى</TableHead>
                        <TableHead>نطاق التحقيق</TableHead>
                        <TableHead>نوع المكافأة</TableHead>
                        <TableHead>المبلغ الثابت</TableHead>
                        <TableHead>نسبة الزيادة</TableHead>
                        <TableHead>الحالة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tiers.map((tier) => (
                        <TableRow key={tier.id} data-testid={`row-tier-${tier.id}`}>
                          <TableCell className="font-medium">{tier.name}</TableCell>
                          <TableCell>
                            {tier.minAchievementPercent}% - {tier.maxAchievementPercent ? `${tier.maxAchievementPercent}%` : '∞'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{REWARD_TYPE_LABELS[tier.rewardType]}</Badge>
                          </TableCell>
                          <TableCell className="font-mono">
                            {tier.fixedAmount ? formatCurrency(tier.fixedAmount) : '-'}
                          </TableCell>
                          <TableCell>
                            {tier.percentageRate ? `${tier.percentageRate}%` : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={tier.isActive ? "default" : "secondary"}>
                              {tier.isActive ? "نشط" : "غير نشط"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="calculated">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-amber-600" />
                    الحوافز المحسوبة لشهر {selectedMonth}
                  </CardTitle>
                  <CardDescription>معاينة الحوافز قبل حفظها</CardDescription>
                </div>
                {calculatedAwards.length > 0 && (
                  <Button 
                    onClick={() => saveCalculatedAwardsMutation.mutate(calculatedAwards)}
                    disabled={saveCalculatedAwardsMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                    data-testid="button-save-calculated"
                  >
                    <Check className="h-4 w-4 ml-2" />
                    حفظ الكل
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {calculatedAwards.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    اضغط على "احسب الحوافز" لعرض الحوافز المستحقة
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الفرع</TableHead>
                        <TableHead>الهدف</TableHead>
                        <TableHead>المحقق</TableHead>
                        <TableHead>نسبة التحقيق</TableHead>
                        <TableHead>المستوى</TableHead>
                        <TableHead>الحافز المستحق</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {calculatedAwards.map((award, index) => (
                        <TableRow key={index} data-testid={`row-calculated-${index}`}>
                          <TableCell className="font-medium">{award.branchName}</TableCell>
                          <TableCell className="font-mono">{formatCurrency(award.targetAmount)}</TableCell>
                          <TableCell className="font-mono">{formatCurrency(award.achievedAmount)}</TableCell>
                          <TableCell className={`font-bold ${award.achievementPercent >= 100 ? 'text-green-600' : 'text-amber-600'}`}>
                            {award.achievementPercent.toFixed(1)}%
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-amber-500">{award.tierName}</Badge>
                          </TableCell>
                          <TableCell className="font-mono font-bold text-green-600 text-lg">
                            {formatCurrency(award.calculatedReward)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
