import { useEffect, useState } from "react";
import { useIsMutating, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "wouter";
import { AlertTriangle, ArrowRight, KeyRound, Lock, RefreshCw, Search, ShieldCheck, Unlock, UserCheck } from "lucide-react";
import type { DelegatedEmployeeAccount, EmployeeAccountsResponse } from "@shared/employee-account-delegation";
import { Layout } from "@/components/layout";
import { AccessDeniedPage } from "@/components/protected-route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmployeeAccountDialog, type EmployeeAccountDialogMode } from "@/components/operations-center/employee-account-dialog";
import { EmployeeAccountPolicyEditor } from "@/components/operations-center/employee-account-policy";
import { useAuth } from "@/hooks/useAuth";
import { canManageEmployeeAccounts, constrainDelegatedPermissions, employeeAccountErrorMessage, employeeAccountScope, EMPLOYEE_ACCOUNTS_ENDPOINT, requestEmployeeAccount } from "@/lib/employee-account-delegation";

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">{children}</p>;
}

function EmployeeAccountsWorkspace({ actorId, actorRole, authScope }: { actorId: string; actorRole: string; authScope: string }) {
  const client = useQueryClient();
  const search = useSearch();
  const [, navigate] = useLocation();
  const params = new URLSearchParams(search);
  const branchId = params.getAll("branchId").length > 1 || (params.has("branchId") && !/^[\w-]{1,80}$/.test(params.get("branchId") || ""))
    ? "__invalid_scope__" : params.get("branchId") ?? "";
  const [filter, setFilter] = useState<"linked" | "eligible">("linked");
  const [term, setTerm] = useState("");
  const [policyOpen, setPolicyOpen] = useState(() => actorRole === "admin" && params.get("policy") === "1");
  const [dialog, setDialog] = useState<{ employee: DelegatedEmployeeAccount; mode: EmployeeAccountDialogMode; scope: string } | null>(null);
  const key = [EMPLOYEE_ACCOUNTS_ENDPOINT, actorId, authScope];
  useEffect(() => {
    if (actorRole === "admin" && new URLSearchParams(search).get("policy") === "1") setPolicyOpen(true);
  }, [search, actorRole]);
  const directory = useQuery<EmployeeAccountsResponse>({
    queryKey: key,
    queryFn: ({ signal }) => requestEmployeeAccount<EmployeeAccountsResponse>(EMPLOYEE_ACCOUNTS_ENDPOINT, { signal }),
    staleTime: 0,
    gcTime: 0,
    placeholderData: undefined,
    retry: false,
    networkMode: "online",
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    refetchInterval: 30_000,
  });
  useEffect(() => () => {
    void client.cancelQueries({ queryKey: key, exact: true });
    client.removeQueries({ queryKey: key, exact: true });
  }, [client, actorId, authScope]);
  const data = !directory.isError && !directory.isPaused && directory.isFetchedAfterMount ? directory.data : undefined;
  const branches = Array.from(new Map((data?.employees ?? []).map(employee => [employee.branchId, { id: employee.branchId, name: employee.branchName }])).values());
  const validBranch = !branchId || branches.some(branch => branch.id === branchId);
  // Fresh server scope/policy changes unmount any open credential or action dialog.
  const dialogScope = JSON.stringify([authScope, branchId, branches.map(branch => branch.id).sort(), data?.policy, data?.availablePermissions]);
  const currentEmployee = data?.employees.find(employee => employee.employeeId === dialog?.employee.employeeId);
  const dialogEligible = !!dialog && !!currentEmployee && currentEmployee.branchId === dialog.employee.branchId
    && currentEmployee.employeeName === dialog.employee.employeeName
    && (dialog.mode === "create" || JSON.stringify(currentEmployee.account) === JSON.stringify(dialog.employee.account));
  useEffect(() => { setDialog(null); }, [dialogScope, directory.isError]);
  useEffect(() => { if (dialog && !dialogEligible) setDialog(null); }, [dialogEligible]);
  const refresh = () => { void client.invalidateQueries({ queryKey: key, exact: true }); };
  const changeBranch = (id: string) => {
    setDialog(null);
    setTerm("");
    const next = new URLSearchParams();
    if (id) next.set("branchId", id);
    if (policyOpen && actorRole === "admin") next.set("policy", "1");
    navigate(`/operations-employee-accounts${next.size ? `?${next}` : ""}`, { replace: true });
  };
  const scopedEmployees = validBranch ? (data?.employees ?? []).filter(employee => !branchId || employee.branchId === branchId) : [];
  const linked = scopedEmployees.filter(employee => employee.account);
  const eligible = scopedEmployees.filter(employee => !employee.account);
  const rows = (filter === "linked" ? linked : eligible).filter(employee =>
    `${employee.employeeName} ${employee.branchName} ${employee.account?.username ?? ""}`.toLocaleLowerCase().includes(term.trim().toLocaleLowerCase()));
  const open = (employee: DelegatedEmployeeAccount, mode: EmployeeAccountDialogMode) => setDialog({ employee, mode, scope: dialogScope });
  const delegationEnabled = !!data?.policy.enabled && constrainDelegatedPermissions(data.availablePermissions, data.policy.permissions).length > 0;
  return <Layout><main dir="rtl" className="page-container mx-auto max-w-[1550px] space-y-4 pb-8" data-testid="operations-employee-accounts-page">
    <header className="border-b border-[#e7def0] pb-3 pt-2">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div><p className="text-[11px] font-bold tracking-wide text-violet-700">BUTTER BAKERY · OPERATIONS</p><h1 className="flex items-center gap-2 text-2xl font-black text-[#302840]"><KeyRound className="h-6 w-6 text-violet-700" />حسابات الموظفين</h1>
          <p className="mt-1 text-xs leading-6 text-muted-foreground">إنشاء وإدارة حسابات الموظفين الموجودين في الفروع المصرّح بها فقط.</p></div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="min-h-11 gap-2"><Link href="/operations-center"><ArrowRight className="h-4 w-4" />مركز التشغيل</Link></Button>
          {actorRole === "admin" && <Button variant={policyOpen ? "default" : "outline"} className="min-h-11 gap-2" onClick={() => { setDialog(null); setPolicyOpen(value => !value); }} aria-expanded={policyOpen} aria-controls="employee-account-policy"><ShieldCheck className="h-4 w-4" />سياسة التفويض</Button>}
          <Button type="button" variant="outline" className="min-h-11 gap-2" disabled={directory.isFetching} onClick={refresh}><RefreshCw className={`h-4 w-4 ${directory.isFetching ? "animate-spin" : ""}`} />تحديث</Button>
        </div>
      </div>
    </header>
    {directory.isPaused ? <div role="alert" className="rounded-xl border border-amber-200 bg-card p-5 text-center">
      <p className="text-sm">الاتصال غير متاح. تحقق من الشبكة؛ ستتم إعادة التحقق من الحسابات عند عودة الاتصال.</p>
      <p className="mt-1 text-xs text-muted-foreground">لم نعرض بيانات أو صلاحيات قديمة.</p>
    </div> : directory.isError ? <div role="alert" className="rounded-xl border border-destructive/30 bg-card p-5 text-center">
      <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-destructive" /><p className="text-sm text-destructive">{employeeAccountErrorMessage(directory.error)}</p>
      <p className="mt-1 text-xs text-muted-foreground">لم نعرض بيانات أو صلاحيات قديمة.</p><Button variant="outline" className="mt-3 min-h-11" onClick={refresh}>إعادة المحاولة</Button>
    </div> : !data ? <div role="status" className="space-y-3 rounded-xl border bg-card p-5"><div className="h-5 w-44 animate-pulse rounded bg-muted" /><div className="h-28 animate-pulse rounded-lg bg-muted" /><span className="sr-only">جار التحقق من الموظفين والسياسة</span></div> : <>
      {policyOpen && actorRole === "admin" && <div id="employee-account-policy"><EmployeeAccountPolicyEditor key={JSON.stringify([authScope, data.policy, data.availablePermissions])} directory={data} refresh={refresh} /></div>}
      <div className={`flex items-start gap-2 rounded-lg border p-3 text-xs leading-6 ${delegationEnabled ? "border-violet-200 bg-violet-50/60 text-violet-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
        <ShieldCheck className="mt-1 h-4 w-4 shrink-0" /><p>{delegationEnabled ? "التفويض معتمد. اختر موظفًا موجودًا ثم قالبًا وظيفيًا أو صلاحيات مخصصة ضمن القائمة المعتمدة. الحسابات ذات الصلاحيات الواقعة خارج قائمة ضُيّقت لاحقًا تسمح بالتخفيض فقط." : "التفويض معطّل أو لم تُعتمد صلاحيات بعد. الإنشاء وإعادة الفتح غير متاحين؛ يبقى عرض الحسابات وتجميدها وتخفيض صلاحياتها متاحًا."}{" "}تعطيل السياسة أو تضييقها لا يسحب تلقائيًا وصول الحسابات الحالية. لتغيير وصولها، خفّض صلاحياتها أو جمّدها صراحةً.</p>
      </div>
      <section className="rounded-xl border border-border bg-card p-3 sm:p-4" aria-label="دليل حسابات الموظفين">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="flex flex-wrap gap-2">
            <Button variant={filter === "linked" ? "default" : "outline"} className="min-h-11 gap-2" onClick={() => setFilter("linked")} aria-pressed={filter === "linked"}><KeyRound className="h-4 w-4" />الحسابات المرتبطة ({linked.length})</Button>
            <Button variant={filter === "eligible" ? "default" : "outline"} className="min-h-11 gap-2" onClick={() => setFilter("eligible")} aria-pressed={filter === "eligible"}><UserCheck className="h-4 w-4" />موظفون دون حساب ({eligible.length})</Button>
          </div>
          <div className="min-w-0 flex-1"><label htmlFor="employee-accounts-branch" className="mb-1 block text-[11px] font-bold">الفرع</label>
            <select id="employee-accounts-branch" value={branchId} onChange={event => changeBranch(event.target.value)} className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm">
              <option value="">كل الفروع المصرّح بها</option>
              {!validBranch && <option value={branchId}>نطاق غير متاح · اختر فرعًا</option>}
              {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select></div>
          <div className="min-w-0 flex-1"><label htmlFor="employee-accounts-search" className="mb-1 block text-[11px] font-bold">بحث عن موظف أو حساب</label>
            <div className="relative"><Search className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-muted-foreground" /><Input id="employee-accounts-search" className="min-h-11 pr-9" value={term} onChange={event => setTerm(event.target.value)} placeholder="الاسم أو اسم المستخدم" /></div></div>
        </div>
        <p className="my-3 text-[11px] text-muted-foreground">{filter === "linked" ? "يشمل الحسابات النشطة والمجمّدة. لا يمكن عرض كلمات المرور المحفوظة أو تعديل اسم المستخدم." : "اختيار الموظف من هذه القائمة هو نقطة البداية الوحيدة لإنشاء الحساب."}{directory.isFetching ? " · جار التحقق من الخادم…" : ""}</p>
        {!validBranch ? <Empty>الفرع المطلوب غير متاح في الدليل الحالي. اختر نطاقًا مسموحًا أعلاه؛ لم يتم توسيع النطاق تلقائيًا.</Empty>
          : !rows.length ? <Empty>{term.trim() ? "لا توجد نتائج مطابقة للبحث." : filter === "linked" ? "لا توجد حسابات مرتبطة في هذا النطاق." : "لا يوجد موظفون مؤهلون دون حساب في هذا النطاق."}</Empty>
          : <div className="space-y-2">{rows.map(employee => <article key={employee.employeeId} className="flex flex-col gap-3 rounded-lg border border-border bg-background p-3 sm:flex-row sm:items-center" data-testid={`employee-account-${employee.employeeId}`}>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-bold text-[#302840]">{employee.employeeName}</h2>
                <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${!employee.account ? "bg-violet-100 text-violet-800" : employee.account.isActive === "active" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{!employee.account ? "دون حساب" : employee.account.isActive === "active" ? "نشط" : "مجمّد"}</span></div>
              <p className="mt-1 text-xs text-muted-foreground">{employee.branchName}{employee.account && <> · <bdi className="font-mono">{employee.account.username ?? "اسم المستخدم غير متاح"}</bdi></>}</p>
              {employee.account?.isActive === "inactive" && !employee.account.canReactivate && <p className="mt-1 text-[11px] text-amber-800">غير مؤهل لإعادة الفتح وفق السياسة الحالية.</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              {!employee.account ? <Button className="min-h-11 gap-2" disabled={!delegationEnabled || directory.isFetching} onClick={() => open(employee, "create")}><KeyRound className="h-4 w-4" />اختيار الموظف</Button> : <>
                <Button variant="outline" className="min-h-11 gap-2" disabled={directory.isFetching} onClick={() => open(employee, "permissions")}><ShieldCheck className="h-4 w-4" />الصلاحيات</Button>
                {employee.account.isActive === "active" ? <Button variant="outline" className="min-h-11 gap-2 text-amber-800" disabled={directory.isFetching} onClick={() => open(employee, "freeze")}><Lock className="h-4 w-4" />تجميد</Button>
                  : <Button variant="outline" className="min-h-11 gap-2" disabled={!delegationEnabled || !employee.account.canReactivate || directory.isFetching} onClick={() => open(employee, "reopen")}><Unlock className="h-4 w-4" />إعادة الفتح</Button>}
              </>}
            </div>
          </article>)}</div>}
      </section>
      {dialog && dialogEligible && dialog.scope === dialogScope && <EmployeeAccountDialog key={`${dialogScope}:${dialog.employee.employeeId}:${dialog.mode}`} employee={dialog.employee} mode={dialog.mode} directory={data} close={() => setDialog(null)} refresh={refresh} />}
    </>}
  </main></Layout>;
}

export default function OperationsEmployeeAccountsPage() {
  const { user, isAuthError, isSwitchingBranch } = useAuth();
  const loggingOut = useIsMutating({ mutationKey: ["auth", "logout"] }) > 0;
  if (isAuthError) return <AccessDeniedPage message="تعذر التحقق من الجلسة الحالية. أعد تسجيل الدخول." />;
  if (!user || !canManageEmployeeAccounts(user.role)) return <AccessDeniedPage message="هذه الصفحة متاحة فقط لمدير العمليات ومدير النظام." />;
  if (isSwitchingBranch || loggingOut) return <p role="status" className="p-6 text-center text-sm" dir="rtl">{loggingOut ? "جار تسجيل الخروج…" : "جار التحقق من نطاق الحساب…"}</p>;
  const scope = employeeAccountScope(user);
  return <EmployeeAccountsWorkspace key={scope} actorId={user.id} actorRole={user.role} authScope={scope} />;
}