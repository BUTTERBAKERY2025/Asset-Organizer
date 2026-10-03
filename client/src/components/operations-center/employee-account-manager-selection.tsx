import { useEffect, useRef, useState } from "react";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { EmployeeAccountManager, EmployeeAccountManagerSelection } from "@/lib/employee-account-types";
import { employeeManagementExplanation } from "@/lib/employee-account-types";
import { createEmployeeAccountCommandGuard, EmployeeAccountRequestError, employeeAccountErrorMessage, requestEmployeeAccount } from "@/lib/employee-account-delegation";

const ENDPOINT = "/api/admin/employee-account-managers";

/** Read-only admin coverage. Compatibility component name; no employee selection writes. */
export function EmployeeAccountManagerSelectionEditor({ actorRole }: { actorRole: string; refresh?: () => void }) {
  if (actorRole !== "admin") return <p role="alert" dir="rtl" className="text-xs text-muted-foreground">عرض تغطية مديري العمليات متاح للأدمن فقط.</p>;
  return <ManagerBranchCoverage />;
}

function ManagerBranchCoverage() {
  const [managers, setManagers] = useState<EmployeeAccountManager[] | null>(null);
  const [managerId, setManagerId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const guard = useRef(createEmployeeAccountCommandGuard()).current;
  const request = useRef<AbortController | null>(null);
  const load = async () => {
    guard.invalidate();
    request.current?.abort();
    const token = guard.capture();
    const controller = new AbortController();
    request.current = controller;
    setManagers(null);
    setManagerId("");
    setError("");
    setLoading(true);
    try {
      const result = await requestEmployeeAccount<{ managers: EmployeeAccountManager[] }>(ENDPOINT, { signal: controller.signal });
      if (!Array.isArray(result.managers) || !result.managers.every(row => !!row
        && typeof row.id === "string" && !!row.id && typeof row.name === "string" && Array.isArray(row.branches)
        && row.branches.every(branch => !!branch && typeof branch.id === "string" && !!branch.id
          && typeof branch.name === "string" && typeof branch.canManage === "boolean")))
        throw new EmployeeAccountRequestError(502, "استجابة قائمة مديري العمليات أو تغطية الفروع غير صالحة. أعد التحميل.");
      if (guard.isCurrent(token)) setManagers(result.managers);
    } catch (cause) {
      if (guard.isCurrent(token)) setError(employeeAccountErrorMessage(cause));
    } finally {
      if (guard.isCurrent(token)) setLoading(false);
    }
  };
  useEffect(() => {
    void load();
    return () => { guard.invalidate(); request.current?.abort(); };
  }, [guard]);
  const manager = managers?.find(row => row.id === managerId);
  return <section dir="rtl" className="space-y-3 rounded-xl border border-violet-200 bg-card p-4" data-testid="employee-account-manager-selection" aria-labelledby="manager-selection-title">
    <h2 id="manager-selection-title" className="flex items-center gap-2 text-sm font-bold"><ShieldCheck className="h-5 w-5 text-violet-700" />تغطية فروع مدير العمليات · للقراءة فقط</h2>
    <p className="text-xs leading-6 text-muted-foreground">يشمل النطاق تلقائيًا جميع الموظفين الحاليين والمستقبليين في فروع المدير المصرّح له بإدارتها والكتابة فيها، دون اختيار موظفين بالاسم أو حفظ قائمة. فروع القراءة فقط لا تسمح بإدارة الحسابات؛ الأدوار الإدارية والحسابات المحمية أو متعددة الفروع خارج الإدارة المفوّضة.</p>
    <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-900">التغطية التلقائية ليست إنشاءً أو منحًا تلقائيًا. إنشاء الحساب أو إسناد القالب يبقى إجراءً صريحًا لموظف واحد، بإصدار معتمد ومؤهل ومراجعة وتأكيد؛ لا تُسحب الصلاحيات الحالية تلقائيًا عند تغيير تغطية الفروع.</p>
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="min-w-0 flex-1"><label htmlFor="employee-account-manager" className="mb-1 block text-xs font-bold">مدير العمليات</label>
        <select id="employee-account-manager" className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm" value={managerId} disabled={loading || !managers} onChange={event => setManagerId(event.target.value)}>
          <option value="">اختر مدير العمليات</option>
          {managers?.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
        </select></div>
      <Button type="button" variant="outline" className="min-h-11 gap-2" disabled={loading} onClick={load}><RefreshCw className="h-4 w-4" />تحديث قائمة المديرين</Button>
    </div>
    {loading && <div role="status" className="space-y-2"><div className="h-4 w-40 animate-pulse rounded bg-muted" /><div className="h-11 animate-pulse rounded bg-muted" /><span className="sr-only">جار تحميل مديري العمليات…</span></div>}
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    {managers?.length === 0 && <p className="text-xs text-muted-foreground">لا يوجد مديرو عمليات متاحون.</p>}
    {manager && <ManagerEmployees key={manager.id} manager={manager} />}
  </section>;
}

function ManagerEmployees({ manager }: { manager: EmployeeAccountManager }) {
  const [data, setData] = useState<EmployeeAccountManagerSelection | null>(null);
  const [branch, setBranch] = useState("");
  const [term, setTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const guard = useRef(createEmployeeAccountCommandGuard()).current;
  const request = useRef<AbortController | null>(null);
  const endpoint = `${ENDPOINT}/${encodeURIComponent(manager.id)}`;
  const load = async () => {
    guard.invalidate();
    request.current?.abort();
    const token = guard.capture();
    const controller = new AbortController();
    request.current = controller;
    setData(null);
    setLoading(true);
    setError("");
    try {
      const result = await requestEmployeeAccount<EmployeeAccountManagerSelection>(endpoint, { signal: controller.signal });
      if (result.scopeMode !== "all_branch_employees")
        throw new EmployeeAccountRequestError(502, "الخدمة لا تؤكد نمط تغطية جميع موظفي الفروع. حدّث الخدمة ثم أعد قراءة التغطية؛ لن نعرض قائمة اختيار قديمة أو نفترض تفويضًا تلقائيًا.");
      if (result.managerId !== manager.id || !Array.isArray(result.employees) || !result.employees.every(row =>
        !!row && Number.isInteger(row.employeeId) && row.employeeId > 0
        && typeof row.employeeName === "string" && typeof row.branchName === "string"
        && typeof row.hasAccount === "boolean" && typeof row.eligible === "boolean"
        && ["allowed", "read_only_branch", "protected_account"].includes(row.reason)
        && manager.branches.some(branch => branch.id === row.branchId)
        && (!row.eligible || (row.reason === "allowed" && manager.branches.some(branch => branch.id === row.branchId && branch.canManage)))))
        throw new EmployeeAccountRequestError(502, "استجابة تغطية الموظفين غير صالحة أو تخص مديرًا أو فرعًا آخر. أعد التحميل؛ لم نعرض أهلية بديلة.");
      if (!guard.isCurrent(token)) return;
      setData(result);
    } catch (cause) {
      if (guard.isCurrent(token)) setError(employeeAccountErrorMessage(cause));
    } finally {
      if (guard.isCurrent(token)) setLoading(false);
    }
  };
  useEffect(() => {
    void load();
    return () => { guard.invalidate(); request.current?.abort(); };
  }, [guard]);
  const rows = data?.employees.filter(row => (!branch || row.branchId === branch) && `${row.employeeName} ${row.branchName}`.toLocaleLowerCase().includes(term.trim().toLocaleLowerCase())) ?? [];
  return <div className="space-y-3 border-t pt-3" data-testid={`manager-selection-${manager.id}`}>
    <p className="text-xs font-bold">تغطية المدير: {manager.name}</p>
    <section aria-label="تغطية فروع المدير" className="space-y-2">{manager.branches.map(branch => <p key={branch.id} className="rounded-lg border bg-background p-3 text-xs leading-6">{branch.name} · {branch.canManage ? "قابل للإدارة والكتابة · يشمل الموظفين الحاليين والمستقبليين تلقائيًا" : "قراءة فقط · لا إدارة لحسابات الموظفين"}</p>)}{!manager.branches.length && <p className="text-xs text-muted-foreground">لا توجد فروع مصرّح بها لهذا المدير في القراءة الحالية.</p>}</section>
    <div className="grid gap-3 sm:grid-cols-2">
      <div><label htmlFor="manager-employees-branch" className="mb-1 block text-xs font-bold">تصفية الفرع</label>
        <select id="manager-employees-branch" className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm" value={branch} onChange={event => setBranch(event.target.value)}>
          <option value="">كل فروع المدير</option>
          {manager.branches.map(row => <option key={row.id} value={row.id}>{row.name}{!row.canManage ? " · قراءة فقط" : ""}</option>)}
        </select></div>
      <div><label htmlFor="manager-employees-search" className="mb-1 block text-xs font-bold">بحث باسم الموظف</label><Input id="manager-employees-search" className="min-h-11" value={term} onChange={event => setTerm(event.target.value)} /></div>
    </div>
    {loading && <div role="status" className="space-y-2"><div className="h-4 w-32 animate-pulse rounded bg-muted" /><div className="h-24 animate-pulse rounded bg-muted" /><span className="sr-only">جار قراءة تغطية موظفي المدير…</span></div>}
    {error && <p role="alert" className="text-xs leading-6 text-destructive">{error}</p>}
    {data && <>
      <p className="text-xs font-bold" data-testid="manager-selection-count">الموظفون المؤهلون حاليًا: {data.employees.filter(row => row.eligible).length} · عدد النتائج المعروضة: {rows.length}</p>
      {!rows.length ? <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">{data.employees.length ? "لا توجد نتائج مطابقة للتصفية." : "لا يوجد موظفون في القراءة الحالية لهذا النطاق. الموظفون الجدد في فروع الإدارة والكتابة يُقيّمون تلقائيًا وفق أهلية الحساب، دون حفظ قائمة أسماء."}</p>
        : <div className="max-h-96 space-y-2 overflow-y-auto">{rows.map(row => <article key={row.employeeId} data-testid={`manager-coverage-employee-${row.employeeId}`} className="flex min-h-11 items-start gap-3 rounded-lg border bg-background p-3">
          <span className="min-w-0 text-xs leading-6"><span className="block font-bold">{row.employeeName}</span>{row.branchName} · {row.hasAccount ? row.reason === "protected_account" ? "خارج نطاق الإدارة المفوّضة" : "حساب مرتبط" : "بلا حساب"}
            <span className={`block ${row.eligible ? "text-emerald-800" : "text-amber-800"}`}>{row.eligible ? "ضمن تغطية الفرع · مؤهل حاليًا للمراجعة عبر مسار القوالب" : employeeManagementExplanation(row.reason)}</span></span>
        </article>)}</div>}
    </>}
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" className="min-h-11 gap-2" disabled={loading} onClick={load}><RefreshCw className="h-4 w-4" />إعادة قراءة تغطية المدير</Button>
    </div>
  </div>;
}