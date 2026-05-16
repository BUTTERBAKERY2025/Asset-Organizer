import { useState, useMemo, useRef } from "react";
import { Layout } from "@/components/layout";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  TrendingUp, TrendingDown, BarChart3, PieChart, 
  Users, Megaphone, DollarSign, Target, Eye, 
  Heart, MessageCircle, Share2, Download, ArrowRight,
  Filter, ChevronDown, Calendar, User,
  Receipt, Activity, RefreshCw, FileText, Printer
} from "lucide-react";
import { Link } from "wouter";
import { useReactToPrint } from "react-to-print";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from "recharts";
import type { MarketingCampaign, CampaignExpense, MarketingInfluencer, InfluencerPayment } from "@shared/schema";
import {
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_EXPENSE_CATEGORY_LABELS,
  CAMPAIGN_EXPENSE_STATUS_LABELS,
  INFLUENCER_SPECIALTY_LABELS,
} from "@shared/schema";

interface ReportFilters {
  dateFrom: string;
  dateTo: string;
  campaignId: string;
  influencerId: string;
  status: string;
  expenseCategory: string;
  minAmount: string;
  maxAmount: string;
  minBudget: string;
  maxBudget: string;
}

const COLORS = ['#f472b6', '#a78bfa', '#60a5fa', '#34d399', '#fbbf24', '#fb923c', '#f87171'];

export default function MarketingReportsPage() {
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const [filters, setFilters] = useState<ReportFilters>({
    dateFrom: "",
    dateTo: "",
    campaignId: "all",
    influencerId: "all",
    status: "all",
    expenseCategory: "all",
    minAmount: "",
    maxAmount: "",
    minBudget: "",
    maxBudget: "",
  });

  const { data: campaigns = [], isLoading: campaignsLoading } = useQuery<MarketingCampaign[]>({
    queryKey: ["/api/marketing/campaigns"],
    queryFn: async () => {
      const res = await fetch("/api/marketing/campaigns");
      if (!res.ok) throw new Error(`${res.status}: request failed`);
      return res.json();
    },
  });

  const { data: expenses = [], isLoading: expensesLoading } = useQuery<CampaignExpense[]>({
    queryKey: ["/api/marketing/expenses"],
    queryFn: async () => {
      const res = await fetch("/api/marketing/expenses");
      if (!res.ok) throw new Error(`${res.status}: request failed`);
      return res.json();
    },
  });

  const { data: influencers = [], isLoading: influencersLoading } = useQuery<MarketingInfluencer[]>({
    queryKey: ["/api/marketing/influencers"],
    queryFn: async () => {
      const res = await fetch("/api/marketing/influencers");
      if (!res.ok) throw new Error(`${res.status}: request failed`);
      return res.json();
    },
  });

  const { data: influencerPayments = [] } = useQuery<InfluencerPayment[]>({
    queryKey: ["/api/marketing/influencer-payments"],
    queryFn: async () => {
      const res = await fetch("/api/marketing/influencer-payments");
      if (!res.ok) throw new Error(`${res.status}: request failed`);
      return res.json();
    },
  });

  const isLoading = campaignsLoading || expensesLoading || influencersLoading;

  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      if (filters.campaignId !== "all" && c.id !== parseInt(filters.campaignId)) return false;
      if (filters.status !== "all" && c.status !== filters.status) return false;
      if (filters.dateFrom && c.startDate && c.startDate < filters.dateFrom) return false;
      if (filters.dateTo && c.endDate && c.endDate > filters.dateTo) return false;
      if (filters.minBudget && (c.totalBudget || 0) < parseFloat(filters.minBudget)) return false;
      if (filters.maxBudget && (c.totalBudget || 0) > parseFloat(filters.maxBudget)) return false;
      return true;
    });
  }, [campaigns, filters]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (filters.campaignId !== "all" && e.campaignId !== parseInt(filters.campaignId)) return false;
      if (filters.influencerId !== "all" && e.influencerId !== parseInt(filters.influencerId)) return false;
      if (filters.expenseCategory !== "all" && e.category !== filters.expenseCategory) return false;
      if (filters.dateFrom && e.expenseDate < filters.dateFrom) return false;
      if (filters.dateTo && e.expenseDate > filters.dateTo) return false;
      if (filters.minAmount && e.amount < parseFloat(filters.minAmount)) return false;
      if (filters.maxAmount && e.amount > parseFloat(filters.maxAmount)) return false;
      return true;
    });
  }, [expenses, filters]);

  const filteredInfluencers = useMemo(() => {
    return influencers.filter((i) => {
      if (filters.influencerId !== "all" && i.id !== parseInt(filters.influencerId)) return false;
      return true;
    });
  }, [influencers, filters]);

  const filteredInfluencerPayments = useMemo(() => {
    return influencerPayments.filter((p) => {
      if (filters.influencerId !== "all" && p.influencerId !== parseInt(filters.influencerId)) return false;
      if (filters.campaignId !== "all" && p.campaignId !== parseInt(filters.campaignId)) return false;
      if (filters.dateFrom && p.paymentDate < filters.dateFrom) return false;
      if (filters.dateTo && p.paymentDate > filters.dateTo) return false;
      return true;
    });
  }, [influencerPayments, filters]);

  const stats = useMemo(() => {
    const totalBudget = filteredCampaigns.reduce((sum, c) => sum + (c.totalBudget || 0), 0);
    const spentBudget = filteredCampaigns.reduce((sum, c) => sum + (c.spentBudget || 0), 0);
    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    const paidExpenses = filteredExpenses.filter(e => e.status === 'paid').reduce((sum, e) => sum + e.amount, 0);
    const pendingExpenses = filteredExpenses.filter(e => e.status === 'pending').reduce((sum, e) => sum + e.amount, 0);
    const approvedExpenses = filteredExpenses.filter(e => e.status === 'approved').reduce((sum, e) => sum + e.amount, 0);
    const totalInfluencerPayments = filteredInfluencerPayments.reduce((sum, p) => sum + p.amount, 0);
    
    return {
      totalCampaigns: filteredCampaigns.length,
      activeCampaigns: filteredCampaigns.filter(c => c.status === 'active').length,
      completedCampaigns: filteredCampaigns.filter(c => c.status === 'completed').length,
      totalBudget,
      spentBudget,
      remainingBudget: totalBudget - spentBudget,
      budgetUtilization: totalBudget > 0 ? Math.round((spentBudget / totalBudget) * 100) : 0,
      totalExpenses,
      paidExpenses,
      pendingExpenses,
      approvedExpenses,
      expenseCount: filteredExpenses.length,
      totalInfluencers: filteredInfluencers.length,
      activeInfluencers: filteredInfluencers.filter(i => i.isActive).length,
      totalReach: filteredInfluencers.reduce((sum, i) => sum + (i.followerCount || 0), 0),
      avgEngagement: filteredInfluencers.length > 0 
        ? filteredInfluencers.reduce((sum, i) => sum + (i.engagementRate || 0), 0) / filteredInfluencers.length 
        : 0,
      totalInfluencerPayments,
    };
  }, [filteredCampaigns, filteredExpenses, filteredInfluencers, filteredInfluencerPayments]);

  const expensesByCategory = useMemo(() => {
    const categoryTotals: Record<string, number> = {};
    filteredExpenses.forEach(e => {
      categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
    });
    return Object.entries(categoryTotals).map(([category, total]) => ({
      name: CAMPAIGN_EXPENSE_CATEGORY_LABELS[category] || category,
      value: total,
      category,
    }));
  }, [filteredExpenses]);

  const expensesByStatus = useMemo(() => {
    const statusTotals: Record<string, number> = {};
    filteredExpenses.forEach(e => {
      statusTotals[e.status] = (statusTotals[e.status] || 0) + e.amount;
    });
    return Object.entries(statusTotals).map(([status, total]) => ({
      name: CAMPAIGN_EXPENSE_STATUS_LABELS[status] || status,
      value: total,
      status,
    }));
  }, [filteredExpenses]);

  const campaignPerformance = useMemo(() => {
    return filteredCampaigns.slice(0, 10).map(c => ({
      name: c.nameAr || c.name,
      budget: c.totalBudget || 0,
      spent: c.spentBudget || 0,
      remaining: (c.totalBudget || 0) - (c.spentBudget || 0),
    }));
  }, [filteredCampaigns]);

  const influencerPerformance = useMemo(() => {
    return filteredInfluencers.slice(0, 10).map(i => {
      const payments = filteredInfluencerPayments.filter(p => p.influencerId === i.id);
      const expensesForInfluencer = filteredExpenses.filter(e => e.influencerId === i.id);
      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0) + 
                        expensesForInfluencer.reduce((sum, e) => sum + e.amount, 0);
      return {
        name: i.nameAr || i.name,
        followers: i.followerCount || 0,
        engagement: i.engagementRate || 0,
        totalPaid,
      };
    });
  }, [filteredInfluencers, filteredInfluencerPayments, filteredExpenses]);

  const monthlyExpenses = useMemo(() => {
    const monthlyTotals: Record<string, number> = {};
    filteredExpenses.forEach(e => {
      const month = e.expenseDate.substring(0, 7);
      monthlyTotals[month] = (monthlyTotals[month] || 0) + e.amount;
    });
    return Object.entries(monthlyTotals)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, total]) => ({
        month,
        total,
      }));
  }, [filteredExpenses]);

  const resetFilters = () => {
    setFilters({
      dateFrom: "",
      dateTo: "",
      campaignId: "all",
      influencerId: "all",
      status: "all",
      expenseCategory: "all",
      minAmount: "",
      maxAmount: "",
      minBudget: "",
      maxBudget: "",
    });
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount) + " ر.س";

  const formatNumber = (num: number) =>
    new Intl.NumberFormat("en-US").format(num);

  const getCampaignName = (campaignId: number) => {
    const campaign = campaigns.find(c => c.id === campaignId);
    return campaign ? (campaign.nameAr || campaign.name) : "-";
  };

  const getInfluencerName = (influencerId: number | null) => {
    if (!influencerId) return "-";
    const influencer = influencers.find(i => i.id === influencerId);
    return influencer ? (influencer.nameAr || influencer.name) : "-";
  };

  const exportToExcel = () => {
    import('xlsx').then(XLSX => {
      const campaignData = filteredCampaigns.map((c) => ({
        'اسم الحملة': c.nameAr || c.name,
        'الحالة': CAMPAIGN_STATUS_LABELS[c.status as keyof typeof CAMPAIGN_STATUS_LABELS] || c.status,
        'الميزانية الإجمالية': c.totalBudget || 0,
        'المصروف': c.spentBudget || 0,
        'المتبقي': (c.totalBudget || 0) - (c.spentBudget || 0),
        'نسبة الاستخدام': c.totalBudget ? Math.round(((c.spentBudget || 0) / c.totalBudget) * 100) + '%' : '0%',
        'تاريخ البدء': c.startDate || '-',
        'تاريخ الانتهاء': c.endDate || '-',
      }));
      
      const expenseData = filteredExpenses.map((e) => ({
        'الحملة': getCampaignName(e.campaignId),
        'الوصف': e.description,
        'الفئة': CAMPAIGN_EXPENSE_CATEGORY_LABELS[e.category] || e.category,
        'المبلغ': e.amount,
        'الحالة': CAMPAIGN_EXPENSE_STATUS_LABELS[e.status] || e.status,
        'المؤثر': getInfluencerName(e.influencerId),
        'التاريخ': e.expenseDate,
      }));

      const influencerData = filteredInfluencers.map((i) => ({
        'اسم المؤثر': i.nameAr || i.name,
        'التخصص': INFLUENCER_SPECIALTY_LABELS[i.specialty as keyof typeof INFLUENCER_SPECIALTY_LABELS] || i.specialty,
        'عدد المتابعين': i.followerCount || 0,
        'معدل التفاعل': (i.engagementRate || 0) + '%',
        'الحالة': i.isActive ? 'نشط' : 'غير نشط',
      }));

      const summaryData = [{
        'إجمالي الحملات': stats.totalCampaigns,
        'الحملات النشطة': stats.activeCampaigns,
        'إجمالي الميزانية': stats.totalBudget,
        'المصروف': stats.spentBudget,
        'المتبقي': stats.remainingBudget,
        'نسبة الاستخدام': stats.budgetUtilization + '%',
        'إجمالي المصروفات': stats.totalExpenses,
        'عدد المؤثرين': stats.totalInfluencers,
      }];

      const wb = XLSX.utils.book_new();
      const summarySheet = XLSX.utils.json_to_sheet(summaryData);
      const campaignsSheet = XLSX.utils.json_to_sheet(campaignData);
      const expensesSheet = XLSX.utils.json_to_sheet(expenseData);
      const influencersSheet = XLSX.utils.json_to_sheet(influencerData);
      
      XLSX.utils.book_append_sheet(wb, summarySheet, 'ملخص');
      XLSX.utils.book_append_sheet(wb, campaignsSheet, 'الحملات');
      XLSX.utils.book_append_sheet(wb, expensesSheet, 'المصروفات');
      XLSX.utils.book_append_sheet(wb, influencersSheet, 'المؤثرين');
      
      XLSX.writeFile(wb, `تقرير_التسويق_الشامل_${new Date().toISOString().split('T')[0]}.xlsx`);
    });
  };

  const exportReportToPdf = async () => {
    const activeFiltersText = getActiveFiltersDescription();
    const today = new Date().toISOString().split('T')[0];

    try {
      const response = await fetch("/api/pdf/marketing-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          date: today,
          filtersText: activeFiltersText,
          stats: {
            totalCampaigns: stats.totalCampaigns,
            totalBudget: stats.totalBudget,
            spentBudget: stats.spentBudget,
            budgetUtilization: stats.budgetUtilization,
          },
          campaigns: filteredCampaigns.slice(0, 20).map(c => ({
            name: c.nameAr || c.name,
            status: CAMPAIGN_STATUS_LABELS[c.status as keyof typeof CAMPAIGN_STATUS_LABELS] || c.status,
            budget: c.totalBudget || 0,
            spent: c.spentBudget || 0,
            remaining: (c.totalBudget || 0) - (c.spentBudget || 0),
          })),
          expenses: filteredExpenses.slice(0, 30).map(e => ({
            description: e.description,
            category: CAMPAIGN_EXPENSE_CATEGORY_LABELS[e.category] || e.category,
            amount: e.amount,
            status: CAMPAIGN_EXPENSE_STATUS_LABELS[e.status] || e.status,
            date: e.expenseDate,
          })),
          influencers: filteredInfluencers.slice(0, 20).map(i => ({
            name: i.nameAr || i.name,
            specialty: INFLUENCER_SPECIALTY_LABELS[i.specialty as keyof typeof INFLUENCER_SPECIALTY_LABELS] || i.specialty,
            followers: i.followerCount || 0,
            status: i.isActive ? 'نشط' : 'غير نشط',
          })),
        }),
      });
      if (!response.ok) throw new Error("Failed to generate PDF");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `تقرير_التسويق_${today}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting marketing report PDF:", error);
    }
  };

  const getActiveFiltersDescription = () => {
    const parts: string[] = [];
    if (filters.dateFrom) parts.push(`من: ${filters.dateFrom}`);
    if (filters.dateTo) parts.push(`إلى: ${filters.dateTo}`);
    if (filters.campaignId !== 'all') {
      const camp = campaigns.find(c => c.id === parseInt(filters.campaignId));
      if (camp) parts.push(`الحملة: ${camp.nameAr || camp.name}`);
    }
    if (filters.influencerId !== 'all') {
      const inf = influencers.find(i => i.id === parseInt(filters.influencerId));
      if (inf) parts.push(`المؤثر: ${inf.nameAr || inf.name}`);
    }
    if (filters.status !== 'all') parts.push(`الحالة: ${CAMPAIGN_STATUS_LABELS[filters.status as keyof typeof CAMPAIGN_STATUS_LABELS] || filters.status}`);
    if (filters.expenseCategory !== 'all') parts.push(`الفئة: ${CAMPAIGN_EXPENSE_CATEGORY_LABELS[filters.expenseCategory] || filters.expenseCategory}`);
    if (filters.minAmount) parts.push(`الحد الأدنى للمبلغ: ${formatCurrency(parseFloat(filters.minAmount))}`);
    if (filters.maxAmount) parts.push(`الحد الأقصى للمبلغ: ${formatCurrency(parseFloat(filters.maxAmount))}`);
    if (filters.minBudget) parts.push(`الحد الأدنى للميزانية: ${formatCurrency(parseFloat(filters.minBudget))}`);
    if (filters.maxBudget) parts.push(`الحد الأقصى للميزانية: ${formatCurrency(parseFloat(filters.maxBudget))}`);
    return parts.join(' | ');
  };

  const hasActiveFilters = () => {
    return filters.dateFrom || filters.dateTo || 
           filters.campaignId !== 'all' || filters.influencerId !== 'all' ||
           filters.status !== 'all' || filters.expenseCategory !== 'all' ||
           filters.minAmount || filters.maxAmount || filters.minBudget || filters.maxBudget;
  };

  const handlePrint = useReactToPrint({
    contentRef: reportRef,
    documentTitle: `تقرير_التسويق_${new Date().toISOString().split('T')[0]}`,
  });

  return (
    <Layout>
      <div className="p-4 md:p-8 lg:p-10 max-w-screen-2xl mx-auto space-y-4" dir="rtl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/marketing">
              <Button variant="outline" size="icon" className="h-11 w-11 sm:h-9 sm:w-9" data-testid="button-back">
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold" data-testid="page-title">تقارير أداء التسويق الشاملة</h1>
              <p className="text-sm text-muted-foreground">تحليلات وتقارير تفصيلية مع فلاتر متقدمة</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="h-11 sm:h-9" onClick={resetFilters} data-testid="button-reset-filters">
              <RefreshCw className="w-4 h-4 ml-2" />
              إعادة تعيين
            </Button>
            <Button className="h-11 sm:h-9 bg-amber-500 hover:bg-amber-600" onClick={exportToExcel} data-testid="button-export">
              <Download className="w-4 h-4 ml-2" />
              تصدير Excel
            </Button>
          </div>
        </div>

        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Filter className="w-5 h-5 text-amber-500" />
                    فلاتر التقارير المتقدمة
                  </CardTitle>
                  <ChevronDown className={`w-5 h-5 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="border-t pt-4">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      من تاريخ
                    </Label>
                    <Input
                      className="h-11 sm:h-10"
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
                      data-testid="filter-date-from"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      إلى تاريخ
                    </Label>
                    <Input
                      className="h-11 sm:h-10"
                      type="date"
                      value={filters.dateTo}
                      onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
                      data-testid="filter-date-to"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <Megaphone className="w-4 h-4" />
                      الحملة
                    </Label>
                    <Select value={filters.campaignId} onValueChange={(v) => setFilters({...filters, campaignId: v})}>
                      <SelectTrigger className="h-11 sm:h-10" data-testid="filter-campaign">
                        <SelectValue placeholder="جميع الحملات" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">جميع الحملات</SelectItem>
                        {campaigns.map(c => (
                          <SelectItem key={c.id} value={c.id.toString()}>
                            {c.nameAr || c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      المؤثر
                    </Label>
                    <Select value={filters.influencerId} onValueChange={(v) => setFilters({...filters, influencerId: v})}>
                      <SelectTrigger className="h-11 sm:h-10" data-testid="filter-influencer">
                        <SelectValue placeholder="جميع المؤثرين" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">جميع المؤثرين</SelectItem>
                        {influencers.map(i => (
                          <SelectItem key={i.id} value={i.id.toString()}>
                            {i.nameAr || i.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <Activity className="w-4 h-4" />
                      حالة الحملة
                    </Label>
                    <Select value={filters.status} onValueChange={(v) => setFilters({...filters, status: v})}>
                      <SelectTrigger data-testid="filter-status">
                        <SelectValue placeholder="جميع الحالات" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">جميع الحالات</SelectItem>
                        <SelectItem value="draft">مسودة</SelectItem>
                        <SelectItem value="active">نشطة</SelectItem>
                        <SelectItem value="paused">متوقفة</SelectItem>
                        <SelectItem value="completed">مكتملة</SelectItem>
                        <SelectItem value="cancelled">ملغاة</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <Receipt className="w-4 h-4" />
                      فئة المصروف
                    </Label>
                    <Select value={filters.expenseCategory} onValueChange={(v) => setFilters({...filters, expenseCategory: v})}>
                      <SelectTrigger data-testid="filter-expense-category">
                        <SelectValue placeholder="جميع الفئات" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">جميع الفئات</SelectItem>
                        <SelectItem value="content_creation">إنتاج المحتوى</SelectItem>
                        <SelectItem value="influencer_fee">أتعاب المؤثرين</SelectItem>
                        <SelectItem value="advertising">الإعلانات المدفوعة</SelectItem>
                        <SelectItem value="production">الإنتاج والتصوير</SelectItem>
                        <SelectItem value="design">التصميم والجرافيك</SelectItem>
                        <SelectItem value="software">البرمجيات والأدوات</SelectItem>
                        <SelectItem value="events">الفعاليات</SelectItem>
                        <SelectItem value="printing">الطباعة</SelectItem>
                        <SelectItem value="other">أخرى</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />
                      الحد الأدنى للمبلغ
                    </Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={filters.minAmount}
                      onChange={(e) => setFilters({...filters, minAmount: e.target.value})}
                      data-testid="filter-min-amount"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />
                      الحد الأقصى للمبلغ
                    </Label>
                    <Input
                      type="number"
                      placeholder="999999"
                      value={filters.maxAmount}
                      onChange={(e) => setFilters({...filters, maxAmount: e.target.value})}
                      data-testid="filter-max-amount"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <Target className="w-4 h-4" />
                      الحد الأدنى للميزانية
                    </Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={filters.minBudget}
                      onChange={(e) => setFilters({...filters, minBudget: e.target.value})}
                      data-testid="filter-min-budget"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <Target className="w-4 h-4" />
                      الحد الأقصى للميزانية
                    </Label>
                    <Input
                      type="number"
                      placeholder="999999"
                      value={filters.maxBudget}
                      onChange={(e) => setFilters({...filters, maxBudget: e.target.value})}
                      data-testid="filter-max-budget"
                    />
                  </div>
                </div>
                <div className="flex justify-end mt-4 pt-4 border-t gap-2">
                  <Button 
                    className="bg-amber-500 hover:bg-amber-600" 
                    onClick={() => setReportDialogOpen(true)}
                    data-testid="button-view-report"
                  >
                    <FileText className="w-4 h-4 ml-2" />
                    عرض التقرير
                  </Button>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
              <Card className="border-amber-200" data-testid="kpi-total-campaigns">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Megaphone className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
                    <Badge variant="outline" className="text-amber-600 text-[10px] sm:text-xs">{stats.activeCampaigns} نشطة</Badge>
                  </div>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold">{stats.totalCampaigns}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">إجمالي الحملات</p>
                </CardContent>
              </Card>
              <Card className="border-blue-200" data-testid="kpi-total-budget">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center justify-between mb-2">
                    <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                    <Badge variant="outline" className="text-blue-600 text-[10px] sm:text-xs">{stats.budgetUtilization}%</Badge>
                  </div>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold">{formatCurrency(stats.totalBudget)}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">إجمالي الميزانية</p>
                </CardContent>
              </Card>
              <Card className="border-green-200" data-testid="kpi-spent-budget">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center justify-between mb-2">
                    <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
                  </div>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-green-600">{formatCurrency(stats.spentBudget)}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">المصروف</p>
                </CardContent>
              </Card>
              <Card className="border-amber-200" data-testid="kpi-remaining-budget">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Target className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
                  </div>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-amber-600">{formatCurrency(stats.remainingBudget)}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">المتبقي</p>
                </CardContent>
              </Card>
              <Card className="border-purple-200" data-testid="kpi-total-expenses">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Receipt className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500" />
                    <Badge variant="outline" className="text-purple-600 text-[10px] sm:text-xs">{stats.expenseCount}</Badge>
                  </div>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-purple-600">{formatCurrency(stats.totalExpenses)}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">إجمالي المصروفات</p>
                </CardContent>
              </Card>
              <Card className="border-indigo-200" data-testid="kpi-total-influencers">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Users className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500" />
                    <Badge variant="outline" className="text-indigo-600 text-[10px] sm:text-xs">{stats.activeInfluencers} نشط</Badge>
                  </div>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold">{stats.totalInfluencers}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">المؤثرين</p>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList className="flex-wrap">
                <TabsTrigger value="overview" data-testid="tab-overview">نظرة عامة</TabsTrigger>
                <TabsTrigger value="campaigns" data-testid="tab-campaigns">الحملات</TabsTrigger>
                <TabsTrigger value="expenses" data-testid="tab-expenses">المصروفات</TabsTrigger>
                <TabsTrigger value="influencers" data-testid="tab-influencers">المؤثرين</TabsTrigger>
                <TabsTrigger value="budget" data-testid="tab-budget">الميزانية</TabsTrigger>
                <TabsTrigger value="trends" data-testid="tab-trends">الاتجاهات</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <PieChart className="w-5 h-5 text-amber-500" />
                        توزيع المصروفات حسب الفئة
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {expensesByCategory.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">لا توجد مصروفات</p>
                      ) : (
                        <ResponsiveContainer width="100%" height={300}>
                          <RePieChart>
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
                              {expensesByCategory.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value: number) => formatCurrency(value)} />
                          </RePieChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-amber-500" />
                        حالة المصروفات
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-2 sm:gap-4">
                          <div className="text-center p-2 sm:p-4 bg-yellow-50 rounded-lg">
                            <p className="text-sm sm:text-lg md:text-xl font-bold text-yellow-700">{formatCurrency(stats.pendingExpenses)}</p>
                            <p className="text-[10px] sm:text-xs text-yellow-600">قيد الانتظار</p>
                          </div>
                          <div className="text-center p-2 sm:p-4 bg-blue-50 rounded-lg">
                            <p className="text-sm sm:text-lg md:text-xl font-bold text-blue-700">{formatCurrency(stats.approvedExpenses)}</p>
                            <p className="text-[10px] sm:text-xs text-blue-600">معتمدة</p>
                          </div>
                          <div className="text-center p-2 sm:p-4 bg-green-50 rounded-lg">
                            <p className="text-sm sm:text-lg md:text-xl font-bold text-green-700">{formatCurrency(stats.paidExpenses)}</p>
                            <p className="text-[10px] sm:text-xs text-green-600">مدفوعة</p>
                          </div>
                        </div>
                        <div className="h-4 bg-muted rounded-full overflow-hidden flex">
                          {stats.totalExpenses > 0 && (
                            <>
                              <div 
                                className="h-full bg-yellow-400"
                                style={{ width: `${(stats.pendingExpenses / stats.totalExpenses) * 100}%` }}
                              />
                              <div 
                                className="h-full bg-blue-400"
                                style={{ width: `${(stats.approvedExpenses / stats.totalExpenses) * 100}%` }}
                              />
                              <div 
                                className="h-full bg-green-400"
                                style={{ width: `${(stats.paidExpenses / stats.totalExpenses) * 100}%` }}
                              />
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Eye className="w-5 h-5 text-amber-500" />
                      مقاييس التفاعل للمؤثرين
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                      <div className="text-center p-3 sm:p-4 bg-muted/50 rounded-lg">
                        <Eye className="w-5 h-5 sm:w-6 sm:h-6 mx-auto mb-2 text-amber-500" />
                        <p className="text-lg sm:text-xl font-bold">{formatNumber(stats.totalReach)}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">الوصول الإجمالي</p>
                      </div>
                      <div className="text-center p-3 sm:p-4 bg-muted/50 rounded-lg">
                        <Heart className="w-5 h-5 sm:w-6 sm:h-6 mx-auto mb-2 text-red-500" />
                        <p className="text-lg sm:text-xl font-bold">{stats.avgEngagement.toFixed(1)}%</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">متوسط التفاعل</p>
                      </div>
                      <div className="text-center p-3 sm:p-4 bg-muted/50 rounded-lg">
                        <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 mx-auto mb-2 text-green-500" />
                        <p className="text-lg sm:text-xl font-bold">{formatCurrency(stats.totalInfluencerPayments)}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">مدفوعات المؤثرين</p>
                      </div>
                      <div className="text-center p-3 sm:p-4 bg-muted/50 rounded-lg">
                        <Users className="w-5 h-5 sm:w-6 sm:h-6 mx-auto mb-2 text-indigo-500" />
                        <p className="text-lg sm:text-xl font-bold">{stats.activeInfluencers}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">المؤثرين النشطين</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="campaigns">
                <Card>
                  <CardHeader>
                    <CardTitle>تقرير أداء الحملات</CardTitle>
                    <CardDescription>مقارنة الميزانية والمصروفات لكل حملة</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {campaignPerformance.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">لا توجد حملات مطابقة للفلاتر</p>
                    ) : (
                      <>
                        <ResponsiveContainer width="100%" height={400}>
                          <BarChart data={campaignPerformance} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" tickFormatter={(v) => formatNumber(v)} />
                            <YAxis type="category" dataKey="name" width={150} />
                            <Tooltip formatter={(value: number) => formatCurrency(value)} />
                            <Legend />
                            <Bar dataKey="budget" fill="#60a5fa" name="الميزانية" />
                            <Bar dataKey="spent" fill="#f472b6" name="المصروف" />
                          </BarChart>
                        </ResponsiveContainer>
                        <ScrollArea className="h-[300px] mt-4">
                          <div className="space-y-2">
                            {filteredCampaigns.map((campaign) => (
                              <div key={campaign.id} className="flex items-center justify-between p-3 border rounded-lg">
                                <div>
                                  <h4 className="font-medium">{campaign.nameAr || campaign.name}</h4>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge variant={campaign.status === "active" ? "default" : "secondary"}>
                                      {CAMPAIGN_STATUS_LABELS[campaign.status as keyof typeof CAMPAIGN_STATUS_LABELS] || campaign.status}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      {campaign.startDate} - {campaign.endDate}
                                    </span>
                                  </div>
                                </div>
                                <div className="text-left">
                                  <p className="font-bold">{formatCurrency(campaign.totalBudget || 0)}</p>
                                  <p className="text-sm text-amber-600">صرف: {formatCurrency(campaign.spentBudget || 0)}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="expenses">
                <Card>
                  <CardHeader>
                    <CardTitle>تقرير المصروفات التفصيلي</CardTitle>
                    <CardDescription>قائمة بجميع المصروفات حسب الفلاتر المحددة</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {filteredExpenses.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">لا توجد مصروفات مطابقة للفلاتر</p>
                    ) : (
                      <ScrollArea className="h-[500px]">
                        <div className="space-y-2">
                          {filteredExpenses.map((expense) => (
                            <div key={expense.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-medium">{expense.description}</h4>
                                  <Badge variant="outline">
                                    {CAMPAIGN_EXPENSE_CATEGORY_LABELS[expense.category] || expense.category}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                                  <span>الحملة: {getCampaignName(expense.campaignId)}</span>
                                  {expense.influencerId && (
                                    <span className="text-amber-600">• المؤثر: {getInfluencerName(expense.influencerId)}</span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">{expense.expenseDate}</p>
                              </div>
                              <div className="text-left">
                                <p className="font-bold text-amber-600">{formatCurrency(expense.amount)}</p>
                                <Badge variant={
                                  expense.status === 'paid' ? 'default' : 
                                  expense.status === 'approved' ? 'secondary' : 
                                  expense.status === 'rejected' ? 'destructive' : 'outline'
                                }>
                                  {CAMPAIGN_EXPENSE_STATUS_LABELS[expense.status] || expense.status}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="influencers">
                <Card>
                  <CardHeader>
                    <CardTitle>تقرير أداء المؤثرين</CardTitle>
                    <CardDescription>تحليل الوصول والتفاعل والمدفوعات لكل مؤثر</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {influencerPerformance.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">لا يوجد مؤثرين مطابقين للفلاتر</p>
                    ) : (
                      <>
                        <ResponsiveContainer width="100%" height={400}>
                          <BarChart data={influencerPerformance}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis yAxisId="left" tickFormatter={(v) => formatNumber(v)} />
                            <YAxis yAxisId="right" orientation="right" />
                            <Tooltip />
                            <Legend />
                            <Bar yAxisId="left" dataKey="followers" fill="#a78bfa" name="المتابعين" />
                            <Bar yAxisId="left" dataKey="totalPaid" fill="#f472b6" name="المدفوعات" />
                          </BarChart>
                        </ResponsiveContainer>
                        <ScrollArea className="h-[300px] mt-4">
                          <div className="space-y-2">
                            {filteredInfluencers.map((influencer) => {
                              const payments = filteredInfluencerPayments.filter(p => p.influencerId === influencer.id);
                              const expensesForInfluencer = filteredExpenses.filter(e => e.influencerId === influencer.id);
                              const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0) + 
                                                expensesForInfluencer.reduce((sum, e) => sum + e.amount, 0);
                              return (
                                <div key={influencer.id} className="flex items-center justify-between p-3 border rounded-lg">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                                      <User className="w-5 h-5 text-amber-600" />
                                    </div>
                                    <div>
                                      <h4 className="font-medium">{influencer.nameAr || influencer.name}</h4>
                                      <p className="text-sm text-muted-foreground">
                                        {INFLUENCER_SPECIALTY_LABELS[influencer.specialty as keyof typeof INFLUENCER_SPECIALTY_LABELS] || influencer.specialty}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-left">
                                    <p className="font-bold">{formatNumber(influencer.followerCount || 0)} متابع</p>
                                    <p className="text-sm text-amber-600">مدفوعات: {formatCurrency(totalPaid)}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </ScrollArea>
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="budget">
                <div className="grid md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>استخدام الميزانية</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        <div className="text-center">
                          <p className="text-6xl font-bold text-amber-600">{stats.budgetUtilization}%</p>
                          <p className="text-muted-foreground">نسبة الاستخدام</p>
                        </div>
                        <div className="h-6 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-500"
                            style={{ width: `${stats.budgetUtilization}%` }}
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div className="p-4 bg-blue-50 rounded-lg">
                            <DollarSign className="w-6 h-6 mx-auto mb-2 text-blue-600" />
                            <p className="text-lg font-bold text-blue-700">{formatCurrency(stats.totalBudget)}</p>
                            <p className="text-xs text-blue-600">الإجمالي</p>
                          </div>
                          <div className="p-4 bg-green-50 rounded-lg">
                            <TrendingUp className="w-6 h-6 mx-auto mb-2 text-green-600" />
                            <p className="text-lg font-bold text-green-700">{formatCurrency(stats.spentBudget)}</p>
                            <p className="text-xs text-green-600">المصروف</p>
                          </div>
                          <div className="p-4 bg-amber-50 rounded-lg">
                            <Target className="w-6 h-6 mx-auto mb-2 text-amber-600" />
                            <p className="text-lg font-bold text-amber-700">{formatCurrency(stats.remainingBudget)}</p>
                            <p className="text-xs text-amber-600">المتبقي</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>توزيع المصروفات حسب الحالة</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {expensesByStatus.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">لا توجد مصروفات</p>
                      ) : (
                        <ResponsiveContainer width="100%" height={300}>
                          <RePieChart>
                            <Pie
                              data={expensesByStatus}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={100}
                              fill="#8884d8"
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {expensesByStatus.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value: number) => formatCurrency(value)} />
                            <Legend />
                          </RePieChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="trends">
                <Card>
                  <CardHeader>
                    <CardTitle>اتجاهات المصروفات الشهرية</CardTitle>
                    <CardDescription>تطور المصروفات عبر الزمن</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {monthlyExpenses.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">لا توجد بيانات كافية</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={400}>
                        <AreaChart data={monthlyExpenses}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis tickFormatter={(v) => formatNumber(v)} />
                          <Tooltip formatter={(value: number) => formatCurrency(value)} />
                          <Area 
                            type="monotone" 
                            dataKey="total" 
                            stroke="#f472b6" 
                            fill="#fce7f3" 
                            name="المصروفات"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>

      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <FileText className="w-5 h-5" />
              تقرير أداء التسويق
            </DialogTitle>
            <DialogDescription>
              {hasActiveFilters() ? (
                <span>الفلاتر المطبقة: {getActiveFiltersDescription()}</span>
              ) : (
                <span>جميع البيانات (بدون فلاتر)</span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex items-center justify-end gap-2 border-b pb-4">
            <Button variant="outline" onClick={() => handlePrint()} data-testid="button-print-report">
              <Printer className="w-4 h-4 ml-2" />
              طباعة
            </Button>
            <Button variant="outline" onClick={exportReportToPdf} data-testid="button-export-pdf">
              <FileText className="w-4 h-4 ml-2" />
              تصدير PDF
            </Button>
            <Button className="bg-green-500 hover:bg-green-600" onClick={exportToExcel} data-testid="button-export-excel-dialog">
              <Download className="w-4 h-4 ml-2" />
              تصدير Excel
            </Button>
          </div>

          <ScrollArea className="h-[60vh]">
            <div ref={reportRef} className="p-4 space-y-6 bg-white" dir="rtl">
              <div className="text-center border-b pb-4">
                <h2 className="text-2xl font-bold text-amber-600">تقرير أداء التسويق الشامل</h2>
                <p className="text-sm text-muted-foreground">تاريخ التقرير: {new Date().toLocaleDateString('en-GB')}</p>
                {hasActiveFilters() && (
                  <p className="text-xs text-muted-foreground mt-1">الفلاتر: {getActiveFiltersDescription()}</p>
                )}
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-bold text-amber-600 border-b pb-2">ملخص الأداء</h3>
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div className="p-4 border rounded-lg">
                    <p className="text-2xl font-bold">{stats.totalCampaigns}</p>
                    <p className="text-sm text-muted-foreground">إجمالي الحملات</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-2xl font-bold">{formatCurrency(stats.totalBudget)}</p>
                    <p className="text-sm text-muted-foreground">إجمالي الميزانية</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.spentBudget)}</p>
                    <p className="text-sm text-muted-foreground">المصروف</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-2xl font-bold text-amber-600">{stats.budgetUtilization}%</p>
                    <p className="text-sm text-muted-foreground">نسبة الاستخدام</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-bold text-amber-600 border-b pb-2">الحملات ({filteredCampaigns.length})</h3>
                {filteredCampaigns.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">لا توجد حملات مطابقة للفلاتر</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">اسم الحملة</TableHead>
                        <TableHead className="text-right">الحالة</TableHead>
                        <TableHead className="text-right">الميزانية</TableHead>
                        <TableHead className="text-right">المصروف</TableHead>
                        <TableHead className="text-right">المتبقي</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCampaigns.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.nameAr || c.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {CAMPAIGN_STATUS_LABELS[c.status as keyof typeof CAMPAIGN_STATUS_LABELS] || c.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatCurrency(c.totalBudget || 0)}</TableCell>
                          <TableCell className="text-green-600">{formatCurrency(c.spentBudget || 0)}</TableCell>
                          <TableCell>{formatCurrency((c.totalBudget || 0) - (c.spentBudget || 0))}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-bold text-amber-600 border-b pb-2">المصروفات ({filteredExpenses.length})</h3>
                {filteredExpenses.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">لا توجد مصروفات مطابقة للفلاتر</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">الوصف</TableHead>
                        <TableHead className="text-right">الفئة</TableHead>
                        <TableHead className="text-right">المبلغ</TableHead>
                        <TableHead className="text-right">الحالة</TableHead>
                        <TableHead className="text-right">التاريخ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredExpenses.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell className="font-medium">{e.description}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {CAMPAIGN_EXPENSE_CATEGORY_LABELS[e.category] || e.category}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-green-600">{formatCurrency(e.amount)}</TableCell>
                          <TableCell>
                            <Badge variant={e.status === 'paid' ? 'default' : 'secondary'}>
                              {CAMPAIGN_EXPENSE_STATUS_LABELS[e.status] || e.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{e.expenseDate}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-bold text-amber-600 border-b pb-2">المؤثرين ({filteredInfluencers.length})</h3>
                {filteredInfluencers.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">لا يوجد مؤثرين مطابقين للفلاتر</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">اسم المؤثر</TableHead>
                        <TableHead className="text-right">التخصص</TableHead>
                        <TableHead className="text-right">عدد المتابعين</TableHead>
                        <TableHead className="text-right">معدل التفاعل</TableHead>
                        <TableHead className="text-right">الحالة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInfluencers.map((i) => (
                        <TableRow key={i.id}>
                          <TableCell className="font-medium">{i.nameAr || i.name}</TableCell>
                          <TableCell>
                            {INFLUENCER_SPECIALTY_LABELS[i.specialty as keyof typeof INFLUENCER_SPECIALTY_LABELS] || i.specialty}
                          </TableCell>
                          <TableCell>{formatNumber(i.followerCount || 0)}</TableCell>
                          <TableCell>{(i.engagementRate || 0).toFixed(1)}%</TableCell>
                          <TableCell>
                            <Badge variant={i.isActive ? 'default' : 'secondary'}>
                              {i.isActive ? 'نشط' : 'غير نشط'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
