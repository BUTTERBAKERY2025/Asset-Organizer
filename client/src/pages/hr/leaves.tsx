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
import { CalendarDays, Plus, CheckCircle2, XCircle, Clock, Trash2 } from "lucide-react";
import { LEAVE_TYPE_LABELS, LEAVE_STATUS_LABELS } from "@shared/schema";

type Leave = any;
type Emp = { id: number; employeeName: string; jobTitle: string; branchId: string };

const initialForm = {
  branchEmployeeId: "",
  branchId: "",
  leaveType: "annual",
  startDate: "",
  endDate: "",
  reason: "",
};

function calcDays(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return Math.max(0, Math.round((e - s) / (24 * 60 * 60 * 1000)) + 1);
}

export default function LeavesPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<typeof initialForm>(initialForm);
  const [reviewing, setReviewing] = useState<{ id: number; decision: "approved" | "rejected" } | null>(null);
  const [reviewNote, setReviewNote] = useState("");

  const { data: leaves = [], isLoading } = useQuery<Leave[]>({
    queryKey: ["/api/hr/leaves", filterStatus, filterType],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (filterType !== "all") params.set("type", filterType);
      const res = await apiRequest("GET", `/api/hr/leaves?${params}`);
      return res.json();
    },
  });

  const { data: stats } = useQuery<any>({
    queryKey: ["/api/hr/leaves/stats"],
    queryFn: async () => (await apiRequest("GET", "/api/hr/leaves/stats")).json(),
  });

  const { data: employees = [] } = useQuery<Emp[]>({
    queryKey: ["/api/branch-employees"],
    queryFn: async () => (await apiRequest("GET", "/api/branch-employees")).json(),
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return leaves;
    const q = search.toLowerCase();
    return leaves.filter((l: any) => (l.employeeName || "").toLowerCase().includes(q));
  }, [leaves, search]);

  const totalDays = calcDays(form.startDate, form.endDate);

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest("POST", "/api/hr/leaves", payload);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/hr/leaves"] });
      qc.invalidateQueries({ queryKey: ["/api/hr/leaves/stats"] });
      toast({ title: "تم تسجيل طلب الإجازة" });
      setForm(initialForm);
      setOpen(false);
    },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message || "فشل الحفظ", variant: "destructive" }),
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, decision, note }: any) =>
      (await apiRequest("POST", `/api/hr/leaves/${id}/review`, { decision, note })).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/hr/leaves"] });
      qc.invalidateQueries({ queryKey: ["/api/hr/leaves/stats"] });
      toast({ title: "تم تحديث الطلب" });
      setReviewing(null);
      setReviewNote("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/hr/leaves/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/hr/leaves"] });
      qc.invalidateQueries({ queryKey: ["/api/hr/leaves/stats"] });
      toast({ title: "تم الحذف" });
    },
  });

  const submit = () => {
    if (!form.branchEmployeeId || !form.startDate || !form.endDate) {
      toast({ title: "بيانات ناقصة", variant: "destructive" });
      return;
    }
    const emp = employees.find((e) => e.id === parseInt(form.branchEmployeeId, 10));
    if (!emp) return;
    saveMutation.mutate({
      branchEmployeeId: parseInt(form.branchEmployeeId, 10),
      branchId: emp.branchId,
      leaveType: form.leaveType,
      startDate: form.startDate,
      endDate: form.endDate,
      totalDays,
      reason: form.reason,
    });
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      pending: "bg-amber-100 text-amber-700",
      approved: "bg-emerald-100 text-emerald-700",
      rejected: "bg-red-100 text-red-700",
      cancelled: "bg-slate-100 text-slate-600",
    };
    return <Badge className={map[s] || ""}>{LEAVE_STATUS_LABELS[s] || s}</Badge>;
  };

  return (
    <div className="container mx-auto p-4 space-y-4" dir="rtl" data-testid="page-hr-leaves">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-7 w-7 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold">طلبات الإجازات</h1>
            <p className="text-sm text-muted-foreground">إدارة طلبات الإجازات والموافقة عليها</p>
          </div>
        </div>
        <Button onClick={() => setOpen(true)} data-testid="button-add-leave">
          <Plus className="h-4 w-4 ms-2" />طلب إجازة جديد
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="إجمالي الطلبات" value={stats?.total ?? 0} icon={<CalendarDays className="h-5 w-5" />} />
        <StatCard label="قيد المراجعة" value={stats?.pending ?? 0} icon={<Clock className="h-5 w-5" />} accent="amber" />
        <StatCard label="معتمدة" value={stats?.approved ?? 0} icon={<CheckCircle2 className="h-5 w-5" />} accent="emerald" />
        <StatCard label="مرفوضة" value={stats?.rejected ?? 0} icon={<XCircle className="h-5 w-5" />} accent="red" />
        <StatCard label="في إجازة اليوم" value={stats?.onLeaveToday ?? 0} icon={<CalendarDays className="h-5 w-5" />} accent="blue" />
      </div>

      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Input placeholder="بحث باسم الموظف" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search-leaves" />
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger data-testid="select-filter-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                {Object.entries(LEAVE_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger data-testid="select-filter-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأنواع</SelectItem>
                {Object.entries(LEAVE_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-right p-2">الموظف</th>
                  <th className="text-right p-2">النوع</th>
                  <th className="text-right p-2">من - إلى</th>
                  <th className="text-right p-2">أيام</th>
                  <th className="text-right p-2">الحالة</th>
                  <th className="text-right p-2">المراجع</th>
                  <th className="text-right p-2">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">جاري التحميل...</td></tr>}
                {!isLoading && filtered.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">لا توجد طلبات</td></tr>}
                {filtered.map((l: any) => (
                  <tr key={l.id} className="border-t hover:bg-slate-50" data-testid={`row-leave-${l.id}`}>
                    <td className="p-2">
                      <div className="font-medium">{l.employeeName || "-"}</div>
                      <div className="text-xs text-muted-foreground">{l.employeeJob || ""}</div>
                    </td>
                    <td className="p-2">{LEAVE_TYPE_LABELS[l.leaveType] || l.leaveType}</td>
                    <td className="p-2 text-xs">{l.startDate} → {l.endDate}</td>
                    <td className="p-2 tabular-nums">{Number(l.totalDays).toLocaleString("ar-SA-u-nu-latn")}</td>
                    <td className="p-2">{statusBadge(l.status)}</td>
                    <td className="p-2 text-xs">{l.reviewerName || "-"}</td>
                    <td className="p-2">
                      <div className="flex gap-1 flex-wrap">
                        {l.status === "pending" && (
                          <>
                            <Button size="sm" variant="ghost" className="text-emerald-600" onClick={() => setReviewing({ id: l.id, decision: "approved" })} data-testid={`button-approve-${l.id}`}>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setReviewing({ id: l.id, decision: "rejected" })} data-testid={`button-reject-${l.id}`}>
                              <XCircle className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => { if (confirm("حذف هذا الطلب؟")) deleteMutation.mutate(l.id); }} data-testid={`button-delete-${l.id}`}>
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

      {/* Create dialog */}
      <Dialog open={open} onOpenChange={(o) => { if (!o) { setForm(initialForm); setOpen(false); } else setOpen(true); }}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader><DialogTitle>طلب إجازة جديد</DialogTitle></DialogHeader>
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
              <Label>نوع الإجازة</Label>
              <Select value={form.leaveType} onValueChange={(v) => setForm({ ...form, leaveType: v })}>
                <SelectTrigger data-testid="select-leave-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(LEAVE_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>من تاريخ</Label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} data-testid="input-start-date" />
              </div>
              <div>
                <Label>إلى تاريخ</Label>
                <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} data-testid="input-end-date" />
              </div>
            </div>
            <div className="text-sm text-muted-foreground">إجمالي الأيام: <span className="font-bold tabular-nums">{totalDays.toLocaleString("ar-SA-u-nu-latn")}</span></div>
            <div>
              <Label>السبب / ملاحظات</Label>
              <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} data-testid="textarea-reason" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setForm(initialForm); setOpen(false); }}>إلغاء</Button>
            <Button onClick={submit} disabled={saveMutation.isPending} data-testid="button-save-leave">
              {saveMutation.isPending ? "جاري الحفظ..." : "حفظ الطلب"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review dialog */}
      <Dialog open={!!reviewing} onOpenChange={(o) => { if (!o) { setReviewing(null); setReviewNote(""); } }}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>{reviewing?.decision === "approved" ? "اعتماد طلب الإجازة" : "رفض طلب الإجازة"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>ملاحظة المراجع (اختياري)</Label>
            <Textarea value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} data-testid="textarea-review-note" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReviewing(null); setReviewNote(""); }}>إلغاء</Button>
            <Button
              variant={reviewing?.decision === "approved" ? "default" : "destructive"}
              onClick={() => reviewing && reviewMutation.mutate({ id: reviewing.id, decision: reviewing.decision, note: reviewNote })}
              disabled={reviewMutation.isPending}
              data-testid="button-confirm-review"
            >
              {reviewMutation.isPending ? "..." : reviewing?.decision === "approved" ? "اعتماد" : "رفض"}
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
          <div className="text-2xl font-bold tabular-nums">{Number(value).toLocaleString("ar-SA-u-nu-latn")}</div>
        </div>
        <div className={`p-2 rounded-lg ${accents[accent] || accents.amber}`}>{icon}</div>
      </CardContent>
    </Card>
  );
}
