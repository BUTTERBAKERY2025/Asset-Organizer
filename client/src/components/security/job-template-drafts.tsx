import { useEffect, useRef, useState } from "react";
import { FileClock, Plus, History, ShieldCheck, Search, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useJobTemplateDrafts, type TemplateContent, type TemplateVersion, type DraftCatalog } from "@/hooks/use-job-template-drafts";
import { getHttpStatus } from "@/lib/queryClient";
import { permissionDiff } from "@/lib/job-template-draft-diff";
import { ALL_ACTION_LABELS } from "@shared/schema";
import { templateContentSchema, appendTemplateVersionSchema } from "@shared/job-permission-templates";
import { JobTemplateApproval } from "@/components/security/job-template-approval";
import "./job-template-drafts.css";

const scopes: Record<TemplateContent["scopeType"], string> = {
  branch: "فرع معين", branches: "فروع محددة صراحة", self: "بيانات الموظف الذاتية", assigned_tasks: "المهام المسندة فقط",
};
const blank = (): TemplateContent => ({
  key: "", name: "", description: "", scopeType: "self", assignmentAuthority: "admin", permissions: [], reviewNotes: "",
});
const clone = (content: TemplateContent): TemplateContent => JSON.parse(JSON.stringify(content));

function ErrorNotice({ error, retry }: { error: unknown; retry?: () => void }) {
  const status = getHttpStatus(error);
  const migration = status === 503 && error instanceof Error && /migration_required/i.test(error.message);
  const keyConflict = status === 409 && error instanceof Error && /key_conflict/i.test(error.message);
  return <Alert variant="destructive" role="alert"><AlertDescription className="space-y-2">
    <p>{migration ? "يلزم ترحيل قاعدة البيانات للقوالب أو سجل الاعتماد (051 / 052، migration_required). البيانات غير متاحة حاليًا؛ هذه ليست قائمة فارغة. اطلب من مسؤول النشر إكمال الترحيل المطلوب."
      : status === 403 ? "هذه المسودات متاحة لمسؤول النظام فقط."
      : keyConflict ? "المفتاح مستخدم لقالب آخر. احتُفظ بمحتوى المسودة؛ اختر مفتاحًا مختلفًا ثم أعد الحفظ."
      : status === 409 ? "يوجد إصدار أحدث. احتُفظ بتعديلاتك غير المحفوظة. حدّث مرجع المقارنة ثم راجع الفروقات قبل إعادة الحفظ."
      : status === 400 || status === 422 ? "لم تُقبل بيانات المسودة. راجع المفتاح والحقول والصلاحيات المسموح بها ثم أعد المحاولة."
      : "تعذّر إكمال الطلب. لم نغيّر حسابات الموظفين. يمكنك إعادة المحاولة."}</p>
    {retry && <Button type="button" variant="outline" size="sm" onClick={retry}><RefreshCw className="h-4 w-4 me-2" />إعادة المحاولة</Button>}
  </AlertDescription></Alert>;
}

function LoadingDrafts() {
  return <div aria-label="جارٍ تحميل المسودات" className="space-y-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-28 w-full" /><Skeleton className="h-28 w-full" /></div>;
}

export function JobTemplateDrafts() {
  const { user, isAdmin, isLoading, isFetchedAfterMount, isAuthError, refetchAuth } = useAuth(true);
  if (isAuthError) return <ErrorNotice error={new Error("auth unavailable")} retry={() => { void refetchAuth(); }} />;
  if (isLoading || !isFetchedAfterMount) return <LoadingDrafts />;
  if (!isAdmin || !user) return <Alert><AlertDescription>إدارة مسودات القوالب لمسؤول النظام فقط.</AlertDescription></Alert>;
  return <AdminDraftWorkspace key={user.id} userId={user.id} />;
}

function AdminDraftWorkspace({ userId }: { userId: string }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [newContent, setNewContent] = useState<TemplateContent | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [search, setSearch] = useState("");
  const [seedOpen, setSeedOpen] = useState(false);
  const resources = useJobTemplateDrafts(userId, selectedId);
  const { toast } = useToast();
  const { catalog, list, detail, seed } = resources;
  const changeSelection = (id: number | null, content: TemplateContent | null) => {
    if (resources.save.isPending || resources.approve.isPending) return;
    if (dirty && !window.confirm("لديك تعديلات غير محفوظة. هل تريد تركها؟")) return;
    setSelectedId(id); setNewContent(content); setDirty(false); setEditorKey(key => key + 1); resources.save.reset(); resources.approve.reset();
  };
  const saved = () => {
    setDirty(false); setSelectedId(null); setNewContent(null);
    toast({ title: "حُفظت المسودة", description: "لم تُطبّق أي صلاحيات على الموظفين." });
  };
  const items = list.data?.filter(item => `${item.name} ${item.key}`.toLowerCase().includes(search.toLowerCase())) ?? [];
  const versions = [...(detail.data?.versions ?? [])].sort((a, b) => b.version - a.version);
  const latest = versions[0];
  return <div className="job-drafts space-y-5" dir="rtl" data-testid="job-template-drafts">
    <div className="draft-notice rounded-lg p-4 flex gap-3">
      <ShieldCheck className="h-5 w-5 shrink-0 text-teal-700 dark:text-teal-300" />
      <div className="space-y-1"><h2 className="font-semibold">مراجعة واعتماد، دون تطبيق على الموظفين</h2>
        <p className="text-sm text-muted-foreground">يمكن للمسؤول اعتماد أحدث إصدار محفوظ بعد مراجعة صريحة. الاعتماد لا يسند القالب للموظفين ولا يعدّل الأدوار الحالية أو الصلاحيات الفعلية.</p></div>
    </div>
    <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
      <div><h2 className="text-xl font-bold">القوالب الوظيفية · مسودات بإصدارات</h2><p className="text-sm text-muted-foreground">تعريف مستقل عن المسمى الوظيفي والدور الأمني.</p></div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={seed.isPending || resources.save.isPending || resources.approve.isPending || !!list.error || !!catalog.error || catalog.isLoading || list.isLoading} onClick={() => setSeedOpen(true)} data-testid="seed-job-proposals">إضافة المقترحات التسعة</Button>
        <Button disabled={resources.save.isPending || resources.approve.isPending || !!catalog.error || !!list.error || catalog.isLoading || list.isLoading} onClick={() => changeSelection(null, blank())} data-testid="new-job-draft"><Plus className="h-4 w-4 me-2" />مسودة جديدة</Button>
      </div>
    </div>
    {catalog.error && <ErrorNotice error={catalog.error} retry={() => { void catalog.refetch(); }} />}
    {list.error && <ErrorNotice error={list.error} retry={() => { void list.refetch(); }} />}
    {seed.error && <ErrorNotice error={seed.error} />}
    {catalog.isLoading || list.isLoading ? <LoadingDrafts /> : catalog.data && list.data && <div className="draft-workspace">
      <Card><CardHeader><CardTitle className="text-base">سجل المسودات <Badge variant="secondary">{list.data.length}</Badge></CardTitle><CardDescription>آخر إصدار محفوظ لكل قالب</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div className="relative"><Search className="absolute end-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="بحث بالاسم أو المفتاح" aria-label="بحث في المسودات" className="pe-9" /></div>
          {items.length === 0 ? <div className="rounded-lg border border-dashed p-5 text-center space-y-2"><FileClock className="h-7 w-7 mx-auto text-muted-foreground" /><p className="text-sm">{list.data.length ? "لا نتائج تطابق البحث." : "لم تُنشأ مسودات بعد."}</p><p className="text-xs text-muted-foreground">ابدأ بقالب فارغ أو أضف المقترحات صراحة؛ لن تُضاف تلقائيًا.</p></div>
            : items.map(item => <button type="button" key={item.id} disabled={resources.save.isPending || resources.approve.isPending} onClick={() => changeSelection(item.id, null)} aria-pressed={selectedId === item.id} className={`w-full text-start rounded-lg border p-3 space-y-2 transition-colors hover:bg-muted/60 ${selectedId === item.id ? "border-primary bg-primary/5" : ""}`} data-testid={`job-draft-${item.id}`}>
              <span className="flex items-start justify-between gap-2"><span className="font-medium">{item.name}</span><Badge variant="outline">{item.latestVersionApproved ? "أحدث إصدار معتمد" : "مسودة غير معتمدة"}</Badge></span>
              <span className="block text-xs text-muted-foreground">{scopes[item.scopeType]} · {item.permissionCount} صلاحية · إصدار {item.latestVersion}</span>
              <span className="block text-xs text-muted-foreground" dir="ltr">{item.key}</span>
            </button>)}
        </CardContent>
      </Card>
      <div>
        {selectedId && detail.error && detail.data && <ErrorNotice error={detail.error} retry={() => { void detail.refetch(); }} />}
        {selectedId && detail.isLoading ? <LoadingDrafts /> : selectedId && detail.error && !detail.data ? <ErrorNotice error={detail.error} retry={() => { void detail.refetch(); }} />
          : (newContent || latest) ? <DraftEditor key={`${selectedId ?? "new"}-${editorKey}`} initial={newContent ?? latest!.content} versions={selectedId ? versions : []} catalog={catalog.data} resources={resources} onDirty={() => setDirty(true)} onSaved={saved} onCancel={() => changeSelection(null, null)} />
          : <Card><CardContent className="py-12 text-center space-y-3"><History className="h-9 w-9 mx-auto text-muted-foreground" /><h3 className="font-semibold">اختر مسودة لمراجعة إصداراتها</h3><p className="text-sm text-muted-foreground">الإصدارات القديمة للقراءة فقط. التعديل يحفظ إصدارًا جديدًا، ولا يستبدل التاريخ.</p></CardContent></Card>}
      </div>
    </div>}
    <Dialog open={seedOpen} onOpenChange={value => { if (!seed.isPending) setSeedOpen(value); }}>
      <DialogContent dir="rtl"><DialogHeader><DialogTitle>إضافة المقترحات للمراجعة؟</DialogTitle><DialogDescription>المقترحات الجديدة تُحفظ كمسودات غير معتمدة. الطلب قابل للتكرار دون إنشاء نسخ مكررة أو تغيير اعتمادات القوالب القائمة. لا يمنح أي موظف صلاحيات.</DialogDescription></DialogHeader>
        {seed.error && <ErrorNotice error={seed.error} />}
        <DialogFooter className="gap-2"><Button variant="outline" disabled={seed.isPending} onClick={() => setSeedOpen(false)}>إلغاء</Button><Button disabled={seed.isPending} onClick={() => seed.mutate(undefined, { onSuccess: () => { setSeedOpen(false); toast({ title: "المقترحات جاهزة للمراجعة", description: "لم يُسجّل أي اعتماد تلقائي ولم تتغير صلاحيات الموظفين." }); } })}>{seed.isPending ? "جارٍ حفظ المقترحات…" : "إضافة كمسودات فقط"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}

function DraftEditor({ initial, versions, catalog, resources, onDirty, onSaved, onCancel }: {
  initial: TemplateContent; versions: TemplateVersion[]; catalog: DraftCatalog;
  resources: ReturnType<typeof useJobTemplateDrafts>; onDirty: () => void; onSaved: () => void; onCancel: () => void;
}) {
  const [content, setContent] = useState(() => clone(initial));
  const [reason, setReason] = useState("");
  const [expected, setExpected] = useState(versions[0]?.version ?? 0);
  const [view, setView] = useState("edit");
  const [compare, setCompare] = useState(String(versions[1]?.version ?? versions[0]?.version ?? ""));
  const [moduleSearch, setModuleSearch] = useState("");
  const [conflict, setConflict] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [validation, setValidation] = useState("");
  const workDirty = useRef(false);
  const latestVersion = versions[0];
  useEffect(() => {
    // Cached detail can render before its fresh GET completes. A clean work
    // copy follows newer saved history; a genuine unsaved copy never does.
    if (!workDirty.current && latestVersion && latestVersion.version > expected) {
      setContent(clone(latestVersion.content));
      setExpected(latestVersion.version);
      setReason("");
    }
  }, [latestVersion, expected]);
  const isNew = versions.length === 0;
  const readOnly = view !== "edit";
  const version = versions.find(item => String(item.version) === view);
  const shown = version?.content ?? content;
  const before = versions.find(item => String(item.version) === compare);
  const diff = before ? permissionDiff(before.content, shown) : null;
  const pending = resources.save.isPending || resources.approve.isPending;
  const unavailable = !!resources.catalog.error || !!resources.list.error || (!isNew && !!resources.detail.error);
  const update = <K extends keyof TemplateContent>(key: K, value: TemplateContent[K]) => {
    workDirty.current = true;
    setContent(current => ({ ...current, [key]: value })); onDirty(); setValidation("");
  };
  const toggle = (module: TemplateContent["permissions"][number]["module"], action: TemplateContent["permissions"][number]["actions"][number], checked: boolean) => {
    const actions = content.permissions.find(item => item.module === module)?.actions ?? [];
    const next = checked ? Array.from(new Set([...actions, action])) : actions.filter(item => item !== action);
    update("permissions", [...content.permissions.filter(item => item.module !== module), ...(next.length ? [{ module, actions: next }] : [])]);
  };
  const save = () => {
    const validated = templateContentSchema.safeParse(content);
    if (!validated.success || (!isNew && !appendTemplateVersionSchema.safeParse({ content, expectedLatestVersion: expected, changeReason: reason }).success)) {
      setValidation("راجع بيانات المسودة: الاسم مطلوب (حتى 200 حرف)، والمفتاح يبدأ بحرف إنجليزي صغير ويقبل الحروف الصغيرة والأرقام و_ فقط (حتى 80 حرفًا). سبب الإصدار مطلوب (حتى 2000 حرف)."); return;
    }
    resources.save.mutate({ id: isNew ? null : resources.detail.data!.id, content: validated.data, expectedLatestVersion: expected, changeReason: reason.trim() }, {
      onSuccess: onSaved,
      onError: error => { if (!isNew && getHttpStatus(error) === 409) setConflict(true); },
    });
  };
  const refreshReference = async () => {
    setRefreshing(true);
    try {
      const result = await resources.detail.refetch();
      if (result.data && !result.error) {
        const current = [...result.data.versions].sort((a, b) => b.version - a.version)[0];
        if (current) { setExpected(current.version); setCompare(String(current.version)); setConflict(false); resources.save.reset(); }
      }
    } finally { setRefreshing(false); }
  };
  const describePermission = (key: string) => {
    const [module, action] = key.split(":");
    return `${catalog.modules.find(item => item.id === module)?.label ?? module} · ${ALL_ACTION_LABELS[action] ?? action}`;
  };
  return <Card data-testid="job-draft-editor">
    <CardHeader className="space-y-3"><div className="flex justify-between gap-2"><CardTitle className="text-lg">{isNew ? "إنشاء مسودة" : content.name}</CardTitle><Badge variant="outline">{version && resources.detail.data?.approvals?.some(item => item.version === version.version) ? "إصدار معتمد" : "نسخة غير معتمدة"}</Badge></div>
      <CardDescription>{isNew ? "الإنشاء يحفظ الإصدار الأول فقط." : `مرجع الحفظ: الإصدار ${expected}. كل حفظ يضيف إصدارًا جديدًا.`}</CardDescription>
      {!isNew && <div className="space-y-2"><Label htmlFor="draft-view">سجل الإصدارات</Label><Select value={view} onValueChange={setView} disabled={pending}><SelectTrigger id="draft-view"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="edit">تحرير نسخة عمل · حفظ إصدار جديد</SelectItem>{versions.map(item => <SelectItem key={item.version} value={String(item.version)}>الإصدار {item.version} · قراءة فقط</SelectItem>)}</SelectContent></Select></div>}
      {version && <div className="text-xs text-muted-foreground space-y-1"><p>أُنشئ {new Date(version.createdAt).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" })} (توقيت السعودية) · بواسطة {version.createdBy}</p><p>سبب التغيير: {version.changeReason || "إنشاء المسودة"}</p><p>هذه نسخة تاريخية للقراءة فقط. تعديلات نسخة العمل محفوظة محليًا أثناء استعراضها.</p></div>}
    </CardHeader>
    <CardContent className="space-y-5">
      {isNew && <div className="space-y-2"><Label htmlFor="draft-proposal">البدء من مقترح (اختياري)</Label><Select onValueChange={key => { const proposal = catalog.proposals.find(item => item.key === key); if (proposal && (!content.name || window.confirm("استبدال محتوى نسخة العمل بالمقترح؟"))) { workDirty.current = true; setContent(clone(proposal)); onDirty(); } }} disabled={pending}><SelectTrigger id="draft-proposal"><SelectValue placeholder="قالب فارغ، أو مقترح غير معتمد" /></SelectTrigger><SelectContent>{catalog.proposals.map(proposal => <SelectItem key={proposal.key} value={proposal.key}>{proposal.name} · مقترح</SelectItem>)}</SelectContent></Select></div>}
      <fieldset disabled={readOnly || pending} className="space-y-4">
        <legend className="sr-only">بيانات القالب وصلاحياته</legend>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="draft-name">اسم القالب</Label><Input id="draft-name" autoComplete="off" value={shown.name} onChange={event => update("name", event.target.value)} maxLength={200} /></div>
          <div className="space-y-2"><Label htmlFor="draft-key">المفتاح الثابت</Label><Input id="draft-key" autoComplete="off" dir="ltr" value={shown.key} disabled={!isNew || readOnly || pending} onChange={event => update("key", event.target.value)} maxLength={80} /></div>
        </div>
        <div className="space-y-2"><Label htmlFor="draft-description">الوصف</Label><Textarea id="draft-description" maxLength={4000} value={shown.description} onChange={event => update("description", event.target.value)} /></div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="draft-scope">نطاق القالب المقترح</Label><Select value={shown.scopeType} onValueChange={value => update("scopeType", value as TemplateContent["scopeType"])} disabled={readOnly || pending}><SelectTrigger id="draft-scope"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(scopes).map(([key, label]) => <SelectItem value={key} key={key}>{label}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label htmlFor="draft-authority">جهة الإسناد المقترحة</Label><Select value={shown.assignmentAuthority} onValueChange={value => update("assignmentAuthority", value as TemplateContent["assignmentAuthority"])} disabled={readOnly || pending}><SelectTrigger id="draft-authority"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="admin">مسؤول النظام</SelectItem><SelectItem value="delegated_operations">مدير التشغيل المفوض أو المسؤول</SelectItem></SelectContent></Select></div>
        </div>
      </fieldset>
      <div className="space-y-3"><div className="flex items-center justify-between"><h3 className="font-semibold text-sm">الصلاحيات التشغيلية المقترحة</h3><Badge variant="secondary">{shown.permissions.reduce((sum, item) => sum + item.actions.length, 0)} إجراء</Badge></div>
        <Input aria-label="بحث في وحدات القالب" placeholder="تصفية الوحدات…" value={moduleSearch} onChange={event => setModuleSearch(event.target.value)} />
        <div className="grid gap-2 md:grid-cols-2 max-h-[28rem] overflow-y-auto pe-1">
          {catalog.modules.filter(module => `${module.id} ${module.label}`.toLowerCase().includes(moduleSearch.toLowerCase())).map(module => <div className="draft-module space-y-3" key={module.id}><p className="text-sm font-medium">{module.label}</p><div className="flex flex-wrap gap-x-4 gap-y-3">{module.actions.map(action => <label className="flex items-center gap-2 text-xs cursor-pointer" key={action}><Checkbox checked={shown.permissions.some(item => item.module === module.id && item.actions.includes(action))} disabled={readOnly || pending} onCheckedChange={value => toggle(module.id, action, value === true)} aria-label={`${module.label} — ${ALL_ACTION_LABELS[action] ?? action}`} />{ALL_ACTION_LABELS[action] ?? action}</label>)}</div></div>)}
        </div>
        {!catalog.modules.some(module => `${module.id} ${module.label}`.toLowerCase().includes(moduleSearch.toLowerCase())) && <p className="text-sm text-muted-foreground p-3 border border-dashed rounded-lg">لا وحدات تطابق البحث. غيّر عبارة التصفية لعرض الصلاحيات.</p>}
        {shown.permissions.length === 0 && <Alert className="draft-notice"><AlertDescription>القالب الفارغ صالح. لا يمنح صلاحيات إدارة الفرع؛ صلاحيات بوابة الموظف الذاتية مستقلة، ولا يُعطّلها فراغ هذا القالب.</AlertDescription></Alert>}
      </div>
      <div className="space-y-2"><Label htmlFor="draft-notes">ملاحظات المراجعة والقيود</Label><Textarea id="draft-notes" maxLength={8000} disabled={readOnly || pending} value={shown.reviewNotes} onChange={event => update("reviewNotes", event.target.value)} /></div>
      {!isNew && <section className="rounded-lg border p-4 space-y-3" aria-label="مقارنة إصدارات القالب">
        <h3 className="font-semibold text-sm">مقارنة الصلاحيات</h3><Label htmlFor="draft-compare">المقارنة من الإصدار</Label><Select value={compare} onValueChange={setCompare}><SelectTrigger id="draft-compare"><SelectValue /></SelectTrigger><SelectContent>{versions.map(item => <SelectItem key={item.version} value={String(item.version)}>الإصدار {item.version}</SelectItem>)}</SelectContent></Select>
        <p className="text-xs text-muted-foreground">إلى {readOnly ? `الإصدار ${view}` : "نسخة العمل الحالية"} · المقارنة لا تمثل الصلاحيات الفعلية للموظف.</p>
        {diff && <div className="draft-diff space-y-3 text-sm"><div><p className="font-medium text-teal-700 dark:text-teal-300">إضافات ({diff.added.length})</p>{diff.added.length ? <ul className="list-disc ps-5">{diff.added.map(item => <li key={item}>{describePermission(item)}</li>)}</ul> : <p className="text-muted-foreground text-xs">لا إضافات</p>}</div><div><p className="font-medium text-rose-700 dark:text-rose-300">إزالات ({diff.removed.length})</p>{diff.removed.length ? <ul className="list-disc ps-5">{diff.removed.map(item => <li key={item}>{describePermission(item)}</li>)}</ul> : <p className="text-muted-foreground text-xs">لا إزالات</p>}</div>
          {before && before.content.scopeType !== shown.scopeType && <p>تغيّر النطاق: {scopes[before.content.scopeType]} ← {scopes[shown.scopeType]}</p>}
          {before && before.content.assignmentAuthority !== shown.assignmentAuthority && <p>تغيّرت جهة الإسناد المقترحة.</p>}
        </div>}
      </section>}
      {!isNew && <JobTemplateApproval version={version ?? null} latestVersion={versions[0].version} resources={resources} catalog={catalog} onReviewLatest={number => setView(String(number))} />}
      {!readOnly && !isNew && <div className="space-y-2"><Label htmlFor="draft-reason">سبب إنشاء الإصدار الجديد (مطلوب)</Label><Textarea id="draft-reason" maxLength={2000} disabled={pending} value={reason} onChange={event => { workDirty.current = true; setReason(event.target.value); onDirty(); }} placeholder="ما الذي تغيّر، ولماذا؟" /></div>}
      {validation && <Alert variant="destructive"><AlertDescription>{validation}</AlertDescription></Alert>}
      {resources.save.error && <ErrorNotice error={resources.save.error} />}
      {conflict && <Button variant="outline" disabled={refreshing} onClick={() => { void refreshReference(); }} data-testid="refresh-job-draft-conflict">{refreshing ? "جارٍ تحديث المرجع…" : "جلب أحدث إصدار مع الاحتفاظ بتعديلاتي"}</Button>}
      {!readOnly && <div className="flex flex-wrap gap-2 border-t pt-4"><Button disabled={pending || conflict || refreshing || unavailable} onClick={save} data-testid="save-job-draft">{pending ? "جارٍ حفظ المسودة…" : isNew ? "حفظ الإصدار الأول كمسودة" : "حفظ إصدار جديد كمسودة"}</Button><Button disabled={pending} variant="outline" onClick={onCancel}>إغلاق</Button><p className="w-full text-xs text-muted-foreground">الحفظ لا يعني الاعتماد ولا يغيّر الحسابات القائمة.</p></div>}
    </CardContent>
  </Card>;
}