import { useEffect, useRef, useState } from "react";
import { AlertTriangle, RefreshCw, ShieldCheck } from "lucide-react";
import type { DelegatedEmployeeAccount } from "@/lib/employee-account-types";
import type { EmployeeTemplatePilotResponse } from "@shared/employee-account-delegation";
import type { EmployeeTemplatePilotInput, EmployeeTemplatePilotResult } from "@/lib/employee-template-pilot";
import { employeeTemplatePilotEndpoint, employeeTemplatePilotError } from "@/lib/employee-template-pilot";
import { employeeTemplateKey } from "@/lib/employee-template-assignment";
import { createEmployeeAccountCommandGuard, requestEmployeeAccount } from "@/lib/employee-account-delegation";
import { useEmployeeTemplatePilot } from "@/hooks/use-employee-template-pilot";
import { additionDateLabel } from "@/lib/employee-account-additions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmployeeTemplatePilotComparison, PilotAuthorityPanel, PilotPermissionList } from "./employee-template-pilot-comparison";
import { employeeDialogBody, employeeDialogFooter, employeeDialogHeader, employeeDialogShell, useEmployeeAccountDialogLayout } from "./employee-account-dialog-layout";

const pilotScopeLabels = { branch: "فرع", branches: "عدة فروع", self: "الموظف نفسه", assigned_tasks: "مهام مسندة" };

export interface EmployeeTemplatePilotDialogProps {
  actorRole: string;
  actorId: string;
  employee: DelegatedEmployeeAccount;
  contextRevision?: string;
  close: () => void;
  refresh: () => void;
}

/** Gate before mounting comparison resources; never available through delegated operations. */
export function EmployeeTemplatePilotDialog(props: EmployeeTemplatePilotDialogProps) {
  if (props.actorRole !== "admin") return <p role="alert" dir="rtl">مقارنة وتجربة القوالب متاحة للأدمن فقط.</p>;
  return <AdminEmployeeTemplatePilotDialog {...props} />;
}

function AdminEmployeeTemplatePilotDialog({ employee, contextRevision, close, refresh }: EmployeeTemplatePilotDialogProps) {
  const dialogStyle = useEmployeeAccountDialogLayout();
  const resource = useEmployeeTemplatePilot(employee.employeeId);
  const [selection, setSelection] = useState("");
  const [reason, setReason] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [finalStage, setFinalStage] = useState(false);
  const [finalConfirmed, setFinalConfirmed] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [applied, setApplied] = useState<EmployeeTemplatePilotResult | null>(null);
  const [verification, setVerification] = useState<EmployeeTemplatePilotResponse | null>(null);
  const guard = useRef(createEmployeeAccountCommandGuard()).current;
  const request = useRef<AbortController | null>(null);
  const pendingRef = useRef(false);
  const completedRef = useRef(false);
  const actorContext = JSON.stringify([employee.hasAccount, employee.account, contextRevision]);
  const lastContext = useRef(actorContext);
  useEffect(() => () => { guard.invalidate(); request.current?.abort(); }, [guard]);
  const resetAcknowledgements = () => { setReviewed(false); setFinalStage(false); setFinalConfirmed(false); };
  useEffect(() => {
    if (lastContext.current === actorContext) return;
    lastContext.current = actorContext;
    if (completedRef.current) return;
    setInvalid(true);
    setReviewed(false);
    setFinalStage(false);
    setFinalConfirmed(false);
    setError("تغيّرت بيانات الحساب أو السياسة. احتفظنا بالقالب والسبب؛ أعد المقارنة من الخادم قبل المراجعة والتأكيد.");
  }, [actorContext]);
  const capturedAt = resource.comparison?.capturedAt;
  const comparisonRevision = resource.comparison?.expectedComparisonRevision;
  useEffect(() => {
    if (resource.boundaryDelay === null || !capturedAt || !comparisonRevision) return;
    const timer = setTimeout(() => {
      if (completedRef.current) return;
      setInvalid(true);
      setReviewed(false);
      setFinalStage(false);
      setFinalConfirmed(false);
      setError("وصلت اللقطة إلى حدّ قرار زمني حدده الخادم. لم نغيّر الوصول في المتصفح؛ أعد المقارنة للحصول على الحالة الحالية ثم أكّد مجددًا.");
    }, Math.min(Math.max(resource.boundaryDelay, 0), 2_147_483_647));
    return () => clearTimeout(timer);
  }, [resource.boundaryDelay, capturedAt, comparisonRevision]);

  const selected = resource.catalog?.templates.find(template => employeeTemplateKey(template) === selection);
  const comparison = resource.comparison;
  const known = !!comparison && comparison.comparisonStatus === "known" && comparison.canApply
    && comparison.blockedReasons.length === 0
    && comparison.before !== null && comparison.after !== null && comparison.differences !== null
    && comparison.branchId === employee.branchId && comparison.scope.branchId === employee.branchId
    && comparison.templateId === selected?.templateId && comparison.version === selected?.version;
  const canReview = employee.hasAccount && known && !invalid && !resource.comparing && !pending && !applied
    && !!reason.trim() && reason.trim().length <= 2000;
  const canApply = canReview && reviewed && finalStage && finalConfirmed;
  const reviewReasons = [
    !employee.hasAccount ? "لا يوجد حساب مرتبط؛ التجربة لا تنشئ حسابًا." : "",
    !selected ? "اختر إصدارًا معتمدًا متاحًا أولًا." : "",
    !comparison ? resource.comparisonError || "اطلب مقارنة من الخادم قبل المراجعة." : "",
    ...(comparison?.blockedReasons.map(block => `${block.message} (${block.code})`) ?? []),
    comparison && (comparison.branchId !== employee.branchId || comparison.scope.branchId !== employee.branchId) ? "فرع المقارنة لا يطابق فرع الموظف؛ حدّث الدليل وأعد فتح النافذة." : "",
    comparison && (comparison.templateId !== selected?.templateId || comparison.version !== selected?.version) ? "المقارنة لا تطابق الإصدار المختار؛ أعد المقارنة." : "",
    comparison && (comparison.comparisonStatus !== "known" || !comparison.before || !comparison.after || !comparison.differences) ? "أدلة المقارنة غير معروفة أو غير مكتملة؛ لا يمكن إقرار المراجعة." : "",
    comparison && !comparison.canApply && !comparison.blockedReasons.length ? "الخادم لم يسمح بتطبيق هذه المقارنة." : "",
    invalid ? error || "اللقطة قديمة؛ أعد المقارنة من الخادم ثم راجعها مجددًا." : "",
    resource.comparing ? "انتظر اكتمال المقارنة الحالية." : "",
    pending ? "التنفيذ جارٍ؛ المراجعة مقفلة حتى اكتماله." : "",
    !reason.trim() ? "اكتب سبب التجربة المطلوب لسجل التدقيق." : reason.trim().length > 2000 ? "يجب ألا يتجاوز السبب 2000 حرف." : "",
  ].filter(Boolean);
  const runComparison = async (reloadCatalog = false) => {
    if (pendingRef.current || completedRef.current || !selected) return;
    const chosen = selected;
    resetAcknowledgements();
    setInvalid(false);
    setError("");
    if (reloadCatalog) await resource.loadCatalog();
    await resource.compare(chosen.templateId, chosen.version);
  };
  const verify = async (result: EmployeeTemplatePilotResult) => {
    const token = guard.capture();
    setVerification(null);
    const fresh = await resource.compare(result.assignment.templateId, result.assignment.version);
    if (guard.isCurrent(token)) setVerification(fresh);
  };
  const apply = async () => {
    if (!canApply || !comparison || !selected || pendingRef.current || completedRef.current) return;
    const token = guard.capture();
    const controller = new AbortController();
    request.current = controller;
    pendingRef.current = true;
    setPending(true);
    setError("");
    const body: EmployeeTemplatePilotInput = {
      templateId: selected.templateId, version: selected.version, branchId: comparison.branchId,
      reason: reason.trim(), expectedComparisonRevision: comparison.expectedComparisonRevision, acknowledgeChanges: true,
    };
    try {
      const result = await requestEmployeeAccount<EmployeeTemplatePilotResult>(employeeTemplatePilotEndpoint(employee.employeeId), { method: "POST", body, signal: controller.signal });
      if (!guard.isCurrent(token)) return;
      completedRef.current = true;
      setApplied(result);
      resetAcknowledgements();
      refresh();
      await verify(result);
    } catch (cause) {
      if (!guard.isCurrent(token)) return;
      setInvalid(true);
      resetAcknowledgements();
      setError(employeeTemplatePilotError(cause));
    } finally {
      if (guard.isCurrent(token)) { pendingRef.current = false; setPending(false); }
    }
  };
  const dismiss = () => {
    guard.invalidate();
    request.current?.abort();
    close();
    if (pendingRef.current) refresh();
  };
  const verifiedAssignment = !!verification && verification.assignment?.templateId === applied?.assignment.templateId
    && verification.assignment?.version === applied?.assignment.version && verification.branchId === employee.branchId;

  return <Dialog open onOpenChange={open => { if (!open) dismiss(); }}>
    <DialogContent dir="rtl" style={dialogStyle} className={`${employeeDialogShell} max-h-[94dvh] max-w-3xl`}>
      <DialogHeader className={employeeDialogHeader}><DialogTitle className="flex items-center gap-2 text-right leading-6"><ShieldCheck className="h-5 w-5 shrink-0 text-violet-700" />مقارنة وتجربة قالب · الأدمن</DialogTitle>
        <DialogDescription className="text-right">{employee.employeeName} · {employee.branchName}. مقارنة لحساب مرتبط واحد، مستقلة عن إسناد مدير العمليات.</DialogDescription></DialogHeader>
      <div className={employeeDialogBody} data-testid="employee-dialog-body">
        <p className="rounded-lg border border-violet-200 bg-violet-50/40 p-3 text-xs leading-6 text-violet-900">المقارنة قراءة فقط. التجربة تطبيق صريح على الحساب المرتبط بهذا الموظف وحده؛ لا إنشاء حسابات أو اختيار مشاركين تلقائي أو إسناد جماعي أو رجوع تلقائي إلى القالب السابق.</p>
        <details className="rounded-lg border p-3"><summary className="cursor-pointer text-xs font-bold leading-6">حدود الكتالوج والنطاق · ظهور القالب لا يسمح بتطبيقه</summary><p className="mt-2 text-xs leading-6 text-amber-900">كتالوج الأدمن يعرض كل أحدث الإصدارات المعتمدة دون تصفية بسقف تفويض العمليات؛ ظهور القالب لا يعني السماح بتطبيقه. قد يكون وصول بعض المسارات القديمة عامًا: المقارنة عند فرع الموظف لا تضمن تقييد كل إجراء بهذا الفرع. تبقى قيود الموارد والمهام والملكية مستقلة، ويعرض الخادم أسباب منع التطبيق للقوالب غير المدعومة.</p></details>
        <div className="rounded-lg border bg-muted/20 p-3"><label htmlFor="pilot-employee" className="mb-1 block text-xs font-bold">الموظف الذي اخترته · حساب مرتبط موجود</label><Input id="pilot-employee" value={employee.employeeName} readOnly className="min-h-11" /><p className="mt-2 text-xs text-muted-foreground">الفرع المحفوظ: {employee.branchName} · لا يمكن نقله من هذه التجربة.</p></div>
        {resource.catalogLoading ? <div role="status" className="space-y-3 rounded-xl border p-4"><div className="h-5 w-48 animate-pulse rounded bg-muted" /><div className="h-12 animate-pulse rounded bg-muted" /><span className="sr-only">جار التحقق من خيارات القوالب المعتمدة</span></div> : resource.catalogError ? <div role="alert" className="rounded-lg border border-destructive/30 p-3 text-xs leading-6 text-destructive">{resource.catalogError}<Button type="button" variant="outline" className="mt-2 min-h-11" onClick={() => { resetAcknowledgements(); setInvalid(true); void resource.loadCatalog(); }}>إعادة تحميل الخيارات</Button></div> : <>
          <div><label htmlFor="pilot-template" className="mb-1 block text-xs font-bold">آخر إصدار معتمد · كتالوج الأدمن</label><select id="pilot-template" value={selection} disabled={pending || !!applied} className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm" onChange={event => {
            setSelection(event.target.value); resetAcknowledgements(); setInvalid(false); setError(""); resource.clearComparison();
          }}><option value="">اختر القالب والإصدار صراحةً</option>{selection && !selected && <option value={selection}>الإصدار المختار لم يعد ضمن الخيارات الحالية · {selection}</option>}{resource.catalog?.templates.map(template => <option key={employeeTemplateKey(template)} value={employeeTemplateKey(template)}>{template.name} · الإصدار {template.version}</option>)}</select></div>
          {selected && <details className="rounded-lg border p-3" data-testid="pilot-selected-content"><summary className="min-h-11 cursor-pointer text-xs font-bold">محتوى الإصدار المعتمد · {pilotScopeLabels[selected.scopeType]} · ليس الوصول الفعّال</summary><PilotPermissionList permissions={selected.permissions} empty="محتوى هذا الإصدار المعتمد بلا إجراءات مباشرة؛ لا نفترض زوال الوصول الأصيل أو الإضافات." /><p className="mt-2 text-[11px] leading-6 text-muted-foreground">عرض المحتوى لا يمنح صلاحيات ولا يثبت دعم التجربة؛ قرار التطبيق والمقارنة الفعلية من الخادم.</p></details>}
          {!resource.catalog?.templates.length && <p className="rounded-lg border border-dashed p-4 text-xs leading-6 text-muted-foreground">لا توجد أحدث إصدارات معتمدة في كتالوج الأدمن حاليًا. هذا لا يعني أن إسناد الحساب السابق أو إضافاته أُزيلت؛ لن نختار بديلًا أو نطبّق قالبًا فارغًا تلقائيًا.</p>}
          {!applied && <div className="flex flex-wrap gap-2"><Button type="button" className="min-h-11 gap-2" disabled={!selected || resource.comparing || pending} onClick={() => { void runComparison(); }}><RefreshCw className="h-4 w-4" />{resource.comparing ? "جار المقارنة…" : invalid ? "إعادة المقارنة من الخادم" : "مقارنة الآن · قراءة فقط"}</Button><Button type="button" variant="outline" className="min-h-11" disabled={!selected || resource.comparing || pending} onClick={() => { void runComparison(true); }}>تحديث الخيارات وإعادة المقارنة</Button></div>}
        </>}
        {resource.comparing && <div role="status" className="space-y-3 rounded-lg border p-4"><div className="h-5 w-36 animate-pulse rounded bg-muted" /><div className="h-32 animate-pulse rounded bg-muted" /><span className="sr-only">{applied ? "جار قراءة الحساب فعليًا بعد التجربة" : "جار حساب المقارنة الفعلية والمتوقعة على الخادم"}</span></div>}
        {resource.comparisonError && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs leading-6 text-destructive">{resource.comparisonError}</p>}
        {!applied && comparison && <>
          {(comparison.branchId !== employee.branchId || comparison.scope.branchId !== employee.branchId) && <p role="alert" className="text-xs leading-6 text-destructive">تغيّر فرع الحساب أو الموظف. حدّث الدليل وأعد فتح المقارنة في النطاق الحالي؛ لم نوسّع الفرع أو نسمح بالتطبيق تلقائيًا.</p>}
          <EmployeeTemplatePilotComparison comparison={comparison} branchName={employee.branchName} stale={invalid} />
        </>}
        {!applied && <section className="space-y-3 rounded-xl border p-3" aria-label="مراجعة تجربة حساب واحد">
          <div><label htmlFor="pilot-reason" className="mb-1 block text-xs font-bold">سبب التجربة · مطلوب لسجل التدقيق</label><Input id="pilot-reason" value={reason} maxLength={2000} disabled={pending} onChange={event => { setReason(event.target.value); resetAcknowledgements(); }} className="min-h-11" /></div>
          <label className="flex min-h-11 items-start gap-2 text-xs leading-6"><input id="pilot-review" aria-describedby={!canReview ? "pilot-review-reasons" : undefined} type="checkbox" className="mt-1.5 h-4 w-4 shrink-0 accent-violet-700" checked={reviewed} disabled={!canReview} onChange={event => { setReviewed(event.target.checked); setFinalStage(false); setFinalConfirmed(false); }} />راجعت مقارنة الخادم الحالية والمتوقعة ومصادرها، وفرق الأساس المستقل، والإضافات والمنع والوصول الأصيل والنطاق وحدود المقارنة.</label>
          {!canReview && <div id="pilot-review-reasons" aria-live="polite" className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 text-xs leading-6 text-amber-900"><p className="font-bold">قبل إقرار المراجعة</p><ul className="list-inside list-disc">{reviewReasons.map((message, index) => <li key={index}>{message}</li>)}</ul></div>}
          {finalStage && <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
            <p className="flex items-center gap-2 text-sm font-bold text-amber-900"><AlertTriangle className="h-4 w-4" />تأكيد نهائي · لا تطبيق قبل هذه الخطوة</p>
            <p className="text-xs leading-6">{employee.employeeName} · {selected?.name} · الإصدار {selected?.version} · {employee.branchName}<br />السبب: {reason.trim()}</p>
            <label className="flex min-h-11 items-start gap-2 text-xs leading-6"><input id="pilot-final-confirm" type="checkbox" className="mt-1.5 h-4 w-4 shrink-0 accent-amber-700" checked={finalConfirmed} disabled={!canReview || !reviewed} onChange={event => setFinalConfirmed(event.target.checked)} />أؤكد تطبيق هذا الإصدار على الحساب المرتبط بهذا الموظف فقط. لا تتغير الإضافات أو الأدوار أو بيانات الموظف، ولا يوجد رجوع أو إعادة منح تلقائي.</label>
          </div>}
        </section>}
        {applied && <section className="space-y-4 rounded-xl border border-emerald-300 bg-emerald-50/30 p-3" data-testid="pilot-success">
          <h3 className="text-sm font-bold text-emerald-900">نُفّذت التجربة على الحساب المحدد</h3>
          <p className="text-xs leading-6">سجل الإسناد المحفوظ: قالب #{applied.assignment.templateId} · الإصدار {applied.assignment.version} · الفرع <bdi>{applied.assignment.branchId}</bdi><br />السبب: {applied.assignment.reason} · الوقت: {additionDateLabel(applied.assignment.assignedAt)}</p>
          <details className="rounded-lg border bg-background p-3"><summary className="min-h-11 cursor-pointer text-xs font-bold">دليل المعاملة · المصادر والفرق الذي أعاد الخادم التحقق منه</summary><EmployeeTemplatePilotComparison comparison={applied.comparison} branchName={employee.branchName} /></details>
          {verification ? <div className="space-y-3" data-testid="pilot-fresh-verification">
            <p className={`rounded-lg border p-3 text-xs leading-6 ${verifiedAssignment ? "border-emerald-200 text-emerald-900" : "border-amber-300 text-amber-900"}`}>{verifiedAssignment ? "قراءة جديدة من الخادم: قالب الحساب وإصداره وفرعه يطابقون نتيجة التجربة." : "القراءة الجديدة لا تؤكد نفس الإسناد؛ راجع الحالة الحالية. لم نُرجع الحساب تلقائيًا."}<br />وقت القراءة: {additionDateLabel(verification.capturedAt)}</p>
            <p className="text-[11px] leading-6 text-muted-foreground">المطابقة أعلاه لسجل الإسناد. الوصول الفعلي أدناه قراءة مستقلة، وقد يختلف إذا تغيّر مصدر أو انتهت مدة بعد التنفيذ؛ لا نستنتج تطابقًا أو نجري رجوعًا تلقائيًا.</p>
            {verification.assignment && <p className="text-xs leading-6">الإسناد الفعلي المقروء: قالب #{verification.assignment.templateId} · الإصدار {verification.assignment.version} · <bdi>{verification.assignment.branchId}</bdi></p>}
            <PilotAuthorityPanel title="الوصول الفعلي بعد التنفيذ · قراءة مستقلة جديدة" authority={verification.before} />
            {verification.blockedReasons.map((block, index) => <p key={index} className="text-xs leading-6 text-amber-900">{block.message} <bdi>({block.code})</bdi></p>)}
          </div> : !resource.comparing && <p role="alert" className="text-xs leading-6 text-amber-900">التطبيق نجح، لكن القراءة الجديدة لم تتأكد. لا نعيد POST أو نتراجع تلقائيًا؛ أعد قراءة الحالة الحالية فقط.</p>}
          <Button type="button" variant="outline" className="min-h-11 gap-2" disabled={resource.comparing || pending} onClick={() => { void verify(applied); }}><RefreshCw className="h-4 w-4" />إعادة قراءة الحالة الفعلية · دون تطبيق</Button>
        </section>}
        {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs leading-6 text-destructive">{error}</p>}
      </div>
      <DialogFooter className={employeeDialogFooter}>
        {!applied && (!finalStage ? <Button type="button" variant="outline" className="min-h-11 whitespace-normal" disabled={!canReview || !reviewed} onClick={() => { if (canReview && reviewed) setFinalStage(true); }}>الانتقال إلى تأكيد الحساب الواحد</Button> : <Button type="button" className="min-h-11 whitespace-normal" disabled={!canApply} onClick={apply}>{pending ? "جار تنفيذ التجربة…" : "تأكيد التطبيق على هذا الحساب وحده"}</Button>)}
        <Button type="button" variant="outline" className="min-h-11" onClick={dismiss}>إغلاق</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}