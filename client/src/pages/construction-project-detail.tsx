import { useState } from "react";
import { Layout } from "@/components/layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { ArrowRight, Plus, Pencil, Trash2, Loader2, Building2, Calendar, DollarSign, CheckCircle2, Clock, Pause, FileSpreadsheet, Printer, Download, ChevronDown } from "lucide-react";
import * as XLSX from "xlsx";
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
import { Link, useParams } from "wouter";
import type { Branch, ConstructionProject, ConstructionCategory, Contractor, ProjectWorkItem } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";

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

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: async () => {
      const res = await fetch("/api/branches");
      if (!res.ok) throw new Error("Failed to fetch branches");
      return res.json();
    },
  });

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

  const { data: workItems = [], isLoading: workItemsLoading } = useQuery<ProjectWorkItem[]>({
    queryKey: ["/api/construction/projects", projectId, "work-items"],
    queryFn: async () => {
      const res = await fetch(`/api/construction/projects/${projectId}/work-items`);
      if (!res.ok) throw new Error("Failed to fetch work items");
      return res.json();
    },
    enabled: projectId > 0,
  });

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
      setIsUpdateProgressOpen(false);
      toast({ title: "تم تحديث نسبة التقدم بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ", description: "فشل في تحديث نسبة التقدم", variant: "destructive" });
    },
  });

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

  const exportToExcel = () => {
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

    XLSX.writeFile(wb, `بنود_${project?.title || "المشروع"}_${new Date().toLocaleDateString("ar-SA")}.xlsx`);
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
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/construction-projects" className="hover:text-primary">
            المشاريع الإنشائية
          </Link>
          <span>/</span>
          <span>{project.title}</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{project.title}</h1>
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
          {canEdit && (
            <Button onClick={() => { setNewProgress(project.progressPercent || 0); setIsUpdateProgressOpen(true); }} data-testid="button-update-progress">
              تحديث نسبة التقدم
            </Button>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">الميزانية</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(project.budget)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">التكلفة الفعلية</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(project.actualCost || totalActualCost)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">نسبة التقدم</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-2xl font-bold">{project.progressPercent || 0}%</p>
                <Progress value={project.progressPercent || 0} className="h-2" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">بنود العمل</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{completedItems}/{workItems.length}</p>
              <p className="text-xs text-muted-foreground">مكتملة</p>
            </CardContent>
          </Card>
        </div>

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
                  <p className="text-sm text-muted-foreground">{getBranchName(project.branchId)} - {new Date().toLocaleDateString("ar-SA")}</p>
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
                          <CardContent className="pt-0">
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow className="text-xs bg-muted/30">
                                    <TableHead className="w-10">#</TableHead>
                                    <TableHead className="min-w-[300px]">البيان</TableHead>
                                    <TableHead className="w-28">المقاول</TableHead>
                                    <TableHead className="w-28 text-left">التكلفة</TableHead>
                                    <TableHead className="w-20">الحالة</TableHead>
                                    {canEdit && <TableHead className="w-16">إجراءات</TableHead>}
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {group.items.map((item, itemIndex) => (
                                    <TableRow key={item.id} className="text-sm hover:bg-amber-50/30" data-testid={`row-work-item-${item.id}`}>
                                      <TableCell className="text-muted-foreground text-xs font-medium">{itemIndex + 1}</TableCell>
                                      <TableCell>
                                        <div>
                                          <p className="font-medium text-sm" title={item.name}>{item.name}</p>
                                          {item.description && (
                                            <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                                          )}
                                          {(item.scheduledStart || item.scheduledEnd) && (
                                            <p className="text-xs text-blue-600 mt-0.5">
                                              📅 {item.scheduledStart && `من: ${item.scheduledStart}`}
                                              {item.scheduledStart && item.scheduledEnd && " - "}
                                              {item.scheduledEnd && `إلى: ${item.scheduledEnd}`}
                                            </p>
                                          )}
                                          {item.notes && (
                                            <p className="text-xs text-amber-600 mt-0.5">📝 {item.notes}</p>
                                          )}
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-xs">{getContractorName(item.contractorId)}</TableCell>
                                      <TableCell className="text-left">
                                        <p className="font-semibold text-sm">{formatCurrency(item.actualCost)}</p>
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
                                    <TableCell className="text-sm">مجموع {group.category?.name || "غير مصنف"}</TableCell>
                                    <TableCell className="text-xs">{group.items.length} بند</TableCell>
                                    <TableCell className="text-left text-sm font-bold text-primary">{formatCurrency(group.totalCost)}</TableCell>
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
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id.toString()}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>المقاول</Label>
                  <Select value={form.watch("contractorId")?.toString() || ""} onValueChange={(v) => form.setValue("contractorId", v ? parseInt(v) : null)}>
                    <SelectTrigger data-testid="select-work-item-contractor">
                      <SelectValue placeholder="اختر المقاول" />
                    </SelectTrigger>
                    <SelectContent>
                      {contractors.map((con) => (
                        <SelectItem key={con.id} value={con.id.toString()}>{con.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                    <SelectContent>
                      {WORK_ITEM_STATUSES.map((status) => (
                        <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>التكلفة المقدرة (ريال)</Label>
                  <Input type="number" {...form.register("costEstimate")} placeholder="0" data-testid="input-work-item-cost-estimate" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>التكلفة الفعلية (ريال)</Label>
                <Input type="number" {...form.register("actualCost")} placeholder="0" data-testid="input-work-item-actual-cost" />
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
      </div>
    </Layout>
  );
}
