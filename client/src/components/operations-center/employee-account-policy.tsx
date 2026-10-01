import { useEffect, useRef, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import type { EmployeeAccountPolicy as Policy, EmployeeAccountsResponse } from "@shared/employee-account-delegation";
import { Button } from "@/components/ui/button";
import { EmployeeAccountPermissions } from "./employee-account-permissions";
import { constrainDelegatedPermissions, createEmployeeAccountCommandGuard, EMPLOYEE_ACCOUNT_POLICY_ENDPOINT, employeeAccountErrorMessage, requestEmployeeAccount } from "@/lib/employee-account-delegation";

export function EmployeeAccountPolicyEditor({ directory, refresh }: { directory: EmployeeAccountsResponse; refresh: () => void }) {
  const [enabled, setEnabled] = useState(directory.policy.enabled);
  const [permissions, setPermissions] = useState(() => constrainDelegatedPermissions(directory.policy.permissions, directory.availablePermissions));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const guard = useRef(createEmployeeAccountCommandGuard()).current;
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => { guard.invalidate(); controller.current?.abort(); }, [guard]);
  const save = async () => {
    if (pending) return;
    const token = guard.capture();
    const request = new AbortController();
    controller.current = request;
    const timeout = setTimeout(() => request.abort(), 30_000);
    setPending(true);
    setError("");
    setSaved(false);
    try {
      await requestEmployeeAccount<{ policy: Policy }>(EMPLOYEE_ACCOUNT_POLICY_ENDPOINT, {
        method: "PUT", body: { enabled, permissions: constrainDelegatedPermissions(permissions, directory.availablePermissions) }, signal: request.signal,
      });
      if (!guard.isCurrent(token)) return;
      setSaved(true);
      refresh();
    } catch (cause) {
      if (guard.isCurrent(token)) { setError(employeeAccountErrorMessage(cause)); refresh(); }
    } finally {
      clearTimeout(timeout);
      if (guard.isCurrent(token)) setPending(false);
    }
  };
  return <section className="space-y-3 rounded-xl border border-violet-200 bg-card p-4" aria-labelledby="delegation-policy-title" data-testid="employee-account-policy-editor">
    <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-violet-700" /><h2 id="delegation-policy-title" className="text-sm font-bold">سياسة تفويض حسابات الموظفين · مدير النظام فقط</h2></div>
    <p className="text-xs leading-6 text-muted-foreground">التفويض معطّل افتراضيًا إلى أن تُعتمد هذه السياسة. اختر السقف المسموح ثم فعّل التفويض واحفظ. مدير العمليات لا يستطيع تعديل هذا السقف أو منح صلاحيات خارجه.</p>
    <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-violet-50/60 px-3 text-sm font-bold">
      <input type="checkbox" className="h-4 w-4 accent-violet-700" checked={enabled} disabled={pending} onChange={event => { setEnabled(event.target.checked); setSaved(false); }} />
      تفعيل تفويض الحسابات بعد الاعتماد
    </label>
    <EmployeeAccountPermissions available={directory.availablePermissions} selected={permissions} onChange={next => { setPermissions(next); setSaved(false); }} disabled={pending} />
    <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-900">تعطيل السياسة أو تضييقها لا يسحب تلقائيًا وصول الحسابات الحالية. السياسة تحدّد التفويض اللاحق فقط؛ لإيقاف وصول حساب قائم جمّده أو خفّض صلاحياته صراحةً. يبقى عرض الحسابات والتجميد والتخفيض متاحًا، بينما يتطلب الإنشاء وإعادة الفتح سياسة مفعّلة.</p>
    {error && <p role="alert" className="text-xs leading-6 text-destructive">{error}</p>}
    {saved && <p role="status" className="text-xs text-emerald-700">تم حفظ السياسة من الخادم.</p>}
    <Button type="button" className="min-h-11 gap-2" disabled={pending || (enabled && !permissions.length)} onClick={save}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
      {pending ? "جار حفظ السياسة…" : enabled ? "اعتماد وحفظ السياسة" : "حفظ السياسة مع تعطيل التفويض"}
    </Button>
  </section>;
}