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
import { Slider } from "@/components/ui/slider";
import { ClipboardCheck, Plus, CheckCircle2, Trash2, Eye, Star, Send, Pencil } from "lucide-react";
import { Layout } from "@/components/layout";
import { usePermissions } from "@/hooks/usePermissions";
import { EVALUATION_PERIOD_LABELS, DEFAULT_EVALUATION_CRITERIA } from "@shared/schema";

type Evaluation = any;
type Emp = { id: number; employeeName: string; jobTitle: string; branchId: string; status?: string };
type Branch = { id: string; name: string };

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  draft: { label: "مسودة", cls: "bg-slate-100 text-slate-700" },
  submitted: { label: "بانتظار الاعتماد", cls: "bg-amber-100 text-amber-700" },
  approved: { label: "معتمد", cls: "bg-emerald-100 text-emerald-700" },
};

const fmtScore = (n: any) => Number(n || 0).toLocaleString("ar-SA-u-nu-latn", { minimumFractionDigits: 1, maximumFractionDigits: 2 });

function scoreColor(s: number): string {
  if (s >= 4.5) return "text-emerald-600";
  if (s >= 3.5) return "text-lime-600";
  if (s >= 2.5) return "text-amber-600";
  return "text-red-600";
}

function scoreLabel(s: number): string {
  if (s >= 4.5) return "ممتاز";
  if (s >= 3.5) return "جيد جداً";
  if (s >= 2.5) return "جيد";
  if (s >= 1.5) return "مقبول";
  return "ضعيف";
}

const emptyForm = () => ({
  branchEmployeeId: "",
  periodType: "quarterly",
  periodStart: new Date(new Date().getFullYear(), Math.floor(new Date().getMonth() / 3) * 3, 1).toISOString().slice(0, 10),
  periodEnd: new Date().toISOString().slice(0, 10),
  criteria: DEFAULT_EVALUATION_CRITERIA.map(c => ({ ...c, score: 3, comment: "" })),
  strengths: "",
  improvements: "",
  goals: "",
  notes: "",
});

export default function EvaluationsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { hasPermission, isAdmin } = usePermissions();
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterBranch, setFilterBranch] = useState("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<any>(emptyForm());
  const [viewRow, setViewRow] = useState<Evaluation | null>(null);

  const canApprove = isAdmin || hasPermission("hr_evaluations", "approve");
  const canDelete = isAdmin || hasPermission("hr_evaluations", "delete");

  const { data: rows = [], isLoading } = useQuery<Evaluation[]>({
    queryKey: ["/api/hr/evaluations"],
    queryFn: async () => (await apiRequest("GET", "/api/hr/evaluations")).json(),
  });
  const { data: employees = [] } = useQuery<Emp[]>({
    queryKey: ["/api/branch-employees"],
    queryFn: async () => (await apiRequest("GET", "/api/branch-employees")).json(),
  });
  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const activeEmployees = useMemo(() => (employees || []).filter(e => !e.status || e.status === "active"), [employees]);
  const branchName = (id: string) => branches.find(b => b.id === id)?.name || id;

  const filtered = useMemo(() => rows.filter(r => {
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    if (filterBranch !== "all" && r.branchId !== filterBranch) return false;
    if (search && !(r.employeeName || "").includes(search)) return false;
    return true;
  }), [rows, filterStatus, filterBranch, search]);

  const stats = useMemo(() => ({
    total: rows.length,
    pending: rows.filter(r => r.status === "submitted").length,
    approved: rows.filter(r => r.status === "approved").length,
    avg: rows.length ? rows.reduce((s, r) => s + (r.overallScore || 0), 0) / rows.length : 0,
  }), [rows]);

  const overall = useMemo(() => {
    const tw = form.criteria.reduce((s: number, c: any) => s + (c.weight || 0), 0);
    if (!tw) return 0;
    return Math.round((form.criteria.reduce((s: number, c: any) => s + c.score * c.weight, 0) / tw) * 100) / 100;
  }, [form.criteria]);

  const saveMutation = useMutation({
    mutationFn: async ({ submit }: { submit: boolean }) => {
      const emp = activeEmployees.find(e => e.id === Number(form.branchEmployeeId));
      const payload: any = {
        periodType: form.periodType,
        periodStart: form.periodStart,
        periodEnd: form.periodEnd,
        criteria: form.criteria.map((c: any) => ({ key: c.key, label: c.label, weight: c.weight, score: c.score, comment: c.comment || undefined })),
        strengths: form.strengths || null,
        improvements: form.improvements || null,
        goals: form.goals || null,
        notes: form.notes || null,
      };
      if (editId) {
        const res = await apiRequest("PATCH", `/api/hr/evaluations/${editId}`, { ...payload, submit });
        return res.json();
      }
      if (!emp) throw new Error("اختر الموظف");
      const res = await apiRequest("POST", "/api/hr/evaluations", { ...payload, branchEmployeeId: emp.id, branchId: emp.branchId });
      const created = await res.json();
      if (submit) await apiRequest("PATCH", `/api/hr/evaluations/${created.id}`, { submit: true });
      return created;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["/api/hr/evaluations"] });
      setOpen(false); setEditId(null); setForm(emptyForm());
      toast({ title: v.submit ? "تم إرسال التقييم للاعتماد" : "تم حفظ التقييم كمسودة" });
    },
    onError: (e: any) => toast({ title: "خطأ في الحفظ", description: e.message, variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => (await apiRequest("POST", `/api/hr/evaluations/${id}/approve`)).json(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/hr/evaluations"] }); setViewRow(null); toast({ title: "تم اعتماد التقييم" }); },
    onError: (e: any) => toast({ title: "تعذر الاعتماد", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/hr/evaluations/${id}`)).json(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/hr/evaluations"] }); setViewRow(null); toast({ title: "تم حذف التقييم" }); },
    onError: (e: any) => toast({ title: "تعذر الحذف", description: e.message, variant: "destructive" }),
  });

  const openEdit = (r: Evaluation) => {
    setEditId(r.id);
    setForm({
      branchEmployeeId: String(r.branchEmployeeId),
      periodType: r.periodType,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      criteria: Array.isArray(r.criteria) ? r.criteria.map((c: any) => ({ comment: "", ...c })) : emptyForm().criteria,
      strengths: r.strengths || "",
      improvements: r.improvements || "",
      goals: r.goals || "",
      notes: r.notes || "",
    });
    setViewRow(null);
    setOpen(true);
  };

  return (
    <Layout>
      <div className="p-4 sm:p-6 space-y-4" dir="rtl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-primary" /> تقييم الأداء الدوري</h1>
            <p className="text-sm text-muted-foreground">تقييمات دورية لجميع الموظفين بمعايير موزونة واعتماد رسمي</p>
          </div>
          <Button onClick={() => { setEditId(null); setForm(emptyForm()); setOpen(true); }} data-testid="button-new-evaluation">
            <Plus className="h-4 w-4 ms-1" /> تقييم جديد
          </Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card><CardContent className="p-3 text-center"><div className="text-2xl font-bold">{stats.total}</div><div className="text-xs text-muted-foreground">إجمالي التقييمات</div></CardContent></Card>
          <Card><CardContent className="p-3 text-center"><div className="text-2xl font-bold text-amber-600">{stats.pending}</div><div className="text-xs text-muted-foreground">بانتظار الاعتماد</div></CardContent></Card>
          <Card><CardContent className="p-3 text-center"><div className="text-2xl font-bold text-emerald-600">{stats.approved}</div><div className="text-xs text-muted-foreground">معتمدة</div></CardContent></Card>
          <Card><CardContent className="p-3 text-center"><div className={`text-2xl font-bold ${scoreColor(stats.avg)}`}>{fmtScore(stats.avg)}</div><div className="text-xs text-muted-foreground">متوسط الدرجات (من 5)</div></CardContent></Card>
        </div>

        <div className="flex flex-wrap gap-2">
          <Input placeholder="بحث باسم الموظف..." value={search} onChange={e => setSearch(e.target.value)} className="w-56" data-testid="input-search" />
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-44" data-testid="select-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              <SelectItem value="draft">مسودة</SelectItem>
              <SelectItem value="submitted">بانتظار الاعتماد</SelectItem>
              <SelectItem value="approved">معتمد</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterBranch} onValueChange={setFilterBranch}>
            <SelectTrigger className="w-44" data-testid="select-branch"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الفروع</SelectItem>
              {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="p-3 text-start">الموظف</th>
                  <th className="p-3 text-start hidden sm:table-cell">الفرع</th>
                  <th className="p-3 text-start hidden md:table-cell">الفترة</th>
                  <th className="p-3 text-center">الدرجة</th>
                  <th className="p-3 text-center">الحالة</th>
                  <th className="p-3 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">جارِ التحميل...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">لا توجد تقييمات{rows.length === 0 ? " بعد — ابدأ بإنشاء أول تقييم" : " مطابقة للتصفية"}</td></tr>
                ) : filtered.map(r => (
                  <tr key={r.id} className="border-t hover:bg-muted/30" data-testid={`row-evaluation-${r.id}`}>
                    <td className="p-3">
                      <div className="font-medium">{r.employeeName || "—"}</div>
                      <div className="text-xs text-muted-foreground">{r.employeeJob || ""}</div>
                    </td>
                    <td className="p-3 hidden sm:table-cell">{r.branchName || branchName(r.branchId)}</td>
                    <td className="p-3 hidden md:table-cell">
                      <div>{EVALUATION_PERIOD_LABELS[r.periodType] || r.periodType}</div>
                      <div className="text-xs text-muted-foreground tabular-nums">{r.periodStart} ← {r.periodEnd}</div>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`font-bold tabular-nums ${scoreColor(r.overallScore)}`}>{fmtScore(r.overallScore)}</span>
                      <div className="text-[10px] text-muted-foreground">{scoreLabel(r.overallScore)}</div>
                    </td>
                    <td className="p-3 text-center">
                      <Badge variant="secondary" className={STATUS_LABELS[r.status]?.cls}>{STATUS_LABELS[r.status]?.label || r.status}</Badge>
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <Button size="icon" variant="ghost" onClick={() => setViewRow(r)} data-testid={`button-view-${r.id}`}><Eye className="h-4 w-4" /></Button>
                      {r.status !== "approved" && (
                        <Button size="icon" variant="ghost" onClick={() => openEdit(r)} data-testid={`button-edit-${r.id}`}><Pencil className="h-4 w-4" /></Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* نموذج إنشاء/تعديل */}
        <Dialog open={open} onOpenChange={(v) => { if (!v) { setOpen(false); setEditId(null); } }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader><DialogTitle>{editId ? "تعديل التقييم" : "تقييم أداء جديد"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              {!editId && (
                <div>
                  <Label>الموظف</Label>
                  <Select value={form.branchEmployeeId} onValueChange={v => setForm({ ...form, branchEmployeeId: v })}>
                    <SelectTrigger data-testid="select-employee"><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
                    <SelectContent>
                      {activeEmployees.map(e => (
                        <SelectItem key={e.id} value={String(e.id)}>{e.employeeName} — {e.jobTitle || ""} ({branchName(e.branchId)})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label>نوع الفترة</Label>
                  <Select value={form.periodType} onValueChange={v => setForm({ ...form, periodType: v })}>
                    <SelectTrigger data-testid="select-period-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(EVALUATION_PERIOD_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>من</Label>
                  <Input type="date" value={form.periodStart} onChange={e => setForm({ ...form, periodStart: e.target.value })} data-testid="input-period-start" />
                </div>
                <div>
                  <Label>إلى</Label>
                  <Input type="date" value={form.periodEnd} onChange={e => setForm({ ...form, periodEnd: e.target.value })} data-testid="input-period-end" />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base">معايير التقييم</Label>
                  <div className={`flex items-center gap-1 font-bold ${scoreColor(overall)}`}>
                    <Star className="h-4 w-4 fill-current" /> {fmtScore(overall)} / 5 — {scoreLabel(overall)}
                  </div>
                </div>
                {form.criteria.map((c: any, i: number) => (
                  <div key={c.key} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{c.label} <span className="text-xs text-muted-foreground">(وزن {c.weight}%)</span></span>
                      <span className={`font-bold tabular-nums ${scoreColor(c.score)}`}>{c.score}/5</span>
                    </div>
                    <Slider min={1} max={5} step={1} value={[c.score]}
                      onValueChange={([v]) => setForm({ ...form, criteria: form.criteria.map((x: any, j: number) => j === i ? { ...x, score: v } : x) })}
                      data-testid={`slider-criterion-${c.key}`} />
                    <Input placeholder="ملاحظة على هذا المعيار (اختياري)" value={c.comment || ""}
                      onChange={e => setForm({ ...form, criteria: form.criteria.map((x: any, j: number) => j === i ? { ...x, comment: e.target.value } : x) })} />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label>نقاط القوة</Label><Textarea rows={2} value={form.strengths} onChange={e => setForm({ ...form, strengths: e.target.value })} data-testid="input-strengths" /></div>
                <div><Label>جوانب التحسين</Label><Textarea rows={2} value={form.improvements} onChange={e => setForm({ ...form, improvements: e.target.value })} data-testid="input-improvements" /></div>
              </div>
              <div><Label>أهداف الفترة القادمة</Label><Textarea rows={2} value={form.goals} onChange={e => setForm({ ...form, goals: e.target.value })} data-testid="input-goals" /></div>
              <div><Label>ملاحظات عامة</Label><Textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} data-testid="input-notes" /></div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => saveMutation.mutate({ submit: false })} disabled={saveMutation.isPending || (!editId && !form.branchEmployeeId)} data-testid="button-save-draft">
                حفظ كمسودة
              </Button>
              <Button onClick={() => saveMutation.mutate({ submit: true })} disabled={saveMutation.isPending || (!editId && !form.branchEmployeeId)} data-testid="button-submit-evaluation">
                <Send className="h-4 w-4 ms-1" /> حفظ وإرسال للاعتماد
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* عرض التفاصيل */}
        <Dialog open={!!viewRow} onOpenChange={(v) => !v && setViewRow(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
            {viewRow && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center justify-between gap-2">
                    <span>{viewRow.employeeName}</span>
                    <Badge variant="secondary" className={STATUS_LABELS[viewRow.status]?.cls}>{STATUS_LABELS[viewRow.status]?.label}</Badge>
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>{EVALUATION_PERIOD_LABELS[viewRow.periodType] || viewRow.periodType}</span>
                    <span className="tabular-nums">{viewRow.periodStart} ← {viewRow.periodEnd}</span>
                  </div>
                  <div className={`text-center py-3 border rounded-lg font-bold text-2xl ${scoreColor(viewRow.overallScore)}`}>
                    {fmtScore(viewRow.overallScore)} / 5
                    <div className="text-xs font-normal text-muted-foreground mt-1">{scoreLabel(viewRow.overallScore)}</div>
                  </div>
                  {Array.isArray(viewRow.criteria) && viewRow.criteria.map((c: any) => (
                    <div key={c.key} className="flex items-center justify-between border-b pb-1.5">
                      <div>
                        <div>{c.label} <span className="text-xs text-muted-foreground">({c.weight}%)</span></div>
                        {c.comment && <div className="text-xs text-muted-foreground">{c.comment}</div>}
                      </div>
                      <span className={`font-bold tabular-nums ${scoreColor(c.score)}`}>{c.score}/5</span>
                    </div>
                  ))}
                  {viewRow.strengths && <div><span className="font-semibold">نقاط القوة: </span>{viewRow.strengths}</div>}
                  {viewRow.improvements && <div><span className="font-semibold">جوانب التحسين: </span>{viewRow.improvements}</div>}
                  {viewRow.goals && <div><span className="font-semibold">الأهداف: </span>{viewRow.goals}</div>}
                  {viewRow.notes && <div><span className="font-semibold">ملاحظات: </span>{viewRow.notes}</div>}
                  <div className="text-xs text-muted-foreground border-t pt-2 space-y-0.5">
                    {viewRow.evaluatorName && <div>المقيِّم: {viewRow.evaluatorName}</div>}
                    {viewRow.approvedByName && <div>اعتمده: {viewRow.approvedByName}</div>}
                    {viewRow.status === "approved" && (
                      viewRow.employeeAckAt ? (
                        <div className="text-emerald-600">✓ اطّلع عليه الموظف{viewRow.employeeAckComment ? ` — تعليقه: ${viewRow.employeeAckComment}` : ""}</div>
                      ) : (
                        <div className="text-amber-600">لم يطّلع عليه الموظف بعد (يظهر له في بوابته)</div>
                      )
                    )}
                  </div>
                </div>
                <DialogFooter className="gap-2">
                  {canDelete && viewRow.status !== "approved" && (
                    <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate(viewRow.id)} disabled={deleteMutation.isPending} data-testid="button-delete-evaluation">
                      <Trash2 className="h-4 w-4 ms-1" /> حذف
                    </Button>
                  )}
                  {canApprove && viewRow.status === "submitted" && (
                    <Button onClick={() => approveMutation.mutate(viewRow.id)} disabled={approveMutation.isPending} data-testid="button-approve-evaluation">
                      <CheckCircle2 className="h-4 w-4 ms-1" /> اعتماد التقييم
                    </Button>
                  )}
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
