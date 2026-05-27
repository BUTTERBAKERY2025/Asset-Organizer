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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient as qc } from "@/lib/queryClient";
import { ClipboardCheck, Plus, Edit, Trash2, AlertOctagon, ChevronLeft, Loader2 } from "lucide-react";
import type { InternalAuditPlan, InternalAuditEngagement, InternalAuditFinding } from "@shared/schema";

const AREAS: Record<string, string> = { finance: "مالي", hr: "موارد بشرية", operations: "عمليات", it: "تقنية", procurement: "مشتريات", branches: "فروع", compliance: "امتثال", other: "أخرى" };
const PLAN_STATUS: Record<string, { label: string; color: string }> = {
  draft: { label: "مسودة", color: "bg-gray-100 text-gray-700" },
  approved: { label: "معتمدة", color: "bg-blue-100 text-blue-800" },
  in_progress: { label: "قيد التنفيذ", color: "bg-amber-100 text-amber-800" },
  completed: { label: "مكتملة", color: "bg-green-100 text-green-800" },
};
const ENG_STATUS: Record<string, { label: string; color: string }> = {
  planned: { label: "مخطط", color: "bg-gray-100 text-gray-700" },
  in_progress: { label: "قيد التنفيذ", color: "bg-amber-100 text-amber-800" },
  reporting: { label: "كتابة التقرير", color: "bg-blue-100 text-blue-800" },
  closed: { label: "مغلق", color: "bg-green-100 text-green-800" },
};
const SEVERITY: Record<string, { label: string; color: string }> = {
  low: { label: "منخفضة", color: "bg-gray-100 text-gray-700" },
  medium: { label: "متوسطة", color: "bg-blue-100 text-blue-800" },
  high: { label: "عالية", color: "bg-amber-100 text-amber-800" },
  critical: { label: "حرجة", color: "bg-red-100 text-red-800" },
};
const FIND_STATUS: Record<string, { label: string; color: string }> = {
  open: { label: "مفتوحة", color: "bg-red-100 text-red-800" },
  in_progress: { label: "قيد المعالجة", color: "bg-amber-100 text-amber-800" },
  resolved: { label: "مغلقة", color: "bg-green-100 text-green-800" },
  accepted_risk: { label: "مخاطرة مقبولة", color: "bg-purple-100 text-purple-800" },
  overdue: { label: "متأخرة", color: "bg-red-200 text-red-900" },
};

export default function InternalAuditPage() {
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [selectedEngagementId, setSelectedEngagementId] = useState<number | null>(null);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<InternalAuditPlan | null>(null);
  const [showEngForm, setShowEngForm] = useState(false);
  const [editingEng, setEditingEng] = useState<InternalAuditEngagement | null>(null);
  const [showFindForm, setShowFindForm] = useState(false);
  const [editingFind, setEditingFind] = useState<InternalAuditFinding | null>(null);
  const [delPlan, setDelPlan] = useState<number | null>(null);
  const [delEng, setDelEng] = useState<number | null>(null);
  const [delFind, setDelFind] = useState<number | null>(null);

  const { data: plans = [] } = useQuery<InternalAuditPlan[]>({ queryKey: ["/api/governance/audit-plans"] });
  const { data: engagements = [] } = useQuery<InternalAuditEngagement[]>({ queryKey: ["/api/governance/audit-engagements"] });
  const { data: findings = [] } = useQuery<InternalAuditFinding[]>({ queryKey: ["/api/governance/audit-findings"] });
  const { data: kpi } = useQuery<{ total: number; open: number; inProgress: number; resolved: number; critical: number; high: number; overdue: number }>({ queryKey: ["/api/governance/audit-findings/_kpi"] });

  const visibleEngagements = useMemo(() => selectedPlanId ? engagements.filter(e => e.planId === selectedPlanId) : engagements, [engagements, selectedPlanId]);
  const visibleFindings = useMemo(() => selectedEngagementId ? findings.filter(f => f.engagementId === selectedEngagementId) : findings, [findings, selectedEngagementId]);

  const planMutation = useMutation({
    mutationFn: async ({ id, data }: { id?: number; data: any }) => {
      const method = id ? "PATCH" : "POST";
      const url = id ? `/api/governance/audit-plans/${id}` : "/api/governance/audit-plans";
      return (await apiRequest(method, url, data)).json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/governance/audit-plans"] }); setShowPlanForm(false); setEditingPlan(null); toast({ title: "تم الحفظ" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message, variant: "destructive" }),
  });
  const engMutation = useMutation({
    mutationFn: async ({ id, data }: { id?: number; data: any }) => {
      const method = id ? "PATCH" : "POST";
      const url = id ? `/api/governance/audit-engagements/${id}` : "/api/governance/audit-engagements";
      return (await apiRequest(method, url, data)).json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/governance/audit-engagements"] }); setShowEngForm(false); setEditingEng(null); toast({ title: "تم الحفظ" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message, variant: "destructive" }),
  });
  const findMutation = useMutation({
    mutationFn: async ({ id, data }: { id?: number; data: any }) => {
      const method = id ? "PATCH" : "POST";
      const url = id ? `/api/governance/audit-findings/${id}` : "/api/governance/audit-findings";
      return (await apiRequest(method, url, data)).json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/governance/audit-findings"] });
      qc.invalidateQueries({ queryKey: ["/api/governance/audit-engagements"] });
      qc.invalidateQueries({ queryKey: ["/api/governance/audit-findings/_kpi"] });
      setShowFindForm(false); setEditingFind(null); toast({ title: "تم الحفظ" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message, variant: "destructive" }),
  });
  const delPlanMut = useMutation({ mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/governance/audit-plans/${id}`, undefined)).json(), onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/governance/audit-plans"] }); setDelPlan(null); toast({ title: "تم الحذف" }); } });
  const delEngMut = useMutation({ mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/governance/audit-engagements/${id}`, undefined)).json(), onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/governance/audit-engagements"] }); setDelEng(null); toast({ title: "تم الحذف" }); } });
  const delFindMut = useMutation({ mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/governance/audit-findings/${id}`, undefined)).json(), onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/governance/audit-findings"] }); qc.invalidateQueries({ queryKey: ["/api/governance/audit-findings/_kpi"] }); setDelFind(null); toast({ title: "تم الحذف" }); } });

  const handlePlanSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    planMutation.mutate({ id: editingPlan?.id, data: { title: fd.get("title"), fiscalYear: fd.get("fiscalYear"), scope: fd.get("scope"), objectives: fd.get("objectives"), status: fd.get("status") || "draft" } });
  };
  const handleEngSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    engMutation.mutate({
      id: editingEng?.id,
      data: {
        planId: fd.get("planId") ? Number(fd.get("planId")) : null,
        title: fd.get("title"),
        area: fd.get("area"),
        scope: fd.get("scope"),
        objectives: fd.get("objectives"),
        leadAuditor: fd.get("leadAuditor"),
        plannedStart: fd.get("plannedStart") || null,
        plannedEnd: fd.get("plannedEnd") || null,
        actualStart: fd.get("actualStart") || null,
        actualEnd: fd.get("actualEnd") || null,
        status: fd.get("status") || "planned",
      },
    });
  };
  const handleFindSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    findMutation.mutate({
      id: editingFind?.id,
      data: {
        engagementId: Number(fd.get("engagementId")),
        findingRef: fd.get("findingRef"),
        title: fd.get("title"),
        description: fd.get("description"),
        severity: fd.get("severity"),
        category: fd.get("category"),
        recommendation: fd.get("recommendation"),
        managementResponse: fd.get("managementResponse"),
        ownerName: fd.get("ownerName"),
        dueDate: fd.get("dueDate") || null,
        status: fd.get("status") || "open",
        resolutionNotes: fd.get("resolutionNotes"),
      },
    });
  };

  return (
    <Layout>
      <div className="space-y-6 p-6" dir="rtl">
        <PageHeader title="التدقيق الداخلي" subtitle="إدارة الخطط السنوية، عمليات التدقيق، ومتابعة الملاحظات" />

        {kpi && (
          <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
            <Card><CardContent className="p-3"><div className="text-xs text-gray-500">الإجمالي</div><div className="text-xl font-bold" data-testid="kpi-total">{kpi.total}</div></CardContent></Card>
            <Card><CardContent className="p-3"><div className="text-xs text-gray-500">مفتوحة</div><div className="text-xl font-bold text-red-700" data-testid="kpi-open">{kpi.open}</div></CardContent></Card>
            <Card><CardContent className="p-3"><div className="text-xs text-gray-500">قيد المعالجة</div><div className="text-xl font-bold text-amber-700">{kpi.inProgress}</div></CardContent></Card>
            <Card><CardContent className="p-3"><div className="text-xs text-gray-500">مغلقة</div><div className="text-xl font-bold text-emerald-700">{kpi.resolved}</div></CardContent></Card>
            <Card><CardContent className="p-3"><div className="text-xs text-gray-500">حرجة</div><div className="text-xl font-bold text-red-700">{kpi.critical}</div></CardContent></Card>
            <Card><CardContent className="p-3"><div className="text-xs text-gray-500">عالية</div><div className="text-xl font-bold text-amber-700">{kpi.high}</div></CardContent></Card>
            <Card className={kpi.overdue > 0 ? "border-red-300 bg-red-50" : ""}><CardContent className="p-3"><div className="text-xs text-gray-500">متأخرة</div><div className="text-xl font-bold text-red-700 flex items-center gap-1" data-testid="kpi-overdue">{kpi.overdue > 0 && <AlertOctagon className="h-4 w-4" />}{kpi.overdue}</div></CardContent></Card>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="dashboard"><ClipboardCheck className="h-4 w-4 ml-1" /> لوحة الملاحظات</TabsTrigger>
            <TabsTrigger value="plans">الخطط السنوية</TabsTrigger>
            <TabsTrigger value="engagements">عمليات التدقيق</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>كل الملاحظات{selectedEngagementId && <span className="text-sm font-normal text-gray-500 mr-2">(عملية: {engagements.find(e => e.id === selectedEngagementId)?.reference})</span>}</CardTitle>
                <div className="flex gap-2">
                  {selectedEngagementId && <Button variant="outline" size="sm" onClick={() => setSelectedEngagementId(null)}><ChevronLeft className="h-4 w-4 ml-1" />عرض الكل</Button>}
                  {isAdmin && engagements.length > 0 && <Button onClick={() => { setEditingFind(null); setShowFindForm(true); }} data-testid="button-new-finding"><Plus className="h-4 w-4 ml-1" /> ملاحظة جديدة</Button>}
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>المرجع</TableHead><TableHead>العنوان</TableHead><TableHead>العملية</TableHead><TableHead>الأهمية</TableHead><TableHead>المسؤول</TableHead><TableHead>تاريخ الاستحقاق</TableHead><TableHead>الحالة</TableHead><TableHead>إجراءات</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {visibleFindings.map(f => {
                      const sev = SEVERITY[f.severity] || SEVERITY.medium;
                      const st = FIND_STATUS[f.status] || FIND_STATUS.open;
                      const isOverdue = f.dueDate && new Date(f.dueDate) < new Date() && f.status !== "resolved" && f.status !== "accepted_risk";
                      return (
                        <TableRow key={f.id} data-testid={`row-finding-${f.id}`}>
                          <TableCell className="font-mono text-xs">{f.findingRef}</TableCell>
                          <TableCell className="font-medium">{f.title}</TableCell>
                          <TableCell>{engagements.find(e => e.id === f.engagementId)?.reference || "—"}</TableCell>
                          <TableCell><Badge className={sev.color}>{sev.label}</Badge></TableCell>
                          <TableCell>{f.ownerName || "—"}</TableCell>
                          <TableCell className={isOverdue ? "text-red-700 font-semibold" : ""}>{f.dueDate || "—"}</TableCell>
                          <TableCell><Badge className={st.color}>{st.label}</Badge></TableCell>
                          <TableCell className="space-x-1 space-x-reverse">
                            {isAdmin && <Button variant="ghost" size="sm" onClick={() => { setEditingFind(f); setShowFindForm(true); }}><Edit className="h-4 w-4" /></Button>}
                            {isAdmin && <Button variant="ghost" size="sm" onClick={() => setDelFind(f.id)}><Trash2 className="h-4 w-4 text-red-600" /></Button>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {visibleFindings.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-gray-500 py-6">لا توجد ملاحظات</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="plans">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between"><CardTitle>الخطط السنوية</CardTitle>
                {isAdmin && <Button onClick={() => { setEditingPlan(null); setShowPlanForm(true); }} data-testid="button-new-plan"><Plus className="h-4 w-4 ml-1" /> خطة جديدة</Button>}
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>العنوان</TableHead><TableHead>السنة</TableHead><TableHead>العمليات</TableHead><TableHead>الحالة</TableHead><TableHead>إجراءات</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {plans.map(p => {
                      const s = PLAN_STATUS[p.status] || PLAN_STATUS.draft;
                      return (
                        <TableRow key={p.id} data-testid={`row-plan-${p.id}`}>
                          <TableCell className="font-medium cursor-pointer text-blue-700 hover:underline" onClick={() => { setSelectedPlanId(p.id); setActiveTab("engagements"); }}>{p.title}</TableCell>
                          <TableCell>{p.fiscalYear}</TableCell>
                          <TableCell>{p.completedEngagements}/{p.totalEngagements || engagements.filter(e => e.planId === p.id).length}</TableCell>
                          <TableCell><Badge className={s.color}>{s.label}</Badge></TableCell>
                          <TableCell className="space-x-1 space-x-reverse">
                            {isAdmin && <Button variant="ghost" size="sm" onClick={() => { setEditingPlan(p); setShowPlanForm(true); }}><Edit className="h-4 w-4" /></Button>}
                            {isAdmin && <Button variant="ghost" size="sm" onClick={() => setDelPlan(p.id)}><Trash2 className="h-4 w-4 text-red-600" /></Button>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {plans.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-gray-500 py-6">لا توجد خطط</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="engagements">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>عمليات التدقيق{selectedPlanId && <span className="text-sm font-normal text-gray-500 mr-2">(خطة: {plans.find(p => p.id === selectedPlanId)?.title})</span>}</CardTitle>
                <div className="flex gap-2">
                  {selectedPlanId && <Button variant="outline" size="sm" onClick={() => setSelectedPlanId(null)}><ChevronLeft className="h-4 w-4 ml-1" />عرض الكل</Button>}
                  {isAdmin && <Button onClick={() => { setEditingEng(null); setShowEngForm(true); }} data-testid="button-new-engagement"><Plus className="h-4 w-4 ml-1" /> عملية جديدة</Button>}
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>المرجع</TableHead><TableHead>العنوان</TableHead><TableHead>المجال</TableHead><TableHead>قائد الفريق</TableHead><TableHead>الفترة المخططة</TableHead><TableHead>الملاحظات</TableHead><TableHead>الحالة</TableHead><TableHead>إجراءات</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {visibleEngagements.map(e => {
                      const s = ENG_STATUS[e.status] || ENG_STATUS.planned;
                      return (
                        <TableRow key={e.id} data-testid={`row-engagement-${e.id}`}>
                          <TableCell className="font-mono text-xs">{e.reference}</TableCell>
                          <TableCell className="font-medium cursor-pointer text-blue-700 hover:underline" onClick={() => { setSelectedEngagementId(e.id); setActiveTab("dashboard"); }}>{e.title}</TableCell>
                          <TableCell>{AREAS[e.area] || e.area}</TableCell>
                          <TableCell>{e.leadAuditor || "—"}</TableCell>
                          <TableCell className="text-xs">{e.plannedStart || "?"} → {e.plannedEnd || "?"}</TableCell>
                          <TableCell><span className="text-red-700 font-semibold">{e.openFindings}</span> / {e.totalFindings}</TableCell>
                          <TableCell><Badge className={s.color}>{s.label}</Badge></TableCell>
                          <TableCell className="space-x-1 space-x-reverse">
                            {isAdmin && <Button variant="ghost" size="sm" onClick={() => { setEditingEng(e); setShowEngForm(true); }}><Edit className="h-4 w-4" /></Button>}
                            {isAdmin && <Button variant="ghost" size="sm" onClick={() => setDelEng(e.id)}><Trash2 className="h-4 w-4 text-red-600" /></Button>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {visibleEngagements.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-gray-500 py-6">لا توجد عمليات تدقيق</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={showPlanForm} onOpenChange={setShowPlanForm}>
          <DialogContent dir="rtl"><DialogHeader><DialogTitle>{editingPlan ? "تعديل خطة" : "خطة سنوية جديدة"}</DialogTitle></DialogHeader>
            <form onSubmit={handlePlanSubmit} className="space-y-3">
              <div><Label>العنوان</Label><Input name="title" required defaultValue={editingPlan?.title} /></div>
              <div><Label>السنة المالية</Label><Input name="fiscalYear" required defaultValue={editingPlan?.fiscalYear || String(new Date().getFullYear())} /></div>
              <div><Label>النطاق</Label><Textarea name="scope" rows={2} defaultValue={editingPlan?.scope || ""} /></div>
              <div><Label>الأهداف</Label><Textarea name="objectives" rows={2} defaultValue={editingPlan?.objectives || ""} /></div>
              <div><Label>الحالة</Label>
                <Select name="status" defaultValue={editingPlan?.status || "draft"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(PLAN_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent></Select>
              </div>
              <DialogFooter><Button type="submit" disabled={planMutation.isPending}>{planMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-1" />}حفظ</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={showEngForm} onOpenChange={setShowEngForm}>
          <DialogContent dir="rtl" className="max-w-2xl"><DialogHeader><DialogTitle>{editingEng ? "تعديل عملية" : "عملية تدقيق جديدة"}</DialogTitle></DialogHeader>
            <form onSubmit={handleEngSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>الخطة (اختياري)</Label>
                  <Select name="planId" defaultValue={editingEng?.planId?.toString() || ""}><SelectTrigger><SelectValue placeholder="بدون خطة" /></SelectTrigger><SelectContent>{plans.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.title}</SelectItem>)}</SelectContent></Select>
                </div>
                <div><Label>المجال</Label>
                  <Select name="area" defaultValue={editingEng?.area || "finance"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(AREAS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
                </div>
              </div>
              <div><Label>العنوان</Label><Input name="title" required defaultValue={editingEng?.title} /></div>
              <div><Label>قائد الفريق</Label><Input name="leadAuditor" defaultValue={editingEng?.leadAuditor || ""} /></div>
              <div><Label>النطاق</Label><Textarea name="scope" rows={2} defaultValue={editingEng?.scope || ""} /></div>
              <div><Label>الأهداف</Label><Textarea name="objectives" rows={2} defaultValue={editingEng?.objectives || ""} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>بداية مخططة</Label><Input type="date" name="plannedStart" defaultValue={editingEng?.plannedStart?.toString() || ""} /></div>
                <div><Label>نهاية مخططة</Label><Input type="date" name="plannedEnd" defaultValue={editingEng?.plannedEnd?.toString() || ""} /></div>
                <div><Label>بداية فعلية</Label><Input type="date" name="actualStart" defaultValue={editingEng?.actualStart?.toString() || ""} /></div>
                <div><Label>نهاية فعلية</Label><Input type="date" name="actualEnd" defaultValue={editingEng?.actualEnd?.toString() || ""} /></div>
              </div>
              <div><Label>الحالة</Label>
                <Select name="status" defaultValue={editingEng?.status || "planned"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(ENG_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent></Select>
              </div>
              <DialogFooter><Button type="submit" disabled={engMutation.isPending}>{engMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-1" />}حفظ</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={showFindForm} onOpenChange={setShowFindForm}>
          <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{editingFind ? "تعديل ملاحظة" : "ملاحظة جديدة"}</DialogTitle></DialogHeader>
            <form onSubmit={handleFindSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>العملية</Label>
                  <Select name="engagementId" defaultValue={editingFind?.engagementId?.toString() || selectedEngagementId?.toString()} required><SelectTrigger><SelectValue placeholder="اختر العملية" /></SelectTrigger><SelectContent>{engagements.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.reference} — {e.title}</SelectItem>)}</SelectContent></Select>
                </div>
                <div><Label>المرجع</Label><Input name="findingRef" required defaultValue={editingFind?.findingRef || `F-${Date.now() % 10000}`} /></div>
              </div>
              <div><Label>العنوان</Label><Input name="title" required defaultValue={editingFind?.title} /></div>
              <div><Label>الوصف</Label><Textarea name="description" rows={3} defaultValue={editingFind?.description || ""} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>الأهمية</Label>
                  <Select name="severity" defaultValue={editingFind?.severity || "medium"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(SEVERITY).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent></Select>
                </div>
                <div><Label>التصنيف</Label>
                  <Select name="category" defaultValue={editingFind?.category || "control_weakness"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="control_weakness">ضعف رقابي</SelectItem><SelectItem value="non_compliance">عدم امتثال</SelectItem><SelectItem value="inefficiency">قصور في الكفاءة</SelectItem><SelectItem value="fraud_risk">مخاطر احتيال</SelectItem><SelectItem value="other">أخرى</SelectItem></SelectContent></Select>
                </div>
              </div>
              <div><Label>التوصية</Label><Textarea name="recommendation" rows={2} defaultValue={editingFind?.recommendation || ""} /></div>
              <div><Label>رد الإدارة</Label><Textarea name="managementResponse" rows={2} defaultValue={editingFind?.managementResponse || ""} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>المسؤول</Label><Input name="ownerName" defaultValue={editingFind?.ownerName || ""} /></div>
                <div><Label>تاريخ الاستحقاق</Label><Input type="date" name="dueDate" defaultValue={editingFind?.dueDate?.toString() || ""} /></div>
                <div><Label>الحالة</Label>
                  <Select name="status" defaultValue={editingFind?.status || "open"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(FIND_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent></Select>
                </div>
              </div>
              <div><Label>ملاحظات المعالجة</Label><Textarea name="resolutionNotes" rows={2} defaultValue={editingFind?.resolutionNotes || ""} /></div>
              <DialogFooter><Button type="submit" disabled={findMutation.isPending}>{findMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-1" />}حفظ</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!delPlan} onOpenChange={() => setDelPlan(null)}><AlertDialogContent dir="rtl"><AlertDialogHeader><AlertDialogTitle>حذف الخطة</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>إلغاء</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => delPlan && delPlanMut.mutate(delPlan)}>حذف</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
        <AlertDialog open={!!delEng} onOpenChange={() => setDelEng(null)}><AlertDialogContent dir="rtl"><AlertDialogHeader><AlertDialogTitle>حذف العملية</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>إلغاء</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => delEng && delEngMut.mutate(delEng)}>حذف</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
        <AlertDialog open={!!delFind} onOpenChange={() => setDelFind(null)}><AlertDialogContent dir="rtl"><AlertDialogHeader><AlertDialogTitle>حذف الملاحظة</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>إلغاء</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => delFind && delFindMut.mutate(delFind)}>حذف</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      </div>
    </Layout>
  );
}
