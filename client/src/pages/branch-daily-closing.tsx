import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useBranches } from "@/hooks/useBranches";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Link } from "wouter";
import { 
  Calendar, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Wallet, 
  DollarSign, 
  Users, 
  CreditCard,
  Building2,
  Save,
  ArrowLeft,
  FileCheck,
  ChevronDown,
  ChevronUp,
  Receipt,
  Eye
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import type { CashierSalesJournal, Branch } from "@shared/schema";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const formatCurrency = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined) return "0";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(amount);
};

const formatNumber = (num: number | null | undefined) => {
  if (num === null || num === undefined) return "0";
  return new Intl.NumberFormat("en-US").format(num);
};

const DISCREPANCY_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  balanced: { label: "متوازن", color: "text-green-600", icon: Minus },
  shortage: { label: "عجز", color: "text-red-600", icon: TrendingDown },
  surplus: { label: "زيادة", color: "text-amber-600", icon: TrendingUp },
};

type JournalPreviewResponse = {
  existingClosure: any | null;
  journals: CashierSalesJournal[];
  totals: {
    totalSales: number;
    cashTotal: number;
    networkTotal: number;
    deliveryTotal: number;
    totalOpeningBalance: number;
    totalExpectedCash: number;
    totalActualCash: number;
    totalCashDiscrepancy: number;
    totalCustomerCount: number;
    totalTransactionCount: number;
    totalBankPosAmount: number;
    totalBankTerminalAmount: number;
    totalBankDiscrepancy: number;
    journalsCount: number;
  };
  paymentMethodTotals: Record<string, {
    totalAmount: number;
    totalPosAmount: number;
    totalTerminalAmount: number;
    totalBankDiscrepancy: number;
    totalTransactionCount: number;
    totalTerminalTransactionCount: number;
  }>;
};

export default function BranchDailyClosingPage() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [selectedJournals, setSelectedJournals] = useState<number[]>([]);
  const [notes, setNotes] = useState("");
  const [expandedJournals, setExpandedJournals] = useState<number[]>([]);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { branches, userBranchId, canSelectBranch } = useBranches();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (userBranchId && !selectedBranch) {
      setSelectedBranch(userBranchId);
    }
  }, [userBranchId, selectedBranch]);

  const { data: journalPreview, isLoading: isLoadingPreview } = useQuery<JournalPreviewResponse | null>({
    queryKey: ["/api/branch-daily-closures/journals-preview", selectedBranch, selectedDate],
    queryFn: async (): Promise<JournalPreviewResponse | null> => {
      if (!selectedBranch || !selectedDate) return null;
      const response = await fetch(`/api/branch-daily-closures/journals-preview?branchId=${selectedBranch}&date=${selectedDate}`, {
        credentials: 'include'
      });
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!selectedBranch && !!selectedDate,
  });

  useEffect(() => {
    if (journalPreview?.journals) {
      setSelectedJournals(journalPreview.journals.map((j: any) => j.id));
    }
  }, [journalPreview]);

  const createClosureMutation = useMutation({
    mutationFn: async (data: { branchId: string; closureDate: string; journalIds: number[]; notes: string }) => {
      return apiRequest("POST", "/api/branch-daily-closures", data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch-daily-closures"] });
      toast({ title: "تم إنشاء الإغلاق اليومي بنجاح" });
      navigate(`/branch-daily-closures`);
    },
    onError: (error: any) => {
      toast({ 
        title: "خطأ", 
        description: error?.message || "فشل في إنشاء الإغلاق اليومي", 
        variant: "destructive" 
      });
    },
  });

  const handleCreateClosure = () => {
    if (!selectedBranch || !selectedDate || selectedJournals.length === 0) {
      toast({ 
        title: "خطأ", 
        description: "يرجى اختيار الفرع والتاريخ واليوميات", 
        variant: "destructive" 
      });
      return;
    }

    createClosureMutation.mutate({
      branchId: selectedBranch,
      closureDate: selectedDate,
      journalIds: selectedJournals,
      notes,
    });
  };

  const toggleJournal = (id: number) => {
    setSelectedJournals(prev => 
      prev.includes(id) ? prev.filter(j => j !== id) : [...prev, id]
    );
  };

  const toggleExpandJournal = (id: number) => {
    setExpandedJournals(prev => 
      prev.includes(id) ? prev.filter(j => j !== id) : [...prev, id]
    );
  };

  const selectAllJournals = () => {
    if (journalPreview?.journals) {
      setSelectedJournals(journalPreview.journals.map((j: any) => j.id));
    }
  };

  const deselectAllJournals = () => {
    setSelectedJournals([]);
  };

  const getDiscrepancyStatus = (amount: number) => {
    if (amount > 0.5) return 'surplus';
    if (amount < -0.5) return 'shortage';
    return 'balanced';
  };

  const selectedJournalsList = journalPreview?.journals?.filter((j: any) => selectedJournals.includes(j.id)) || [];
  const selectedTotals = {
    totalSales: selectedJournalsList.reduce((sum: number, j: any) => sum + (j.totalSales || 0), 0),
    cashTotal: selectedJournalsList.reduce((sum: number, j: any) => sum + (j.cashTotal || 0), 0),
    networkTotal: selectedJournalsList.reduce((sum: number, j: any) => sum + (j.networkTotal || 0), 0),
    deliveryTotal: selectedJournalsList.reduce((sum: number, j: any) => sum + (j.deliveryTotal || 0), 0),
    totalCashDiscrepancy: selectedJournalsList.reduce((sum: number, j: any) => sum + (j.discrepancyAmount || 0), 0),
    totalBankDiscrepancy: selectedJournalsList.reduce((sum: number, j: any) => sum + (j.bankDiscrepancyTotal || 0), 0),
    totalCustomerCount: selectedJournalsList.reduce((sum: number, j: any) => sum + (j.customerCount || 0), 0),
    journalsCount: selectedJournalsList.length,
  };

  const branchName = branches?.find(b => b.id === selectedBranch)?.name || "";

  return (
    <Layout>
      <div className="container mx-auto p-4 lg:p-6 space-y-6" dir="rtl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">إغلاق يومي جديد</h1>
            <p className="text-gray-500 mt-1">تجميع يوميات الكاشير في إغلاق يومي واحد</p>
          </div>
          <Link href="/branch-daily-closures">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              عرض الإغلاقات السابقة
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-amber-600" />
              تحديد الفرع والتاريخ
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>الفرع</Label>
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger disabled={!canSelectBranch}>
                  <SelectValue placeholder="اختر الفرع" />
                </SelectTrigger>
                <SelectContent>
                  {branches?.map(branch => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
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
                className="w-full"
              />
            </div>
          </CardContent>
        </Card>

        {journalPreview?.existingClosure && (
          <Card className="border-amber-300 bg-amber-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
                يوجد إغلاق سابق لهذا التاريخ
              </CardTitle>
              <CardDescription className="text-amber-600">
                تم إنشاء إغلاق يومي لهذا الفرع في هذا التاريخ بالفعل. يمكنك مراجعته من صفحة الإغلاقات اليومية.
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Link href={`/branch-daily-closures`}>
                <Button variant="outline" className="gap-2">
                  <Eye className="h-4 w-4" />
                  عرض الإغلاق الموجود
                </Button>
              </Link>
            </CardFooter>
          </Card>
        )}

        {isLoadingPreview && selectedBranch && selectedDate && (
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            </CardContent>
          </Card>
        )}

        {!isLoadingPreview && journalPreview?.journals && journalPreview.journals.length > 0 && !journalPreview.existingClosure && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Receipt className="h-5 w-5 text-amber-600" />
                    يوميات الكاشير المتاحة ({journalPreview.journals.length})
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={selectAllJournals}>
                      تحديد الكل
                    </Button>
                    <Button variant="outline" size="sm" onClick={deselectAllJournals}>
                      إلغاء التحديد
                    </Button>
                  </div>
                </CardTitle>
                <CardDescription>
                  حدد اليوميات التي تريد تضمينها في الإغلاق اليومي
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {journalPreview.journals.map((journal: any) => (
                    <Collapsible key={journal.id} open={expandedJournals.includes(journal.id)}>
                      <div className={`border rounded-lg p-4 transition-colors ${selectedJournals.includes(journal.id) ? 'border-amber-400 bg-amber-50/50' : 'border-gray-200'}`}>
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <Checkbox 
                              checked={selectedJournals.includes(journal.id)}
                              onCheckedChange={() => toggleJournal(journal.id)}
                              data-testid={`checkbox-journal-${journal.id}`}
                            />
                            <div>
                              <p className="font-medium">{journal.cashierName}</p>
                              <p className="text-sm text-gray-500">
                                {journal.shiftType === 'morning' ? 'صباحي' : journal.shiftType === 'evening' ? 'مسائي' : 'كامل'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-left">
                              <p className="font-semibold">{formatCurrency(journal.totalSales)} ريال</p>
                              <p className="text-sm text-gray-500">{formatNumber(journal.customerCount)} عميل</p>
                            </div>
                            <Badge 
                              variant={journal.status === 'approved' ? 'default' : journal.status === 'draft' ? 'secondary' : 'outline'}
                            >
                              {journal.status === 'approved' ? 'معتمد' : journal.status === 'draft' ? 'مسودة' : 'مُقدم'}
                            </Badge>
                            <CollapsibleTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => toggleExpandJournal(journal.id)}
                              >
                                {expandedJournals.includes(journal.id) ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                            </CollapsibleTrigger>
                          </div>
                        </div>
                        <CollapsibleContent>
                          <div className="mt-4 pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">النقدي:</span>
                              <span className="font-medium mr-2">{formatCurrency(journal.cashTotal)} ريال</span>
                            </div>
                            <div>
                              <span className="text-gray-500">الشبكة:</span>
                              <span className="font-medium mr-2">{formatCurrency(journal.networkTotal)} ريال</span>
                            </div>
                            <div>
                              <span className="text-gray-500">التوصيل:</span>
                              <span className="font-medium mr-2">{formatCurrency(journal.deliveryTotal)} ريال</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-gray-500">فرق النقدي:</span>
                              <span className={`font-medium ${
                                (journal.discrepancyAmount || 0) > 0.5 ? 'text-amber-600' : 
                                (journal.discrepancyAmount || 0) < -0.5 ? 'text-red-600' : 'text-green-600'
                              }`}>
                                {formatCurrency(journal.discrepancyAmount)} ريال
                              </span>
                            </div>
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  ))}
                </div>
              </CardContent>
            </Card>

            {selectedJournals.length > 0 && (
              <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-amber-600" />
                    ملخص الإغلاق اليومي
                  </CardTitle>
                  <CardDescription>
                    مجموع {selectedTotals.journalsCount} يومية محددة
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-lg p-4 border shadow-sm">
                      <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                        <DollarSign className="h-4 w-4" />
                        إجمالي المبيعات
                      </div>
                      <p className="text-xl font-bold text-amber-700">{formatCurrency(selectedTotals.totalSales)} ريال</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 border shadow-sm">
                      <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                        <Wallet className="h-4 w-4" />
                        النقدي
                      </div>
                      <p className="text-xl font-bold text-green-700">{formatCurrency(selectedTotals.cashTotal)} ريال</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 border shadow-sm">
                      <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                        <CreditCard className="h-4 w-4" />
                        الشبكة
                      </div>
                      <p className="text-xl font-bold text-blue-700">{formatCurrency(selectedTotals.networkTotal)} ريال</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 border shadow-sm">
                      <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                        <Users className="h-4 w-4" />
                        العملاء
                      </div>
                      <p className="text-xl font-bold text-purple-700">{formatNumber(selectedTotals.totalCustomerCount)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div className={`rounded-lg p-4 border ${
                      getDiscrepancyStatus(selectedTotals.totalCashDiscrepancy) === 'shortage' ? 'bg-red-50 border-red-200' :
                      getDiscrepancyStatus(selectedTotals.totalCashDiscrepancy) === 'surplus' ? 'bg-amber-50 border-amber-200' :
                      'bg-green-50 border-green-200'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">فرق النقدي الكلي</span>
                        <span className={`font-bold text-lg ${
                          getDiscrepancyStatus(selectedTotals.totalCashDiscrepancy) === 'shortage' ? 'text-red-700' :
                          getDiscrepancyStatus(selectedTotals.totalCashDiscrepancy) === 'surplus' ? 'text-amber-700' :
                          'text-green-700'
                        }`}>
                          {formatCurrency(selectedTotals.totalCashDiscrepancy)} ريال
                        </span>
                      </div>
                      <Badge className="mt-2" variant={
                        getDiscrepancyStatus(selectedTotals.totalCashDiscrepancy) === 'shortage' ? 'destructive' :
                        getDiscrepancyStatus(selectedTotals.totalCashDiscrepancy) === 'surplus' ? 'default' :
                        'outline'
                      }>
                        {DISCREPANCY_LABELS[getDiscrepancyStatus(selectedTotals.totalCashDiscrepancy)]?.label}
                      </Badge>
                    </div>
                    <div className={`rounded-lg p-4 border ${
                      getDiscrepancyStatus(selectedTotals.totalBankDiscrepancy) === 'shortage' ? 'bg-red-50 border-red-200' :
                      getDiscrepancyStatus(selectedTotals.totalBankDiscrepancy) === 'surplus' ? 'bg-amber-50 border-amber-200' :
                      'bg-green-50 border-green-200'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">فرق مطابقة البنوك</span>
                        <span className={`font-bold text-lg ${
                          getDiscrepancyStatus(selectedTotals.totalBankDiscrepancy) === 'shortage' ? 'text-red-700' :
                          getDiscrepancyStatus(selectedTotals.totalBankDiscrepancy) === 'surplus' ? 'text-amber-700' :
                          'text-green-700'
                        }`}>
                          {formatCurrency(selectedTotals.totalBankDiscrepancy)} ريال
                        </span>
                      </div>
                      <Badge className="mt-2" variant={
                        getDiscrepancyStatus(selectedTotals.totalBankDiscrepancy) === 'shortage' ? 'destructive' :
                        getDiscrepancyStatus(selectedTotals.totalBankDiscrepancy) === 'surplus' ? 'default' :
                        'outline'
                      }>
                        {DISCREPANCY_LABELS[getDiscrepancyStatus(selectedTotals.totalBankDiscrepancy)]?.label}
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <Label>ملاحظات (اختياري)</Label>
                    <Textarea 
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="أي ملاحظات على الإغلاق اليومي..."
                      className="min-h-[80px]"
                    />
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => navigate("/branch-daily-closures")}>
                    إلغاء
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        className="gap-2 bg-amber-600 hover:bg-amber-700"
                        disabled={createClosureMutation.isPending}
                      >
                        <Save className="h-4 w-4" />
                        إنشاء الإغلاق اليومي
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent dir="rtl">
                      <AlertDialogHeader>
                        <AlertDialogTitle>تأكيد الإغلاق اليومي</AlertDialogTitle>
                        <AlertDialogDescription>
                          سيتم إنشاء إغلاق يومي لفرع {branchName} بتاريخ {format(new Date(selectedDate), "d MMMM yyyy", { locale: ar })} يتضمن {selectedTotals.journalsCount} يومية بإجمالي {formatCurrency(selectedTotals.totalSales)} ريال.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="flex-row-reverse gap-2">
                        <AlertDialogAction 
                          onClick={handleCreateClosure}
                          className="bg-amber-600 hover:bg-amber-700"
                        >
                          تأكيد الإنشاء
                        </AlertDialogAction>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardFooter>
              </Card>
            )}
          </>
        )}

        {!isLoadingPreview && journalPreview?.journals && journalPreview.journals.length === 0 && !journalPreview.existingClosure && (
          <Card className="border-gray-200">
            <CardContent className="p-12 text-center">
              <Receipt className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">لا توجد يوميات</h3>
              <p className="text-gray-500">لا توجد يوميات كاشير لهذا الفرع في التاريخ المحدد</p>
              <Link href="/cashier-journal-form">
                <Button className="mt-4 gap-2">
                  إنشاء يومية جديدة
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
