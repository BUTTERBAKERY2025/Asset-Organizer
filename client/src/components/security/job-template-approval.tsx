import { useEffect, useState } from "react";
import { ShieldCheck, FileCheck2, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getHttpStatus } from "@/lib/queryClient";
import { ALL_ACTION_LABELS } from "@shared/schema";
import type { DraftCatalog, TemplateVersion, useJobTemplateDrafts } from "@/hooks/use-job-template-drafts";

const scopeLabels = { branch: "فرع معين", branches: "فروع محددة صراحة", self: "بيانات الموظف الذاتية", assigned_tasks: "المهام المسندة فقط" };
const dateLabel = (value: string) => new Date(value).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" });

export function JobTemplateApproval({ version, latestVersion, resources, catalog, onReviewLatest }: {
  version: TemplateVersion | null;
  latestVersion: number;
  resources: ReturnType<typeof useJobTemplateDrafts>;
  catalog: DraftCatalog;
  onReviewLatest: (version: number) => void;
}) {
  const [reason, setReason] = useState("");
  const [reviewedVersion, setReviewedVersion] = useState<number | null>(null);
  const [emptyAckVersion, setEmptyAckVersion] = useState<number | null>(null);
  const [conflict, setConflict] = useState<"stale" | "already" | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const { toast } = useToast();
  const { detail, approve } = resources;
  const approvals = detail.data?.approvals ?? [];
  const approval = approvals.find(item => item.version === version?.version);
  const latestApproved = approvals.some(item => item.version === latestVersion);
  const selectedVersion = version?.version ?? null;
  useEffect(() => {
    // A new selection or newer persisted version needs a fresh human review.
    // The approval reason and any editor work copy are intentionally retained.
    setReviewedVersion(null); setEmptyAckVersion(null);
  }, [selectedVersion, latestVersion]);
  const pending = approve.isPending || refreshing;
  const empty = !!version && version.content.permissions.every(item => item.actions.length === 0);
  const isLatest = selectedVersion === latestVersion;
  const unavailable = !!detail.error || !!resources.catalog.error || !!resources.list.error;
  const canApprove = !!version && isLatest && !approval && !latestApproved && !conflict && !pending && !unavailable
    && reason.trim().length > 0 && reason.trim().length <= 2000 && reviewedVersion === selectedVersion
    && (!empty || emptyAckVersion === selectedVersion);
  const refreshReview = async () => {
    setRefreshing(true); setRefreshError(false);
    setReviewedVersion(null); setEmptyAckVersion(null);
    try {
      const result = await detail.refetch();
      if (result.error || !result.data) { setRefreshError(true); return; }
      const latest = [...result.data.versions].sort((a, b) => b.version - a.version)[0];
      if (latest) { setConflict(null); approve.reset(); onReviewLatest(latest.version); }
    } finally { setRefreshing(false); }
  };
  const submit = () => {
    if (!canApprove || !version || !detail.data) return;
    approve.mutate({
      id: detail.data.id,
      data: { version: version.version, expectedLatestVersion: latestVersion, reason: reason.trim(), reviewed: true, ...(empty ? { acknowledgeEmptyPermissions: true as const } : {}) },
    }, {
      onSuccess: () => {
        setReviewedVersion(null); setEmptyAckVersion(null); setConflict(null);
        toast({ title: "تم تسجيل اعتماد الإصدار", description: "الاعتماد لا يطبّق صلاحيات على الموظفين ولا يغيّر الأدوار الحالية." });
      },
      onError: error => {
        if (getHttpStatus(error) === 409) {
          setReviewedVersion(null); setEmptyAckVersion(null);
          const already = error instanceof Error && /already_approved/i.test(error.message);
          setConflict(already ? "already" : "stale");
          if (already) { void detail.refetch(); }
        }
      },
    });
  };
  const migration = getHttpStatus(approve.error) === 503 && approve.error instanceof Error && /migration_required/i.test(approve.error.message);
  return <section className="rounded-xl border border-teal-700/20 bg-teal-700/[.035] p-4 space-y-4" aria-label="مراجعة واعتماد الإصدار المحفوظ" data-testid="job-template-approval">
    <div className="flex items-start gap-3"><FileCheck2 className="h-5 w-5 shrink-0 text-teal-700 dark:text-teal-300" /><div className="space-y-1"><h3 className="font-semibold">اعتماد إصدار محفوظ · دون تطبيق</h3><p className="text-xs text-muted-foreground">الاعتماد سجل مراجعة لهذا الإصدار فقط. الإصدارات التالية تحتاج مراجعة واعتمادًا جديدين، ولا تتغير صلاحيات أي موظف.</p></div></div>
    {!version ? <div className="space-y-2"><p className="text-sm">نسخة العمل ليست قابلة للاعتماد، حتى لو طابقت إصدارًا محفوظًا. اختر أحدث إصدار للقراءة والمراجعة. أي تعديلات غير محفوظة تبقى في نسخة العمل ولا تدخل في الاعتماد.</p><Button variant="outline" disabled={pending || resources.save.isPending} onClick={() => onReviewLatest(latestVersion)} data-testid="review-latest-job-version">مراجعة الإصدار المحفوظ {latestVersion}</Button></div>
      : <>
        <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">الإصدار {version.version}</Badge><Badge variant={approval ? "secondary" : "outline"}>{approval ? "معتمد · دون تطبيق" : "غير معتمد"}</Badge>{!isLatest && <span className="text-xs text-muted-foreground">إصدار سابق؛ لا يمكن اعتماده الآن</span>}</div>
        <div className="rounded-lg border bg-background/60 p-4 space-y-3 text-sm" data-testid="approval-persisted-content">
          <h4 className="font-semibold">محتوى الإصدار المحفوظ للمراجعة الكاملة</h4>
          <dl className="space-y-3">
            <div><dt className="text-xs text-muted-foreground">الاسم والمفتاح</dt><dd>{version.content.name} · <span dir="ltr">{version.content.key}</span></dd></div>
            <div><dt className="text-xs text-muted-foreground">الوصف</dt><dd className="whitespace-pre-wrap break-words">{version.content.description || "بلا وصف"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">النطاق</dt><dd>{scopeLabels[version.content.scopeType]}</dd></div>
            <div><dt className="text-xs text-muted-foreground">جهة الإسناد</dt><dd>{version.content.assignmentAuthority === "admin" ? "مسؤول النظام" : "مدير التشغيل المفوض أو المسؤول"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">كل الصلاحيات المحفوظة · دون تصفية</dt><dd>{empty ? "لا صلاحيات تشغيلية" : <ul className="list-disc ps-5 space-y-1">{version.content.permissions.map(item => <li key={item.module}>{catalog.modules.find(module => module.id === item.module)?.label ?? item.module}: {item.actions.map(action => ALL_ACTION_LABELS[action] ?? action).join("، ") || "بلا إجراءات"}</li>)}</ul>}</dd></div>
            <div><dt className="text-xs text-muted-foreground">ملاحظات المراجعة والقيود</dt><dd className="whitespace-pre-wrap break-words">{version.content.reviewNotes || "بلا ملاحظات"}</dd></div>
          </dl>
        </div>
        {approval ? <Alert><ShieldCheck className="h-4 w-4" /><AlertDescription><p className="font-medium">اعتماد مسجل لهذا الإصدار</p><p className="text-xs">بواسطة {approval.approvedBy} · {dateLabel(approval.approvedAt)} (توقيت السعودية)</p><p className="whitespace-pre-wrap break-words">السبب: {approval.reason}</p><p className="text-xs">يبقى هذا الاعتماد سجلًا تاريخيًا عند إنشاء إصدار مسودة جديد؛ لا يشمل الإصدار الجديد.</p></AlertDescription></Alert>
          : isLatest && <div className="space-y-4">
            {empty && <Alert className="border-amber-600/30 bg-amber-500/5"><AlertDescription>هذا الإصدار فارغ الصلاحيات التشغيلية. الاعتماد لا يزيل صلاحيات الدور التلقائية أو الموروثة، ولا يغيّر بوابة الموظف الذاتية. القالب الفارغ ليس دليلًا على انعدام الصلاحيات الفعلية.</AlertDescription></Alert>}
            <div className="space-y-2"><Label htmlFor="job-approval-reason">سبب اعتماد هذا الإصدار (مطلوب)</Label><Textarea id="job-approval-reason" maxLength={2000} value={reason} disabled={pending} onChange={event => setReason(event.target.value)} placeholder="وثّق قرار المراجعة والقيود المعتمدة." /></div>
            <label className="flex items-start gap-2 text-sm"><Checkbox aria-label="راجعت كامل محتوى الإصدار المحفوظ" checked={reviewedVersion === selectedVersion} disabled={pending || !!conflict || unavailable} onCheckedChange={checked => setReviewedVersion(checked === true ? selectedVersion : null)} /><span>راجعت كامل محتوى الإصدار المحفوظ {selectedVersion}، بما فيه النطاق وجهة الإسناد والصلاحيات وملاحظات المراجعة.</span></label>
            {empty && <label className="flex items-start gap-2 text-sm"><Checkbox aria-label="أقر باستقلال صلاحيات الدور والبوابة عن القالب الفارغ" checked={emptyAckVersion === selectedVersion} disabled={pending || !!conflict || unavailable} onCheckedChange={checked => setEmptyAckVersion(checked === true ? selectedVersion : null)} /><span>أقر صراحة بأن اعتماد قالب فارغ لا يسحب صلاحيات الدور أو الصلاحيات الموروثة ولا يعطّل البوابة الذاتية.</span></label>}
            <Button disabled={!canApprove} onClick={submit} data-testid="approve-job-template-version">{approve.isPending ? "جارٍ تسجيل الاعتماد…" : `اعتماد الإصدار ${selectedVersion} فقط · دون تطبيق`}</Button>
          </div>}
        {!isLatest && !approval && <Button variant="outline" disabled={pending} onClick={() => onReviewLatest(latestVersion)}>الانتقال لمراجعة أحدث إصدار محفوظ</Button>}
      </>}
    {approve.error && !approval && <Alert variant="destructive" role="alert"><AlertDescription>{migration
      ? "اعتماد الإصدارات غير متاح: يلزم ترحيل قاعدة البيانات 052 (migration_required). لم يتم الاعتماد أو تطبيق أي صلاحيات."
      : conflict === "already" ? "هذا الإصدار معتمد بالفعل. نجلب سجل الاعتماد الفعلي؛ لا حاجة لإعادة الطلب."
      : conflict === "stale" ? "تغيّر أحدث إصدار أثناء المراجعة. احتُفظ بالسبب وتعديلات نسخة العمل، وأُلغي إقرار المراجعة. حدّث ثم راجع أحدث إصدار من جديد؛ لن نعيد اعتماد الإصدار القديم تلقائيًا."
      : "تعذّر تسجيل الاعتماد. احتُفظ بالسبب، ولم تتغيّر صلاحيات الموظفين. راجع البيانات أو أعد المحاولة."}</AlertDescription></Alert>}
    {refreshError && <Alert variant="destructive"><AlertDescription>تعذّر تحديث سجل الإصدارات. السبب وتعديلات نسخة العمل محفوظة؛ الاعتماد متوقف حتى نجاح التحديث والمراجعة الجديدة.</AlertDescription></Alert>}
    {(conflict || refreshError) && <Button variant="outline" disabled={pending} onClick={() => { void refreshReview(); }} data-testid="refresh-job-approval-review"><RefreshCw className="h-4 w-4 me-2" />{refreshing ? "جارٍ تحديث المراجعة…" : "تحديث السجل وإعادة مراجعة أحدث إصدار"}</Button>}
    {approvals.length > 0 && <div className="border-t pt-3 space-y-2"><h4 className="text-sm font-medium">سجل الاعتمادات المحفوظ</h4>{[...approvals].sort((a, b) => b.version - a.version).map(item => <div key={item.version} className="text-xs text-muted-foreground space-y-1"><p>الإصدار {item.version} · {item.approvedBy} · {dateLabel(item.approvedAt)}</p><p className="whitespace-pre-wrap break-words">{item.reason}</p></div>)}</div>}
  </section>;
}