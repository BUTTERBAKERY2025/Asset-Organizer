import { useState, useMemo } from "react";
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
import { Calculator, Plus, CheckCircle2, DollarSign, Trash2, ArrowRight, Printer } from "lucide-react";
import { printEosSettlement } from "@/lib/eos-print";
import { TERMINATION_TYPE_LABELS, EOS_STATUS_LABELS } from "@shared/schema";
import { Layout } from "@/components/layout";
import { Link } from "wouter";

type Eos = any;
type Emp = { id: number; employeeName: string; jobTitle: string; branchId: string; salary?: number; totalSalary?: number };

const initialForm = {
  branchEmployeeId: "",
  endDate: new Date().toISOString().slice(0, 10),
  terminationType: "resignation",
  vacationBalance: "",
  otherDues: "0",
  totalDeductions: "0",
  notes: "",
};

export default function EOSPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<typeof initialForm>(initialForm);
  const [preview, setPreview] = useState<any | null>(null);

  const { data: rows = [], isLoading } = useQuery<Eos[]>({
    queryKey: ["/api/hr/eos", filterStatus],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.set("status", filterStatus);
      return (await apiRequest("GET", `/api/hr/eos?${params}`)).json();
    },
  });

  const { data: employees = [] } = useQuery<Emp[]>({
    queryKey: ["/api/branch-employees"],
    queryFn: async () => (await apiRequest("GET", "/api/branch-employees")).json(),
  });

  const stats = useMemo(() => {
    const total = rows.length;
    const draft = rows.filter((r: any) => r.status === "draft").length;
    const approved = rows.filter((r: any) => r.status === "approved").length;
    const paid = rows.filter((r: any) => r.status === "paid").length;
    const totalAmount = rows.reduce((s: number, r: any) => s + (r.netAmount || 0), 0);
    return { total, draft, approved, paid, totalAmount };
  }, [rows]);

  const calcMutation = useMutation({
    mutationFn: async (payload: any) => (await apiRequest("POST", "/api/hr/eos/calculate", payload)).json(),
    onSuccess: (data) => setPreview(data),
    onError: (e: any) => toast({ title: "خطأ في الحساب", description: e?.message, variant: "destructive" }),
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => (await apiRequest("POST", "/api/hr/eos", payload)).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/hr/eos"] });
      toast({ title: "تم حفظ مستحقات نهاية الخدمة" });
      setForm(initialForm);
      setPreview(null);
      setOpen(false);
    },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message, variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => (await apiRequest("POST", `/api/hr/eos/${id}/approve`, {})).json(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/hr/eos"] }); toast({ title: "تم الاعتماد" }); },
  });

  const payMutation = useMutation({
    mutationFn: async (id: number) => (await apiRequest("POST", `/api/hr/eos/${id}/pay`, {})).json(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/hr/eos"] }); toast({ title: "تم تسجيل الدفع" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/hr/eos/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/hr/eos"] }); toast({ title: "تم الحذف" }); },
  });

  const doCalculate = () => {
    if (!form.branchEmployeeId || !form.endDate) {
      toast({ title: "اختر الموظف وتاريخ نهاية الخدمة", variant: "destructive" });
      return;
    }
    calcMutation.mutate({
      branchEmployeeId: parseInt(form.branchEmployeeId, 10),
      endDate: form.endDate,
      terminationType: form.terminationType,
      ...(form.vacationBalance.trim() !== "" ? { vacationBalance: parseFloat(form.vacationBalance) || 0 } : {}),
      otherDues: parseFloat(form.otherDues) || 0,
      totalDeductions: parseFloat(form.totalDeductions) || 0,
    });
  };

  const doSave = () => {
    if (!preview) return;
    const emp = employees.find((e) => e.id === parseInt(form.branchEmployeeId, 10));
    if (!emp) return;
    saveMutation.mutate({
      branchEmployeeId: parseInt(form.branchEmployeeId, 10),
      branchId: emp.branchId,
      calculationDate: new Date().toISOString().slice(0, 10),
      terminationType: form.terminationType,
      startDate: preview.startDate,
      endDate: form.endDate,
      totalServiceYears: preview.totalServiceYears,
      basicSalary: preview.basicSalary,
      totalSalary: preview.totalSalary,
      eosAmount: preview.eosAmount,
      vacationBalance: preview.vacationBalance,
      vacationAmount: preview.vacationAmount,
      otherDues: preview.otherDues,
      totalDeductions: preview.totalDeductions,
      netAmount: preview.netAmount,
      notes: form.notes,
    });
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      draft: "bg-slate-100 text-slate-700",
      approved: "bg-blue-100 text-blue-700",
      paid: "bg-emerald-100 text-emerald-700",
    };
    return <Badge className={map[s] || ""}>{EOS_STATUS_LABELS[s] || s}</Badge>;
  };

  const fmt = (n: any) => Number(n || 0).toLocaleString("ar-SA-u-nu-latn", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <Layout>
    <div className="container mx-auto p-4 space-y-4" dir="rtl" data-testid="page-hr-eos">
      <Link href="/hr-hub">
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" data-testid="button-back-hr-hub">
          <ArrowRight className="h-4 w-4 ms-1" />العودة لمركز الموارد البشرية
        </Button>
      </Link>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Calculator className="h-7 w-7 text-purple-600" />
          <div>
            <h1 className="text-2xl font-bold">نهاية الخدمة</h1>
            <p className="text-sm text-muted-foreground">حساب مستحقات نهاية الخدمة وفق نظام العمل السعودي</p>
          </div>
        </div>
        <Button onClick={() => { setForm(initialForm); setPreview(null); setOpen(true); }} data-testid="button-add-eos">
          <Plus className="h-4 w-4 ms-2" />حساب جديد
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="إجمالي السجلات" value={stats.total} icon={<Calculator className="h-5 w-5" />} />
        <StatCard label="مسودات" value={stats.draft} icon={<Calculator className="h-5 w-5" />} accent="amber" />
        <StatCard label="معتمدة" value={stats.approved} icon={<CheckCircle2 className="h-5 w-5" />} accent="blue" />
        <StatCard label="مدفوعة" value={stats.paid} icon={<DollarSign className="h-5 w-5" />} accent="emerald" />
        <StatCard label="إجمالي المستحقات (ر.س)" value={fmt(stats.totalAmount)} icon={<DollarSign className="h-5 w-5" />} accent="emerald" />
      </div>

      <Card>
        <CardContent className="space-y-3 pt-6">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="max-w-xs" data-testid="select-filter-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              {Object.entries(EOS_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="overflow-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-right p-2">الموظف</th>
                  <th className="text-right p-2">سبب الإنهاء</th>
                  <th className="text-right p-2">سنوات الخدمة</th>
                  <th className="text-right p-2">مكافأة (ر.س)</th>
                  <th className="text-right p-2">الصافي (ر.س)</th>
                  <th className="text-right p-2">الحالة</th>
                  <th className="text-right p-2">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">جاري التحميل...</td></tr>}
                {!isLoading && rows.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">لا توجد سجلات</td></tr>}
                {rows.map((r: any) => (
                  <tr key={r.id} className="border-t hover:bg-slate-50" data-testid={`row-eos-${r.id}`}>
                    <td className="p-2">
                      <div className="font-medium">{r.employeeName || "-"}</div>
                      <div className="text-xs text-muted-foreground">{r.employeeJob || ""}</div>
                    </td>
                    <td className="p-2">{TERMINATION_TYPE_LABELS[r.terminationType] || r.terminationType}</td>
                    <td className="p-2 tabular-nums">{Number(r.totalServiceYears).toFixed(2)}</td>
                    <td className="p-2 tabular-nums">{fmt(r.eosAmount)}</td>
                    <td className="p-2 tabular-nums font-bold">{fmt(r.netAmount)}</td>
                    <td className="p-2">{statusBadge(r.status)}</td>
                    <td className="p-2">
                      <div className="flex gap-1 flex-wrap">
                        {r.status === "draft" && (
                          <Button size="sm" variant="ghost" className="text-blue-600" onClick={() => approveMutation.mutate(r.id)} data-testid={`button-approve-${r.id}`}>اعتماد</Button>
                        )}
                        {r.status === "approved" && (
                          <Button size="sm" variant="ghost" className="text-emerald-600" onClick={() => payMutation.mutate(r.id)} data-testid={`button-pay-${r.id}`}>دفع</Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => printEosSettlement(r)} title="طباعة نموذج المخالصة" data-testid={`button-print-${r.id}`}>
                          <Printer className="h-3.5 w-3.5 text-purple-600" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { if (confirm("حذف هذا السجل؟")) deleteMutation.mutate(r.id); }} data-testid={`button-delete-${r.id}`}>
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

      <Dialog open={open} onOpenChange={(o) => { if (!o) { setForm(initialForm); setPreview(null); setOpen(false); } else setOpen(true); }}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader><DialogTitle>حساب مستحقات نهاية الخدمة</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>الموظف</Label>
                <Select value={form.branchEmployeeId} onValueChange={(v) => setForm({ ...form, branchEmployeeId: v })}>
                  <SelectTrigger data-testid="select-employee"><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.employeeName} — {e.jobTitle}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>سبب نهاية الخدمة</Label>
                <Select value={form.terminationType} onValueChange={(v) => setForm({ ...form, terminationType: v })}>
                  <SelectTrigger data-testid="select-termination-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TERMINATION_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>تاريخ نهاية الخدمة</Label>
                <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} data-testid="input-end-date" />
              </div>
              <div>
                <Label>رصيد الإجازات (أيام)</Label>
                <Input type="number" step="0.5" placeholder="تلقائي من نظام الإجازات" value={form.vacationBalance} onChange={(e) => setForm({ ...form, vacationBalance: e.target.value })} data-testid="input-vacation-balance" />
                <p className="text-xs text-muted-foreground mt-1">اتركه فارغاً ليُجلب الرصيد المتبقي تلقائياً</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>مستحقات أخرى (ر.س)</Label>
                <Input type="number" step="0.01" value={form.otherDues} onChange={(e) => setForm({ ...form, otherDues: e.target.value })} data-testid="input-other-dues" />
              </div>
              <div>
                <Label>خصومات (سلف..) (ر.س)</Label>
                <Input type="number" step="0.01" value={form.totalDeductions} onChange={(e) => setForm({ ...form, totalDeductions: e.target.value })} data-testid="input-deductions" />
              </div>
            </div>
            <div>
              <Label>ملاحظات</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} data-testid="textarea-notes" />
            </div>

            <Button onClick={doCalculate} disabled={calcMutation.isPending} variant="secondary" className="w-full" data-testid="button-calculate">
              <Calculator className="h-4 w-4 ms-2" />{calcMutation.isPending ? "جاري الحساب..." : "حساب المستحقات"}
            </Button>

            {preview && (
              <Card className="bg-purple-50 border-purple-200">
                <CardHeader className="pb-2"><CardTitle className="text-sm">نتيجة الحساب</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-1">
                  <Row label="تاريخ بداية الخدمة" value={preview.startDate} />
                  <Row label="سنوات الخدمة" value={Number(preview.totalServiceYears).toFixed(3)} />
                  <Row label="الراتب الأساسي" value={`${fmt(preview.basicSalary)} ر.س`} />
                  <Row label="الأجر الأخير الشامل (أساس الحساب)" value={`${fmt(preview.totalSalary)} ر.س`} />
                  {preview.appliedRule && (
                    <div className="text-xs bg-amber-50 border border-amber-200 rounded p-2 my-1" data-testid="text-applied-rule">{preview.appliedRule}</div>
                  )}
                  {preview.firstFiveAmount != null && (
                    <Row label={`نصف شهر × ${Number(preview.firstFiveYears).toFixed(2)} سنة`} value={`${fmt(preview.firstFiveAmount)} ر.س`} />
                  )}
                  {Number(preview.afterFiveYears) > 0 && (
                    <Row label={`شهر كامل × ${Number(preview.afterFiveYears).toFixed(2)} سنة`} value={`${fmt(preview.afterFiveAmount)} ر.س`} />
                  )}
                  {preview.eosFraction != null && preview.eosFraction < 1 && (
                    <Row label="نسبة الاستحقاق" value={preview.eosFraction === 0 ? "لا استحقاق" : preview.eosFraction === 1 / 3 ? "الثلث (1/3)" : "الثلثان (2/3)"} />
                  )}
                  <Row label="مكافأة نهاية الخدمة" value={`${fmt(preview.eosAmount)} ر.س`} bold />
                  <Row label="قيمة رصيد الإجازات" value={`${fmt(preview.vacationAmount)} ر.س`} />
                  <Row label="مستحقات أخرى" value={`${fmt(preview.otherDues)} ر.س`} />
                  <Row label="خصومات" value={`- ${fmt(preview.totalDeductions)} ر.س`} />
                  <div className="border-t pt-2 mt-2">
                    <Row label="الصافي المستحق" value={`${fmt(preview.netAmount)} ر.س`} bold accent />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setForm(initialForm); setPreview(null); setOpen(false); }}>إلغاء</Button>
            <Button onClick={doSave} disabled={!preview || saveMutation.isPending} data-testid="button-save-eos">
              {saveMutation.isPending ? "جاري الحفظ..." : "حفظ السجل"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </Layout>
  );
}

function Row({ label, value, bold, accent }: { label: string; value: any; bold?: boolean; accent?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className={accent ? "text-purple-700" : ""}>{label}</span>
      <span className={`tabular-nums ${bold ? "font-bold" : ""} ${accent ? "text-purple-700 text-base" : ""}`}>{value}</span>
    </div>
  );
}

function StatCard({ label, value, icon, accent = "purple" }: { label: string; value: any; icon: any; accent?: string }) {
  const accents: Record<string, string> = {
    amber: "bg-amber-50 text-amber-700",
    emerald: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
    purple: "bg-purple-50 text-purple-700",
  };
  return (
    <Card>
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground mb-1">{label}</div>
          <div className="text-xl font-bold tabular-nums">{typeof value === "string" ? value : Number(value).toLocaleString("ar-SA-u-nu-latn")}</div>
        </div>
        <div className={`p-2 rounded-lg ${accents[accent] || accents.purple}`}>{icon}</div>
      </CardContent>
    </Card>
  );
}
