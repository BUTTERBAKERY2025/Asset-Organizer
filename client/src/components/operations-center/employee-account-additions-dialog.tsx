import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Pencil, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import type { DelegatedEmployeeAccount } from "@/lib/employee-account-types";
import type { EmployeeAccountAddition, EmployeeAccountAdditionInput, EmployeeAdditionDraft } from "@/lib/employee-account-additions";
import { additionDateInput, additionDateISO, additionDateMilliseconds, emptyEmployeeAdditionDraft, employeeAdditionError } from "@/lib/employee-account-additions";
import { createEmployeeAccountCommandGuard, requestEmployeeAccount } from "@/lib/employee-account-delegation";
import { employeeAdditionsEndpoint, useEmployeeAccountAdditions } from "@/hooks/use-employee-account-additions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmployeeAccountAdditionDetails, additionActionLabel, additionModuleLabel } from "./employee-account-additions-list";

/** Guard before mounting the resource hook: manager renders never call admin APIs. */
export function EmployeeAccountAdditionsDialog(props: {
  actorRole: string;
  employee: DelegatedEmployeeAccount;
  close: () => void;
  refresh: () => void;
}) {
  if (props.actorRole !== "admin") return <p role="alert" dir="rtl">إدارة الإضافات المستقلة متاحة للأدمن فقط.</p>;
  return <AdminEmployeeAccountAdditionsDialog {...props} />;
}

function AdminEmployeeAccountAdditionsDialog({ employee, close, refresh }: {
  employee: DelegatedEmployeeAccount;
  close: () => void;
  refresh: () => void;
}) {
  const resource = useEmployeeAccountAdditions(employee.employeeId);
  const [mode, setMode] = useState<"create" | "edit" | "delete" | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<EmployeeAdditionDraft>(emptyEmployeeAdditionDraft);
  const [confirmed, setConfirmed] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const guard = useRef(createEmployeeAccountCommandGuard()).current;
  const request = useRef<AbortController | null>(null);
  const pendingRef = useRef(false);
  useEffect(() => () => { guard.invalidate(); request.current?.abort(); }, [guard]);
  const data = resource.data;
  const selected = data?.additions.find(row => row.id === selectedId);
  const modules = draft.scopeType === "branch" ? data?.capabilities.branchModules ?? [] : draft.scopeType === "global" ? data?.capabilities.globalModules ?? [] : [];
  const actions = modules.find(row => row.module === draft.module)?.actions ?? [];
  const start = draft.startsAt ? additionDateMilliseconds(draft.startsAt) : null;
  const end = draft.endsAt ? additionDateMilliseconds(draft.endsAt) : null;
  const datesValid = (start === null || Number.isFinite(start)) && (end === null || Number.isFinite(end))
    && (start === null || end === null || end > start);
  const canSubmit = employee.hasAccount && !!mode && !!data && data.employeeId === employee.employeeId && data.branchId === employee.branchId
    && !resource.loading && !resource.error && !invalid && !pending && confirmed
    && !!draft.reason.trim() && draft.reason.trim().length <= 2000
    && (mode === "create" || !!selected)
    && (mode === "delete" || (!!draft.effect && !!draft.scopeType && actions.includes(draft.action) && datesValid));

  const update = <K extends keyof EmployeeAdditionDraft>(key: K, value: EmployeeAdditionDraft[K]) => {
    setDraft(previous => ({ ...previous, [key]: value }));
    setConfirmed(false);
    setSuccess("");
  };
  const open = (nextMode: "create" | "edit" | "delete", row?: EmployeeAccountAddition) => {
    if (pendingRef.current) return;
    setMode(nextMode);
    setSelectedId(row?.id ?? null);
    setConfirmed(false);
    setError("");
    setSuccess("");
    setDraft(row ? {
      module: row.module, action: row.action, effect: row.allow ? "allow" : "deny", scopeType: row.scopeType,
      startsAt: additionDateInput(row.startsAt), endsAt: additionDateInput(row.endsAt), reason: nextMode === "delete" ? "" : row.reason,
    } : emptyEmployeeAdditionDraft());
  };
  const cancelForm = () => {
    if (pendingRef.current) return;
    setMode(null);
    setSelectedId(null);
    setDraft(emptyEmployeeAdditionDraft());
    setConfirmed(false);
    setError("");
  };
  const reload = () => {
    if (pendingRef.current) return;
    setConfirmed(false);
    setInvalid(false);
    setError("");
    setSuccess("");
    void resource.reload();
  };
  const dismiss = () => {
    guard.invalidate();
    request.current?.abort();
    close();
    if (pendingRef.current) refresh();
  };
  const submit = async () => {
    if (!canSubmit || !mode || !data || pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setError("");
    setSuccess("");
    const token = guard.capture();
    const controller = new AbortController();
    request.current = controller;
    const endpoint = employeeAdditionsEndpoint(employee.employeeId);
    try {
      if (mode === "delete") {
        if (!selected) return;
        await requestEmployeeAccount<{ deleted: true; id: number }>(`${endpoint}/${selected.id}`, {
          method: "DELETE", body: { reason: draft.reason.trim(), expectedRevision: selected.revision }, signal: controller.signal,
        });
        if (!guard.isCurrent(token)) return;
        resource.setData(previous => previous ? { ...previous, additions: previous.additions.filter(row => row.id !== selected.id) } : previous);
        setSuccess("تم حذف الإضافة المحددة وحدها؛ لم يتغير القالب الأساسي أو أي استثناء قديم.");
      } else {
        const body: EmployeeAccountAdditionInput = {
          module: draft.module, action: draft.action, allow: draft.effect === "allow",
          scopeType: draft.scopeType as "global" | "branch",
          branchId: draft.scopeType === "branch" ? data.branchId : null,
          startsAt: additionDateISO(draft.startsAt), endsAt: additionDateISO(draft.endsAt), reason: draft.reason.trim(),
        };
        const result = await requestEmployeeAccount<{ addition: EmployeeAccountAddition }>(mode === "edit" ? `${endpoint}/${selected!.id}` : endpoint, {
          method: mode === "edit" ? "PATCH" : "POST",
          body: mode === "edit" ? { ...body, expectedRevision: selected!.revision } : body, signal: controller.signal,
        });
        if (!guard.isCurrent(token)) return;
        resource.setData(previous => previous ? {
          ...previous, additions: mode === "edit" ? previous.additions.map(row => row.id === result.addition.id ? result.addition : row) : [...previous.additions, result.addition],
        } : previous);
        setSuccess(mode === "edit" ? "تم تعديل الإضافة المحددة وحدها؛ بقي القالب الأساسي دون تغيير." : "تم حفظ إضافة مستقلة لهذا الموظف فقط؛ بقي القالب الأساسي دون تغيير.");
      }
      setMode(null);
      setSelectedId(null);
      setDraft(emptyEmployeeAdditionDraft());
      setConfirmed(false);
      refresh();
    } catch (cause) {
      if (!guard.isCurrent(token)) return;
      setError(employeeAdditionError(cause));
      setInvalid(true);
      setConfirmed(false);
    } finally {
      if (guard.isCurrent(token)) { pendingRef.current = false; setPending(false); }
    }
  };

  return <Dialog open onOpenChange={open => { if (!open) dismiss(); }}>
    <DialogContent dir="rtl" className="max-h-[90dvh] max-w-2xl overflow-y-auto rounded-xl [&>button]:min-h-11 [&>button]:min-w-11">
      <DialogHeader className="text-right"><DialogTitle className="flex items-center gap-2 text-right"><ShieldCheck className="h-5 w-5 text-amber-700" />إضافات مستقلة · إدارة الأدمن</DialogTitle>
        <DialogDescription className="text-right">{employee.employeeName} · {employee.branchName}. المنح والمنع مستقلان عن القالب الأساسي؛ لا يغيّر هذا المحرر بيانات الموظف أو ربط حسابه.</DialogDescription></DialogHeader>
      <div className="space-y-4">
        <p className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs leading-6 text-amber-900">لا يُنشأ أي استثناء تلقائيًا. لا تعرض هذه الشاشة الاستثناءات القديمة كسجلات مُدارة ولا تتبناها أو تحذفها. الإضافات الإدارية أو غير المعتمدة للتشغيل تُبقي الحساب محميًا من مدير العمليات. تغيير القالب لا يزيل هذه الإضافات.</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" className="min-h-11 gap-2" onClick={() => open("create")} disabled={!data || resource.loading || pending || invalid}><Plus className="h-4 w-4" />إضافة مستقلة جديدة</Button>
          <Button type="button" variant="outline" className="min-h-11 gap-2" onClick={reload} disabled={resource.loading || pending}><RefreshCw className="h-4 w-4" />{invalid ? "تحديث السجل وإعادة المراجعة" : resource.error ? "إعادة المحاولة" : "تحديث السجل"}</Button>
        </div>
        {resource.loading ? <div role="status" className="space-y-3 rounded-lg border p-4"><div className="h-5 w-40 animate-pulse rounded bg-muted" /><div className="h-24 animate-pulse rounded bg-muted" /><span className="sr-only">جار التحقق من الإضافات وملكية الحساب</span></div> : resource.error ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs leading-6 text-destructive">{resource.error}</p> : data && <>
          {data.branchId !== employee.branchId && <p role="alert" className="text-xs text-destructive">تغيّر فرع الموظف. أغلق الشاشة وحدّث الدليل؛ لم نوسّع النطاق تلقائيًا.</p>}
          {!data.additions.length ? <div className="rounded-lg border border-dashed p-4 text-xs leading-6 text-muted-foreground">لا توجد إضافات مُدارة لهذا الموظف. الحساب قد يحتوي استثناءات قديمة لا يمكن تعديلها من هذا المسار.</div> : <div className="space-y-2">{data.additions.map(row => <article key={row.id} className="rounded-lg border bg-muted/20 p-3" data-testid={`managed-addition-${row.id}`}>
            <EmployeeAccountAdditionDetails addition={row} branchName={employee.branchName} />
            <div className="mt-3 flex flex-wrap gap-2"><Button type="button" variant="outline" className="min-h-11 gap-2" onClick={() => open("edit", row)} disabled={pending || invalid}><Pencil className="h-4 w-4" />تعديل الإضافة</Button><Button type="button" variant="outline" className="min-h-11 gap-2 text-destructive" onClick={() => open("delete", row)} disabled={pending || invalid}><Trash2 className="h-4 w-4" />حذف الإضافة</Button></div>
          </article>)}</div>}
          {mode && <section className="space-y-3 rounded-xl border border-amber-300 bg-amber-50/30 p-3" aria-label="تأكيد تعديل الإضافات">
            <h3 className="text-sm font-bold">{mode === "create" ? "إضافة سجل جديد" : mode === "edit" ? "مراجعة تعديل الإضافة" : "مراجعة حذف الإضافة"}</h3>
            {mode !== "create" && !selected && <p role="alert" className="text-xs text-destructive">الإضافة المختارة لم تعد موجودة على هذا الحساب. لم نحول التعديل إلى إنشاء تلقائي.</p>}
            {selected && <div className="rounded-lg border bg-background p-3"><p className="mb-2 text-[11px] font-bold text-muted-foreground">المحتوى الحالي على الخادم · قبل التغيير</p><EmployeeAccountAdditionDetails addition={selected} branchName={employee.branchName} /></div>}
            {selected?.integrity === "changed" && mode === "edit" && <p className="text-xs leading-6 text-amber-900">هذا السجل تغيّر خارج الإدارة. الحفظ الصريح يُصلح السجل المُدار المملوك لهذا الموظف بعد مراجعة محتواه الحالي، ولا يتبنى سجلات قديمة أخرى.</p>}
            {mode !== "delete" && <>
              <div className="grid gap-3 md:grid-cols-2">
                <div><label htmlFor="addition-scope" className="mb-1 block text-xs font-bold">النطاق · اختيار صريح</label><select id="addition-scope" value={draft.scopeType} disabled={pending} className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm" onChange={event => { setDraft(previous => ({ ...previous, scopeType: event.target.value as EmployeeAdditionDraft["scopeType"], module: "", action: "" })); setConfirmed(false); }}>
                  <option value="">اختر نطاقًا مدعومًا</option><option value="global">{data.capabilities.globalScopeLabel}</option><option value="branch">فرع الموظف الحالي · {employee.branchName}</option></select></div>
                <div><label htmlFor="addition-effect" className="mb-1 block text-xs font-bold">الأثر · منح أو منع</label><select id="addition-effect" value={draft.effect} disabled={pending} className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm" onChange={event => update("effect", event.target.value as EmployeeAdditionDraft["effect"])}><option value="">اختر الأثر</option><option value="allow">منح مستقل</option><option value="deny">منع مستقل</option></select></div>
                <div><label htmlFor="addition-module" className="mb-1 block text-xs font-bold">الوحدة المتاحة لهذا النطاق</label><select id="addition-module" value={draft.module} disabled={pending || !draft.scopeType} className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm" onChange={event => { setDraft(previous => ({ ...previous, module: event.target.value, action: "" })); setConfirmed(false); }}><option value="">اختر الوحدة</option>{draft.module && !modules.some(row => row.module === draft.module) && <option value={draft.module}>الوحدة الحالية غير متاحة · {additionModuleLabel(draft.module)}</option>}{modules.map(row => <option key={row.module} value={row.module}>{additionModuleLabel(row.module)}</option>)}</select></div>
                <div><label htmlFor="addition-action" className="mb-1 block text-xs font-bold">الإجراء المحدد</label><select id="addition-action" value={draft.action} disabled={pending || !draft.module} className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm" onChange={event => update("action", event.target.value)}><option value="">اختر الإجراء</option>{draft.action && !actions.includes(draft.action) && <option value={draft.action}>الإجراء الحالي غير متاح · {additionActionLabel(draft.action)}</option>}{actions.map(action => <option key={action} value={action}>{additionActionLabel(action)}</option>)}</select></div>
              </div>
              {draft.scopeType === "global" && <p role="note" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs leading-6 text-rose-900"><AlertTriangle className="mt-1 h-4 w-4 shrink-0" />النطاق عام فعلًا، وليس مقيدًا بفرع الموظف. قد يمنح أو يمنع إجراءات إدارية. هذا لا يتجاوز قيود المسارات والأدوار وملكية الموارد، وقد يجعل الحساب محميًا من إدارة التشغيل.</p>}
              {draft.scopeType === "branch" && <p className="rounded-lg border bg-background p-3 text-xs leading-6">الفرع: {employee.branchName} · يُحسم من ربط الموظف الحالي على الخادم. نطاق الفرع متاح فقط لوحدات المستندات والتقييمات التي تدعم التحقق السياقي؛ لا يحوّل إجراءً عامًا إلى إجراء مقيد تلقائيًا.</p>}
              <p className="text-[11px] leading-6 text-muted-foreground">غير مدعوم: قسم أو موظف ذاتي أو مهام مسندة. القائمة أعلاه من قدرات الخادم، وليست قائمة القالب الأساسي.</p>
              <div className="grid gap-3 md:grid-cols-2"><div><label htmlFor="addition-starts" className="mb-1 block text-xs font-bold">بداية اختيارية · توقيت السعودية UTC+03:00</label><Input id="addition-starts" dir="ltr" type="datetime-local" step={0.001} value={draft.startsAt} disabled={pending} onChange={event => update("startsAt", event.target.value)} className="min-h-11" /></div>
                <div><label htmlFor="addition-ends" className="mb-1 block text-xs font-bold">نهاية اختيارية · توقيت السعودية UTC+03:00</label><Input id="addition-ends" dir="ltr" type="datetime-local" step={0.001} value={draft.endsAt} disabled={pending} onChange={event => update("endsAt", event.target.value)} className="min-h-11" /></div></div>
              <p className="text-[11px] leading-6 text-muted-foreground">ترك التاريخ فارغًا يعني بلا حد. البداية مشمولة والنهاية غير مشمولة. يمكن حفظ سجل مستقبلي أو منتهٍ صراحةً دون تفعيله خارج مدته.</p>
              {!datesValid && <p role="alert" className="text-xs text-destructive">يجب أن تكون النهاية بعد البداية، والتواريخ صالحة.</p>}
            </>}
            <div><label htmlFor="addition-reason" className="mb-1 block text-xs font-bold">{mode === "delete" ? "سبب حذف هذه الإضافة · مطلوب" : "سبب الإضافة أو التعديل · مطلوب"}</label><Input id="addition-reason" maxLength={2000} value={draft.reason} disabled={pending} onChange={event => update("reason", event.target.value)} className="min-h-11" /></div>
            <label className="flex min-h-11 items-start gap-2 rounded-lg border border-amber-200 bg-background p-3 text-xs leading-6"><input id="addition-confirm" type="checkbox" className="mt-1.5 h-4 w-4 shrink-0 accent-amber-700" checked={confirmed} disabled={pending || invalid || (mode !== "create" && !selected)} onChange={event => setConfirmed(event.target.checked)} />
              {mode === "delete" ? "راجعت السجل الحالي وسبب الحذف، وأؤكد حذف هذه الإضافة وحدها دون تغيير القالب أو الاستثناءات الأخرى." : `راجعت الموظف والإجراء والأثر والنطاق والتواريخ والسبب، وأؤكد ${mode === "create" ? "إضافة هذا السجل وحده" : "استبدال محتوى هذه الإضافة وحدها"}. ${draft.scopeType === "global" ? "أقر بأن النطاق عام وليس مقيدًا بالفرع." : "الفرع هو فرع الموظف الحالي."}`}</label>
            <div className="flex flex-wrap gap-2"><Button type="button" variant={mode === "delete" ? "destructive" : "default"} className="min-h-11" disabled={!canSubmit} onClick={submit}>{pending ? "جار الحفظ…" : mode === "create" ? "تأكيد إنشاء الإضافة" : mode === "edit" ? "تأكيد حفظ التعديل" : "تأكيد حذف الإضافة"}</Button><Button type="button" variant="outline" className="min-h-11" disabled={pending} onClick={cancelForm}>إلغاء التعديل</Button></div>
          </section>}
        </>}
        {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs leading-6 text-destructive">{error}</p>}
        {success && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs leading-6 text-emerald-900">{success}</p>}
      </div>
      <DialogFooter><Button type="button" variant="outline" className="min-h-11" onClick={dismiss}>إغلاق</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}