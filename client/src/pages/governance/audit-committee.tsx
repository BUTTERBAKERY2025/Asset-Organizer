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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient as qc } from "@/lib/queryClient";
import { Shield, Plus, Edit, Trash2, Lock, FileText, Users, CheckCircle2, Loader2 } from "lucide-react";
import type { AuditCommittee, AuditCommitteeMember, AuditCommitteeReport } from "@shared/schema";

const REPORT_TYPES = [
  { value: "quarterly", label: "ربعي" },
  { value: "annual", label: "سنوي" },
  { value: "special", label: "خاص" },
];
const PERIODS = ["Q1", "Q2", "Q3", "Q4", "FY"];
const ROLES = [
  { value: "chair", label: "رئيس اللجنة" },
  { value: "member", label: "عضو" },
  { value: "secretary", label: "أمين السر" },
];
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "مسودة", color: "bg-gray-100 text-gray-800" },
  approved: { label: "معتمد", color: "bg-blue-100 text-blue-800" },
  published: { label: "منشور", color: "bg-green-100 text-green-800" },
};

export default function AuditCommitteePage() {
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState("committees");
  const [showCommitteeForm, setShowCommitteeForm] = useState(false);
  const [editingCommittee, setEditingCommittee] = useState<AuditCommittee | null>(null);
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);
  const [editingReport, setEditingReport] = useState<AuditCommitteeReport | null>(null);
  const [selectedCommitteeId, setSelectedCommitteeId] = useState<number | null>(null);
  const [deleteCommitteeId, setDeleteCommitteeId] = useState<number | null>(null);
  const [deleteMemberId, setDeleteMemberId] = useState<number | null>(null);
  const [deleteReportId, setDeleteReportId] = useState<number | null>(null);
  const [lockReportId, setLockReportId] = useState<number | null>(null);

  const { data: committees = [] } = useQuery<AuditCommittee[]>({ queryKey: ["/api/governance/audit-committees"] });
  const { data: members = [] } = useQuery<AuditCommitteeMember[]>({ queryKey: ["/api/governance/audit-committee-members"] });
  const { data: reports = [] } = useQuery<AuditCommitteeReport[]>({ queryKey: ["/api/governance/audit-committee-reports"] });

  const independentRatio = useMemo(() => {
    const active = members.filter(m => m.status === "active");
    if (active.length === 0) return { ratio: 0, count: 0, total: 0 };
    const ind = active.filter(m => m.isIndependent).length;
    return { ratio: Math.round((ind / active.length) * 100), count: ind, total: active.length };
  }, [members]);

  const committeeMutation = useMutation({
    mutationFn: async ({ id, data }: { id?: number; data: any }) => {
      const method = id ? "PATCH" : "POST";
      const url = id ? `/api/governance/audit-committees/${id}` : "/api/governance/audit-committees";
      const res = await apiRequest(method, url, data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/governance/audit-committees"] });
      setShowCommitteeForm(false); setEditingCommittee(null);
      toast({ title: "تم الحفظ" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message, variant: "destructive" }),
  });

  const memberMutation = useMutation({
    mutationFn: async (data: any) => (await apiRequest("POST", "/api/governance/audit-committee-members", data)).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/governance/audit-committee-members"] });
      setShowMemberForm(false);
      toast({ title: "تم إضافة العضو" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message, variant: "destructive" }),
  });

  const reportMutation = useMutation({
    mutationFn: async ({ id, data }: { id?: number; data: any }) => {
      const method = id ? "PATCH" : "POST";
      const url = id ? `/api/governance/audit-committee-reports/${id}` : "/api/governance/audit-committee-reports";
      return (await apiRequest(method, url, data)).json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/governance/audit-committee-reports"] });
      setShowReportForm(false); setEditingReport(null);
      toast({ title: "تم الحفظ" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message, variant: "destructive" }),
  });

  const lockReportMutation = useMutation({
    mutationFn: async (id: number) => (await apiRequest("POST", `/api/governance/audit-committee-reports/${id}/lock`, {})).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/governance/audit-committee-reports"] });
      setLockReportId(null);
      toast({ title: "تم قفل التقرير نهائياً" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message, variant: "destructive" }),
  });

  const deleteCommitteeMutation = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/governance/audit-committees/${id}`, undefined)).json(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/governance/audit-committees"] }); setDeleteCommitteeId(null); toast({ title: "تم الحذف" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message, variant: "destructive" }),
  });
  const deleteMemberMutation = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/governance/audit-committee-members/${id}`, undefined)).json(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/governance/audit-committee-members"] }); setDeleteMemberId(null); toast({ title: "تم الحذف" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message, variant: "destructive" }),
  });
  const deleteReportMutation = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/governance/audit-committee-reports/${id}`, undefined)).json(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/governance/audit-committee-reports"] }); setDeleteReportId(null); toast({ title: "تم الحذف" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message, variant: "destructive" }),
  });

  const handleCommitteeSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    committeeMutation.mutate({
      id: editingCommittee?.id,
      data: {
        name: fd.get("name"),
        charter: fd.get("charter"),
        formationDate: fd.get("formationDate"),
        status: fd.get("status") || "active",
      },
    });
  };

  const handleMemberSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    memberMutation.mutate({
      committeeId: Number(fd.get("committeeId")),
      fullName: fd.get("fullName"),
      role: fd.get("role"),
      isIndependent: fd.get("isIndependent") === "on",
      isFinancialExpert: fd.get("isFinancialExpert") === "on",
      appointmentDate: fd.get("appointmentDate"),
      status: "active",
    });
  };

  const handleReportSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    reportMutation.mutate({
      id: editingReport?.id,
      data: {
        committeeId: Number(fd.get("committeeId")),
        reportType: fd.get("reportType"),
        fiscalYear: fd.get("fiscalYear"),
        period: fd.get("period"),
        title: fd.get("title"),
        summary: fd.get("summary"),
        recommendations: fd.get("recommendations"),
        status: fd.get("status") || "draft",
      },
    });
  };

  return (
    <Layout>
      <div className="space-y-6 p-6" dir="rtl">
        <PageHeader title="لجنة المراجعة" subtitle="إدارة لجنة المراجعة وأعضائها وتقاريرها الربعية والسنوية" />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card><CardContent className="p-4"><div className="text-sm text-gray-500">عدد اللجان النشطة</div><div className="text-2xl font-bold mt-1" data-testid="kpi-committees-count">{committees.filter(c => c.status === "active").length}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-sm text-gray-500">إجمالي الأعضاء</div><div className="text-2xl font-bold mt-1" data-testid="kpi-members-count">{members.filter(m => m.status === "active").length}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-sm text-gray-500">نسبة الأعضاء المستقلين</div><div className="text-2xl font-bold mt-1 text-emerald-700" data-testid="kpi-independence-ratio">{independentRatio.ratio}% ({independentRatio.count}/{independentRatio.total})</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-sm text-gray-500">التقارير المنشورة</div><div className="text-2xl font-bold mt-1" data-testid="kpi-reports-published">{reports.filter(r => r.status === "published").length}</div></CardContent></Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="committees" data-testid="tab-committees"><Shield className="h-4 w-4 ml-1" /> اللجان</TabsTrigger>
            <TabsTrigger value="members" data-testid="tab-members"><Users className="h-4 w-4 ml-1" /> الأعضاء</TabsTrigger>
            <TabsTrigger value="reports" data-testid="tab-reports"><FileText className="h-4 w-4 ml-1" /> التقارير</TabsTrigger>
          </TabsList>

          <TabsContent value="committees">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>لجان المراجعة</CardTitle>
                {isAdmin && <Button onClick={() => { setEditingCommittee(null); setShowCommitteeForm(true); }} data-testid="button-new-committee"><Plus className="h-4 w-4 ml-1" /> لجنة جديدة</Button>}
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>الاسم</TableHead><TableHead>تاريخ التشكيل</TableHead><TableHead>الحالة</TableHead><TableHead>إجراءات</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {committees.map(c => (
                      <TableRow key={c.id} data-testid={`row-committee-${c.id}`}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>{c.formationDate}</TableCell>
                        <TableCell><Badge variant={c.status === "active" ? "default" : "secondary"}>{c.status === "active" ? "نشطة" : "موقوفة"}</Badge></TableCell>
                        <TableCell>
                          {isAdmin && <>
                            <Button variant="ghost" size="sm" onClick={() => { setEditingCommittee(c); setShowCommitteeForm(true); }}><Edit className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => setDeleteCommitteeId(c.id)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                          </>}
                        </TableCell>
                      </TableRow>
                    ))}
                    {committees.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-gray-500 py-6">لا توجد لجان مسجلة</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="members">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>أعضاء اللجان</CardTitle>
                {isAdmin && committees.length > 0 && <Button onClick={() => setShowMemberForm(true)} data-testid="button-new-member"><Plus className="h-4 w-4 ml-1" /> عضو جديد</Button>}
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>الاسم</TableHead><TableHead>اللجنة</TableHead><TableHead>الدور</TableHead><TableHead>مستقل</TableHead><TableHead>خبير مالي</TableHead><TableHead>تاريخ التعيين</TableHead><TableHead>إجراءات</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {members.map(m => (
                      <TableRow key={m.id} data-testid={`row-member-${m.id}`}>
                        <TableCell className="font-medium">{m.fullName}</TableCell>
                        <TableCell>{committees.find(c => c.id === m.committeeId)?.name || "-"}</TableCell>
                        <TableCell><Badge>{ROLES.find(r => r.value === m.role)?.label}</Badge></TableCell>
                        <TableCell>{m.isIndependent ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : "—"}</TableCell>
                        <TableCell>{m.isFinancialExpert ? <CheckCircle2 className="h-4 w-4 text-blue-600" /> : "—"}</TableCell>
                        <TableCell>{m.appointmentDate}</TableCell>
                        <TableCell>{isAdmin && <Button variant="ghost" size="sm" onClick={() => setDeleteMemberId(m.id)}><Trash2 className="h-4 w-4 text-red-600" /></Button>}</TableCell>
                      </TableRow>
                    ))}
                    {members.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-gray-500 py-6">لا يوجد أعضاء</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>التقارير الربعية والسنوية</CardTitle>
                {isAdmin && committees.length > 0 && <Button onClick={() => { setEditingReport(null); setShowReportForm(true); }} data-testid="button-new-report"><Plus className="h-4 w-4 ml-1" /> تقرير جديد</Button>}
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>العنوان</TableHead><TableHead>اللجنة</TableHead><TableHead>السنة</TableHead><TableHead>الفترة</TableHead><TableHead>الحالة</TableHead><TableHead>إجراءات</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {reports.map(r => {
                      const s = STATUS_LABELS[r.status] || STATUS_LABELS.draft;
                      return (
                        <TableRow key={r.id} data-testid={`row-report-${r.id}`}>
                          <TableCell className="font-medium flex items-center gap-2">{r.title}{r.isLocked && <Badge className="bg-amber-100 text-amber-800 gap-1"><Lock className="h-3 w-3" />مقفل</Badge>}</TableCell>
                          <TableCell>{committees.find(c => c.id === r.committeeId)?.name || "-"}</TableCell>
                          <TableCell>{r.fiscalYear}</TableCell>
                          <TableCell>{r.period}</TableCell>
                          <TableCell><Badge className={s.color}>{s.label}</Badge></TableCell>
                          <TableCell className="space-x-1 space-x-reverse">
                            {isAdmin && !r.isLocked && <Button variant="ghost" size="sm" onClick={() => { setEditingReport(r); setShowReportForm(true); }} data-testid={`button-edit-report-${r.id}`}><Edit className="h-4 w-4" /></Button>}
                            {isAdmin && !r.isLocked && (r.status === "approved" || r.status === "published") && <Button variant="ghost" size="sm" onClick={() => setLockReportId(r.id)} data-testid={`button-lock-report-${r.id}`}><Lock className="h-4 w-4 text-amber-600" /></Button>}
                            {isAdmin && !r.isLocked && <Button variant="ghost" size="sm" onClick={() => setDeleteReportId(r.id)}><Trash2 className="h-4 w-4 text-red-600" /></Button>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {reports.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-gray-500 py-6">لا توجد تقارير</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={showCommitteeForm} onOpenChange={setShowCommitteeForm}>
          <DialogContent dir="rtl"><DialogHeader><DialogTitle>{editingCommittee ? "تعديل لجنة" : "لجنة مراجعة جديدة"}</DialogTitle></DialogHeader>
            <form onSubmit={handleCommitteeSubmit} className="space-y-3">
              <div><Label>اسم اللجنة</Label><Input name="name" required defaultValue={editingCommittee?.name} data-testid="input-committee-name" /></div>
              <div><Label>تاريخ التشكيل</Label><Input type="date" name="formationDate" required defaultValue={editingCommittee?.formationDate?.toString()} data-testid="input-formation-date" /></div>
              <div><Label>الميثاق</Label><Textarea name="charter" rows={4} defaultValue={editingCommittee?.charter || ""} placeholder="نص ميثاق اللجنة..." /></div>
              <div><Label>الحالة</Label>
                <Select name="status" defaultValue={editingCommittee?.status || "active"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">نشطة</SelectItem><SelectItem value="suspended">موقوفة</SelectItem></SelectContent></Select>
              </div>
              <DialogFooter><Button type="submit" disabled={committeeMutation.isPending}>{committeeMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-1" />}حفظ</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={showMemberForm} onOpenChange={setShowMemberForm}>
          <DialogContent dir="rtl"><DialogHeader><DialogTitle>عضو جديد</DialogTitle></DialogHeader>
            <form onSubmit={handleMemberSubmit} className="space-y-3">
              <div><Label>اللجنة</Label>
                <Select name="committeeId" required><SelectTrigger><SelectValue placeholder="اختر اللجنة" /></SelectTrigger><SelectContent>{committees.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent></Select>
              </div>
              <div><Label>الاسم الكامل</Label><Input name="fullName" required data-testid="input-member-name" /></div>
              <div><Label>الدور</Label>
                <Select name="role" defaultValue="member"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent></Select>
              </div>
              <div><Label>تاريخ التعيين</Label><Input type="date" name="appointmentDate" required /></div>
              <div className="flex items-center gap-2"><Checkbox id="isIndependent" name="isIndependent" /><Label htmlFor="isIndependent" className="cursor-pointer">عضو مستقل</Label></div>
              <div className="flex items-center gap-2"><Checkbox id="isFinancialExpert" name="isFinancialExpert" /><Label htmlFor="isFinancialExpert" className="cursor-pointer">خبير مالي</Label></div>
              <DialogFooter><Button type="submit" disabled={memberMutation.isPending}>{memberMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-1" />}حفظ</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={showReportForm} onOpenChange={setShowReportForm}>
          <DialogContent dir="rtl" className="max-w-2xl"><DialogHeader><DialogTitle>{editingReport ? "تعديل تقرير" : "تقرير جديد"}</DialogTitle></DialogHeader>
            <form onSubmit={handleReportSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>اللجنة</Label>
                  <Select name="committeeId" defaultValue={editingReport?.committeeId?.toString()} required><SelectTrigger><SelectValue placeholder="اختر اللجنة" /></SelectTrigger><SelectContent>{committees.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent></Select>
                </div>
                <div><Label>نوع التقرير</Label>
                  <Select name="reportType" defaultValue={editingReport?.reportType || "quarterly"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{REPORT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select>
                </div>
                <div><Label>السنة المالية</Label><Input name="fiscalYear" required defaultValue={editingReport?.fiscalYear || String(new Date().getFullYear())} /></div>
                <div><Label>الفترة</Label>
                  <Select name="period" defaultValue={editingReport?.period || "Q1"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PERIODS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select>
                </div>
              </div>
              <div><Label>العنوان</Label><Input name="title" required defaultValue={editingReport?.title} data-testid="input-report-title" /></div>
              <div><Label>الملخص التنفيذي</Label><Textarea name="summary" rows={3} defaultValue={editingReport?.summary || ""} /></div>
              <div><Label>التوصيات</Label><Textarea name="recommendations" rows={3} defaultValue={editingReport?.recommendations || ""} /></div>
              <div><Label>الحالة</Label>
                <Select name="status" defaultValue={editingReport?.status || "draft"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">مسودة</SelectItem><SelectItem value="approved">معتمد</SelectItem><SelectItem value="published">منشور</SelectItem></SelectContent></Select>
              </div>
              <DialogFooter><Button type="submit" disabled={reportMutation.isPending}>{reportMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-1" />}حفظ</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!lockReportId} onOpenChange={() => setLockReportId(null)}>
          <AlertDialogContent dir="rtl"><AlertDialogHeader><AlertDialogTitle>قفل التقرير نهائياً</AlertDialogTitle><AlertDialogDescription>هذا الإجراء لا يمكن التراجع عنه. سيتم منع أي تعديل أو حذف بعد القفل.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>إلغاء</AlertDialogCancel><AlertDialogAction className="bg-amber-600 hover:bg-amber-700" onClick={() => lockReportId && lockReportMutation.mutate(lockReportId)}>قفل نهائي</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!deleteCommitteeId} onOpenChange={() => setDeleteCommitteeId(null)}>
          <AlertDialogContent dir="rtl"><AlertDialogHeader><AlertDialogTitle>حذف اللجنة</AlertDialogTitle><AlertDialogDescription>سيتم حذف اللجنة وجميع أعضائها وتقاريرها.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>إلغاء</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteCommitteeId && deleteCommitteeMutation.mutate(deleteCommitteeId)}>حذف</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={!!deleteMemberId} onOpenChange={() => setDeleteMemberId(null)}>
          <AlertDialogContent dir="rtl"><AlertDialogHeader><AlertDialogTitle>حذف العضو</AlertDialogTitle></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>إلغاء</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteMemberId && deleteMemberMutation.mutate(deleteMemberId)}>حذف</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={!!deleteReportId} onOpenChange={() => setDeleteReportId(null)}>
          <AlertDialogContent dir="rtl"><AlertDialogHeader><AlertDialogTitle>حذف التقرير</AlertDialogTitle></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>إلغاء</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteReportId && deleteReportMutation.mutate(deleteReportId)}>حذف</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
