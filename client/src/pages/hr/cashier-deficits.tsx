import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { TrendingDown, ArrowRight, Send, CheckCircle2, AlertTriangle, User, Search, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Layout } from "@/components/layout";
import { Link } from "wouter";
import { usePermissions } from "@/hooks/usePermissions";

type JournalRow = {
  id: number;
  journalDate: string;
  branchName: string | null;
  shiftType: string | null;
  cashShortage: number;
  bankShortage: number;
  amount: number;
  posted: boolean;
  deficitDeductionId: number | null;
  deficitPostedAt: string | null;
};

type CashierGroup = {
  cashierId: string;
  cashierName: string | null;
  branchEmployeeId: number | null;
  employeeName: string | null;
  linked: boolean;
  journals: JournalRow[];
  totalDeficit: number;
  unpostedDeficit: number;
  unpostedCount: number;
};

const fmt = (n: number) => Number(n || 0).toLocaleString("ar-SA-u-nu-latn", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function CashierDeficitsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { hasPermission } = usePermissions();
  const canPost = hasPermission("hr_advances", "edit");

  // دعم فتح الصفحة على شهر محدد من رابط خارجي: /hr-cashier-deficits?month=YYYY-MM
  const urlMonth = (() => {
    try {
      const m = new URLSearchParams(window.location.search).get("month");
      return m && /^\d{4}-\d{2}$/.test(m) ? m : null;
    } catch { return null; }
  })();
  const [month, setMonth] = useState<string>(urlMonth || new Date().toISOString().slice(0, 7));
  const [postTarget, setPostTarget] = useState<CashierGroup | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deductionMonth, setDeductionMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [installments, setInstallments] = useState<string>("1");

  const { data, isLoading } = useQuery<{ month: string; cashiers: CashierGroup[] }>({
    queryKey: ["/api/hr/cashier-deficits", month],
    queryFn: async () => (await apiRequest("GET", `/api/hr/cashier-deficits?month=${month}`)).json(),
  });
  const allCashiers = data?.cashiers || [];

  // البحث بالاسم + فلتر الفرع (فلترة على المتصفح دون طلبات إضافية)
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState<string>("all");

  const branchOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of allCashiers) for (const j of c.journals) if (j.branchName) set.add(j.branchName);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ar"));
  }, [allCashiers]);

  const cashiers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allCashiers
      .map((c) => {
        const journals = branchFilter === "all" ? c.journals : c.journals.filter((j) => j.branchName === branchFilter);
        if (journals.length === 0) return null;
        const name = `${c.employeeName || ""} ${c.cashierName || ""}`.toLowerCase();
        if (q && !name.includes(q)) return null;
        if (journals === c.journals) return c;
        // إعادة حساب الإجماليات حسب اليوميات المعروضة بعد فلتر الفرع
        const unposted = journals.filter((j) => !j.posted);
        return {
          ...c,
          journals,
          totalDeficit: journals.reduce((s, j) => s + j.amount, 0),
          unpostedDeficit: unposted.reduce((s, j) => s + j.amount, 0),
          unpostedCount: unposted.length,
        };
      })
      .filter((c): c is CashierGroup => c !== null);
  }, [allCashiers, search, branchFilter]);

  const hasActiveFilter = search.trim() !== "" || branchFilter !== "all";
  const totalUnposted = cashiers.reduce((s, c) => s + c.unpostedDeficit, 0);
  const totalAll = cashiers.reduce((s, c) => s + c.totalDeficit, 0);

  const postMutation = useMutation({
    mutationFn: async (payload: { cashierId: string; month: string; deductionMonth: string; journalIds: number[]; installments?: number }) =>
      (await apiRequest("POST", "/api/hr/cashier-deficits/post", payload)).json(),
    onSuccess: (r: any) => {
      toast({ title: "تم الترحيل", description: `تم إنشاء خصم راتب بمبلغ ${fmt(r.total)} ر.س (${r.journalCount} يومية)` });
      setPostTarget(null);
      qc.invalidateQueries({ queryKey: ["/api/hr/cashier-deficits"] });
      qc.invalidateQueries({ queryKey: ["/api/hr/advances"] });
    },
    onError: (e: any) => toast({ title: "فشل الترحيل", description: e.message, variant: "destructive" }),
  });

  const openPostDialog = (c: CashierGroup) => {
    setPostTarget(c);
    setSelectedIds(new Set(c.journals.filter((j) => !j.posted).map((j) => j.id)));
    setDeductionMonth(new Date().toISOString().slice(0, 7));
    setInstallments("1");
  };

  const toggleId = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectedTotal = postTarget
    ? postTarget.journals.filter((j) => selectedIds.has(j.id)).reduce((s, j) => s + j.amount, 0)
    : 0;

  return (
    <Layout>
      <div className="container mx-auto p-4 space-y-4" dir="rtl" data-testid="page-cashier-deficits">
        <Link href="/hr/advances">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" data-testid="button-back-advances">
            <ArrowRight className="h-4 w-4 ms-1" />العودة للسلف والقروض
          </Button>
        </Link>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <TrendingDown className="h-7 w-7 text-red-600" />
            <div>
              <h1 className="text-2xl font-bold">العجوزات البيعية للكاشير</h1>
              <p className="text-sm text-muted-foreground">عجوزات يوميات المبيعات المعتمدة — ترحيلها كخصم راتب (بند: عجز يوميات مبيعات)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-sm">الشهر</Label>
            <Input type="month" className="w-44" value={month} onChange={(e) => setMonth(e.target.value)} data-testid="input-month" />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative w-full sm:w-64">
            <Search className="absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث باسم الكاشير أو الموظف..."
              className="pe-9"
              data-testid="input-search-cashier"
            />
          </div>
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="w-full sm:w-52" data-testid="select-branch-filter">
              <SelectValue placeholder="كل الفروع" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الفروع</SelectItem>
              {branchOptions.map((b) => (
                <SelectItem key={b} value={b}>{b}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasActiveFilter && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setSearch(""); setBranchFilter("all"); }}
              data-testid="button-clear-filters"
            >
              <X className="h-4 w-4 ms-1" />مسح الفلاتر
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card><CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">عدد الكاشيرات بعجوزات</div>
            <div className="text-2xl font-bold" data-testid="text-cashiers-count">{cashiers.length}</div>
          </CardContent></Card>
          <Card><CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">إجمالي العجوزات (ر.س)</div>
            <div className="text-2xl font-bold text-red-600" data-testid="text-total-deficit">{fmt(totalAll)}</div>
          </CardContent></Card>
          <Card><CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">غير مرحَّل بعد (ر.س)</div>
            <div className="text-2xl font-bold text-amber-600" data-testid="text-unposted-deficit">{fmt(totalUnposted)}</div>
          </CardContent></Card>
        </div>

        {isLoading ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">جاري التحميل...</CardContent></Card>
        ) : cashiers.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground" data-testid="text-empty">
            {hasActiveFilter ? "لا توجد نتائج مطابقة للبحث أو الفرع المحدد" : "لا توجد عجوزات معتمدة في هذا الشهر"}
          </CardContent></Card>
        ) : (
          <div className="space-y-3">
            {cashiers.map((c) => (
              <Card key={c.cashierId} data-testid={`card-cashier-${c.cashierId}`}>
                <CardContent className="pt-6 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                      <User className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="font-bold">{c.employeeName || c.cashierName || "كاشير غير معروف"}</div>
                        {!c.linked && (
                          <div className="text-xs text-amber-600 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />حساب الكاشير غير مرتبط بملف موظف — لا يمكن الترحيل
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="text-sm">
                        الإجمالي: <span className="font-bold text-red-600">{fmt(c.totalDeficit)}</span> ر.س
                        {c.unpostedDeficit > 0 && (
                          <span className="text-muted-foreground"> — غير مرحَّل: <span className="font-bold text-amber-600">{fmt(c.unpostedDeficit)}</span></span>
                        )}
                      </div>
                      {canPost && c.linked && c.unpostedCount > 0 && (
                        <Button size="sm" onClick={() => openPostDialog(c)} data-testid={`button-post-${c.cashierId}`}>
                          <Send className="h-4 w-4 ms-2" />ترحيل ({c.unpostedCount})
                        </Button>
                      )}
                      {c.unpostedCount === 0 && (
                        <Badge className="bg-emerald-100 text-emerald-700"><CheckCircle2 className="h-3 w-3 ms-1" />مرحَّل بالكامل</Badge>
                      )}
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground text-xs">
                          <th className="p-2 text-right">التاريخ</th>
                          <th className="p-2 text-right">الفرع</th>
                          <th className="p-2 text-right">عجز نقدي</th>
                          <th className="p-2 text-right">عجز بنكي</th>
                          <th className="p-2 text-right">الإجمالي</th>
                          <th className="p-2 text-right">الحالة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {c.journals.map((j) => (
                          <tr key={j.id} className="border-b last:border-0" data-testid={`row-journal-${j.id}`}>
                            <td className="p-2 font-mono text-xs">{j.journalDate}</td>
                            <td className="p-2 text-xs">{j.branchName || "-"}</td>
                            <td className="p-2 tabular-nums">{fmt(j.cashShortage)}</td>
                            <td className="p-2 tabular-nums">{fmt(j.bankShortage)}</td>
                            <td className="p-2 tabular-nums font-bold text-red-600">{fmt(j.amount)}</td>
                            <td className="p-2">
                              {j.posted
                                ? <Badge className="bg-emerald-100 text-emerald-700">مرحَّل</Badge>
                                : <Badge className="bg-amber-100 text-amber-700">غير مرحَّل</Badge>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={!!postTarget} onOpenChange={(o) => !o && setPostTarget(null)}>
          <DialogContent className="max-w-lg" dir="rtl">
            <DialogHeader>
              <DialogTitle>ترحيل عجوزات — {postTarget?.employeeName || postTarget?.cashierName}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                سيتم إنشاء خصم راتب واحد بمجموع اليوميات المحددة تحت بند «عجز يوميات مبيعات»، ويظهر في صفحة السلف والقروض ويُخصم تلقائياً عند إغلاق الرواتب.
              </p>
              <div className="space-y-2 max-h-56 overflow-y-auto border rounded-md p-2">
                {postTarget?.journals.filter((j) => !j.posted).map((j) => (
                  <label key={j.id} className="flex items-center gap-2 text-sm cursor-pointer" data-testid={`checkbox-journal-${j.id}`}>
                    <Checkbox checked={selectedIds.has(j.id)} onCheckedChange={() => toggleId(j.id)} />
                    <span className="font-mono text-xs">{j.journalDate}</span>
                    <span className="text-xs text-muted-foreground">{j.branchName}</span>
                    <span className="me-auto font-bold text-red-600 tabular-nums">{fmt(j.amount)} ر.س</span>
                  </label>
                ))}
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>المجموع المحدد:</span>
                <span className="font-bold text-red-600" data-testid="text-selected-total">{fmt(selectedTotal)} ر.س</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>شهر بداية الخصم من الراتب</Label>
                  <Input type="month" value={deductionMonth} onChange={(e) => setDeductionMonth(e.target.value)} data-testid="input-deduction-month" />
                </div>
                <div className="space-y-1">
                  <Label>تقسيط الخصم</Label>
                  <select
                    className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                    value={installments}
                    onChange={(e) => setInstallments(e.target.value)}
                    data-testid="select-installments"
                  >
                    <option value="1">دفعة واحدة</option>
                    <option value="2">على شهرين</option>
                    <option value="3">على 3 شهور</option>
                    <option value="4">على 4 شهور</option>
                    <option value="6">على 6 شهور</option>
                  </select>
                </div>
              </div>
              {Number(installments) > 1 && selectedTotal > 0 && (
                <div className="rounded-lg border bg-muted/40 p-2 text-xs" data-testid="text-installment-preview">
                  القسط الشهري التقريبي: <span className="font-bold tabular-nums">{fmt(selectedTotal / Number(installments))}</span> ر.س × {installments} شهور بدءاً من {deductionMonth}
                </div>
              )}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setPostTarget(null)} data-testid="button-cancel-post">إلغاء</Button>
              <Button
                disabled={selectedIds.size === 0 || postMutation.isPending}
                onClick={() => postTarget && postMutation.mutate({
                  cashierId: postTarget.cashierId,
                  month,
                  deductionMonth,
                  journalIds: Array.from(selectedIds),
                  installments: parseInt(installments, 10) || 1,
                })}
                data-testid="button-confirm-post"
              >
                <Send className="h-4 w-4 ms-2" />
                {postMutation.isPending ? "جاري الترحيل..." : "تأكيد الترحيل"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
