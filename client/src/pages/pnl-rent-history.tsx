import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, History, Trash2, Edit, Home, ChevronRight } from "lucide-react";
import { useBranches } from "@/hooks/useBranches";
import { useToast } from "@/hooks/use-toast";

type RentEntry = {
  id?: number;
  branchId: string;
  monthlyAmount: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  contractRef?: string | null;
  notes?: string | null;
  createdAt?: string;
};

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(n || 0);

export default function PnlRentHistoryPage() {
  const [, navigate] = useLocation();
  const { branches } = useBranches();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [branchId, setBranchId] = useState<string>("");
  useEffect(() => {
    if (!branchId && branches.length > 0) setBranchId(branches[0].id);
  }, [branches, branchId]);

  const [editing, setEditing] = useState<RentEntry | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [entryMode, setEntryMode] = useState<"monthly" | "yearly">("monthly");
  const [yearlyAmount, setYearlyAmount] = useState<number>(0);

  const { data: rows = [], isLoading } = useQuery<RentEntry[]>({
    queryKey: ["/api/pnl/rent-history", branchId],
    queryFn: async () => {
      if (!branchId) return [];
      const res = await fetch(`/api/pnl/rent-history/${branchId}`);
      if (!res.ok) throw new Error("فشل تحميل سجل الإيجار");
      return res.json();
    },
    enabled: !!branchId,
  });

  const saveMut = useMutation({
    mutationFn: async (entry: RentEntry) => {
      const res = await fetch("/api/pnl/rent-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });
      if (!res.ok) throw new Error("فشل الحفظ");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/pnl/rent-history", branchId] });
      qc.invalidateQueries({ queryKey: ["/api/pnl/enhanced-summary"] });
      toast({ title: "تم حفظ بيانات الإيجار" });
      setShowDialog(false);
      setEditing(null);
    },
    onError: (e: any) => toast({ title: e.message || "فشل الحفظ", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/pnl/rent-history/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("فشل الحذف");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/pnl/rent-history", branchId] });
      qc.invalidateQueries({ queryKey: ["/api/pnl/enhanced-summary"] });
      toast({ title: "تم الحذف" });
    },
  });

  const openNew = () => {
    setEditing({
      branchId,
      monthlyAmount: 0,
      effectiveFrom: new Date().toISOString().slice(0, 10),
      effectiveTo: null,
      contractRef: "",
      notes: "",
    });
    setEntryMode("monthly");
    setYearlyAmount(0);
    setShowDialog(true);
  };

  // عند فتح حوار التعديل: ابدأ بوضع شهري (لأن المخزّن أصلاً شهري)
  useEffect(() => {
    if (editing?.id) {
      setEntryMode("monthly");
      setYearlyAmount((editing.monthlyAmount || 0) * 12);
    }
  }, [editing?.id]);

  return (
    <Layout>
      <div className="page-container space-y-4 sm:space-y-6" dir="rtl">
        <PageHeader
          icon={History}
          tone="money"
          title="سجل الإيجار"
          description="إدارة قيم الإيجار الشهري للفروع عبر فترات صلاحية"
          backHref="/pnl-dashboard"
          actions={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate("/pnl-dashboard")} className="h-11 sm:h-9">
                <ChevronRight className="h-4 w-4 sm:ml-2" />
                <span className="hidden sm:inline">العودة للوحة P&L</span>
              </Button>
              <Button onClick={openNew} disabled={!branchId} className="h-11 sm:h-9 bg-amber-500 hover:bg-amber-600" data-testid="button-new-rent-entry">
                <Plus className="h-4 w-4 sm:ml-2" />
                <span className="hidden sm:inline">إضافة فترة إيجار</span>
              </Button>
            </div>
          }
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Home className="h-5 w-5 text-blue-500" />
              اختر الفرع
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger className="w-full md:w-96" data-testid="select-branch">
                <SelectValue placeholder="اختر الفرع" />
              </SelectTrigger>
              <SelectContent>
                {branches.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>الفترات المسجلة</CardTitle>
            <CardDescription>
              لكل فترة قيمة إيجار سارية. الحاسبة تستخدم القيمة التي يكون أول الشهر داخل فترتها تلقائياً.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : rows.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p>لا توجد فترات مسجلة لهذا الفرع. اضغط «إضافة فترة إيجار».</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-right p-2">من تاريخ</th>
                      <th className="text-right p-2">إلى تاريخ</th>
                      <th className="text-right p-2">القيمة الشهرية</th>
                      <th className="text-right p-2">مرجع العقد</th>
                      <th className="text-right p-2">ملاحظات</th>
                      <th className="text-left p-2">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={r.id} className="border-t hover:bg-muted/30">
                        <td className="p-2">{r.effectiveFrom}</td>
                        <td className="p-2">{r.effectiveTo || <Badge variant="outline">سارٍ</Badge>}</td>
                        <td className="p-2 font-semibold">{formatCurrency(r.monthlyAmount)}</td>
                        <td className="p-2">{r.contractRef || "—"}</td>
                        <td className="p-2 text-xs text-muted-foreground max-w-xs truncate">{r.notes || "—"}</td>
                        <td className="p-2 text-left">
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="ghost" onClick={() => { setEditing(r); setShowDialog(true); }} data-testid={`btn-edit-rent-${r.id}`}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => {
                              if (window.confirm("حذف هذه الفترة؟")) deleteMut.mutate(r.id!);
                            }} data-testid={`btn-delete-rent-${r.id}`}>
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent dir="rtl" className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing?.id ? "تعديل فترة إيجار" : "إضافة فترة إيجار"}</DialogTitle>
              <CardDescription>اترك تاريخ «إلى» فارغاً للفترة السارية حتى إشعار آخر.</CardDescription>
            </DialogHeader>
            {editing && (
              <div className="space-y-3 py-2">
                {/* اختيار طريقة إدخال الإيجار */}
                <div className="rounded-lg border border-violet-100 bg-violet-50/40 p-3">
                  <Label className="text-xs text-muted-foreground mb-2 block">طريقة إدخال قيمة الإيجار</Label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEntryMode("monthly")}
                      className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition ${
                        entryMode === "monthly"
                          ? "border-violet-500 bg-violet-600 text-white shadow-sm"
                          : "border-border bg-white text-foreground hover:bg-muted"
                      }`}
                      data-testid="mode-monthly"
                    >
                      شهري ثابت
                    </button>
                    <button
                      type="button"
                      onClick={() => setEntryMode("yearly")}
                      className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition ${
                        entryMode === "yearly"
                          ? "border-violet-500 bg-violet-600 text-white shadow-sm"
                          : "border-border bg-white text-foreground hover:bg-muted"
                      }`}
                      data-testid="mode-yearly"
                    >
                      سنوي (يقسّم على 12)
                    </button>
                  </div>
                </div>

                {entryMode === "monthly" ? (
                  <div>
                    <Label>القيمة الشهرية (ريال)</Label>
                    <Input
                      type="number"
                      value={editing.monthlyAmount || ""}
                      onChange={e => {
                        const v = parseFloat(e.target.value) || 0;
                        setEditing({ ...editing, monthlyAmount: v });
                        setYearlyAmount(v * 12);
                      }}
                      placeholder="مثال: 5000"
                      data-testid="input-monthly-amount"
                    />
                    {editing.monthlyAmount > 0 && (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        يعادل سنوياً: <span className="font-semibold text-violet-700">{formatCurrency(editing.monthlyAmount * 12)}</span>
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <Label>القيمة السنوية (ريال)</Label>
                    <Input
                      type="number"
                      value={yearlyAmount || ""}
                      onChange={e => {
                        const yearly = parseFloat(e.target.value) || 0;
                        setYearlyAmount(yearly);
                        // تقسيم على 12 وتقريب لأقرب ريال
                        setEditing({ ...editing, monthlyAmount: Math.round((yearly / 12) * 100) / 100 });
                      }}
                      placeholder="مثال: 60000"
                      data-testid="input-yearly-amount"
                    />
                    {yearlyAmount > 0 && (
                      <p className="mt-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-1.5">
                        ↩ سيُحسب شهرياً تلقائياً: <span className="font-bold">{formatCurrency(editing.monthlyAmount)}</span> / شهر
                      </p>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>من تاريخ</Label>
                    <Input type="date" value={editing.effectiveFrom}
                      onChange={e => setEditing({ ...editing, effectiveFrom: e.target.value })} data-testid="input-from" />
                  </div>
                  <div>
                    <Label>إلى تاريخ (اختياري)</Label>
                    <Input type="date" value={editing.effectiveTo || ""}
                      onChange={e => setEditing({ ...editing, effectiveTo: e.target.value || null })} data-testid="input-to" />
                  </div>
                </div>
                <div>
                  <Label>مرجع العقد</Label>
                  <Input value={editing.contractRef || ""}
                    onChange={e => setEditing({ ...editing, contractRef: e.target.value })} data-testid="input-contract-ref" />
                </div>
                <div>
                  <Label>ملاحظات</Label>
                  <Textarea value={editing.notes || ""} rows={2}
                    onChange={e => setEditing({ ...editing, notes: e.target.value })} data-testid="input-notes" />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>إلغاء</Button>
              <Button
                onClick={() => editing && saveMut.mutate(editing)}
                disabled={saveMut.isPending || !editing?.effectiveFrom || !editing?.monthlyAmount}
                className="bg-amber-600 hover:bg-amber-700"
                data-testid="button-save-rent"
              >
                {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin ml-1" />}
                حفظ
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
