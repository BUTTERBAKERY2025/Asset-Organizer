import { useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { EmployeeAccountManager, EmployeeAccountManagerSelection } from "@/lib/employee-account-types";
import { employeeManagementExplanation } from "@/lib/employee-account-types";
import { createEmployeeAccountCommandGuard, EmployeeAccountRequestError, employeeAccountErrorMessage, requestEmployeeAccount } from "@/lib/employee-account-delegation";

const ENDPOINT = "/api/admin/employee-account-managers";

/** Unmounting on actor scope/role/logout cancels all requests and drops drafts. */
export function EmployeeAccountManagerSelectionEditor({ refresh }: { refresh: () => void }) {
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
      if (!Array.isArray(result.managers)) throw new EmployeeAccountRequestError(502, "استجابة قائمة مديري العمليات غير صالحة. أعد التحميل.");
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
    <h2 id="manager-selection-title" className="flex items-center gap-2 text-sm font-bold"><ShieldCheck className="h-5 w-5 text-violet-700" />اختيار الموظفين المفوّضين لكل مدير عمليات</h2>
    <p className="text-xs leading-6 text-muted-foreground">الاختيار مستقل لكل مدير وليس قائمة عامة. الموظف غير المختار للقراءة فقط. القوالب المعتمدة للإدارة المفوّضة مستقلة عن سقف الصلاحيات اليدوية القديم؛ يبقى تفعيل السياسة والفرع المصرّح به وأهلية القالب والحساب مطلوبًا. لا يتم الحفظ تلقائيًا.</p>
    <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-900">سحب التفويض عن موظف لا يعطّل حساب الموظف أو يسحب وصوله الحالي. لإيقاف وصوله، جمّد الحساب صراحةً.</p>
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="min-w-0 flex-1"><label htmlFor="employee-account-manager" className="mb-1 block text-xs font-bold">مدير العمليات</label>
        <select id="employee-account-manager" className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm" value={managerId} disabled={loading || !managers} onChange={event => setManagerId(event.target.value)}>
          <option value="">اختر مدير العمليات</option>
          {managers?.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
        </select></div>
      <Button type="button" variant="outline" className="min-h-11 gap-2" disabled={loading} onClick={load}><RefreshCw className="h-4 w-4" />تحديث قائمة المديرين</Button>
    </div>
    {loading && <p role="status" className="text-xs">جار تحميل مديري العمليات…</p>}
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    {managers?.length === 0 && <p className="text-xs text-muted-foreground">لا يوجد مديرو عمليات متاحون.</p>}
    {manager && <ManagerEmployees key={manager.id} manager={manager} refresh={refresh} />}
  </section>;
}

function ManagerEmployees({ manager, refresh }: { manager: EmployeeAccountManager; refresh: () => void }) {
  const [data, setData] = useState<EmployeeAccountManagerSelection | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [branch, setBranch] = useState("");
  const [term, setTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const guard = useRef(createEmployeeAccountCommandGuard()).current;
  const request = useRef<AbortController | null>(null);
  const endpoint = `${ENDPOINT}/${encodeURIComponent(manager.id)}`;
  const load = async (afterSave = false) => {
    guard.invalidate();
    request.current?.abort();
    const token = guard.capture();
    const controller = new AbortController();
    request.current = controller;
    setData(null);
    setSelected([]);
    setLoading(true);
    setError("");
    setSaved(false);
    try {
      const result = await requestEmployeeAccount<EmployeeAccountManagerSelection>(endpoint, { signal: controller.signal });
      if (result.managerId !== manager.id || typeof result.revision !== "string" || !Array.isArray(result.employees) || !Array.isArray(result.selectedEmployeeIds))
        throw new EmployeeAccountRequestError(502, "استجابة اختيار الموظفين غير صالحة أو تخص مديرًا آخر. أعد التحميل.");
      if (!guard.isCurrent(token)) return;
      setData(result);
      setSelected([...result.selectedEmployeeIds]);
      setConflict(false);
      setSaved(afterSave);
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
  const save = async () => {
    if (!data || saving || loading || conflict) return;
    // Never read a new manager/revision/draft after awaiting a request.
    const captured = { managerId: manager.id, revision: data.revision, employeeIds: [...selected] };
    const token = guard.capture();
    const controller = new AbortController();
    request.current = controller;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await requestEmployeeAccount<unknown>(`${ENDPOINT}/${encodeURIComponent(captured.managerId)}`, {
        method: "PUT", body: { employeeIds: captured.employeeIds, revision: captured.revision }, signal: controller.signal,
      });
      if (!guard.isCurrent(token)) return;
      setSaving(false);
      refresh();
      await load(true);
    } catch (cause) {
      if (!guard.isCurrent(token)) return;
      const changed = cause instanceof EmployeeAccountRequestError && cause.status === 409;
      setConflict(changed);
      setError(changed ? "تغيّر التفويض منذ تحميل القائمة. أعد تحميل اختيار هذا المدير وراجع التغييرات قبل الحفظ؛ لن يتم فرض استبدال الاختيار." : employeeAccountErrorMessage(cause));
      if (cause instanceof EmployeeAccountRequestError && (cause.status === 401 || cause.status === 403)) {
        setData(null);
        setSelected([]);
      }
      setSaving(false);
    }
  };
  const locked = saving || loading || conflict;
  const rows = data?.employees.filter(row => (!branch || row.branchId === branch) && `${row.employeeName} ${row.branchName}`.toLocaleLowerCase().includes(term.trim().toLocaleLowerCase())) ?? [];
  return <div className="space-y-3 border-t pt-3" data-testid={`manager-selection-${manager.id}`}>
    <p className="text-xs font-bold">الموظفون المفوّضون للمدير: {manager.name}</p>
    <div className="grid gap-3 sm:grid-cols-2">
      <div><label htmlFor="manager-employees-branch" className="mb-1 block text-xs font-bold">تصفية الفرع</label>
        <select id="manager-employees-branch" className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm" value={branch} onChange={event => setBranch(event.target.value)}>
          <option value="">كل فروع المدير</option>
          {manager.branches.map(row => <option key={row.id} value={row.id}>{row.name}{!row.canManage ? " · قراءة فقط" : ""}</option>)}
        </select></div>
      <div><label htmlFor="manager-employees-search" className="mb-1 block text-xs font-bold">بحث باسم الموظف</label><Input id="manager-employees-search" className="min-h-11" value={term} onChange={event => setTerm(event.target.value)} /></div>
    </div>
    {loading && <p role="status" className="flex items-center gap-2 text-xs"><Loader2 className="h-4 w-4 animate-spin" />جار تحميل موظفي المدير…</p>}
    {error && <p role="alert" className="text-xs leading-6 text-destructive">{error}</p>}
    {saved && <p role="status" className="text-xs text-emerald-700">تم حفظ اختيار هذا المدير والتحقق منه من الخادم.</p>}
    {data && <>
      <p className="text-xs font-bold" data-testid="manager-selection-count">عدد الموظفين المختارين: {selected.length}</p>
      {!rows.length ? <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">{data.employees.length ? "لا توجد نتائج مطابقة للتصفية." : "لا يوجد موظفون نشطون في نطاق هذا المدير."}</p>
        : <div className="max-h-96 space-y-2 overflow-y-auto">{rows.map(row => <label key={row.employeeId} className="flex min-h-11 items-start gap-3 rounded-lg border bg-background p-3">
          <input type="checkbox" aria-label={`تفويض ${row.employeeName}`} className="mt-1 h-4 w-4 shrink-0 accent-violet-700" checked={selected.includes(row.employeeId)} disabled={locked || !row.eligible} onChange={event => {
            if (locked || !row.eligible) return;
            setSelected(previous => event.target.checked ? Array.from(new Set([...previous, row.employeeId])) : previous.filter(id => id !== row.employeeId));
            setSaved(false);
          }} />
          <span className="min-w-0 text-xs leading-6"><span className="block font-bold">{row.employeeName}</span>{row.branchName} · {row.hasAccount ? row.reason === "protected_account" ? "خارج نطاق الإدارة المفوّضة" : "حساب مرتبط" : "بلا حساب"}
            {!row.eligible && <span className="block text-amber-800">{employeeManagementExplanation(row.reason)}</span>}</span>
        </label>)}</div>}
    </>}
    <div className="flex flex-wrap gap-2">
      <Button type="button" className="min-h-11" disabled={!data || locked} onClick={save}>{saving ? "جار حفظ الاختيار…" : "حفظ اختيار الموظفين"}</Button>
      <Button type="button" variant="outline" className="min-h-11" disabled={!data || locked} onClick={() => { setSelected([]); setSaved(false); }}>مسح الاختيار</Button>
      <Button type="button" variant="outline" className="min-h-11 gap-2" disabled={saving || loading} onClick={() => load()}><RefreshCw className="h-4 w-4" />إعادة تحميل اختيار المدير</Button>
    </div>
  </div>;
}