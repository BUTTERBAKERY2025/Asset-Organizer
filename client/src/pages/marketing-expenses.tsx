import { useState } from "react";
import { Layout } from "@/components/layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
  DollarSign,
  ArrowRight,
  TrendingUp,
  PieChart,
  Calendar,
  FileSpreadsheet,
  Download,
} from "lucide-react";
import { Link } from "wouter";
import type { CampaignExpense, MarketingCampaign, MarketingInfluencer } from "@shared/schema";
import {
  CAMPAIGN_EXPENSE_CATEGORIES,
  CAMPAIGN_EXPENSE_CATEGORY_LABELS,
  CAMPAIGN_EXPENSE_STATUS_LABELS,
  CAMPAIGN_PAYMENT_METHOD_LABELS,
} from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface ExpenseFormData {
  campaignId: number;
  influencerId?: number | null;
  category: string;
  description: string;
  amount: number;
  expenseDate: string;
  paymentMethod?: string;
  referenceNumber?: string;
  invoiceNumber?: string;
  vendor?: string;
  status: string;
  notes?: string;
}

const defaultFormData: ExpenseFormData = {
  campaignId: 0,
  influencerId: null,
  category: "",
  description: "",
  amount: 0,
  expenseDate: new Date().toISOString().split("T")[0],
  paymentMethod: "",
  referenceNumber: "",
  invoiceNumber: "",
  vendor: "",
  status: "pending",
  notes: "",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500",
  approved: "bg-blue-500",
  paid: "bg-green-500",
  rejected: "bg-red-500",
};

const CHART_COLORS = ["#f59e0b", "#3b82f6", "#22c55e", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16", "#06b6d4"];

export default function MarketingExpensesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<CampaignExpense | null>(null);
  const [formData, setFormData] = useState<ExpenseFormData>(defaultFormData);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin, isEmployee } = useAuth();
  const canEdit = isAdmin || isEmployee;

  const buildQueryString = () => {
    const params = new URLSearchParams();
    if (campaignFilter && campaignFilter !== "all") params.append("campaignId", campaignFilter);
    if (categoryFilter && categoryFilter !== "all") params.append("category", categoryFilter);
    if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
    if (startDateFilter) params.append("startDate", startDateFilter);
    if (endDateFilter) params.append("endDate", endDateFilter);
    return params.toString();
  };

  const { data: expenses = [], isLoading } = useQuery<CampaignExpense[]>({
    queryKey: ["/api/marketing/expenses", campaignFilter, categoryFilter, statusFilter, startDateFilter, endDateFilter],
    queryFn: async () => {
      const queryString = buildQueryString();
      const url = `/api/marketing/expenses${queryString ? `?${queryString}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch expenses");
      return res.json();
    },
  });

  const { data: campaigns = [] } = useQuery<MarketingCampaign[]>({
    queryKey: ["/api/marketing/campaigns"],
    queryFn: async () => {
      const res = await fetch("/api/marketing/campaigns");
      if (!res.ok) throw new Error("Failed to fetch campaigns");
      return res.json();
    },
  });

  const { data: influencers = [] } = useQuery<MarketingInfluencer[]>({
    queryKey: ["/api/marketing/influencers"],
    queryFn: async () => {
      const res = await fetch("/api/marketing/influencers");
      if (!res.ok) throw new Error("Failed to fetch influencers");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ExpenseFormData) => {
      const res = await fetch(`/api/marketing/campaigns/${data.campaignId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create expense");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/campaigns"] });
      setIsAddDialogOpen(false);
      setFormData(defaultFormData);
      toast({ title: "تم إضافة المصروف بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ", description: "فشل في إضافة المصروف", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: ExpenseFormData & { id: number }) => {
      const res = await fetch(`/api/marketing/expenses/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update expense");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/campaigns"] });
      setIsEditDialogOpen(false);
      setSelectedExpense(null);
      setFormData(defaultFormData);
      toast({ title: "تم تحديث المصروف بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ", description: "فشل في تحديث المصروف", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/marketing/expenses/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete expense");
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/campaigns"] });
      setIsDeleteDialogOpen(false);
      setSelectedExpense(null);
      toast({ title: "تم حذف المصروف بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ", description: "فشل في حذف المصروف", variant: "destructive" });
    },
  });

  const filteredExpenses = expenses.filter((expense) =>
    expense.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    expense.vendor?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getCampaignName = (id: number) => {
    const campaign = campaigns.find((c) => c.id === id);
    return campaign?.nameAr || campaign?.name || "-";
  };

  const getInfluencerName = (id: number | null) => {
    if (!id) return "-";
    const influencer = influencers.find((i) => i.id === id);
    return influencer?.nameAr || influencer?.name || "-";
  };

  const openEditDialog = (expense: CampaignExpense) => {
    setSelectedExpense(expense);
    setFormData({
      campaignId: expense.campaignId,
      influencerId: expense.influencerId,
      category: expense.category,
      description: expense.description,
      amount: expense.amount,
      expenseDate: expense.expenseDate,
      paymentMethod: expense.paymentMethod || "",
      referenceNumber: expense.referenceNumber || "",
      invoiceNumber: expense.invoiceNumber || "",
      vendor: expense.vendor || "",
      status: expense.status,
      notes: expense.notes || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.campaignId || !formData.category || !formData.description || !formData.amount) {
      toast({ title: "يرجى ملء الحقول المطلوبة", variant: "destructive" });
      return;
    }
    if (selectedExpense && isEditDialogOpen) {
      updateMutation.mutate({ ...formData, id: selectedExpense.id });
    } else {
      createMutation.mutate(formData);
    }
  };

  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const paidExpenses = filteredExpenses.filter((e) => e.status === "paid").reduce((sum, e) => sum + e.amount, 0);
  const pendingExpenses = filteredExpenses.filter((e) => e.status === "pending").reduce((sum, e) => sum + e.amount, 0);

  const expensesByCategory = CAMPAIGN_EXPENSE_CATEGORIES.map((cat) => ({
    name: CAMPAIGN_EXPENSE_CATEGORY_LABELS[cat],
    value: filteredExpenses.filter((e) => e.category === cat).reduce((sum, e) => sum + e.amount, 0),
  })).filter((item) => item.value > 0);

  const expensesByCampaign = campaigns.map((campaign) => {
    const campaignExpenses = filteredExpenses.filter((e) => e.campaignId === campaign.id);
    return {
      name: campaign.nameAr || campaign.name,
      expenses: campaignExpenses.reduce((sum, e) => sum + e.amount, 0),
      budget: campaign.totalBudget,
    };
  }).filter((item) => item.expenses > 0 || item.budget > 0);

  const handleExportExcel = async () => {
    try {
      const xlsx = await import("xlsx");
      const data = filteredExpenses.map((expense) => ({
        "الحملة": getCampaignName(expense.campaignId),
        "الفئة": CAMPAIGN_EXPENSE_CATEGORY_LABELS[expense.category] || expense.category,
        "الوصف": expense.description,
        "المبلغ": expense.amount,
        "التاريخ": expense.expenseDate,
        "الحالة": CAMPAIGN_EXPENSE_STATUS_LABELS[expense.status] || expense.status,
        "طريقة الدفع": expense.paymentMethod ? CAMPAIGN_PAYMENT_METHOD_LABELS[expense.paymentMethod] : "-",
        "المورد": expense.vendor || "-",
        "رقم المرجع": expense.referenceNumber || "-",
      }));
      
      const ws = xlsx.utils.json_to_sheet(data);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, "المصروفات");
      xlsx.writeFile(wb, `مصروفات_الحملات_${new Date().toISOString().split("T")[0]}.xlsx`);
      toast({ title: "تم تصدير التقرير بنجاح" });
    } catch (error) {
      toast({ title: "حدث خطأ في التصدير", variant: "destructive" });
    }
  };

  const expenseFormContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>الحملة *</Label>
          <Select
            value={formData.campaignId.toString()}
            onValueChange={(value) => setFormData({ ...formData, campaignId: parseInt(value) })}
          >
            <SelectTrigger data-testid="select-expense-campaign">
              <SelectValue placeholder="اختر الحملة" />
            </SelectTrigger>
            <SelectContent>
              {campaigns.map((campaign) => (
                <SelectItem key={campaign.id} value={campaign.id.toString()}>
                  {campaign.nameAr || campaign.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>الفئة *</Label>
          <Select
            value={formData.category}
            onValueChange={(value) => setFormData({ ...formData, category: value })}
          >
            <SelectTrigger data-testid="select-expense-category">
              <SelectValue placeholder="اختر الفئة" />
            </SelectTrigger>
            <SelectContent>
              {CAMPAIGN_EXPENSE_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {CAMPAIGN_EXPENSE_CATEGORY_LABELS[cat]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>الوصف *</Label>
        <Input
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="وصف المصروف"
          data-testid="input-expense-description"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>المبلغ (ر.س) *</Label>
          <Input
            type="number"
            step="0.01"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
            placeholder="0"
            dir="ltr"
            data-testid="input-expense-amount"
          />
        </div>
        <div className="space-y-2">
          <Label>التاريخ *</Label>
          <Input
            type="date"
            value={formData.expenseDate}
            onChange={(e) => setFormData({ ...formData, expenseDate: e.target.value })}
            dir="ltr"
            data-testid="input-expense-date"
          />
        </div>
        <div className="space-y-2">
          <Label>الحالة</Label>
          <Select
            value={formData.status}
            onValueChange={(value) => setFormData({ ...formData, status: value })}
          >
            <SelectTrigger data-testid="select-expense-status">
              <SelectValue placeholder="اختر الحالة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">قيد الانتظار</SelectItem>
              <SelectItem value="approved">معتمد</SelectItem>
              <SelectItem value="paid">مدفوع</SelectItem>
              <SelectItem value="rejected">مرفوض</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>المؤثر (اختياري)</Label>
          <Select
            value={formData.influencerId?.toString() || ""}
            onValueChange={(value) => setFormData({ ...formData, influencerId: value ? parseInt(value) : null })}
          >
            <SelectTrigger data-testid="select-expense-influencer">
              <SelectValue placeholder="اختر المؤثر" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">بدون مؤثر</SelectItem>
              {influencers.map((influencer) => (
                <SelectItem key={influencer.id} value={influencer.id.toString()}>
                  {influencer.nameAr || influencer.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>طريقة الدفع</Label>
          <Select
            value={formData.paymentMethod || ""}
            onValueChange={(value) => setFormData({ ...formData, paymentMethod: value })}
          >
            <SelectTrigger data-testid="select-expense-payment-method">
              <SelectValue placeholder="اختر طريقة الدفع" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bank_transfer">تحويل بنكي</SelectItem>
              <SelectItem value="cash">نقدي</SelectItem>
              <SelectItem value="check">شيك</SelectItem>
              <SelectItem value="credit_card">بطاقة ائتمان</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>المورد / الجهة المستفيدة</Label>
          <Input
            value={formData.vendor || ""}
            onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
            placeholder="اسم المورد"
            data-testid="input-expense-vendor"
          />
        </div>
        <div className="space-y-2">
          <Label>رقم المرجع</Label>
          <Input
            value={formData.referenceNumber || ""}
            onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
            placeholder="رقم الحوالة أو الشيك"
            dir="ltr"
            data-testid="input-expense-reference"
          />
        </div>
        <div className="space-y-2">
          <Label>رقم الفاتورة</Label>
          <Input
            value={formData.invoiceNumber || ""}
            onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
            placeholder="رقم الفاتورة"
            dir="ltr"
            data-testid="input-expense-invoice"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>ملاحظات</Label>
        <Textarea
          value={formData.notes || ""}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="ملاحظات إضافية..."
          data-testid="input-expense-notes"
        />
      </div>

      <DialogFooter>
        <Button
          type="submit"
          disabled={createMutation.isPending || updateMutation.isPending}
          data-testid="button-submit-expense"
        >
          {(createMutation.isPending || updateMutation.isPending) && (
            <Loader2 className="w-4 h-4 ml-2 animate-spin" />
          )}
          {selectedExpense && isEditDialogOpen ? "تحديث" : "إضافة"}
        </Button>
      </DialogFooter>
    </form>
  );

  return (
    <Layout>
      <div className="space-y-6" dir="rtl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/marketing">
              <Button variant="outline" size="icon" data-testid="button-back">
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">
                مصروفات الحملات
              </h1>
              <p className="text-muted-foreground">تتبع وإدارة مصروفات الحملات التسويقية</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportExcel} data-testid="button-export">
              <Download className="w-4 h-4 ml-2" />
              تصدير Excel
            </Button>
            {canEdit && (
              <Button
                onClick={() => {
                  setFormData(defaultFormData);
                  setSelectedExpense(null);
                  setIsAddDialogOpen(true);
                }}
                className="bg-pink-500 hover:bg-pink-600"
                data-testid="button-add-expense"
              >
                <Plus className="w-4 h-4 ml-2" />
                إضافة مصروف
              </Button>
            )}
          </div>
        </div>

        <Tabs defaultValue="list" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="list" data-testid="tab-list">قائمة المصروفات</TabsTrigger>
            <TabsTrigger value="reports" data-testid="tab-reports">التقارير والمقارنات</TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">إجمالي المصروفات</p>
                      <p className="text-2xl font-bold text-amber-700">
                        {new Intl.NumberFormat("en-US").format(totalExpenses)} ر.س
                      </p>
                    </div>
                    <DollarSign className="w-8 h-8 text-amber-600" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">مدفوع</p>
                      <p className="text-2xl font-bold text-green-700">
                        {new Intl.NumberFormat("en-US").format(paidExpenses)} ر.س
                      </p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">قيد الانتظار</p>
                      <p className="text-2xl font-bold text-yellow-700">
                        {new Intl.NumberFormat("en-US").format(pendingExpenses)} ر.س
                      </p>
                    </div>
                    <Calendar className="w-8 h-8 text-yellow-600" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">عدد المصروفات</p>
                      <p className="text-2xl font-bold text-blue-700">
                        {new Intl.NumberFormat("en-US").format(filteredExpenses.length)}
                      </p>
                    </div>
                    <FileSpreadsheet className="w-8 h-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>تصفية المصروفات</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="بحث..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pr-10"
                      data-testid="input-search-expenses"
                    />
                  </div>
                  <Select value={campaignFilter} onValueChange={setCampaignFilter}>
                    <SelectTrigger data-testid="filter-campaign">
                      <SelectValue placeholder="الحملة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل الحملات</SelectItem>
                      {campaigns.map((campaign) => (
                        <SelectItem key={campaign.id} value={campaign.id.toString()}>
                          {campaign.nameAr || campaign.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger data-testid="filter-category">
                      <SelectValue placeholder="الفئة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل الفئات</SelectItem>
                      {CAMPAIGN_EXPENSE_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {CAMPAIGN_EXPENSE_CATEGORY_LABELS[cat]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger data-testid="filter-status">
                      <SelectValue placeholder="الحالة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل الحالات</SelectItem>
                      <SelectItem value="pending">قيد الانتظار</SelectItem>
                      <SelectItem value="approved">معتمد</SelectItem>
                      <SelectItem value="paid">مدفوع</SelectItem>
                      <SelectItem value="rejected">مرفوض</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="date"
                    value={startDateFilter}
                    onChange={(e) => setStartDateFilter(e.target.value)}
                    placeholder="من تاريخ"
                    dir="ltr"
                    data-testid="filter-start-date"
                  />
                  <Input
                    type="date"
                    value={endDateFilter}
                    onChange={(e) => setEndDateFilter(e.target.value)}
                    placeholder="إلى تاريخ"
                    dir="ltr"
                    data-testid="filter-end-date"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الحملة</TableHead>
                        <TableHead>الفئة</TableHead>
                        <TableHead>الوصف</TableHead>
                        <TableHead>المبلغ</TableHead>
                        <TableHead>التاريخ</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead>المورد</TableHead>
                        {canEdit && <TableHead>إجراءات</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                          </TableCell>
                        </TableRow>
                      ) : filteredExpenses.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                            لا توجد مصروفات
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredExpenses.map((expense) => (
                          <TableRow key={expense.id} data-testid={`row-expense-${expense.id}`}>
                            <TableCell className="font-medium">{getCampaignName(expense.campaignId)}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {CAMPAIGN_EXPENSE_CATEGORY_LABELS[expense.category] || expense.category}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate">{expense.description}</TableCell>
                            <TableCell className="font-bold">
                              {new Intl.NumberFormat("en-US").format(expense.amount)} ر.س
                            </TableCell>
                            <TableCell>{expense.expenseDate}</TableCell>
                            <TableCell>
                              <Badge className={STATUS_COLORS[expense.status] || "bg-gray-500"}>
                                {CAMPAIGN_EXPENSE_STATUS_LABELS[expense.status] || expense.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{expense.vendor || "-"}</TableCell>
                            {canEdit && (
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openEditDialog(expense)}
                                    data-testid={`button-edit-${expense.id}`}
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedExpense(expense);
                                      setIsDeleteDialogOpen(true);
                                    }}
                                    data-testid={`button-delete-${expense.id}`}
                                  >
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports" className="space-y-6 mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="w-5 h-5" />
                    المصروفات حسب الفئة
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {expensesByCategory.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <RechartsPieChart>
                        <Pie
                          data={expensesByCategory}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {expensesByCategory.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => `${new Intl.NumberFormat("en-US").format(value)} ر.س`} />
                        <Legend />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                      لا توجد بيانات
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    الميزانية مقابل المصروف (حسب الحملة)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {expensesByCampaign.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={expensesByCampaign}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(value: number) => `${new Intl.NumberFormat("en-US").format(value)} ر.س`} />
                        <Legend />
                        <Bar dataKey="budget" name="الميزانية" fill="#3b82f6" />
                        <Bar dataKey="expenses" name="المصروف" fill="#f59e0b" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                      لا توجد بيانات
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>مقارنة الميزانية والمصروفات حسب الحملة</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {campaigns.map((campaign) => {
                    const campaignExpenseTotal = expenses
                      .filter((e) => e.campaignId === campaign.id)
                      .reduce((sum, e) => sum + e.amount, 0);
                    const percentage = campaign.totalBudget > 0 
                      ? Math.min((campaignExpenseTotal / campaign.totalBudget) * 100, 100) 
                      : 0;
                    const isOverBudget = campaignExpenseTotal > campaign.totalBudget;

                    return (
                      <div key={campaign.id} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{campaign.nameAr || campaign.name}</span>
                          <span className={isOverBudget ? "text-red-600 font-bold" : ""}>
                            {new Intl.NumberFormat("en-US").format(campaignExpenseTotal)} / {new Intl.NumberFormat("en-US").format(campaign.totalBudget)} ر.س
                            {isOverBudget && " (تجاوز الميزانية!)"}
                          </span>
                        </div>
                        <Progress 
                          value={percentage} 
                          className={`h-2 ${isOverBudget ? "[&>div]:bg-red-500" : ""}`}
                        />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog 
          open={isAddDialogOpen || isEditDialogOpen} 
          onOpenChange={(open) => {
            if (!open) {
              setIsAddDialogOpen(false);
              setIsEditDialogOpen(false);
              setSelectedExpense(null);
              setFormData(defaultFormData);
            }
          }}
        >
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle>
                {selectedExpense && isEditDialogOpen ? "تعديل المصروف" : "إضافة مصروف جديد"}
              </DialogTitle>
              <DialogDescription>
                {selectedExpense && isEditDialogOpen
                  ? "قم بتعديل بيانات المصروف"
                  : "أدخل بيانات المصروف الجديد"}
              </DialogDescription>
            </DialogHeader>
            {expenseFormContent}
          </DialogContent>
        </Dialog>

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
              <AlertDialogDescription>
                سيتم حذف هذا المصروف نهائياً. لا يمكن التراجع عن هذا الإجراء.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => selectedExpense && deleteMutation.mutate(selectedExpense.id)}
                className="bg-red-500 hover:bg-red-600"
              >
                {deleteMutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                حذف
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
