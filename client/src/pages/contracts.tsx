import { useState, useEffect } from "react";
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
import { TablePagination } from "@/components/ui/pagination";
import { Plus, Pencil, Trash2, Loader2, FileText, Calendar, DollarSign, Eye, Building2, User } from "lucide-react";
import { Link, useLocation } from "wouter";
import type { ConstructionContract, Contractor, ConstructionProject, ConstructionCategory } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";

const contractFormSchema = z.object({
  projectId: z.coerce.number().min(1, "اختر المشروع"),
  contractorId: z.coerce.number().min(1, "اختر المقاول"),
  contractNumber: z.string().optional().nullable(),
  title: z.string().min(1, "عنوان العقد مطلوب"),
  description: z.string().optional().nullable(),
  contractType: z.string().default("fixed_price"),
  status: z.string().default("draft"),
  totalAmount: z.coerce.number().min(0, "المبلغ مطلوب"),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  paymentTerms: z.string().optional().nullable(),
  warrantyPeriod: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

type ContractFormData = z.infer<typeof contractFormSchema>;

const CONTRACT_STATUSES = [
  { value: "draft", label: "مسودة", color: "bg-gray-500" },
  { value: "active", label: "نشط", color: "bg-green-500" },
  { value: "completed", label: "مكتمل", color: "bg-blue-500" },
  { value: "suspended", label: "معلق", color: "bg-yellow-500" },
  { value: "cancelled", label: "ملغي", color: "bg-red-500" },
];

const CONTRACT_TYPES = [
  { value: "fixed_price", label: "سعر ثابت" },
  { value: "cost_plus", label: "التكلفة + نسبة" },
  { value: "unit_price", label: "سعر الوحدة" },
];

export default function ContractsPage() {
  const [, navigate] = useLocation();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<ConstructionContract | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const { canCreate, canEdit: canEditContracts, canDelete, canView } = usePermissions();
  
  const canEditContract = isAdmin || canEditContracts("contracts");
  const canCreateContract = isAdmin || canCreate("contracts");
  const canDeleteContract = isAdmin || canDelete("contracts");

  const { data: contracts = [], isLoading } = useQuery<ConstructionContract[]>({
    queryKey: ["/api/construction/contracts"],
    queryFn: async () => {
      const res = await fetch("/api/construction/contracts");
      if (!res.ok) throw new Error("Failed to fetch contracts");
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

  const { data: contractors = [] } = useQuery<Contractor[]>({
    queryKey: ["/api/construction/contractors"],
    queryFn: async () => {
      const res = await fetch("/api/construction/contractors");
      if (!res.ok) throw new Error("Failed to fetch contractors");
      return res.json();
    },
  });

  const form = useForm<ContractFormData>({
    resolver: zodResolver(contractFormSchema),
    defaultValues: {
      projectId: 0,
      contractorId: 0,
      contractNumber: "",
      title: "",
      description: "",
      contractType: "fixed_price",
      status: "draft",
      totalAmount: 0,
      startDate: "",
      endDate: "",
      paymentTerms: "",
      warrantyPeriod: "",
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ContractFormData) => {
      const res = await fetch("/api/construction/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create contract");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/construction/contracts"] });
      setIsAddOpen(false);
      form.reset();
      toast({ title: "تم إنشاء العقد بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في إنشاء العقد", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<ContractFormData> }) => {
      const res = await fetch(`/api/construction/contracts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update contract");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/construction/contracts"] });
      setIsEditOpen(false);
      setSelectedContract(null);
      toast({ title: "تم تحديث العقد بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في تحديث العقد", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/construction/contracts/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete contract");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/construction/contracts"] });
      setIsDeleteOpen(false);
      setSelectedContract(null);
      toast({ title: "تم حذف العقد بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في حذف العقد", variant: "destructive" });
    },
  });

  const onSubmit = (data: ContractFormData) => {
    createMutation.mutate(data);
  };

  const onEdit = (data: ContractFormData) => {
    if (selectedContract) {
      updateMutation.mutate({ id: selectedContract.id, data });
    }
  };

  const openEditDialog = (contract: ConstructionContract) => {
    setSelectedContract(contract);
    form.reset({
      projectId: contract.projectId,
      contractorId: contract.contractorId,
      contractNumber: contract.contractNumber || "",
      title: contract.title,
      description: contract.description || "",
      contractType: contract.contractType,
      status: contract.status,
      totalAmount: contract.totalAmount,
      startDate: contract.startDate || "",
      endDate: contract.endDate || "",
      paymentTerms: contract.paymentTerms || "",
      warrantyPeriod: contract.warrantyPeriod || "",
      notes: contract.notes || "",
    });
    setIsEditOpen(true);
  };

  const filteredContracts = contracts.filter((contract) => {
    if (statusFilter !== "all" && contract.status !== statusFilter) return false;
    if (projectFilter !== "all" && contract.projectId !== parseInt(projectFilter, 10)) return false;
    return true;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, projectFilter]);

  const getProjectName = (projectId: number) => {
    const project = projects.find((p) => p.id === projectId);
    return project?.title || "-";
  };

  const getContractorName = (contractorId: number) => {
    const contractor = contractors.find((c) => c.id === contractorId);
    return contractor?.name || "-";
  };

  const getStatusInfo = (status: string) => {
    return CONTRACT_STATUSES.find((s) => s.value === status) || CONTRACT_STATUSES[0];
  };

  const getTypeLabel = (type: string) => {
    return CONTRACT_TYPES.find((t) => t.value === type)?.label || type;
  };

  const totalContractValue = contracts.reduce((sum, c) => sum + (c.totalAmount || 0), 0);
  const totalPaid = contracts.reduce((sum, c) => sum + (c.paidAmount || 0), 0);
  const activeContractsCount = contracts.filter((c) => c.status === "active").length;

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-butter-gold" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">إدارة العقود</h1>
            <p className="text-gray-500 mt-1">إدارة عقود المقاولين والموردين</p>
          </div>
          {canCreateContract && (
            <Button
              onClick={() => {
                form.reset();
                setIsAddOpen(true);
              }}
              className="bg-butter-gold hover:bg-butter-gold/90"
              data-testid="button-add-contract"
            >
              <Plus className="ml-2 h-4 w-4" />
              إضافة عقد جديد
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">إجمالي العقود</p>
                  <p className="text-2xl font-bold">{contracts.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">قيمة العقود</p>
                  <p className="text-2xl font-bold">{totalContractValue.toLocaleString()} ر.س</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <DollarSign className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">المدفوعات</p>
                  <p className="text-2xl font-bold">{totalPaid.toLocaleString()} ر.س</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <FileText className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">العقود النشطة</p>
                  <p className="text-2xl font-bold">{activeContractsCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <Label>تصفية حسب الحالة</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger data-testid="select-status-filter">
                    <SelectValue placeholder="جميع الحالات" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الحالات</SelectItem>
                    {CONTRACT_STATUSES.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <Label>تصفية حسب المشروع</Label>
                <Select value={projectFilter} onValueChange={setProjectFilter}>
                  <SelectTrigger data-testid="select-project-filter">
                    <SelectValue placeholder="جميع المشاريع" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع المشاريع</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id.toString()}>
                        {project.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>قائمة العقود</CardTitle>
                <CardDescription>
                  عرض {filteredContracts.length} من {contracts.length} عقد
                </CardDescription>
              </div>
              <Badge variant="secondary" className="text-sm">
                إجمالي: {filteredContracts.length} عقد
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">رقم العقد</TableHead>
                    <TableHead className="text-right">العنوان</TableHead>
                    <TableHead className="text-right">المشروع</TableHead>
                    <TableHead className="text-right">المقاول</TableHead>
                    <TableHead className="text-right">النوع</TableHead>
                    <TableHead className="text-right">القيمة</TableHead>
                    <TableHead className="text-right">المدفوع</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContracts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                        لا توجد عقود
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredContracts.slice((currentPage - 1) * 10, currentPage * 10).map((contract) => {
                      const statusInfo = getStatusInfo(contract.status);
                      const paidPercent = contract.totalAmount > 0
                        ? ((contract.paidAmount || 0) / contract.totalAmount) * 100
                        : 0;
                      
                      return (
                        <TableRow key={contract.id} data-testid={`row-contract-${contract.id}`}>
                          <TableCell className="font-medium">
                            {contract.contractNumber || `#${contract.id}`}
                          </TableCell>
                          <TableCell>{contract.title}</TableCell>
                          <TableCell>
                            <Link href={`/construction/projects/${contract.projectId}`}>
                              <span className="text-blue-600 hover:underline cursor-pointer">
                                {getProjectName(contract.projectId)}
                              </span>
                            </Link>
                          </TableCell>
                          <TableCell>{getContractorName(contract.contractorId)}</TableCell>
                          <TableCell>{getTypeLabel(contract.contractType)}</TableCell>
                          <TableCell>{(contract.totalAmount || 0).toLocaleString()} ر.س</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span>{(contract.paidAmount || 0).toLocaleString()} ر.س</span>
                              <Progress value={paidPercent} className="w-16 h-2" />
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={`${statusInfo.color} text-white`}>
                              {statusInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate(`/contracts/${contract.id}`)}
                                data-testid={`button-view-contract-${contract.id}`}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {canEditContract && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEditDialog(contract)}
                                  data-testid={`button-edit-contract-${contract.id}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                              {canDeleteContract && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setSelectedContract(contract);
                                    setIsDeleteOpen(true);
                                  }}
                                  data-testid={`button-delete-contract-${contract.id}`}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
            <TablePagination
              currentPage={currentPage}
              totalItems={filteredContracts.length}
              itemsPerPage={10}
              onPageChange={setCurrentPage}
            />
          </CardContent>
        </Card>
      </div>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>إضافة عقد جديد</DialogTitle>
            <DialogDescription>أدخل بيانات العقد</DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>المشروع *</Label>
                <Select
                  value={form.watch("projectId")?.toString() || ""}
                  onValueChange={(val) => form.setValue("projectId", parseInt(val, 10))}
                >
                  <SelectTrigger data-testid="select-project">
                    <SelectValue placeholder="اختر المشروع" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id.toString()}>
                        {project.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.projectId && (
                  <p className="text-sm text-red-500">{form.formState.errors.projectId.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>المقاول *</Label>
                <Select
                  value={form.watch("contractorId")?.toString() || ""}
                  onValueChange={(val) => form.setValue("contractorId", parseInt(val, 10))}
                >
                  <SelectTrigger data-testid="select-contractor">
                    <SelectValue placeholder="اختر المقاول" />
                  </SelectTrigger>
                  <SelectContent>
                    {contractors.map((contractor) => (
                      <SelectItem key={contractor.id} value={contractor.id.toString()}>
                        {contractor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.contractorId && (
                  <p className="text-sm text-red-500">{form.formState.errors.contractorId.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>رقم العقد</Label>
                <Input {...form.register("contractNumber")} placeholder="مثال: C-2024-001" data-testid="input-contract-number" />
              </div>
              <div className="space-y-2">
                <Label>عنوان العقد *</Label>
                <Input {...form.register("title")} placeholder="عنوان العقد" data-testid="input-title" />
                {form.formState.errors.title && (
                  <p className="text-sm text-red-500">{form.formState.errors.title.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>نوع العقد</Label>
                <Select
                  value={form.watch("contractType")}
                  onValueChange={(val) => form.setValue("contractType", val)}
                >
                  <SelectTrigger data-testid="select-contract-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTRACT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>الحالة</Label>
                <Select
                  value={form.watch("status")}
                  onValueChange={(val) => form.setValue("status", val)}
                >
                  <SelectTrigger data-testid="select-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTRACT_STATUSES.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>قيمة العقد (ر.س) *</Label>
              <Input
                type="number"
                step="0.01"
                {...form.register("totalAmount")}
                placeholder="0.00"
                data-testid="input-total-amount"
              />
              {form.formState.errors.totalAmount && (
                <p className="text-sm text-red-500">{form.formState.errors.totalAmount.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>تاريخ البداية</Label>
                <Input type="date" {...form.register("startDate")} data-testid="input-start-date" />
              </div>
              <div className="space-y-2">
                <Label>تاريخ النهاية</Label>
                <Input type="date" {...form.register("endDate")} data-testid="input-end-date" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>شروط الدفع</Label>
                <Input {...form.register("paymentTerms")} placeholder="مثال: 30 يوم" data-testid="input-payment-terms" />
              </div>
              <div className="space-y-2">
                <Label>فترة الضمان</Label>
                <Input {...form.register("warrantyPeriod")} placeholder="مثال: سنة" data-testid="input-warranty" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>الوصف</Label>
              <Textarea {...form.register("description")} placeholder="وصف العقد" data-testid="input-description" />
            </div>

            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Textarea {...form.register("notes")} placeholder="ملاحظات إضافية" data-testid="input-notes" />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                إلغاء
              </Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit">
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "إضافة العقد"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تعديل العقد</DialogTitle>
            <DialogDescription>تعديل بيانات العقد</DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onEdit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>المشروع *</Label>
                <Select
                  value={form.watch("projectId")?.toString() || ""}
                  onValueChange={(val) => form.setValue("projectId", parseInt(val, 10))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر المشروع" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id.toString()}>
                        {project.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>المقاول *</Label>
                <Select
                  value={form.watch("contractorId")?.toString() || ""}
                  onValueChange={(val) => form.setValue("contractorId", parseInt(val, 10))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر المقاول" />
                  </SelectTrigger>
                  <SelectContent>
                    {contractors.map((contractor) => (
                      <SelectItem key={contractor.id} value={contractor.id.toString()}>
                        {contractor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>رقم العقد</Label>
                <Input {...form.register("contractNumber")} />
              </div>
              <div className="space-y-2">
                <Label>عنوان العقد *</Label>
                <Input {...form.register("title")} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>نوع العقد</Label>
                <Select
                  value={form.watch("contractType")}
                  onValueChange={(val) => form.setValue("contractType", val)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTRACT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>الحالة</Label>
                <Select
                  value={form.watch("status")}
                  onValueChange={(val) => form.setValue("status", val)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTRACT_STATUSES.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>قيمة العقد (ر.س) *</Label>
              <Input type="number" step="0.01" {...form.register("totalAmount")} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>تاريخ البداية</Label>
                <Input type="date" {...form.register("startDate")} />
              </div>
              <div className="space-y-2">
                <Label>تاريخ النهاية</Label>
                <Input type="date" {...form.register("endDate")} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>شروط الدفع</Label>
                <Input {...form.register("paymentTerms")} />
              </div>
              <div className="space-y-2">
                <Label>فترة الضمان</Label>
                <Input {...form.register("warrantyPeriod")} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>الوصف</Label>
              <Textarea {...form.register("description")} />
            </div>

            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Textarea {...form.register("notes")} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                إلغاء
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ التعديلات"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف العقد "{selectedContract?.title}"؟ سيتم حذف جميع البيانات المرتبطة بهذا العقد.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600"
              onClick={() => selectedContract && deleteMutation.mutate(selectedContract.id)}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "حذف"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
