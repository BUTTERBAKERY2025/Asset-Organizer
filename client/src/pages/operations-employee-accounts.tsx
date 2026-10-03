import { useEffect, useState } from "react";
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
  return <div className="min-w-0 rounded-md bg-violet-50/50 px-2.5 py-2 text-xs xl:bg-transparent xl:px-0" data-testid={`employee-template-assignment-${employee.employeeId}`}>
    <p className="mb-1 text-[10px] font-semibold text-muted-foreground">القالب المسند</p>
    {!employee.hasAccount ? <p className="text-muted-foreground">لا يوجد حساب</p>
      : assignment === undefined ? <p className="text-muted-foreground">بيانات إسناد القالب غير متاحة</p>
        : assignment === null ? <p className="text-muted-foreground">لا يوجد قالب مسند</p>
          : <div className="space-y-1">
            <p className="break-words font-semibold leading-5 text-[#302840]">{assignment.name?.trim() || `قالب رقم ${assignment.templateId}`}</p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="whitespace-nowrap text-muted-foreground">الإصدار <bdi className="font-mono font-semibold">{assignment.version}</bdi></span>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${assignment.approved ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>{assignment.approved ? "معتمد" : "يحتاج مراجعة"}</span>
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
    `${employee.employeeName} ${employee.branchName} ${employee.account?.username ?? ""}`.toLocaleLowerCase().includes(term.trim().toLocaleLowerCase()));
  const open = (employee: DelegatedEmployeeAccount, mode: EmployeeAccountDialogMode | "additions" | "pilot") => {
    if (directory.isFetching) return;
    if (mode === "additions" || mode === "pilot" ? actorRole !== "admin" || !employee.hasAccount
      : !employee.management?.allowed || (mode === "create" ? employee.hasAccount : !employee.account)) return;
    setDialog({ employee, mode, scope: mode === "pilot" ? accessScope : dialogScope });
  };
  const delegationEnabled = !!data?.policy.enabled;
  return <Layout><main dir="rtl" className="page-container mx-auto max-w-[1550px] space-y-2.5 pb-5 [&_button]:transition-colors [&_button]:duration-150" data-testid="operations-employee-accounts-page">
    <header className="border-b border-[#e7def0] pb-2 pt-1">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0"><p className="text-[10px] font-bold tracking-wide text-violet-700">BUTTER BAKERY · OPERATIONS</p><h1 className="flex items-center gap-2 text-xl font-black text-[#302840]"><KeyRound className="h-5 w-5 text-violet-700" />حسابات الموظفين</h1>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">إنشاء وإدارة حسابات الموظفين الموجودين في الفروع المصرّح بها فقط.</p></div>
        <div className="flex flex-wrap gap-1.5">
          <Button asChild variant="outline" className="h-9 gap-1.5 px-2.5 text-xs"><Link href="/operations-center"><ArrowRight className="h-3.5 w-3.5" />مركز التشغيل</Link></Button>
          {actorRole === "admin" && <Button variant={policyOpen ? "default" : "outline"} className="h-9 gap-1.5 px-2.5 text-xs" onClick={() => { setDialog(null); setPolicyOpen(value => !value); }} aria-expanded={policyOpen} aria-controls="employee-account-policy"><ShieldCheck className="h-3.5 w-3.5" />سياسة التفويض</Button>}
          <Button type="button" variant="outline" className="h-9 gap-1.5 px-2.5 text-xs" disabled={directory.isFetching} onClick={refresh}><RefreshCw className="h-3.5 w-3.5" />تحديث</Button>
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
      <details className={`group rounded-lg border text-xs ${delegationEnabled ? "border-violet-200 bg-violet-50/40 text-violet-900" : "border-amber-200 bg-amber-50/60 text-amber-900"}`}>
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 rounded-lg px-3 py-2 font-semibold hover:bg-violet-100/30 [&::-webkit-details-marker]:hidden">
          <ShieldCheck className="h-4 w-4 shrink-0" /><span>إرشادات إدارة الحسابات ونطاق التفويض</span>
          <span className={`rounded px-1.5 py-0.5 text-[10px] ${delegationEnabled ? "bg-violet-100" : "bg-amber-100"}`}>{delegationEnabled ? "التفويض مفعّل" : "التفويض معطّل"}</span>
          <ChevronDown className="mr-auto h-4 w-4 shrink-0 group-open:rotate-180" />
        </summary>
        <div className="space-y-2 border-t border-inherit p-2">
      <div className={`flex items-start gap-2 rounded-md border p-2 text-xs leading-5 ${delegationEnabled ? "border-violet-200 bg-violet-50/60 text-violet-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
        <ShieldCheck className="mt-1 h-4 w-4 shrink-0" /><p>{delegationEnabled ? "حدد موظفًا واحدًا للإجراء ثم أي إصدار معتمد ومؤهل للإدارة المفوّضة وفرعه المصرّح به، لإنشاء حساب أو تحديث حساب قائم. الخيارات ليست محصورة بالكاشير؛ اعتماد القالب مستقل عن سقف الصلاحيات اليدوية القديم. راجع فرق الأساس وأكّد حسابًا واحدًا؛ الخادم يتحقق من تغطية الفرع والاعتماد والحالة الحالية ودليل الربط عند وجوده وحدود الإجراءات والنطاقات المدعومة. القالب الفارغ صالح وبوابة الموظف الذاتية مستقلة." : "التفويض معطّل. إسناد القوالب والإنشاء وإعادة الفتح غير متاحة؛ يبقى عرض الحسابات وتجميدها متاحًا."}{" "}تعطيل السياسة أو تضييق المسار اليدوي القديم لا يسحب تلقائيًا وصول الحسابات الحالية. لا يعني اعتماد القالب دعم كل نطاق فرع أو منح وصول عالمي آمن. لا توجد تغييرات جماعية أو تعديل يدوي للصلاحيات في هذه الصفحة؛ لتوقيف الدخول جمّد الحساب صراحةً.</p>
      </div>
      <p className="rounded-md border border-violet-200 bg-violet-50/30 p-2 text-xs leading-5 text-violet-900">تغطية مدير العمليات تشمل تلقائيًا جميع الموظفين الحاليين والمستقبليين في فروعه المصرّح له بالكتابة والإدارة فيها؛ لا توجد قائمة أسماء تحتاج موافقة منفصلة. فروع القراءة فقط والأدوار الإدارية والحسابات المحمية أو متعددة الفروع لا تُتاح تلقائيًا. اختيار موظف هنا يحدد هدف الإجراء فقط: لا إنشاء حسابات ولا إسناد قوالب أو منح صلاحيات تلقائي. الحساب العادي ذو الصلاحيات المباشرة المعروفة يمكن مراجعته للانتقال إلى قالب وفق قرار الخادم؛ الاستثناءات أو RBAC غير المعروف تبقى محظورة، والحساب المجمّد لا يُفتح بمجرد ظهور اسمه في النطاق.</p>
      {actorRole === "admin" && <p className="rounded-md border border-amber-200 bg-amber-50/40 p-2 text-xs leading-5 text-amber-900">للأدمن: استخدم «مقارنة وتجربة قالب» لمراجعة القوالب وإسنادها للحسابات المرتبطة. «خارج نطاق الإدارة المفوّضة» يخص صلاحية الإدارة عبر مسار التفويض، وليس حالة دخول الموظف. الإضافات المستقلة لا تغيّر القالب الأساسي أو الاستثناءات القديمة، والنطاق العام ليس مقيدًا بفرع الموظف.</p>}
        </div>
      </details>
      <section className="min-w-0 rounded-xl border border-border bg-card p-2.5 sm:p-3" aria-label="دليل حسابات الموظفين">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end">
          <div className="flex flex-wrap gap-1.5">
            <Button variant={filter === "linked" ? "default" : "outline"} className="h-9 gap-1.5 px-2.5 text-xs" onClick={() => setFilter("linked")} aria-pressed={filter === "linked"}><KeyRound className="h-3.5 w-3.5" />الحسابات المرتبطة ({linked.length})</Button>
            <Button variant={filter === "eligible" ? "default" : "outline"} className="h-9 gap-1.5 px-2.5 text-xs" onClick={() => setFilter("eligible")} aria-pressed={filter === "eligible"}><UserCheck className="h-3.5 w-3.5" />موظفون دون حساب ({eligible.length})</Button>
          </div>
          <div className="min-w-0 flex-1"><label htmlFor="employee-accounts-branch" className="mb-1 block text-[11px] font-bold">الفرع</label>
            <select id="employee-accounts-branch" value={branchId} onChange={event => changeBranch(event.target.value)} className="h-9 w-full min-w-0 rounded-md border border-input bg-background px-2 text-xs">
              <option value="">كل الفروع المصرّح بها</option>
              {!validBranch && <option value={branchId}>نطاق غير متاح · اختر فرعًا</option>}
              {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select></div>
          <div className="min-w-0 flex-1"><label htmlFor="employee-accounts-search" className="mb-1 block text-[11px] font-bold">بحث عن موظف أو حساب</label>
            <div className="relative"><Search className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input id="employee-accounts-search" className="h-9 pr-8 text-xs" value={term} onChange={event => setTerm(event.target.value)} placeholder="الاسم أو اسم المستخدم" /></div></div>
        </div>
        <p className="my-2 text-[11px] leading-5 text-muted-foreground">{filter === "linked" ? "يشمل الحسابات النشطة والمجمّدة. لا يمكن عرض كلمات المرور المحفوظة أو تعديل اسم المستخدم." : "اختيار الموظف من هذه القائمة هو نقطة البداية الوحيدة لإنشاء الحساب."}{directory.isFetching ? " · جار التحقق من الخادم…" : ""}</p>
        {!validBranch ? <Empty>الفرع المطلوب غير متاح في الدليل الحالي. اختر نطاقًا مسموحًا أعلاه؛ لم يتم توسيع النطاق تلقائيًا.</Empty>
          : !rows.length ? <Empty>{term.trim() ? "لا توجد نتائج مطابقة للبحث." : filter === "linked" ? "لا توجد حسابات مرتبطة في هذا النطاق." : "لا يوجد موظفون مؤهلون دون حساب في هذا النطاق."}</Empty>
          : <div className="overflow-hidden rounded-lg border border-border">
            <div aria-hidden="true" className="hidden grid-cols-[minmax(0,1fr)_minmax(0,220px)_330px] gap-3 border-b border-border bg-violet-50/60 px-3 py-2 text-[10px] font-bold text-violet-900 xl:grid"><span>الموظف والحساب</span><span>القالب المسند · الإصدار الفعلي</span><span>الإجراءات</span></div>
            {rows.map(employee => <article key={employee.employeeId} className="grid min-w-0 grid-cols-1 items-center gap-2 border-b border-border bg-background px-2.5 py-2.5 last:border-b-0 hover:bg-violet-50/20 xl:grid-cols-[minmax(0,1fr)_minmax(0,220px)_330px] xl:gap-3 xl:px-3" data-testid={`employee-account-${employee.employeeId}`}>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1"><h2 className="break-words text-sm font-bold text-[#302840]">{employee.employeeName}</h2>
                <span className={`max-w-full rounded px-1.5 py-0.5 text-[10px] font-bold ${!employee.hasAccount ? "bg-violet-100 text-violet-800" : employee.management?.allowed ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{!employee.hasAccount ? "بلا حساب" : employee.management?.allowed && employee.account ? "حساب قابل للإدارة" : employeeManagementLabel(employee.management?.reason ?? "not_selected")}</span>
                {employee.account && <span className="text-[11px] text-muted-foreground">{employee.account.isActive === "active" ? "نشط" : "مجمّد"}</span>}</div>
              <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">{employee.branchName}{employee.account && <> · <bdi className="font-mono">{employee.account.username ?? "اسم المستخدم غير متاح"}</bdi></>}</p>
              {employee.account?.isActive === "inactive" && !employee.account.canReactivate && <p className="mt-1 text-[11px] text-amber-800">غير مؤهل لإعادة الفتح وفق السياسة الحالية؛ ظهور الحساب ضمن تغطية الفرع لا يعيد فتحه. راجع انتقاله إلى قالب معتمد ومؤهل ثم أهلية إعادة الفتح، كل إجراء بتأكيد مستقل.</p>}
              {!employee.management?.allowed && <div className="mt-1 break-words text-[11px] leading-5 text-amber-800">
                {employee.management?.blocker && <p className="font-semibold">سبب الحماية: {employee.management.blocker.message} <bdi>({employee.management.blocker.code})</bdi></p>}
                <p>{employee.management?.branchTemplateAllowed
                  ? "تخصيص قالب لهذا الفرع متاح بالزر أدناه. الحماية تخص الإجراءات التي تغيّر الحساب كله، مثل تجميده أو تعديل صلاحياته العامة."
                  : employeeManagementExplanation(employee.management?.reason ?? "not_selected", actorRole)}</p>
              </div>}
            </div>
            <EmployeeAssignment employee={employee} />
            {employee.management?.branchTemplateAllowed && <BranchTemplateAction employee={employee} />}
            {(employee.management?.allowed || (actorRole === "admin" && employee.hasAccount)) && <div className="grid min-w-0 grid-cols-1 gap-1.5 min-[400px]:grid-cols-2 [&_button]:h-auto [&_button]:min-h-8 [&_button]:min-w-0 [&_button]:gap-1.5 [&_button]:whitespace-normal [&_button]:px-2 [&_button]:py-1.5 [&_button]:text-xs [&_button]:leading-4 [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:shrink-0">
              {employee.management?.allowed && (!employee.hasAccount ? <Button disabled={!delegationEnabled || directory.isFetching} onClick={() => open(employee, "create")}><KeyRound />اختيار الموظف</Button> : employee.account && <>
                 {!employee.management?.branchTemplateAllowed && <Button variant="outline" disabled={directory.isFetching} onClick={() => open(employee, "permissions")}><ShieldCheck />إسناد قالب معتمد</Button>}
                {employee.account.isActive === "active" ? <Button variant="outline" className="text-amber-800" disabled={directory.isFetching} onClick={() => open(employee, "freeze")}><Lock />تجميد</Button>
                  : <Button variant="outline" disabled={!delegationEnabled || !employee.account.canReactivate || directory.isFetching} onClick={() => open(employee, "reopen")}><Unlock />إعادة الفتح</Button>}
              </>)}
              {actorRole === "admin" && employee.hasAccount && <Button variant="outline" className="border-amber-200 text-amber-900" disabled={directory.isFetching} onClick={() => open(employee, "additions")}><ShieldCheck />الإضافات المستقلة</Button>}
              {actorRole === "admin" && employee.hasAccount && <Button variant="outline" disabled={directory.isFetching} onClick={() => open(employee, "pilot")}><ShieldCheck />مقارنة وتجربة قالب</Button>}
            </div>}
          </article>)}</div>}
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

function BranchTemplateAction({ employee }: { employee: DelegatedEmployeeAccount }) {
  const [open, setOpen] = useState(false);
  return <div className="space-y-1">
    <Button size="sm" variant="outline" onClick={() => setOpen(true)}><ShieldCheck className="h-3.5 w-3.5 me-1" />تخصيص قالب لهذا الفرع</Button>
    <p className="text-[11px] text-muted-foreground">تخصيص الفرع مستقل عن إدارة الحساب كله.</p>
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