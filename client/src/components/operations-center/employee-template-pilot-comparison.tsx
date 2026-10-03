import type { DelegatedPermission, EmployeeTemplatePilotResponse, PilotAuthority, PilotPermissionSource } from "@shared/employee-account-delegation";
import { additionDateLabel } from "@/lib/employee-account-additions";
import { employeeTemplateDiff } from "@/lib/employee-template-assignment";
import { EmployeeAccountAdditionsReadOnly, additionActionLabel, additionModuleLabel } from "./employee-account-additions-list";

const sourceLabels: Record<PilotPermissionSource["source"], string> = {
  direct: "أساس مباشر", role: "دور موروث", override_grant: "منح مستقل", override_deny: "منع مستقل", intrinsic: "وصول أصيل للوظيفة",
};
const temporalLabels: Record<PilotPermissionSource["temporalState"], string> = {
  active: "ضمن الفترة", future: "لم يبدأ", expired: "انتهت صلاحيته", inactive: "غير نشط", invalid: "صلاحية زمنية غير صالحة",
};

export function PilotPermissionList({ permissions, empty }: { permissions: DelegatedPermission[]; empty: string }) {
  return !permissions.length ? <p className="text-xs leading-6 text-muted-foreground">{empty}</p> : <div className="space-y-2">{permissions.map(row => <p key={row.module} className="text-xs leading-6"><strong>{additionModuleLabel(row.module)}</strong><br />{row.actions.map(additionActionLabel).join("، ")}</p>)}</div>;
}

export function PilotSources({ sources }: { sources: PilotPermissionSource[] }) {
  return <div className="space-y-2">{!sources.length ? <p className="text-xs text-muted-foreground">لم يعرض الخادم مصادر إضافية لهذه اللقطة.</p> : sources.map((source, index) => <article key={`${source.module}:${source.action}:${source.source}:${index}`} className="rounded-lg border bg-background p-2 text-[11px] leading-6">
    <p className="font-bold">{additionModuleLabel(source.module)} · {additionActionLabel(source.action)}</p>
    <p>{sourceLabels[source.source]} · <span className={source.source === "override_deny" ? "font-bold text-rose-800" : "text-muted-foreground"}>{source.allowed ? "مسموح وفق هذا المصدر" : "غير مسموح وفق هذا المصدر"}</span> · {temporalLabels[source.temporalState]}</p>
    <p className="text-muted-foreground">نطاق المصدر: <bdi>{source.scopeType}</bdi>{source.branchId && <> · فرع: <bdi>{source.branchId}</bdi></>}{source.departmentId !== null && <> · قسم: {source.departmentId}</>}</p>
    {(source.startsAt || source.endsAt) && <p className="text-muted-foreground">البداية: {additionDateLabel(source.startsAt)} · الانتهاء: {additionDateLabel(source.endsAt)}</p>}
  </article>)}</div>;
}

export function PilotAuthorityPanel({ title, authority }: { title: string; authority: PilotAuthority | null }) {
  return <section className="min-w-0 space-y-3 rounded-xl border bg-muted/20 p-3">
    <h3 className="text-sm font-bold">{title}</h3>
    {authority === null ? <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-900">غير معروف. لم يؤكد الخادم إمكانية تقييم هذه الحالة؛ هذا ليس وصولًا فارغًا أو رفضًا مفترضًا لكل الإجراءات.</p> : <>
      <p className="text-[11px] text-muted-foreground">نمط المصدر: {authority.sourceMode === "direct" ? "مباشر" : authority.sourceMode === "inherit" ? "موروث" : "غير محدد"}</p>
      {!authority.effectivePermissions.length ? <PilotPermissionList permissions={authority.effectivePermissions} empty="أكد الخادم عدم وجود إجراءات فعالة في هذه اللقطة والنطاق." /> : <details className="rounded-lg border p-2"><summary className="min-h-11 cursor-pointer text-xs font-bold">إجراءات فعالة: {authority.effectivePermissions.reduce((count, row) => count + row.actions.length, 0)} · عرض القائمة ({authority.effectivePermissions.length} وحدات)</summary><PilotPermissionList permissions={authority.effectivePermissions} empty="أكد الخادم عدم وجود إجراءات فعالة في هذه اللقطة والنطاق." /></details>}
      <details className="rounded-lg border p-2"><summary className="min-h-11 cursor-pointer text-xs font-bold">مصادر الوصول والحالات الزمنية ({authority.sources.length})</summary><PilotSources sources={authority.sources} /></details>
    </>}
  </section>;
}

export function EmployeeTemplatePilotComparison({ comparison, branchName, stale = false }: {
  comparison: EmployeeTemplatePilotResponse; branchName: string; stale?: boolean;
}) {
  const baseDiff = comparison.proposedBase === null ? null : employeeTemplateDiff(comparison.currentBase, comparison.proposedBase);
  const changedBase = baseDiff?.filter(row => row.added.length || row.removed.length) ?? [];
  const unchangedBase = baseDiff?.filter(row => !row.added.length && !row.removed.length) ?? [];
  const baseRow = (row: NonNullable<typeof baseDiff>[number]) => <div key={row.module} className="rounded-lg border bg-background p-2 text-xs leading-6"><h4 className="font-bold">{additionModuleLabel(row.module)}</h4><div className="mt-1 grid gap-1 sm:grid-cols-2 sm:gap-3"><p>قبل: {row.before.map(additionActionLabel).join("، ") || "بلا إجراءات مباشرة"}</p><p>بعد: {row.after.map(additionActionLabel).join("، ") || "بلا إجراءات مباشرة"}</p></div></div>;
  return <div className="space-y-3 break-words" data-testid="pilot-server-comparison">
    <div className={`rounded-lg border p-3 text-xs leading-6 ${stale ? "border-amber-300 bg-amber-50 text-amber-900" : "border-violet-200 bg-violet-50/40 text-violet-900"}`}>
      <p className="font-bold">{stale ? "لقطة سابقة · يجب إعادة المقارنة قبل أي تطبيق" : "لقطة محسوبة على الخادم"}</p>
      <p>وقت اللقطة: {additionDateLabel(comparison.capturedAt)} · بتوقيت السعودية</p>
      <p>الفرع المحفوظ: {branchName} · <bdi>{comparison.scope.branchId}</bdi></p>
      {comparison.nextDecisionBoundary && <p>الحد الزمني التالي لقرار الصلاحيات: {additionDateLabel(comparison.nextDecisionBoundary)}. تجاوزه يتطلب لقطة جديدة؛ لا نغيّر حالات المصادر في المتصفح.</p>}
      {comparison.scope.limitations.map((limitation, index) => <p key={index}>{limitation}</p>)}
    </div>
    {comparison.assignment ? <p className="rounded-lg border bg-muted/20 p-3 text-xs leading-6" data-testid="pilot-current-assignment">الإسناد الحالي المحفوظ: قالب #{comparison.assignment.templateId} · الإصدار {comparison.assignment.version} · الفرع <bdi>{comparison.assignment.branchId}</bdi><br />وقت الإسناد: {additionDateLabel(comparison.assignment.assignedAt)} · السبب: {comparison.assignment.reason}<br />يبقى هذا السجل ظاهرًا ولو كان إصدارًا أقدم من خيارات الإسناد الحالية؛ اعتماد أحدث لا يعيد تطبيقه تلقائيًا.</p> : <p className="text-xs text-muted-foreground">لا يوجد سجل إسناد قالب حالي؛ لا نفترض أن الحساب بلا صلاحيات.</p>}
    {comparison.blockedReasons.length > 0 && <section role="alert" className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs leading-6 text-amber-900"><h3 className="font-bold">المقارنة أو التجربة محظورة</h3>{comparison.blockedReasons.map((reason, index) => <p key={`${reason.code}:${index}`}>{reason.message} <bdi className="font-mono text-[10px]">({reason.code})</bdi></p>)}</section>}
    <section className="space-y-3 rounded-xl border border-violet-200 p-3" aria-label="فرق الصلاحيات الفعالة من الخادم">
      <h3 className="text-sm font-bold">فرق الوصول الفعّال · من الخادم</h3>
      {comparison.differences === null ? <p className="text-xs leading-6 text-amber-900">الفرق غير معروف. لم ننشئ مقارنة بديلة من قوائم القالب أو الإضافات.</p> : <>
        <div className="grid gap-3 md:grid-cols-2"><div className="rounded-lg bg-emerald-50 p-3"><p className="mb-2 text-xs font-bold text-emerald-900">وصول سيُضاف</p><PilotPermissionList permissions={comparison.differences.additions} empty="لا إضافات فعالة بحسب الخادم." /></div><div className="rounded-lg bg-rose-50 p-3"><p className="mb-2 text-xs font-bold text-rose-900">وصول سيُزال</p><PilotPermissionList permissions={comparison.differences.removals} empty="لا إزالات فعالة بحسب الخادم." /></div></div>
        <details className="rounded-lg border p-2"><summary className="min-h-11 cursor-pointer text-xs font-bold">الوصول المحتفظ به</summary><PilotPermissionList permissions={comparison.differences.retained} empty="لا إجراءات محتفظ بها بحسب الخادم." /></details>
        <details open={comparison.differences.retainedDenies.length > 0} className="rounded-lg border border-rose-200 p-2"><summary className="min-h-11 cursor-pointer text-xs font-bold text-rose-900">مصادر المنع المحتفظ بها ({comparison.differences.retainedDenies.length})</summary><PilotSources sources={comparison.differences.retainedDenies} /></details>
      </>}
    </section>
    <section className="space-y-3 rounded-xl border bg-muted/20 p-3" aria-label="فرق الأساس المستقل في التجربة">
      <h3 className="text-sm font-bold">فرق الأساس فقط · ليس الوصول الفعّال</h3>
      {baseDiff === null ? <p className="text-xs text-amber-900">الأساس المقترح غير متاح لهذه الحالة؛ لا نفترض قائمة فارغة.</p> : !baseDiff.length ? <p className="text-xs text-muted-foreground">لا إجراءات في الأساس الحالي أو المقترح. هذا لا يسحب بوابة الموظف أو الوصول الأصيل.</p> : <>
        <p className="text-xs text-muted-foreground">{changedBase.length ? `وحدات يتغير أساسها: ${changedBase.length}` : "لا تغيير في إجراءات الأساس."}</p>
        {changedBase.map(baseRow)}
        {!!unchangedBase.length && <details className="rounded-lg border p-2"><summary className="min-h-11 cursor-pointer text-xs font-bold">وحدات الأساس دون تغيير ({unchangedBase.length}) · قبل وبعد</summary>{unchangedBase.map(baseRow)}</details>}
      </>}
    </section>
    <div className="grid gap-3 md:grid-cols-2" aria-label="الصلاحيات الفعلية الحالية والمتوقعة">
      <PilotAuthorityPanel title="الحالي الفعلي · بوابة الصلاحيات" authority={comparison.before} />
      <PilotAuthorityPanel title="المتوقع بعد تغيير الأساس" authority={comparison.after} />
    </div>
    <details className="rounded-lg border p-2"><summary className="min-h-11 cursor-pointer text-xs font-bold">الإضافات المستقلة المحفوظة ({comparison.extras.length}) · لا تتغير بالتجربة</summary><EmployeeAccountAdditionsReadOnly additions={comparison.extras} branchName={branchName} /></details>
    <p className="text-[11px] leading-6 text-muted-foreground">المقارنة لبوابة الصلاحيات في فرع الموظف فقط؛ ليست شهادة بأن كل مسار قديم يفرض النطاق السياقي. قيود الموارد والمهام والملفات والملكية وسير العمل تبقى مستقلة. الإضافات والمنع والوصول الأصيل لا تتحول إلى أساس جديد.</p>
  </div>;
}