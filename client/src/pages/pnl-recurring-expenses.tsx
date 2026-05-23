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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, RefreshCw, Trash2, Edit, ChevronRight } from "lucide-react";
import { useBranches } from "@/hooks/useBranches";
import { useToast } from "@/hooks/use-toast";

type RecurringEntry = {
  id?: number;
  branchId: string;
  category: string;
  name: string;
  monthlyAmount: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  vendor?: string | null;
  notes?: string | null;
  isActive: boolean;
};

const CATEGORIES: { value: string; label: string; color: string }[] = [
  { value: "subscription", label: "اشتراك", color: "bg-blue-100 text-blue-800" },
  { value: "insurance", label: "تأمين", color: "bg-green-100 text-green-800" },
  { value: "license", label: "رخصة", color: "bg-amber-100 text-amber-800" },
  { value: "service", label: "خدمة", color: "bg-purple-100 text-purple-800" },
  { value: "maintenance", label: "صيانة دورية", color: "bg-orange-100 text-orange-800" },
  { value: "other", label: "أخرى", color: "bg-gray-100 text-gray-800" },
];

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("ar-SA-u-nu-latn", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(n || 0);

export default function PnlRecurringExpensesPage() {
  const [, navigate] = useLocation();
  const { branches } = useBranches();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [branchFilter, setBranchFilter] = useState<string>("");
  const [activeOnly, setActiveOnly] = useState(false);
  const [editing, setEditing] = useState<RecurringEntry | null>(null);
  const [showDialog, setShowDialog] = useState(false);

  const { data: rows = [], isLoading } = useQuery<RecurringEntry[]>({
    queryKey: ["/api/pnl/recurring-expenses", branchFilter || "all", activeOnly],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (branchFilter) params.set("branchId", branchFilter);
      if (activeOnly) params.set("activeOnly", "1");
      const res = await fetch(`/api/pnl/recurring-expenses?${params}`);
      if (!res.ok) throw new Error("فشل التحميل");
      return res.json();
    },
  });

  const saveMut = useMutation({
    mutationFn: async (entry: RecurringEntry) => {
      const res = await fetch("/api/pnl/recurring-expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "فشل الحفظ" }));
        throw new Error(err.error || "فشل الحفظ");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/pnl/recurring-expenses"] });
      qc.invalidateQueries({ queryKey: ["/api/pnl/enhanced-summary"] });
      toast({ title: "تم الحفظ" });
      setShowDialog(false);
      setEditing(null);
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/pnl/recurring-expenses/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("فشل الحذف");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/pnl/recurring-expenses"] });
      qc.invalidateQueries({ queryKey: ["/api/pnl/enhanced-summary"] });
      toast({ title: "تم الحذف" });
    },
  });

  const openNew = () => {
    setEditing({
      branchId: branchFilter || (branches[0]?.id ?? ""),
      category: "subscription",
      name: "",
      monthlyAmount: 0,
      effectiveFrom: new Date().toISOString().slice(0, 10),
      effectiveTo: null,
      vendor: "",
      notes: "",
      isActive: true,
    });
    setShowDialog(true);
  };

  const branchName = (id: string) => branches.find(b => b.id === id)?.name || id;
  const catMeta = (v: string) => CATEGORIES.find(c => c.value === v) || CATEGORIES[CATEGORIES.length - 1];
  const total = rows.filter(r => r.isActive).reduce((s, r) => s + (r.monthlyAmount || 0), 0);

  return (
    <Layout>
      <div className="page-container space-y-4 sm:space-y-6" dir="rtl">
        <PageHeader
          icon={RefreshCw}
          tone="money"
          title="المصاريف الشهرية المتكررة"
          description="اشتراكات، تأمين، رخص، خدمات تتكرر شهرياً وتنطبق تلقائياً على كل الفترات السارية"
          backHref="/pnl-dashboard"
          actions={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate("/pnl-dashboard")} className="h-11 sm:h-9">
                <ChevronRight className="h-4 w-4 sm:ml-2" />
                <span className="hidden sm:inline">العودة للوحة P&L</span>
              </Button>
              <Button onClick={openNew} className="h-11 sm:h-9 bg-amber-500 hover:bg-amber-600" data-testid="button-new-recurring">
                <Plus className="h-4 w-4 sm:ml-2" />
                <span className="hidden sm:inline">إضافة مصروف متكرر</span>
              </Button>
            </div>
          }
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span>الفلاتر</span>
              <Badge className="text-base bg-amber-100 text-amber-900">
                المجموع الشهري النشط: {formatCurrency(total)}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 flex-wrap items-end">
              <div className="min-w-[240px]">
                <Label className="text-xs">الفرع</Label>
                <Select value={branchFilter || "all"} onValueChange={v => setBranchFilter(v === "all" ? "" : v)}>
                  <SelectTrigger data-testid="select-branch-filter"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الفروع</SelectItem>
                    {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={activeOnly} onCheckedChange={setActiveOnly} data-testid="switch-active-only" />
                <Label>النشطة فقط</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>المصاريف المتكررة ({rows.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : rows.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <RefreshCw className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p>لا توجد مصاريف متكررة. اضغط «إضافة مصروف متكرر».</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-right p-2">الاسم</th>
                      <th className="text-right p-2">التصنيف</th>
                      <th className="text-right p-2">الفرع</th>
                      <th className="text-right p-2">المورّد</th>
                      <th className="text-right p-2">القيمة الشهرية</th>
                      <th className="text-right p-2">من</th>
                      <th className="text-right p-2">إلى</th>
                      <th className="text-right p-2">الحالة</th>
                      <th className="text-left p-2">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => {
                      const cm = catMeta(r.category);
                      return (
                        <tr key={r.id} className="border-t hover:bg-muted/30">
                          <td className="p-2 font-medium">{r.name}</td>
                          <td className="p-2"><span className={`text-xs px-2 py-1 rounded ${cm.color}`}>{cm.label}</span></td>
                          <td className="p-2 text-muted-foreground">{branchName(r.branchId)}</td>
                          <td className="p-2 text-muted-foreground">{r.vendor || "—"}</td>
                          <td className="p-2 font-semibold">{formatCurrency(r.monthlyAmount)}</td>
                          <td className="p-2 text-xs">{r.effectiveFrom}</td>
                          <td className="p-2 text-xs">{r.effectiveTo || <span className="text-green-700">سارٍ</span>}</td>
                          <td className="p-2">
                            {r.isActive
                              ? <Badge className="bg-green-100 text-green-800">نشط</Badge>
                              : <Badge variant="outline">موقوف</Badge>}
                          </td>
                          <td className="p-2 text-left">
                            <div className="flex gap-1 justify-end">
                              <Button size="sm" variant="ghost" onClick={() => { setEditing(r); setShowDialog(true); }} data-testid={`btn-edit-recurring-${r.id}`}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => {
                                if (window.confirm("حذف هذا المصروف المتكرر؟")) deleteMut.mutate(r.id!);
                              }} data-testid={`btn-delete-recurring-${r.id}`}>
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent dir="rtl" className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing?.id ? "تعديل مصروف متكرر" : "إضافة مصروف متكرر"}</DialogTitle>
              <CardDescription>سيُضاف تلقائياً لكل شهر داخل فترة الصلاحية وتكون حالته «نشط».</CardDescription>
            </DialogHeader>
            {editing && (
              <div className="space-y-3 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>الفرع</Label>
                    <Select value={editing.branchId} onValueChange={v => setEditing({ ...editing, branchId: v })}>
                      <SelectTrigger data-testid="select-branch"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>التصنيف</Label>
                    <Select value={editing.category} onValueChange={v => setEditing({ ...editing, category: v })}>
                      <SelectTrigger data-testid="select-category"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>الاسم</Label>
                  <Input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="مثلاً: اشتراك نظام POS" data-testid="input-name" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>القيمة الشهرية (ريال)</Label>
                    <Input type="number" value={editing.monthlyAmount || ""} onChange={e => setEditing({ ...editing, monthlyAmount: parseFloat(e.target.value) || 0 })} data-testid="input-amount" />
                  </div>
                  <div>
                    <Label>المورّد</Label>
                    <Input value={editing.vendor || ""} onChange={e => setEditing({ ...editing, vendor: e.target.value })} data-testid="input-vendor" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>من تاريخ</Label>
                    <Input type="date" value={editing.effectiveFrom} onChange={e => setEditing({ ...editing, effectiveFrom: e.target.value })} data-testid="input-from" />
                  </div>
                  <div>
                    <Label>إلى تاريخ (اختياري)</Label>
                    <Input type="date" value={editing.effectiveTo || ""} onChange={e => setEditing({ ...editing, effectiveTo: e.target.value || null })} data-testid="input-to" />
                  </div>
                </div>
                <div>
                  <Label>ملاحظات</Label>
                  <Textarea rows={2} value={editing.notes || ""} onChange={e => setEditing({ ...editing, notes: e.target.value })} data-testid="input-notes" />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={editing.isActive} onCheckedChange={v => setEditing({ ...editing, isActive: v })} data-testid="switch-is-active" />
                  <Label>نشط (يُدرج في حسابات P&L)</Label>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>إلغاء</Button>
              <Button
                onClick={() => editing && saveMut.mutate(editing)}
                disabled={saveMut.isPending || !editing?.name || !editing?.branchId || !editing?.effectiveFrom || !editing?.monthlyAmount}
                className="bg-amber-600 hover:bg-amber-700"
                data-testid="button-save-recurring"
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
