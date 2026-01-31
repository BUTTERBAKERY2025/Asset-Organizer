import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Shield,
  Plus,
  ChevronLeft,
  Search,
  Edit,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  Calendar,
  FileText,
  RefreshCw,
  Eye,
  Download,
  Bell,
  ClipboardCheck,
  ListChecks,
  TrendingUp,
  Building2,
  Scale,
  Gavel,
} from "lucide-react";
import type { ComplianceRequirement } from "@shared/schema";
import { exportToExcel, exportToCSV, printAsPDF } from "@/lib/export-utils";

const complianceCategories = [
  { value: "license", label: "ترخيص", icon: Building2 },
  { value: "registration", label: "تسجيل", icon: FileText },
  { value: "permit", label: "تصريح", icon: ClipboardCheck },
  { value: "certification", label: "شهادة", icon: CheckCircle },
  { value: "report", label: "تقرير", icon: FileText },
  { value: "filing", label: "إيداع", icon: Scale },
];

const frequencies = [
  { value: "one_time", label: "مرة واحدة" },
  { value: "annual", label: "سنوي" },
  { value: "semi_annual", label: "نصف سنوي" },
  { value: "quarterly", label: "ربع سنوي" },
  { value: "monthly", label: "شهري" },
  { value: "as_needed", label: "عند الحاجة" },
];

const complianceStatuses = [
  { value: "valid", label: "ساري", color: "bg-green-100 text-green-800", icon: CheckCircle },
  { value: "expiring_soon", label: "قارب الانتهاء", color: "bg-yellow-100 text-yellow-800", icon: AlertTriangle },
  { value: "expired", label: "منتهي", color: "bg-red-100 text-red-800", icon: XCircle },
  { value: "under_renewal", label: "قيد التجديد", color: "bg-blue-100 text-blue-800", icon: RefreshCw },
  { value: "pending", label: "معلق", color: "bg-gray-100 text-gray-800", icon: Clock },
];

const regulatoryBodies = [
  { value: "mci", label: "وزارة التجارة" },
  { value: "cma", label: "هيئة السوق المالية" },
  { value: "zatca", label: "هيئة الزكاة والضريبة والجمارك" },
  { value: "moj", label: "وزارة العدل" },
  { value: "mol", label: "وزارة الموارد البشرية" },
  { value: "gosi", label: "التأمينات الاجتماعية" },
  { value: "other", label: "أخرى" },
];

interface ChecklistItem {
  id: number;
  title: string;
  completed: boolean;
  dueDate: string;
}

export default function CompliancePage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRequirement, setEditingRequirement] = useState<ComplianceRequirement | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("requirements");
  const [selectedRequirement, setSelectedRequirement] = useState<ComplianceRequirement | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: requirements = [], isLoading } = useQuery<ComplianceRequirement[]>({
    queryKey: ["/api/governance/compliance"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<ComplianceRequirement>) => {
      const res = await fetch("/api/governance/compliance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create requirement");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/compliance"] });
      setIsDialogOpen(false);
      toast({ title: "تم إضافة المتطلب بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في إضافة المتطلب", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<ComplianceRequirement> }) => {
      const res = await fetch(`/api/governance/compliance/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update requirement");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/compliance"] });
      setIsDialogOpen(false);
      setEditingRequirement(null);
      toast({ title: "تم تحديث المتطلب بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في تحديث المتطلب", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const expiryDateStr = formData.get("validUntil") as string;
    const data = {
      category: formData.get("requirementType") as string,
      title: formData.get("name") as string,
      description: formData.get("description") as string,
      regulatoryBody: formData.get("regulatoryBody") as string,
      frequency: formData.get("frequency") as string,
      validUntil: expiryDateStr || undefined,
      responsiblePerson: formData.get("responsiblePerson") as string,
      documentNumber: formData.get("documentNumber") as string,
    };

    if (editingRequirement) {
      updateMutation.mutate({ id: editingRequirement.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const requirementsWithComputedStatus = requirements.map(r => ({
    ...r,
    computedStatus: r.validUntil ? (() => {
      const days = Math.ceil((new Date(r.validUntil).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      if (days < 0) return "expired";
      if (days <= 30) return "expiring_soon";
      return "valid";
    })() : (r.currentStatus || "pending")
  }));

  const filteredRequirements = requirementsWithComputedStatus.filter((r) => {
    const matchesSearch = r.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || r.computedStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const validCount = requirementsWithComputedStatus.filter(r => r.computedStatus === "valid").length;
  const expiringCount = requirementsWithComputedStatus.filter(r => r.computedStatus === "expiring_soon").length;
  const expiredCount = requirementsWithComputedStatus.filter(r => r.computedStatus === "expired").length;
  const complianceRate = requirements.length > 0 ? (validCount / requirements.length) * 100 : 0;

  const getStatusBadge = (status: string) => {
    const statusInfo = complianceStatuses.find(s => s.value === status);
    return statusInfo ? (
      <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
    ) : null;
  };

  const getDaysUntilExpiry = (expiryDate: string | Date | null) => {
    if (!expiryDate) return null;
    const expiry = new Date(expiryDate);
    const now = new Date();
    const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const checklistItems: ChecklistItem[] = [
    { id: 1, title: "تجديد السجل التجاري", completed: false, dueDate: "2026-03-15" },
    { id: 2, title: "إيداع القوائم المالية السنوية", completed: true, dueDate: "2026-02-28" },
    { id: 3, title: "تقديم إقرار الزكاة السنوي", completed: false, dueDate: "2026-04-30" },
    { id: 4, title: "تحديث بيانات التأمينات الاجتماعية", completed: true, dueDate: "2026-01-31" },
    { id: 5, title: "تجديد الرخصة البلدية", completed: false, dueDate: "2026-05-15" },
  ];

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-3 sm:p-4 md:p-6 space-y-4" dir="rtl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <Link href="/governance">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="p-2 sm:p-3 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl">
              <Shield className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-teal-800" data-testid="page-title">
                الامتثال والالتزام
              </h1>
              <p className="text-xs sm:text-sm text-gray-600">متابعة المتطلبات التنظيمية والتراخيص</p>
            </div>
          </div>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Download className="h-4 w-4" />
                  تصدير
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => {
                  const exportColumns = [
                    { key: "requirementNumber", header: "رقم المتطلب", width: 15 },
                    { key: "title", header: "الاسم", width: 30 },
                    { key: "category", header: "النوع", width: 12 },
                    { key: "regulatoryBody", header: "الجهة", width: 15 },
                    { key: "frequency", header: "التكرار", width: 12 },
                    { key: "validUntil", header: "تاريخ الانتهاء", width: 15 },
                    { key: "currentStatus", header: "الحالة", width: 12 },
                  ];
                  exportToExcel(filteredRequirements, exportColumns, "متطلبات_الامتثال", "الامتثال");
                }}>
                  Excel تصدير
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  const exportColumns = [
                    { key: "requirementNumber", header: "رقم المتطلب", width: 15 },
                    { key: "title", header: "الاسم", width: 30 },
                    { key: "category", header: "النوع", width: 12 },
                    { key: "regulatoryBody", header: "الجهة", width: 15 },
                    { key: "frequency", header: "التكرار", width: 12 },
                    { key: "validUntil", header: "تاريخ الانتهاء", width: 15 },
                    { key: "currentStatus", header: "الحالة", width: 12 },
                  ];
                  exportToCSV(filteredRequirements, exportColumns, "متطلبات_الامتثال");
                }}>
                  CSV تصدير
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  const exportColumns = [
                    { key: "requirementNumber", header: "رقم المتطلب", width: 15 },
                    { key: "title", header: "الاسم", width: 30 },
                    { key: "category", header: "النوع", width: 12 },
                    { key: "regulatoryBody", header: "الجهة", width: 15 },
                    { key: "frequency", header: "التكرار", width: 12 },
                    { key: "validUntil", header: "تاريخ الانتهاء", width: 15 },
                    { key: "currentStatus", header: "الحالة", width: 12 },
                  ];
                  printAsPDF(filteredRequirements, exportColumns, "متطلبات الامتثال", "سجل التراخيص والمتطلبات التنظيمية");
                }}>
                  طباعة
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" className="gap-2" onClick={() => setShowChecklist(true)}>
              <ListChecks className="h-4 w-4" />
              قائمة المراجعة
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) setEditingRequirement(null);
            }}>
              <DialogTrigger asChild>
                <Button className="gap-2 bg-teal-600 hover:bg-teal-700" data-testid="btn-add-requirement">
                  <Plus className="h-4 w-4" />
                  إضافة متطلب
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingRequirement ? "تعديل المتطلب" : "إضافة متطلب جديد"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="requirementType">نوع المتطلب *</Label>
                      <Select name="requirementType" defaultValue={editingRequirement?.category || "license"}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {complianceCategories.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="regulatoryBody">الجهة التنظيمية *</Label>
                      <Select name="regulatoryBody" defaultValue={editingRequirement?.regulatoryBody || "mci"}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {regulatoryBodies.map((body) => (
                            <SelectItem key={body.value} value={body.value}>{body.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="name">اسم المتطلب *</Label>
                      <Input id="name" name="name" defaultValue={editingRequirement?.title || ""} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="documentNumber">رقم الوثيقة</Label>
                      <Input id="documentNumber" name="documentNumber" defaultValue={editingRequirement?.documentNumber || ""} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="frequency">التكرار</Label>
                      <Select name="frequency" defaultValue={editingRequirement?.frequency || "annual"}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {frequencies.map((f) => (
                            <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="validUntil">تاريخ الانتهاء</Label>
                      <Input id="validUntil" name="validUntil" type="date" defaultValue={editingRequirement?.validUntil || ""} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="responsiblePerson">المسؤول</Label>
                      <Input id="responsiblePerson" name="responsiblePerson" defaultValue={editingRequirement?.responsiblePerson || ""} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">الوصف</Label>
                    <Textarea id="description" name="description" rows={3} defaultValue={editingRequirement?.description || ""} />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
                    <Button type="submit" className="bg-teal-600 hover:bg-teal-700">
                      {editingRequirement ? "تحديث" : "إضافة"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <Card className="bg-gradient-to-br from-teal-50 to-cyan-50 border-teal-200 col-span-2 lg:col-span-1">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-teal-600">نسبة الامتثال</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-teal-800">{complianceRate.toFixed(0)}%</p>
                </div>
                <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-teal-500" />
              </div>
              <Progress value={complianceRate} className="h-2 mt-2" />
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-green-600">سارية</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-green-800">{validCount}</p>
                </div>
                <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-yellow-600">قارب الانتهاء</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-yellow-800">{expiringCount}</p>
                </div>
                <AlertTriangle className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-50 to-rose-50 border-red-200">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-red-600">منتهية</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-red-800">{expiredCount}</p>
                </div>
                <XCircle className="h-6 w-6 sm:h-8 sm:w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-blue-600">إجمالي المتطلبات</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-blue-800">{requirements.length}</p>
                </div>
                <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {expiringCount > 0 && (
          <Card className="border-2 border-amber-300 bg-amber-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <h3 className="font-semibold text-amber-800">تنبيه: متطلبات قاربت على الانتهاء</h3>
              </div>
              <div className="grid gap-2">
                {requirementsWithComputedStatus.filter(r => r.computedStatus === "expiring_soon").map((req) => {
                  const days = getDaysUntilExpiry(req.validUntil);
                  return (
                    <div key={req.id} className="flex items-center justify-between bg-white p-3 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Shield className="h-5 w-5 text-amber-500" />
                        <span className="font-medium">{req.title}</span>
                      </div>
                      <Badge className="bg-amber-100 text-amber-800">
                        <Clock className="h-3 w-3 ml-1" />
                        {days} يوم متبقي
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="requirements" className="gap-2">
              <Shield className="h-4 w-4" />
              المتطلبات
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-2">
              <Calendar className="h-4 w-4" />
              التقويم
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-2">
              <FileText className="h-4 w-4" />
              التقارير
            </TabsTrigger>
          </TabsList>

          <TabsContent value="requirements" className="mt-6 space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="بحث بالاسم..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-10"
                  data-testid="search-input"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="جميع الحالات" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الحالات</SelectItem>
                  {complianceStatuses.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                <Table className="min-w-[700px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">المتطلب</TableHead>
                      <TableHead className="text-right hidden md:table-cell">الجهة</TableHead>
                      <TableHead className="text-right hidden lg:table-cell">النوع</TableHead>
                      <TableHead className="text-right hidden lg:table-cell">التكرار</TableHead>
                      <TableHead className="text-right">تاريخ الانتهاء</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-right">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                          جاري التحميل...
                        </TableCell>
                      </TableRow>
                    ) : filteredRequirements.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                          لا يوجد متطلبات
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRequirements.map((req) => {
                        const days = getDaysUntilExpiry(req.validUntil);
                        const isExpiring = days !== null && days > 0 && days <= 30;
                        return (
                          <TableRow key={req.id} className={isExpiring ? "bg-amber-50" : ""} data-testid={`requirement-row-${req.id}`}>
                            <TableCell>
                              <div>
                                <p className="font-medium text-sm sm:text-base">{req.title}</p>
                                {req.documentNumber && (
                                  <p className="text-xs sm:text-sm text-gray-500">{req.documentNumber}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-xs sm:text-sm">
                              {regulatoryBodies.find(b => b.value === req.regulatoryBody)?.label}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              <Badge variant="outline" className="text-[10px] sm:text-xs">
                                {complianceCategories.find(c => c.value === req.category)?.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell text-xs sm:text-sm">
                              {frequencies.find(f => f.value === req.frequency)?.label}
                            </TableCell>
                            <TableCell>
                              {req.validUntil ? (
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
                                  <span className={`text-xs sm:text-sm ${isExpiring ? "text-amber-600 font-medium" : ""}`}>{req.validUntil}</span>
                                </div>
                              ) : "-"}
                              {isExpiring && days !== null && (
                                <Badge className="mt-1 bg-amber-100 text-amber-800 text-[10px] sm:text-xs">
                                  {days} يوم
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(req.computedStatus)}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 sm:h-8 sm:w-8"
                                  onClick={() => {
                                    setSelectedRequirement(req);
                                    setShowDetails(true);
                                  }}
                                >
                                  <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 sm:h-8 sm:w-8"
                                  onClick={() => {
                                    setEditingRequirement(req);
                                    setIsDialogOpen(true);
                                  }}
                                  data-testid={`edit-requirement-${req.id}`}
                                >
                                  <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="calendar" className="mt-6">
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <Calendar className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium mb-2">تقويم المواعيد</h3>
                <p>عرض تقويمي لمواعيد انتهاء المتطلبات والإجراءات القادمة</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-teal-100 rounded-lg">
                      <FileText className="h-6 w-6 text-teal-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">تقرير حالة الامتثال</h3>
                      <p className="text-sm text-gray-500">ملخص شامل لجميع المتطلبات</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-amber-100 rounded-lg">
                      <AlertTriangle className="h-6 w-6 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">تقرير المخاطر</h3>
                      <p className="text-sm text-gray-500">المتطلبات المنتهية أو القريبة</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <TrendingUp className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">تقرير الأداء</h3>
                      <p className="text-sm text-gray-500">تحليل معدلات الامتثال</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-purple-100 rounded-lg">
                      <Gavel className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">تقرير الجهات التنظيمية</h3>
                      <p className="text-sm text-gray-500">تجميع حسب الجهة المنظمة</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={showDetails} onOpenChange={setShowDetails}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>تفاصيل المتطلب</DialogTitle>
            </DialogHeader>
            {selectedRequirement && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">
                    {complianceCategories.find(c => c.value === selectedRequirement.category)?.label}
                  </Badge>
                  {getStatusBadge(selectedRequirement.currentStatus || "pending")}
                </div>
                
                <h2 className="text-xl font-bold">{selectedRequirement.title}</h2>
                
                {selectedRequirement.description && (
                  <p className="text-gray-600">{selectedRequirement.description}</p>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-500">الجهة التنظيمية</p>
                    <p className="font-medium">{regulatoryBodies.find(b => b.value === selectedRequirement.regulatoryBody)?.label}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-500">التكرار</p>
                    <p className="font-medium">{frequencies.find(f => f.value === selectedRequirement.frequency)?.label}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-500">رقم الوثيقة</p>
                    <p className="font-medium">{selectedRequirement.documentNumber || "غير محدد"}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-500">تاريخ الانتهاء</p>
                    <p className="font-medium">{selectedRequirement.validUntil || "غير محدد"}</p>
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    تجديد
                  </Button>
                  <Button variant="outline" className="gap-2">
                    <Download className="h-4 w-4" />
                    تحميل المستند
                  </Button>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDetails(false)}>إغلاق</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showChecklist} onOpenChange={setShowChecklist}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ListChecks className="h-5 w-5 text-teal-600" />
                قائمة مراجعة الامتثال
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-teal-50 p-3 rounded-lg">
                <span className="font-medium">المكتمل</span>
                <span className="font-bold text-teal-800">
                  {checklistItems.filter(i => i.completed).length} / {checklistItems.length}
                </span>
              </div>
              <Progress value={(checklistItems.filter(i => i.completed).length / checklistItems.length) * 100} className="h-3" />

              <div className="space-y-2">
                {checklistItems.map((item) => (
                  <div key={item.id} className={`flex items-center justify-between p-3 rounded-lg border ${item.completed ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
                    <div className="flex items-center gap-3">
                      <Checkbox checked={item.completed} />
                      <span className={item.completed ? "line-through text-gray-500" : "font-medium"}>{item.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        <Calendar className="h-3 w-3 ml-1" />
                        {item.dueDate}
                      </Badge>
                      {item.completed && <CheckCircle className="h-4 w-4 text-green-500" />}
                    </div>
                  </div>
                ))}
              </div>

              <Button className="w-full bg-teal-600 hover:bg-teal-700 gap-2">
                <Plus className="h-4 w-4" />
                إضافة عنصر جديد
              </Button>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowChecklist(false)}>إغلاق</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
