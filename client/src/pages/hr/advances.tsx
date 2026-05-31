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
import { Wallet, Plus, Trash2, TrendingDown, Calendar, ArrowRight, Clock, CheckCircle2, XCircle, Inbox } from "lucide-react";
import { Layout } from "@/components/layout";
import { Link } from "wouter";
import { ADVANCE_REQUEST_STATUS_LABELS } from "@shared/schema";

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
    queryKey: ["/api/hr/advance-requests", "pending"],
    queryFn: async () => (await apiRequest("GET", "/api/hr/advance-requests?status=pending")).json(),
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, decision, note }: { id: number; decision: "approved" | "rejected"; note?: string }) =>
      (await apiRequest("POST", `/api/hr/advance-requests/${id}/review`, { decision, note })).json(),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["/api/hr/advance-requests"] });
      qc.invalidateQueries({ queryKey: ["/api/hr/advances"] });
      qc.invalidateQueries({ queryKey: ["/api/hr/advances/stats"] });
      toast({ title: vars.decision === "approved" ? "تم اعتماد الطلب وإنشاء الخصم" : "تم رفض الطلب" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message || "فشل تنفيذ الإجراء", variant: "destructive" }),
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
        <Button onClick={() => setOpen(true)} data-testid="button-add-advance">
          <Plus className="h-4 w-4 ms-2" />تسجيل سلفة / قسط
        </Button>
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
              <h2 className="text-lg font-bold">طلبات سلف بانتظار المراجعة</h2>
              <Badge className="bg-amber-100 text-amber-700">{pendingRequests.length}</Badge>
            </div>
            <div className="space-y-2">
              {pendingRequests.map((r: any) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border bg-card" data-testid={`row-request-${r.id}`}>
                  <div className="space-y-0.5">
                    <div className="font-semibold flex items-center gap-2">
                      {r.employeeName || "-"}
                      <span className="text-xs text-muted-foreground font-normal">{r.branchName || ""}</span>
                    </div>
                    <div className="text-sm">
                      <span className="font-bold tabular-nums">{Number(r.amount).toLocaleString("ar-SA-u-nu-latn")} ر.س</span>
                      <span className="text-muted-foreground"> · شهر الخصم {r.requestedMonth}</span>
                      {r.installments > 1 && <span className="text-muted-foreground"> · {r.installments} أقساط</span>}
                    </div>
                    {r.reason && <div className="text-xs text-muted-foreground">{r.reason}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="gap-1 bg-amber-50 text-amber-700 border-amber-200">
                      <Clock className="h-3 w-3" />{ADVANCE_REQUEST_STATUS_LABELS[r.status] || r.status}
                    </Badge>
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700"
                      disabled={reviewMutation.isPending}
                      onClick={() => { if (confirm("اعتماد الطلب؟ سيُنشأ خصم على راتب الموظف.")) reviewMutation.mutate({ id: r.id, decision: "approved" }); }}
                      data-testid={`button-approve-${r.id}`}>
                      <CheckCircle2 className="h-4 w-4 ms-1" />اعتماد
                    </Button>
                    <Button size="sm" variant="outline" className="text-destructive border-destructive/30"
                      disabled={reviewMutation.isPending}
                      onClick={() => { const note = prompt("سبب الرفض (اختياري):") ?? undefined; reviewMutation.mutate({ id: r.id, decision: "rejected", note }); }}
                      data-testid={`button-reject-${r.id}`}>
                      <XCircle className="h-4 w-4 ms-1" />رفض
                    </Button>
                  </div>
                </div>
              ))}
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
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm("حذف هذه السلفة؟")) deleteMutation.mutate(a.id); }} data-testid={`button-delete-${a.id}`}>
                        <Trash2 className="h-3.5 w-3.5 text-red-600" />
                      </Button>
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
