import { useState, useEffect } from "react";
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
  Clock, AlertTriangle, Wallet, CreditCard, ArrowUpCircle, Share2, MessageCircle, FileDown, Download,
  Search, Eye, Calendar, Building2, Filter, X, ArrowRight
} from "lucide-react";
import { Link } from "wouter";
import type { PaymentRequest, ConstructionProject, ConstructionContract, ConstructionCategory, Contractor } from "@shared/schema";
import { Switch } from "@/components/ui/switch";
import { HardHat, FileText, ExternalLink } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { generatePaymentRequestsPDF } from "@/lib/pdf-generator";

const paymentRequestFormSchema = z.object({
  projectId: z.coerce.number().min(1, "اختر المشروع"),
  contractorId: z.coerce.number().optional().nullable(),
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
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeTab, setActiveTab] = useState("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [detailsRequest, setDetailsRequest] = useState<PaymentRequest | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin, user } = useAuth();
  const { canCreate, canEdit: canEditPayments, canDelete, canApprove: canApprovePayments } = usePermissions();
  
  const canEditPayment = isAdmin || canEditPayments("payment_requests");
  const canCreatePayment = isAdmin || canCreate("payment_requests");
  const canDeletePayment = isAdmin || canDelete("payment_requests");
  const canApprovePayment = isAdmin || canApprovePayments("payment_requests");

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

  const { data: contractors = [] } = useQuery<Contractor[]>({
    queryKey: ["/api/construction/contractors"],
    queryFn: async () => {
      const res = await fetch("/api/construction/contractors");
      if (!res.ok) throw new Error("Failed to fetch contractors");
      return res.json();
    },
  });

  const { branches } = useBranches();

  const form = useForm<PaymentRequestFormData>({
    resolver: zodResolver(paymentRequestFormSchema),
    defaultValues: {
      projectId: 0,
      contractorId: null,
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
      contractorId: request.contractorId || null,
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

  const getContractorName = (contractorId: number | null | undefined) => {
    if (!contractorId) return null;
    return contractors.find((c) => c.id === contractorId)?.name || null;
  };

  const getContractTitle = (contractId: number | null | undefined) => {
    if (!contractId) return null;
    const c = contracts.find((c) => c.id === contractId);
    return c ? (c.title || `عقد رقم ${c.id}`) : null;
  };

  const watchProjectId = form.watch("projectId");
  const watchContractorId = form.watch("contractorId");
  const isLinkedToContractor = !!watchContractorId;

  const filteredContractsForForm = contracts.filter((c) => {
    if (watchContractorId && c.contractorId !== watchContractorId) return false;
    if (watchProjectId && c.projectId !== watchProjectId) return false;
    return true;
  });

  // عند تغيير المشروع: امسح contractId إذا كان لا يخص المشروع الجديد
  const handleProjectChange = (val: string) => {
    const newProjectId = parseInt(val, 10);
    form.setValue("projectId", newProjectId);
    const currentContractId = form.getValues("contractId");
    if (currentContractId) {
      const currentContract = contracts.find((c) => c.id === currentContractId);
      if (currentContract && currentContract.projectId !== newProjectId) {
        form.setValue("contractId", null);
      }
    }
  };

  const renderContractorFields = (testIdSuffix: string = "") => (
    <div className="border-2 border-dashed border-amber-300 bg-amber-50/40 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HardHat className="h-5 w-5 text-amber-700" />
          <Label className="text-base font-semibold text-amber-900">
            مرتبط بمقاول؟
          </Label>
        </div>
        <Switch
          checked={isLinkedToContractor}
          onCheckedChange={(checked) => {
            if (!checked) {
              form.setValue("contractorId", null);
              form.setValue("contractId", null);
            } else if (contractors.length > 0) {
              // اختيار افتراضي: لا شيء، فقط نُظهر الحقول
            }
          }}
          data-testid={`switch-link-contractor${testIdSuffix}`}
        />
      </div>

      {isLinkedToContractor && (
        <>
          <div className="space-y-2">
            <Label className="text-sm">المقاول *</Label>
            <Select
              value={form.watch("contractorId")?.toString() || ""}
              onValueChange={(val) => {
                const contractorId = parseInt(val, 10);
                form.setValue("contractorId", contractorId);
                // إذا كان العقد المختار لا يخص هذا المقاول → أزِله
                const currentContractId = form.getValues("contractId");
                if (currentContractId) {
                  const currentContract = contracts.find((c) => c.id === currentContractId);
                  if (currentContract && currentContract.contractorId !== contractorId) {
                    form.setValue("contractId", null);
                  }
                }
                // تعبئة تلقائية لاسم المستفيد إذا كان فارغاً
                const currentBeneficiary = form.getValues("beneficiaryName");
                if (!currentBeneficiary) {
                  const contractor = contractors.find((c) => c.id === contractorId);
                  if (contractor) form.setValue("beneficiaryName", contractor.name);
                }
              }}
            >
              <SelectTrigger data-testid={`select-contractor${testIdSuffix}`}>
                <SelectValue placeholder="اختر المقاول" />
              </SelectTrigger>
              <SelectContent className="max-h-60 overflow-y-auto">
                {contractors.length === 0 ? (
                  <div className="p-2 text-sm text-gray-500 text-center">
                    لا يوجد مقاولون مسجلون
                  </div>
                ) : (
                  contractors.map((contractor) => (
                    <SelectItem key={contractor.id} value={contractor.id.toString()}>
                      {contractor.name}
                      {contractor.specialization && (
                        <span className="text-xs text-gray-500 mr-2">
                          ({contractor.specialization})
                        </span>
                      )}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {watchContractorId && (
            <div className="space-y-2">
              <Label className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-600" />
                ربط بعقد محدد (اختياري)
              </Label>
              <Select
                value={form.watch("contractId")?.toString() || "none"}
                onValueChange={(val) =>
                  form.setValue("contractId", val === "none" ? null : parseInt(val, 10))
                }
              >
                <SelectTrigger data-testid={`select-contract${testIdSuffix}`}>
                  <SelectValue placeholder="بدون عقد محدد" />
                </SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto">
                  <SelectItem value="none">بدون عقد محدد (دفعة مباشرة)</SelectItem>
                  {filteredContractsForForm.length === 0 ? (
                    <div className="p-2 text-xs text-gray-500 text-center">
                      لا توجد عقود لهذا المقاول
                      {watchProjectId ? " في هذا المشروع" : ""}
                    </div>
                  ) : (
                    filteredContractsForForm.map((contract) => {
                      const remaining = (contract.totalAmount || 0) - (contract.paidAmount || 0);
                      return (
                        <SelectItem key={contract.id} value={contract.id.toString()}>
                          <div className="flex flex-col items-start text-right w-full">
                            <span className="font-medium">
                              {contract.title}
                              {contract.contractNumber && (
                                <span className="text-xs text-gray-500 mr-2">
                                  ({contract.contractNumber})
                                </span>
                              )}
                            </span>
                            <span className="text-xs text-gray-600">
                              المتبقي: {remaining.toLocaleString()} ر.س من{" "}
                              {(contract.totalAmount || 0).toLocaleString()} ر.س
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-amber-800 bg-amber-100/50 p-2 rounded">
                💡 سيظهر هذا الطلب تلقائياً في كشف حساب المقاول بعد اعتماده ودفعه
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );

  const filteredRequests = requests.filter((req) => {
    // تبويب التقرير يعرض المعتمد والمدفوع فقط
    if (activeTab === "report") {
      if (req.status !== "approved" && req.status !== "paid") return false;
    } else if (activeTab !== "all" && req.status !== activeTab) {
      return false;
    }
    if (statusFilter !== "all" && req.status !== statusFilter) return false;
    if (typeFilter !== "all" && req.requestType !== typeFilter) return false;
    if (projectFilter !== "all" && req.projectId !== parseInt(projectFilter, 10)) return false;
    
    // بحث نصي
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesDescription = (req.description ?? "").toLowerCase().includes(query);
      const matchesBeneficiary = (req.beneficiaryName ?? "").toLowerCase().includes(query);
      const matchesInvoice = (req.invoiceNumber ?? "").toLowerCase().includes(query);
      const matchesNotes = (req.notes ?? "").toLowerCase().includes(query);
      if (!matchesDescription && !matchesBeneficiary && !matchesInvoice && !matchesNotes) {
        return false;
      }
    }
    
    return true;
  });

  const requestsByDate = filteredRequests.filter((req) => {
    const createdAtStr = req.createdAt ? new Date(req.createdAt).toISOString().split('T')[0] : null;
    const reqDate = req.requestDate || createdAtStr;
    
    // فلترة بنطاق تاريخ
    if (dateFrom && reqDate && reqDate < dateFrom) return false;
    if (dateTo && reqDate && reqDate > dateTo) return false;
    
    return true;
  });

  const formatDateArabic = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getDateRangeText = () => {
    if (dateFrom && dateTo) {
      return `${formatDateArabic(dateFrom)} إلى ${formatDateArabic(dateTo)}`;
    } else if (dateFrom) {
      return `من ${formatDateArabic(dateFrom)}`;
    } else if (dateTo) {
      return `حتى ${formatDateArabic(dateTo)}`;
    }
    return "جميع التواريخ";
  };

  const generateShareText = () => {
    const total = requestsByDate.reduce((sum, r) => sum + r.amount, 0);
    let text = `📋 طلبات الدفع - ${getDateRangeText()}\n\n`;
    text += `إجمالي الطلبات: ${requestsByDate.length}\n`;
    text += `إجمالي المبلغ: ${total.toLocaleString()} ر.س\n\n`;
    
    requestsByDate.forEach((req, index) => {
      const typeInfo = getTypeInfo(req.requestType);
      const statusInfo = getStatusInfo(req.status);
      text += `${index + 1}. ${typeInfo.label}: ${req.description}\n`;
      text += `   المبلغ: ${req.amount.toLocaleString()} ر.س\n`;
      text += `   الحالة: ${statusInfo.label}\n`;
      if (req.beneficiaryName) text += `   المستفيد: ${req.beneficiaryName}\n`;
      text += `\n`;
    });
    
    return text;
  };

  const openDetailsModal = (request: PaymentRequest) => {
    setDetailsRequest(request);
    setIsDetailsOpen(true);
  };

  const handleDownloadPDF = () => {
    if (requestsByDate.length === 0) {
      toast({ title: "لا توجد طلبات للتصدير", variant: "destructive" });
      return;
    }
    
    try {
      generatePaymentRequestsPDF(
        requestsByDate,
        projects,
        branches,
        categories,
        getDateRangeText()
      );
      toast({ title: "تم فتح نافذة التقرير - اضغط طباعة / حفظ PDF" });
    } catch (error) {
      console.error("PDF generation failed:", error);
      toast({ title: "فشل في إنشاء التقرير", variant: "destructive" });
    }
  };

  const handleSharePDF = () => {
    if (requestsByDate.length === 0) {
      toast({ title: "لا توجد طلبات للمشاركة", variant: "destructive" });
      return;
    }
    
    try {
      generatePaymentRequestsPDF(
        requestsByDate,
        projects,
        branches,
        categories,
        getDateRangeText()
      );
      toast({ 
        title: "تم فتح نافذة التقرير",
        description: "اضغط طباعة / حفظ PDF ثم شاركه عبر واتساب"
      });
    } catch (error) {
      console.error("PDF sharing failed:", error);
      toast({ title: "فشل في مشاركة التقرير", variant: "destructive" });
    }
  };

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const approvedCount = requests.filter((r) => r.status === "approved").length;
  const paidCount = requests.filter((r) => r.status === "paid").length;
  const rejectedCount = requests.filter((r) => r.status === "rejected").length;
  const pendingAmount = requests.filter((r) => r.status === "pending").reduce((sum, r) => sum + r.amount, 0);
  const approvedAmount = requests.filter((r) => r.status === "approved").reduce((sum, r) => sum + r.amount, 0);
  const paidAmount = requests.filter((r) => r.status === "paid").reduce((sum, r) => sum + r.amount, 0);

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
      <div className="p-3 sm:p-4 md:p-6 max-w-6xl mx-auto space-y-4" dir="rtl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 sm:mb-6">
          <div className="flex items-center gap-3">
            <Link href="/construction-projects">
              <Button variant="ghost" size="icon" className="h-11 w-11 sm:h-8 sm:w-8" data-testid="btn-back">
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">طلبات الحوالات والمصروفات</h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">إدارة طلبات الدفع والحوالات للمشاريع</p>
            </div>
          </div>
          <Button
            onClick={() => {
              form.reset();
              setIsAddOpen(true);
            }}
            className="bg-butter-gold hover:bg-butter-gold/90 w-full sm:w-auto h-11 sm:h-9"
            data-testid="button-add-request"
          >
            <Plus className="ml-2 h-4 w-4" />
            طلب تحويل / دفعة
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4 mb-4 sm:mb-6">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab("pending")}>
            <CardContent className="p-3 sm:pt-6 sm:px-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-yellow-100 rounded-lg">
                  <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-gray-500">قيد المراجعة</p>
                  <p className="text-lg sm:text-2xl font-bold">{pendingCount}</p>
                  <p className="text-[10px] sm:text-xs text-gray-400 hidden sm:block">{pendingAmount.toLocaleString()} ر.س</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab("approved")}>
            <CardContent className="p-3 sm:pt-6 sm:px-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg">
                  <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-gray-500">معتمد</p>
                  <p className="text-lg sm:text-2xl font-bold">{approvedCount}</p>
                  <p className="text-[10px] sm:text-xs text-gray-400 hidden sm:block">{approvedAmount.toLocaleString()} ر.س</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab("paid")}>
            <CardContent className="p-3 sm:pt-6 sm:px-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-green-100 rounded-lg">
                  <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-gray-500">مدفوع</p>
                  <p className="text-lg sm:text-2xl font-bold">{paidCount}</p>
                  <p className="text-[10px] sm:text-xs text-gray-400 hidden sm:block">{paidAmount.toLocaleString()} ر.س</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab("rejected")}>
            <CardContent className="p-3 sm:pt-6 sm:px-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-red-100 rounded-lg">
                  <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-gray-500">مرفوض</p>
                  <p className="text-lg sm:text-2xl font-bold">{rejectedCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-2 sm:col-span-1">
            <CardContent className="p-3 sm:pt-6 sm:px-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-purple-100 rounded-lg">
                  <Wallet className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-gray-500">الإجمالي</p>
                  <p className="text-lg sm:text-2xl font-bold">{requests.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mb-4 sm:mb-6 overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="inline-flex w-max sm:w-auto gap-1">
              <TabsTrigger value="all" className="text-xs sm:text-sm whitespace-nowrap">الكل ({requests.length})</TabsTrigger>
              <TabsTrigger value="pending" className="text-xs sm:text-sm whitespace-nowrap">قيد المراجعة ({pendingCount})</TabsTrigger>
              <TabsTrigger value="approved" className="text-xs sm:text-sm whitespace-nowrap">معتمد ({approvedCount})</TabsTrigger>
              <TabsTrigger value="paid" className="text-xs sm:text-sm whitespace-nowrap">مدفوع ({paidCount})</TabsTrigger>
              <TabsTrigger value="rejected" className="text-xs sm:text-sm whitespace-nowrap">مرفوض ({rejectedCount})</TabsTrigger>
              <TabsTrigger value="report" className="text-xs sm:text-sm whitespace-nowrap">تقرير الصرف</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <Card className="mb-4 sm:mb-6">
          <CardContent className="p-3 sm:pt-6 sm:px-6">
            <div className="space-y-3 sm:space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="sm:col-span-1">
                  <Label className="flex items-center gap-2 mb-1.5 text-xs sm:text-sm">
                    <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    بحث
                  </Label>
                  <Input 
                    placeholder="ابحث..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    data-testid="input-search"
                    className="h-11 sm:h-10 text-sm"
                  />
                </div>
                <div>
                  <Label className="flex items-center gap-2 mb-1.5 text-xs sm:text-sm">
                    <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    المشروع
                  </Label>
                  <Select value={projectFilter} onValueChange={setProjectFilter}>
                    <SelectTrigger data-testid="select-project-filter" className="h-11 sm:h-10 text-sm">
                      <SelectValue placeholder="جميع المشاريع" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 overflow-y-auto">
                      <SelectItem value="all">جميع المشاريع</SelectItem>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id.toString()}>
                          {project.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1.5 text-xs sm:text-sm">نوع الطلب</Label>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger data-testid="select-type-filter" className="h-11 sm:h-10 text-sm">
                      <SelectValue placeholder="جميع الأنواع" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 overflow-y-auto">
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
              
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-4 items-end">
                <div className="col-span-1">
                  <Label className="flex items-center gap-2 mb-1.5 text-xs sm:text-sm">
                    <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    من
                  </Label>
                  <Input 
                    type="date" 
                    value={dateFrom} 
                    onChange={(e) => setDateFrom(e.target.value)}
                    data-testid="input-date-from"
                    className="h-11 sm:h-10 text-sm"
                  />
                </div>
                <div className="col-span-1">
                  <Label className="flex items-center gap-2 mb-1.5 text-xs sm:text-sm">
                    <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    إلى
                  </Label>
                  <Input 
                    type="date" 
                    value={dateTo} 
                    onChange={(e) => setDateTo(e.target.value)}
                    data-testid="input-date-to"
                    className="h-11 sm:h-10 text-sm"
                  />
                </div>
                <Button 
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setProjectFilter("all");
                    setTypeFilter("all");
                    setDateFrom("");
                    setDateTo("");
                  }}
                  className="text-gray-500 h-11 sm:h-9 text-xs sm:text-sm col-span-2 sm:col-span-1"
                  data-testid="button-clear-filters"
                >
                  <X className="ml-1 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  مسح الفلاتر
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 pt-2 border-t">
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadPDF}
                  disabled={requestsByDate.length === 0}
                  data-testid="button-download-pdf"
                  className="flex-1 sm:flex-none h-11 sm:h-9 text-xs sm:text-sm"
                >
                  <Download className="ml-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">تحميل PDF</span>
                  <span className="sm:hidden">PDF</span>
                </Button>
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={handleSharePDF}
                  disabled={requestsByDate.length === 0}
                  data-testid="button-share-whatsapp"
                  className="flex-1 sm:flex-none h-11 sm:h-9 text-xs sm:text-sm"
                >
                  <MessageCircle className="ml-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500" />
                  <span className="hidden sm:inline">مشاركة واتساب</span>
                  <span className="sm:hidden">واتساب</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {activeTab === "report" && (
          <Card className="mb-6 border-purple-200 bg-purple-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-700">
                <FileDown className="h-5 w-5" />
                تقرير الحوالات المعتمدة والمصروفة
              </CardTitle>
              <CardDescription>تقرير شامل للمراجعة الدورية على الحوالات التي تمت الموافقة عليها وصرفها</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-lg border">
                  <p className="text-sm text-gray-500">المعتمد (بانتظار الصرف)</p>
                  <p className="text-2xl font-bold text-blue-600">{requestsByDate.filter(r => r.status === "approved").length}</p>
                  <p className="text-sm text-gray-400">{requestsByDate.filter(r => r.status === "approved").reduce((s, r) => s + r.amount, 0).toLocaleString()} ر.س</p>
                </div>
                <div className="bg-white p-4 rounded-lg border">
                  <p className="text-sm text-gray-500">المصروف</p>
                  <p className="text-2xl font-bold text-green-600">{requestsByDate.filter(r => r.status === "paid").length}</p>
                  <p className="text-sm text-gray-400">{requestsByDate.filter(r => r.status === "paid").reduce((s, r) => s + r.amount, 0).toLocaleString()} ر.س</p>
                </div>
                <div className="bg-white p-4 rounded-lg border">
                  <p className="text-sm text-gray-500">إجمالي الطلبات</p>
                  <p className="text-2xl font-bold text-purple-600">{requestsByDate.length}</p>
                </div>
                <div className="bg-white p-4 rounded-lg border">
                  <p className="text-sm text-gray-500">إجمالي المبالغ</p>
                  <p className="text-2xl font-bold text-purple-600">{requestsByDate.reduce((s, r) => s + r.amount, 0).toLocaleString()}</p>
                  <p className="text-sm text-gray-400">ريال سعودي</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="p-3 sm:p-6">
            <CardTitle className="text-base sm:text-xl">
              {activeTab === "report" ? "تفاصيل الحوالات المعتمدة والمصروفة" : "قائمة الطلبات"}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              عرض {requestsByDate.length} طلب
              {requestsByDate.length > 0 && ` - إجمالي: ${requestsByDate.reduce((sum, r) => sum + r.amount, 0).toLocaleString()} ر.س`}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 sm:p-6 sm:pt-0">
            {/* Mobile Card View */}
            <div className="sm:hidden space-y-2 px-3 pb-3">
              {requestsByDate.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  لا توجد طلبات
                </div>
              ) : (
                requestsByDate.map((request) => {
                  const statusInfo = getStatusInfo(request.status);
                  const typeInfo = getTypeInfo(request.requestType);
                  const TypeIcon = typeInfo.icon;

                  return (
                    <div 
                      key={request.id} 
                      className="border rounded-lg p-3 bg-white hover:shadow-sm cursor-pointer"
                      onClick={() => openDetailsModal(request)}
                      data-testid={`card-request-${request.id}`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <TypeIcon className="h-4 w-4 text-gray-500" />
                          <span className="font-medium text-sm">{typeInfo.label}</span>
                        </div>
                        <Badge className={`${statusInfo.color} text-white text-[10px] px-1.5 py-0.5`}>
                          {statusInfo.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-700 line-clamp-2 mb-2">{request.description}</p>
                      {request.contractorId && (
                        <Badge className="bg-amber-100 text-amber-900 mb-2 gap-1 text-[10px]">
                          <HardHat className="h-3 w-3" />
                          {getContractorName(request.contractorId) || `مقاول #${request.contractorId}`}
                        </Badge>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">{getProjectName(request.projectId)}</span>
                        <span className="font-bold text-sm text-butter-gold">{request.amount.toLocaleString()} ر.س</span>
                      </div>
                      {(request.status === "pending" && canApprovePayment) && (
                        <div className="flex gap-2 mt-3 pt-2 border-t" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            className="flex-1 h-8 text-xs bg-green-600 hover:bg-green-700"
                            onClick={() => approveMutation.mutate(request.id)}
                            data-testid={`button-mobile-approve-${request.id}`}
                          >
                            <CheckCircle className="ml-1 h-3.5 w-3.5" />
                            اعتماد
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="flex-1 h-8 text-xs"
                            onClick={() => {
                              setSelectedRequest(request);
                              setIsRejectOpen(true);
                            }}
                            data-testid={`button-mobile-reject-${request.id}`}
                          >
                            <XCircle className="ml-1 h-3.5 w-3.5" />
                            رفض
                          </Button>
                        </div>
                      )}
                      {(request.status === "approved" && canApprovePayment) && (
                        <div className="mt-3 pt-2 border-t" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            className="w-full h-8 text-xs bg-green-600 hover:bg-green-700"
                            onClick={() => markPaidMutation.mutate(request.id)}
                            data-testid={`button-mobile-paid-${request.id}`}
                          >
                            <DollarSign className="ml-1 h-3.5 w-3.5" />
                            تأكيد الدفع
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">#</TableHead>
                    <TableHead className="text-right">النوع</TableHead>
                    <TableHead className="text-right">المشروع</TableHead>
                    <TableHead className="text-right">الوصف</TableHead>
                    <TableHead className="text-right">المبلغ</TableHead>
                    <TableHead className="text-right">المستفيد / المقاول</TableHead>
                    <TableHead className="text-right">الأولوية</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requestsByDate.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                        لا توجد طلبات
                      </TableCell>
                    </TableRow>
                  ) : (
                    requestsByDate.map((request) => {
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
                          <TableCell 
                            className="max-w-[200px] truncate cursor-pointer hover:text-blue-600"
                            onClick={() => openDetailsModal(request)}
                          >
                            {request.description}
                          </TableCell>
                          <TableCell className="font-medium">
                            {request.amount.toLocaleString()} ر.س
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <span className="text-sm">
                                {request.beneficiaryName || "-"}
                              </span>
                              {request.contractorId && (
                                <Link href={`/contractors/${request.contractorId}/statement`}>
                                  <Badge
                                    className="bg-amber-100 text-amber-900 hover:bg-amber-200 cursor-pointer w-fit gap-1"
                                    data-testid={`badge-contractor-${request.id}`}
                                  >
                                    <HardHat className="h-3 w-3" />
                                    {getContractorName(request.contractorId) || `مقاول #${request.contractorId}`}
                                  </Badge>
                                </Link>
                              )}
                            </div>
                          </TableCell>
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
                              {request.status === "pending" && canApprovePayment && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => approveMutation.mutate(request.id)}
                                    className="text-green-600 hover:text-green-700 h-11 w-11 sm:h-8 sm:w-8"
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
                                    className="text-red-600 hover:text-red-700 h-11 w-11 sm:h-8 sm:w-8"
                                    data-testid={`button-reject-${request.id}`}
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              {request.status === "approved" && canApprovePayment && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => markPaidMutation.mutate(request.id)}
                                  className="text-green-600 hover:text-green-700 h-11 w-11 sm:h-8 sm:w-8"
                                  data-testid={`button-paid-${request.id}`}
                                >
                                  <DollarSign className="h-4 w-4" />
                                </Button>
                              )}
                              {request.status === "pending" && canEditPayment && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEditDialog(request)}
                                  className="h-11 w-11 sm:h-8 sm:w-8"
                                  data-testid={`button-edit-${request.id}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                              {request.status === "pending" && canDeletePayment && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setSelectedRequest(request);
                                    setIsDeleteOpen(true);
                                  }}
                                  className="h-11 w-11 sm:h-8 sm:w-8"
                                  data-testid={`button-delete-${request.id}`}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openDetailsModal(request)}
                                className="h-11 w-11 sm:h-8 sm:w-8"
                                data-testid={`button-view-${request.id}`}
                              >
                                <Eye className="h-4 w-4 text-gray-500" />
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
      </div>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-butter-gold" />
              طلب تحويل / دفعة جديد
            </DialogTitle>
            <DialogDescription>يرجى تعبئة البيانات التالية لتقديم طلب التحويل أو الدفعة</DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>المشروع *</Label>
                <Select
                  value={form.watch("projectId")?.toString() || ""}
                  onValueChange={handleProjectChange}
                >
                  <SelectTrigger data-testid="select-project">
                    <SelectValue placeholder="اختر المشروع" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
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
                  <SelectContent className="max-h-60 overflow-y-auto">
                    {REQUEST_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {renderContractorFields("-add")}

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
                  <SelectContent className="max-h-60 overflow-y-auto">
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
                  value={form.watch("categoryId")?.toString() || "none"}
                  onValueChange={(val) => form.setValue("categoryId", val === "none" ? null : parseInt(val, 10))}
                >
                  <SelectTrigger data-testid="select-category">
                    <SelectValue placeholder="اختر الفئة" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
                    <SelectItem value="none">بدون فئة</SelectItem>
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
                  onValueChange={handleProjectChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر المشروع" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
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
                  <SelectContent className="max-h-60 overflow-y-auto">
                    {REQUEST_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {renderContractorFields("-edit")}

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
                  <SelectContent className="max-h-60 overflow-y-auto">
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
                  value={form.watch("categoryId")?.toString() || "none"}
                  onValueChange={(val) => form.setValue("categoryId", val === "none" ? null : parseInt(val, 10))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الفئة" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
                    <SelectItem value="none">بدون فئة</SelectItem>
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

      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              تفاصيل الطلب {detailsRequest?.requestNumber || `#${detailsRequest?.id}`}
            </DialogTitle>
          </DialogHeader>
          {detailsRequest && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">نوع الطلب</p>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const typeInfo = getTypeInfo(detailsRequest.requestType);
                      const TypeIcon = typeInfo.icon;
                      return (
                        <>
                          <TypeIcon className="h-4 w-4" />
                          <span className="font-medium">{typeInfo.label}</span>
                        </>
                      );
                    })()}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">الحالة</p>
                  <Badge className={`${getStatusInfo(detailsRequest.status).color} text-white`}>
                    {getStatusInfo(detailsRequest.status).label}
                  </Badge>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-gray-500">المشروع</p>
                <p className="font-medium">{getProjectName(detailsRequest.projectId)}</p>
              </div>

              {detailsRequest.contractorId && (
                <div className="border-2 border-amber-200 bg-amber-50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <HardHat className="h-5 w-5 text-amber-700" />
                      <p className="text-sm font-semibold text-amber-900">المقاول</p>
                    </div>
                    <Link href={`/contractors/${detailsRequest.contractorId}/statement`}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2 bg-white"
                        data-testid={`button-view-contractor-statement-${detailsRequest.id}`}
                      >
                        <ExternalLink className="h-4 w-4" />
                        عرض كشف الحساب
                      </Button>
                    </Link>
                  </div>
                  <p className="font-bold text-lg text-amber-900">
                    {getContractorName(detailsRequest.contractorId) || `مقاول #${detailsRequest.contractorId}`}
                  </p>
                  {detailsRequest.contractId && (
                    <div className="flex items-center gap-2 text-sm text-amber-800 bg-white/50 p-2 rounded">
                      <FileText className="h-4 w-4" />
                      <span>مرتبط بعقد: <strong>{getContractTitle(detailsRequest.contractId) || `#${detailsRequest.contractId}`}</strong></span>
                    </div>
                  )}
                  {detailsRequest.status === "paid" && (
                    <p className="text-xs text-green-700 bg-green-50 p-2 rounded border border-green-200">
                      ✓ هذا المبلغ مُدرج في كشف حساب المقاول كدفعة مسددة
                    </p>
                  )}
                  {detailsRequest.status !== "paid" && detailsRequest.status !== "rejected" && (
                    <p className="text-xs text-blue-700 bg-blue-50 p-2 rounded border border-blue-200">
                      ⏳ سيظهر في كشف الحساب كمستحق حالياً، وسيُحول لمسدد عند تأشيره مدفوع
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-1">
                <p className="text-sm text-gray-500">الوصف</p>
                <p className="font-medium bg-gray-50 p-3 rounded-lg">{detailsRequest.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">المبلغ</p>
                  <p className="text-xl font-bold text-butter-gold">{detailsRequest.amount.toLocaleString()} ر.س</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">الأولوية</p>
                  <Badge className={`${getPriorityInfo(detailsRequest.priority || "normal").color} text-white`}>
                    {getPriorityInfo(detailsRequest.priority || "normal").label}
                  </Badge>
                </div>
              </div>

              {(detailsRequest.beneficiaryName || detailsRequest.beneficiaryBank || detailsRequest.beneficiaryIban) && (
                <div className="border-t pt-4">
                  <p className="text-sm font-medium text-gray-700 mb-3">بيانات المستفيد</p>
                  <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                    {detailsRequest.beneficiaryName && (
                      <div className="space-y-1">
                        <p className="text-sm text-gray-500">الاسم</p>
                        <p className="font-medium">{detailsRequest.beneficiaryName}</p>
                      </div>
                    )}
                    {detailsRequest.beneficiaryBank && (
                      <div className="space-y-1">
                        <p className="text-sm text-gray-500">البنك</p>
                        <p className="font-medium">{detailsRequest.beneficiaryBank}</p>
                      </div>
                    )}
                    {detailsRequest.beneficiaryIban && (
                      <div className="col-span-2 space-y-1">
                        <p className="text-sm text-gray-500">الآيبان</p>
                        <p className="font-mono text-sm bg-white p-2 rounded border">{detailsRequest.beneficiaryIban}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {detailsRequest.categoryId && (
                  <div className="space-y-1">
                    <p className="text-sm text-gray-500">الفئة</p>
                    <p className="font-medium">{getCategoryName(detailsRequest.categoryId)}</p>
                  </div>
                )}
                {detailsRequest.invoiceNumber && (
                  <div className="space-y-1">
                    <p className="text-sm text-gray-500">رقم الفاتورة</p>
                    <p className="font-medium">{detailsRequest.invoiceNumber}</p>
                  </div>
                )}
                {detailsRequest.dueDate && (
                  <div className="space-y-1">
                    <p className="text-sm text-gray-500">تاريخ الاستحقاق</p>
                    <p className="font-medium">{formatDateArabic(detailsRequest.dueDate)}</p>
                  </div>
                )}
                {detailsRequest.createdAt && (
                  <div className="space-y-1">
                    <p className="text-sm text-gray-500">تاريخ الإنشاء</p>
                    <p className="font-medium">{formatDateArabic(detailsRequest.createdAt.toString())}</p>
                  </div>
                )}
              </div>

              {detailsRequest.notes && (
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">ملاحظات</p>
                  <p className="bg-yellow-50 p-3 rounded-lg text-sm">{detailsRequest.notes}</p>
                </div>
              )}

              {detailsRequest.rejectionReason && (
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">سبب الرفض</p>
                  <p className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{detailsRequest.rejectionReason}</p>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDetailsOpen(false)}>
                  إغلاق
                </Button>
                {detailsRequest.status === "pending" && canEditPayment && (
                  <Button onClick={() => {
                    setIsDetailsOpen(false);
                    openEditDialog(detailsRequest);
                  }}>
                    <Pencil className="ml-2 h-4 w-4" />
                    تعديل
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </Layout>
  );
}
