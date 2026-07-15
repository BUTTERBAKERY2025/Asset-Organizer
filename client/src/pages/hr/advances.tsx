import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Wallet, Plus, Trash2, TrendingDown, Calendar, ArrowRight, Clock, CheckCircle2, XCircle, Inbox, FileSignature, Banknote, History } from "lucide-react";
import { Layout } from "@/components/layout";
import { Link } from "wouter";
import { ADVANCE_REQUEST_STATUS_LABELS } from "@shared/schema";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/hooks/useAuth";

type Adv = any;
type Emp = { id: number; employeeName: string; jobTitle: string; branchId: string };

const initialForm = {
  branchEmployeeId: "",
  branchId: "",
  month: new Date().toISOString().slice(0, 7),
  type: "advance",
  amount: "",
  description: "",
};

export default function AdvancesPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { hasPermission } = usePermissions();
  const { user } = useAuth();
  // القرار النهائي — مطابق لمنطق الخادم hasAdvanceFinalAuthority:
  // admin/super_admin/hr_manager دائماً، و hr_specialist بشرط صلاحية التعديل.
  const role = user?.role || "";
  const canFinal =
    ["admin", "super_admin", "hr_manager"].includes(role) ||
    (role === "hr_specialist" && hasPermission("hr_advances", "edit"));
  const canCreate = hasPermission("hr_advances", "create");
  const canDelete = hasPermission("hr_advances", "delete");
  const [filterMonth, setFilterMonth] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<typeof initialForm>(initialForm);

  const { data: advances = [], isLoading } = useQuery<Adv[]>({
    queryKey: ["/api/hr/advances", filterMonth, filterType],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterMonth) params.set("month", filterMonth);
      if (filterType !== "all") params.set("type", filterType);
      return (await apiRequest("GET", `/api/hr/advances?${params}`)).json();
    },
  });

  const { data: stats } = useQuery<any>({
    queryKey: ["/api/hr/advances/stats"],
    queryFn: async () => (await apiRequest("GET", "/api/hr/advances/stats")).json(),
  });

  const { data: employees = [] } = useQuery<Emp[]>({
    queryKey: ["/api/branch-employees"],
    queryFn: async () => (await apiRequest("GET", "/api/branch-employees")).json(),
  });

  const { data: pendingRequests = [] } = useQuery<any[]>({
    queryKey: ["/api/hr/advance-requests", "open"],
    queryFn: async () => {
      const statuses = ["pending", "pre_approved", "awaiting_signature", "signed", "approved"];
      const lists = await Promise.all(
        statuses.map(async (s) => (await apiRequest("GET", `/api/hr/advance-requests?status=${s}`)).json()),
      );
      return lists.flat();
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, decision, note }: { id: number; decision: "approved" | "rejected"; note?: string }) =>
      (await apiRequest("POST", `/api/hr/advance-requests/${id}/review`, { decision, note })).json(),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["/api/hr/advance-requests"] });
      qc.invalidateQueries({ queryKey: ["/api/hr/advances"] });
      qc.invalidateQueries({ queryKey: ["/api/hr/advances/stats"] });
      toast({ title: vars.decision === "approved" ? "تم اعتماد الطلب" : "تم رفض الطلب" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message || "فشل تنفيذ الإجراء", variant: "destructive" }),
  });

  // مراجعة شؤون الموظفين: تعديل القيمة + عدد الأقساط ثم إرسال للتوقيع
  const [reviewReq, setReviewReq] = useState<any | null>(null);
  const [reviewForm, setReviewForm] = useState({ approvedAmount: "", installmentMonths: "1", startMonth: "", note: "" });
  const sendForSignature = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) =>
      (await apiRequest("POST", `/api/hr/advance-requests/${id}/send-for-signature`, payload)).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/hr/advance-requests"] });
      toast({ title: "تم إرسال النموذج لتوقيع الموظف" });
      setReviewReq(null);
    },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message || "فشل الإرسال", variant: "destructive" }),
  });

  const disburseMutation = useMutation({
    mutationFn: async (id: number) => (await apiRequest("POST", `/api/hr/advance-requests/${id}/disburse`)).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/hr/advance-requests"] });
      toast({ title: "تم تسجيل صرف السلفة" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message || "فشل تسجيل الصرف", variant: "destructive" }),
  });

  // إدخال سلفة سابقة (قديمة)
  const [legacyOpen, setLegacyOpen] = useState(false);
  const [legacyForm, setLegacyForm] = useState({ branchEmployeeId: "", totalAmount: "", repaidAmount: "0", installmentMonths: "1", startMonth: new Date().toISOString().slice(0, 7), reason: "" });
  const legacyMutation = useMutation({
    mutationFn: async (payload: any) => (await apiRequest("POST", "/api/hr/advance-requests/legacy", payload)).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/hr/advance-requests"] });
      qc.invalidateQueries({ queryKey: ["/api/hr/advances"] });
      qc.invalidateQueries({ queryKey: ["/api/hr/advances/stats"] });
      toast({ title: "تم تسجيل السلفة السابقة وربط أقساطها بالراتب" });
      setLegacyOpen(false);
      setLegacyForm({ branchEmployeeId: "", totalAmount: "", repaidAmount: "0", installmentMonths: "1", startMonth: new Date().toISOString().slice(0, 7), reason: "" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message || "فشل التسجيل", variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return advances;
    const q = search.toLowerCase();
    return advances.filter((a: any) => (a.employeeName || "").toLowerCase().includes(q));
  }, [advances, search]);

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => (await apiRequest("POST", "/api/hr/advances", payload)).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/hr/advances"] });
      qc.invalidateQueries({ queryKey: ["/api/hr/advances/stats"] });
      toast({ title: "تم التسجيل" });
      setForm(initialForm);
      setOpen(false);
    },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message || "فشل الحفظ", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/hr/advances/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/hr/advances"] });
      qc.invalidateQueries({ queryKey: ["/api/hr/advances/stats"] });
      toast({ title: "تم الحذف" });
    },
  });

  const submit = () => {
    if (!form.branchEmployeeId || !form.amount) {
      toast({ title: "بيانات ناقصة", variant: "destructive" });
      return;
    }
    const emp = employees.find((e) => e.id === parseInt(form.branchEmployeeId, 10));
    if (!emp) return;
    saveMutation.mutate({
      branchEmployeeId: parseInt(form.branchEmployeeId, 10),
      branchId: emp.branchId,
      month: form.month,
      type: form.type,
      amount: parseFloat(form.amount),
      description: form.description,
    });
  };

  return (
    <Layout>
    <div className="container mx-auto p-4 space-y-4" dir="rtl" data-testid="page-hr-advances">
      <Link href="/hr-hub">
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" data-testid="button-back-hr-hub">
          <ArrowRight className="h-4 w-4 ms-1" />العودة لمركز الموارد البشرية
        </Button>
      </Link>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Wallet className="h-7 w-7 text-emerald-600" />
          <div>
            <h1 className="text-2xl font-bold">السلف والقروض</h1>
            <p className="text-sm text-muted-foreground">إدارة السلف وأقساط القروض على الموظفين (تُخصم تلقائياً من الراتب)</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canFinal && (
            <Button variant="outline" onClick={() => setLegacyOpen(true)} data-testid="button-add-legacy-advance">
              <History className="h-4 w-4 ms-2" />إدخال سلفة سابقة
            </Button>
          )}
          {canCreate && (
            <Button onClick={() => setOpen(true)} data-testid="button-add-advance">
              <Plus className="h-4 w-4 ms-2" />تسجيل سلفة / قسط
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard label="إجمالي السلف" value={stats?.total ?? 0} icon={<Wallet className="h-5 w-5" />} />
        <StatCard label="إجمالي المبالغ (ر.س)" value={Number(stats?.totalAmount || 0).toFixed(2)} icon={<TrendingDown className="h-5 w-5" />} accent="amber" />
        <StatCard label="هذا الشهر (ر.س)" value={Number(stats?.thisMonthAmount || 0).toFixed(2)} icon={<Calendar className="h-5 w-5" />} accent="blue" />
      </div>

      {pendingRequests.length > 0 && (
        <Card className="border-amber-300 dark:border-amber-800">
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center gap-2">
              <Inbox className="h-5 w-5 text-amber-600" />
              <h2 className="text-lg font-bold">طلبات السلف الجارية</h2>
              <Badge className="bg-amber-100 text-amber-700">{pendingRequests.length}</Badge>
            </div>
            <div className="space-y-2">
              {pendingRequests.map((r: any) => {
                const statusCls: Record<string, string> = {
                  pending: "bg-amber-50 text-amber-700 border-amber-200",
                  pre_approved: "bg-blue-50 text-blue-700 border-blue-200",
                  awaiting_signature: "bg-sky-50 text-sky-700 border-sky-200",
                  signed: "bg-indigo-50 text-indigo-700 border-indigo-200",
                  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
                };
                return (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border bg-card" data-testid={`row-request-${r.id}`}>
                  <div className="space-y-0.5">
                    <div className="font-semibold flex items-center gap-2">
                      {r.employeeName || "-"}
                      <span className="text-xs text-muted-foreground font-normal">{r.branchName || ""}</span>
                      {r.isLegacy && <Badge variant="outline" className="text-xs">سلفة سابقة</Badge>}
                    </div>
                    <div className="text-sm">
                      <span className="font-bold tabular-nums">{Number(r.approvedAmount ?? r.amount).toLocaleString("ar-SA-u-nu-latn")} ر.س</span>
                      {r.approvedAmount != null && r.approvedAmount !== r.amount && (
                        <span className="text-xs text-muted-foreground"> (المطلوب {Number(r.amount).toLocaleString("ar-SA-u-nu-latn")})</span>
                      )}
                      {r.installmentMonths
                        ? <span className="text-muted-foreground"> · {r.installmentMonths} قسطاً × {Number(r.monthlyInstallment).toLocaleString("ar-SA-u-nu-latn")} ر.س بدءاً من {r.startMonth}</span>
                        : <span className="text-muted-foreground"> · شهر الخصم {r.requestedMonth}</span>}
                    </div>
                    {r.reason && <div className="text-xs text-muted-foreground">{r.reason}</div>}
                    {r.signedAt && <div className="text-xs text-emerald-700">وقّع الموظف في {new Date(r.signedAt).toLocaleDateString("ar-SA-u-nu-latn")}</div>}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={`gap-1 ${statusCls[r.status] || statusCls.pending}`}>
                      <Clock className="h-3 w-3" />{ADVANCE_REQUEST_STATUS_LABELS[r.status] || r.status}
                    </Badge>

                    {/* مدير التشغيل: موافقة مبدئية فقط على الطلبات الجديدة */}
                    {!canFinal && r.status === "pending" && (
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700"
                        disabled={reviewMutation.isPending}
                        onClick={() => {
                          if (confirm("موافقة مبدئية على طلب السلفة؟ سينتقل الطلب لإدارة شؤون الموظفين للمراجعة.")) reviewMutation.mutate({ id: r.id, decision: "approved" });
                        }}
                        data-testid={`button-approve-${r.id}`}>
                        <CheckCircle2 className="h-4 w-4 ms-1" />موافقة مبدئية
                      </Button>
                    )}

                    {/* شؤون الموظفين: مراجعة وإرسال للتوقيع */}
                    {canFinal && ["pending", "pre_approved", "awaiting_signature"].includes(r.status) && (
                      <Button size="sm" variant={r.status === "awaiting_signature" ? "outline" : "default"}
                        onClick={() => {
                          setReviewForm({
                            approvedAmount: String(r.approvedAmount ?? r.amount),
                            installmentMonths: String(r.installmentMonths ?? r.installments ?? 1),
                            startMonth: r.startMonth || r.requestedMonth,
                            note: "",
                          });
                          setReviewReq(r);
                        }}
                        data-testid={`button-review-${r.id}`}>
                        <FileSignature className="h-4 w-4 ms-1" />{r.status === "awaiting_signature" ? "تعديل وإعادة إرسال" : "مراجعة وإرسال للتوقيع"}
                      </Button>
                    )}
                    {r.status === "awaiting_signature" && (
                      <span className="text-xs text-muted-foreground">بانتظار توقيع الموظف من بوابته</span>
                    )}

                    {/* الاعتماد النهائي بعد التوقيع — شؤون الموظفين/الأدمن فقط */}
                    {canFinal && r.status === "signed" && (
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700"
                        disabled={reviewMutation.isPending}
                        onClick={() => {
                          if (confirm(`اعتماد نهائي للسلفة؟ ستُنشأ ${r.installmentMonths ?? 1} أقساط خصم شهرية تلقائياً وتُحوّل للإدارة المالية للصرف.`)) reviewMutation.mutate({ id: r.id, decision: "approved" });
                        }}
                        data-testid={`button-final-approve-${r.id}`}>
                        <CheckCircle2 className="h-4 w-4 ms-1" />اعتماد نهائي
                      </Button>
                    )}

                    {/* الصرف المالي بعد الاعتماد */}
                    {r.status === "approved" && (
                      <Button size="sm" variant="outline" className="border-emerald-300 text-emerald-700"
                        disabled={disburseMutation.isPending}
                        onClick={() => { if (confirm("تأكيد صرف السلفة للموظف؟")) disburseMutation.mutate(r.id); }}
                        data-testid={`button-disburse-${r.id}`}>
                        <Banknote className="h-4 w-4 ms-1" />تسجيل الصرف
                      </Button>
                    )}

                    {/* الرفض متاح لشؤون الموظفين في كل المراحل، ولمدير التشغيل على الجديد فقط */}
                    {((canFinal && r.status !== "approved") || (!canFinal && r.status === "pending")) && (
                      <Button size="sm" variant="outline" className="text-destructive border-destructive/30"
                        disabled={reviewMutation.isPending}
                        onClick={() => { const note = prompt("سبب الرفض (اختياري):") ?? undefined; reviewMutation.mutate({ id: r.id, decision: "rejected", note }); }}
                        data-testid={`button-reject-${r.id}`}>
                        <XCircle className="h-4 w-4 ms-1" />رفض
                      </Button>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Input placeholder="بحث باسم الموظف" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search" />
            <Input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} placeholder="الشهر" data-testid="input-filter-month" />
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger data-testid="select-filter-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأنواع</SelectItem>
                <SelectItem value="advance">سلفة</SelectItem>
                <SelectItem value="loan_installment">قسط قرض</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-right p-2">الموظف</th>
                  <th className="text-right p-2">النوع</th>
                  <th className="text-right p-2">الشهر</th>
                  <th className="text-right p-2">المبلغ (ر.س)</th>
                  <th className="text-right p-2">الوصف</th>
                  <th className="text-right p-2">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">جاري التحميل...</td></tr>}
                {!isLoading && filtered.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">لا توجد سلف</td></tr>}
                {filtered.map((a: any) => (
                  <tr key={a.id} className="border-t hover:bg-slate-50" data-testid={`row-advance-${a.id}`}>
                    <td className="p-2">
                      <div className="font-medium">{a.employeeName || "-"}</div>
                      <div className="text-xs text-muted-foreground">{a.employeeJob || ""}</div>
                    </td>
                    <td className="p-2">
                      {a.type === "advance"
                        ? <Badge className="bg-amber-100 text-amber-700">سلفة</Badge>
                        : <Badge className="bg-blue-100 text-blue-700">قسط قرض</Badge>}
                    </td>
                    <td className="p-2 font-mono text-xs">{a.month}</td>
                    <td className="p-2 tabular-nums font-bold">{Number(a.amount).toLocaleString("ar-SA-u-nu-latn")}</td>
                    <td className="p-2 text-xs text-muted-foreground max-w-xs truncate" title={a.description}>{a.description || "-"}</td>
                    <td className="p-2">
                      {canDelete && (
                        <Button size="sm" variant="ghost" onClick={() => { if (confirm("حذف هذه السلفة؟")) deleteMutation.mutate(a.id); }} data-testid={`button-delete-${a.id}`}>
                          <Trash2 className="h-3.5 w-3.5 text-red-600" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(o) => { if (!o) { setForm(initialForm); setOpen(false); } else setOpen(true); }}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader><DialogTitle>تسجيل سلفة / قسط قرض</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>الموظف</Label>
              <Select value={form.branchEmployeeId} onValueChange={(v) => {
                const emp = employees.find((e) => e.id === parseInt(v, 10));
                setForm({ ...form, branchEmployeeId: v, branchId: emp?.branchId || "" });
              }}>
                <SelectTrigger data-testid="select-employee"><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
                <SelectContent>
                  {employees.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.employeeName} — {e.jobTitle}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>النوع</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger data-testid="select-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="advance">سلفة</SelectItem>
                    <SelectItem value="loan_installment">قسط قرض</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>شهر الخصم</Label>
                <Input type="month" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} data-testid="input-month" />
              </div>
            </div>
            <div>
              <Label>المبلغ (ر.س)</Label>
              <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} data-testid="input-amount" />
            </div>
            <div>
              <Label>وصف / سبب السلفة</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="textarea-description" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setForm(initialForm); setOpen(false); }}>إلغاء</Button>
            <Button onClick={submit} disabled={saveMutation.isPending} data-testid="button-save-advance">
              {saveMutation.isPending ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* مراجعة الطلب وإرساله لتوقيع الموظف */}
      <Dialog open={reviewReq !== null} onOpenChange={(o) => { if (!o) setReviewReq(null); }}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader><DialogTitle>مراجعة طلب السلفة وإرساله للتوقيع</DialogTitle></DialogHeader>
          {reviewReq && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                الموظف: <span className="font-semibold text-foreground">{reviewReq.employeeName}</span>
                {" · "}المبلغ المطلوب: <span className="font-semibold text-foreground tabular-nums">{Number(reviewReq.amount).toLocaleString("ar-SA-u-nu-latn")} ر.س</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>القيمة المعتمدة (ر.س)</Label>
                  <Input type="number" step="0.01" value={reviewForm.approvedAmount}
                    onChange={(e) => setReviewForm({ ...reviewForm, approvedAmount: e.target.value })}
                    data-testid="input-approved-amount" />
                </div>
                <div>
                  <Label>عدد الأقساط الشهرية</Label>
                  <Input type="number" min="1" max="36" value={reviewForm.installmentMonths}
                    onChange={(e) => setReviewForm({ ...reviewForm, installmentMonths: e.target.value })}
                    data-testid="input-installment-months" />
                </div>
              </div>
              <div>
                <Label>شهر بداية الخصم</Label>
                <Input type="month" value={reviewForm.startMonth}
                  onChange={(e) => setReviewForm({ ...reviewForm, startMonth: e.target.value })}
                  data-testid="input-start-month" />
              </div>
              {Number(reviewForm.approvedAmount) > 0 && Number(reviewForm.installmentMonths) > 0 && (
                <div className="rounded-lg border bg-muted/40 p-3 text-sm" data-testid="text-installment-preview">
                  القسط الشهري: <span className="font-bold tabular-nums">
                    {(Math.round((Number(reviewForm.approvedAmount) / Number(reviewForm.installmentMonths)) * 100) / 100).toLocaleString("ar-SA-u-nu-latn")} ر.س
                  </span> × {reviewForm.installmentMonths} شهراً (القسط الأخير قد يختلف قليلاً لموازنة التقريب)
                </div>
              )}
              <div>
                <Label>ملاحظة للموظف (اختياري)</Label>
                <Textarea value={reviewForm.note} onChange={(e) => setReviewForm({ ...reviewForm, note: e.target.value })} data-testid="textarea-review-note" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewReq(null)}>إلغاء</Button>
            <Button
              disabled={sendForSignature.isPending || !reviewReq || !(Number(reviewForm.approvedAmount) > 0) || !(Number(reviewForm.installmentMonths) >= 1) || !reviewForm.startMonth}
              onClick={() => sendForSignature.mutate({
                id: reviewReq.id,
                payload: {
                  approvedAmount: Number(reviewForm.approvedAmount),
                  installmentMonths: parseInt(reviewForm.installmentMonths, 10),
                  startMonth: reviewForm.startMonth,
                  note: reviewForm.note || undefined,
                },
              })}
              data-testid="button-send-for-signature">
              <FileSignature className="h-4 w-4 ms-1" />{sendForSignature.isPending ? "جاري الإرسال..." : "إرسال لتوقيع الموظف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* إدخال سلفة سابقة (بدون توقيع) */}
      <Dialog open={legacyOpen} onOpenChange={setLegacyOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader><DialogTitle>إدخال سلفة سابقة</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              لتسجيل السلف القائمة قبل تطبيق النظام: تُسجّل معتمدة مباشرة بدون توقيع، وتُنشأ أقساط الخصم للمتبقي فقط.
            </p>
            <div>
              <Label>الموظف</Label>
              <Select value={legacyForm.branchEmployeeId} onValueChange={(v) => setLegacyForm({ ...legacyForm, branchEmployeeId: v })}>
                <SelectTrigger data-testid="select-legacy-employee"><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
                <SelectContent>
                  {employees.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.employeeName} — {e.jobTitle}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>إجمالي السلفة (ر.س)</Label>
                <Input type="number" step="0.01" value={legacyForm.totalAmount}
                  onChange={(e) => setLegacyForm({ ...legacyForm, totalAmount: e.target.value })} data-testid="input-legacy-total" />
              </div>
              <div>
                <Label>المسدَّد سابقاً (ر.س)</Label>
                <Input type="number" step="0.01" min="0" value={legacyForm.repaidAmount}
                  onChange={(e) => setLegacyForm({ ...legacyForm, repaidAmount: e.target.value })} data-testid="input-legacy-repaid" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>عدد أقساط المتبقي</Label>
                <Input type="number" min="1" max="36" value={legacyForm.installmentMonths}
                  onChange={(e) => setLegacyForm({ ...legacyForm, installmentMonths: e.target.value })} data-testid="input-legacy-months" />
              </div>
              <div>
                <Label>شهر بداية الخصم</Label>
                <Input type="month" value={legacyForm.startMonth}
                  onChange={(e) => setLegacyForm({ ...legacyForm, startMonth: e.target.value })} data-testid="input-legacy-start-month" />
              </div>
            </div>
            {Number(legacyForm.totalAmount) > 0 && (
              <div className="rounded-lg border bg-muted/40 p-3 text-sm" data-testid="text-legacy-remaining">
                المتبقي للخصم: <span className="font-bold tabular-nums">
                  {Math.max(0, Number(legacyForm.totalAmount) - Number(legacyForm.repaidAmount || 0)).toLocaleString("ar-SA-u-nu-latn")} ر.س
                </span>
              </div>
            )}
            <div>
              <Label>ملاحظة / سبب (اختياري)</Label>
              <Textarea value={legacyForm.reason} onChange={(e) => setLegacyForm({ ...legacyForm, reason: e.target.value })} data-testid="textarea-legacy-reason" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLegacyOpen(false)}>إلغاء</Button>
            <Button
              disabled={legacyMutation.isPending || !legacyForm.branchEmployeeId || !(Number(legacyForm.totalAmount) > 0) || Number(legacyForm.repaidAmount || 0) >= Number(legacyForm.totalAmount) || !(Number(legacyForm.installmentMonths) >= 1) || !legacyForm.startMonth}
              onClick={() => legacyMutation.mutate({
                branchEmployeeId: parseInt(legacyForm.branchEmployeeId, 10),
                totalAmount: Number(legacyForm.totalAmount),
                repaidAmount: Number(legacyForm.repaidAmount || 0),
                installmentMonths: parseInt(legacyForm.installmentMonths, 10),
                startMonth: legacyForm.startMonth,
                reason: legacyForm.reason || undefined,
              })}
              data-testid="button-save-legacy">
              <History className="h-4 w-4 ms-1" />{legacyMutation.isPending ? "جاري الحفظ..." : "تسجيل السلفة السابقة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </Layout>
  );
}

function StatCard({ label, value, icon, accent = "emerald" }: { label: string; value: any; icon: any; accent?: string }) {
  const accents: Record<string, string> = {
    amber: "bg-amber-50 text-amber-700",
    emerald: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
  };
  return (
    <Card>
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground mb-1">{label}</div>
          <div className="text-2xl font-bold tabular-nums">{typeof value === "string" ? value : Number(value).toLocaleString("ar-SA-u-nu-latn")}</div>
        </div>
        <div className={`p-2 rounded-lg ${accents[accent] || accents.emerald}`}>{icon}</div>
      </CardContent>
    </Card>
  );
}
