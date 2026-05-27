import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient as qc } from "@/lib/queryClient";
import { Megaphone, Plus, Edit, Trash2, Lock, Send, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import type { MaterialDisclosure } from "@shared/schema";

const CATEGORIES: Record<string, string> = {
  financial_results: "نتائج مالية", dividend: "توزيعات أرباح", capital_change: "تغيير رأس المال",
  board_change: "تغيير المجلس", acquisition: "استحواذ", litigation: "نزاع قضائي",
  material_contract: "عقد جوهري", regulatory_action: "إجراء تنظيمي", major_loss: "خسارة جوهرية", other: "أخرى",
};
const SEVERITY: Record<string, { label: string; color: string }> = {
  low: { label: "منخفضة", color: "bg-gray-100 text-gray-700" },
  medium: { label: "متوسطة", color: "bg-blue-100 text-blue-800" },
  high: { label: "عالية", color: "bg-amber-100 text-amber-800" },
  critical: { label: "حرجة", color: "bg-red-100 text-red-800" },
};
const STATUS: Record<string, { label: string; color: string }> = {
  draft: { label: "مسودة", color: "bg-gray-100 text-gray-700" },
  under_review: { label: "قيد المراجعة", color: "bg-amber-100 text-amber-800" },
  approved: { label: "معتمد", color: "bg-blue-100 text-blue-800" },
  submitted: { label: "مُرسل", color: "bg-purple-100 text-purple-800" },
  published: { label: "منشور", color: "bg-green-100 text-green-800" },
  rejected: { label: "مرفوض", color: "bg-red-100 text-red-800" },
};

export default function MaterialDisclosuresPage() {
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<MaterialDisclosure | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [lockId, setLockId] = useState<number | null>(null);
  const [publishId, setPublishId] = useState<number | null>(null);

  const { data: items = [] } = useQuery<MaterialDisclosure[]>({ queryKey: ["/api/governance/material-disclosures"] });

  const kpis = useMemo(() => ({
    total: items.length,
    pending: items.filter(i => i.status === "draft" || i.status === "under_review" || i.status === "approved").length,
    published: items.filter(i => i.publishedToTadawul).length,
    critical: items.filter(i => i.severity === "critical").length,
    immediate: items.filter(i => i.requiresImmediateDisclosure && i.status !== "published").length,
  }), [items]);

  const saveMutation = useMutation({
    mutationFn: async ({ id, data }: { id?: number; data: any }) => {
      const method = id ? "PATCH" : "POST";
      const url = id ? `/api/governance/material-disclosures/${id}` : "/api/governance/material-disclosures";
      return (await apiRequest(method, url, data)).json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/governance/material-disclosures"] }); setShowForm(false); setEditing(null); toast({ title: "تم الحفظ" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message, variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/governance/material-disclosures/${id}`, undefined)).json(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/governance/material-disclosures"] }); setDeleteId(null); toast({ title: "تم الحذف" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message, variant: "destructive" }),
  });
  const lockMutation = useMutation({
    mutationFn: async (id: number) => (await apiRequest("POST", `/api/governance/material-disclosures/${id}/lock`, {})).json(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/governance/material-disclosures"] }); setLockId(null); toast({ title: "تم القفل النهائي" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message, variant: "destructive" }),
  });
  const publishMutation = useMutation({
    mutationFn: async (id: number) => (await apiRequest("POST", `/api/governance/material-disclosures/${id}/publish-tadawul`, {})).json(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/governance/material-disclosures"] }); setPublishId(null); toast({ title: "تم النشر إلى تداول" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message, variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const channels: string[] = [];
    ["tadawul", "website", "email", "whatsapp", "sms"].forEach(c => { if (fd.get(`channel_${c}`) === "on") channels.push(c); });
    saveMutation.mutate({
      id: editing?.id,
      data: {
        category: fd.get("category"),
        severity: fd.get("severity"),
        titleAr: fd.get("titleAr"),
        titleEn: fd.get("titleEn"),
        contentAr: fd.get("contentAr"),
        contentEn: fd.get("contentEn"),
        eventDate: fd.get("eventDate"),
        discoveryDate: fd.get("discoveryDate") || null,
        requiresImmediateDisclosure: fd.get("requiresImmediateDisclosure") === "on",
        status: fd.get("status") || "draft",
        publicationChannels: channels,
        regulatoryReference: fd.get("regulatoryReference"),
        notes: fd.get("notes"),
      },
    });
  };

  return (
    <Layout>
      <div className="space-y-6 p-6" dir="rtl">
        <PageHeader title="الإفصاحات الجوهرية" subtitle="تسجيل وتصنيف ونشر الإفصاحات الجوهرية إلى تداول وهيئة السوق المالية" />

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card><CardContent className="p-4"><div className="text-sm text-gray-500">الإجمالي</div><div className="text-2xl font-bold mt-1" data-testid="kpi-total">{kpis.total}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-sm text-gray-500">قيد المعالجة</div><div className="text-2xl font-bold mt-1 text-amber-700" data-testid="kpi-pending">{kpis.pending}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-sm text-gray-500">منشورة في تداول</div><div className="text-2xl font-bold mt-1 text-emerald-700" data-testid="kpi-published">{kpis.published}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-sm text-gray-500">حرجة</div><div className="text-2xl font-bold mt-1 text-red-700" data-testid="kpi-critical">{kpis.critical}</div></CardContent></Card>
          <Card className={kpis.immediate > 0 ? "border-red-300 bg-red-50" : ""}><CardContent className="p-4"><div className="text-sm text-gray-500">إفصاح فوري معلّق</div><div className="text-2xl font-bold mt-1 text-red-700 flex items-center gap-1" data-testid="kpi-immediate">{kpis.immediate > 0 && <AlertTriangle className="h-5 w-5" />}{kpis.immediate}</div></CardContent></Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between"><CardTitle>سجل الإفصاحات الجوهرية</CardTitle>
            {isAdmin && <Button onClick={() => { setEditing(null); setShowForm(true); }} data-testid="button-new-disclosure"><Plus className="h-4 w-4 ml-1" /> إفصاح جديد</Button>}
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>الرقم</TableHead><TableHead>العنوان</TableHead><TableHead>التصنيف</TableHead><TableHead>الأهمية</TableHead><TableHead>تاريخ الحدث</TableHead><TableHead>الحالة</TableHead><TableHead>تداول</TableHead><TableHead>إجراءات</TableHead></TableRow></TableHeader>
              <TableBody>
                {items.map(d => {
                  const s = STATUS[d.status] || STATUS.draft;
                  const sev = SEVERITY[d.severity] || SEVERITY.medium;
                  return (
                    <TableRow key={d.id} data-testid={`row-disclosure-${d.id}`}>
                      <TableCell className="font-mono text-xs">{d.disclosureNumber}</TableCell>
                      <TableCell className="font-medium flex items-center gap-2">{d.titleAr}{d.requiresImmediateDisclosure && <Badge className="bg-red-100 text-red-700 gap-1 text-xs"><AlertTriangle className="h-3 w-3" />فوري</Badge>}{d.isLocked && <Badge className="bg-amber-100 text-amber-800 gap-1"><Lock className="h-3 w-3" />مقفل</Badge>}</TableCell>
                      <TableCell>{CATEGORIES[d.category] || d.category}</TableCell>
                      <TableCell><Badge className={sev.color}>{sev.label}</Badge></TableCell>
                      <TableCell>{d.eventDate}</TableCell>
                      <TableCell><Badge className={s.color}>{s.label}</Badge></TableCell>
                      <TableCell>{d.publishedToTadawul ? <Badge className="bg-green-100 text-green-800 gap-1"><CheckCircle2 className="h-3 w-3" />{d.tadawulReference}</Badge> : "—"}</TableCell>
                      <TableCell className="space-x-1 space-x-reverse">
                        {isAdmin && !d.isLocked && <Button variant="ghost" size="sm" onClick={() => { setEditing(d); setShowForm(true); }} data-testid={`button-edit-${d.id}`}><Edit className="h-4 w-4" /></Button>}
                        {isAdmin && !d.publishedToTadawul && (d.status === "approved" || d.status === "submitted") && <Button variant="ghost" size="sm" onClick={() => setPublishId(d.id)} title="نشر إلى تداول" data-testid={`button-publish-${d.id}`}><Send className="h-4 w-4 text-purple-600" /></Button>}
                        {isAdmin && !d.isLocked && d.status === "published" && <Button variant="ghost" size="sm" onClick={() => setLockId(d.id)} title="قفل نهائي" data-testid={`button-lock-${d.id}`}><Lock className="h-4 w-4 text-amber-600" /></Button>}
                        {isAdmin && !d.isLocked && <Button variant="ghost" size="sm" onClick={() => setDeleteId(d.id)}><Trash2 className="h-4 w-4 text-red-600" /></Button>}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {items.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-gray-500 py-6">لا توجد إفصاحات</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent dir="rtl" className="max-w-3xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{editing ? "تعديل إفصاح" : "إفصاح جوهري جديد"}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>التصنيف</Label>
                  <Select name="category" defaultValue={editing?.category || "financial_results"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(CATEGORIES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
                </div>
                <div><Label>درجة الأهمية</Label>
                  <Select name="severity" defaultValue={editing?.severity || "medium"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(SEVERITY).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent></Select>
                </div>
              </div>
              <div><Label>العنوان (عربي)</Label><Input name="titleAr" required defaultValue={editing?.titleAr} data-testid="input-title-ar" /></div>
              <div><Label>العنوان (إنجليزي)</Label><Input name="titleEn" defaultValue={editing?.titleEn || ""} /></div>
              <div><Label>المحتوى (عربي)</Label><Textarea name="contentAr" rows={4} required defaultValue={editing?.contentAr} /></div>
              <div><Label>المحتوى (إنجليزي)</Label><Textarea name="contentEn" rows={3} defaultValue={editing?.contentEn || ""} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>تاريخ الحدث</Label><Input type="date" name="eventDate" required defaultValue={editing?.eventDate?.toString()} /></div>
                <div><Label>تاريخ الاكتشاف</Label><Input type="date" name="discoveryDate" defaultValue={editing?.discoveryDate?.toString() || ""} /></div>
              </div>
              <div className="flex items-center gap-2"><Checkbox id="requiresImmediateDisclosure" name="requiresImmediateDisclosure" defaultChecked={editing?.requiresImmediateDisclosure} /><Label htmlFor="requiresImmediateDisclosure" className="cursor-pointer text-red-700 font-semibold">يتطلب إفصاح فوري وفق متطلبات هيئة السوق المالية</Label></div>
              <div><Label>قنوات النشر</Label>
                <div className="flex gap-3 flex-wrap mt-2">
                  {["tadawul", "website", "email", "whatsapp", "sms"].map(c => {
                    const arr = (editing?.publicationChannels as string[] | undefined) || [];
                    const lbl: Record<string, string> = { tadawul: "تداول", website: "الموقع", email: "بريد", whatsapp: "واتساب", sms: "رسائل" };
                    return <div key={c} className="flex items-center gap-1"><Checkbox id={`channel_${c}`} name={`channel_${c}`} defaultChecked={arr.includes(c)} /><Label htmlFor={`channel_${c}`} className="cursor-pointer">{lbl[c]}</Label></div>;
                  })}
                </div>
              </div>
              <div><Label>المرجع التنظيمي</Label><Input name="regulatoryReference" defaultValue={editing?.regulatoryReference || ""} placeholder="مادة من نظام السوق المالية..." /></div>
              <div><Label>الحالة</Label>
                <Select name="status" defaultValue={editing?.status || "draft"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent></Select>
              </div>
              <div><Label>ملاحظات</Label><Textarea name="notes" rows={2} defaultValue={editing?.notes || ""} /></div>
              <DialogFooter><Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-1" />}حفظ</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!publishId} onOpenChange={() => setPublishId(null)}>
          <AlertDialogContent dir="rtl"><AlertDialogHeader><AlertDialogTitle>نشر الإفصاح إلى تداول</AlertDialogTitle><AlertDialogDescription>سيتم تسجيل النشر إلى تداول وتغيير الحالة إلى "منشور". تأكد من اعتماد الإفصاح من الجهة المختصة قبل النشر.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>إلغاء</AlertDialogCancel><AlertDialogAction className="bg-purple-600 hover:bg-purple-700" onClick={() => publishId && publishMutation.mutate(publishId)}>نشر إلى تداول</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={!!lockId} onOpenChange={() => setLockId(null)}>
          <AlertDialogContent dir="rtl"><AlertDialogHeader><AlertDialogTitle>قفل الإفصاح نهائياً</AlertDialogTitle><AlertDialogDescription>إجراء غير قابل للتراجع. سيتم منع التعديل والحذف بعد القفل.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>إلغاء</AlertDialogCancel><AlertDialogAction className="bg-amber-600 hover:bg-amber-700" onClick={() => lockId && lockMutation.mutate(lockId)}>قفل نهائي</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent dir="rtl"><AlertDialogHeader><AlertDialogTitle>حذف الإفصاح</AlertDialogTitle></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>إلغاء</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteId && deleteMutation.mutate(deleteId)}>حذف</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
