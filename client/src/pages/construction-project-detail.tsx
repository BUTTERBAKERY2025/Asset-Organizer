import { useState } from "react";
import { Layout } from "@/components/layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useBranches } from "@/hooks/useBranches";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Plus, Pencil, Trash2, Loader2, Building2, Calendar, DollarSign, CheckCircle2, Clock, Pause, FileSpreadsheet, Printer, Download, ChevronDown, Calculator, Users, AlertTriangle, TrendingUp, Sparkles, Wand2, Activity } from "lucide-react";
import { useRef, useMemo } from "react";
import { useReactToPrint } from "react-to-print";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, useParams, useLocation } from "wouter";
import type { ConstructionProject, ConstructionCategory, Contractor, ProjectWorkItem, ProjectBudgetAllocation } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BudgetEstimateDialog } from "@/components/budget-estimate-dialog";

const workItemFormSchema = z.object({
  projectId: z.number(),
  categoryId: z.coerce.number().optional().nullable(),
  name: z.string().min(1, "اسم بند العمل مطلوب"),
  description: z.string().optional().nullable(),
  status: z.string().default("pending"),
  costEstimate: z.coerce.number().optional().nullable(),
  actualCost: z.coerce.number().optional().nullable(),
  contractorId: z.coerce.number().optional().nullable(),
  scheduledStart: z.string().optional().nullable(),
  scheduledEnd: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

type WorkItemFormData = z.infer<typeof workItemFormSchema>;

const WORK_ITEM_STATUSES = [
  { value: "pending", label: "معلق", icon: Clock, color: "bg-gray-500" },
  { value: "in_progress", label: "قيد التنفيذ", icon: Loader2, color: "bg-yellow-500" },
  { value: "completed", label: "مكتمل", icon: CheckCircle2, color: "bg-green-500" },
];

const PROJECT_STATUSES = [
  { value: "planned", label: "مخطط", color: "bg-blue-500" },
  { value: "in_progress", label: "قيد التنفيذ", color: "bg-yellow-500" },
  { value: "completed", label: "مكتمل", color: "bg-green-500" },
  { value: "on_hold", label: "متوقف", color: "bg-gray-500" },
];

export default function ConstructionProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = parseInt(params.id || "0", 10);
  const [, navigate] = useLocation();
  
  const [isAddWorkItemOpen, setIsAddWorkItemOpen] = useState(false);
  const [isEditWorkItemOpen, setIsEditWorkItemOpen] = useState(false);
  const [isDeleteWorkItemOpen, setIsDeleteWorkItemOpen] = useState(false);
  const [isUpdateProgressOpen, setIsUpdateProgressOpen] = useState(false);
  const [selectedWorkItem, setSelectedWorkItem] = useState<ProjectWorkItem | null>(null);
  const [newProgress, setNewProgress] = useState<number>(0);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin, isEmployee } = useAuth();
  const canEdit = isAdmin || isEmployee;

  const { data: project, isLoading: projectLoading } = useQuery<ConstructionProject>({
    queryKey: ["/api/construction/projects", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/construction/projects/${projectId}`);
      if (!res.ok) throw new Error("Failed to fetch project");
      return res.json();
    },
    enabled: projectId > 0,
  });

  const { branches } = useBranches();

  const { data: categories = [] } = useQuery<ConstructionCategory[]>({
    queryKey: ["/api/construction/categories"],
    queryFn: async () => {
      const res = await fetch("/api/construction/categories");
      if (!res.ok) throw new Error("Failed to fetch categories");
      return res.json();
    },
  });

  const { data: contractors = [] } = useQuery<Contractor[]>({
    queryKey: ["/api/construction/contractors"],
    queryFn: async () => {
      const res = await fetch("/api/construction/contractors");
      if (!res.ok) throw new Error("Failed to fetch contractors");
      return res.json();
    },
  });

  const { data: allProjects = [] } = useQuery<ConstructionProject[]>({
    queryKey: ["/api/construction/projects"],
    queryFn: async () => {
      const res = await fetch("/api/construction/projects");
      if (!res.ok) throw new Error("Failed to fetch projects");
      return res.json();
    },
  });

  const { data: workItems = [], isLoading: workItemsLoading } = useQuery<ProjectWorkItem[]>({
    queryKey: ["/api/construction/projects", projectId, "work-items"],
    queryFn: async () => {
      const res = await fetch(`/api/construction/projects/${projectId}/work-items`);
      if (!res.ok) throw new Error("Failed to fetch work items");
      return res.json();
    },
    enabled: projectId > 0,
  });

  const { data: budgetAllocations = [] } = useQuery<ProjectBudgetAllocation[]>({
    queryKey: ["/api/construction/projects", projectId, "budget-allocations"],
    queryFn: async () => {
      const res = await fetch(`/api/construction/projects/${projectId}/budget-allocations`);
      if (!res.ok) throw new Error("Failed to fetch budget allocations");
      return res.json();
    },
    enabled: projectId > 0,
  });

  // Smart dashboard: calculated progress + budget by category + today's snapshot
  type DashboardBudgetRow = {
    categoryId: number | null;
    categoryName: string;
    planned: number;
    spentExpenses: number;
    spentWorkItems: number;
    spentTotal: number;
    remaining: number;
    percentage: number;
    status: 'ok' | 'warning' | 'critical' | 'over' | 'unplanned';
  };
  type ProjectDashboard = {
    project: { id: number; title: string; branchId: string; status: string; budget: number | null; progressPercent: number };
    calculatedProgress: number;
    contractItems: { total: number; completed: number };
    contracts: { count: number; totalAmount: number; paidAmount: number; remainingAmount: number };
    budgetByCategory: DashboardBudgetRow[];
    totalPlanned: number;
    totalSpent: number;
    overallBudgetPercentage: number;
    today: {
      date: string;
      latestLog: { id: number; logDate: string; supervisorName: string; mainTrade: string | null; workersCount: number; status: string | null } | null;
      activitiesCount: number;
      expensesTotal: number;
      workersToday: number;
    };
  };

  const { data: dashboard } = useQuery<ProjectDashboard>({
    queryKey: ["/api/construction/projects", projectId, "dashboard"],
    queryFn: async () => {
      const res = await fetch(`/api/construction/projects/${projectId}/dashboard`);
      if (!res.ok) throw new Error("Failed to fetch dashboard");
      return res.json();
    },
    enabled: projectId > 0,
    refetchInterval: 60_000,
  });

  const TRADE_LABELS: Record<string, string> = {
    paint: "دهانات",
    tiling: "سيراميك وأرضيات",
    hvac: "تكييف",
    plumbing: "سباكة",
    electrical: "كهرباء وإضاءة",
    gypsum: "جبس وديكورات",
    kitchen_steel: "مطبخ ستيل تجاري",
    glass: "زجاج وواجهات",
    mdf: "MDF ونجارة",
    signage: "لافتات",
    other: "أخرى",
  };

  const [isBudgetDialogOpen, setIsBudgetDialogOpen] = useState(false);
  const [isBudgetEstimateDialogOpen, setIsBudgetEstimateDialogOpen] = useState(false);
  const [budgetInputs, setBudgetInputs] = useState<Record<number, number>>({});

  const upsertBudgetMutation = useMutation({
    mutationFn: async (data: { projectId: number; categoryId: number | null; plannedAmount: number }) => {
      const res = await fetch("/api/construction/budget-allocations/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save budget");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/construction/projects", projectId, "budget-allocations"] });
    },
  });

  const saveBudgetAllocations = async () => {
    try {
      for (const [catId, amount] of Object.entries(budgetInputs)) {
        const categoryIdNum = parseInt(catId, 10);
        if (isNaN(categoryIdNum) || amount <= 0) continue;
        await upsertBudgetMutation.mutateAsync({
          projectId,
          categoryId: categoryIdNum,
          plannedAmount: amount,
        });
      }
      setIsBudgetDialogOpen(false);
      toast({ title: "تم حفظ الميزانية بنجاح" });
    } catch {
      toast({ title: "فشل في حفظ الميزانية", variant: "destructive" });
    }
  };

  const form = useForm<WorkItemFormData>({
    resolver: zodResolver(workItemFormSchema),
    defaultValues: {
      projectId,
      categoryId: null,
      name: "",
      description: "",
      status: "pending",
      costEstimate: null,
      actualCost: null,
      contractorId: null,
      scheduledStart: "",
      scheduledEnd: "",
      notes: "",
    },
  });

  const createWorkItemMutation = useMutation({
    mutationFn: async (data: WorkItemFormData) => {
      const res = await fetch("/api/construction/work-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create work item");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/construction/projects", projectId, "work-items"] });
      setIsAddWorkItemOpen(false);
      form.reset({ projectId });
      toast({ title: "تم إضافة بند العمل بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ", description: "فشل في إضافة بند العمل", variant: "destructive" });
    },
  });

  const updateWorkItemMutation = useMutation({
    mutationFn: async (data: WorkItemFormData & { id: number }) => {
      const { id, ...workItemData } = data;
      const res = await fetch(`/api/construction/work-items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(workItemData),
      });
      if (!res.ok) throw new Error("Failed to update work item");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/construction/projects", projectId, "work-items"] });
      setIsEditWorkItemOpen(false);
      setSelectedWorkItem(null);
      toast({ title: "تم تحديث بند العمل بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ", description: "فشل في تحديث بند العمل", variant: "destructive" });
    },
  });

  const deleteWorkItemMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/construction/work-items/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete work item");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/construction/projects", projectId, "work-items"] });
      setIsDeleteWorkItemOpen(false);
      setSelectedWorkItem(null);
      toast({ title: "تم حذف بند العمل بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ", description: "فشل في حذف بند العمل", variant: "destructive" });
    },
  });

  const updateProgressMutation = useMutation({
    mutationFn: async ({ id, progress }: { id: number; progress: number }) => {
      const res = await fetch(`/api/construction/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progressPercent: progress }),
      });
      if (!res.ok) throw new Error("Failed to update progress");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/construction/projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/construction/projects", projectId, "dashboard"] });
      setIsUpdateProgressOpen(false);
      toast({ title: "تم تحديث نسبة التقدم بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ", description: "فشل في تحديث نسبة التقدم", variant: "destructive" });
    },
  });

  const applyCalculatedProgress = () => {
    if (!dashboard) return;
    updateProgressMutation.mutate({ id: projectId, progress: dashboard.calculatedProgress });
  };

  const getBranchName = (branchId: string) => {
    const branch = branches.find((b) => b.id === branchId);
    return branch?.name || branchId;
  };

  const getCategoryName = (categoryId: number | null) => {
    if (!categoryId) return "-";
    const category = categories.find((c) => c.id === categoryId);
    return category?.name || "-";
  };

  const getContractorName = (contractorId: number | null) => {
    if (!contractorId) return "-";
    const contractor = contractors.find((c) => c.id === contractorId);
    return contractor?.name || "-";
  };

  const getStatusBadge = (status: string) => {
    const statusInfo = PROJECT_STATUSES.find((s) => s.value === status);
    return (
      <Badge className={`${statusInfo?.color || "bg-gray-500"} text-white`}>
        {statusInfo?.label || status}
      </Badge>
    );
  };

  const getWorkItemStatusBadge = (status: string) => {
    const statusInfo = WORK_ITEM_STATUSES.find((s) => s.value === status);
    return (
      <Badge className={`${statusInfo?.color || "bg-gray-500"} text-white`}>
        {statusInfo?.label || status}
      </Badge>
    );
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return "-";
    return new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR" }).format(amount);
  };

  const totalEstimatedCost = workItems.reduce((sum, item) => sum + (item.costEstimate || 0), 0);
  const totalActualCost = workItems.reduce((sum, item) => sum + (item.actualCost || 0), 0);
  const completedItems = workItems.filter((item) => item.status === "completed").length;
  
  const totalPlannedBudget = budgetAllocations.reduce((sum, a) => sum + (a.plannedAmount || 0), 0);
  
  const budgetComparison = useMemo(() => {
    const comparison: { categoryId: number | null; categoryName: string; planned: number; actual: number; variance: number }[] = [];
    
    const categoryActuals: Record<number, number> = {};
    workItems.forEach(item => {
      const catId = item.categoryId || 0;
      categoryActuals[catId] = (categoryActuals[catId] || 0) + (Number(item.actualCost) || 0);
    });
    
    categories.forEach(cat => {
      const allocation = budgetAllocations.find(a => a.categoryId === cat.id);
      const planned = allocation?.plannedAmount || 0;
      const actual = categoryActuals[cat.id] || 0;
      if (planned > 0 || actual > 0) {
        comparison.push({
          categoryId: cat.id,
          categoryName: cat.name,
          planned,
          actual,
          variance: planned - actual,
        });
      }
    });
    
    if (categoryActuals[0] > 0) {
      const uncatAllocation = budgetAllocations.find(a => !a.categoryId);
      comparison.push({
        categoryId: null,
        categoryName: "غير مصنف",
        planned: uncatAllocation?.plannedAmount || 0,
        actual: categoryActuals[0],
        variance: (uncatAllocation?.plannedAmount || 0) - categoryActuals[0],
      });
    }
    
    return comparison.sort((a, b) => b.actual - a.actual);
  }, [workItems, categories, budgetAllocations]);

  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef: printRef });

  const [openCategories, setOpenCategories] = useState<Record<number, boolean>>({});

  const workItemsByCategory = useMemo(() => {
    const grouped: Record<number, { category: ConstructionCategory | null; items: ProjectWorkItem[]; totalCost: number }> = {};
    const uncategorized: ProjectWorkItem[] = [];
    
    workItems.forEach(item => {
      if (item.categoryId) {
        if (!grouped[item.categoryId]) {
          const cat = categories.find(c => c.id === item.categoryId) || null;
          grouped[item.categoryId] = { category: cat, items: [], totalCost: 0 };
        }
        grouped[item.categoryId].items.push(item);
        grouped[item.categoryId].totalCost += Number(item.actualCost) || 0;
      } else {
        uncategorized.push(item);
      }
    });

    Object.values(grouped).forEach(group => {
      group.items.sort((a, b) => (Number(b.actualCost) || 0) - (Number(a.actualCost) || 0));
    });

    const result = Object.values(grouped).sort((a, b) => b.totalCost - a.totalCost);
    if (uncategorized.length > 0) {
      uncategorized.sort((a, b) => (Number(b.actualCost) || 0) - (Number(a.actualCost) || 0));
      result.push({
        category: null,
        items: uncategorized,
        totalCost: uncategorized.reduce((sum, item) => sum + (Number(item.actualCost) || 0), 0)
      });
    }
    return result;
  }, [workItems, categories]);

  const toggleCategory = (categoryId: number) => {
    setOpenCategories(prev => ({ ...prev, [categoryId]: !prev[categoryId] }));
  };

  const exportToExcel = async () => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    
    const projectInfo = [{
      "اسم المشروع": project?.title || "",
      "الفرع": getBranchName(project?.branchId || ""),
      "الميزانية": project?.budget || 0,
      "التكلفة الفعلية": totalActualCost,
      "نسبة التقدم": `${project?.progressPercent || 0}%`,
      "عدد البنود": workItems.length,
      "البنود المكتملة": completedItems,
    }];
    const infoWs = XLSX.utils.json_to_sheet(projectInfo);
    XLSX.utils.book_append_sheet(wb, infoWs, "معلومات المشروع");

    const detailedData: Record<string, unknown>[] = [];
    workItemsByCategory.forEach((group, groupIndex) => {
      const categoryName = group.category?.name || "غير مصنف";
      detailedData.push({
        "#": "",
        "البيان": `═══ ${categoryName} ═══`,
        "المقاول": "",
        "التكلفة التقديرية": "",
        "التكلفة الفعلية": "",
        "الحالة": `${group.items.length} بند`,
      });
      
      group.items.forEach((item, itemIndex) => {
        detailedData.push({
          "#": itemIndex + 1,
          "البيان": item.name,
          "المقاول": getContractorName(item.contractorId),
          "التكلفة التقديرية": Number(item.costEstimate) || 0,
          "التكلفة الفعلية": Number(item.actualCost) || 0,
          "الحالة": WORK_ITEM_STATUSES.find(s => s.value === item.status)?.label || item.status,
        });
      });
      
      detailedData.push({
        "#": "",
        "البيان": `▬▬▬ مجموع ${categoryName} ▬▬▬`,
        "المقاول": "",
        "التكلفة التقديرية": group.items.reduce((sum, i) => sum + (Number(i.costEstimate) || 0), 0),
        "التكلفة الفعلية": group.totalCost,
        "الحالة": "",
      });
      
      detailedData.push({ "#": "", "البيان": "", "المقاول": "", "التكلفة التقديرية": "", "التكلفة الفعلية": "", "الحالة": "" });
    });
    
    detailedData.push({
      "#": "",
      "البيان": "═══════ الإجمالي العام ═══════",
      "المقاول": "",
      "التكلفة التقديرية": totalEstimatedCost,
      "التكلفة الفعلية": totalActualCost,
      "الحالة": `${workItems.length} بند`,
    });

    const detailedWs = XLSX.utils.json_to_sheet(detailedData);
    XLSX.utils.book_append_sheet(wb, detailedWs, "البنود حسب الفئة");

    const categorySummary = workItemsByCategory.map((group, index) => ({
      "#": index + 1,
      "الفئة": group.category?.name || "غير مصنف",
      "عدد البنود": group.items.length,
      "التكلفة التقديرية": group.items.reduce((sum, i) => sum + (Number(i.costEstimate) || 0), 0),
      "التكلفة الفعلية": group.totalCost,
      "النسبة": totalActualCost > 0 ? `${((group.totalCost / totalActualCost) * 100).toFixed(1)}%` : "0%",
    }));
    categorySummary.push({
      "#": 0,
      "الفئة": "الإجمالي",
      "عدد البنود": workItems.length,
      "التكلفة التقديرية": totalEstimatedCost,
      "التكلفة الفعلية": totalActualCost,
      "النسبة": "100%",
    });
    const categoryWs = XLSX.utils.json_to_sheet(categorySummary);
    XLSX.utils.book_append_sheet(wb, categoryWs, "ملخص الفئات");

    XLSX.writeFile(wb, `بنود_${project?.title || "المشروع"}_${new Date().toLocaleDateString("en-GB")}.xlsx`);
  };

  const exportToCSV = () => {
    const headers = ["#", "البيان", "الفئة", "المقاول", "التكلفة التقديرية", "التكلفة الفعلية", "الحالة"];
    const rows = workItems.map((item, index) => [
      index + 1,
      item.name,
      getCategoryName(item.categoryId),
      getContractorName(item.contractorId),
      Number(item.costEstimate) || 0,
      Number(item.actualCost) || 0,
      WORK_ITEM_STATUSES.find(s => s.value === item.status)?.label || item.status,
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `بنود_${project?.title || "المشروع"}.csv`;
    link.click();
  };

  const openEditWorkItem = (item: ProjectWorkItem) => {
    setSelectedWorkItem(item);
    form.reset({
      projectId,
      categoryId: item.categoryId,
      name: item.name,
      description: item.description || "",
      status: item.status,
      costEstimate: item.costEstimate,
      actualCost: item.actualCost,
      contractorId: item.contractorId,
      scheduledStart: item.scheduledStart || "",
      scheduledEnd: item.scheduledEnd || "",
      notes: item.notes || "",
    });
    setIsEditWorkItemOpen(true);
  };

  const onSubmitWorkItem = (data: WorkItemFormData) => {
    if (selectedWorkItem) {
      updateWorkItemMutation.mutate({ ...data, id: selectedWorkItem.id });
    } else {
      createWorkItemMutation.mutate({ ...data, projectId });
    }
  };

  if (projectLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!project) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground mb-4">المشروع غير موجود</p>
          <Link href="/construction-projects">
            <Button variant="outline">
              <ArrowRight className="w-4 h-4 ml-2" />
              العودة للمشاريع
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 md:p-8 lg:p-10 max-w-[1400px] mx-auto space-y-4" dir="rtl">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/construction-projects" className="hover:text-primary">
            المشاريع الإنشائية
          </Link>
          <span>/</span>
          <span>{project.title}</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <Label className="text-sm text-muted-foreground whitespace-nowrap">اختر المشروع:</Label>
              <Select
                value={projectId.toString()}
                onValueChange={(value) => navigate(`/construction-projects/${value}`)}
              >
                <SelectTrigger className="h-11 sm:h-10 w-full max-w-md" data-testid="select-project">
                  <SelectValue placeholder="اختر مشروع" />
                </SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto">
                  {allProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.title} - {getBranchName(p.branchId)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">{project.title}</h1>
              {getStatusBadge(project.status)}
            </div>
            <div className="flex items-center gap-2 text-muted-foreground mt-2">
              <Building2 className="w-4 h-4" />
              {getBranchName(project.branchId)}
            </div>
            {project.description && (
              <p className="text-muted-foreground mt-2">{project.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/construction/daily-logs?projectId=${projectId}`}>
              <Button variant="outline" className="h-11 sm:h-9" data-testid="button-view-daily-logs">
                <Calendar className="w-4 h-4 ml-1" />
                يوميات الأعمال
              </Button>
            </Link>
            <Link href={`/construction/daily-logs/new`}>
              <Button variant="outline" className="h-11 sm:h-9" data-testid="button-add-daily-log">
                <Plus className="w-4 h-4 ml-1" />
                يومية جديدة
              </Button>
            </Link>
            {canEdit && (
              <Button className="h-11 sm:h-9" onClick={() => { setNewProgress(project.progressPercent || 0); setIsUpdateProgressOpen(true); }} data-testid="button-update-progress">
                تحديث نسبة التقدم
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="p-3 sm:p-4 pb-2">
              <CardTitle className="text-xs sm:text-sm text-muted-foreground">الميزانية المخططة</CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0">
              <p className="text-lg sm:text-xl md:text-2xl font-bold">{formatCurrency(totalPlannedBudget || project.budget)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="p-3 sm:p-4 pb-2">
              <CardTitle className="text-xs sm:text-sm text-muted-foreground">التكلفة الفعلية</CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0">
              <p className="text-lg sm:text-xl md:text-2xl font-bold">{formatCurrency(totalActualCost)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="p-3 sm:p-4 pb-2">
              <CardTitle className="text-xs sm:text-sm text-muted-foreground">الفرق</CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0">
              <p className={`text-lg sm:text-xl md:text-2xl font-bold ${(totalPlannedBudget - totalActualCost) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(Math.abs(totalPlannedBudget - totalActualCost))}
                <span className="text-[10px] sm:text-xs md:text-sm mr-1">{(totalPlannedBudget - totalActualCost) >= 0 ? '(وفر)' : '(تجاوز)'}</span>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="p-3 sm:p-4 pb-2">
              <CardTitle className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                نسبة التقدم
                {dashboard && dashboard.calculatedProgress !== (project.progressPercent || 0) && (
                  <Badge variant="outline" className="text-[9px] sm:text-[10px] px-1 py-0 border-amber-500 text-amber-700">
                    محسوبة: {dashboard.calculatedProgress}%
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0">
              <div className="space-y-2">
                <p className="text-lg sm:text-xl md:text-2xl font-bold">{project.progressPercent || 0}%</p>
                <Progress value={project.progressPercent || 0} className="h-2" />
                {canEdit && dashboard && dashboard.calculatedProgress !== (project.progressPercent || 0) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-full text-[10px] sm:text-xs gap-1 text-amber-700 hover:text-amber-800 hover:bg-amber-50"
                    onClick={applyCalculatedProgress}
                    disabled={updateProgressMutation.isPending}
                    data-testid="button-apply-calculated-progress"
                  >
                    <Wand2 className="w-3 h-3" />
                    تطبيق المحسوبة
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="col-span-2 lg:col-span-1">
            <CardHeader className="p-3 sm:p-4 pb-2">
              <CardTitle className="text-xs sm:text-sm text-muted-foreground">بنود العمل</CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0">
              <p className="text-lg sm:text-xl md:text-2xl font-bold">{completedItems}/{workItems.length}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                مكتملة
                {dashboard && dashboard.contractItems.total > 0 && (
                  <span className="block">عقود: {dashboard.contractItems.completed}/{dashboard.contractItems.total}</span>
                )}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* بطاقة وضع المشروع اليوم */}
        {dashboard && (
          <Card className="border-blue-200 bg-gradient-to-l from-blue-50/50 to-transparent">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-600" />
                  <CardTitle className="text-base sm:text-lg">وضع المشروع اليوم</CardTitle>
                  <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-700">
                    {new Date(dashboard.today.date).toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" })}
                  </Badge>
                </div>
                <Link href={`/construction/daily-logs?projectId=${projectId}`}>
                  <Button variant="ghost" size="sm" className="text-blue-700 hover:text-blue-800 h-9" data-testid="button-view-daily-logs-today">
                    عرض كل اليوميات
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white/70 rounded-lg p-3 border border-blue-100" data-testid="card-today-activities">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    أنشطة اليوم
                  </div>
                  <p className="text-2xl font-bold text-foreground">{dashboard.today.activitiesCount}</p>
                </div>
                <div className="bg-white/70 rounded-lg p-3 border border-blue-100" data-testid="card-today-workers">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <Users className="w-3.5 h-3.5 text-blue-600" />
                    عمال اليوم
                  </div>
                  <p className="text-2xl font-bold text-foreground">{dashboard.today.workersToday}</p>
                </div>
                <div className="bg-white/70 rounded-lg p-3 border border-blue-100" data-testid="card-today-expenses">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <DollarSign className="w-3.5 h-3.5 text-amber-600" />
                    مصروف اليوم
                  </div>
                  <p className="text-lg sm:text-xl font-bold text-foreground">{formatCurrency(dashboard.today.expensesTotal)}</p>
                </div>
                <div className="bg-white/70 rounded-lg p-3 border border-blue-100" data-testid="card-today-contracts">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <TrendingUp className="w-3.5 h-3.5 text-purple-600" />
                    إجمالي العقود
                  </div>
                  <p className="text-lg sm:text-xl font-bold text-foreground">{formatCurrency(dashboard.contracts.totalAmount)}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    مدفوع: {formatCurrency(dashboard.contracts.paidAmount)}
                  </p>
                </div>
              </div>

              {dashboard.today.latestLog ? (
                <div className="mt-3 bg-white/70 rounded-lg p-3 border border-blue-100" data-testid="card-latest-log">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground">آخر يومية:</span>
                      <span className="font-semibold text-sm">{dashboard.today.latestLog.supervisorName}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {new Date(dashboard.today.latestLog.logDate).toLocaleDateString("ar-EG", { day: "numeric", month: "short" })}
                      </Badge>
                      {dashboard.today.latestLog.mainTrade && TRADE_LABELS[dashboard.today.latestLog.mainTrade] && (
                        <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700">
                          {TRADE_LABELS[dashboard.today.latestLog.mainTrade]}
                        </Badge>
                      )}
                      {dashboard.today.latestLog.workersCount > 0 && (
                        <span className="text-[11px] text-muted-foreground">
                          • {dashboard.today.latestLog.workersCount} عامل
                        </span>
                      )}
                    </div>
                    <Link href={`/construction/daily-logs/${dashboard.today.latestLog.id}/print`}>
                      <Button variant="outline" size="sm" className="h-8 text-xs" data-testid="button-view-latest-log">
                        عرض اليومية
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="mt-3 bg-amber-50 rounded-lg p-3 border border-amber-200 flex items-center gap-2 text-sm text-amber-800" data-testid="alert-no-logs">
                  <AlertTriangle className="w-4 h-4" />
                  لا توجد يوميات مسجلة لهذا المشروع بعد
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {canEdit && (
          <Card className="border-amber-200 bg-amber-50/30">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">تخطيط ميزانية المشروع</CardTitle>
                  <CardDescription>حدد الميزانية المتوقعة لكل فئة من بنود العمل</CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    const inputs: Record<number, number> = {};
                    budgetAllocations.forEach(a => {
                      if (a.categoryId) {
                        inputs[a.categoryId] = a.plannedAmount;
                      }
                    });
                    setBudgetInputs(inputs);
                    setIsBudgetDialogOpen(true);
                  }}
                  data-testid="button-plan-budget"
                >
                  <DollarSign className="w-4 h-4 ml-2" />
                  تخطيط الميزانية
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsBudgetEstimateDialogOpen(true)}
                  data-testid="button-estimate-budget"
                >
                  <Calculator className="w-4 h-4 ml-2" />
                  ميزانية تقديرية
                </Button>
              </div>
            </CardHeader>
            {(dashboard?.budgetByCategory.length ?? 0) > 0 && (
              <CardContent className="space-y-3">
                {dashboard!.budgetByCategory.map((row) => {
                  const pct = row.percentage;
                  const cappedPct = Math.min(pct, 100);
                  const statusColor =
                    row.status === 'over' ? 'bg-red-500' :
                    row.status === 'critical' ? 'bg-orange-500' :
                    row.status === 'warning' ? 'bg-yellow-500' :
                    row.status === 'unplanned' ? 'bg-rose-400' :
                    'bg-emerald-500';
                  const statusBadge =
                    row.status === 'over' ? { label: 'تجاوز', class: 'bg-red-100 text-red-700 border-red-300' } :
                    row.status === 'critical' ? { label: 'حرج', class: 'bg-orange-100 text-orange-700 border-orange-300' } :
                    row.status === 'warning' ? { label: 'تحذير', class: 'bg-yellow-100 text-yellow-700 border-yellow-300' } :
                    row.status === 'unplanned' ? { label: 'بدون خطة', class: 'bg-rose-100 text-rose-700 border-rose-300' } :
                    { label: 'سليم', class: 'bg-emerald-100 text-emerald-700 border-emerald-300' };
                  return (
                    <div
                      key={row.categoryId ?? 'uncategorized'}
                      className="bg-white rounded-lg p-3 border border-amber-100"
                      data-testid={`budget-row-${row.categoryId ?? 'uncategorized'}`}
                    >
                      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{row.categoryName}</span>
                          <Badge variant="outline" className={`text-[10px] ${statusBadge.class}`}>
                            {statusBadge.label}
                          </Badge>
                          {row.status === 'over' && row.planned > 0 && (
                            <span className="flex items-center gap-1 text-[11px] text-red-600 font-semibold">
                              <AlertTriangle className="w-3 h-3" />
                              تجاوز {formatCurrency(Math.abs(row.remaining))}
                            </span>
                          )}
                        </div>
                        <span className={`text-sm font-bold ${
                          row.status === 'over' ? 'text-red-600' :
                          row.status === 'critical' ? 'text-orange-600' :
                          row.status === 'warning' ? 'text-yellow-700' :
                          row.status === 'unplanned' ? 'text-rose-600' :
                          'text-emerald-700'
                        }`}>
                          {row.planned > 0 ? `${pct.toFixed(0)}%` : '—'}
                        </span>
                      </div>
                      <div className="h-3 bg-slate-100 rounded-full overflow-hidden mb-2">
                        <div
                          className={`h-full ${statusColor} transition-all duration-500`}
                          style={{ width: `${cappedPct}%` }}
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[11px] sm:text-xs">
                        <div>
                          <span className="text-muted-foreground block">المخطط</span>
                          <span className="font-semibold">{formatCurrency(row.planned)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">المنصرف</span>
                          <span className="font-semibold">{formatCurrency(row.spentTotal)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">المتبقي</span>
                          <span className={`font-semibold ${row.remaining < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                            {formatCurrency(Math.abs(row.remaining))}
                            {row.remaining < 0 ? ' −' : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* الإجمالي */}
                <div className="bg-amber-100/60 rounded-lg p-3 border border-amber-300" data-testid="budget-total">
                  <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                    <span className="font-bold text-sm">الإجمالي</span>
                    <span className={`text-sm font-bold ${
                      dashboard!.overallBudgetPercentage > 100 ? 'text-red-600' :
                      dashboard!.overallBudgetPercentage > 80 ? 'text-orange-600' :
                      'text-emerald-700'
                    }`}>
                      {dashboard!.totalPlanned > 0 ? `${dashboard!.overallBudgetPercentage.toFixed(0)}%` : '—'}
                    </span>
                  </div>
                  <div className="h-3 bg-white rounded-full overflow-hidden mb-2">
                    <div
                      className={`h-full transition-all duration-500 ${
                        dashboard!.overallBudgetPercentage > 100 ? 'bg-red-500' :
                        dashboard!.overallBudgetPercentage > 90 ? 'bg-orange-500' :
                        dashboard!.overallBudgetPercentage > 80 ? 'bg-yellow-500' :
                        'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(dashboard!.overallBudgetPercentage, 100)}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[11px] sm:text-xs">
                    <div>
                      <span className="text-muted-foreground block">إجمالي المخطط</span>
                      <span className="font-bold">{formatCurrency(dashboard!.totalPlanned)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">إجمالي المنصرف</span>
                      <span className="font-bold">{formatCurrency(dashboard!.totalSpent)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">{(dashboard!.totalPlanned - dashboard!.totalSpent) >= 0 ? 'متبقي' : 'تجاوز'}</span>
                      <span className={`font-bold ${(dashboard!.totalPlanned - dashboard!.totalSpent) >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                        {formatCurrency(Math.abs(dashboard!.totalPlanned - dashboard!.totalSpent))}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle>بنود العمل</CardTitle>
                <CardDescription>قائمة بنود العمل مجمعة حسب الفئة ({workItems.length} بند - {formatCurrency(totalActualCost)})</CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" data-testid="button-export-dropdown">
                      <Download className="w-4 h-4 ml-2" />
                      تصدير
                      <ChevronDown className="w-3 h-3 mr-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={exportToExcel} data-testid="button-export-excel">
                      <FileSpreadsheet className="w-4 h-4 ml-2" />
                      تصدير Excel
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={exportToCSV} data-testid="button-export-csv">
                      <FileSpreadsheet className="w-4 h-4 ml-2" />
                      تصدير CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handlePrint()} data-testid="button-print">
                      <Printer className="w-4 h-4 ml-2" />
                      طباعة
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {canEdit && (
                  <Button size="sm" onClick={() => { form.reset({ projectId }); setIsAddWorkItemOpen(true); }} data-testid="button-add-work-item">
                    <Plus className="w-4 h-4 ml-2" />
                    إضافة بند
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {workItemsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : workItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                لا توجد بنود عمل في هذا المشروع
              </div>
            ) : (
              <div ref={printRef} className="space-y-3 print:space-y-4" dir="rtl">
                <div className="hidden print:block mb-4">
                  <h2 className="text-xl font-bold">{project.title}</h2>
                  <p className="text-sm text-muted-foreground">{getBranchName(project.branchId)} - {new Date().toLocaleDateString("en-GB")}</p>
                </div>
                
                {workItemsByCategory.map((group, groupIndex) => {
                  const categoryId = group.category?.id || 0;
                  const isOpen = openCategories[categoryId] !== undefined ? openCategories[categoryId] : groupIndex < 3;
                  const completedInCategory = group.items.filter(i => i.status === "completed").length;
                  
                  return (
                    <Collapsible key={groupIndex} open={isOpen} onOpenChange={() => toggleCategory(categoryId)}>
                      <Card className="border-amber-200/50">
                        <CollapsibleTrigger asChild>
                          <CardHeader className="py-3 cursor-pointer hover:bg-amber-50/30 transition-colors">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                                <div>
                                  <CardTitle className="text-base">{group.category?.name || "غير مصنف"}</CardTitle>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {group.items.length} بند • {formatCurrency(group.totalCost)} • {completedInCategory}/{group.items.length} مكتمل
                                  </p>
                                </div>
                              </div>
                              <Badge variant="secondary" className="text-xs">
                                {totalActualCost > 0 ? ((group.totalCost / totalActualCost) * 100).toFixed(1) : 0}%
                              </Badge>
                            </div>
                          </CardHeader>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <CardContent className="pt-0 p-2 sm:p-4">
                            <div className="overflow-x-auto -mx-2 sm:mx-0">
                              <Table className="min-w-[500px]">
                                <TableHeader>
                                  <TableRow className="text-[10px] sm:text-xs bg-muted/30">
                                    <TableHead className="w-8 sm:w-10">#</TableHead>
                                    <TableHead className="min-w-[200px] sm:min-w-[300px]">البيان</TableHead>
                                    <TableHead className="hidden md:table-cell w-28">المقاول</TableHead>
                                    <TableHead className="w-24 sm:w-28 text-left">التكلفة</TableHead>
                                    <TableHead className="w-16 sm:w-20">الحالة</TableHead>
                                    {canEdit && <TableHead className="w-14 sm:w-16">إجراءات</TableHead>}
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {group.items.map((item, itemIndex) => (
                                    <TableRow key={item.id} className="text-xs sm:text-sm hover:bg-amber-50/30" data-testid={`row-work-item-${item.id}`}>
                                      <TableCell className="text-muted-foreground text-[10px] sm:text-xs font-medium">{itemIndex + 1}</TableCell>
                                      <TableCell>
                                        <div>
                                          <p className="font-medium text-xs sm:text-sm" title={item.name}>{item.name}</p>
                                          {item.description && (
                                            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>
                                          )}
                                          <p className="text-[10px] text-gray-400 md:hidden">{getContractorName(item.contractorId)}</p>
                                          {(item.scheduledStart || item.scheduledEnd) && (
                                            <p className="text-[10px] sm:text-xs text-blue-600 mt-0.5">
                                              📅 {item.scheduledStart && `من: ${item.scheduledStart}`}
                                              {item.scheduledStart && item.scheduledEnd && " - "}
                                              {item.scheduledEnd && `إلى: ${item.scheduledEnd}`}
                                            </p>
                                          )}
                                          {item.notes && (
                                            <p className="text-[10px] sm:text-xs text-amber-600 mt-0.5 line-clamp-1">📝 {item.notes}</p>
                                          )}
                                        </div>
                                      </TableCell>
                                      <TableCell className="hidden md:table-cell text-xs">{getContractorName(item.contractorId)}</TableCell>
                                      <TableCell className="text-left">
                                        <p className="font-semibold text-xs sm:text-sm">{formatCurrency(item.actualCost)}</p>
                                      </TableCell>
                                      <TableCell>{getWorkItemStatusBadge(item.status)}</TableCell>
                                      {canEdit && (
                                        <TableCell>
                                          <div className="flex items-center gap-0.5">
                                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => openEditWorkItem(item)} data-testid={`button-edit-work-item-${item.id}`}>
                                              <Pencil className="w-3 h-3" />
                                            </Button>
                                            {isAdmin && (
                                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { setSelectedWorkItem(item); setIsDeleteWorkItemOpen(true); }} data-testid={`button-delete-work-item-${item.id}`}>
                                                <Trash2 className="w-3 h-3 text-destructive" />
                                              </Button>
                                            )}
                                          </div>
                                        </TableCell>
                                      )}
                                    </TableRow>
                                  ))}
                                  <TableRow className="bg-amber-100/50 font-bold border-t-2 border-amber-300">
                                    <TableCell></TableCell>
                                    <TableCell className="text-xs sm:text-sm">مجموع {group.category?.name || "غير مصنف"}</TableCell>
                                    <TableCell className="hidden md:table-cell text-xs">{group.items.length} بند</TableCell>
                                    <TableCell className="text-left text-xs sm:text-sm font-bold text-primary">{formatCurrency(group.totalCost)}</TableCell>
                                    <TableCell></TableCell>
                                    {canEdit && <TableCell></TableCell>}
                                  </TableRow>
                                </TableBody>
                              </Table>
                            </div>
                          </CardContent>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={isAddWorkItemOpen || isEditWorkItemOpen} onOpenChange={(open) => {
          if (!open) {
            setIsAddWorkItemOpen(false);
            setIsEditWorkItemOpen(false);
            setSelectedWorkItem(null);
            form.reset({ projectId });
          }
        }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{selectedWorkItem ? "تعديل بند العمل" : "إضافة بند عمل جديد"}</DialogTitle>
              <DialogDescription>
                {selectedWorkItem ? "قم بتعديل بيانات بند العمل" : "أدخل بيانات بند العمل الجديد"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmitWorkItem)} className="space-y-4">
              <div className="space-y-2">
                <Label>اسم البند</Label>
                <Input {...form.register("name")} placeholder="مثال: تمديدات كهربائية" data-testid="input-work-item-name" />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>الفئة</Label>
                  <Select value={form.watch("categoryId")?.toString() || ""} onValueChange={(v) => form.setValue("categoryId", v ? parseInt(v) : null)}>
                    <SelectTrigger data-testid="select-work-item-category">
                      <SelectValue placeholder="اختر الفئة" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 overflow-y-auto">
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id.toString()}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>المقاول</Label>
                  <SearchableSelect
                    value={form.watch("contractorId")?.toString() || ""}
                    onValueChange={(v) => form.setValue("contractorId", v ? parseInt(v) : null)}
                    placeholder="اختر المقاول"
                    searchPlaceholder="ابحث باسم المقاول أو التخصص..."
                    emptyText="لا يوجد مقاولون"
                    dataTestid="select-work-item-contractor"
                    clearable
                    onClear={() => form.setValue("contractorId", null)}
                    options={contractors.map((con) => ({
                      value: con.id.toString(),
                      label: con.name,
                      sublabel: con.specialization || undefined,
                    }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>الوصف</Label>
                <Textarea {...form.register("description")} placeholder="وصف بند العمل..." data-testid="input-work-item-description" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>الحالة</Label>
                  <Select value={form.watch("status")} onValueChange={(v) => form.setValue("status", v)}>
                    <SelectTrigger data-testid="select-work-item-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 overflow-y-auto">
                      {WORK_ITEM_STATUSES.map((status) => (
                        <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>التكلفة المقدرة (ريال)</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    className="h-11"
                    {...form.register("costEstimate")}
                    placeholder="0"
                    data-testid="input-work-item-cost-estimate"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>التكلفة الفعلية (ريال)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  className="h-11"
                  {...form.register("actualCost")}
                  placeholder="0"
                  data-testid="input-work-item-actual-cost"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>تاريخ البدء</Label>
                  <Input type="date" {...form.register("scheduledStart")} data-testid="input-work-item-start-date" />
                </div>
                <div className="space-y-2">
                  <Label>تاريخ الانتهاء</Label>
                  <Input type="date" {...form.register("scheduledEnd")} data-testid="input-work-item-end-date" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>ملاحظات</Label>
                <Textarea {...form.register("notes")} placeholder="ملاحظات إضافية..." data-testid="input-work-item-notes" />
              </div>

              <DialogFooter>
                <Button type="submit" disabled={createWorkItemMutation.isPending || updateWorkItemMutation.isPending} data-testid="button-submit-work-item">
                  {(createWorkItemMutation.isPending || updateWorkItemMutation.isPending) && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                  {selectedWorkItem ? "حفظ التغييرات" : "إضافة البند"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={isUpdateProgressOpen} onOpenChange={setIsUpdateProgressOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>تحديث نسبة التقدم</DialogTitle>
              <DialogDescription>اختر نسبة التقدم الحالية للمشروع</DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="flex items-center justify-center">
                <span className="text-4xl font-bold">{newProgress}%</span>
              </div>
              <Slider
                value={[newProgress]}
                onValueChange={(v) => setNewProgress(v[0])}
                max={100}
                step={5}
                className="w-full"
                data-testid="slider-progress"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsUpdateProgressOpen(false)}>إلغاء</Button>
              <Button 
                onClick={() => updateProgressMutation.mutate({ id: projectId, progress: newProgress })}
                disabled={updateProgressMutation.isPending}
                data-testid="button-save-progress"
              >
                {updateProgressMutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                حفظ
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={isDeleteWorkItemOpen} onOpenChange={setIsDeleteWorkItemOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>حذف بند العمل</AlertDialogTitle>
              <AlertDialogDescription>
                هل أنت متأكد من حذف بند العمل "{selectedWorkItem?.name}"؟
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => selectedWorkItem && deleteWorkItemMutation.mutate(selectedWorkItem.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-delete-work-item"
              >
                {deleteWorkItemMutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                حذف
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={isBudgetDialogOpen} onOpenChange={setIsBudgetDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>تخطيط ميزانية المشروع</DialogTitle>
              <DialogDescription>
                حدد الميزانية المتوقعة لكل فئة من بنود العمل لمتابعة الصرف الفعلي
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الفئة</TableHead>
                    <TableHead className="w-48">الميزانية المخططة (ريال)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((cat) => (
                    <TableRow key={cat.id}>
                      <TableCell className="font-medium">{cat.name}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          value={budgetInputs[cat.id] || ""}
                          onChange={(e) => setBudgetInputs(prev => ({
                            ...prev,
                            [cat.id]: parseFloat(e.target.value) || 0
                          }))}
                          placeholder="0"
                          className="text-left h-11"
                          data-testid={`input-budget-${cat.id}`}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex justify-between items-center bg-muted/50 p-3 rounded-lg">
                <span className="font-semibold">إجمالي الميزانية المخططة:</span>
                <span className="text-xl font-bold text-primary">
                  {formatCurrency(Object.values(budgetInputs).reduce((sum, v) => sum + (v || 0), 0))}
                </span>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsBudgetDialogOpen(false)}>إلغاء</Button>
              <Button 
                onClick={saveBudgetAllocations}
                disabled={upsertBudgetMutation.isPending}
                data-testid="button-save-budget"
              >
                {upsertBudgetMutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                حفظ الميزانية
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {project && (
          <BudgetEstimateDialog
            open={isBudgetEstimateDialogOpen}
            onOpenChange={setIsBudgetEstimateDialogOpen}
            projectId={projectId}
            projectTitle={project.title}
          />
        )}
      </div>
    </Layout>
  );
}
