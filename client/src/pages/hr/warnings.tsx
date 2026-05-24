import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertOctagon, Plus, Trash2, AlertTriangle, ArrowRight, Link2, MessageCircle,
  Eye, Paperclip, X, CheckCircle2, Copy, History, FileDown,
} from "lucide-react";
import { WARNING_LEVEL_LABELS, WARNING_STATUS_LABELS } from "@shared/schema";
import { WARNING_TEMPLATES, WARNING_REASON_CATEGORIES, WARNING_LEGAL_NOTICE, renderWarningBody } from "@shared/warning-templates";
import { Layout } from "@/components/layout";
import { Link } from "wouter";
import { useReactToPrint } from "react-to-print";
import { WarningDocument } from "@/components/warning-document";

type Emp = { id: number; employeeName: string; jobTitle: string; branchId: string; phoneNumber?: string; mobile?: string };
type Branch = { id: string; name: string; nameAr?: string };

const initialForm = {
  branchEmployeeId: "",
  branchId: "",
  templateId: "",
  level: "verbal",
  reasonCategory: "",
  reason: "",
  description: "",
  issuedDate: new Date().toISOString().slice(0, 10),
  deductionAmount: "0",
  attachments: [] as Array<{ url: string; name: string; mimeType?: string; size?: number }>,
};

export default function WarningsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<typeof initialForm>(initialForm);
  const [viewing, setViewing] = useState<any | null>(null);
  const [historyEmpId, setHistoryEmpId] = useState<number | null>(null);

  const { data: warnings = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/hr/warnings", filterStatus, filterLevel],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (filterLevel !== "all") params.set("level", filterLevel);
      return (await apiRequest("GET", `/api/hr/warnings?${params}`)).json();
    },
  });

  const { data: stats } = useQuery<any>({
    queryKey: ["/api/hr/warnings/stats"],
    queryFn: async () => (await apiRequest("GET", "/api/hr/warnings/stats")).json(),
  });

  const { data: employees = [] } = useQuery<Emp[]>({
    queryKey: ["/api/branch-employees"],
    queryFn: async () => (await apiRequest("GET", "/api/branch-employees")).json(),
  });

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: async () => (await apiRequest("GET", "/api/branches")).json(),
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return warnings;
    const q = search.toLowerCase();
    return warnings.filter((w: any) =>
      (w.employeeName || "").toLowerCase().includes(q) ||
      (w.reason || "").toLowerCase().includes(q),
    );
  }, [warnings, search]);

  const employeesById = useMemo(() => {
    const m = new Map<number, Emp>();
    employees.forEach((e) => m.set(e.id, e));
    return m;
  }, [employees]);

  // Employee search inside the create dialog
  const [empSearch, setEmpSearch] = useState("");
  const filteredEmployees = useMemo(() => {
    const q = empSearch.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) =>
      (e.employeeName || "").toLowerCase().includes(q) ||
      (e.jobTitle || "").toLowerCase().includes(q) ||
      (e.phoneNumber || "").includes(q) || (e.mobile || "").includes(q),
    );
  }, [employees, empSearch]);

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => (await apiRequest("POST", "/api/hr/warnings", payload)).json(),
    onSuccess: (created: any) => {
      qc.invalidateQueries({ queryKey: ["/api/hr/warnings"] });
      qc.invalidateQueries({ queryKey: ["/api/hr/warnings/stats"] });
      toast({
        title: "تم تسجيل الإنذار",
        description: created?.publicToken ? "تم توليد رابط مشاركة آمن مع الموظف عبر الواتساب." : "تم الحفظ بنجاح.",
      });
      setForm(initialForm); setEmpSearch(""); setOpen(false);
      // Auto-open the view dialog so user can copy link / send WhatsApp immediately
      if (created?.id) {
        const emp = employeesById.get(created.branchEmployeeId);
        setViewing({ ...created, employeeName: emp?.employeeName, employeeJob: emp?.jobTitle });
      }
    },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message || "فشل الحفظ", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/hr/warnings/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/hr/warnings"] });
      qc.invalidateQueries({ queryKey: ["/api/hr/warnings/stats"] });
      toast({ title: "تم الحذف" });
    },
  });

  const regenMutation = useMutation({
    mutationFn: async (id: number) => (await apiRequest("POST", `/api/hr/warnings/${id}/regenerate-token`)).json(),
    onSuccess: (updated: any) => {
      qc.invalidateQueries({ queryKey: ["/api/hr/warnings"] });
      setViewing((v: any) => v ? { ...v, ...updated } : v);
      toast({ title: "تم توليد رابط جديد", description: "الرابط السابق لم يعد صالحًا." });
    },
  });

  const applyTemplate = (templateId: string) => {
    const t = WARNING_TEMPLATES.find((x) => x.id === templateId);
    if (!t) {
      setForm((f) => ({ ...f, templateId: "" }));
      return;
    }
    setForm((f) => ({
      ...f,
      templateId: t.id,
      level: t.defaultLevel,
      reasonCategory: t.defaultReasonCategory,
      reason: f.reason || t.label,
    }));
  };

  const submit = () => {
    if (!form.branchEmployeeId || !form.reason) {
      toast({ title: "بيانات ناقصة", description: "اختر الموظف واكتب موضوع الإنذار.", variant: "destructive" });
      return;
    }
    if (form.reasonCategory === "other" && !form.description.trim()) {
      toast({ title: "الشرح مطلوب", description: "اكتب شرح السبب في حقل التفاصيل.", variant: "destructive" });
      return;
    }
    const emp = employeesById.get(parseInt(form.branchEmployeeId, 10));
    if (!emp) return;
    saveMutation.mutate({
      branchEmployeeId: parseInt(form.branchEmployeeId, 10),
      branchId: emp.branchId,
      templateId: form.templateId || undefined,
      reasonCategory: form.reasonCategory || undefined,
      level: form.level,
      reason: form.reason,
      description: form.description,
      issuedDate: form.issuedDate,
      deductionAmount: parseFloat(form.deductionAmount) || 0,
      attachments: form.attachments,
    });
  };

  const levelBadge = (lvl: string) => {
    const colors: Record<string, string> = {
      verbal: "bg-slate-100 text-slate-700",
      written_1: "bg-amber-100 text-amber-700",
      written_2: "bg-orange-100 text-orange-700",
      written_3: "bg-red-100 text-red-700",
      final: "bg-red-200 text-red-800",
      termination: "bg-rose-700 text-white",
    };
    return <Badge className={colors[lvl] || ""}>{WARNING_LEVEL_LABELS[lvl] || lvl}</Badge>;
  };

  return (
    <Layout>
    <div className="container mx-auto p-4 space-y-4" dir="rtl" data-testid="page-hr-warnings">
      <Link href="/hr-hub">
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" data-testid="button-back-hr-hub">
          <ArrowRight className="h-4 w-4 ms-1" />العودة لمركز الموارد البشرية
        </Button>
      </Link>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <AlertOctagon className="h-7 w-7 text-red-600" />
          <div>
            <h1 className="text-2xl font-bold">الإنذارات والمخالفات</h1>
            <p className="text-sm text-muted-foreground">سجل الإجراءات التأديبية مع توقيع إلكتروني عبر الواتساب وحفظ كشف الجزاءات</p>
          </div>
        </div>
        <Button onClick={() => setOpen(true)} data-testid="button-add-warning">
          <Plus className="h-4 w-4 ms-2" />إصدار إنذار جديد
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="إجمالي الإنذارات" value={stats?.total ?? 0} icon={<AlertOctagon className="h-5 w-5" />} accent="red" />
        <StatCard label="السارية حالياً" value={stats?.active ?? 0} icon={<AlertTriangle className="h-5 w-5" />} accent="amber" />
        <StatCard label="إنذارات شفهية" value={stats?.byLevel?.verbal ?? 0} icon={<AlertOctagon className="h-5 w-5" />} />
        <StatCard label="إجمالي الجزاءات (ر.س)" value={Number(stats?.totalDeductions || 0).toFixed(2)} icon={<AlertOctagon className="h-5 w-5" />} accent="red" />
      </div>

      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Input placeholder="بحث (اسم موظف أو سبب)" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search" />
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger data-testid="select-filter-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                {Object.entries(WARNING_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterLevel} onValueChange={setFilterLevel}>
              <SelectTrigger data-testid="select-filter-level"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الدرجات</SelectItem>
                {Object.entries(WARNING_LEVEL_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-right p-2">الموظف</th>
                  <th className="text-right p-2">الدرجة</th>
                  <th className="text-right p-2">الموضوع</th>
                  <th className="text-right p-2">التاريخ</th>
                  <th className="text-right p-2">الجزاء</th>
                  <th className="text-right p-2">حالة التوقيع</th>
                  <th className="text-right p-2">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">جاري التحميل...</td></tr>}
                {!isLoading && filtered.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">لا توجد إنذارات</td></tr>}
                {filtered.map((w: any) => (
                  <tr key={w.id} className="border-t hover:bg-slate-50" data-testid={`row-warning-${w.id}`}>
                    <td className="p-2">
                      <button
                        className="text-right hover:underline"
                        onClick={() => setHistoryEmpId(w.branchEmployeeId)}
                        data-testid={`button-employee-history-${w.id}`}
                        title="عرض كشف حساب الجزاءات لهذا الموظف"
                      >
                        <div className="font-medium">{w.employeeName || "-"}</div>
                        <div className="text-xs text-muted-foreground">{w.employeeJob || ""}</div>
                      </button>
                    </td>
                    <td className="p-2">{levelBadge(w.level)}</td>
                    <td className="p-2 max-w-xs truncate" title={w.reason}>{w.reason}</td>
                    <td className="p-2 text-xs">{w.issuedDate}</td>
                    <td className="p-2 tabular-nums">{Number(w.deductionAmount || 0).toLocaleString("ar-SA-u-nu-latn")} ر.س</td>
                    <td className="p-2 text-xs">
                      {w.signedAt ? (
                        <Badge className="bg-emerald-100 text-emerald-700 gap-1">
                          <CheckCircle2 className="h-3 w-3" /> موقَّع
                        </Badge>
                      ) : w.publicToken ? (
                        <Badge variant="outline" className="border-amber-400 text-amber-700">بانتظار التوقيع</Badge>
                      ) : (
                        <Badge variant="outline">قديم — بدون رابط</Badge>
                      )}
                    </td>
                    <td className="p-2">
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setViewing(w)} data-testid={`button-view-${w.id}`} title="عرض / إرسال للواتساب">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { if (confirm("حذف هذا الإنذار؟")) deleteMutation.mutate(w.id); }} data-testid={`button-delete-${w.id}`}>
                          <Trash2 className="h-3.5 w-3.5 text-red-600" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ──────────── Create dialog ──────────── */}
      <Dialog open={open} onOpenChange={(o) => { if (!o) { setForm(initialForm); setEmpSearch(""); setOpen(false); } else setOpen(true); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader><DialogTitle>إصدار إنذار جديد</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {/* Template picker */}
            <div>
              <Label>القالب الجاهز</Label>
              <Select value={form.templateId || "__none__"} onValueChange={(v) => applyTemplate(v === "__none__" ? "" : v)}>
                <SelectTrigger data-testid="select-template"><SelectValue placeholder="اختر قالبًا" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— بدون قالب —</SelectItem>
                  {WARNING_TEMPLATES.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label} ({WARNING_LEVEL_LABELS[t.defaultLevel]})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.templateId && (
                <p className="text-[11px] text-muted-foreground mt-1">سيُعرض نص القالب الكامل للموظف عند فتح الرابط — مع تعبئة اسمه والتاريخ تلقائيًا.</p>
              )}
            </div>

            {/* Employee */}
            <div>
              <Label>الموظف</Label>
              <Input
                placeholder="ابحث بالاسم أو الوظيفة أو الجوال..."
                value={empSearch}
                onChange={(e) => setEmpSearch(e.target.value)}
                className="mb-1.5 h-9 text-sm"
                data-testid="input-employee-search"
              />
              <Select value={form.branchEmployeeId} onValueChange={(v) => {
                const emp = employeesById.get(parseInt(v, 10));
                setForm({ ...form, branchEmployeeId: v, branchId: emp?.branchId || "" });
              }}>
                <SelectTrigger data-testid="select-employee"><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
                <SelectContent>
                  {filteredEmployees.length === 0 && (
                    <div className="py-2 px-3 text-xs text-muted-foreground">لا توجد نتائج</div>
                  )}
                  {filteredEmployees.slice(0, 200).map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>{e.employeeName} — {e.jobTitle}</SelectItem>
                  ))}
                  {filteredEmployees.length > 200 && (
                    <div className="py-1.5 px-3 text-[10px] text-muted-foreground border-t">
                      يُعرض أول 200 — ابحث لتضييق النتائج
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Level + Reason Category */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>درجة الإنذار</Label>
                <Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v })}>
                  <SelectTrigger data-testid="select-level"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(WARNING_LEVEL_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>تصنيف السبب</Label>
                <Select value={form.reasonCategory || "__none__"} onValueChange={(v) => setForm({ ...form, reasonCategory: v === "__none__" ? "" : v })}>
                  <SelectTrigger data-testid="select-reason-category"><SelectValue placeholder="اختر تصنيف" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— غير محدد —</SelectItem>
                    {WARNING_REASON_CATEGORIES.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>الموضوع (سطر مختصر)</Label>
              <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="مثلاً: تكرار التأخير عن الدوام" data-testid="input-reason" />
            </div>

            <div>
              <Label>
                شرح السبب وتفاصيل المخالفة
                {form.reasonCategory === "other" && <span className="text-red-600"> *</span>}
              </Label>
              <Textarea
                rows={4}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="اكتب وصفًا تفصيليًا لما حدث (التاريخ، المكان، الشهود، الأثر على العمل، ...)"
                data-testid="textarea-description"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>تاريخ الإصدار</Label>
                <Input type="date" value={form.issuedDate} onChange={(e) => setForm({ ...form, issuedDate: e.target.value })} data-testid="input-issued-date" />
              </div>
              <div>
                <Label>الجزاء المالي (ر.س)</Label>
                <Input type="number" step="0.01" min="0" value={form.deductionAmount} onChange={(e) => setForm({ ...form, deductionAmount: e.target.value })} data-testid="input-deduction" />
              </div>
            </div>

            {/* Attachments (URL-based; reuses Supabase storage) */}
            <AttachmentsInput value={form.attachments} onChange={(arr) => setForm({ ...form, attachments: arr })} />

            <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded p-2 leading-relaxed">
              عند الحفظ سيُولَّد رابط آمن خاص بهذا الإنذار، يمكنك إرساله للموظف عبر الواتساب من نافذة العرض ليطلع على المستند ويوقّعه إلكترونيًا. الجزاء المالي (إن وُجد) سيُسجَّل تلقائيًا في خصومات راتب الشهر.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setForm(initialForm); setEmpSearch(""); setOpen(false); }}>إلغاء</Button>
            <Button onClick={submit} disabled={saveMutation.isPending} data-testid="button-save-warning">
              {saveMutation.isPending ? "جاري الحفظ..." : "حفظ وتوليد الرابط"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ──────────── View / share / download dialog ──────────── */}
      <ViewDialog
        warning={viewing}
        branches={branches}
        employee={viewing ? employeesById.get(viewing.branchEmployeeId) : undefined}
        onClose={() => setViewing(null)}
        onRegenerate={() => viewing && regenMutation.mutate(viewing.id)}
        regenerating={regenMutation.isPending}
      />

      {/* ──────────── Per-employee disciplinary history ──────────── */}
      <DisciplinaryHistoryDialog
        branchEmployeeId={historyEmpId}
        onClose={() => setHistoryEmpId(null)}
        onOpenWarning={(w) => { setHistoryEmpId(null); setViewing(w); }}
      />
    </div>
    </Layout>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, accent = "amber" }: { label: string; value: any; icon: any; accent?: string }) {
  const accents: Record<string, string> = {
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
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
        <div className={`p-2 rounded-lg ${accents[accent] || accents.amber}`}>{icon}</div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Lightweight attachments input — accepts links to already-uploaded files.
// For full upload UX users can paste a Supabase public URL; later we can wire
// the unified Supabase uploader in here.
function AttachmentsInput({
  value, onChange,
}: { value: Array<{ url: string; name: string }>; onChange: (v: Array<{ url: string; name: string }>) => void }) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const add = () => {
    if (!url.trim()) return;
    onChange([...value, { url: url.trim(), name: name.trim() || url.split("/").pop() || "مرفق" }]);
    setUrl(""); setName("");
  };
  return (
    <div>
      <Label className="flex items-center gap-1.5"><Paperclip className="h-3.5 w-3.5" /> المرفقات (اختياري)</Label>
      <div className="grid grid-cols-12 gap-1.5 mt-1">
        <Input className="col-span-7" placeholder="رابط الملف أو الصورة (URL)" value={url} onChange={(e) => setUrl(e.target.value)} data-testid="input-attachment-url" />
        <Input className="col-span-3" placeholder="اسم وصفي" value={name} onChange={(e) => setName(e.target.value)} data-testid="input-attachment-name" />
        <Button type="button" variant="outline" onClick={add} className="col-span-2" data-testid="button-add-attachment">إضافة</Button>
      </div>
      {value.length > 0 && (
        <div className="mt-2 space-y-1">
          {value.map((a, i) => (
            <div key={i} className="flex items-center gap-2 text-xs p-1.5 rounded bg-slate-50 border">
              <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-amber-700 hover:underline">{a.name}</a>
              <Button size="sm" variant="ghost" onClick={() => onChange(value.filter((_, j) => j !== i))}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <p className="text-[10px] text-muted-foreground mt-1">يمكنك رفع الصور/المستندات عبر مكتبة الوثائق ثم لصق الرابط هنا.</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function ViewDialog({
  warning, employee, branches, onClose, onRegenerate, regenerating,
}: {
  warning: any | null;
  employee?: Emp;
  branches: Branch[];
  onClose: () => void;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Warning_${warning?.id ?? ""}_${employee?.employeeName ?? ""}`,
  });

  if (!warning) return null;

  const branch = branches.find((b) => b.id === warning.branchId);
  const publicUrl = warning.publicToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/warning/${warning.publicToken}`
    : "";
  const template = WARNING_TEMPLATES.find((t) => t.id === warning.templateId);
  const reasonCategoryLabel = WARNING_REASON_CATEGORIES.find((c) => c.id === warning.reasonCategory)?.label || null;
  const templateBody = template
    ? renderWarningBody(template.body, { name: employee?.employeeName || warning.employeeName, date: warning.issuedDate })
    : null;
  const phone = (employee?.phoneNumber || employee?.mobile || "").replace(/\D/g, "");
  const waMessage = encodeURIComponent(
    `إشعار رسمي من شركة الزبد الأفضل التجارية:\n\nصدر بحقكم ${WARNING_LEVEL_LABELS[warning.level] || ""} بشأن: ${warning.reason}\n\nيرجى فتح الرابط أدناه للاطلاع والتوقيع إلكترونيًا:\n${publicUrl}`,
  );
  const waUrl = phone
    ? `https://wa.me/${phone.startsWith("00") ? phone.slice(2) : phone}?text=${waMessage}`
    : `https://wa.me/?text=${waMessage}`;

  const copyLink = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast({ title: "تم نسخ الرابط" });
    } catch {
      toast({ title: "تعذّر النسخ", variant: "destructive" });
    }
  };

  return (
    <Dialog open={!!warning} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertOctagon className="h-5 w-5 text-amber-600" />
            إنذار رقم WRN-{String(warning.id).padStart(6, "0")}
            {warning.signedAt && (
              <Badge className="bg-emerald-100 text-emerald-700 gap-1">
                <CheckCircle2 className="h-3 w-3" /> موقَّع
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Share controls */}
        {warning.publicToken && (
          <Card className="bg-emerald-50/40 border-emerald-200">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Link2 className="h-4 w-4 text-emerald-700" /> رابط الإنذار للموظف
              </div>
              <div className="flex gap-1.5">
                <Input value={publicUrl} readOnly className="text-xs" dir="ltr" data-testid="input-public-link" />
                <Button size="sm" variant="outline" onClick={copyLink} data-testid="button-copy-link" title="نسخ الرابط">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <a href={waUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 gap-1.5" data-testid="button-send-whatsapp">
                    <MessageCircle className="h-3.5 w-3.5" />
                    إرسال عبر الواتساب {phone ? `(${phone})` : ""}
                  </Button>
                </a>
                <Button size="sm" variant="outline" onClick={() => handlePrint()} className="gap-1.5" data-testid="button-print-doc">
                  <FileDown className="h-3.5 w-3.5" /> تحميل / طباعة PDF
                </Button>
                {!warning.signedAt && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { if (confirm("سيُلغى الرابط الحالي ويُولَّد رابط جديد. متابعة؟")) onRegenerate(); }}
                    disabled={regenerating}
                    data-testid="button-regenerate-token"
                  >
                    إعادة توليد الرابط
                  </Button>
                )}
              </div>
              {!phone && (
                <p className="text-[11px] text-amber-800">جوال الموظف غير مسجّل — اضغط واتساب ثم اختر جهة الاتصال يدويًا.</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Document preview (also used for print) */}
        <div className="border rounded overflow-auto bg-slate-100 max-h-[60vh]">
          <div style={{ transform: "scale(0.85)", transformOrigin: "top center" }}>
            <WarningDocument
              ref={printRef}
              companyName="شركة الزبد الأفضل التجارية"
              branchName={branch?.nameAr || branch?.name || null}
              warning={{
                id: warning.id,
                level: warning.level,
                reason: warning.reason,
                description: warning.description,
                issuedDate: warning.issuedDate,
                deductionAmount: warning.deductionAmount,
                signedAt: warning.signedAt,
                signatureData: warning.signatureData,
              }}
              employee={employee ? {
                employeeName: employee.employeeName, jobTitle: employee.jobTitle,
                nationalId: (employee as any).nationalId,
              } : { employeeName: warning.employeeName, jobTitle: warning.employeeJob }}
              templateBody={templateBody}
              reasonCategoryLabel={reasonCategoryLabel}
              legalNotice={WARNING_LEGAL_NOTICE}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function DisciplinaryHistoryDialog({
  branchEmployeeId, onClose, onOpenWarning,
}: {
  branchEmployeeId: number | null;
  onClose: () => void;
  onOpenWarning: (w: any) => void;
}) {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/hr/employees/disciplinary-record", branchEmployeeId],
    queryFn: async () => (await apiRequest("GET", `/api/hr/employees/${branchEmployeeId}/disciplinary-record`)).json(),
    enabled: !!branchEmployeeId,
  });

  return (
    <Dialog open={!!branchEmployeeId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-amber-600" />
            كشف حساب الجزاءات والإنذارات
          </DialogTitle>
        </DialogHeader>
        {isLoading && <div className="p-6 text-center text-muted-foreground">جاري التحميل...</div>}
        {data && (
          <div className="space-y-3">
            <Card className="bg-slate-50">
              <CardContent className="p-3">
                <div className="text-sm font-bold">{data.employee?.employeeName}</div>
                <div className="text-xs text-muted-foreground">{data.employee?.jobTitle}</div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <SummaryTile label="إجمالي الإنذارات" value={data.summary.totalWarnings} />
              <SummaryTile label="السارية" value={data.summary.activeWarnings} accent="amber" />
              <SummaryTile label="الموقَّعة" value={data.summary.signedWarnings} accent="emerald" />
              <SummaryTile label="إجمالي الجزاءات" value={`${Number(data.summary.totalDeductions).toFixed(2)} ر.س`} accent="red" />
            </div>

            <div className="border rounded overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-right p-2">التاريخ</th>
                    <th className="text-right p-2">الدرجة</th>
                    <th className="text-right p-2">الموضوع</th>
                    <th className="text-right p-2">الجزاء</th>
                    <th className="text-right p-2">التوقيع</th>
                    <th className="text-right p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.warnings.length === 0 && (
                    <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">لا توجد إنذارات سابقة</td></tr>
                  )}
                  {data.warnings.map((w: any) => (
                    <tr key={w.id} className="border-t">
                      <td className="p-2 text-xs">{w.issuedDate}</td>
                      <td className="p-2 text-xs">{WARNING_LEVEL_LABELS[w.level] || w.level}</td>
                      <td className="p-2 text-xs max-w-xs truncate" title={w.reason}>{w.reason}</td>
                      <td className="p-2 text-xs tabular-nums">{Number(w.deductionAmount || 0).toFixed(2)} ر.س</td>
                      <td className="p-2 text-xs">
                        {w.signedAt
                          ? <Badge className="bg-emerald-100 text-emerald-700">موقَّع</Badge>
                          : <Badge variant="outline">—</Badge>}
                      </td>
                      <td className="p-2">
                        <Button size="sm" variant="ghost" onClick={() => onOpenWarning({ ...w, employeeName: data.employee?.employeeName, employeeJob: data.employee?.jobTitle })}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SummaryTile({ label, value, accent = "slate" }: { label: string; value: any; accent?: string }) {
  const accents: Record<string, string> = {
    slate: "bg-slate-50 text-slate-700 border-slate-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    emerald: "bg-emerald-50 text-emerald-800 border-emerald-200",
    red: "bg-red-50 text-red-800 border-red-200",
  };
  return (
    <div className={`rounded-lg border p-2.5 ${accents[accent]}`}>
      <div className="text-[10px] opacity-80">{label}</div>
      <div className="text-lg font-bold tabular-nums">{typeof value === "string" ? value : Number(value).toLocaleString("ar-SA-u-nu-latn")}</div>
    </div>
  );
}
