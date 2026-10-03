import { useEffect, useState } from "react";
import "./operations-employee-accounts.css";
import { BranchTemplateDialog } from "@/components/operations-center/branch-template-dialog";
import { useIsMutating, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "wouter";
import { AlertTriangle, ArrowRight, ChevronDown, KeyRound, Lock, RefreshCw, Search, ShieldCheck, Unlock, UserCheck } from "lucide-react";
import type { DelegatedEmployeeAccount, EmployeeAccountsResponse } from "@/lib/employee-account-types";
import { employeeManagementExplanation, employeeManagementLabel } from "@/lib/employee-account-types";
import { Layout } from "@/components/layout";
import { AccessDeniedPage } from "@/components/protected-route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmployeeAccountDialog, type EmployeeAccountDialogMode } from "@/components/operations-center/employee-account-dialog";
import { EmployeeTemplateAssignmentDialog } from "@/components/operations-center/employee-template-assignment-dialog";
import { EmployeeAccountAdditionsDialog } from "@/components/operations-center/employee-account-additions-dialog";
import { EmployeeTemplatePilotDialog } from "@/components/operations-center/employee-template-pilot-dialog";
import { EmployeeAccountPolicyEditor } from "@/components/operations-center/employee-account-policy";
import { EmployeeAccountManagerSelectionEditor } from "@/components/operations-center/employee-account-manager-selection";
import { useAuth } from "@/hooks/useAuth";
import { canManageEmployeeAccounts, employeeAccountErrorMessage, employeeAccountScope, EMPLOYEE_ACCOUNTS_ENDPOINT, requestEmployeeAccount } from "@/lib/employee-account-delegation";

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-5 text-center text-sm text-muted-foreground">{children}</p>;
}

function EmployeeAssignment({ employee }: { employee: DelegatedEmployeeAccount }) {
  // Read only the directory's historical binding, never infer from the catalog.
  const assignment = employee.templateAssignment;
  return <div className="min-w-0 text-sm" data-testid={`employee-template-assignment-${employee.employeeId}`}>
    <p className="accounts-mobile-label">القالب المسند · الإصدار الفعلي</p>
    {!employee.hasAccount ? <p className="text-muted-foreground">لا يوجد حساب</p>
      : assignment === undefined ? <p className="text-muted-foreground">بيانات إسناد القالب غير متاحة</p>
        : assignment === null ? <p className="text-muted-foreground">لا يوجد قالب مسند</p>
          : <div className="space-y-1">
            <p className="break-words font-semibold leading-5 text-[#302840]">{assignment.name?.trim() || `قالب رقم ${assignment.templateId}`}</p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="whitespace-nowrap text-muted-foreground">الإصدار <bdi className="font-mono font-semibold">{assignment.version}</bdi></span>
              <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${assignment.approved ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>{assignment.approved ? "معتمد" : "يحتاج مراجعة"}</span>
            </div>
          </div>}
  </div>;
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
  const [status, setStatus] = useState<"all" | "active" | "inactive" | "unknown">("all");
  const [policyOpen, setPolicyOpen] = useState(() => actorRole === "admin" && params.get("policy") === "1");
  const [dialog, setDialog] = useState<{ employee: DelegatedEmployeeAccount; mode: EmployeeAccountDialogMode | "additions" | "pilot"; scope: string } | null>(null);
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
  const branches = data?.branches ?? [];
  const validBranch = !branchId || branches.some(branch => branch.id === branchId);
  // Access changes unmount every dialog. Policy changes invalidate pilot review
  // in-place so its explicit selection/reason survive; delegated dialogs close.
  const accessScope = JSON.stringify([authScope, branchId, branches.map(branch => branch.id).sort()]);
  const dialogScope = JSON.stringify([accessScope, data?.policy, data?.availablePermissions]);
  const currentEmployee = data?.employees.find(employee => employee.employeeId === dialog?.employee.employeeId);
  const dialogEligible = !!dialog && !!currentEmployee && (dialog.mode === "additions" || dialog.mode === "pilot" ? actorRole === "admin" && currentEmployee.hasAccount : currentEmployee.management?.allowed === true) && currentEmployee.branchId === dialog.employee.branchId
    && currentEmployee.employeeName === dialog.employee.employeeName
    && (dialog.mode === "create" || dialog.mode === "permissions" || dialog.mode === "additions" || dialog.mode === "pilot" || JSON.stringify(currentEmployee.account) === JSON.stringify(dialog.employee.account));
  useEffect(() => { setDialog(null); }, [accessScope, directory.isError]);
  useEffect(() => { setDialog(current => current?.mode === "pilot" ? current : null); }, [dialogScope]);
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
  const linked = scopedEmployees.filter(employee => employee.hasAccount);
  const eligible = scopedEmployees.filter(employee => !employee.hasAccount);
  const rows = (filter === "linked" ? linked : eligible).filter(employee =>
    (filter !== "linked" || status === "all" || (status === "unknown" ? !employee.account : employee.account?.isActive === status))
    && `${employee.employeeName} ${employee.branchName} ${employee.account?.username ?? ""}`.toLocaleLowerCase().includes(term.trim().toLocaleLowerCase()));
  const open = (employee: DelegatedEmployeeAccount, mode: EmployeeAccountDialogMode | "additions" | "pilot") => {
    if (directory.isFetching) return;
    if (mode === "additions" || mode === "pilot" ? actorRole !== "admin" || !employee.hasAccount
      : !employee.management?.allowed || (mode === "create" ? employee.hasAccount : !employee.account)) return;
    setDialog({ employee, mode, scope: mode === "pilot" ? accessScope : dialogScope });
  };
  const delegationEnabled = !!data?.policy.enabled;
  return <Layout><main dir="rtl" className="employee-accounts-workspace page-container mx-auto max-w-[1550px] space-y-4 pb-6 [&_button]:transition-colors [&_button]:duration-150" data-testid="operations-employee-accounts-page">
    <header className="border-b border-[#e7def0] pb-4 pt-1">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0"><p className="text-xs font-bold tracking-wide text-violet-700">BUTTER BAKERY · OPERATIONS</p><h1 className="mt-1 flex items-center gap-2 text-2xl font-black text-[#302840]"><KeyRound className="h-6 w-6 text-violet-700" />حسابات الموظفين</h1>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">دليل الموظفين في الفروع المصرّح بها. افتح التفاصيل لمراجعة نطاق الإدارة وتنفيذ الإجراء.</p></div>
        <div className="flex flex-wrap gap-1.5">
          <Button asChild variant="outline" className="h-10 gap-2 px-3 text-sm"><Link href="/operations-center"><ArrowRight className="h-4 w-4" />مركز التشغيل</Link></Button>
          {actorRole === "admin" && <Button variant={policyOpen ? "default" : "outline"} className="h-10 gap-2 px-3 text-sm" onClick={() => { setDialog(null); setPolicyOpen(value => !value); }} aria-expanded={policyOpen} aria-controls="employee-account-policy"><ShieldCheck className="h-4 w-4" />سياسة التفويض</Button>}
          <Button type="button" variant="outline" className="h-10 gap-2 px-3 text-sm" disabled={directory.isFetching} onClick={refresh}><RefreshCw className="h-4 w-4" />تحديث</Button>
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
      {policyOpen && actorRole === "admin" && <div id="employee-account-policy" className="space-y-4"><EmployeeAccountPolicyEditor key={JSON.stringify([authScope, data.policy, data.availablePermissions])} directory={data} refresh={refresh} /><EmployeeAccountManagerSelectionEditor key={authScope} actorRole={actorRole} /></div>}
      <details className={`group rounded-lg border text-sm ${delegationEnabled ? "border-violet-200 bg-violet-50/40 text-violet-900" : "border-amber-200 bg-amber-50/60 text-amber-900"}`}>
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 rounded-lg px-3 py-2 font-semibold hover:bg-violet-100/30 [&::-webkit-details-marker]:hidden">
          <ShieldCheck className="h-4 w-4 shrink-0" /><span>إرشادات إدارة الحسابات ونطاق التفويض</span>
          <span className={`rounded px-2 py-0.5 text-xs ${delegationEnabled ? "bg-violet-100" : "bg-amber-100"}`}>{delegationEnabled ? "التفويض مفعّل" : "التفويض معطّل"}</span>
          <ChevronDown className="mr-auto h-4 w-4 shrink-0 group-open:rotate-180" />
        </summary>
        <div className="space-y-2 border-t border-inherit p-3 [&_p]:text-sm [&_p]:leading-6">
      <div className={`flex items-start gap-2 rounded-md border p-2 text-xs leading-5 ${delegationEnabled ? "border-violet-200 bg-violet-50/60 text-violet-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
        <ShieldCheck className="mt-1 h-4 w-4 shrink-0" /><p>{delegationEnabled ? "حدد موظفًا واحدًا للإجراء ثم أي إصدار معتمد ومؤهل للإدارة المفوّضة وفرعه المصرّح به، لإنشاء حساب أو تحديث حساب قائم. الخيارات ليست محصورة بالكاشير؛ اعتماد القالب مستقل عن سقف الصلاحيات اليدوية القديم. راجع فرق الأساس وأكّد حسابًا واحدًا؛ الخادم يتحقق من تغطية الفرع والاعتماد والحالة الحالية ودليل الربط عند وجوده وحدود الإجراءات والنطاقات المدعومة. القالب الفارغ صالح وبوابة الموظف الذاتية مستقلة." : "التفويض معطّل. إسناد القوالب والإنشاء وإعادة الفتح غير متاحة؛ يبقى عرض الحسابات وتجميدها متاحًا."}{" "}تعطيل السياسة أو تضييق المسار اليدوي القديم لا يسحب تلقائيًا وصول الحسابات الحالية. لا يعني اعتماد القالب دعم كل نطاق فرع أو منح وصول عالمي آمن. لا توجد تغييرات جماعية أو تعديل يدوي للصلاحيات في هذه الصفحة؛ لتوقيف الدخول جمّد الحساب صراحةً.</p>
      </div>
      <p className="rounded-md border border-violet-200 bg-violet-50/30 p-2 text-xs leading-5 text-violet-900">تغطية مدير العمليات تشمل تلقائيًا جميع الموظفين الحاليين والمستقبليين في فروعه المصرّح له بالكتابة والإدارة فيها؛ لا توجد قائمة أسماء تحتاج موافقة منفصلة. فروع القراءة فقط والأدوار الإدارية والحسابات المحمية أو متعددة الفروع لا تُتاح تلقائيًا. اختيار موظف هنا يحدد هدف الإجراء فقط: لا إنشاء حسابات ولا إسناد قوالب أو منح صلاحيات تلقائي. الحساب العادي ذو الصلاحيات المباشرة المعروفة يمكن مراجعته للانتقال إلى قالب وفق قرار الخادم؛ الاستثناءات أو RBAC غير المعروف تبقى محظورة، والحساب المجمّد لا يُفتح بمجرد ظهور اسمه في النطاق.</p>
      {actorRole === "admin" && <p className="rounded-md border border-amber-200 bg-amber-50/40 p-2 text-xs leading-5 text-amber-900">للأدمن: استخدم «مقارنة وتجربة قالب» لمراجعة القوالب وإسنادها للحسابات المرتبطة. «خارج نطاق الإدارة المفوّضة» يخص صلاحية الإدارة عبر مسار التفويض، وليس حالة دخول الموظف. الإضافات المستقلة لا تغيّر القالب الأساسي أو الاستثناءات القديمة، والنطاق العام ليس مقيدًا بفرع الموظف.</p>}
        </div>
      </details>
      <section className="min-w-0 rounded-xl border border-border bg-card p-3 sm:p-4" aria-label="دليل حسابات الموظفين">
        <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-border pb-3">
            <Button variant={filter === "linked" ? "default" : "outline"} className="h-10 gap-2 px-3 text-sm" onClick={() => setFilter("linked")} aria-pressed={filter === "linked"}><KeyRound className="h-4 w-4" />الحسابات المرتبطة ({linked.length})</Button>
            <Button variant={filter === "eligible" ? "default" : "outline"} className="h-10 gap-2 px-3 text-sm" onClick={() => setFilter("eligible")} aria-pressed={filter === "eligible"}><UserCheck className="h-4 w-4" />موظفون دون حساب ({eligible.length})</Button>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,.7fr)]">
          <div className="min-w-0"><label htmlFor="employee-accounts-search" className="mb-1.5 block text-sm font-semibold">بحث عن موظف أو حساب</label>
            <div className="relative"><Search className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="employee-accounts-search" className="h-10 pr-9 text-sm" value={term} onChange={event => setTerm(event.target.value)} placeholder="الاسم أو اسم المستخدم" /></div></div>
          <div className="min-w-0"><label htmlFor="employee-accounts-branch" className="mb-1.5 block text-sm font-semibold">الفرع</label>
            <select id="employee-accounts-branch" value={branchId} onChange={event => changeBranch(event.target.value)} className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm">
              <option value="">كل الفروع المصرّح بها</option>
              {!validBranch && <option value={branchId}>نطاق غير متاح · اختر فرعًا</option>}
              {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select></div>
          <div className="min-w-0"><label htmlFor="employee-accounts-status" className="mb-1.5 block text-sm font-semibold">حالة الدخول</label>
            <select id="employee-accounts-status" value={status} disabled={filter !== "linked"} onChange={event => setStatus(event.target.value as typeof status)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50">
              <option value="all">كل الحالات</option><option value="active">نشط</option><option value="inactive">مجمّد</option><option value="unknown">الحالة غير متاحة</option>
            </select></div>
        </div>
        <div className="my-3 flex flex-wrap items-center justify-between gap-2 text-sm leading-6 text-muted-foreground">
          <p>{filter === "linked" ? "لا يمكن عرض كلمات المرور المحفوظة أو تعديل اسم المستخدم." : "اختيار الموظف من هذه القائمة هو نقطة البداية الوحيدة لإنشاء الحساب."}</p>
          <p role="status">{directory.isFetching ? "جار التحقق من الخادم…" : `${rows.length} موظف ضمن النطاق المحدد`}</p>
        </div>
        {!validBranch ? <Empty>الفرع المطلوب غير متاح في الدليل الحالي. اختر نطاقًا مسموحًا أعلاه؛ لم يتم توسيع النطاق تلقائيًا.</Empty>
          : !rows.length ? <Empty><span className="block font-semibold">{term.trim() || (filter === "linked" && status !== "all") ? "لا توجد نتائج مطابقة للبحث أو الحالة المحددة." : filter === "linked" ? "لا توجد حسابات مرتبطة في هذا النطاق." : "لا يوجد موظفون مؤهلون دون حساب في هذا النطاق."}</span><span className="mt-1 block">راجع الفلاتر أعلاه؛ لا يغيّر البحث نطاق صلاحيتك.</span></Empty>
          : <div className="accounts-ledger">
            <div aria-hidden="true" className="accounts-columns"><span>الموظف / اسم المستخدم</span><span>الفرع</span><span>حالة الدخول</span><span>القالب المسند · الإصدار</span><span>الإدارة</span></div>
            {rows.map(employee => <details key={`${dialogScope}:${employee.employeeId}`} className="accounts-record min-w-0" data-testid={`employee-account-${employee.employeeId}`}>
              <summary className="accounts-summary" aria-label={`تفاصيل وإدارة · ${employee.employeeName}`}>
                <div className="min-w-0">
                  <p className="break-words text-base font-bold">{employee.employeeName}</p>
                  {employee.account && <p className="mt-1 break-words text-sm text-muted-foreground"><bdi className="font-mono">{employee.account.username ?? "اسم المستخدم غير متاح"}</bdi></p>}
                </div>
                <div className="min-w-0 break-words"><span className="accounts-mobile-label">الفرع</span>{employee.branchName}</div>
                <div><span className="accounts-mobile-label">حالة الدخول</span>
                  <span className={`inline-flex rounded-md px-2 py-1 text-sm font-semibold ${!employee.hasAccount || !employee.account ? "bg-violet-50 text-violet-800" : employee.account.isActive === "active" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
                    {!employee.hasAccount ? "بلا حساب" : !employee.account ? "الحالة غير متاحة" : employee.account.isActive === "active" ? "نشط" : "مجمّد"}
                  </span>
                  {employee.hasAccount && <p className="mt-1 text-xs leading-5 text-muted-foreground">{employee.management?.allowed && employee.account ? "إدارة الحساب متاحة" : employee.management?.branchTemplateAllowed ? "قالب الفرع فقط" : "إدارة الحساب مقيدة"}</p>}
                </div>
                <EmployeeAssignment employee={employee} />
                <span className="inline-flex w-fit items-center gap-2 rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-900">تفاصيل وإدارة<ChevronDown className="accounts-chevron h-4 w-4 shrink-0" /></span>
              </summary>
              <div className="accounts-detail space-y-3" data-testid={`employee-account-management-${employee.employeeId}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-bold">إدارة حساب · {employee.employeeName}</h2>
                  <span className={`rounded-md px-2 py-1 text-xs font-semibold ${employee.management?.allowed ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>{!employee.hasAccount ? "بلا حساب" : employee.management?.allowed && employee.account ? "حساب قابل للإدارة" : employeeManagementLabel(employee.management?.reason ?? "not_selected")}</span>
                </div>
              {!employee.management?.allowed && <div className="break-words rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm leading-6 text-amber-900">
                {employee.management?.blocker && <p className="font-semibold">سبب الحماية: {employee.management.blocker.message} <bdi>({employee.management.blocker.code})</bdi></p>}
                <p>{employee.management?.branchTemplateAllowed
                  ? "تخصيص قالب لهذا الفرع متاح أدناه. الحماية تخص الإجراءات التي تغيّر الحساب كله، مثل تجميده أو تعديل صلاحياته العامة."
                  : employeeManagementExplanation(employee.management?.reason ?? "not_selected", actorRole)}</p>
              </div>}
              {!employee.management?.allowed && employee.account?.isActive === "inactive" && !employee.account.canReactivate && <p className="text-sm leading-6 text-amber-800">غير مؤهل لإعادة الفتح وفق السياسة الحالية؛ ظهور الحساب ضمن تغطية الفرع لا يعيد فتحه. راجع انتقاله إلى قالب معتمد ومؤهل ثم أهلية إعادة الفتح، كل إجراء بتأكيد مستقل.</p>}
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {(employee.management?.branchTemplateAllowed || employee.management?.allowed) && <section className="accounts-detail-section space-y-2">
                  <h3>{employee.management?.branchTemplateAllowed ? "قالب هذا الفرع" : !employee.hasAccount ? "إنشاء حساب الموظف" : "إسناد القالب"}</h3>
                  <p className="text-muted-foreground">{employee.management?.branchTemplateAllowed ? `التخصيص يخص ${employee.branchName} فقط؛ لا يغيّر صلاحيات الفروع الأخرى أو حالة دخول الحساب.` : "راجع القالب والإصدار والنطاق قبل التأكيد. لا يطبّق أي تغيير بمجرد اختيار الموظف."}</p>
                  {employee.management?.branchTemplateAllowed && <BranchTemplateAction key={JSON.stringify([employee.employeeId, employee.branchId, employee.employeeName, employee.management])} employee={employee} disabled={directory.isFetching} />}
                  {employee.management?.allowed && (!employee.hasAccount
                    ? <Button className="gap-2" disabled={!delegationEnabled || directory.isFetching} onClick={() => open(employee, "create")}><KeyRound className="h-4 w-4" />اختيار الموظف</Button>
                    : employee.account && !employee.management?.branchTemplateAllowed && <Button variant="outline" className="gap-2" disabled={directory.isFetching} onClick={() => open(employee, "permissions")}><ShieldCheck className="h-4 w-4" />إسناد قالب معتمد</Button>)}
                </section>}
                {employee.management?.allowed && employee.account && <section className="accounts-detail-section space-y-2">
                  <h3>حالة الدخول · الحساب بالكامل</h3>
                  <p className="text-muted-foreground">التجميد وإعادة الفتح يؤثران على دخول الحساب، وليس على قالب الفرع فقط. يتطلب كل إجراء تأكيدًا مستقلًا.</p>
                  {employee.account?.isActive === "inactive" && !employee.account.canReactivate && <p className="text-amber-800">غير مؤهل لإعادة الفتح وفق السياسة الحالية؛ ظهور الحساب ضمن تغطية الفرع لا يعيد فتحه. راجع انتقاله إلى قالب معتمد ومؤهل ثم أهلية إعادة الفتح، كل إجراء بتأكيد مستقل.</p>}
                  {employee.account.isActive === "active" ? <Button variant="outline" className="gap-2 border-amber-300 text-amber-900" disabled={directory.isFetching} onClick={() => open(employee, "freeze")}><Lock className="h-4 w-4" />تجميد</Button>
                    : <Button variant="outline" className="gap-2" disabled={!delegationEnabled || !employee.account.canReactivate || directory.isFetching} onClick={() => open(employee, "reopen")}><Unlock className="h-4 w-4" />إعادة الفتح</Button>}
                </section>}
                {actorRole === "admin" && employee.hasAccount && <section className="accounts-detail-section space-y-2 lg:col-span-2">
                  <h3>أدوات مسؤول النظام</h3>
                  <p className="text-muted-foreground">الإضافات المستقلة ومقارنة القوالب مساران منفصلان عن الإدارة المفوّضة وقالب الفرع.</p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" className="gap-2 border-amber-200 text-amber-900" disabled={directory.isFetching} onClick={() => open(employee, "additions")}><ShieldCheck className="h-4 w-4" />الإضافات المستقلة</Button>
                    <Button variant="outline" className="gap-2" disabled={directory.isFetching} onClick={() => open(employee, "pilot")}><ShieldCheck className="h-4 w-4" />مقارنة وتجربة قالب</Button>
                  </div>
                </section>}
              </div>
            </div>
          </details>)}</div>}
      </section>
      {dialog && dialogEligible && currentEmployee && dialog.scope === (dialog.mode === "pilot" ? accessScope : dialogScope) && (dialog.mode === "pilot"
        ? <EmployeeTemplatePilotDialog key={`${accessScope}:${dialog.employee.employeeId}:pilot`} actorRole={actorRole} actorId={actorId} contextRevision={JSON.stringify([data.policy, data.availablePermissions])} employee={currentEmployee} close={() => setDialog(null)} refresh={refresh} />
        : dialog.mode === "additions"
          ? <EmployeeAccountAdditionsDialog key={`${dialogScope}:${dialog.employee.employeeId}:${dialog.mode}`} actorRole={actorRole} employee={currentEmployee} close={() => setDialog(null)} refresh={refresh} />
        : dialog.mode === "create" || dialog.mode === "permissions"
          ? <EmployeeTemplateAssignmentDialog key={`${dialogScope}:${dialog.employee.employeeId}:${dialog.mode}`} employee={currentEmployee} mode={dialog.mode} directory={data} close={() => setDialog(null)} refresh={refresh} />
          : <EmployeeAccountDialog key={`${dialogScope}:${dialog.employee.employeeId}:${dialog.mode}`} employee={currentEmployee} mode={dialog.mode} directory={data} close={() => setDialog(null)} refresh={refresh} />)}
    </>}
  </main></Layout>;
}

function BranchTemplateAction({ employee, disabled }: { employee: DelegatedEmployeeAccount; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  return <div className="space-y-1">
    <Button variant="outline" className="gap-2" disabled={disabled} onClick={() => { if (!disabled) setOpen(true); }}><ShieldCheck className="h-4 w-4" />تخصيص قالب لهذا الفرع</Button>
    {open && <BranchTemplateDialog employee={employee} onClose={() => setOpen(false)} />}
  </div>;
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