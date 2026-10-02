import { useEffect, useRef, useState } from "react";
import { Copy, KeyRound, Loader2, Lock, ShieldCheck, Unlock } from "lucide-react";
import type { DelegatedPermission, EmployeeAccountCreatedResponse } from "@shared/employee-account-delegation";
import type { DelegatedEmployeeAccount, EmployeeAccountsResponse } from "@/lib/employee-account-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmployeeAccountPermissions } from "./employee-account-permissions";
import { constrainDelegatedPermissions, createEmployeeAccountCommandGuard, EMPLOYEE_ACCOUNTS_ENDPOINT, employeeAccountErrorMessage, hasMissingViewPermission, hasUnapprovedPermissions, requestEmployeeAccount } from "@/lib/employee-account-delegation";

export type EmployeeAccountDialogMode = "create" | "permissions" | "freeze" | "reopen";

/** Mounted only for one actor/scope/employee. Secrets live only in this dialog. */
export function EmployeeAccountDialog({ employee, mode, directory, close, refresh }: {
  employee: DelegatedEmployeeAccount;
  mode: EmployeeAccountDialogMode;
  directory: EmployeeAccountsResponse;
  close: () => void;
  refresh: () => void;
}) {
  // Admin gets the full safe catalog for the policy editor, but account grants
  // still use only the approved allowlist, exactly like an operations manager.
  const approved = constrainDelegatedPermissions(directory.availablePermissions, directory.policy.permissions);
  const reductionOnly = mode === "permissions" && (!directory.policy.enabled || hasUnapprovedPermissions(employee.account?.permissions ?? [], approved));
  const available = reductionOnly ? constrainDelegatedPermissions(employee.account?.permissions ?? [], approved) : approved;
  const [permissions, setPermissions] = useState<DelegatedPermission[]>(() =>
    constrainDelegatedPermissions(employee.account?.permissions ?? [], available));
  const [template, setTemplate] = useState("custom");
  const [credentials, setCredentials] = useState<EmployeeAccountCreatedResponse["credentials"] | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [completed, setCompleted] = useState(false);
  const [handoffSaved, setHandoffSaved] = useState(false);
  const guard = useRef(createEmployeeAccountCommandGuard()).current;
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => {
    guard.invalidate();
    request.current?.abort();
  }, [guard]);
  const dismiss = () => {
    if (credentials && !handoffSaved) {
      setError("أكد حفظ بيانات الدخول بطريقة آمنة قبل إغلاق العرض الوحيد.");
      return;
    }
    guard.invalidate();
    request.current?.abort();
    setCredentials(null);
    close();
    // A closed/aborted POST may have committed; only GET can confirm that.
    if (pending) refresh();
  };
  const canGrant = directory.policy.enabled && approved.length > 0;
  const selectedPermissions = constrainDelegatedPermissions(permissions, available);
  const missingView = hasMissingViewPermission(selectedPermissions);
  const emptyNewGrant = mode === "create" && selectedPermissions.length === 0;
  const statusMode = mode === "freeze" || mode === "reopen";
  const actionAllowed = employee.management?.allowed === true && (mode === "create" ? !employee.hasAccount : !!employee.account);
  const title = mode === "create" ? "إنشاء حساب موظف" : mode === "permissions" ? "تعديل صلاحيات الحساب" : mode === "freeze" ? "تجميد حساب الموظف" : "إعادة فتح حساب الموظف";
  const act = async () => {
    if (pending || completed) return;
    if (!actionAllowed) {
      setError("لم تعد إدارة حساب هذا الموظف متاحة. حدّث الدليل للتحقق من التفويض.");
      return;
    }
    if (!statusMode && (missingView || emptyNewGrant || (mode === "create" && !canGrant))) {
      setError(emptyNewGrant ? "اختر صلاحية واحدة على الأقل قبل إنشاء الحساب." : "كل إجراء يتطلب صلاحية العرض المعتمدة للوحدة نفسها.");
      return;
    }
    const token = guard.capture();
    const controller = new AbortController();
    request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 30_000);
    setError("");
    setPending(true);
    try {
      const endpoint = `${EMPLOYEE_ACCOUNTS_ENDPOINT}/${employee.employeeId}`;
      if (mode === "create") {
        const result = await requestEmployeeAccount<EmployeeAccountCreatedResponse>(endpoint, {
          method: "POST", body: { permissions: constrainDelegatedPermissions(permissions, available) }, signal: controller.signal,
        });
        if (!guard.isCurrent(token)) return;
        setCredentials(result.credentials);
        setCompleted(true);
        refresh();
      } else {
        await requestEmployeeAccount<{ employee: DelegatedEmployeeAccount }>(
          `${endpoint}/${statusMode ? "status" : "permissions"}`, {
            method: statusMode ? "PATCH" : "PUT",
            body: statusMode ? { isActive: mode === "freeze" ? "inactive" : "active" } : { permissions: constrainDelegatedPermissions(permissions, available) },
            signal: controller.signal,
          });
        if (!guard.isCurrent(token)) return;
        refresh();
        guard.invalidate();
        close();
      }
    } catch (cause) {
      if (!guard.isCurrent(token)) return;
      setError(employeeAccountErrorMessage(cause));
      refresh();
    } finally {
      clearTimeout(timeout);
      if (guard.isCurrent(token)) setPending(false);
    }
  };
  const copy = async (kind: "username" | "password") => {
    if (!credentials) return;
    const token = guard.capture();
    setCopied("");
    setError("");
    try {
      if (!window.isSecureContext || !navigator.clipboard?.writeText)
        throw new Error("clipboard-unavailable");
      await navigator.clipboard.writeText(credentials[kind]);
      if (guard.isCurrent(token)) setCopied(kind === "username" ? "تم نسخ اسم المستخدم." : "تم نسخ كلمة المرور.");
    } catch {
      if (guard.isCurrent(token)) setError("تعذر النسخ الآمن. انسخ القيمة المعروضة يدويًا من نافذة الحساب.");
    }
  };
  return <Dialog open onOpenChange={open => { if (!open) dismiss(); }}>
    <DialogContent dir="rtl" className="max-h-[90dvh] max-w-lg overflow-y-auto rounded-xl [&>button]:min-h-11 [&>button]:min-w-11">
      <DialogHeader className="text-right"><DialogTitle className="flex items-center gap-2 text-right"><KeyRound className="h-5 w-5 text-violet-700" />{credentials ? "تم إنشاء الحساب" : title}</DialogTitle>
        <DialogDescription className="text-right">{employee.branchName} · حساب مرتبط بموظف موجود، دون تغيير بياناته.</DialogDescription></DialogHeader>
      <div className="space-y-4">
        <div><label htmlFor="delegated-employee-name" className="mb-1 block text-xs font-bold">اسم الموظف · للقراءة فقط</label>
          <Input id="delegated-employee-name" value={employee.employeeName} readOnly className="min-h-11 bg-muted/40" /></div>
        {credentials ? <section className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
          <p className="flex items-center gap-2 text-sm font-bold text-emerald-800"><ShieldCheck className="h-4 w-4" />حساب جاهز للتسليم للموظف</p>
          <p className="text-xs leading-6 text-emerald-900">تظهر بيانات الدخول مرة واحدة فقط. احفظها بطريقة آمنة قبل الإغلاق؛ لن يمكن عرض كلمة المرور مجددًا. لا تشاركها إلا مع الموظف المعني.</p>
          {(["username", "password"] as const).map(kind => <div key={kind}>
            <p className="mb-1 text-xs font-bold">{kind === "username" ? "اسم المستخدم المولّد" : "كلمة المرور القوية المولّدة"}</p>
            <div className="flex items-center gap-2 rounded-lg border bg-white px-3">
              <code dir="ltr" className="min-w-0 flex-1 select-text break-all py-3 text-left text-sm" data-testid={`generated-${kind}`}>{credentials[kind]}</code>
              <Button type="button" variant="ghost" size="icon" className="min-h-11 min-w-11" onClick={() => copy(kind)} aria-label={kind === "username" ? "نسخ اسم المستخدم" : "نسخ كلمة المرور"}><Copy className="h-4 w-4" /></Button>
            </div>
          </div>)}
          {copied && <p role="status" className="text-xs text-emerald-800">{copied}</p>}
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs font-bold text-emerald-900">
            <input type="checkbox" className="h-4 w-4 accent-emerald-700" checked={handoffSaved} onChange={event => { setHandoffSaved(event.target.checked); setError(""); }} />
            حفظت بيانات الدخول بطريقة آمنة لتسليمها للموظف المعني
          </label>
        </section> : statusMode ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-7">
          <p className="font-bold">{mode === "freeze" ? "هل تؤكد تجميد الحساب؟" : "هل تؤكد إعادة فتح الحساب؟"}</p>
          <p>{mode === "freeze" ? "سيتوقف دخول الموظف بهذا الحساب، دون حذف الموظف أو حسابه. يمكنك إعادة فتحه لاحقًا إذا استوفى شروط التفويض." : "سيتمكن الموظف من تسجيل الدخول مجددًا بصلاحيات الحساب المعتمدة. لن يتم توليد كلمة مرور جديدة."}</p>
          {mode === "reopen" && !employee.account?.canReactivate && <p role="alert" className="text-destructive">هذا الحساب غير مؤهل لإعادة الفتح. راجع السياسة وصلاحيات الحساب أولًا.</p>}
        </div> : <>
          {mode === "create" && <p className="rounded-lg border border-violet-200 bg-violet-50/60 p-3 text-xs leading-6 text-violet-900">يولّد الخادم اسم مستخدم من 8 أحرف وكلمة مرور من 12 حرفًا تضم أحرفًا كبيرة وصغيرة وأرقامًا دون رموز ملتبسة، عند الإنشاء الفعلي فقط. بيانات الدخول غير قابلة للتعديل، وتظهر كلمة المرور مرة واحدة للتسليم الآمن.</p>}
          {mode === "create" && !canGrant && <p role="alert" className="text-xs text-destructive">التفويض غير مفعّل أو لا توجد صلاحيات معتمدة. تواصل مع مدير النظام.</p>}
          {reductionOnly && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-900">التعديل هنا للتخفيض فقط، دون إضافة صلاحيات جديدة. يمكنك الاحتفاظ بالصلاحيات الحالية الواقعة ضمن القائمة المعتمدة أو إزالة بعضها. حفظ قائمة فارغة يسحب جميع الصلاحيات المباشرة؛ لإيقاف الدخول تمامًا جمّد الحساب. تعطيل السياسة لا يسحب تلقائيًا وصول الحسابات الحالية.</p>}
          {hasUnapprovedPermissions(employee.account?.permissions ?? [], approved) && <p className="text-xs leading-6 text-amber-800">توجد صلاحيات سابقة خارج القائمة الحالية. سيزيل الحفظ تلك الصلاحيات، وسيقتصر على الصلاحيات الحالية المعتمدة المختارة أدناه.</p>}
          {!reductionOnly && <div><label htmlFor="delegated-template" className="mb-1 block text-xs font-bold">القالب الوظيفي</label>
            <select id="delegated-template" className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm" disabled={pending || !canGrant} value={template} onChange={event => {
              const id = event.target.value;
              setTemplate(id);
              if (id !== "custom") setPermissions(constrainDelegatedPermissions(directory.templates.find(row => row.id === id)?.permissions ?? [], available));
            }}>
              <option value="custom">صلاحيات مخصصة</option>
              {directory.templates.filter(row => constrainDelegatedPermissions(row.permissions, available).length > 0).map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
            </select></div>}
          <EmployeeAccountPermissions available={available} selected={permissions} onChange={next => { setTemplate("custom"); setPermissions(next); }} disabled={pending || (mode === "create" && !canGrant)}
            legend={reductionOnly ? "صلاحيات حالية يمكن الاحتفاظ بها" : undefined}
            emptyMessage={mode === "permissions" ? "لا توجد صلاحيات حالية ضمن القائمة المعتمدة. يمكنك حفظ القائمة الفارغة لسحب جميع الصلاحيات المباشرة من الحساب." : undefined} />
          {emptyNewGrant && canGrant && <p className="text-xs text-muted-foreground">اختر قالبًا أو صلاحية واحدة على الأقل؛ لا يُنشأ حساب جديد دون صلاحيات.</p>}
          {missingView && <p role="alert" className="text-xs text-destructive">تتطلب الإجراءات المختارة صلاحية العرض المعتمدة للوحدة نفسها. أضف العرض إن كان متاحًا، أو أزل إجراءات الوحدة قبل الحفظ.</p>}
          <p className="text-[11px] leading-5 text-muted-foreground">القوالب والصلاحيات محصورة بما اعتمده مدير النظام. لا تمنح هذه الصفحة إدارة المستخدمين أو صلاحيات إدارية عامة.</p>
        </>}
        {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs leading-6 text-destructive">{error}</p>}
      </div>
      <DialogFooter className="gap-2 sm:gap-2">
        {!credentials && <Button type="button" className="min-h-11 gap-2" variant={mode === "freeze" ? "destructive" : "default"} disabled={!actionAllowed || pending || completed || (statusMode ? mode === "reopen" && (!canGrant || !employee.account?.canReactivate) : missingView || emptyNewGrant || (mode === "create" && !canGrant))} onClick={act}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "freeze" ? <Lock className="h-4 w-4" /> : mode === "reopen" ? <Unlock className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}
          {pending ? "جار التنفيذ…" : mode === "create" ? "توليد وإنشاء الحساب" : mode === "permissions" ? reductionOnly ? "حفظ تخفيض الصلاحيات" : "حفظ الصلاحيات" : mode === "freeze" ? "تأكيد التجميد" : "تأكيد إعادة الفتح"}
        </Button>}
        <Button type="button" variant="outline" className="min-h-11" disabled={Boolean(credentials && !handoffSaved)} onClick={dismiss}>{credentials ? "حفظت البيانات · إغلاق" : "إلغاء"}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}