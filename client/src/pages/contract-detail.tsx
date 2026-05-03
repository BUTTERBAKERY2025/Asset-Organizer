import { useState, useMemo } from "react";
import { Layout } from "@/components/layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useParams, Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient as globalQueryClient } from "@/lib/queryClient";
import {
  ArrowRight, Plus, Pencil, Trash2, Loader2, FileText,
  Calendar, DollarSign, Building2, User, CheckCircle2, Clock,
  AlertCircle, Send, Wallet, Receipt, TrendingUp,
} from "lucide-react";
import type {
  ConstructionContract, Contractor, ConstructionProject,
  ContractMilestone, ContractItem, ContractPayment,
} from "@shared/schema";

// ============================================================
// Form schema for milestones
// ============================================================
const milestoneFormSchema = z.object({
  title: z.string().min(1, "العنوان مطلوب"),
  description: z.string().optional().nullable(),
  amountType: z.enum(["percentage", "fixed"]).default("percentage"),
  percentage: z.coerce.number().min(0).max(100).optional().nullable(),
  amount: z.coerce.number().min(0).default(0),
  triggerType: z.enum(["manual", "date", "progress", "item_completion"]).default("manual"),
  triggerDate: z.string().optional().nullable(),
  triggerProgressPercent: z.coerce.number().min(0).max(100).optional().nullable(),
  dueDate: z.string().optional().nullable(),
  sequence: z.coerce.number().int().min(1).default(1),
  notes: z.string().optional().nullable(),
}).refine((d) => d.amountType === "fixed" || (d.percentage != null && d.percentage > 0), {
  message: "أدخل النسبة المئوية",
  path: ["percentage"],
}).refine((d) => d.amountType === "percentage" || d.amount > 0, {
  message: "أدخل المبلغ",
  path: ["amount"],
});

type MilestoneFormData = z.infer<typeof milestoneFormSchema>;

const STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "منتظرة", color: "bg-gray-400", icon: Clock },
  due: { label: "مستحقة", color: "bg-amber-500", icon: AlertCircle },
  requested: { label: "تم طلب الصرف", color: "bg-blue-500", icon: Send },
  paid: { label: "مدفوعة", color: "bg-emerald-500", icon: CheckCircle2 },
  cancelled: { label: "ملغاة", color: "bg-red-400", icon: Trash2 },
};

const TRIGGER_LABELS: Record<string, string> = {
  manual: "يدوي",
  date: "تاريخ محدد",
  progress: "نسبة إنجاز",
  item_completion: "إنجاز بنود",
};

function formatSAR(n?: number | null) {
  if (n == null) return "0 ريال";
  return new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(n) + " ريال";
}

// ============================================================
// Main page
// ============================================================
export default function ContractDetailPage() {
  const params = useParams<{ id: string }>();
  const contractId = parseInt(params.id || "0", 10);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const { canCreate, canEdit, canDelete } = usePermissions();

  const canCreateMilestone = isAdmin || canCreate("contracts");
  const canEditMilestone = isAdmin || canEdit("contracts");
  const canDeleteMilestone = isAdmin || canDelete("contracts");
  const canRequestPayment = isAdmin || canCreate("payment_requests");

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ContractMilestone | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContractMilestone | null>(null);
  const [requestTarget, setRequestTarget] = useState<ContractMilestone | null>(null);

  // ============================================================
  // Data fetching
  // ============================================================
  const { data: contract, isLoading: contractLoading } = useQuery<ConstructionContract>({
    queryKey: [`/api/construction/contracts/${contractId}`],
    enabled: !!contractId,
  });

  const { data: contractors = [] } = useQuery<Contractor[]>({
    queryKey: ["/api/construction/contractors"],
  });

  const { data: projects = [] } = useQuery<ConstructionProject[]>({
    queryKey: ["/api/construction/projects"],
  });

  const { data: milestones = [], isLoading: milestonesLoading } = useQuery<ContractMilestone[]>({
    queryKey: [`/api/construction/contracts/${contractId}/milestones`],
    enabled: !!contractId,
  });

  const { data: items = [] } = useQuery<ContractItem[]>({
    queryKey: [`/api/construction/contracts/${contractId}/items`],
    enabled: !!contractId,
  });

  const { data: payments = [] } = useQuery<ContractPayment[]>({
    queryKey: [`/api/construction/contracts/${contractId}/payments`],
    enabled: !!contractId,
  });

  const contractor = useMemo(
    () => contractors.find((c) => c.id === contract?.contractorId),
    [contractors, contract],
  );
  const project = useMemo(
    () => projects.find((p) => p.id === contract?.projectId),
    [projects, contract],
  );

  // ============================================================
  // Financial summary (computed)
  // ============================================================
  const summary = useMemo(() => {
    const total = contract?.totalAmount || 0;
    const milestonesTotal = milestones.reduce((s, m) => s + (m.amount || 0), 0);
    const paid = payments.reduce((s, p) => s + (p.amount || 0), 0);
    const requested = milestones
      .filter((m) => m.status === "requested" || m.status === "due")
      .reduce((s, m) => s + (m.amount || 0), 0);
    const remaining = Math.max(total - paid, 0);
    const paidPercent = total > 0 ? Math.min((paid / total) * 100, 100) : 0;
    const milestonesCoverage = total > 0 ? (milestonesTotal / total) * 100 : 0;
    return { total, milestonesTotal, paid, requested, remaining, paidPercent, milestonesCoverage };
  }, [contract, milestones, payments]);

  // ============================================================
  // Form
  // ============================================================
  const form = useForm<MilestoneFormData>({
    resolver: zodResolver(milestoneFormSchema),
    defaultValues: {
      title: "",
      description: "",
      amountType: "percentage",
      percentage: 0,
      amount: 0,
      triggerType: "manual",
      triggerDate: "",
      triggerProgressPercent: 0,
      dueDate: "",
      sequence: (milestones?.length || 0) + 1,
      notes: "",
    },
  });

  const watchAmountType = form.watch("amountType");
  const watchTriggerType = form.watch("triggerType");
  const watchPercentage = form.watch("percentage");

  // Live preview of computed amount when percentage changes
  const previewAmount = useMemo(() => {
    if (watchAmountType !== "percentage" || !watchPercentage || !contract?.totalAmount) return null;
    return (contract.totalAmount * watchPercentage) / 100;
  }, [watchAmountType, watchPercentage, contract]);

  const openAdd = () => {
    form.reset({
      title: "",
      description: "",
      amountType: "percentage",
      percentage: 0,
      amount: 0,
      triggerType: "manual",
      triggerDate: "",
      triggerProgressPercent: 0,
      dueDate: "",
      sequence: (milestones?.length || 0) + 1,
      notes: "",
    });
    setEditTarget(null);
    setIsAddOpen(true);
  };

  const openEdit = (m: ContractMilestone) => {
    form.reset({
      title: m.title,
      description: m.description || "",
      amountType: (m.amountType as any) || "percentage",
      percentage: m.percentage ?? 0,
      amount: m.amount,
      triggerType: (m.triggerType as any) || "manual",
      triggerDate: m.triggerDate || "",
      triggerProgressPercent: m.triggerProgressPercent ?? 0,
      dueDate: m.dueDate || "",
      sequence: m.sequence,
      notes: m.notes || "",
    });
    setEditTarget(m);
    setIsAddOpen(true);
  };

  // ============================================================
  // Mutations
  // ============================================================
  const createMutation = useMutation({
    mutationFn: async (data: MilestoneFormData) => {
      const res = await apiRequest("POST", "/api/construction/contract-milestones", {
        ...data,
        contractId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/construction/contracts/${contractId}/milestones`] });
      setIsAddOpen(false);
      toast({ title: "تم إضافة المرحلة بنجاح" });
    },
    onError: (e: any) => toast({ title: "فشل الإضافة", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: MilestoneFormData) => {
      const res = await apiRequest("PATCH", `/api/construction/contract-milestones/${editTarget!.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/construction/contracts/${contractId}/milestones`] });
      setIsAddOpen(false);
      setEditTarget(null);
      toast({ title: "تم تحديث المرحلة" });
    },
    onError: (e: any) => toast({ title: "فشل التحديث", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/construction/contract-milestones/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/construction/contracts/${contractId}/milestones`] });
      setDeleteTarget(null);
      toast({ title: "تم حذف المرحلة" });
    },
    onError: (e: any) => toast({ title: "فشل الحذف", description: e.message, variant: "destructive" }),
  });

  const requestPaymentMutation = useMutation({
    mutationFn: async (milestoneId: number) => {
      const res = await apiRequest("POST", `/api/construction/contract-milestones/${milestoneId}/request-payment`, {});
      return res.json();
    },
    onSuccess: (paymentRequest: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/construction/contracts/${contractId}/milestones`] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-requests"] });
      setRequestTarget(null);
      toast({
        title: "تم إنشاء طلب الصرف",
        description: `رقم الطلب: ${paymentRequest.requestNumber}`,
      });
    },
    onError: (e: any) => toast({ title: "فشل إنشاء الطلب", description: e.message, variant: "destructive" }),
  });

  const onSubmit = (data: MilestoneFormData) => {
    if (editTarget) updateMutation.mutate(data);
    else createMutation.mutate(data);
  };

  // ============================================================
  // Render
  // ============================================================
  if (contractLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
        </div>
      </Layout>
    );
  }

  if (!contract) {
    return (
      <Layout>
        <Card className="m-6">
          <CardContent className="p-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-3" />
            <p className="text-lg font-semibold">العقد غير موجود</p>
            <Button className="mt-4" onClick={() => navigate("/contracts")} data-testid="button-back-to-contracts">
              العودة لقائمة العقود
            </Button>
          </CardContent>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto" dir="rtl">
        {/* Breadcrumb / back */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/contracts">
            <button className="hover:text-foreground flex items-center gap-1" data-testid="link-back-contracts">
              <ArrowRight className="h-4 w-4" />
              <span>العقود</span>
            </button>
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium" data-testid="text-contract-title">{contract.title}</span>
        </div>

        {/* Header card */}
        <Card className="border-amber-200">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-xl" data-testid="text-contract-name">{contract.title}</CardTitle>
                  <Badge className="bg-amber-500" data-testid="badge-contract-number">{contract.contractNumber || "بدون رقم"}</Badge>
                  <Badge variant="outline" data-testid="badge-contract-status">{contract.status}</Badge>
                </div>
                {contract.description && (
                  <p className="text-sm text-muted-foreground" data-testid="text-contract-description">{contract.description}</p>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">المشروع</div>
                <div className="font-medium" data-testid="text-project-name">{project?.title || "-"}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">المقاول</div>
                <div className="font-medium" data-testid="text-contractor-name">{contractor?.name || "-"}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">من</div>
                <div className="font-medium" data-testid="text-start-date">{contract.startDate || "-"}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">إلى</div>
                <div className="font-medium" data-testid="text-end-date">{contract.endDate || "-"}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Financial summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <SummaryCard icon={DollarSign} label="قيمة العقد" value={formatSAR(summary.total)} color="text-amber-700" testid="summary-total" />
          <SummaryCard icon={Wallet} label="المدفوع فعلاً" value={formatSAR(summary.paid)} color="text-emerald-700" testid="summary-paid" />
          <SummaryCard icon={Send} label="قيد الصرف" value={formatSAR(summary.requested)} color="text-blue-700" testid="summary-requested" />
          <SummaryCard icon={TrendingUp} label="المتبقي" value={formatSAR(summary.remaining)} color="text-slate-700" testid="summary-remaining" />
        </div>

        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">نسبة السداد</span>
              <span className="font-semibold" data-testid="text-paid-percent">{summary.paidPercent.toFixed(1)}%</span>
            </div>
            <Progress value={summary.paidPercent} className="h-3" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>تغطية المراحل: {summary.milestonesCoverage.toFixed(1)}% ({formatSAR(summary.milestonesTotal)})</span>
              {summary.milestonesCoverage > 100 && (
                <span className="text-red-600 font-semibold">⚠ المراحل تتجاوز قيمة العقد</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Milestones section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-amber-600" />
                مراحل الدفع
              </CardTitle>
              <CardDescription>
                قسّم قيمة العقد إلى مراحل (مقدم، إنجاز، تسليم) واطلب الصرف بضغطة زر
              </CardDescription>
            </div>
            {canCreateMilestone && (
              <Button onClick={openAdd} data-testid="button-add-milestone" className="bg-amber-600 hover:bg-amber-700">
                <Plus className="h-4 w-4 ml-1" />
                إضافة مرحلة
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {milestonesLoading ? (
              <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-amber-600" /></div>
            ) : milestones.length === 0 ? (
              <EmptyMilestones onAdd={canCreateMilestone ? openAdd : undefined} />
            ) : (
              <MilestonesTimeline
                milestones={milestones}
                contract={contract}
                onEdit={canEditMilestone ? openEdit : undefined}
                onDelete={canDeleteMilestone ? setDeleteTarget : undefined}
                onRequestPayment={canRequestPayment ? setRequestTarget : undefined}
              />
            )}
          </CardContent>
        </Card>

        {/* Quick info: items & payments */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoLinkCard
            title="بنود العقد"
            count={items.length}
            description="بنود الأعمال التفصيلية (BOQ)"
            icon={FileText}
            testid="info-items"
          />
          <InfoLinkCard
            title="سجل الدفعات"
            count={payments.length}
            description="جميع الدفعات المسجلة"
            icon={Wallet}
            testid="info-payments"
          />
        </div>
      </div>

      {/* Add/Edit dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editTarget ? "تعديل المرحلة" : "إضافة مرحلة دفع"}</DialogTitle>
            <DialogDescription>
              حدد عنوان المرحلة، النسبة من قيمة العقد أو مبلغ ثابت، وكيفية استحقاقها.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label>عنوان المرحلة *</Label>
                <Input {...form.register("title")} placeholder="مثلاً: دفعة مقدمة" data-testid="input-milestone-title" />
                {form.formState.errors.title && <p className="text-xs text-red-500 mt-1">{form.formState.errors.title.message}</p>}
              </div>
              <div>
                <Label>الترتيب</Label>
                <Input type="number" min={1} {...form.register("sequence")} data-testid="input-milestone-sequence" />
              </div>
            </div>

            <div>
              <Label>الوصف</Label>
              <Textarea {...form.register("description")} placeholder="ما يجب إنجازه قبل صرف هذه المرحلة" data-testid="input-milestone-description" />
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>نوع المبلغ *</Label>
                <Select
                  value={form.watch("amountType")}
                  onValueChange={(v) => form.setValue("amountType", v as any)}
                >
                  <SelectTrigger data-testid="select-amount-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">نسبة من قيمة العقد</SelectItem>
                    <SelectItem value="fixed">مبلغ ثابت</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {watchAmountType === "percentage" ? (
                <div>
                  <Label>النسبة (%) *</Label>
                  <Input type="number" step="0.01" min={0} max={100} {...form.register("percentage")} data-testid="input-percentage" />
                  {form.formState.errors.percentage && <p className="text-xs text-red-500 mt-1">{form.formState.errors.percentage.message}</p>}
                </div>
              ) : (
                <div>
                  <Label>المبلغ (ريال) *</Label>
                  <Input type="number" step="0.01" min={0} {...form.register("amount")} data-testid="input-amount" />
                  {form.formState.errors.amount && <p className="text-xs text-red-500 mt-1">{form.formState.errors.amount.message}</p>}
                </div>
              )}
            </div>

            {previewAmount != null && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                <span className="text-amber-900">المبلغ المحسوب: </span>
                <span className="font-bold text-amber-700" data-testid="text-preview-amount">{formatSAR(previewAmount)}</span>
              </div>
            )}

            <Separator />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>آلية الاستحقاق</Label>
                <Select
                  value={form.watch("triggerType")}
                  onValueChange={(v) => form.setValue("triggerType", v as any)}
                >
                  <SelectTrigger data-testid="select-trigger-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">يدوي (متى ما يُفعَّل)</SelectItem>
                    <SelectItem value="date">عند تاريخ محدد</SelectItem>
                    <SelectItem value="progress">عند نسبة إنجاز</SelectItem>
                    <SelectItem value="item_completion">عند إنجاز بنود</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>تاريخ الاستحقاق المتوقع</Label>
                <Input type="date" {...form.register("dueDate")} data-testid="input-due-date" />
              </div>
            </div>

            {watchTriggerType === "date" && (
              <div>
                <Label>تاريخ التفعيل</Label>
                <Input type="date" {...form.register("triggerDate")} data-testid="input-trigger-date" />
              </div>
            )}
            {watchTriggerType === "progress" && (
              <div>
                <Label>نسبة الإنجاز المطلوبة (%)</Label>
                <Input type="number" min={0} max={100} {...form.register("triggerProgressPercent")} data-testid="input-trigger-progress" />
              </div>
            )}

            <div>
              <Label>ملاحظات</Label>
              <Textarea {...form.register("notes")} data-testid="input-milestone-notes" />
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)} data-testid="button-cancel-milestone">إلغاء</Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="bg-amber-600 hover:bg-amber-700"
                data-testid="button-save-milestone"
              >
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin ml-1" />}
                {editTarget ? "حفظ التعديلات" : "إضافة المرحلة"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف المرحلة</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف مرحلة "{deleteTarget?.title}"؟ لا يمكن التراجع عن هذه العملية.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-1" />}
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Request payment confirmation */}
      <AlertDialog open={!!requestTarget} onOpenChange={(o) => !o && setRequestTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>إنشاء طلب صرف</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم إنشاء طلب صرف بمبلغ <strong>{formatSAR(requestTarget?.amount)}</strong> للمرحلة
              "{requestTarget?.title}" وربطه بهذه المرحلة. يمكنك متابعة الطلب من شاشة "طلبات الصرف".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-request">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => requestTarget && requestPaymentMutation.mutate(requestTarget.id)}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="button-confirm-request"
            >
              {requestPaymentMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-1" />}
              إنشاء الطلب
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}

// ============================================================
// Sub-components
// ============================================================
function SummaryCard({
  icon: Icon, label, value, color, testid,
}: { icon: any; label: string; value: string; color: string; testid: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-amber-50 ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className={`text-lg font-bold ${color}`} data-testid={`text-${testid}`}>{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function InfoLinkCard({
  title, count, description, icon: Icon, testid,
}: { title: string; count: number; description: string; icon: any; testid: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon className="h-8 w-8 text-amber-600" />
          <div>
            <div className="font-semibold" data-testid={`title-${testid}`}>{title}</div>
            <div className="text-xs text-muted-foreground">{description}</div>
          </div>
        </div>
        <div className="text-2xl font-bold text-amber-700" data-testid={`count-${testid}`}>{count}</div>
      </CardContent>
    </Card>
  );
}

function EmptyMilestones({ onAdd }: { onAdd?: () => void }) {
  return (
    <div className="text-center py-12" data-testid="empty-milestones">
      <Receipt className="h-12 w-12 mx-auto text-amber-300 mb-3" />
      <p className="text-lg font-semibold mb-1">لا توجد مراحل دفع بعد</p>
      <p className="text-sm text-muted-foreground mb-4">
        أضف مراحل الدفع المتفق عليها في العقد (مقدم، إنجاز، تسليم...)
      </p>
      {onAdd && (
        <Button onClick={onAdd} className="bg-amber-600 hover:bg-amber-700" data-testid="button-empty-add-milestone">
          <Plus className="h-4 w-4 ml-1" /> إضافة أول مرحلة
        </Button>
      )}
    </div>
  );
}

function MilestonesTimeline({
  milestones, contract, onEdit, onDelete, onRequestPayment,
}: {
  milestones: ContractMilestone[];
  contract: ConstructionContract;
  onEdit?: (m: ContractMilestone) => void;
  onDelete?: (m: ContractMilestone) => void;
  onRequestPayment?: (m: ContractMilestone) => void;
}) {
  return (
    <div className="space-y-3">
      {milestones.map((m, idx) => {
        const meta = STATUS_META[m.status] || STATUS_META.pending;
        const StatusIcon = meta.icon;
        const isLast = idx === milestones.length - 1;
        return (
          <div key={m.id} className="relative" data-testid={`milestone-${m.id}`}>
            {/* Vertical line */}
            {!isLast && <div className="absolute right-[14px] top-8 bottom-[-12px] w-0.5 bg-gray-200" />}
            <div className="flex gap-3">
              {/* Status dot */}
              <div className={`shrink-0 w-7 h-7 rounded-full ${meta.color} flex items-center justify-center text-white text-xs font-bold relative z-10`}>
                {m.sequence}
              </div>
              {/* Card */}
              <div className="flex-1 border border-gray-200 rounded-xl p-3 bg-white hover:border-amber-300 transition">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold" data-testid={`text-milestone-title-${m.id}`}>{m.title}</h4>
                      <Badge className={meta.color + " text-white"} data-testid={`badge-milestone-status-${m.id}`}>
                        <StatusIcon className="h-3 w-3 ml-1" />
                        {meta.label}
                      </Badge>
                      {m.amountType === "percentage" && m.percentage != null && (
                        <Badge variant="outline">{m.percentage}% من العقد</Badge>
                      )}
                    </div>
                    {m.description && (
                      <p className="text-xs text-muted-foreground mt-1">{m.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2 flex-wrap">
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        <span className="font-semibold text-foreground" data-testid={`text-milestone-amount-${m.id}`}>{formatSAR(m.amount)}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {TRIGGER_LABELS[m.triggerType] || m.triggerType}
                      </span>
                      {m.dueDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          الاستحقاق: {m.dueDate}
                        </span>
                      )}
                      {m.paymentRequestId && (
                        <Badge variant="secondary" className="text-xs">طلب صرف #{m.paymentRequestId}</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {onRequestPayment && !m.paymentRequestId && m.status !== "paid" && m.status !== "cancelled" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
                        onClick={() => onRequestPayment(m)}
                        data-testid={`button-request-payment-${m.id}`}
                      >
                        <Send className="h-3 w-3 ml-1" /> طلب صرف
                      </Button>
                    )}
                    {onEdit && (
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onEdit(m)} data-testid={`button-edit-milestone-${m.id}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {onDelete && !m.paymentRequestId && (
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:text-red-700" onClick={() => onDelete(m)} data-testid={`button-delete-milestone-${m.id}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
