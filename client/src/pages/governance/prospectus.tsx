import { useState } from "react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient as qc } from "@/lib/queryClient";
import { FileText, Plus, Edit, Trash2, BookOpen, CheckCircle2, Clock, Loader2 } from "lucide-react";
import type { Prospectus, ProspectusSection } from "@shared/schema";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "مسودة", color: "bg-gray-100 text-gray-800" },
  under_review: { label: "قيد المراجعة", color: "bg-amber-100 text-amber-800" },
  approved: { label: "معتمدة", color: "bg-blue-100 text-blue-800" },
  published: { label: "منشورة", color: "bg-green-100 text-green-800" },
};
const SECTION_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "لم تبدأ", color: "bg-gray-100 text-gray-700" },
  drafted: { label: "مسودة", color: "bg-blue-100 text-blue-700" },
  reviewed: { label: "تمت المراجعة", color: "bg-amber-100 text-amber-800" },
  approved: { label: "معتمد", color: "bg-green-100 text-green-800" },
};

export default function ProspectusPage() {
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Prospectus | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editSection, setEditSection] = useState<ProspectusSection | null>(null);

  const { data: items = [] } = useQuery<Prospectus[]>({ queryKey: ["/api/governance/prospectuses"] });
  const { data: sections = [] } = useQuery<ProspectusSection[]>({
    queryKey: ["/api/governance/prospectuses", selectedId, "sections"],
    queryFn: async () => (await apiRequest("GET", `/api/governance/prospectuses/${selectedId}/sections`)).json(),
    enabled: !!selectedId,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ id, data }: { id?: number; data: any }) => {
      const method = id ? "PATCH" : "POST";
      const url = id ? `/api/governance/prospectuses/${id}` : "/api/governance/prospectuses";
      return (await apiRequest(method, url, data)).json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/governance/prospectuses"] });
      setShowForm(false); setEditing(null);
      toast({ title: "تم الحفظ" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/governance/prospectuses/${id}`, undefined)).json(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/governance/prospectuses"] }); setDeleteId(null); toast({ title: "تم الحذف" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message, variant: "destructive" }),
  });

  const sectionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => (await apiRequest("PATCH", `/api/governance/prospectus-sections/${id}`, data)).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/governance/prospectuses", selectedId, "sections"] });
      setEditSection(null);
      toast({ title: "تم تحديث القسم" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message, variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    saveMutation.mutate({
      id: editing?.id,
      data: {
        title: fd.get("title"),
        issueType: fd.get("issueType"),
        targetMarket: fd.get("targetMarket"),
        version: fd.get("version"),
        status: fd.get("status"),
        offeringSize: fd.get("offeringSize") || null,
        sharePrice: fd.get("sharePrice") || null,
        totalShares: fd.get("totalShares") ? Number(fd.get("totalShares")) : null,
        leadManager: fd.get("leadManager"),
        legalAdvisor: fd.get("legalAdvisor"),
        auditor: fd.get("auditor"),
      },
    });
  };

  const handleSectionSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editSection) return;
    const fd = new FormData(e.currentTarget);
    sectionMutation.mutate({ id: editSection.id, data: { content: fd.get("content"), status: fd.get("status") } });
  };

  const selectedProspectus = items.find(p => p.id === selectedId);
  const completionPct = sections.length === 0 ? 0 : Math.round((sections.filter(s => s.status === "approved").length / sections.length) * 100);

  return (
    <Layout>
      <div className="space-y-6 p-6" dir="rtl">
        <PageHeader title="نشرة الإصدار" subtitle="مولّد نشرة إصدار أولية بصيغة هيئة السوق المالية (CMA) لإدراج نمو" />

        {!selectedId ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between"><CardTitle>نشرات الإصدار</CardTitle>
              {isAdmin && <Button onClick={() => { setEditing(null); setShowForm(true); }} data-testid="button-new-prospectus"><Plus className="h-4 w-4 ml-1" /> نشرة جديدة</Button>}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>العنوان</TableHead><TableHead>النوع</TableHead><TableHead>السوق</TableHead><TableHead>الإصدار</TableHead><TableHead>الحالة</TableHead><TableHead>إجراءات</TableHead></TableRow></TableHeader>
                <TableBody>
                  {items.map(p => {
                    const s = STATUS_LABELS[p.status] || STATUS_LABELS.draft;
                    return (
                      <TableRow key={p.id} data-testid={`row-prospectus-${p.id}`}>
                        <TableCell className="font-medium cursor-pointer text-blue-700 hover:underline" onClick={() => setSelectedId(p.id)}>{p.title}</TableCell>
                        <TableCell><Badge variant="outline">{p.issueType === "ipo" ? "اكتتاب أولي" : p.issueType === "rights_issue" ? "حقوق أولوية" : "زيادة رأس مال"}</Badge></TableCell>
                        <TableCell><Badge>{p.targetMarket === "nomu" ? "نمو" : "السوق الرئيسية"}</Badge></TableCell>
                        <TableCell>{p.version}</TableCell>
                        <TableCell><Badge className={s.color}>{s.label}</Badge></TableCell>
                        <TableCell className="space-x-1 space-x-reverse">
                          <Button variant="ghost" size="sm" onClick={() => setSelectedId(p.id)} data-testid={`button-open-prospectus-${p.id}`}><BookOpen className="h-4 w-4" /></Button>
                          {isAdmin && <Button variant="ghost" size="sm" onClick={() => { setEditing(p); setShowForm(true); }}><Edit className="h-4 w-4" /></Button>}
                          {isAdmin && <Button variant="ghost" size="sm" onClick={() => setDeleteId(p.id)}><Trash2 className="h-4 w-4 text-red-600" /></Button>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {items.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-gray-500 py-6">لا توجد نشرات إصدار</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => setSelectedId(null)}>→ العودة للقائمة</Button>
              <div className="text-sm text-gray-500">{selectedProspectus?.title} — {selectedProspectus?.version}</div>
            </div>
            <Card>
              <CardHeader><CardTitle className="flex items-center justify-between">أقسام النشرة (متطلبات هيئة السوق المالية)<div className="text-sm font-normal text-gray-500">نسبة الإنجاز: {completionPct}%</div></CardTitle><Progress value={completionPct} className="h-2" /></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>#</TableHead><TableHead>القسم</TableHead><TableHead>الحالة</TableHead><TableHead>إجراءات</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {sections.map((s, i) => {
                      const st = SECTION_STATUS[s.status] || SECTION_STATUS.pending;
                      return (
                        <TableRow key={s.id} data-testid={`row-section-${s.id}`}>
                          <TableCell>{i + 1}</TableCell>
                          <TableCell className="font-medium">{s.title}{s.requiredByCma && <Badge variant="outline" className="mr-2 text-xs">CMA</Badge>}</TableCell>
                          <TableCell><Badge className={st.color}>{st.label}</Badge></TableCell>
                          <TableCell>{isAdmin && <Button variant="ghost" size="sm" onClick={() => setEditSection(s)} data-testid={`button-edit-section-${s.id}`}><Edit className="h-4 w-4" /></Button>}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}

        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent dir="rtl" className="max-w-2xl"><DialogHeader><DialogTitle>{editing ? "تعديل نشرة" : "نشرة إصدار جديدة"}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div><Label>العنوان</Label><Input name="title" required defaultValue={editing?.title} data-testid="input-prospectus-title" /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>نوع الإصدار</Label>
                  <Select name="issueType" defaultValue={editing?.issueType || "ipo"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ipo">اكتتاب أولي</SelectItem><SelectItem value="rights_issue">حقوق أولوية</SelectItem><SelectItem value="capital_increase">زيادة رأس مال</SelectItem></SelectContent></Select>
                </div>
                <div><Label>السوق المستهدفة</Label>
                  <Select name="targetMarket" defaultValue={editing?.targetMarket || "nomu"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="nomu">نمو</SelectItem><SelectItem value="main">الرئيسية</SelectItem></SelectContent></Select>
                </div>
                <div><Label>الإصدار</Label><Input name="version" defaultValue={editing?.version || "v1.0"} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>حجم الطرح (ريال)</Label><Input type="number" step="0.01" name="offeringSize" defaultValue={editing?.offeringSize?.toString() || ""} /></div>
                <div><Label>سعر السهم</Label><Input type="number" step="0.0001" name="sharePrice" defaultValue={editing?.sharePrice?.toString() || ""} /></div>
                <div><Label>إجمالي الأسهم</Label><Input type="number" name="totalShares" defaultValue={editing?.totalShares?.toString() || ""} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>المستشار المالي</Label><Input name="leadManager" defaultValue={editing?.leadManager || ""} /></div>
                <div><Label>المستشار القانوني</Label><Input name="legalAdvisor" defaultValue={editing?.legalAdvisor || ""} /></div>
                <div><Label>المراجع الخارجي</Label><Input name="auditor" defaultValue={editing?.auditor || ""} /></div>
              </div>
              <div><Label>الحالة</Label>
                <Select name="status" defaultValue={editing?.status || "draft"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent></Select>
              </div>
              <DialogFooter><Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-1" />}حفظ</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={!!editSection} onOpenChange={() => setEditSection(null)}>
          <DialogContent dir="rtl" className="max-w-3xl"><DialogHeader><DialogTitle>{editSection?.title}</DialogTitle></DialogHeader>
            {editSection && (
              <form onSubmit={handleSectionSubmit} className="space-y-3">
                <div><Label>محتوى القسم</Label><Textarea name="content" rows={12} defaultValue={editSection.content || ""} placeholder="اكتب محتوى هذا القسم..." data-testid="textarea-section-content" /></div>
                <div><Label>الحالة</Label>
                  <Select name="status" defaultValue={editSection.status}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(SECTION_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent></Select>
                </div>
                <DialogFooter><Button type="submit" disabled={sectionMutation.isPending}>{sectionMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-1" />}حفظ</Button></DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent dir="rtl"><AlertDialogHeader><AlertDialogTitle>حذف النشرة</AlertDialogTitle><AlertDialogDescription>سيتم حذف النشرة وجميع أقسامها.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>إلغاء</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteId && deleteMutation.mutate(deleteId)}>حذف</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
