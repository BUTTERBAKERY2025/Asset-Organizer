import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient as qc } from "@/lib/queryClient";
import { Ban, Plus, Edit, Trash2, Loader2, Calendar, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { InsiderBlackoutPeriod } from "@shared/schema";

const periodTypes = [
  { value: "pre_earnings", label: "قبل إعلان النتائج", color: "bg-red-100 text-red-800" },
  { value: "pre_disclosure", label: "قبل إفصاح جوهري", color: "bg-amber-100 text-amber-800" },
  { value: "event_specific", label: "حدث محدد", color: "bg-purple-100 text-purple-800" },
  { value: "other", label: "أخرى", color: "bg-gray-100 text-gray-800" },
];

const statuses = [
  { value: "active", label: "نشطة", color: "bg-green-100 text-green-800" },
  { value: "completed", label: "منتهية", color: "bg-gray-100 text-gray-800" },
  { value: "cancelled", label: "ملغية", color: "bg-red-100 text-red-800" },
];

const today = () => new Date().toISOString().slice(0, 10);

export default function BlackoutPeriodsPage() {
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState("active");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<InsiderBlackoutPeriod | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: periods = [], isLoading } = useQuery<InsiderBlackoutPeriod[]>({
    queryKey: ["/api/governance/blackout-periods"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => (await apiRequest("POST", "/api/governance/blackout-periods", data)).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/governance/blackout-periods"] });
      setShowCreate(false);
      toast({ title: "تم إنشاء فترة الحظر" });
    },
    onError: (e: any) => toast({ title: "فشل الإنشاء", description: e?.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) =>
      (await apiRequest("PATCH", `/api/governance/blackout-periods/${id}`, data)).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/governance/blackout-periods"] });
      setEditing(null);
      toast({ title: "تم التحديث" });
    },
    onError: (e: any) => toast({ title: "فشل التحديث", description: e?.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/governance/blackout-periods/${id}`)).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/governance/blackout-periods"] });
      setDeleteId(null);
      toast({ title: "تم الحذف" });
    },
    onError: (e: any) => toast({ title: "فشل الحذف", description: e?.message, variant: "destructive" }),
  });

  const filtered = useMemo(() =>
    periods.filter(p => activeTab === "all" || p.status === activeTab),
    [periods, activeTab]);

  const isInProgress = (p: InsiderBlackoutPeriod) => {
    const t = today();
    return p.status === "active" && p.startDate <= t && p.endDate >= t;
  };

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMutation.mutate({
      title: fd.get("title"),
      periodType: fd.get("periodType"),
      startDate: fd.get("startDate"),
      endDate: fd.get("endDate"),
      description: fd.get("description") || null,
      appliesToAll: true,
    });
  };

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editing) return;
    const fd = new FormData(e.currentTarget);
    updateMutation.mutate({
      id: editing.id,
      data: {
        title: fd.get("title"),
        periodType: fd.get("periodType"),
        startDate: fd.get("startDate"),
        endDate: fd.get("endDate"),
        description: fd.get("description") || null,
        status: fd.get("status"),
      },
    });
  };

  const getTypeBadge = (t: string) => {
    const pt = periodTypes.find(x => x.value === t);
    return <Badge className={pt?.color || ""}>{pt?.label || t}</Badge>;
  };
  const getStatusBadge = (s: string) => {
    const st = statuses.find(x => x.value === s);
    return <Badge className={st?.color || ""}>{st?.label || s}</Badge>;
  };

  return (
    <Layout>
      <div className="page-container space-y-4" dir="rtl">
        <PageHeader
          icon={Ban}
          tone="executive"
          title="فترات حظر التداول"
          description="منع المطلعين من التداول قبل الإعلانات الجوهرية (متطلب CMA)"
          backHref="/governance"
          actions={
            <Button onClick={() => setShowCreate(true)} className="gap-2" data-testid="btn-new-blackout">
              <Plus className="h-4 w-4" /> فترة حظر جديدة
            </Button>
          }
        />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">الكل ({periods.length})</TabsTrigger>
            {statuses.map(s => (
              <TabsTrigger key={s.value} value={s.value}>
                {s.label} ({periods.filter(p => p.status === s.value).length})
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            {isLoading ? (
              <Card><CardContent className="py-8 text-center text-gray-500">جاري التحميل…</CardContent></Card>
            ) : filtered.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-gray-500">
                  <Ban className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>لا توجد فترات حظر</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {filtered.map(p => {
                  const live = isInProgress(p);
                  return (
                    <Card
                      key={p.id}
                      className={live ? "border-red-300 bg-red-50/30" : ""}
                      data-testid={`blackout-card-${p.id}`}
                    >
                      <CardContent className="p-4 flex justify-between gap-4 flex-wrap">
                        <div className="flex-1 min-w-[280px]">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="font-semibold text-lg">{p.title}</h3>
                            {getTypeBadge(p.periodType)}
                            {getStatusBadge(p.status)}
                            {live && (
                              <Badge className="bg-red-600 text-white gap-1 animate-pulse">
                                <AlertTriangle className="h-3 w-3" /> سارٍ الآن
                              </Badge>
                            )}
                            {p.appliesToAll && <Badge variant="outline" className="text-xs">جميع المطلعين</Badge>}
                          </div>
                          <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                            <Calendar className="h-3 w-3" />
                            {p.startDate} ← {p.endDate}
                          </p>
                          {p.description && <p className="text-sm text-gray-600 mt-1">{p.description}</p>}
                        </div>
                        <div className="flex gap-2 items-start">
                          <Button variant="outline" size="sm" onClick={() => setEditing(p)} data-testid={`btn-edit-${p.id}`}>
                            <Edit className="h-4 w-4 ml-1" /> تعديل
                          </Button>
                          {isAdmin && (
                            <Button
                              variant="outline" size="sm"
                              className="text-red-600 border-red-200"
                              onClick={() => setDeleteId(p.id)}
                              data-testid={`btn-delete-${p.id}`}
                            >
                              <Trash2 className="h-4 w-4 ml-1" /> حذف
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="max-w-lg" dir="rtl">
            <DialogHeader>
              <DialogTitle>فترة حظر جديدة</DialogTitle>
              <DialogDescription>
                خلال هذه الفترة يُمنع المطلعون من التداول أو الإفصاح. ينطبق افتراضياً على جميع المطلعين.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <Label>عنوان الفترة *</Label>
                <Input name="title" required placeholder="مثال: قبل إعلان نتائج Q1 2026" data-testid="input-title" />
              </div>
              <div>
                <Label>نوع الفترة *</Label>
                <Select name="periodType" required defaultValue="pre_earnings">
                  <SelectTrigger data-testid="select-period-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {periodTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>تاريخ البدء *</Label>
                  <Input name="startDate" type="date" required data-testid="input-start" />
                </div>
                <div>
                  <Label>تاريخ الانتهاء *</Label>
                  <Input name="endDate" type="date" required data-testid="input-end" />
                </div>
              </div>
              <div>
                <Label>الوصف</Label>
                <Textarea name="description" rows={3} data-testid="input-description" />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>إلغاء</Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="btn-submit-create">
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "إنشاء"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
          <DialogContent className="max-w-lg" dir="rtl">
            <DialogHeader><DialogTitle>تعديل فترة الحظر</DialogTitle></DialogHeader>
            {editing && (
              <form onSubmit={handleUpdate} className="space-y-3">
                <div>
                  <Label>العنوان</Label>
                  <Input name="title" defaultValue={editing.title} required data-testid="input-edit-title" />
                </div>
                <div>
                  <Label>النوع</Label>
                  <Select name="periodType" defaultValue={editing.periodType}>
                    <SelectTrigger data-testid="select-edit-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {periodTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>تاريخ البدء</Label>
                    <Input name="startDate" type="date" defaultValue={editing.startDate} required data-testid="input-edit-start" />
                  </div>
                  <div>
                    <Label>تاريخ الانتهاء</Label>
                    <Input name="endDate" type="date" defaultValue={editing.endDate} required data-testid="input-edit-end" />
                  </div>
                </div>
                <div>
                  <Label>الحالة</Label>
                  <Select name="status" defaultValue={editing.status}>
                    <SelectTrigger data-testid="select-edit-status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {statuses.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>الوصف</Label>
                  <Textarea name="description" rows={3} defaultValue={editing.description ?? ""} data-testid="input-edit-description" />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setEditing(null)}>إلغاء</Button>
                  <Button type="submit" disabled={updateMutation.isPending} data-testid="btn-submit-edit">
                    {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ"}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle>تأكيد حذف الفترة</AlertDialogTitle>
              <AlertDialogDescription>الأفضل تغيير الحالة إلى "ملغية" بدل الحذف للحفاظ على سجل المراجعة.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                onClick={() => deleteId && deleteMutation.mutate(deleteId)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "جاري الحذف…" : "نعم، احذف"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
