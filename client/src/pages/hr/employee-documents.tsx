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
import { FileText, Plus, AlertTriangle, CheckCircle2, XCircle, Trash2, Edit2 } from "lucide-react";
import { EMPLOYEE_DOCUMENT_TYPE_LABELS } from "@shared/schema";

type Doc = any;
type Emp = { id: number; employeeName: string; jobTitle: string; branchId: string };

const initialForm = {
  branchEmployeeId: "",
  documentType: "id_card",
  documentNumber: "",
  issueDate: "",
  expiryDate: "",
  issuingAuthority: "",
  notes: "",
};

export default function EmployeeDocumentsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<typeof initialForm>(initialForm);

  const { data: docs = [], isLoading } = useQuery<Doc[]>({
    queryKey: ["/api/hr/documents", filterType, filterStatus],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterType !== "all") params.set("type", filterType);
      if (filterStatus !== "all") params.set("status", filterStatus);
      const res = await apiRequest("GET", `/api/hr/documents?${params}`);
      return res.json();
    },
  });

  const { data: stats } = useQuery<any>({
    queryKey: ["/api/hr/documents/stats"],
    queryFn: async () => (await apiRequest("GET", "/api/hr/documents/stats")).json(),
  });

  const { data: employees = [] } = useQuery<Emp[]>({
    queryKey: ["/api/branch-employees"],
    queryFn: async () => (await apiRequest("GET", "/api/branch-employees")).json(),
  });

  const filtered = useMemo(() => {
    let r = docs;
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((d: any) =>
        (d.employeeName || "").toLowerCase().includes(q) ||
        (d.documentNumber || "").toLowerCase().includes(q),
      );
    }
    if (filterStatus !== "all") {
      r = r.filter((d: any) => (d.computedStatus || d.status) === filterStatus);
    }
    return r;
  }, [docs, search, filterStatus]);

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const url = editId ? `/api/hr/documents/${editId}` : "/api/hr/documents";
      const method = editId ? "PATCH" : "POST";
      const res = await apiRequest(method, url, payload);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/hr/documents"] });
      qc.invalidateQueries({ queryKey: ["/api/hr/documents/stats"] });
      toast({ title: editId ? "تم تحديث الوثيقة" : "تم إضافة الوثيقة" });
      resetForm();
    },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message || "فشل الحفظ", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/hr/documents/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/hr/documents"] });
      qc.invalidateQueries({ queryKey: ["/api/hr/documents/stats"] });
      toast({ title: "تم الحذف" });
    },
  });

  const resetForm = () => {
    setForm(initialForm);
    setEditId(null);
    setOpen(false);
  };

  const openEdit = (d: any) => {
    setEditId(d.id);
    setForm({
      branchEmployeeId: String(d.branchEmployeeId),
      documentType: d.documentType,
      documentNumber: d.documentNumber || "",
      issueDate: d.issueDate || "",
      expiryDate: d.expiryDate || "",
      issuingAuthority: d.issuingAuthority || "",
      notes: d.notes || "",
    });
    setOpen(true);
  };

  const submit = () => {
    if (!form.branchEmployeeId || !form.documentType) {
      toast({ title: "بيانات ناقصة", description: "اختر الموظف ونوع الوثيقة", variant: "destructive" });
      return;
    }
    saveMutation.mutate({
      ...form,
      branchEmployeeId: parseInt(form.branchEmployeeId, 10),
    });
  };

  const statusBadge = (s: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      active: { label: "ساري", cls: "bg-emerald-100 text-emerald-700" },
      expiring_soon: { label: "قارب على الانتهاء", cls: "bg-amber-100 text-amber-700" },
      expired: { label: "منتهي", cls: "bg-red-100 text-red-700" },
      archived: { label: "مؤرشف", cls: "bg-slate-100 text-slate-600" },
    };
    const m = map[s] || map.active;
    return <Badge className={m.cls}>{m.label}</Badge>;
  };

  return (
    <div className="container mx-auto p-4 space-y-4" dir="rtl" data-testid="page-hr-documents">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <FileText className="h-7 w-7 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold">وثائق الموظفين</h1>
            <p className="text-sm text-muted-foreground">إدارة الهويات والإقامات والشهادات مع تنبيهات انتهاء الصلاحية</p>
          </div>
        </div>
        <Button onClick={() => { resetForm(); setOpen(true); }} data-testid="button-add-document">
          <Plus className="h-4 w-4 ms-2" />إضافة وثيقة
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="إجمالي الوثائق" value={stats?.total ?? 0} icon={<FileText className="h-5 w-5" />} />
        <StatCard label="منتهية" value={stats?.expired ?? 0} icon={<XCircle className="h-5 w-5" />} accent="red" />
        <StatCard label="قاربت على الانتهاء (30 يوم)" value={stats?.expiringSoon ?? 0} icon={<AlertTriangle className="h-5 w-5" />} accent="amber" />
        <StatCard label="سارية" value={(stats?.total ?? 0) - (stats?.expired ?? 0) - (stats?.expiringSoon ?? 0)} icon={<CheckCircle2 className="h-5 w-5" />} accent="emerald" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">الوثائق المسجلة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Input
              placeholder="بحث (اسم موظف أو رقم وثيقة)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-documents"
            />
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger data-testid="select-filter-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأنواع</SelectItem>
                {Object.entries(EMPLOYEE_DOCUMENT_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger data-testid="select-filter-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                <SelectItem value="active">سارية</SelectItem>
                <SelectItem value="expiring_soon">قاربت على الانتهاء</SelectItem>
                <SelectItem value="expired">منتهية</SelectItem>
                <SelectItem value="archived">مؤرشفة</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-right p-2">الموظف</th>
                  <th className="text-right p-2">نوع الوثيقة</th>
                  <th className="text-right p-2">رقم الوثيقة</th>
                  <th className="text-right p-2">تاريخ الانتهاء</th>
                  <th className="text-right p-2">الحالة</th>
                  <th className="text-right p-2">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">جاري التحميل...</td></tr>}
                {!isLoading && filtered.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">لا توجد وثائق</td></tr>}
                {filtered.map((d: any) => (
                  <tr key={d.id} className="border-t hover:bg-slate-50" data-testid={`row-document-${d.id}`}>
                    <td className="p-2">
                      <div className="font-medium">{d.employeeName || "-"}</div>
                      <div className="text-xs text-muted-foreground">{d.employeeJob || ""}</div>
                    </td>
                    <td className="p-2">{EMPLOYEE_DOCUMENT_TYPE_LABELS[d.documentType] || d.documentType}</td>
                    <td className="p-2 font-mono text-xs">{d.documentNumber || "-"}</td>
                    <td className="p-2">{d.expiryDate || "-"}</td>
                    <td className="p-2">{statusBadge(d.computedStatus || d.status)}</td>
                    <td className="p-2">
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(d)} data-testid={`button-edit-${d.id}`}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { if (confirm("حذف هذه الوثيقة؟")) deleteMutation.mutate(d.id); }} data-testid={`button-delete-${d.id}`}>
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

      <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); else setOpen(true); }}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editId ? "تعديل وثيقة" : "إضافة وثيقة جديدة"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>الموظف</Label>
              <Select value={form.branchEmployeeId} onValueChange={(v) => setForm({ ...form, branchEmployeeId: v })}>
                <SelectTrigger data-testid="select-employee"><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>{e.employeeName} — {e.jobTitle}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>نوع الوثيقة</Label>
              <Select value={form.documentType} onValueChange={(v) => setForm({ ...form, documentType: v })}>
                <SelectTrigger data-testid="select-doc-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(EMPLOYEE_DOCUMENT_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>رقم الوثيقة</Label>
                <Input value={form.documentNumber} onChange={(e) => setForm({ ...form, documentNumber: e.target.value })} data-testid="input-doc-number" />
              </div>
              <div>
                <Label>الجهة المُصدرة</Label>
                <Input value={form.issuingAuthority} onChange={(e) => setForm({ ...form, issuingAuthority: e.target.value })} data-testid="input-issuer" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>تاريخ الإصدار</Label>
                <Input type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} data-testid="input-issue-date" />
              </div>
              <div>
                <Label>تاريخ الانتهاء</Label>
                <Input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} data-testid="input-expiry-date" />
              </div>
            </div>
            <div>
              <Label>ملاحظات</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} data-testid="textarea-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>إلغاء</Button>
            <Button onClick={submit} disabled={saveMutation.isPending} data-testid="button-save-document">
              {saveMutation.isPending ? "جاري الحفظ..." : "حفظ"}
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
