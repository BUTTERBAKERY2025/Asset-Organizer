// بوابة المراجعة المالية — Audit Portal
// واجهة موحّدة بوضعين: فريق الإدارة المالية (إدارة كاملة) ومكتب المراجعة الخارجي (اطلاع واعتماد وطلبات)
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  ShieldCheck, FolderOpen, Plus, Upload, Download, Trash2, MessageSquare,
  CheckCircle2, XCircle, Clock, FileText, Landmark, ListChecks, Activity, UserPlus, LogOut,
  ChevronDown, ShieldAlert, CalendarDays,
  Search, Filter, X,
} from "lucide-react";

// ===== ثوابت العرض =====
const CATEGORY_LABELS: Record<string, string> = {
  financial_statements: "القوائم المالية",
  trial_balance: "ميزان المراجعة",
  banks: "كشوف البنوك",
  expenses: "المصروفات",
  revenues: "الإيرادات",
  taxes: "الزكاة والضرائب",
  contracts: "العقود",
  payroll: "الرواتب",
  inventory: "المخزون",
  other: "أخرى",
};
const REQ_STATUS: Record<string, { label: string; cls: string }> = {
  requested: { label: "معلق", cls: "bg-gray-100 text-gray-700" },
  in_progress: { label: "قيد التجهيز", cls: "bg-amber-100 text-amber-800" },
  ready: { label: "جاهز — بانتظار الرفع", cls: "bg-cyan-100 text-cyan-800" },
  waiting_sample: { label: "بانتظار اختيار العينة", cls: "bg-purple-100 text-purple-800" },
  not_applicable: { label: "غير منطبق", cls: "bg-gray-200 text-gray-500" },
  uploaded: { label: "مرفوع — بانتظار المراجع", cls: "bg-blue-100 text-blue-800" },
  approved: { label: "معتمد ✔", cls: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "مرفوض — يحتاج تعديل", cls: "bg-red-100 text-red-700" },
};
// الحالات التي يستطيع الفريق اختيارها يدوياً
const TEAM_STATUSES = ["requested", "in_progress", "ready", "waiting_sample", "not_applicable"];
const PERIOD_STATUS: Record<string, string> = {
  active: "قيد التجهيز",
  under_review: "قيد المراجعة",
  approved: "معتمدة",
  closed: "مغلقة",
};
const PERIOD_TYPES: Record<string, string> = { annual: "سنوية", semi_annual: "نصف سنوية", quarterly: "ربع سنوية" };

async function api(path: string, opts?: RequestInit) {
  const res = await fetch(path, { credentials: "include", ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "حدث خطأ");
  return data;
}

function fmtDT(d: string | Date) {
  const dt = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}
function fmtSize(b?: number | null) {
  if (!b) return "";
  return b > 1024 * 1024 ? (b / 1024 / 1024).toFixed(1) + "MB" : Math.round(b / 1024) + "KB";
}

function PortalTheme() {
  return (
    <style>{`
      .audit-portal { --audit-ink:#17363a; --audit-deep:#102f35; --audit-gold:#b48b46; }
      .audit-portal .border { border-color:#dfe8e2; }
      .audit-portal [data-state="active"] { background:#e3f0e8; color:#22634d; box-shadow:none; }
      .audit-portal .bg-emerald-700 { background-color:#287052 !important; }
      .audit-portal .audit-requirement { animation: auditRise .35s ease both; }
      .audit-portal .audit-section-items > :nth-child(2) { animation-delay:40ms; }
      .audit-portal .audit-section-items > :nth-child(3) { animation-delay:80ms; }
      .audit-portal .audit-section-items > :nth-child(4) { animation-delay:120ms; }
      .audit-portal .audit-section-items > :nth-child(5) { animation-delay:160ms; }
      .audit-portal .audit-approved { border-inline-start:3px solid #4b9a72; }
      .audit-portal .audit-rejected { border-inline-start:3px solid #c35d55; background:#fffafa; }
      @keyframes auditRise { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:translateY(0); } }
      @media (prefers-reduced-motion:reduce) { .audit-portal .audit-requirement { animation:none; } }
    `}</style>
  );
}

export default function AuditPortalPage() {
  const ctxQ = useQuery<{ name: string; role: "team" | "auditor" }>({
    queryKey: ["/api/audit/portal-context"],
    queryFn: () => api("/api/audit/portal-context"),
    retry: false,
  });

  if (ctxQ.isLoading) {
    return <div dir="rtl" className="audit-portal min-h-[100dvh] flex items-center justify-center text-slate-500"><div className="w-full max-w-xl space-y-3 px-6"><div className="h-12 w-48 rounded-xl skeleton-pro ml-auto" /><div className="h-32 rounded-2xl skeleton-pro" /><div className="h-20 rounded-2xl skeleton-pro" /></div></div>;
  }
  if (ctxQ.isError || !ctxQ.data) {
    return (
      <div className="audit-portal min-h-[100dvh] flex items-center justify-center bg-[#f5f7f4]" dir="rtl">
        <Card className="max-w-md text-center p-8 border-0 shadow-xl shadow-slate-900/10 bg-white/90">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#102f35] text-[#d8b56d]"><ShieldAlert className="h-8 w-8" /></div>
          <p className="font-extrabold text-xl text-[#102f35]">بوابة المراجعة المالية</p>
          <p className="text-sm text-slate-500 mt-3 leading-7">هذه البوابة متاحة لفريق الإدارة المالية ومكتب المراجعة المعتمد فقط</p>
          <div className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-400">الوصول محمي ومسجّل بالكامل</div>
        </Card>
      </div>
    );
  }

  const isAuditor = ctxQ.data.role === "auditor";
  const content = <PortalBody isAuditor={isAuditor} userName={ctxQ.data.name} />;
  // المراجع الخارجي: غلاف مستقل أنيق بدون قوائم النظام — الفريق: داخل تخطيط النظام
  if (isAuditor) return <AuditorShell userName={ctxQ.data.name}>{content}</AuditorShell>;
  return <Layout>{content}</Layout>;
}

function AuditorShell({ userName, children }: { userName: string; children: React.ReactNode }) {
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
    window.location.href = "/login";
  };
  return (
    <div dir="rtl" className="audit-portal min-h-[100dvh] bg-[#f4f7f5] text-[#17363a]">
      <header className="sticky top-0 z-40 border-b border-[#dbe5df] bg-[#102f35] text-white shadow-lg shadow-[#102f35]/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[#d8b56d] text-[#102f35] p-2.5"><Landmark className="h-5 w-5" /></div>
            <div>
              <p className="font-extrabold leading-tight">بوابة المراجعة المالية</p>
              <p className="text-xs text-[#b9cbc4] mt-0.5">شركة الزبد الأفضل التجارية · مدخل مكتب المراجعة</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[#dce8e2] hidden sm:block">{userName}</span>
            <Button variant="ghost" size="sm" onClick={logout} className="text-[#dce8e2] hover:bg-white/10 hover:text-white">
              <LogOut className="h-4 w-4 ml-1" /> خروج
            </Button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">{children}</main>
      <footer className="text-center text-xs text-slate-400 py-8">جميع العمليات على هذه البوابة مسجَّلة بالاسم والوقت</footer>
    </div>
  );
}

function PortalBody({ isAuditor, userName }: { isAuditor: boolean; userName: string }) {
  const { user } = useAuth();
  const isAdmin = !isAuditor && user?.role === "admin";
  const qc = useQueryClient();
  const { toast } = useToast();
  const [periodId, setPeriodId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("requirements");
  const [focusSection, setFocusSection] = useState<string | null>(null);

  const periodsQ = useQuery<any[]>({ queryKey: ["/api/audit/periods"], queryFn: () => api("/api/audit/periods") });
  useEffect(() => {
    if (periodsQ.data?.length && periodId === null) setPeriodId(periodsQ.data[0].id);
  }, [periodsQ.data, periodId]);

  const overviewQ = useQuery<any>({
    queryKey: ["/api/audit/periods", periodId, "overview"],
    queryFn: () => api(`/api/audit/periods/${periodId}/overview`),
    enabled: !!periodId,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["/api/audit/periods"] });
    if (periodId) qc.invalidateQueries({ queryKey: ["/api/audit/periods", periodId, "overview"] });
  };

  const o = overviewQ.data;

  return (
    <div dir="rtl" className={`${isAuditor ? "space-y-5" : "page-container space-y-5"} audit-portal`}>
      <PortalTheme />
      {!isAuditor && (
        <div className="flex items-start justify-between flex-wrap gap-3 border-b border-[#dce5df] pb-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-[#a7803e] mb-2"><span className="h-2 w-2 rounded-full bg-[#c79b4d]" /> غرفة الاعتماد المالي</div>
            <h1 className="text-2xl font-extrabold flex items-center gap-2 text-[#17363a]"><Landmark className="h-6 w-6 text-[#b48b46]" /> بوابة المراجعة المالية</h1>
            <p className="text-sm text-slate-500 mt-1">ملف المراجعة الخارجي · مكتب مهام كابيتال</p>
          </div>
          <NewPeriodDialog onDone={refresh} />
        </div>
      )}

      {/* اختيار الفترة */}
      <div className="flex items-center gap-3 flex-wrap rounded-2xl border border-[#dbe5df] bg-white px-4 py-3 shadow-sm">
        <Label className="shrink-0 font-bold text-[#17363a]">الفترة المالية:</Label>
        <Select value={periodId ? String(periodId) : ""} onValueChange={(v) => setPeriodId(Number(v))}>
          <SelectTrigger className="w-72 border-[#dbe5df] bg-[#f8faf8]" data-testid="audit-period-select"><CalendarDays className="h-4 w-4 ml-2 text-[#a7803e]" /><SelectValue placeholder="اختر فترة" /></SelectTrigger>
          <SelectContent>
            {(periodsQ.data || []).map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>{p.title} — {PERIOD_TYPES[p.periodType] || p.periodType}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {o?.period && <Badge className="bg-[#e7f1ec] text-[#22634d] border border-[#c9dfd3]">{PERIOD_STATUS[o.period.status] || o.period.status}</Badge>}
      </div>

      {!periodsQ.data?.length && !periodsQ.isLoading && (
        <Card><CardContent className="py-10 text-center text-gray-500">
          {isAuditor ? "لا توجد فترات مراجعة متاحة بعد" : "ابدأ بإنشاء أول فترة مالية — مثل: النصف الأول 2026"}
        </CardContent></Card>
      )}

      {o && (
        <>
          <AuditCommandCenter
            o={o}
            onSectionClick={(section) => {
              setFocusSection(section);
              setActiveTab("requirements");
            }}
          />
          {/* شريط التقدم */}
          <Card className="overflow-hidden border-[#cfdfd5] bg-[#102f35] text-white shadow-xl shadow-[#102f35]/10">
            <CardContent className="py-5 px-5 sm:px-6 flex items-center gap-6 flex-wrap">
              <div className="flex-1 min-w-52">
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-semibold text-[#dbe9e2]">جاهزية ملف المراجعة</span>
                  <span className="font-bold text-[#e1bf78]">{o.stats.progress}%</span>
                </div>
                <Progress value={o.stats.progress} className="h-2.5 bg-white/15 [&>div]:bg-[#d8b56d]" />
                <p className="text-xs text-[#a9c0b6] mt-2">المعتمد والمرفوع من إجمالي متطلبات الفترة</p>
              </div>
              <div className="grid grid-cols-2 sm:flex gap-x-6 gap-y-3 text-center text-sm">
                <div><p className="font-extrabold text-xl">{o.stats.total}</p><p className="text-[#a9c0b6] text-xs">إجمالي البنود</p></div>
                <div><p className="font-extrabold text-xl text-[#8fc6b0]">{o.stats.uploaded}</p><p className="text-[#a9c0b6] text-xs">بانتظار المراجع</p></div>
                <div><p className="font-extrabold text-xl text-[#e1bf78]">{o.stats.approved}</p><p className="text-[#a9c0b6] text-xs">معتمدة</p></div>
                <div><p className="font-extrabold text-xl">{o.files.length}</p><p className="text-[#a9c0b6] text-xs">الملفات</p></div>
              </div>
            </CardContent>
          </Card>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="requirements"><ListChecks className="h-4 w-4 ml-1" /> المتطلبات</TabsTrigger>
              <TabsTrigger value="files"><FolderOpen className="h-4 w-4 ml-1" /> مكتبة الملفات</TabsTrigger>
              {!isAuditor && <TabsTrigger value="activity"><Activity className="h-4 w-4 ml-1" /> سجل النشاط</TabsTrigger>}
              {isAdmin && <TabsTrigger value="accounts"><UserPlus className="h-4 w-4 ml-1" /> حسابات المراجعين</TabsTrigger>}
            </TabsList>

            <TabsContent value="requirements" className="mt-4">
              <RequirementsTab o={o} isAuditor={isAuditor} periodId={periodId!} onDone={refresh} focusSection={focusSection} />
            </TabsContent>
            <TabsContent value="files" className="mt-4">
              <FilesTab o={o} isAuditor={isAuditor} periodId={periodId!} onDone={refresh} />
            </TabsContent>
            {!isAuditor && (
              <TabsContent value="activity" className="mt-4">
                <ActivityTab periodId={periodId!} />
              </TabsContent>
            )}
            {isAdmin && (
              <TabsContent value="accounts" className="mt-4">
                <AuditorAccountsTab />
              </TabsContent>
            )}
          </Tabs>
        </>
      )}
    </div>
  );
}

// ===== إنشاء فترة =====
function NewPeriodDialog({ onDone }: { onDone: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: "", periodType: "semi_annual", fiscalYear: String(new Date().getFullYear()), periodStart: "", periodEnd: "", notes: "" });
  const m = useMutation({
    mutationFn: () => api("/api/audit/periods", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) }),
    onSuccess: () => { toast({ title: "تم إنشاء الفترة ✔" }); setOpen(false); onDone(); },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-emerald-700 hover:bg-emerald-800" data-testid="audit-new-period"><Plus className="h-4 w-4 ml-1" /> فترة مالية جديدة</Button>
      </DialogTrigger>
      <DialogContent dir="rtl">
        <DialogHeader><DialogTitle>فترة مالية جديدة</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>العنوان</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="مثال: النصف الأول 2026" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>النوع</Label>
              <Select value={f.periodType} onValueChange={(v) => setF({ ...f, periodType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="semi_annual">نصف سنوية</SelectItem>
                  <SelectItem value="annual">سنوية</SelectItem>
                  <SelectItem value="quarterly">ربع سنوية</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>السنة المالية</Label><Input type="number" value={f.fiscalYear} onChange={(e) => setF({ ...f, fiscalYear: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>من</Label><Input type="date" value={f.periodStart} onChange={(e) => setF({ ...f, periodStart: e.target.value })} /></div>
            <div><Label>إلى</Label><Input type="date" value={f.periodEnd} onChange={(e) => setF({ ...f, periodEnd: e.target.value })} /></div>
          </div>
          <div><Label>ملاحظات (اختياري)</Label><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={2} /></div>
          <Button className="w-full bg-emerald-700 hover:bg-emerald-800" disabled={m.isPending} onClick={() => m.mutate()}>
            {m.isPending ? "جاري الإنشاء..." : "إنشاء الفترة"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AuditCommandCenter({ o, onSectionClick }: { o: any; onSectionClick: (section: string) => void }) {
  const groups = useMemo(() => {
    const map: Record<string, any[]> = {};
    (o.requirements || []).forEach((r: any) => (map[r.section || "بنود عامة"] ||= []).push(r));
    return Object.entries(map);
  }, [o.requirements]);
  const attention = (o.requirements || []).filter((r: any) => r.status === "rejected" || (r.priority === "high" && !["approved", "not_applicable"].includes(r.status)));
  return <section className="rounded-2xl border border-[#d5e3da] bg-white shadow-sm overflow-hidden">
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#e3ebe5] px-5 py-4"><div><p className="text-xs font-bold tracking-widest text-[#a7803e]">لوحة القيادة</p><h2 className="text-xl font-extrabold text-[#17363a] mt-1">نظرة تنفيذية على ملف المراجعة</h2></div><div className="text-left"><span className="text-3xl font-extrabold text-[#287052]">{o.stats.progress}%</span><p className="text-xs text-slate-400">جاهزية الاعتماد</p></div></div>
    <div className="grid lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x lg:divide-x-reverse divide-[#e3ebe5]">
      <div className="p-5"><p className="text-xs font-bold text-slate-400 mb-3">توزيع الحالات</p><div className="grid grid-cols-2 gap-2">{Object.entries(REQ_STATUS).map(([key, meta]) => { const n = (o.requirements || []).filter((r: any) => r.status === key).length; return <div key={key} className="rounded-xl bg-[#f7faf8] p-3"><p className="text-xl font-extrabold text-[#17363a]">{n}</p><p className="text-[11px] text-slate-500 truncate">{meta.label}</p></div>; })}</div></div>
      <div className="p-5"><div className="flex justify-between mb-3"><p className="text-xs font-bold text-slate-400">الأقسام المحاسبية</p><span className="text-xs text-slate-400">{groups.length} قسم</span></div><div className="space-y-2 max-h-44 overflow-auto">{groups.map(([name, items]) => { const done = items.filter((r: any) => ["approved", "uploaded", "ready", "not_applicable"].includes(r.status)).length; return <button key={name} onClick={() => onSectionClick(name)} className="w-full text-right group"><div className="flex justify-between text-xs mb-1"><span className="font-semibold text-[#345258] group-hover:text-[#287052]">{name}</span><span className="text-slate-400">{done}/{items.length}</span></div><div className="h-1.5 rounded-full bg-[#e6eee8]"><div className="h-full rounded-full bg-[#4b9a72]" style={{ width: `${Math.round(done / items.length * 100)}%` }} /></div></button>; })}</div></div>
      <div className="p-5"><p className="text-xs font-bold text-slate-400 mb-3">يحتاج انتباهك أولاً</p><div className="space-y-2 max-h-32 overflow-auto">{attention.slice(0, 4).map((r: any) => <div key={r.id} className="flex items-start gap-2 text-xs"><span className={`mt-1 h-2 w-2 rounded-full shrink-0 ${r.status === "rejected" ? "bg-[#c35d55]" : "bg-[#c79b4d]"}`} /><span className="font-semibold text-[#345258]">{r.title}</span></div>)}{!attention.length && <div className="rounded-xl bg-[#edf6ef] p-3 text-xs text-[#287052]">لا توجد بنود عاجلة حالياً</div>}</div><div className="mt-4 border-t border-[#e3ebe5] pt-3 flex justify-between text-xs"><span className="text-slate-400">إجمالي الملفات</span><b>{o.files.length}</b></div></div>
    </div>
  </section>;
}

// ===== تبويب المتطلبات =====
function RequirementsTab({ o, isAuditor, periodId, onDone, focusSection }: { o: any; isAuditor: boolean; periodId: number; onDone: () => void; focusSection?: string | null }) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [attentionOnly, setAttentionOnly] = useState(false);

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api(`/api/audit/requirements/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }),
    onSuccess: onDone,
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });
  const delReq = useMutation({
    mutationFn: (id: number) => api(`/api/audit/requirements/${id}`, { method: "DELETE" }),
    onSuccess: onDone,
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  // تجميع المتطلبات حسب القسم المحاسبي (مع الحفاظ على ترتيب الورود)
  const sections: { name: string; items: any[] }[] = [];
  const secIdx = new Map<string, number>();
  for (const r of o.requirements) {
    const key = r.section || "بنود عامة";
    if (!secIdx.has(key)) { secIdx.set(key, sections.length); sections.push({ name: key, items: [] }); }
    sections[secIdx.get(key)!].items.push(r);
  }
  const doneStates = new Set(["approved", "uploaded", "ready", "not_applicable"]);
  useEffect(() => { if (focusSection) setOpenSections((p) => ({ ...p, [focusSection]: true })); }, [focusSection]);
  const sectionNames = sections.map((s) => s.name);
  const filteredSections = sections.map((sec) => ({ ...sec, items: sec.items.filter((r: any) => {
    const q = search.trim().toLowerCase();
    return (!q || [r.title, r.titleEn, r.assigneeName].some((v) => String(v || "").toLowerCase().includes(q))) && (statusFilter === "all" || r.status === statusFilter) && (priorityFilter === "all" || r.priority === priorityFilter) && (sectionFilter === "all" || sec.name === sectionFilter) && (!attentionOnly || r.status === "rejected" || (r.priority === "high" && !["approved", "not_applicable"].includes(r.status)));
  }) })).filter((s) => s.items.length);

  const renderReq = (r: any) => {
        const st = REQ_STATUS[r.status] || REQ_STATUS.requested;
        const files = o.files.filter((f: any) => f.requirementId === r.id);
        const comments = o.comments.filter((c: any) => c.requirementId === r.id);
        return (
          <Card key={r.id} className={`audit-requirement border-[#dfe8e2] bg-white shadow-sm ${r.status === "approved" ? "audit-approved" : r.status === "rejected" ? "audit-rejected" : ""}`}>
            <CardContent className="py-4 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-[#17363a]">{r.title}</p>
                    <Badge className={st.cls}>{st.label}</Badge>
                    {r.priority === "high" && <Badge className="bg-red-100 text-red-700">عاجل</Badge>}
                    <Badge variant="outline">{r.source === "auditor" ? "طلب المراجع" : "بند داخلي"}</Badge>
                    {r.category && <Badge variant="secondary">{CATEGORY_LABELS[r.category] || r.category}</Badge>}
                    {r.assigneeName && <Badge variant="outline" className="text-indigo-700 border-indigo-200">المسؤول: {r.assigneeName}</Badge>}
                  </div>
                  {r.titleEn && <p className="text-xs text-gray-400 mt-0.5" dir="ltr" style={{ textAlign: "right" }}>{r.titleEn}</p>}
                  {r.description && <p className="text-sm text-gray-600 mt-1">{r.description}</p>}
                  <p className="text-xs text-gray-400 mt-1">أضافه {r.createdByName} • {fmtDT(r.createdAt)}{r.dueDate ? ` • الاستحقاق ${r.dueDate}` : ""}</p>
                </div>
                <div className="flex gap-2 flex-wrap shrink-0 items-center">
                  {!isAuditor && !["approved", "uploaded"].includes(r.status) && (
                    <Select value={TEAM_STATUSES.includes(r.status) ? r.status : undefined} onValueChange={(v) => setStatus.mutate({ id: r.id, status: v })}>
                      <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="تغيير الحالة" /></SelectTrigger>
                      <SelectContent>{TEAM_STATUSES.map((s) => <SelectItem key={s} value={s}>{REQ_STATUS[s].label}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                  {!isAuditor && !["approved", "not_applicable"].includes(r.status) && <UploadFileDialog periodId={periodId} requirementId={r.id} onDone={onDone} small />}
                  {isAuditor && r.status === "uploaded" && (
                    <>
                      <Button size="sm" className="bg-emerald-700 hover:bg-emerald-800" onClick={() => setStatus.mutate({ id: r.id, status: "approved" })}>
                        <CheckCircle2 className="h-4 w-4 ml-1" /> اعتماد
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => setStatus.mutate({ id: r.id, status: "rejected" })}>
                        <XCircle className="h-4 w-4 ml-1" /> إرجاع للتعديل
                      </Button>
                    </>
                  )}
                  {!isAuditor && r.status !== "approved" && (
                    <Button size="sm" variant="ghost" className="text-red-500" onClick={() => { if (confirm("حذف هذا المتطلب؟")) delReq.mutate(r.id); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {files.length > 0 && (
                <div className="space-y-1">
                  {files.map((f: any) => <FileRow key={f.id} f={f} isAuditor={isAuditor} onDone={onDone} compact />)}
                </div>
              )}

              <button className="text-xs text-gray-500 flex items-center gap-1 hover:text-gray-800" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                <MessageSquare className="h-3.5 w-3.5" /> التعليقات ({comments.length})
              </button>
              {expanded === r.id && <CommentsBox reqId={r.id} comments={comments} onDone={onDone} />}
            </CardContent>
          </Card>
        );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#d5e3da] bg-white p-3 shadow-sm space-y-3"><div className="flex flex-wrap gap-2 items-center"><div className="relative flex-1 min-w-52"><Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث في العنوان أو المسؤول..." className="pr-9 border-[#dbe5df]" /></div><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-40"><Filter className="h-4 w-4 ml-1 text-[#a7803e]" /><SelectValue placeholder="الحالة" /></SelectTrigger><SelectContent><SelectItem value="all">كل الحالات</SelectItem>{Object.entries(REQ_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent></Select><Select value={priorityFilter} onValueChange={setPriorityFilter}><SelectTrigger className="w-32"><SelectValue placeholder="الأولوية" /></SelectTrigger><SelectContent><SelectItem value="all">كل الأولويات</SelectItem><SelectItem value="high">عاجل</SelectItem><SelectItem value="normal">عادي</SelectItem><SelectItem value="low">منخفض</SelectItem></SelectContent></Select><Select value={sectionFilter} onValueChange={setSectionFilter}><SelectTrigger className="w-40"><SelectValue placeholder="القسم" /></SelectTrigger><SelectContent><SelectItem value="all">كل الأقسام</SelectItem>{sectionNames.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><Button size="sm" variant={attentionOnly ? "default" : "outline"} onClick={() => setAttentionOnly(!attentionOnly)} className={attentionOnly ? "bg-[#17363a]" : ""}>يحتاج انتباه</Button></div><div className="flex justify-between text-xs text-slate-400"><span>عرض {filteredSections.reduce((n, s) => n + s.items.length, 0)} من {o.requirements.length} متطلب</span>{(search || statusFilter !== "all" || priorityFilter !== "all" || sectionFilter !== "all" || attentionOnly) && <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStatusFilter("all"); setPriorityFilter("all"); setSectionFilter("all"); setAttentionOnly(false); }} className="h-7 text-[#287052]">مسح الفلاتر <X className="h-3 w-3 mr-1" /></Button>}</div></div><NewRequirementDialog periodId={periodId} isAuditor={isAuditor} onDone={onDone} />
      {!o.requirements.length && (
        <Card><CardContent className="py-8 text-center text-gray-500">
          لا توجد متطلبات بعد — {isAuditor ? "أضف أول طلب للفريق" : "سجّل متطلبات المراجع أو جهّز بنودك الداخلية"}
        </CardContent></Card>
      )}
      {!filteredSections.length && o.requirements.length > 0 && <Card><CardContent className="py-10 text-center text-slate-500"><Search className="h-8 w-8 mx-auto mb-2 text-slate-300" />لا توجد نتائج مطابقة للفلاتر الحالية</CardContent></Card>}
      {filteredSections.map((sec) => {
        const done = sec.items.filter((r: any) => doneStates.has(r.status)).length;
        const isOpen = openSections[sec.name] ?? false;
        return (
          <div key={sec.name} className="space-y-2">
             <button
               className="audit-section-toggle w-full flex items-center justify-between rounded-xl border border-[#d7e4dc] bg-[#f8faf8] hover:bg-[#edf5ef] px-4 py-3 transition-colors"
              onClick={() => setOpenSections((p) => ({ ...p, [sec.name]: !isOpen }))}
              data-testid={`audit-section-${sec.name}`}
            >
              <span className="font-bold text-sm flex items-center gap-2">
                 <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e3f0e8] text-[#287052]"><ListChecks className="h-4 w-4" /></span> {sec.name}
                 <Badge variant="secondary" className="font-normal bg-white border border-[#d5e3da]">{done} / {sec.items.length}</Badge>
              </span>
              <span className="flex items-center gap-3">
                   <span className="w-28 h-2 rounded bg-[#dce8df] overflow-hidden hidden sm:block">
                   <span className="block h-full bg-[#4b9a72] transition-all" style={{ width: `${sec.items.length ? Math.round((done / sec.items.length) * 100) : 0}%` }} />
                </span>
                 <span className="text-xs text-slate-500 flex items-center gap-1">{isOpen ? "إخفاء" : "عرض"}<ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} /></span>
              </span>
            </button>
             {isOpen && <div className="space-y-2 audit-section-items">{sec.items.map(renderReq)}</div>}
          </div>
        );
      })}
    </div>
  );
}

function NewRequirementDialog({ periodId, isAuditor, onDone }: { periodId: number; isAuditor: boolean; onDone: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const emptyForm = { title: "", titleEn: "", section: "", assigneeName: "", description: "", category: "other", priority: "normal", dueDate: "" };
  const [f, setF] = useState(emptyForm);
  const m = useMutation({
    mutationFn: () => api(`/api/audit/periods/${periodId}/requirements`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) }),
    onSuccess: () => { toast({ title: "تمت إضافة المتطلب ✔" }); setOpen(false); setF(emptyForm); onDone(); },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="audit-new-requirement"><Plus className="h-4 w-4 ml-1" /> {isAuditor ? "طلب مستند / بيان جديد" : "إضافة متطلب"}</Button>
      </DialogTrigger>
      <DialogContent dir="rtl">
        <DialogHeader><DialogTitle>{isAuditor ? "طلب جديد من الشركة" : "متطلب جديد"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>العنوان</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="مثال: كشف حساب البنك الأهلي حتى 30/06" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>القسم (اختياري)</Label><Input value={f.section} onChange={(e) => setF({ ...f, section: e.target.value })} placeholder="مثال: النقد وما في حكمه" /></div>
            <div><Label>المسؤول (اختياري)</Label><Input value={f.assigneeName} onChange={(e) => setF({ ...f, assigneeName: e.target.value })} /></div>
          </div>
          <div><Label>الاسم الإنجليزي (اختياري)</Label><Input dir="ltr" value={f.titleEn} onChange={(e) => setF({ ...f, titleEn: e.target.value })} /></div>
          <div><Label>تفاصيل (اختياري)</Label><Textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>التصنيف</Label>
              <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>الأولوية</Label>
              <Select value={f.priority} onValueChange={(v) => setF({ ...f, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">عاجل</SelectItem>
                  <SelectItem value="normal">عادي</SelectItem>
                  <SelectItem value="low">منخفض</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>الاستحقاق</Label><Input type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} /></div>
          </div>
          <Button className="w-full" disabled={m.isPending} onClick={() => m.mutate()}>{m.isPending ? "جاري الحفظ..." : "إضافة"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CommentsBox({ reqId, comments, onDone }: { reqId: number; comments: any[]; onDone: () => void }) {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const m = useMutation({
    mutationFn: () => api(`/api/audit/requirements/${reqId}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: text }) }),
    onSuccess: () => { setText(""); onDone(); },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });
  return (
    <div className="bg-gray-50 rounded-lg p-3 space-y-2">
      {comments.map((c) => (
        <div key={c.id} className="text-sm">
          <span className={`font-bold ${c.isAuditor ? "text-purple-700" : "text-emerald-700"}`}>{c.authorName}{c.isAuditor ? " (المراجع)" : ""}:</span>{" "}
          {c.content}
          <span className="text-xs text-gray-400 mr-2">{fmtDT(c.createdAt)}</span>
        </div>
      ))}
      <div className="flex gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="أضف تعليقاً..." onKeyDown={(e) => { if (e.key === "Enter" && text.trim()) m.mutate(); }} />
        <Button size="sm" disabled={!text.trim() || m.isPending} onClick={() => m.mutate()}>إرسال</Button>
      </div>
    </div>
  );
}

// ===== تبويب الملفات =====
function FilesTab({ o, isAuditor, periodId, onDone }: { o: any; isAuditor: boolean; periodId: number; onDone: () => void }) {
  const grouped = useMemo(() => {
    const g: Record<string, any[]> = {};
    for (const f of o.files) (g[f.category] ||= []).push(f);
    return g;
  }, [o.files]);
  return (
    <div className="space-y-4">
      {!isAuditor && <UploadFileDialog periodId={periodId} onDone={onDone} />}
      {!o.files.length && <Card><CardContent className="py-8 text-center text-gray-500">لا توجد ملفات مرفوعة بعد</CardContent></Card>}
      {Object.entries(grouped).map(([cat, files]) => (
        <Card key={cat}>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><FolderOpen className="h-5 w-5 text-amber-600" /> {CATEGORY_LABELS[cat] || cat} <Badge variant="secondary">{files.length}</Badge></CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {files.map((f: any) => <FileRow key={f.id} f={f} isAuditor={isAuditor} onDone={onDone} />)}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function FileRow({ f, isAuditor, onDone, compact }: { f: any; isAuditor: boolean; onDone: () => void; compact?: boolean }) {
  const { toast } = useToast();
  const del = useMutation({
    mutationFn: () => api(`/api/audit/files/${f.id}`, { method: "DELETE" }),
    onSuccess: onDone,
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });
  return (
    <div className={`flex items-center justify-between gap-2 rounded-lg ${compact ? "bg-gray-50 px-3 py-1.5" : "border px-3 py-2"}`}>
      <div className="flex items-center gap-2 min-w-0">
        <FileText className="h-4 w-4 text-blue-700 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{f.title}</p>
          <p className="text-xs text-gray-400 truncate">{f.fileName} • {fmtSize(f.fileSize)} • رفعه {f.uploadedByName} • {fmtDT(f.createdAt)}</p>
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        <a href={`/api/audit/files/${f.id}/download`} target="_blank" rel="noreferrer">
          <Button size="sm" variant="ghost"><Download className="h-4 w-4" /></Button>
        </a>
        {!isAuditor && (
          <Button size="sm" variant="ghost" className="text-red-500" onClick={() => { if (confirm("حذف الملف نهائياً؟")) del.mutate(); }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function UploadFileDialog({ periodId, requirementId, onDone, small }: { periodId: number; requirementId?: number; onDone: () => void; small?: boolean }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("other");
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<{ uploaded: any[]; failed: any[] } | null>(null);
  const [busy, setBusy] = useState(false);

  const doUpload = async () => {
    if (!files.length) { toast({ title: "اختر ملفاً واحداً على الأقل", variant: "destructive" }); return; }
    setBusy(true);
    try {
      const fd = new FormData();
       files.forEach((item) => fd.append("files", item));
       if (files.length === 1 && title.trim()) fd.append("title", title.trim());
      fd.append("category", category);
      if (requirementId) fd.append("requirementId", String(requirementId));
      const res = await fetch(`/api/audit/periods/${periodId}/files`, { method: "POST", credentials: "include", body: fd });
      const data = await res.json().catch(() => ({}));
       if (!res.ok) throw new Error(data.error || "فشل الرفع");
       setResult({ uploaded: data.uploaded || [], failed: data.failed || [] });
       toast({ title: data.failed?.length ? `تم رفع ${data.uploaded?.length || 0} ملف مع وجود أخطاء` : `تم رفع ${data.uploaded?.length || files.length} ملف` });
        if (data.uploaded?.length) onDone(); // تحديث القائمة حتى مع نجاح جزئي
       if (!data.failed?.length) { setOpen(false); setTitle(""); setFiles([]); }
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {small
          ? <Button size="sm" variant="outline"><Upload className="h-4 w-4 ml-1" /> رفع ملف</Button>
          : <Button className="bg-emerald-700 hover:bg-emerald-800" data-testid="audit-upload-file"><Upload className="h-4 w-4 ml-1" /> رفع ملف جديد</Button>}
      </DialogTrigger>
      <DialogContent dir="rtl" className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{requirementId ? "رفع ملف على المتطلب" : "رفع ملف للفترة"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {files.length <= 1 && <div><Label>عنوان الملف</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: قائمة المركز المالي 30/06/2026" /></div>}
          {!requirementId && (
            <div>
              <Label>التصنيف</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
           <div><Label>الملفات (حتى 20 ملفاً، 50MB للملف)</Label><label className="mt-2 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#cbded1] bg-[#f8fbf9] text-center hover:bg-[#edf6ef]"><Upload className="h-7 w-7 text-[#4b9a72] mb-2" /><span className="text-sm font-semibold text-[#345258]">اسحب الملفات هنا أو انقر للاختيار</span><span className="text-xs text-slate-400 mt-1">PDF · Excel · Word · صور · ZIP</span><Input className="hidden" type="file" multiple accept=".pdf,.xlsx,.xls,.csv,.docx,.doc,.png,.jpg,.jpeg,.zip" onChange={(e) => { const picked = Array.from(e.target.files || []).slice(0, 20); setFiles(picked); setResult(null); }} /></label></div>
          {!!files.length && <div className="max-h-36 overflow-auto space-y-1">{files.map((item, i) => <div key={`${item.name}-${i}`} className="flex items-center justify-between rounded-lg bg-[#f3f8f4] px-3 py-2 text-sm"><span className="truncate">{item.name} <small className="text-slate-400">({fmtSize(item.size)})</small></span><Button type="button" variant="ghost" size="sm" onClick={() => setFiles((p) => p.filter((_, idx) => idx !== i))}><X className="h-4 w-4" /></Button></div>)}</div>}
          {result && result.failed.length > 0 && <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{result.failed.map((f, i) => <div key={i}>{f.fileName}: {f.error}</div>)}</div>}
          <Button className="w-full bg-emerald-700 hover:bg-emerald-800" disabled={busy} onClick={doUpload}>{busy ? "جاري الرفع..." : "رفع"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ===== سجل النشاط =====
const ACTION_LABELS: Record<string, string> = {
  upload: "رفع ملف", download: "حمّل ملف", approve: "اعتمد", reject: "أرجع للتعديل", request: "أضاف متطلباً",
  comment: "علّق على", create_period: "أنشأ فترة", update_period: "عدّل الفترة", delete_file: "حذف ملف",
  delete_requirement: "حذف متطلباً", update_requirement: "حدّث متطلباً", create_auditor_account: "أنشأ حساب مراجع", update_auditor_account: "عدّل حساب مراجع",
};
function ActivityTab({ periodId }: { periodId: number }) {
  const q = useQuery<any[]>({ queryKey: ["/api/audit/periods", periodId, "activity"], queryFn: () => api(`/api/audit/periods/${periodId}/activity`) });
  return (
    <Card>
      <CardContent className="py-4 space-y-2">
        {!q.data?.length && <p className="text-center text-gray-500 py-4">لا يوجد نشاط بعد</p>}
        {(q.data || []).map((a) => (
          <div key={a.id} className="flex items-center gap-2 text-sm border-b last:border-0 pb-2">
            <Activity className={`h-4 w-4 shrink-0 ${a.isAuditor ? "text-purple-600" : "text-emerald-600"}`} />
            <span className="font-semibold">{a.userName}{a.isAuditor ? " (المراجع)" : ""}</span>
            <span className="text-gray-600">{ACTION_LABELS[a.action] || a.action}</span>
            <span className="text-gray-500 truncate">{a.details}</span>
            <span className="text-xs text-gray-400 mr-auto shrink-0">{fmtDT(a.createdAt)}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ===== حسابات مكتب المراجعة (admin فقط) =====
function AuditorAccountsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const q = useQuery<any[]>({ queryKey: ["/api/audit/auditor-accounts"], queryFn: () => api("/api/audit/auditor-accounts") });
  const [f, setF] = useState({ name: "", username: "", password: "" });
  const create = useMutation({
    mutationFn: () => api("/api/audit/auditor-accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) }),
    onSuccess: () => { toast({ title: "تم إنشاء حساب المراجع ✔", description: "سلّم بيانات الدخول لمكتب المراجعة" }); setF({ name: "", username: "", password: "" }); qc.invalidateQueries({ queryKey: ["/api/audit/auditor-accounts"] }); },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });
  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: string }) =>
      api(`/api/audit/auditor-accounts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/audit/auditor-accounts"] }),
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><UserPlus className="h-5 w-5 text-purple-700" /> حساب جديد لمكتب المراجعة</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>اسم مكتب المراجعة</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="مثال: مكتب فلان وشركاه للمراجعة" /></div>
          <div><Label>اسم المستخدم (إنجليزي)</Label><Input dir="ltr" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} placeholder="auditor2026" /></div>
          <div><Label>كلمة المرور (8+ أحرف)</Label><Input dir="ltr" type="text" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
          <Button className="w-full" disabled={create.isPending} onClick={() => create.mutate()}>{create.isPending ? "جاري الإنشاء..." : "إنشاء الحساب"}</Button>
          <p className="text-xs text-gray-500">حساب المراجع يرى بوابة المراجعة فقط — لا يصل لأي جزء آخر من النظام، وكل تحركاته مسجَّلة</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">الحسابات الحالية</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {!q.data?.length && <p className="text-sm text-gray-500">لا توجد حسابات بعد</p>}
          {(q.data || []).map((u) => (
            <div key={u.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
              <div>
                <p className="font-semibold text-sm">{u.name}</p>
                <p className="text-xs text-gray-400" dir="ltr">{u.username}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={u.isActive === "active" ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-500"}>{u.isActive === "active" ? "نشط" : "موقوف"}</Badge>
                <Button size="sm" variant="outline" onClick={() => toggle.mutate({ id: u.id, isActive: u.isActive === "active" ? "inactive" : "active" })}>
                  {u.isActive === "active" ? "إيقاف" : "تفعيل"}
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
