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
import { AlertOctagon, Plus, FileSignature, Trash2, AlertTriangle } from "lucide-react";
import { WARNING_LEVEL_LABELS, WARNING_STATUS_LABELS } from "@shared/schema";

type Warning = any;
type Emp = { id: number; employeeName: string; jobTitle: string; branchId: string };

const initialForm = {
  branchEmployeeId: "",
  branchId: "",
  level: "verbal",
  reason: "",
  description: "",
  issuedDate: new Date().toISOString().slice(0, 10),
  deductionAmount: "0",
};

export default function WarningsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<typeof initialForm>(initialForm);
  const [ackId, setAckId] = useState<number | null>(null);
  const [ackSig, setAckSig] = useState("");

  const { data: warnings = [], isLoading } = useQuery<Warning[]>({
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

  const filtered = useMemo(() => {
    if (!search.trim()) return warnings;
    const q = search.toLowerCase();
    return warnings.filter((w: any) =>
      (w.employeeName || "").toLowerCase().includes(q) ||
      (w.reason || "").toLowerCase().includes(q),
    );
  }, [warnings, search]);

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => (await apiRequest("POST", "/api/hr/warnings", payload)).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/hr/warnings"] });
      qc.invalidateQueries({ queryKey: ["/api/hr/warnings/stats"] });
      toast({ title: "تم تسجيل الإنذار" });
      setForm(initialForm);
      setOpen(false);
    },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message || "فشل الحفظ", variant: "destructive" }),
  });

  const ackMutation = useMutation({
    mutationFn: async ({ id, signature }: any) => (await apiRequest("POST", `/api/hr/warnings/${id}/acknowledge`, { signature })).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/hr/warnings"] });
      toast({ title: "تم استلام الإنذار" });
      setAckId(null);
      setAckSig("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/hr/warnings/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/hr/warnings"] });
      qc.invalidateQueries({ queryKey: ["/api/hr/warnings/stats"] });
      toast({ title: "تم الحذف" });
    },
  });

  const submit = () => {
    if (!form.branchEmployeeId || !form.reason) {
      toast({ title: "بيانات ناقصة", variant: "destructive" });
      return;
    }
    const emp = employees.find((e) => e.id === parseInt(form.branchEmployeeId, 10));
    if (!emp) return;
    saveMutation.mutate({
      branchEmployeeId: parseInt(form.branchEmployeeId, 10),
      branchId: emp.branchId,
      level: form.level,
      reason: form.reason,
      description: form.description,
      issuedDate: form.issuedDate,
      deductionAmount: parseFloat(form.deductionAmount) || 0,
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
    <div className="container mx-auto p-4 space-y-4" dir="rtl" data-testid="page-hr-warnings">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <AlertOctagon className="h-7 w-7 text-red-600" />
          <div>
            <h1 className="text-2xl font-bold">الإنذارات والمخالفات</h1>
            <p className="text-sm text-muted-foreground">سجل الإجراءات التأديبية مع الجزاءات المالية</p>
          </div>
        </div>
        <Button onClick={() => setOpen(true)} data-testid="button-add-warning">
          <Plus className="h-4 w-4 ms-2" />إصدار إنذار
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
                  <th className="text-right p-2">السبب</th>
                  <th className="text-right p-2">التاريخ</th>
                  <th className="text-right p-2">الجزاء</th>
                  <th className="text-right p-2">الاستلام</th>
                  <th className="text-right p-2">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">جاري التحميل...</td></tr>}
                {!isLoading && filtered.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">لا توجد إنذارات</td></tr>}
                {filtered.map((w: any) => (
                  <tr key={w.id} className="border-t hover:bg-slate-50" data-testid={`row-warning-${w.id}`}>
                    <td className="p-2">
                      <div className="font-medium">{w.employeeName || "-"}</div>
                      <div className="text-xs text-muted-foreground">{w.employeeJob || ""}</div>
                    </td>
                    <td className="p-2">{levelBadge(w.level)}</td>
                    <td className="p-2 max-w-xs truncate" title={w.reason}>{w.reason}</td>
                    <td className="p-2 text-xs">{w.issuedDate}</td>
                    <td className="p-2 tabular-nums">{Number(w.deductionAmount || 0).toLocaleString("ar-SA-u-nu-latn")} ر.س</td>
                    <td className="p-2 text-xs">{w.acknowledgedAt ? <Badge className="bg-emerald-100 text-emerald-700">مُستلم</Badge> : <Badge variant="outline">لم يُستلم</Badge>}</td>
                    <td className="p-2">
                      <div className="flex gap-1">
                        {!w.acknowledgedAt && (
                          <Button size="sm" variant="ghost" onClick={() => setAckId(w.id)} data-testid={`button-ack-${w.id}`}>
                            <FileSignature className="h-3.5 w-3.5" />
                          </Button>
                        )}
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

      {/* Create */}
      <Dialog open={open} onOpenChange={(o) => { if (!o) { setForm(initialForm); setOpen(false); } else setOpen(true); }}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader><DialogTitle>إصدار إنذار جديد</DialogTitle></DialogHeader>
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
              <Label>السبب</Label>
              <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} data-testid="input-reason" />
            </div>
            <div>
              <Label>الوصف التفصيلي</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="textarea-description" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>تاريخ الإصدار</Label>
                <Input type="date" value={form.issuedDate} onChange={(e) => setForm({ ...form, issuedDate: e.target.value })} data-testid="input-issued-date" />
              </div>
              <div>
                <Label>الجزاء المالي (ر.س)</Label>
                <Input type="number" step="0.01" value={form.deductionAmount} onChange={(e) => setForm({ ...form, deductionAmount: e.target.value })} data-testid="input-deduction" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">إذا حددت جزاء مالي، سيتم إنشاء خصم تلقائي في كشف راتب الشهر.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setForm(initialForm); setOpen(false); }}>إلغاء</Button>
            <Button onClick={submit} disabled={saveMutation.isPending} data-testid="button-save-warning">
              {saveMutation.isPending ? "جاري الحفظ..." : "حفظ الإنذار"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Acknowledge dialog */}
      <Dialog open={!!ackId} onOpenChange={(o) => { if (!o) { setAckId(null); setAckSig(""); } }}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader><DialogTitle>إقرار باستلام الإنذار</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>التوقيع (اسم/توقيع المُستلم)</Label>
            <Input value={ackSig} onChange={(e) => setAckSig(e.target.value)} placeholder="اكتب اسم الموظف للإقرار" data-testid="input-signature" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAckId(null); setAckSig(""); }}>إلغاء</Button>
            <Button onClick={() => ackId && ackMutation.mutate({ id: ackId, signature: ackSig })} disabled={ackMutation.isPending} data-testid="button-confirm-ack">
              تأكيد الاستلام
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

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
