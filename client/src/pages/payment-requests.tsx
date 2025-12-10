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
import { 
  Plus, Pencil, Trash2, Loader2, DollarSign, CheckCircle, XCircle, 
  Clock, AlertTriangle, Wallet, CreditCard, ArrowUpCircle
} from "lucide-react";
import { Link } from "wouter";
import type { PaymentRequest, ConstructionProject, ConstructionContract, ConstructionCategory } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const paymentRequestFormSchema = z.object({
  projectId: z.coerce.number().min(1, "اختر المشروع"),
  contractId: z.coerce.number().optional().nullable(),
  requestType: z.string().min(1, "اختر نوع الطلب"),
  amount: z.coerce.number().min(1, "المبلغ مطلوب"),
  description: z.string().min(1, "الوصف مطلوب"),
  beneficiaryName: z.string().optional().nullable(),
  beneficiaryBank: z.string().optional().nullable(),
  beneficiaryIban: z.string().optional().nullable(),
  categoryId: z.coerce.number().optional().nullable(),
  priority: z.string().default("normal"),
  dueDate: z.string().optional().nullable(),
  invoiceNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

type PaymentRequestFormData = z.infer<typeof paymentRequestFormSchema>;

const REQUEST_TYPES = [
  { value: "transfer", label: "حوالة", icon: CreditCard },
  { value: "expense", label: "مصروف", icon: Wallet },
  { value: "advance", label: "سلفة", icon: ArrowUpCircle },
];

const REQUEST_STATUSES = [
  { value: "pending", label: "قيد المراجعة", color: "bg-yellow-500", icon: Clock },
  { value: "approved", label: "معتمد", color: "bg-blue-500", icon: CheckCircle },
  { value: "rejected", label: "مرفوض", color: "bg-red-500", icon: XCircle },
  { value: "paid", label: "مدفوع", color: "bg-green-500", icon: DollarSign },
];

const PRIORITIES = [
  { value: "urgent", label: "عاجل", color: "bg-red-500" },
  { value: "high", label: "مرتفع", color: "bg-orange-500" },
  { value: "normal", label: "عادي", color: "bg-blue-500" },
  { value: "low", label: "منخفض", color: "bg-gray-500" },
];

export default function PaymentRequestsPage() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<PaymentRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("all");

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin, isEmployee, user } = useAuth();
  const canEdit = isAdmin || isEmployee;
  const canApprove = isAdmin;

  const { data: requests = [], isLoading } = useQuery<PaymentRequest[]>({
    queryKey: ["/api/payment-requests"],
    queryFn: async () => {
      const res = await fetch("/api/payment-requests");
      if (!res.ok) throw new Error("Failed to fetch payment requests");
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

  const { data: contracts = [] } = useQuery<ConstructionContract[]>({
    queryKey: ["/api/construction/contracts"],
    queryFn: async () => {
      const res = await fetch("/api/construction/contracts");
      if (!res.ok) throw new Error("Failed to fetch contracts");
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

  const form = useForm<PaymentRequestFormData>({
    resolver: zodResolver(paymentRequestFormSchema),
    defaultValues: {
      projectId: 0,
      contractId: null,
      requestType: "expense",
      amount: 0,
      description: "",
      beneficiaryName: "",
      beneficiaryBank: "",
      beneficiaryIban: "",
      categoryId: null,
      priority: "normal",
      dueDate: "",
      invoiceNumber: "",
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: PaymentRequestFormData) => {
      const res = await fetch("/api/payment-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create payment request");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-requests"] });
      setIsAddOpen(false);
      form.reset();
      toast({ title: "تم إنشاء الطلب بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في إنشاء الطلب", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<PaymentRequestFormData> }) => {
      const res = await fetch(`/api/payment-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update payment request");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-requests"] });
      setIsEditOpen(false);
      setSelectedRequest(null);
      toast({ title: "تم تحديث الطلب بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في تحديث الطلب", variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/payment-requests/${id}/approve`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to approve");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-requests"] });
      toast({ title: "تم اعتماد الطلب بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في اعتماد الطلب", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      const res = await fetch(`/api/payment-requests/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error("Failed to reject");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-requests"] });
      setIsRejectOpen(false);
      setRejectionReason("");
      toast({ title: "تم رفض الطلب" });
    },
    onError: () => {
      toast({ title: "فشل في رفض الطلب", variant: "destructive" });
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/payment-requests/${id}/mark-paid`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to mark as paid");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-requests"] });
      toast({ title: "تم تسجيل الدفع بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في تسجيل الدفع", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/payment-requests/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-requests"] });
      setIsDeleteOpen(false);
      setSelectedRequest(null);
      toast({ title: "تم حذف الطلب بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في حذف الطلب", variant: "destructive" });
    },
  });

  const onSubmit = (data: PaymentRequestFormData) => {
    createMutation.mutate(data);
  };

  const onEdit = (data: PaymentRequestFormData) => {
    if (selectedRequest) {
      updateMutation.mutate({ id: selectedRequest.id, data });
    }
  };

  const openEditDialog = (request: PaymentRequest) => {
    setSelectedRequest(request);
    form.reset({
      projectId: request.projectId,
      contractId: request.contractId || null,
      requestType: request.requestType,
      amount: request.amount,
      description: request.description,
      beneficiaryName: request.beneficiaryName || "",
      beneficiaryBank: request.beneficiaryBank || "",
      beneficiaryIban: request.beneficiaryIban || "",
      categoryId: request.categoryId || null,
      priority: request.priority || "normal",
      dueDate: request.dueDate || "",
      invoiceNumber: request.invoiceNumber || "",
      notes: request.notes || "",
    });
    setIsEditOpen(true);
  };

  const getProjectName = (projectId: number) => {
    return projects.find((p) => p.id === projectId)?.title || "-";
  };

  const getStatusInfo = (status: string) => {
    return REQUEST_STATUSES.find((s) => s.value === status) || REQUEST_STATUSES[0];
  };

  const getTypeInfo = (type: string) => {
    return REQUEST_TYPES.find((t) => t.value === type) || REQUEST_TYPES[0];
  };

  const getPriorityInfo = (priority: string) => {
    return PRIORITIES.find((p) => p.value === priority) || PRIORITIES[2];
  };

  const getCategoryName = (categoryId: number | null) => {
    if (!categoryId) return "-";
    return categories.find((c) => c.id === categoryId)?.name || "-";
  };

  const filteredRequests = requests.filter((req) => {
    if (activeTab !== "all" && req.status !== activeTab) return false;
    if (statusFilter !== "all" && req.status !== statusFilter) return false;
    if (typeFilter !== "all" && req.requestType !== typeFilter) return false;
    return true;
  });

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const approvedCount = requests.filter((r) => r.status === "approved").length;
  const paidCount = requests.filter((r) => r.status === "paid").length;
  const pendingAmount = requests.filter((r) => r.status === "pending").reduce((sum, r) => sum + r.amount, 0);
  const approvedAmount = requests.filter((r) => r.status === "approved").reduce((sum, r) => sum + r.amount, 0);

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
            <h1 className="text-3xl font-bold text-gray-900">طلبات الحوالات والمصروفات</h1>
            <p className="text-gray-500 mt-1">إدارة طلبات الدفع والحوالات للمشاريع</p>
          </div>
          {canEdit && (
            <Button
              onClick={() => {
                form.reset();
                setIsAddOpen(true);
              }}
              className="bg-butter-gold hover:bg-butter-gold/90"
              data-testid="button-add-request"
            >
              <Plus className="ml-2 h-4 w-4" />
              طلب جديد
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Clock className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">قيد المراجعة</p>
                  <p className="text-2xl font-bold">{pendingCount}</p>
                  <p className="text-xs text-gray-400">{pendingAmount.toLocaleString()} ر.س</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">معتمد (بانتظار الدفع)</p>
                  <p className="text-2xl font-bold">{approvedCount}</p>
                  <p className="text-xs text-gray-400">{approvedAmount.toLocaleString()} ر.س</p>
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
                  <p className="text-sm text-gray-500">مدفوع</p>
                  <p className="text-2xl font-bold">{paidCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Wallet className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">إجمالي الطلبات</p>
                  <p className="text-2xl font-bold">{requests.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList>
            <TabsTrigger value="all">الكل ({requests.length})</TabsTrigger>
            <TabsTrigger value="pending">قيد المراجعة ({pendingCount})</TabsTrigger>
            <TabsTrigger value="approved">معتمد ({approvedCount})</TabsTrigger>
            <TabsTrigger value="paid">مدفوع ({paidCount})</TabsTrigger>
          </TabsList>
        </Tabs>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <Label>نوع الطلب</Label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger data-testid="select-type-filter">
                    <SelectValue placeholder="جميع الأنواع" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الأنواع</SelectItem>
                    {REQUEST_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
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
            <CardTitle>قائمة الطلبات</CardTitle>
            <CardDescription>
              عرض {filteredRequests.length} من {requests.length} طلب
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">#</TableHead>
                    <TableHead className="text-right">النوع</TableHead>
                    <TableHead className="text-right">المشروع</TableHead>
                    <TableHead className="text-right">الوصف</TableHead>
                    <TableHead className="text-right">المبلغ</TableHead>
                    <TableHead className="text-right">المستفيد</TableHead>
                    <TableHead className="text-right">الأولوية</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                        لا توجد طلبات
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRequests.map((request) => {
                      const statusInfo = getStatusInfo(request.status);
                      const typeInfo = getTypeInfo(request.requestType);
                      const priorityInfo = getPriorityInfo(request.priority || "normal");
                      const TypeIcon = typeInfo.icon;

                      return (
                        <TableRow key={request.id} data-testid={`row-request-${request.id}`}>
                          <TableCell className="font-medium">
                            {request.requestNumber || `#${request.id}`}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <TypeIcon className="h-4 w-4" />
                              {typeInfo.label}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Link href={`/construction/projects/${request.projectId}`}>
                              <span className="text-blue-600 hover:underline cursor-pointer">
                                {getProjectName(request.projectId)}
                              </span>
                            </Link>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {request.description}
                          </TableCell>
                          <TableCell className="font-medium">
                            {request.amount.toLocaleString()} ر.س
                          </TableCell>
                          <TableCell>{request.beneficiaryName || "-"}</TableCell>
                          <TableCell>
                            <Badge className={`${priorityInfo.color} text-white`}>
                              {priorityInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={`${statusInfo.color} text-white`}>
                              {statusInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {request.status === "pending" && canApprove && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => approveMutation.mutate(request.id)}
                                    className="text-green-600 hover:text-green-700"
                                    data-testid={`button-approve-${request.id}`}
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setSelectedRequest(request);
                                      setIsRejectOpen(true);
                                    }}
                                    className="text-red-600 hover:text-red-700"
                                    data-testid={`button-reject-${request.id}`}
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              {request.status === "approved" && canApprove && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => markPaidMutation.mutate(request.id)}
                                  className="text-green-600 hover:text-green-700"
                                  data-testid={`button-paid-${request.id}`}
                                >
                                  <DollarSign className="h-4 w-4" />
                                </Button>
                              )}
                              {request.status === "pending" && canEdit && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEditDialog(request)}
                                  data-testid={`button-edit-${request.id}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                              {request.status === "pending" && isAdmin && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setSelectedRequest(request);
                                    setIsDeleteOpen(true);
                                  }}
                                  data-testid={`button-delete-${request.id}`}
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
          </CardContent>
        </Card>
      </div>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>طلب جديد</DialogTitle>
            <DialogDescription>أدخل بيانات الطلب</DialogDescription>
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
                <Label>نوع الطلب *</Label>
                <Select
                  value={form.watch("requestType")}
                  onValueChange={(val) => form.setValue("requestType", val)}
                >
                  <SelectTrigger data-testid="select-request-type">
                    <SelectValue placeholder="اختر النوع" />
                  </SelectTrigger>
                  <SelectContent>
                    {REQUEST_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>المبلغ (ر.س) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  {...form.register("amount")}
                  placeholder="0.00"
                  data-testid="input-amount"
                />
                {form.formState.errors.amount && (
                  <p className="text-sm text-red-500">{form.formState.errors.amount.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>الأولوية</Label>
                <Select
                  value={form.watch("priority")}
                  onValueChange={(val) => form.setValue("priority", val)}
                >
                  <SelectTrigger data-testid="select-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((priority) => (
                      <SelectItem key={priority.value} value={priority.value}>
                        {priority.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>الوصف *</Label>
              <Textarea
                {...form.register("description")}
                placeholder="وصف الطلب"
                data-testid="input-description"
              />
              {form.formState.errors.description && (
                <p className="text-sm text-red-500">{form.formState.errors.description.message}</p>
              )}
            </div>

            {form.watch("requestType") === "transfer" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>اسم المستفيد</Label>
                    <Input
                      {...form.register("beneficiaryName")}
                      placeholder="اسم المستفيد"
                      data-testid="input-beneficiary-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>البنك</Label>
                    <Input
                      {...form.register("beneficiaryBank")}
                      placeholder="اسم البنك"
                      data-testid="input-beneficiary-bank"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>رقم الآيبان</Label>
                  <Input
                    {...form.register("beneficiaryIban")}
                    placeholder="SA..."
                    data-testid="input-iban"
                  />
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الفئة</Label>
                <Select
                  value={form.watch("categoryId")?.toString() || ""}
                  onValueChange={(val) => form.setValue("categoryId", val ? parseInt(val, 10) : null)}
                >
                  <SelectTrigger data-testid="select-category">
                    <SelectValue placeholder="اختر الفئة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">بدون فئة</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id.toString()}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>رقم الفاتورة</Label>
                <Input
                  {...form.register("invoiceNumber")}
                  placeholder="رقم الفاتورة"
                  data-testid="input-invoice"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>تاريخ الاستحقاق</Label>
              <Input type="date" {...form.register("dueDate")} data-testid="input-due-date" />
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
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "إرسال الطلب"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تعديل الطلب</DialogTitle>
            <DialogDescription>تعديل بيانات الطلب</DialogDescription>
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
                <Label>نوع الطلب *</Label>
                <Select
                  value={form.watch("requestType")}
                  onValueChange={(val) => form.setValue("requestType", val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر النوع" />
                  </SelectTrigger>
                  <SelectContent>
                    {REQUEST_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>المبلغ (ر.س) *</Label>
                <Input type="number" step="0.01" {...form.register("amount")} />
              </div>
              <div className="space-y-2">
                <Label>الأولوية</Label>
                <Select
                  value={form.watch("priority")}
                  onValueChange={(val) => form.setValue("priority", val)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((priority) => (
                      <SelectItem key={priority.value} value={priority.value}>
                        {priority.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>الوصف *</Label>
              <Textarea {...form.register("description")} />
            </div>

            {form.watch("requestType") === "transfer" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>اسم المستفيد</Label>
                    <Input {...form.register("beneficiaryName")} />
                  </div>
                  <div className="space-y-2">
                    <Label>البنك</Label>
                    <Input {...form.register("beneficiaryBank")} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>رقم الآيبان</Label>
                  <Input {...form.register("beneficiaryIban")} />
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الفئة</Label>
                <Select
                  value={form.watch("categoryId")?.toString() || ""}
                  onValueChange={(val) => form.setValue("categoryId", val ? parseInt(val, 10) : null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الفئة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">بدون فئة</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id.toString()}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>رقم الفاتورة</Label>
                <Input {...form.register("invoiceNumber")} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>تاريخ الاستحقاق</Label>
              <Input type="date" {...form.register("dueDate")} />
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

      <AlertDialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>رفض الطلب</AlertDialogTitle>
            <AlertDialogDescription>
              يرجى إدخال سبب الرفض
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label>سبب الرفض</Label>
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="أدخل سبب الرفض..."
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600"
              onClick={() => selectedRequest && rejectMutation.mutate({ id: selectedRequest.id, reason: rejectionReason })}
              disabled={!rejectionReason}
            >
              {rejectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "رفض"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف هذا الطلب؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600"
              onClick={() => selectedRequest && deleteMutation.mutate(selectedRequest.id)}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "حذف"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
