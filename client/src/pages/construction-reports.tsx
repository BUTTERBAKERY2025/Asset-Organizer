import { useState, useRef, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Printer, FileSpreadsheet, Hammer, Building2, Users, CheckCircle2, Clock, AlertTriangle, ChevronLeft, Eye, Search, Filter, X, ChevronDown, ChevronUp, DollarSign, TrendingUp, FileDown } from "lucide-react";
import { TablePagination } from "@/components/ui/pagination";
import { useReactToPrint } from "react-to-print";
import * as XLSX from "xlsx";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts";
import type { Branch, ConstructionProject, ConstructionCategory, Contractor, ProjectWorkItem } from "@shared/schema";

function HighlightText({ text, highlight }: { text: string; highlight: string }) {
  if (!highlight.trim()) return <>{text}</>;
  const escapedHighlight = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escapedHighlight})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === highlight.toLowerCase() ? (
          <mark key={i} className="bg-yellow-200 px-0.5 rounded">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

const STATUS_LABELS: Record<string, string> = {
  planned: "مخطط",
  in_progress: "قيد التنفيذ",
  on_hold: "متوقف",
  completed: "مكتمل",
  cancelled: "ملغي",
};

const STATUS_COLORS: Record<string, string> = {
  planned: "bg-blue-100 text-blue-800",
  in_progress: "bg-yellow-100 text-yellow-800",
  on_hold: "bg-gray-100 text-gray-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const WORK_STATUS_LABELS: Record<string, string> = {
  pending: "معلق",
  in_progress: "قيد التنفيذ",
  completed: "مكتمل",
};

const CHART_COLORS = ["#f59e0b", "#22c55e", "#3b82f6", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

export default function ConstructionReportsPage() {
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedContractor, setSelectedContractor] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [minCost, setMinCost] = useState<string>("");
  const [maxCost, setMaxCost] = useState<string>("");
  const [filtersOpen, setFiltersOpen] = useState<boolean>(false);
  const [sortField, setSortField] = useState<string>("actualCost");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedBranch, selectedCategory, selectedContractor, selectedStatus, searchQuery, minCost, maxCost]);

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: async () => {
      const res = await fetch("/api/branches");
      if (!res.ok) throw new Error("Failed to fetch branches");
      return res.json();
    },
  });

  const { data: projects = [] } = useQuery<ConstructionProject[]>({
    queryKey: ["/api/construction/projects"],
    queryFn: async () => {
      const res = await fetch("/api/construction/projects");
      if (!res.ok) throw new Error("Failed to fetch projects");
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

  const { data: workItems = [] } = useQuery<ProjectWorkItem[]>({
    queryKey: ["/api/construction/work-items"],
    queryFn: async () => {
      const res = await fetch("/api/construction/work-items");
      if (!res.ok) throw new Error("Failed to fetch work items");
      return res.json();
    },
  });

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: "تقرير المشاريع الإنشائية",
  });

  const branchMap = useMemo(() => {
    const map: Record<string, string> = {};
    branches.forEach(b => { map[b.id] = b.name; });
    return map;
  }, [branches]);

  const categoryMap = useMemo(() => {
    const map: Record<number, string> = {};
    categories.forEach(c => { map[c.id] = c.name; });
    return map;
  }, [categories]);

  const contractorMap = useMemo(() => {
    const map: Record<number, string> = {};
    contractors.forEach(c => { map[c.id] = c.name; });
    return map;
  }, [contractors]);

  const filteredProjects = useMemo(() => {
    let result = projects;
    if (selectedBranch !== "all") {
      result = result.filter(p => p.branchId === selectedBranch);
    }
    return result;
  }, [projects, selectedBranch]);

  const projectComparisonData = useMemo(() => {
    return filteredProjects.map(project => ({
      name: project.title.length > 20 ? project.title.substring(0, 20) + "..." : project.title,
      fullName: project.title,
      budget: Number(project.budget) || 0,
      progress: project.progressPercent || 0,
      branch: branchMap[project.branchId] || project.branchId,
      status: STATUS_LABELS[project.status] || project.status,
    }));
  }, [filteredProjects, branchMap]);

  const branchComparisonData = useMemo(() => {
    return branches.map(branch => {
      const branchProjects = projects.filter(p => p.branchId === branch.id);
      const totalBudget = branchProjects.reduce((sum, p) => sum + (Number(p.budget) || 0), 0);
      const completed = branchProjects.filter(p => p.status === "completed").length;
      const inProgress = branchProjects.filter(p => p.status === "in_progress").length;
      const avgProgress = branchProjects.length > 0
        ? Math.round(branchProjects.reduce((sum, p) => sum + (p.progressPercent || 0), 0) / branchProjects.length)
        : 0;
      return {
        name: branch.name.replace("فرع ", ""),
        total: branchProjects.length,
        completed,
        inProgress,
        budget: totalBudget,
        avgProgress,
      };
    });
  }, [branches, projects]);

  const statusSummary = useMemo(() => {
    const summary: Record<string, number> = {};
    filteredProjects.forEach(p => {
      summary[p.status] = (summary[p.status] || 0) + 1;
    });
    return Object.entries(summary).map(([status, count]) => ({
      name: STATUS_LABELS[status] || status,
      value: count,
    }));
  }, [filteredProjects]);

  const projectMap = useMemo(() => {
    const map: Record<number, string> = {};
    projects.forEach(p => { map[p.id] = p.title; });
    return map;
  }, [projects]);

  const workItemsByProject = useMemo(() => {
    const projectIds = new Set(filteredProjects.map(p => p.id));
    return workItems.filter(w => projectIds.has(w.projectId));
  }, [workItems, filteredProjects]);

  const filteredWorkItems = useMemo(() => {
    let result = workItemsByProject;
    
    if (selectedCategory !== "all") {
      result = result.filter(w => w.categoryId === parseInt(selectedCategory));
    }
    if (selectedContractor !== "all") {
      result = result.filter(w => w.contractorId === parseInt(selectedContractor));
    }
    if (selectedStatus !== "all") {
      result = result.filter(w => w.status === selectedStatus);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(w => 
        w.name.toLowerCase().includes(query) || 
        (w.description && w.description.toLowerCase().includes(query))
      );
    }
    if (minCost) {
      const min = parseFloat(minCost);
      if (!isNaN(min)) {
        result = result.filter(w => (Number(w.actualCost) || 0) >= min);
      }
    }
    if (maxCost) {
      const max = parseFloat(maxCost);
      if (!isNaN(max)) {
        result = result.filter(w => (Number(w.actualCost) || 0) <= max);
      }
    }
    
    result = [...result].sort((a, b) => {
      let aVal = 0, bVal = 0;
      if (sortField === "actualCost") {
        aVal = Number(a.actualCost) || 0;
        bVal = Number(b.actualCost) || 0;
      } else if (sortField === "name") {
        return sortDirection === "asc" 
          ? a.name.localeCompare(b.name, "ar") 
          : b.name.localeCompare(a.name, "ar");
      }
      return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
    });
    
    return result;
  }, [workItemsByProject, selectedCategory, selectedContractor, selectedStatus, searchQuery, minCost, maxCost, sortField, sortDirection]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedBranch !== "all") count++;
    if (selectedCategory !== "all") count++;
    if (selectedContractor !== "all") count++;
    if (selectedStatus !== "all") count++;
    if (searchQuery.trim()) count++;
    if (minCost || maxCost) count++;
    return count;
  }, [selectedBranch, selectedCategory, selectedContractor, selectedStatus, searchQuery, minCost, maxCost]);

  const clearAllFilters = () => {
    setSelectedBranch("all");
    setSelectedCategory("all");
    setSelectedContractor("all");
    setSelectedStatus("all");
    setSearchQuery("");
    setMinCost("");
    setMaxCost("");
  };

  const filteredWorkItemsStats = useMemo(() => {
    const totalCost = filteredWorkItems.reduce((sum, w) => sum + (Number(w.actualCost) || 0), 0);
    const avgCost = filteredWorkItems.length > 0 ? totalCost / filteredWorkItems.length : 0;
    const completedCount = filteredWorkItems.filter(w => w.status === "completed").length;
    return { totalCost, avgCost, count: filteredWorkItems.length, completedCount };
  }, [filteredWorkItems]);

  const workItemsByCategoryData = useMemo(() => {
    const categoryCount: Record<number, { count: number; cost: number; actualCost: number }> = {};
    workItemsByProject.forEach(w => {
      if (w.categoryId) {
        if (!categoryCount[w.categoryId]) {
          categoryCount[w.categoryId] = { count: 0, cost: 0, actualCost: 0 };
        }
        categoryCount[w.categoryId].count += 1;
        categoryCount[w.categoryId].cost += Number(w.costEstimate) || 0;
        categoryCount[w.categoryId].actualCost += Number(w.actualCost) || 0;
      }
    });
    const totalActualCost = Object.values(categoryCount).reduce((sum, d) => sum + d.actualCost, 0);
    return Object.entries(categoryCount)
      .map(([catId, data], index) => ({
        id: parseInt(catId),
        name: categoryMap[parseInt(catId)] || `فئة ${catId}`,
        count: data.count,
        cost: data.cost,
        actualCost: data.actualCost,
        percentage: totalActualCost > 0 ? (data.actualCost / totalActualCost * 100) : 0,
        color: CHART_COLORS[index % CHART_COLORS.length],
      }))
      .sort((a, b) => b.actualCost - a.actualCost);
  }, [workItemsByProject, categoryMap]);

  const workItemsStatusData = useMemo(() => {
    const statusCount: Record<string, number> = {};
    workItemsByProject.forEach(w => {
      statusCount[w.status] = (statusCount[w.status] || 0) + 1;
    });
    return Object.entries(statusCount).map(([status, count], index) => ({
      name: WORK_STATUS_LABELS[status] || status,
      value: count,
      color: CHART_COLORS[index % CHART_COLORS.length],
    }));
  }, [workItemsByProject]);

  const projectWorkItemsSummary = useMemo(() => {
    return filteredProjects.map(project => {
      const projectItems = workItems.filter(w => w.projectId === project.id);
      const totalCost = projectItems.reduce((sum, w) => sum + (Number(w.actualCost) || 0), 0);
      const completedItems = projectItems.filter(w => w.status === "completed").length;
      const categoryBreakdown: Record<string, { count: number; cost: number }> = {};
      projectItems.forEach(w => {
        const catName = w.categoryId ? (categoryMap[w.categoryId] || `فئة ${w.categoryId}`) : "غير محدد";
        if (!categoryBreakdown[catName]) {
          categoryBreakdown[catName] = { count: 0, cost: 0 };
        }
        categoryBreakdown[catName].count += 1;
        categoryBreakdown[catName].cost += Number(w.actualCost) || 0;
      });
      return {
        projectId: project.id,
        projectName: project.title,
        branchName: branchMap[project.branchId] || project.branchId,
        totalItems: projectItems.length,
        completedItems,
        totalCost,
        categoryBreakdown,
      };
    });
  }, [filteredProjects, workItems, categoryMap, branchMap]);

  const selectedCategoryItems = useMemo(() => {
    if (selectedCategoryId === null) return [];
    return workItemsByProject
      .filter(w => w.categoryId === selectedCategoryId)
      .sort((a, b) => (Number(b.actualCost) || 0) - (Number(a.actualCost) || 0));
  }, [workItemsByProject, selectedCategoryId]);

  const selectedCategoryInfo = useMemo(() => {
    if (selectedCategoryId === null) return null;
    return workItemsByCategoryData.find(c => c.id === selectedCategoryId);
  }, [workItemsByCategoryData, selectedCategoryId]);

  const exportCategoryDetailsToPDF = () => {
    if (!selectedCategoryInfo || selectedCategoryItems.length === 0) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const totalCost = selectedCategoryInfo.actualCost;
    const itemsCount = selectedCategoryInfo.count;
    const percentage = selectedCategoryInfo.percentage;

    const tableRows = selectedCategoryItems.map((item, index) => `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${index + 1}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${item.name}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: left;">${Number(item.actualCost || 0).toLocaleString()} ر.س</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${
          item.status === 'completed' ? 'مكتمل' :
          item.status === 'in_progress' ? 'قيد التنفيذ' : 'معلق'
        }</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>تفاصيل بنود: ${selectedCategoryInfo.name}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
          * { font-family: 'Cairo', sans-serif; box-sizing: border-box; }
          body { padding: 20px; background: white; direction: rtl; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #d4a853; padding-bottom: 15px; }
          .header h1 { color: #333; margin: 0 0 5px 0; font-size: 22px; }
          .header p { color: #666; margin: 0; font-size: 12px; }
          .summary { display: flex; justify-content: space-around; margin-bottom: 20px; gap: 15px; }
          .summary-card { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; flex: 1; border: 1px solid #e9ecef; }
          .summary-card .value { font-size: 20px; font-weight: bold; color: #d4a853; }
          .summary-card .label { font-size: 12px; color: #666; margin-top: 5px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th { background: #d4a853; color: white; padding: 10px; text-align: right; border: 1px solid #d4a853; }
          tr:nth-child(even) { background: #f8f9fa; }
          .footer { margin-top: 20px; text-align: center; font-size: 11px; color: #999; border-top: 1px solid #eee; padding-top: 10px; }
          @media print { body { padding: 10px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>تفاصيل بنود: ${selectedCategoryInfo.name}</h1>
          <p>تاريخ التقرير: ${new Date().toLocaleDateString('en-GB')}</p>
        </div>
        <div class="summary">
          <div class="summary-card">
            <div class="value">${totalCost.toLocaleString()} ر.س</div>
            <div class="label">إجمالي التكلفة</div>
          </div>
          <div class="summary-card">
            <div class="value">${itemsCount}</div>
            <div class="label">عدد البنود</div>
          </div>
          <div class="summary-card">
            <div class="value">${percentage.toFixed(1)}%</div>
            <div class="label">من إجمالي المشروع</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 50px;">#</th>
              <th>البيان</th>
              <th style="width: 120px;">التكلفة</th>
              <th style="width: 100px;">الحالة</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
          <tfoot>
            <tr style="background: #f0f0f0; font-weight: bold;">
              <td colspan="2" style="padding: 10px; border: 1px solid #ddd;">الإجمالي</td>
              <td style="padding: 10px; border: 1px solid #ddd; text-align: left;">${totalCost.toLocaleString()} ر.س</td>
              <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${itemsCount} بند</td>
            </tr>
          </tfoot>
        </table>
        <div class="footer">
          نظام إدارة المشروعات والأصول والصيانة - باتر
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  const exportToExcel = () => {
    const projectsData = filteredProjects.map(project => ({
      "الفرع": branchMap[project.branchId] || project.branchId,
      "اسم المشروع": project.title,
      "الوصف": project.description || "",
      "الحالة": STATUS_LABELS[project.status] || project.status,
      "الميزانية": Number(project.budget) || 0,
      "نسبة الإنجاز": `${project.progressPercent || 0}%`,
      "تاريخ البدء": project.startDate || "-",
      "تاريخ الانتهاء المتوقع": project.targetCompletionDate || "-",
      "ملاحظات": project.notes || "",
    }));

    const branchSummary = branchComparisonData.map(branch => ({
      "الفرع": branch.name,
      "إجمالي المشاريع": branch.total,
      "مكتملة": branch.completed,
      "قيد التنفيذ": branch.inProgress,
      "إجمالي الميزانية": branch.budget,
      "متوسط التقدم": `${branch.avgProgress}%`,
    }));

    const workItemsData = filteredWorkItems.map((item, index) => ({
      "#": index + 1,
      "البيان": item.name,
      "الفئة": item.categoryId ? categoryMap[item.categoryId] || '-' : '-',
      "المقاول": item.contractorId ? contractorMap[item.contractorId] || '-' : '-',
      "التكلفة التقديرية": Number(item.costEstimate) || 0,
      "التكلفة الفعلية": Number(item.actualCost) || 0,
      "الحالة": WORK_STATUS_LABELS[item.status] || item.status,
    }));

    const categorySummary = workItemsByCategoryData.map((cat, index) => ({
      "#": index + 1,
      "الفئة": cat.name,
      "عدد البنود": cat.count,
      "إجمالي التكلفة": cat.actualCost,
      "النسبة المئوية": `${cat.percentage.toFixed(1)}%`,
    }));

    const filterInfo = [{
      "تاريخ التقرير": new Date().toLocaleDateString("ar-SA"),
      "الفرع": selectedBranch === "all" ? "جميع الفروع" : branchMap[selectedBranch] || selectedBranch,
      "الفئة": selectedCategory === "all" ? "جميع الفئات" : categoryMap[parseInt(selectedCategory)] || selectedCategory,
      "المقاول": selectedContractor === "all" ? "جميع المقاولين" : contractorMap[parseInt(selectedContractor)] || selectedContractor,
      "الحالة": selectedStatus === "all" ? "جميع الحالات" : WORK_STATUS_LABELS[selectedStatus] || selectedStatus,
      "البحث": searchQuery || "-",
      "نطاق التكلفة": minCost || maxCost ? `${minCost || 0} - ${maxCost || "∞"}` : "غير محدد",
      "عدد البنود المفلترة": filteredWorkItems.length,
      "إجمالي التكلفة": filteredWorkItemsStats.totalCost,
    }];

    const wb = XLSX.utils.book_new();

    const filterWs = XLSX.utils.json_to_sheet(filterInfo);
    XLSX.utils.book_append_sheet(wb, filterWs, "معلومات التقرير");
    
    const projectsWs = XLSX.utils.json_to_sheet(projectsData);
    XLSX.utils.book_append_sheet(wb, projectsWs, "المشاريع");

    const summaryWs = XLSX.utils.json_to_sheet(branchSummary);
    XLSX.utils.book_append_sheet(wb, summaryWs, "ملخص الفروع");

    const workItemsWs = XLSX.utils.json_to_sheet(workItemsData);
    XLSX.utils.book_append_sheet(wb, workItemsWs, "البنود المفلترة");

    const categoryWs = XLSX.utils.json_to_sheet(categorySummary);
    XLSX.utils.book_append_sheet(wb, categoryWs, "ملخص الفئات");

    XLSX.writeFile(wb, `تقرير_المشاريع_${new Date().toLocaleDateString("ar-SA")}.xlsx`);
  };

  return (
    <Layout>
      <div className="space-y-6" dir="rtl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">تقارير المشاريع الإنشائية</h1>
            <p className="text-muted-foreground">مقارنة وتحليل المشاريع والبنود والفئات</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => handlePrint()} data-testid="button-print">
              <Printer className="w-4 h-4 ml-2" />
              طباعة
            </Button>
            <Button onClick={exportToExcel} data-testid="button-export-excel">
              <FileSpreadsheet className="w-4 h-4 ml-2" />
              تصدير Excel
            </Button>
          </div>
        </div>

        <Card className="border-amber-200 bg-amber-50/30">
          <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-amber-50/50 transition-colors py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Filter className="w-5 h-5 text-amber-600" />
                    <CardTitle className="text-lg">الفلاتر والبحث</CardTitle>
                    {activeFiltersCount > 0 && (
                      <Badge className="bg-amber-500">{activeFiltersCount} فلتر نشط</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {activeFiltersCount > 0 && (
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); clearAllFilters(); }}>
                        <X className="w-4 h-4 ml-1" />
                        مسح الكل
                      </Button>
                    )}
                    {filtersOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-4">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="البحث في البنود..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pr-10"
                    data-testid="input-search"
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>الفرع</Label>
                    <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                      <SelectTrigger data-testid="select-branch-filter">
                        <SelectValue placeholder="جميع الفروع" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">جميع الفروع</SelectItem>
                        {branches.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>الفئة</Label>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger data-testid="select-category-filter">
                        <SelectValue placeholder="جميع الفئات" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">جميع الفئات</SelectItem>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id.toString()}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>المقاول</Label>
                    <Select value={selectedContractor} onValueChange={setSelectedContractor}>
                      <SelectTrigger data-testid="select-contractor-filter">
                        <SelectValue placeholder="جميع المقاولين" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">جميع المقاولين</SelectItem>
                        {contractors.map((c) => (
                          <SelectItem key={c.id} value={c.id.toString()}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>حالة البند</Label>
                    <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                      <SelectTrigger data-testid="select-status-filter">
                        <SelectValue placeholder="جميع الحالات" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">جميع الحالات</SelectItem>
                        <SelectItem value="pending">معلق</SelectItem>
                        <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
                        <SelectItem value="completed">مكتمل</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>الحد الأدنى للتكلفة (ر.س)</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={minCost}
                      onChange={(e) => setMinCost(e.target.value)}
                      data-testid="input-min-cost"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>الحد الأقصى للتكلفة (ر.س)</Label>
                    <Input
                      type="number"
                      placeholder="غير محدد"
                      value={maxCost}
                      onChange={(e) => setMaxCost(e.target.value)}
                      data-testid="input-max-cost"
                    />
                  </div>
                </div>

                {activeFiltersCount > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t">
                    <span className="text-sm text-muted-foreground">الفلاتر النشطة:</span>
                    {selectedBranch !== "all" && (
                      <Badge variant="secondary" className="gap-1">
                        {branchMap[selectedBranch]}
                        <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedBranch("all")} />
                      </Badge>
                    )}
                    {selectedCategory !== "all" && (
                      <Badge variant="secondary" className="gap-1">
                        {categoryMap[parseInt(selectedCategory)]}
                        <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedCategory("all")} />
                      </Badge>
                    )}
                    {selectedContractor !== "all" && (
                      <Badge variant="secondary" className="gap-1">
                        {contractorMap[parseInt(selectedContractor)]}
                        <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedContractor("all")} />
                      </Badge>
                    )}
                    {selectedStatus !== "all" && (
                      <Badge variant="secondary" className="gap-1">
                        {WORK_STATUS_LABELS[selectedStatus]}
                        <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedStatus("all")} />
                      </Badge>
                    )}
                    {searchQuery.trim() && (
                      <Badge variant="secondary" className="gap-1">
                        بحث: {searchQuery}
                        <X className="w-3 h-3 cursor-pointer" onClick={() => setSearchQuery("")} />
                      </Badge>
                    )}
                    {(minCost || maxCost) && (
                      <Badge variant="secondary" className="gap-1">
                        التكلفة: {minCost || 0} - {maxCost || "∞"}
                        <X className="w-3 h-3 cursor-pointer" onClick={() => { setMinCost(""); setMaxCost(""); }} />
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        <div ref={printRef} className="space-y-6 print:p-4">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">المشاريع</CardTitle>
                <Hammer className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{filteredProjects.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">قيد التنفيذ</CardTitle>
                <Clock className="w-4 h-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{filteredProjects.filter(p => p.status === "in_progress").length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">البنود (مفلترة)</CardTitle>
                <Search className="w-4 h-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{filteredWorkItemsStats.count}</div>
                <p className="text-xs text-muted-foreground">من {workItemsByProject.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">إجمالي التكاليف</CardTitle>
                <DollarSign className="w-4 h-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">
                  {filteredWorkItemsStats.totalCost.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">ر.س</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">متوسط التكلفة</CardTitle>
                <TrendingUp className="w-4 h-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {filteredWorkItemsStats.avgCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                <p className="text-xs text-muted-foreground">ر.س / بند</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">الميزانية</CardTitle>
                <Building2 className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {filteredProjects.reduce((sum, p) => sum + (Number(p.budget) || 0), 0).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">ر.س</p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="search" className="print:hidden">
            <TabsList data-testid="tabs-report-type">
              <TabsTrigger value="search" data-testid="tab-search">
                <Search className="w-4 h-4 ml-1" />
                البحث في البنود
              </TabsTrigger>
              <TabsTrigger value="comparison" data-testid="tab-comparison">مقارنة المشاريع</TabsTrigger>
              <TabsTrigger value="branches" data-testid="tab-branches">مقارنة الفروع</TabsTrigger>
              <TabsTrigger value="workitems" data-testid="tab-workitems">البنود والفئات</TabsTrigger>
              <TabsTrigger value="details" data-testid="tab-details">تفاصيل المشاريع</TabsTrigger>
            </TabsList>

            <TabsContent value="search" className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>نتائج البحث ({filteredWorkItems.length} بند)</CardTitle>
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">ترتيب حسب:</Label>
                      <Select value={sortField} onValueChange={setSortField}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="actualCost">التكلفة</SelectItem>
                          <SelectItem value="name">الاسم</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setSortDirection(d => d === "asc" ? "desc" : "asc")}
                      >
                        {sortDirection === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>البيان</TableHead>
                          <TableHead>الفئة</TableHead>
                          <TableHead>المقاول</TableHead>
                          <TableHead className="w-32">التكلفة</TableHead>
                          <TableHead className="w-24">الحالة</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredWorkItems.slice(0, 100).map((item, index) => (
                          <TableRow key={item.id} data-testid={`row-workitem-${item.id}`}>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell className="max-w-md">
                              <div className="truncate" title={item.name}>
                                {searchQuery && item.name.toLowerCase().includes(searchQuery.toLowerCase()) ? (
                                  <HighlightText text={item.name} highlight={searchQuery} />
                                ) : item.name}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {item.categoryId ? categoryMap[item.categoryId] || '-' : '-'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {item.contractorId ? contractorMap[item.contractorId] || '-' : '-'}
                            </TableCell>
                            <TableCell className="font-bold text-amber-600">
                              {Number(item.actualCost || 0).toLocaleString()} ر.س
                            </TableCell>
                            <TableCell>
                              <Badge className={
                                item.status === 'completed' ? 'bg-green-100 text-green-800' :
                                item.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }>
                                {WORK_STATUS_LABELS[item.status] || item.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {filteredWorkItems.length > 100 && (
                      <div className="text-center py-4 text-muted-foreground">
                        يتم عرض أول 100 نتيجة من {filteredWorkItems.length}
                      </div>
                    )}
                  </ScrollArea>
                  {filteredWorkItems.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">لا توجد بنود تطابق معايير البحث</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="comparison" className="mt-4 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>مقارنة ميزانيات المشاريع</CardTitle>
                </CardHeader>
                <CardContent>
                  {projectComparisonData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={projectComparisonData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`} />
                        <YAxis dataKey="name" type="category" width={150} />
                        <Tooltip 
                          formatter={(value: number) => `${value.toLocaleString()} ر.س`}
                          labelFormatter={(label) => {
                            const item = projectComparisonData.find(d => d.name === label);
                            return item?.fullName || label;
                          }}
                        />
                        <Bar dataKey="budget" fill="#f59e0b" name="الميزانية" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">لا توجد مشاريع للعرض</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>مقارنة نسب التقدم</CardTitle>
                </CardHeader>
                <CardContent>
                  {projectComparisonData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={projectComparisonData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                        <YAxis dataKey="name" type="category" width={150} />
                        <Tooltip formatter={(value: number) => `${value}%`} />
                        <Bar dataKey="progress" fill="#22c55e" name="نسبة التقدم" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">لا توجد مشاريع للعرض</div>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>توزيع المشاريع حسب الحالة</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {statusSummary.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={statusSummary}
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            dataKey="value"
                            label={({ name, value }) => `${name}: ${value}`}
                          >
                            {statusSummary.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">لا توجد بيانات</div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>المقاولون المسجلون</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {contractors.slice(0, 5).map((contractor) => (
                        <div key={contractor.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium">{contractor.name}</p>
                            <p className="text-sm text-muted-foreground">{contractor.specialization || "غير محدد"}</p>
                          </div>
                          {contractor.rating && (
                            <Badge variant="secondary">{contractor.rating}/5</Badge>
                          )}
                        </div>
                      ))}
                      {contractors.length === 0 && (
                        <p className="text-center text-muted-foreground py-4">لا يوجد مقاولون</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="branches" className="mt-4 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>مقارنة المشاريع بين الفروع</CardTitle>
                </CardHeader>
                <CardContent>
                  {branchComparisonData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={branchComparisonData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="total" fill="#3b82f6" name="إجمالي المشاريع" />
                        <Bar dataKey="completed" fill="#22c55e" name="مكتملة" />
                        <Bar dataKey="inProgress" fill="#f59e0b" name="قيد التنفيذ" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">لا توجد بيانات</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>ملخص الفروع</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الفرع</TableHead>
                        <TableHead>عدد المشاريع</TableHead>
                        <TableHead>مكتملة</TableHead>
                        <TableHead>قيد التنفيذ</TableHead>
                        <TableHead>إجمالي الميزانية</TableHead>
                        <TableHead>متوسط التقدم</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {branchComparisonData.map((branch) => (
                        <TableRow key={branch.name}>
                          <TableCell className="font-medium">{branch.name}</TableCell>
                          <TableCell>{branch.total}</TableCell>
                          <TableCell>
                            <Badge className="bg-green-100 text-green-800">{branch.completed}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-yellow-100 text-yellow-800">{branch.inProgress}</Badge>
                          </TableCell>
                          <TableCell>{branch.budget.toLocaleString()} ر.س</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={branch.avgProgress} className="w-16" />
                              <span>{branch.avgProgress}%</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="workitems" className="mt-4 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>تفصيل التكاليف حسب الفئة</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>الفئة</TableHead>
                        <TableHead>عدد البنود</TableHead>
                        <TableHead>إجمالي التكلفة</TableHead>
                        <TableHead>النسبة</TableHead>
                        <TableHead className="w-32">التوزيع</TableHead>
                        <TableHead className="w-24">التفاصيل</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {workItemsByCategoryData.map((cat, index) => (
                        <TableRow key={cat.id} data-testid={`row-category-${cat.id}`} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedCategoryId(cat.id)}>
                          <TableCell className="font-medium">{index + 1}</TableCell>
                          <TableCell className="font-medium">{cat.name}</TableCell>
                          <TableCell>{cat.count}</TableCell>
                          <TableCell className="font-bold text-amber-600">{cat.actualCost.toLocaleString()} ر.س</TableCell>
                          <TableCell>{cat.percentage.toFixed(1)}%</TableCell>
                          <TableCell>
                            <Progress value={cat.percentage} className="w-24" />
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedCategoryId(cat.id); }}>
                              <Eye className="w-4 h-4 ml-1" />
                              عرض
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {workItemsByCategoryData.length > 0 && (
                        <TableRow className="bg-muted/50 font-bold">
                          <TableCell></TableCell>
                          <TableCell>الإجمالي</TableCell>
                          <TableCell>{workItemsByCategoryData.reduce((sum, c) => sum + c.count, 0)}</TableCell>
                          <TableCell className="text-amber-600">{workItemsByCategoryData.reduce((sum, c) => sum + c.actualCost, 0).toLocaleString()} ر.س</TableCell>
                          <TableCell>100%</TableCell>
                          <TableCell></TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                  {workItemsByCategoryData.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">لا توجد بنود عمل</p>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>توزيع التكاليف حسب الفئة</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {workItemsByCategoryData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={350}>
                        <PieChart>
                          <Pie
                            data={workItemsByCategoryData}
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            dataKey="actualCost"
                            label={({ name, percentage }) => `${name}: ${percentage.toFixed(1)}%`}
                          >
                            {workItemsByCategoryData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => `${value.toLocaleString()} ر.س`} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">لا توجد بنود عمل</div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>حالة بنود العمل</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {workItemsStatusData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={350}>
                        <PieChart>
                          <Pie
                            data={workItemsStatusData}
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            dataKey="value"
                            label={({ name, value }) => `${name}: ${value}`}
                          >
                            {workItemsStatusData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">لا توجد بنود عمل</div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>مقارنة التكاليف بين الفئات</CardTitle>
                </CardHeader>
                <CardContent>
                  {workItemsByCategoryData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={workItemsByCategoryData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`} />
                        <YAxis dataKey="name" type="category" width={120} />
                        <Tooltip formatter={(value: number) => `${value.toLocaleString()} ر.س`} />
                        <Bar dataKey="actualCost" fill="#f59e0b" name="التكلفة الفعلية" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">لا توجد بنود عمل</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>ملخص البنود لكل مشروع</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>المشروع</TableHead>
                        <TableHead>الفرع</TableHead>
                        <TableHead>إجمالي البنود</TableHead>
                        <TableHead>المكتملة</TableHead>
                        <TableHead>التكلفة التقديرية</TableHead>
                        <TableHead>توزيع الفئات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {projectWorkItemsSummary.map((summary) => (
                        <TableRow key={summary.projectId} data-testid={`row-workitems-${summary.projectId}`}>
                          <TableCell className="font-medium">{summary.projectName}</TableCell>
                          <TableCell>{summary.branchName}</TableCell>
                          <TableCell>{summary.totalItems}</TableCell>
                          <TableCell>
                            <Badge className="bg-green-100 text-green-800">{summary.completedItems}</Badge>
                          </TableCell>
                          <TableCell>{summary.totalCost.toLocaleString()} ر.س</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(summary.categoryBreakdown)
                                .sort((a, b) => b[1].cost - a[1].cost)
                                .slice(0, 3)
                                .map(([cat, data]) => (
                                <Badge key={cat} variant="outline" className="text-xs">
                                  {cat}: {data.cost.toLocaleString()} ر.س
                                </Badge>
                              ))}
                              {Object.keys(summary.categoryBreakdown).length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{Object.keys(summary.categoryBreakdown).length - 3}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {projectWorkItemsSummary.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">لا توجد مشاريع</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="details" className="mt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>تفاصيل جميع المشاريع</CardTitle>
                  <Badge variant="secondary" className="text-sm">
                    إجمالي: {filteredProjects.length} مشروع
                  </Badge>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الفرع</TableHead>
                        <TableHead>اسم المشروع</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead>الميزانية</TableHead>
                        <TableHead>نسبة الإنجاز</TableHead>
                        <TableHead>تاريخ البدء</TableHead>
                        <TableHead>تاريخ الانتهاء</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProjects.slice((currentPage - 1) * 10, currentPage * 10).map((project) => (
                        <TableRow key={project.id} data-testid={`row-project-${project.id}`}>
                          <TableCell>{branchMap[project.branchId]}</TableCell>
                          <TableCell className="font-medium">{project.title}</TableCell>
                          <TableCell>
                            <Badge className={STATUS_COLORS[project.status]}>
                              {STATUS_LABELS[project.status]}
                            </Badge>
                          </TableCell>
                          <TableCell>{Number(project.budget || 0).toLocaleString()} ر.س</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={project.progressPercent || 0} className="w-16" />
                              <span>{project.progressPercent || 0}%</span>
                            </div>
                          </TableCell>
                          <TableCell>{project.startDate || "-"}</TableCell>
                          <TableCell>{project.targetCompletionDate || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <TablePagination
                    currentPage={currentPage}
                    totalItems={filteredProjects.length}
                    itemsPerPage={10}
                    onPageChange={setCurrentPage}
                  />
                  {filteredProjects.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">لا توجد مشاريع</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="hidden print:block">
            <h2 className="text-xl font-bold mb-4">تقرير المشاريع الإنشائية - {new Date().toLocaleDateString("ar-SA")}</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الفرع</TableHead>
                  <TableHead>المشروع</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الميزانية</TableHead>
                  <TableHead>التقدم</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProjects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell>{branchMap[project.branchId]}</TableCell>
                    <TableCell>{project.title}</TableCell>
                    <TableCell>{STATUS_LABELS[project.status]}</TableCell>
                    <TableCell>{Number(project.budget || 0).toLocaleString()} ر.س</TableCell>
                    <TableCell>{project.progressPercent || 0}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <Dialog open={selectedCategoryId !== null} onOpenChange={(open) => !open && setSelectedCategoryId(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh]" dir="rtl">
            <DialogHeader className="flex flex-row items-center justify-between">
              <DialogTitle className="text-xl">
                تفاصيل بنود: {selectedCategoryInfo?.name}
              </DialogTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={exportCategoryDetailsToPDF}
                className="flex items-center gap-2"
                data-testid="button-export-category-pdf"
              >
                <FileDown className="h-4 w-4" />
                تصدير PDF
              </Button>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold text-amber-600">
                      {selectedCategoryInfo?.actualCost.toLocaleString()} ر.س
                    </div>
                    <p className="text-sm text-muted-foreground">إجمالي التكلفة</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold">
                      {selectedCategoryInfo?.count}
                    </div>
                    <p className="text-sm text-muted-foreground">عدد البنود</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold">
                      {selectedCategoryInfo?.percentage.toFixed(1)}%
                    </div>
                    <p className="text-sm text-muted-foreground">من إجمالي المشروع</p>
                  </CardContent>
                </Card>
              </div>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>البيان</TableHead>
                      <TableHead className="w-32">التكلفة</TableHead>
                      <TableHead className="w-24">الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedCategoryItems.map((item, index) => (
                      <TableRow key={item.id}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell className="max-w-md truncate" title={item.name}>{item.name}</TableCell>
                        <TableCell className="font-medium">{Number(item.actualCost || 0).toLocaleString()} ر.س</TableCell>
                        <TableCell>
                          <Badge className={
                            item.status === 'completed' ? 'bg-green-100 text-green-800' :
                            item.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }>
                            {WORK_STATUS_LABELS[item.status] || item.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
