import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Plus, Pencil, Trash2, Loader2, FileText, ShieldCheck, AlertTriangle,
  CheckCircle2, XCircle, Clock, Banknote,
} from "lucide-react";
import type { ContractVariation, ContractGuarantee } from "@shared/schema";

function formatSAR(n?: number | null) {
  if (n == null) return "0 ريال";
  return new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(n) + " ريال";
}

function daysUntil(dateStr?: string | null) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

const VO_TYPE_LABELS: Record<string, string> = {
  addition: "إضافة",
  deduction: "تخفيض",
  scope_change: "تغيير نطاق",
  time_extension: "تمديد مدة",
};

const VO_STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: "مسودة", color: "bg-gray-400", icon: Clock },
  pending_approval: { label: "بانتظار الاعتماد", color: "bg-amber-500", icon: Clock },
  approved: { label: "معتمد", color: "bg-emerald-500", icon: CheckCircle2 },
  rejected: { label: "مرفوض", color: "bg-red-500", icon: XCircle },
};

const G_TYPE_LABELS: Record<string, string> = {
  bid: "ضمان ابتدائي",
  performance: "حسن التنفيذ",
  advance: "دفعة مقدمة",
  maintenance: "الصيانة",
};

// ============================================================
// أوامر التغيير (Variation Orders)
// ============================================================
export function ContractVariationsCard({
  contractId, canEdit, canDelete, canCreate,
}: { contractId: number; canEdit: boolean; canDelete: boolean; canCreate: boolean }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ContractVariation | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContractVariation | null>(null);
  const [approveTarget, setApproveTarget] = useState<ContractVariation | null>(null);
  const [rejectTarget, setRejectTarget] = useState<ContractVariation | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [form, setForm] = useState({
    variationNumber: "",
    title: "",
    description: "",
    type: "addition",
    amount: 0,
    durationChangeDays: 0,
    reason: "",
    status: "draft",
  });

  const { data: variations = [], isLoading } = useQuery<ContractVariation[]>({
    queryKey: [`/api/construction/contracts/${contractId}/variations`],
    enabled: !!contractId,
  });

  const totalApproved = variations
    .filter((v) => v.status === "approved")
    .reduce((s, v) => s + (v.amount || 0), 0);

  const openAdd = () => {
    setEditTarget(null);
    setForm({
      variationNumber: `VO-${String(variations.length + 1).padStart(3, "0")}`,
      title: "",
      description: "",
      type: "addition",
      amount: 0,
      durationChangeDays: 0,
      reason: "",
      status: "draft",
    });
    setIsFormOpen(true);
  };

  const openEdit = (v: ContractVariation) => {
    setEditTarget(v);
    setForm({
      variationNumber: v.variationNumber,
      title: v.title,
      description: v.description || "",
      type: v.type,
      amount: v.amount,
      durationChangeDays: v.durationChangeDays || 0,
      reason: v.reason || "",
      status: v.status,
    });
    setIsFormOpen(true);
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [`/api/construction/contracts/${contractId}/variations`] });
    qc.invalidateQueries({ queryKey: [`/api/construction/contracts/${contractId}`] });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editTarget) {
        const res = await apiRequest("PATCH", `/api/construction/contract-variations/${editTarget.id}`, form);
        return res.json();
      }
      const res = await apiRequest("POST", `/api/construction/contract-variations`, { ...form, contractId });
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      setIsFormOpen(false);
      toast({ title: editTarget ? "تم التحديث" : "تم إنشاء أمر التغيير" });
    },
    onError: (e: any) => toast({ title: "فشل الحفظ", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/construction/contract-variations/${id}`);
      return res.json();
    },
    onSuccess: () => { invalidate(); setDeleteTarget(null); toast({ title: "تم الحذف" }); },
    onError: (e: any) => toast({ title: "فشل الحذف", description: e.message, variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/construction/contract-variations/${id}/approve`, {});
      return res.json();
    },
    onSuccess: () => { invalidate(); setApproveTarget(null); toast({ title: "تم اعتماد أمر التغيير", description: "تم تحديث قيمة العقد تلقائياً" }); },
    onError: (e: any) => toast({ title: "فشل الاعتماد", description: e.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: async (data: { id: number; reason: string }) => {
      const res = await apiRequest("POST", `/api/construction/contract-variations/${data.id}/reject`, { reason: data.reason });
      return res.json();
    },
    onSuccess: () => { invalidate(); setRejectTarget(null); setRejectReason(""); toast({ title: "تم رفض أمر التغيير" }); },
    onError: (e: any) => toast({ title: "فشل الرفض", description: e.message, variant: "destructive" }),
  });

  return (
    <>
      <Card className="border-blue-200 bg-blue-50/30">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5 text-blue-600" />
              أوامر التغيير (Variation Orders)
            </CardTitle>
            <CardDescription>
              توثيق أي زيادة، تخفيض، أو تمديد مدة على العقد. الاعتماد يُحدّث قيمة العقد تلقائياً.
            </CardDescription>
          </div>
          {canCreate && (
            <Button onClick={openAdd} size="sm" className="bg-blue-600 hover:bg-blue-700" data-testid="button-add-variation">
              <Plus className="h-4 w-4 ml-1" /> أمر تغيير
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-6"><Loader2 className="h-5 w-5 animate-spin mx-auto text-blue-600" /></div>
          ) : variations.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">لا توجد أوامر تغيير على هذا العقد</div>
          ) : (
            <>
              <div className="mb-3 p-3 rounded-lg bg-white border text-sm flex items-center justify-between">
                <span className="text-muted-foreground">صافي التعديلات المعتمدة على قيمة العقد:</span>
                <span className={`font-bold ${totalApproved >= 0 ? "text-emerald-700" : "text-red-700"}`} data-testid="text-vo-net-total">
                  {totalApproved >= 0 ? "+" : ""}{formatSAR(totalApproved)}
                </span>
              </div>
              <div className="space-y-2">
                {variations.map((v) => {
                  const meta = VO_STATUS_META[v.status] || VO_STATUS_META.draft;
                  const StatusIcon = meta.icon;
                  return (
                    <div
                      key={v.id}
                      className="p-3 rounded-lg bg-white border flex flex-wrap items-center gap-3"
                      data-testid={`row-variation-${v.id}`}
                    >
                      <div className={`h-8 w-8 rounded-full ${meta.color} text-white flex items-center justify-center flex-shrink-0`}>
                        <StatusIcon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-[200px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-muted-foreground">{v.variationNumber}</span>
                          <span className="font-semibold" data-testid={`text-vo-title-${v.id}`}>{v.title}</span>
                          <Badge variant="outline" className="text-xs">{VO_TYPE_LABELS[v.type] || v.type}</Badge>
                          <Badge className={`text-xs text-white ${meta.color}`}>{meta.label}</Badge>
                        </div>
                        {v.description && <div className="text-xs text-muted-foreground mt-1">{v.description}</div>}
                        {v.rejectionReason && <div className="text-xs text-red-600 mt-1">سبب الرفض: {v.rejectionReason}</div>}
                        <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                          {v.amount !== 0 && (
                            <span className={v.amount > 0 ? "text-emerald-700" : "text-red-700"}>
                              {v.amount > 0 ? "+" : ""}{formatSAR(v.amount)}
                            </span>
                          )}
                          {(v.durationChangeDays || 0) !== 0 && (
                            <span>{(v.durationChangeDays || 0) > 0 ? "+" : ""}{v.durationChangeDays} يوم</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {v.status !== "approved" && v.status !== "rejected" && canEdit && (
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setApproveTarget(v)} disabled={approveMutation.isPending} data-testid={`button-approve-vo-${v.id}`}>
                            <CheckCircle2 className="h-3.5 w-3.5 ml-1" /> اعتماد
                          </Button>
                        )}
                        {v.status !== "approved" && v.status !== "rejected" && canEdit && (
                          <Button size="sm" variant="outline" className="text-red-600" onClick={() => setRejectTarget(v)} disabled={rejectMutation.isPending} data-testid={`button-reject-vo-${v.id}`}>
                            <XCircle className="h-3.5 w-3.5 ml-1" /> رفض
                          </Button>
                        )}
                        {v.status !== "approved" && canEdit && (
                          <Button size="sm" variant="ghost" onClick={() => openEdit(v)} disabled={saveMutation.isPending} data-testid={`button-edit-vo-${v.id}`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {v.status !== "approved" && canDelete && (
                          <Button size="sm" variant="ghost" className="text-red-500" onClick={() => setDeleteTarget(v)} disabled={deleteMutation.isPending} data-testid={`button-delete-vo-${v.id}`}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Variation form */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editTarget ? "تعديل أمر تغيير" : "أمر تغيير جديد"}</DialogTitle>
            <DialogDescription>وثّق أي زيادة أو تخفيض أو تمديد مدة على العقد</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>رقم الأمر</Label>
                <Input value={form.variationNumber} onChange={(e) => setForm({ ...form, variationNumber: e.target.value })} data-testid="input-vo-number" />
              </div>
              <div>
                <Label>النوع</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger data-testid="select-vo-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(VO_TYPE_LABELS).map(([k, label]) => (
                      <SelectItem key={k} value={k}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>العنوان</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} data-testid="input-vo-title" />
            </div>
            <div>
              <Label>الوصف</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} data-testid="input-vo-description" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>المبلغ (ريال)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
                  data-testid="input-vo-amount"
                />
                <p className="text-xs text-muted-foreground mt-1">موجب=زيادة، سالب=تخفيض</p>
              </div>
              <div>
                <Label>تغيير المدة (أيام)</Label>
                <Input
                  type="number"
                  value={form.durationChangeDays}
                  onChange={(e) => setForm({ ...form, durationChangeDays: parseInt(e.target.value) || 0 })}
                  data-testid="input-vo-days"
                />
              </div>
            </div>
            <div>
              <Label>السبب</Label>
              <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={2} data-testid="input-vo-reason" />
            </div>
            <div>
              <Label>الحالة</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger data-testid="select-vo-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">مسودة</SelectItem>
                  <SelectItem value="pending_approval">بانتظار الاعتماد</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)} data-testid="button-cancel-vo">إلغاء</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.title || !form.variationNumber} className="bg-blue-600 hover:bg-blue-700" data-testid="button-save-vo">
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-1" />}
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve confirm */}
      <AlertDialog open={!!approveTarget} onOpenChange={(o) => !o && setApproveTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>اعتماد أمر التغيير</AlertDialogTitle>
            <AlertDialogDescription>
              عند الاعتماد، سيُضاف <strong>{formatSAR(approveTarget?.amount || 0)}</strong> إلى قيمة العقد تلقائياً.
              {(approveTarget?.durationChangeDays || 0) !== 0 && (
                <><br />تأكد من تحديث المدة يدوياً ({approveTarget?.durationChangeDays} يوم).</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-approve-vo">إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => approveTarget && approveMutation.mutate(approveTarget.id)} className="bg-emerald-600 hover:bg-emerald-700" data-testid="button-confirm-approve-vo">
              {approveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-1" />}
              تأكيد الاعتماد
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(o) => { if (!o) { setRejectTarget(null); setRejectReason(""); } }}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>رفض أمر التغيير</DialogTitle>
            <DialogDescription>اذكر سبب الرفض ليُحفظ في السجل</DialogDescription>
          </DialogHeader>
          <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} placeholder="سبب الرفض..." data-testid="input-reject-reason" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)} data-testid="button-cancel-reject-vo">إلغاء</Button>
            <Button
              onClick={() => rejectTarget && rejectMutation.mutate({ id: rejectTarget.id, reason: rejectReason.trim() })}
              disabled={!rejectReason.trim() || rejectMutation.isPending}
              variant="destructive"
              data-testid="button-confirm-reject-vo"
            >
              {rejectMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-1" />}
              رفض
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف أمر التغيير</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد؟ لا يمكن التراجع.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-vo">إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} className="bg-red-600 hover:bg-red-700" data-testid="button-confirm-delete-vo">
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-1" />}
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ============================================================
// الضمانات البنكية (Bank Guarantees)
// ============================================================
export function ContractGuaranteesCard({
  contractId, canEdit, canDelete, canCreate,
}: { contractId: number; canEdit: boolean; canDelete: boolean; canCreate: boolean }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ContractGuarantee | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContractGuarantee | null>(null);
  const [releaseTarget, setReleaseTarget] = useState<ContractGuarantee | null>(null);
  const [releaseNotes, setReleaseNotes] = useState("");
  const [form, setForm] = useState({
    guaranteeNumber: "",
    type: "performance",
    bankName: "",
    amount: 0,
    currency: "SAR",
    issueDate: "",
    expiryDate: "",
    notes: "",
  });

  const { data: guarantees = [], isLoading } = useQuery<ContractGuarantee[]>({
    queryKey: [`/api/construction/contracts/${contractId}/guarantees`],
    enabled: !!contractId,
  });

  const activeGuarantees = guarantees.filter((g) => g.status === "active");
  const totalActive = activeGuarantees.reduce((s, g) => s + (g.amount || 0), 0);

  const openAdd = () => {
    setEditTarget(null);
    setForm({
      guaranteeNumber: "",
      type: "performance",
      bankName: "",
      amount: 0,
      currency: "SAR",
      issueDate: new Date().toISOString().slice(0, 10),
      expiryDate: "",
      notes: "",
    });
    setIsFormOpen(true);
  };

  const openEdit = (g: ContractGuarantee) => {
    setEditTarget(g);
    setForm({
      guaranteeNumber: g.guaranteeNumber,
      type: g.type,
      bankName: g.bankName,
      amount: g.amount,
      currency: g.currency,
      issueDate: g.issueDate,
      expiryDate: g.expiryDate,
      notes: g.notes || "",
    });
    setIsFormOpen(true);
  };

  const invalidate = () => qc.invalidateQueries({ queryKey: [`/api/construction/contracts/${contractId}/guarantees`] });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editTarget) {
        const res = await apiRequest("PATCH", `/api/construction/contract-guarantees/${editTarget.id}`, form);
        return res.json();
      }
      const res = await apiRequest("POST", `/api/construction/contract-guarantees`, { ...form, contractId });
      return res.json();
    },
    onSuccess: () => { invalidate(); setIsFormOpen(false); toast({ title: editTarget ? "تم التحديث" : "تم إضافة الضمان" }); },
    onError: (e: any) => toast({ title: "فشل الحفظ", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/construction/contract-guarantees/${id}`);
      return res.json();
    },
    onSuccess: () => { invalidate(); setDeleteTarget(null); toast({ title: "تم الحذف" }); },
    onError: (e: any) => toast({ title: "فشل الحذف", description: e.message, variant: "destructive" }),
  });

  const releaseMutation = useMutation({
    mutationFn: async (data: { id: number; notes: string }) => {
      const res = await apiRequest("POST", `/api/construction/contract-guarantees/${data.id}/release`, { notes: data.notes });
      return res.json();
    },
    onSuccess: () => { invalidate(); setReleaseTarget(null); setReleaseNotes(""); toast({ title: "تم الإفراج عن الضمان" }); },
    onError: (e: any) => toast({ title: "فشل الإفراج", description: e.message, variant: "destructive" }),
  });

  return (
    <>
      <Card className="border-indigo-200 bg-indigo-50/30">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-5 w-5 text-indigo-600" />
              الضمانات البنكية
            </CardTitle>
            <CardDescription>
              ضمانات المقاول (ابتدائي، حسن تنفيذ، دفعة مقدمة، صيانة) مع تنبيه عند اقتراب انتهاء الصلاحية
            </CardDescription>
          </div>
          {canCreate && (
            <Button onClick={openAdd} size="sm" className="bg-indigo-600 hover:bg-indigo-700" data-testid="button-add-guarantee">
              <Plus className="h-4 w-4 ml-1" /> ضمان
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-6"><Loader2 className="h-5 w-5 animate-spin mx-auto text-indigo-600" /></div>
          ) : guarantees.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">لا توجد ضمانات بنكية مسجلة</div>
          ) : (
            <>
              <div className="mb-3 p-3 rounded-lg bg-white border text-sm flex items-center justify-between">
                <span className="text-muted-foreground">إجمالي الضمانات النشطة:</span>
                <span className="font-bold text-indigo-700" data-testid="text-active-guarantees-total">{formatSAR(totalActive)}</span>
              </div>
              <div className="space-y-2">
                {guarantees.map((g) => {
                  const days = daysUntil(g.expiryDate);
                  const isExpired = g.status === "active" && days != null && days < 0;
                  const isSoon = g.status === "active" && days != null && days >= 0 && days <= 30;
                  const effectiveStatus = isExpired ? "expired" : g.status;
                  return (
                    <div
                      key={g.id}
                      className="p-3 rounded-lg bg-white border flex flex-wrap items-center gap-3"
                      data-testid={`row-guarantee-${g.id}`}
                    >
                      <div className="h-10 w-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center flex-shrink-0">
                        <Banknote className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-[220px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-muted-foreground">{g.guaranteeNumber}</span>
                          <span className="font-semibold">{G_TYPE_LABELS[g.type] || g.type}</span>
                          <Badge variant="outline" className="text-xs">{g.bankName}</Badge>
                          {effectiveStatus === "active" && <Badge className="bg-emerald-500 text-white text-xs">نشط</Badge>}
                          {effectiveStatus === "expired" && <Badge className="bg-red-500 text-white text-xs">منتهي</Badge>}
                          {effectiveStatus === "released" && <Badge className="bg-gray-500 text-white text-xs">مُفرَج عنه</Badge>}
                          {effectiveStatus === "claimed" && <Badge className="bg-orange-500 text-white text-xs">مُصادر</Badge>}
                          {isSoon && (
                            <Badge className="bg-amber-500 text-white text-xs flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> ينتهي خلال {days} يوم
                            </Badge>
                          )}
                        </div>
                        <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="font-bold text-foreground">{formatSAR(g.amount)} {g.currency}</span>
                          <span>إصدار: {g.issueDate}</span>
                          <span>انتهاء: {g.expiryDate}</span>
                        </div>
                        {g.releaseNotes && <div className="text-xs text-muted-foreground mt-1">ملاحظات الإفراج: {g.releaseNotes}</div>}
                      </div>
                      <div className="flex gap-1">
                        {g.status === "active" && canEdit && (
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setReleaseTarget(g)} disabled={releaseMutation.isPending} data-testid={`button-release-guarantee-${g.id}`}>
                            <CheckCircle2 className="h-3.5 w-3.5 ml-1" /> إفراج
                          </Button>
                        )}
                        {g.status !== "released" && canEdit && (
                          <Button size="sm" variant="ghost" onClick={() => openEdit(g)} disabled={saveMutation.isPending} data-testid={`button-edit-guarantee-${g.id}`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {g.status !== "released" && canDelete && (
                          <Button size="sm" variant="ghost" className="text-red-500" onClick={() => setDeleteTarget(g)} disabled={deleteMutation.isPending} data-testid={`button-delete-guarantee-${g.id}`}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Guarantee form */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editTarget ? "تعديل الضمان" : "ضمان بنكي جديد"}</DialogTitle>
            <DialogDescription>سجّل بيانات الضمان البنكي المُقدَّم من المقاول</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>رقم الضمان</Label>
                <Input value={form.guaranteeNumber} onChange={(e) => setForm({ ...form, guaranteeNumber: e.target.value })} data-testid="input-g-number" />
              </div>
              <div>
                <Label>النوع</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger data-testid="select-g-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(G_TYPE_LABELS).map(([k, label]) => (
                      <SelectItem key={k} value={k}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>اسم البنك</Label>
              <Input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} data-testid="input-g-bank" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>المبلغ</Label>
                <Input type="number" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} data-testid="input-g-amount" />
              </div>
              <div>
                <Label>العملة</Label>
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                  <SelectTrigger data-testid="select-g-currency"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SAR">SAR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>تاريخ الإصدار</Label>
                <Input type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} data-testid="input-g-issue" />
              </div>
              <div>
                <Label>تاريخ الانتهاء</Label>
                <Input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} data-testid="input-g-expiry" />
              </div>
            </div>
            <div>
              <Label>ملاحظات</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} data-testid="input-g-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)} data-testid="button-cancel-g">إلغاء</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !form.guaranteeNumber || !form.bankName || !form.amount || !form.issueDate || !form.expiryDate}
              className="bg-indigo-600 hover:bg-indigo-700"
              data-testid="button-save-g"
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-1" />}
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Release guarantee */}
      <Dialog open={!!releaseTarget} onOpenChange={(o) => { if (!o) { setReleaseTarget(null); setReleaseNotes(""); } }}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>إفراج عن الضمان</DialogTitle>
            <DialogDescription>
              سيتم تعليم الضمان كـ "مُفرَج عنه". أضف ملاحظة إن أردت (اختياري).
            </DialogDescription>
          </DialogHeader>
          <Textarea value={releaseNotes} onChange={(e) => setReleaseNotes(e.target.value)} rows={2} placeholder="ملاحظات الإفراج..." data-testid="input-release-notes" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReleaseTarget(null)} data-testid="button-cancel-release-g">إلغاء</Button>
            <Button
              onClick={() => releaseTarget && releaseMutation.mutate({ id: releaseTarget.id, notes: releaseNotes.trim() })}
              disabled={releaseMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
              data-testid="button-confirm-release-g"
            >
              {releaseMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-1" />}
              تأكيد الإفراج
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الضمان</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد؟ لا يمكن التراجع.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-g">إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} className="bg-red-600 hover:bg-red-700" data-testid="button-confirm-delete-g">
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-1" />}
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
