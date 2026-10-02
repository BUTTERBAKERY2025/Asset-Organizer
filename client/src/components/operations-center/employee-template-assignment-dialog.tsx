import { useEffect, useRef, useState } from "react";
import { AlertTriangle, KeyRound, RefreshCw, ShieldCheck } from "lucide-react";
import { ACTION_LABELS, MODULE_LABELS } from "@shared/schema";
import type { EmployeeAccountCreatedResponse } from "@shared/employee-account-delegation";
import type { DelegatedEmployeeAccount, EmployeeAccountsResponse } from "@/lib/employee-account-types";
import type { EmployeeTemplateCommand, EmployeeTemplateCreated } from "@/lib/employee-template-assignment";
import { employeeTemplateDiff, employeeTemplateError, employeeTemplateKey } from "@/lib/employee-template-assignment";
import { createEmployeeAccountCommandGuard, EMPLOYEE_ACCOUNTS_ENDPOINT, requestEmployeeAccount } from "@/lib/employee-account-delegation";
import { useEmployeeTemplateAssignment } from "@/hooks/use-employee-template-assignment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmployeeAccountCredentials } from "./employee-account-credentials";
import { EmployeeAccountAdditionsReadOnly } from "./employee-account-additions-list";

const moduleLabel = (module: string) => MODULE_LABELS[module as keyof typeof MODULE_LABELS] ?? module;
const actionLabel = (action: string) => ACTION_LABELS[action as keyof typeof ACTION_LABELS] ?? action;
const actionsLabel = (actions: string[]) => actions.length ? actions.map(actionLabel).join("، ") : "لا توجد صلاحيات مباشرة";
const scopeLabels = { branch: "الفرع المحدد", self: "الموظف نفسه", assigned_tasks: "مهام التوصيل المسندة" };

/** One employee, one explicit command. The browser never submits permission lists. */
export function EmployeeTemplateAssignmentDialog({ employee, mode, directory, close, refresh }: {
  employee: DelegatedEmployeeAccount;
  mode: "create" | "permissions";
  directory: EmployeeAccountsResponse;
  close: () => void;
  refresh: () => void;
}) {
  const review = useEmployeeTemplateAssignment(employee.employeeId);
  const [selection, setSelection] = useState("");
  const [branchId, setBranchId] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [invalidPreview, setInvalidPreview] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [credentials, setCredentials] = useState<EmployeeAccountCreatedResponse["credentials"] | null>(null);
  const [copied, setCopied] = useState("");
  const [handoffSaved, setHandoffSaved] = useState(false);
  const guard = useRef(createEmployeeAccountCommandGuard()).current;
  const request = useRef<AbortController | null>(null);
  const pendingRef = useRef(false);
  const creating = useRef(mode === "create").current;
  const accountState = JSON.stringify(employee.account);
  const lastAccountState = useRef(accountState);
  useEffect(() => () => { guard.invalidate(); request.current?.abort(); }, [guard]);
  useEffect(() => {
    if (lastAccountState.current === accountState) return;
    lastAccountState.current = accountState;
    if (!creating) {
      setConfirmed(false);
      setInvalidPreview(true);
      setError("تغيّرت بيانات الحساب في الدليل. احتفظنا باختيارك؛ حدّث المعاينة والقوالب وراجع الفرق ثم أكّد مجددًا.");
    }
  }, [accountState, creating]);

  const snapshot = review.data?.snapshot;
  const templates = review.data?.templates ?? [];
  const selected = templates.find(template => employeeTemplateKey(template) === selection);
  // The catalog is already server-filtered by authority, ceiling, role and job title.
  // Branch selection cannot move the employee or widen their persisted scope.
  const branches = directory.branches.filter(branch => branch.id === employee.branchId && branch.id === snapshot?.branchId);
  const allowed = employee.management?.allowed === true && directory.policy.enabled
    && (creating ? !employee.hasAccount : !!employee.account);
  const previewReady = !!selected && !!snapshot && !review.loading && !review.error && !invalidPreview
    && snapshot.employeeId === employee.employeeId && branchId === snapshot.branchId
    && branches.some(branch => branch.id === branchId);
  const canApply = allowed && previewReady && confirmed && !!reason.trim() && reason.trim().length <= 2000 && !pending && !credentials;
  const diff = selected && snapshot ? employeeTemplateDiff(snapshot.currentPermissions, selected.permissions) : [];
  const counts = diff.reduce((total, row) => ({ added: total.added + row.added.length, removed: total.removed + row.removed.length }), { added: 0, removed: 0 });

  const reload = () => {
    if (pendingRef.current) return;
    setConfirmed(false);
    setInvalidPreview(false);
    setError("");
    void review.reload();
  };
  const dismiss = () => {
    if (credentials && !handoffSaved) {
      setError("أكد حفظ بيانات الدخول بطريقة آمنة قبل إغلاق العرض الوحيد.");
      return;
    }
    guard.invalidate();
    request.current?.abort();
    setCredentials(null);
    close();
    if (pendingRef.current || credentials) refresh();
  };
  const apply = async () => {
    if (!canApply || !selected || !snapshot || pendingRef.current) return;
    pendingRef.current = true;
    const token = guard.capture();
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    setError("");
    const body: EmployeeTemplateCommand = {
      templateId: selected.templateId, version: selected.version, branchId,
      reason: reason.trim(), expectedAssignmentRevision: snapshot.expectedAssignmentRevision,
    };
    try {
      const endpoint = `${EMPLOYEE_ACCOUNTS_ENDPOINT}/${employee.employeeId}/${creating ? "template-account" : "template-assignment"}`;
      if (creating) {
        const result = await requestEmployeeAccount<EmployeeTemplateCreated>(endpoint, { method: "POST", body, signal: controller.signal });
        if (!guard.isCurrent(token)) return;
        setCredentials(result.credentials);
        // Do not let a success refetch discard the one-display secret before handoff.
        // Refresh on dismissal; independent scope/revocation checks still unmount us.
      } else {
        await requestEmployeeAccount(endpoint, { method: "POST", body, signal: controller.signal });
        if (!guard.isCurrent(token)) return;
        guard.invalidate();
        close();
        refresh();
      }
    } catch (cause) {
      if (!guard.isCurrent(token)) return;
      setConfirmed(false);
      setInvalidPreview(true);
      setError(employeeTemplateError(cause));
      // All failed writes require fresh catalog + snapshot; never retry a POST.
      // Keep the chosen employee/template/branch and reason for deliberate review.
    } finally {
      if (guard.isCurrent(token)) { pendingRef.current = false; setPending(false); }
    }
  };
  const copy = async (kind: "username" | "password") => {
    if (!credentials) return;
    const token = guard.capture();
    setCopied("");
    setError("");
    try {
      if (!window.isSecureContext || !navigator.clipboard?.writeText) throw new Error("clipboard-unavailable");
      await navigator.clipboard.writeText(credentials[kind]);
      if (guard.isCurrent(token)) setCopied(kind === "username" ? "تم نسخ اسم المستخدم." : "تم نسخ كلمة المرور.");
    } catch {
      if (guard.isCurrent(token)) setError("تعذر النسخ الآمن. انسخ القيمة المعروضة يدويًا من نافذة الحساب.");
    }
  };

  return <Dialog open onOpenChange={open => { if (!open) dismiss(); }}>
    <DialogContent dir="rtl" className="max-h-[90dvh] max-w-2xl overflow-y-auto rounded-xl [&>button]:min-h-11 [&>button]:min-w-11">
      <DialogHeader className="text-right">
        <DialogTitle className="flex items-center gap-2 text-right"><ShieldCheck className="h-5 w-5 text-violet-700" />{credentials ? "تم إنشاء الحساب وإسناد القالب" : creating ? "إنشاء حساب بقالب معتمد" : "إسناد إصدار معتمد للحساب"}</DialogTitle>
        <DialogDescription className="text-right">موظف واحد · إصدار محدد · مراجعة قبل التنفيذ. لا تتغير الأدوار الأمنية أو بيانات الموظف.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <label htmlFor="delegated-employee-name" className="mb-1 block text-xs font-bold">الموظف الذي اخترته · للقراءة فقط</label>
          <Input id="delegated-employee-name" value={employee.employeeName} readOnly className="min-h-11 bg-muted/40" />
          <p className="mt-2 text-xs text-muted-foreground">{employee.branchName}{employee.account?.username && <> · <bdi className="font-mono">{employee.account.username}</bdi></>}</p>
        </div>
        {credentials ? <>
          <p className="rounded-lg border border-violet-200 bg-violet-50/60 p-3 text-xs leading-6 text-violet-900">{selected?.name} · الإصدار {selected?.version} · {employee.branchName}</p>
          <EmployeeAccountCredentials credentials={credentials} copied={copied} saved={handoffSaved} onCopy={copy} onSaved={saved => { setHandoffSaved(saved); setError(""); }} />
        </> : <>
          <p className="text-xs leading-6 text-muted-foreground">يعرض الخادم الإصدارات المعتمدة المتاحة لهذا الموظف فقط. لا توجد صلاحيات مخصصة أو إسناد جماعي. القالب الفارغ صالح ولا يعطّل بوابة الموظف الذاتية أو يسحب صلاحيات الدور الموروثة.</p>
          <p className="text-[11px] leading-6 text-muted-foreground">لوظيفة التوصيل وصول أصيل إلى عرض وتعديل مهام التوصيل. لا يسحبه قالب فارغ؛ الخادم يعرض فقط القوالب المتوافقة معه ولا يغيّر وظيفة الموظف.</p>
          {!allowed && <p role="alert" className="text-xs leading-6 text-destructive">التفويض أو السياسة الحالية لا يسمحان بالإسناد. لا يتم تعديل الحساب أو تجاوز حمايته.</p>}
          {review.loading ? <div role="status" className="space-y-3 rounded-lg border p-4"><div className="h-5 w-36 animate-pulse rounded bg-muted" /><div className="h-20 animate-pulse rounded bg-muted" /><span className="sr-only">جار التحقق من القوالب وحالة الحساب</span></div> : review.error ? <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs leading-6 text-destructive">{review.error}</div> : <>
            {!templates.length && <div className="rounded-lg border border-dashed border-violet-200 bg-violet-50/40 p-4">
              <p className="text-sm font-bold">لا يوجد إصدار معتمد مؤهل لهذا الموظف</p>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">قد يكون الاعتماد غير متاح أو نطاق القالب أو سقف السياسة أو الدور غير متوافق. قوالب الإدارة فقط لا تظهر هنا. قالب مهام التوصيل يتطلب وظيفة توصيل محفوظة على الموظف؛ اختيار قالب لا يغيّر الوظيفة.</p>
            </div>}
            <div className="grid gap-3 md:grid-cols-[1.5fr_1fr]">
              <div><label htmlFor="approved-employee-template" className="mb-1 block text-xs font-bold">القالب والإصدار المعتمد</label>
                <select id="approved-employee-template" value={selection} disabled={pending || !allowed} className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm" onChange={event => { setSelection(event.target.value); setConfirmed(false); }}>
                  <option value="">اختر إصدارًا معتمدًا</option>
                  {selection && !selected && <option value={selection}>الإصدار المختار لم يعد متاحًا · {selection}</option>}
                  {templates.map(template => <option key={employeeTemplateKey(template)} value={employeeTemplateKey(template)}>{template.name} · الإصدار {template.version}</option>)}
                </select></div>
              <div><label htmlFor="approved-employee-branch" className="mb-1 block text-xs font-bold">الفرع المصرّح به</label>
                <select id="approved-employee-branch" value={branchId} disabled={pending || !allowed} className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm" onChange={event => { setBranchId(event.target.value); setConfirmed(false); }}>
                  <option value="">اختر الفرع</option>
                  {branchId && !branches.some(branch => branch.id === branchId) && <option value={branchId}>الفرع المختار لم يعد متاحًا</option>}
                  {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </select></div>
            </div>
            <p className="text-[11px] leading-5 text-muted-foreground">النطاق مقيد بفرع الموظف المحفوظ على الخادم. لا ينقل هذا الإجراء الموظف إلى فرع آخر.</p>
            {selection && !selected && <p role="alert" className="text-xs text-destructive">لم يعد الإصدار المختار مؤهلًا أو معتمدًا. اختر إصدارًا متاحًا وراجع فرقًا جديدًا؛ لم نغيّر اختيارك تلقائيًا.</p>}
            {snapshot?.assignment && <p className="rounded-lg border bg-muted/20 p-3 text-xs leading-6">الإسناد الحالي: قالب #{snapshot.assignment.templateId} · إصدار {snapshot.assignment.version} · {employee.branchName}. لا يعني اعتماد إصدار أحدث إعادة تطبيقه تلقائيًا.</p>}
            {selected && !invalidPreview && <section className="space-y-3 rounded-xl border border-violet-200 bg-violet-50/30 p-3" aria-label="فرق القالب الأساسي قبل وبعد">
              <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-sm font-bold text-violet-900">{selected.name} · الإصدار {selected.version}</h3><p className="mt-1 text-[11px] text-muted-foreground">نطاق المحتوى: {scopeLabels[selected.scopeType]} · فرع التنفيذ: {branches.find(branch => branch.id === branchId)?.name ?? "لم يُختر بعد"}</p></div>
                <p className="text-xs"><span className="text-emerald-800">إضافة {counts.added}</span> · <span className="text-amber-800">إزالة {counts.removed}</span></p></div>
              <div className="grid grid-cols-2 gap-3 border-b border-violet-200 pb-2 text-xs font-bold"><span>قبل · صلاحيات الأساس الحالية</span><span>بعد · محتوى القالب الأساسي المعتمد</span></div>
              {!diff.length ? <p className="text-xs leading-6">لا توجد صلاحيات تشغيلية مباشرة قبل الإسناد أو بعده. بوابة الموظف الذاتية مستقلة عن هذا القالب.</p> : diff.map(row => <div key={row.module} className="rounded-lg border border-violet-100 bg-background p-3">
                <h4 className="mb-2 text-xs font-bold">{moduleLabel(row.module)}</h4>
                <div className="grid grid-cols-2 gap-3 text-xs leading-6"><p>{actionsLabel(row.before)}</p><p>{actionsLabel(row.after)}</p></div>
                {(row.added.length > 0 || row.removed.length > 0) && <p className="mt-2 border-t pt-2 text-[11px] leading-6">{row.added.length > 0 && <span className="block text-emerald-800">سيُضاف: {actionsLabel(row.added)}</span>}{row.removed.length > 0 && <span className="block text-amber-800">سيُزال: {actionsLabel(row.removed)}</span>}</p>}
              </div>)}
              <p className="text-[11px] leading-6 text-muted-foreground">هذا فرق الأساس فقط. يستبدل الإسناد صلاحيات الأساس ولا يدمج الإضافات أو يغيّر منحها ومنعها ومددها. الاستثناءات القديمة أو المتغيرة والإضافات خارج السقف وإسنادات النظام القديم والأدوار غير المدعومة تُبقي الحساب محميًا؛ الخادم يقرر الأهلية.</p>
            </section>}
            {snapshot && !invalidPreview && <EmployeeAccountAdditionsReadOnly additions={snapshot.additions} branchName={employee.branchName} />}
            {employee.account?.isActive === "inactive" && <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-900"><AlertTriangle className="mt-1 h-4 w-4 shrink-0" />الحساب مجمّد. إسناد القالب لا يعيد فتحه أو يولّد كلمة مرور جديدة؛ إعادة الفتح إجراء مستقل.</p>}
            <div><label htmlFor="employee-template-reason" className="mb-1 block text-xs font-bold">سبب الإسناد · مطلوب لسجل المراجعة</label><Input id="employee-template-reason" maxLength={2000} value={reason} disabled={pending} onChange={event => { setReason(event.target.value); setConfirmed(false); }} className="min-h-11" placeholder="مثال: اعتماد مهام الموظف في الفرع" /></div>
            <label className={`flex min-h-11 items-start gap-2 rounded-lg border p-3 text-xs leading-6 ${previewReady ? "border-violet-200 bg-violet-50/40" : "text-muted-foreground"}`}>
              <input id="employee-template-confirm" type="checkbox" className="mt-1.5 h-4 w-4 shrink-0 accent-violet-700" checked={confirmed} disabled={!previewReady || pending} onChange={event => setConfirmed(event.target.checked)} />
              راجعت الموظف والقالب والإصدار والفرع وفرق الأساس قبل وبعد والإضافات المستقلة التي تبقى محفوظة، وأؤكد تطبيق تغيير الأساس على حساب هذا الموظف فقط.
            </label>
          </>}
          <Button type="button" variant="outline" className="min-h-11 gap-2" disabled={pending || review.loading} onClick={reload}><RefreshCw className="h-4 w-4" />{invalidPreview ? "تحديث المعاينة والقوالب وإعادة المراجعة" : review.error ? "إعادة المحاولة" : "تحديث المعاينة والقوالب"}</Button>
        </>}
        {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs leading-6 text-destructive">{error}</p>}
      </div>
      <DialogFooter className="gap-2 sm:gap-2">
        {!credentials && <Button type="button" className="min-h-11 gap-2" disabled={!canApply} onClick={apply}><KeyRound className="h-4 w-4" />{pending ? "جار التنفيذ…" : creating ? "تأكيد الإسناد وتوليد الحساب" : "تأكيد إسناد الإصدار"}</Button>}
        <Button type="button" variant="outline" className="min-h-11" disabled={!!credentials && !handoffSaved} onClick={dismiss}>{credentials ? "حفظت البيانات · إغلاق" : "إلغاء"}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}